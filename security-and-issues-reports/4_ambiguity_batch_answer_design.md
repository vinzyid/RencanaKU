# Perbaikan Masalah #4: Ambiguity Batch Answer UX Design

> **Status**: 🟡 Low-Medium Priority  
> **Kategori**: User Experience & Design  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Saat AI mendeteksi multiple ambiguities (maksimal 3 pertanyaan sekaligus), user hanya punya SATU input field untuk menjawab SEMUA pertanyaan tersebut. Sistem secara default menulis jawaban yang SAMA untuk semua pertanyaan, sehingga jawaban menjadi tidak relevan dan membingungkan.

### Code Implementation Current (Line 371-375)

```php
private function handleAmbiguityAnswer(Project $project, PrdVersion $latest, AmbiguityFlag $flag, string $content): void
{
    // ❌ ALL unanswered flags get THE SAME response!
    $latest->ambiguityFlags()
        ->where('is_resolved', false)
        ->update(['is_resolved' => true, 'resolution_answer' => $content]);
    
    $revised = $this->generator->revise($latest->decodedContent(), $content, $flag->question);
    // ...
}
```

### Contoh Skenario Problematic

**AI asks two questions simultaneously:**

1. "Seberapa cepat aplikasi harus merespon?"
   - A: Langsung muncul (<1 detik)
   - B: Cukup cepat (<3 detik)
   - C: Tidak terlalu penting

2. "Siapa target pengguna aplikasi ini?"
   - A: Untuk saya sendiri
   - B: Untuk teman/tim
   - C: Untuk pelanggan umum

**User Response**: "Untuk mahasiswa"

**What happens now**: 
- Both questions get `resolution_answer = "Untuk mahasiswa"`
- First question ("Speed") gets irrelevant answer!
- AI receives inconsistent context for revision

---

## 🎯 Penjelasan Solusi

### Solution A: Sequential Question Flow (Recommended)

Instead of asking all ambiguities at once, ask ONE question per turn.

#### Revised Approach

```php
// app/Services/Ai/PrdGenerator.php

public function detectAmbiguities(array $prd): array
{
    // ✅ Return only ONE most important question
    $items = $result['ambiguities'] ?? $result['questions'] ?? [];
    
    // Limit to 1 instead of max(2,3)
    return array_slice($this->normalizeQuestions($items), 0, 1);
}
```

#### Controller Update

```php
// app/Http/Controllers/ApiController.php

private const MAX_CLARIFICATION_ROUNDS = 5; // Increase since we're more granular

private function handleAmbiguityAnswer(Project $project, PrdVersion $latest, AmbiguityFlag $flag, string $content): void
{
    // ✅ Mark only THIS specific flag as resolved
    $flag->update([
        'is_resolved' => true,
        'resolution_answer' => $content,
        'answered_at' => now(),
    ]);
    
    // Check if there are remaining unresolved flags
    $remaining = $latest->ambiguityFlags()->where('is_resolved', false)->count();
    
    if ($remaining > 0) {
        // Ask next question
        $nextFlag = $latest->ambiguityFlags()
            ->where('is_resolved', false)
            ->first();
            
        $project->messages()->create([
            'sender' => 'ai',
            'content' => "Terima kasih, sudah saya catat.\n\nPertanyaan berikutnya:\n\n".$nextFlag->question."\n\nPilih salah satu:",
            'quick_replies' => $nextFlag->options ?? [],
            'related_prd_version_id' => $latest->id,
        ]);
        
        return;
    }
    
    // No more questions, proceed to contradiction check
    $this->proceedToContradictionCheck($project, $latest);
}

/**
 * Move to contradiction detection after all clarifications
 */
private function proceedToContradictionCheck(Project $project, PrdVersion $latest): void
{
    $contradiction = ContradictionFlag::where('prd_version_id', $latest->id)
        ->whereNull('resolution')->first();
    
    if ($contradiction) {
        // Show first contradiction
        $project->messages()->create([
            'sender' => 'ai',
            'content' => "Sudah cukup, makasih! Sekarang saya cek kontradiksi...",
            'related_prd_version_id' => $latest->id,
        ]);
        
        $this->handleContradictionStart($project, $latest, $contradiction);
        return;
    }
    
    // No contradictions either → ready to finalize
    $project->messages()->create([
        'sender' => 'ai',
        'content' => "Semua klarifikasi selesai. PRD siap difinalisasi!",
        'related_prd_version_id' => $latest->id,
    ]);
}
```

**Benefits:**
✅ Clear one-to-one mapping between question and answer  
✅ Better UX - focused conversation flow  
✅ More accurate AI revisions  
✅ Easier to track which clarification led to what change  

**Drawbacks:**
❌ Takes more rounds (potentially 3x longer)  
❌ May feel tedious for simple projects  

---

### Solution B: Multi-Line Answer with Index Mapping

Allow user to specify which answer corresponds to which question.

```javascript
// Frontend UI enhancement
const renderClarificationQuestions = (questions) => {
    return questions.map((q, idx) => `
        <div class="clarification-item" data-index="${idx}">
            <h4>${idx + 1}. ${q.question}</h4>
            <textarea 
                placeholder="Jawab untuk pertanyaan #${idx + 1}"
                name="answer_${idx}"
                class="answer-input"
                rows="2"
            ></textarea>
            <div class="quick-replies">
                ${q.options.map(opt => `<button data-answer="${opt}">${opt}</button>`).join('')}
            </div>
        </div>
    `).join('');
};
```

Backend processing:

```php
private function handleAmbiguityAnswer(Project $project, PrdVersion $latest, AmbiguityFlag $flag, string $content): void
{
    // Parse multi-part response
    $answers = parseMultiPartResponse($content);
    
    foreach ($latest->ambiguityFlags()->where('is_resolved', false) as $index => $currentFlag) {
        if (isset($answers[$index])) {
            $currentFlag->update([
                'is_resolved' => true,
                'resolution_answer' => $answers[$index],
            ]);
        }
    }
    
    // Use first answer for revision (fallback to others if unavailable)
    $revisionInput = $answers[0] ?? $content;
    $revised = $this->generator->revise($latest->decodedContent(), $revisionInput, $flag->question);
}

/**
 * Parse structured format like:
 * 1. Answer for Q1
 * 2. Answer for Q2
 * 3. Answer for Q3
 */
private function parseMultiPartResponse(string $content): array
{
    $lines = explode("\n", $content);
    $answers = [];
    
    foreach ($lines as $line) {
        if (preg_match('/^\s*(\d+)\.\s*(.+)$/i', trim($line), $matches)) {
            $index = (int)$matches[1] - 1; // Zero-based index
            $answers[$index] = trim($matches[2]);
        } else {
            // If single line, use it for all unanswered
            if (empty($answers)) {
                $answers = array_fill(0, count($allUnanswered), trim($content));
            }
        }
    }
    
    return $answers;
}
```

**Benefits:**
✅ Faster than sequential approach  
✅ More precise answers per question  
✅ Backward compatible with single-line responses  

**Drawbacks:**
❌ Requires UI changes  
❌ More complex parsing logic  

---

### Solution C: Smart Context Injection

Keep batch answering but improve how AI uses the answers.

```php
private function handleAmbiguityAnswer(Project $project, PrdVersion $latest, AmbiguityFlag $flag, string $content): void
{
    // Mark all unresolved as answered (current behavior)
    $remainingFlags = $latest->ambiguityFlags()
        ->where('is_resolved', false)
        ->get();
    
    foreach ($remainingFlags as $idx => $otherFlag) {
        if ($otherFlag->id !== $flag->id) {
            // Different contextual answer based on other questions
            $contextualAnswer = $this->generateContextualAnswer($content, $otherFlag->question);
            
            $otherFlag->update([
                'is_resolved' => true,
                'resolution_answer' => $contextualAnswer,
            ]);
        } else {
            // Direct answer for current flag
            $flag->update([
                'is_resolved' => true,
                'resolution_answer' => $content,
            ]);
        }
    }
    
    // Generate comprehensive revision prompt with all context
    $revisionInstruction = $this->buildRevisionPrompt($remainingFlags, $content);
    $revised = $this->generator->reviseWithContext($latest->decodedContent(), $revisionInstruction);
}

/**
 * Infer logical answer for unrelated questions based on direct answer
 */
private function generateContextualAnswer(string $directAnswer, string $unrelatedQuestion): string
{
    // Example: if user says "untuk mahasiswa" about target users,
    // infer appropriate speed expectations
    
    $inferenceRules = [
        '/mahasiswa|pendidikan|akademik/i' => [
            'speed' => 'Cukup cepat (<3 detik)',
            'roles' => 'Ada admin & pengguna biasa',
        ],
        '/startup|bisnis|umkm/i' => [
            'speed' => 'Langsung muncul (<1 detik)',
            'security' => 'Sangat ketat (data sensitif)',
        ],
    ];
    
    $category = null;
    foreach ($inferenceRules as $pattern => $defaultAnswers) {
        if (preg_match($pattern, mb_strtolower($directAnswer))) {
            $category = key($pattern);
            break;
        }
    }
    
    if ($category && isset($defaultAnswers[$normalizedQuestion])) {
        return $defaultAnswers[$normalizedQuestion];
    }
    
    // Fallback: assume neutral/default option
    return 'Biasa saja dulu';
}
```

**Benefits:**
✅ Single round maintains efficiency  
✅ Smarter defaults based on user intent  
✅ No major UI changes needed  

**Drawbacks:**
❌ Inference may be incorrect  
❌ Still some ambiguity in resolution  

---

## ⚙️ Recommended Hybrid Solution

Combine benefits of both approaches:

### Phase 1: Intelligent Clustering

Ask related questions together, unrelated ones separately:

```php
// Group questions by topic similarity
$groups = $this->clusterRelatedQuestions($ambiguousFlags);

foreach ($groups as $group) {
    if (count($group) <= 1) {
        // Single questions: ask immediately
        $this->askSingleQuestion($project, $group[0]);
    } else {
        // Related questions: batch them
        $this->askBatchRelatedQuestions($project, $group);
    }
}

private function clusterRelatedQuestions(Collection $flags): array
{
    $clusters = [];
    $topics = ['speed', 'user_type', 'security', 'features'];
    
    foreach ($topics as $topic) {
        $matching = $flags->filter(fn($f) => str_contains(mb_strtolower($f->question), $topic));
        if ($matching->isNotEmpty()) {
            $clusters[] = $matching->values()->all();
        }
    }
    
    return array_filter($clusters);
}
```

### Phase 2: Improved Revision Prompting

Even with batch answering, provide better context:

```php
private function buildRevisionPrompt(array $allFlags, string $primaryAnswer): string
{
    $instructions = ["Based on user's response to the most recent question:\n`$primaryAnswer`\n"];
    
    foreach ($allFlags as $flag) {
        if ($flag->id !== $recentFlagId) {
            // Add inferred context
            $instructions[] = "For previous question '{$flag->question}', assuming: '[Default/Safe Answer]'";
        }
    }
    
    return implode("\n", $instructions);
}
```

---

## 🧪 Testing the Changes

### Test Case 1: Sequential Flow

```php
// Arrange
$version = PrdVersion::factory()->forProject($project)->create();
AmbiguityFlag::factory()->count(3)->for($version)->create(['is_resolved' => false]);

// Act
$response = $this->post("/api/projects/{$project->id}/messages", [
    'content' => 'Answer to first question',
]);

// Assert
$response->assertStatus(201);
$message = Message::lastCreated();
$this->assertEquals(1, $message->ambiguity_flags()->where('is_resolved', true)->count());
// Should still have 2 unresolved
```

### Test Case 2: Multi-Line Parsing

```php
$input = "1. For speed: Less than 1 second\n2. For users: Myself only\n3. For security: High priority";

$result = $this->parseMultiPartResponse($input);

$this->assertCount(3, $result);
$this->assertEquals("For speed: Less than 1 second", $result[0]);
$this->assertEquals("For users: Myself only", $result[1]);
$this->assertEquals("For security: High priority", $result[2]);
```

---

## ✅ Implementation Checklist

**If implementing Solution A (Sequential)**:
- [ ] Modify `detectAmbiguities()` to return max 1 question
- [ ] Update `handleAmbiguityAnswer()` to mark only single flag
- [ ] Add logic to show next question or move to contradictions
- [ ] Adjust MAX_CLARIFICATION_ROUNDS accordingly
- [ ] Update frontend to display single-question flow
- [ ] Test conversation flow thoroughly

**If implementing Solution B (Multi-line)**:
- [ ] Design UI form for multiple answer inputs
- [ ] Implement JavaScript parsing logic
- [ ] Update backend to handle parsed format
- [ ] Maintain backward compatibility
- [ ] Document new response format
- [ ] Test edge cases (missing answers, wrong format)

**If implementing Solution C (Smart inference)**:
- [ ] Create inference rule database
- [ ] Implement contextual answer generation
- [ ] Enhance revision prompt builder
- [ ] Test with various user scenarios
- [ ] Validate AI quality improvement

---

## 📊 Performance Impact Comparison

| Metric | Sequential | Multi-line | Smart Inference |
|--------|------------|------------|-----------------|
| Rounds Required | 3x more | 1x | 1x |
| User Effort | Lower per turn | Higher per turn | Medium |
| Answer Accuracy | ✅ High | ✅ Very High | ⚠️ Medium |
| Implementation Complexity | ✅ Low | ⚠️ Medium | ⚠️ High |
| AI Quality | ✅ Better | ✅ Best | ✅ Good |

---

## 📚 References

- [Conversation Design Principles](https://www.nngroup.com/articles/conversational-patterns/)
- [UX Patterns for Clarification Dialogues](https://uxdesign.cc/how-to-design-a-conversational-ui-f9b6e9d4f8c6)
- [Laravel Eloquent Relations](https://laravel.com/docs/12.x/eloquent-relationships)

---

**Decision Guidance**: Untuk production dengan user testing, implementasi **Solution A (Sequential)** paling aman dan memberikan UX terbaik meskipun butuh lebih banyak rounds. Jika performance concern tinggi, bisa mulai dengan **Solution C (Smart inference)** sebagai intermediate step.
