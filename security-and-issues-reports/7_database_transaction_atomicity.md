# Perbaikan Masalah #7: Database Transaction Atomicity

> **Status**: 🟠 Medium Priority  
> **Kategori**: Arsitektur & Data Consistency  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Process user message di `ApiController` melibatkan multiple database operations tanpa proteksi atomicity. Jika salah satu step gagal setelah step sebelumnya sudah commit, terjadi **inconsistent state** yang sulit di-recover.

### Current Implementation Flows

```php
private function processUserMessage(Project $project, string $content): void
{
    // Step 1: ✅ User message created
    $project->messages()->create(['sender' => 'user', 'content' => $content]);

    // Step 2: 🔴 AI call - may fail after user message saved
    if (! $latest) {
        $prd = $this->generator->generate($content);
        throw new \Exception('AI service unavailable'); // 💥 Fails here!
    }

    // Step 3: ❌ Never reached - PRD version not created
    $version = $this->newVersion($project, $prd, ...);

    // Step 4: ❌ Never reached - Ambiguity flags not created
    $this->refreshFlags($version);

    // State: Message exists but no AI response recorded → BROKEN THREAD!
}
```

### Inconsistent States yang Dapat Terjadi

| Scenario | Step Completed | Step Failed | Resulting State | Impact |
|----------|----------------|-------------|-----------------|--------|
| AI Error | Message created | Version created | User msg saved, no AI response | Broken conversation thread |
| Validation Fail | Message + Version created | Flags created | Half-processed PRD | Confusing UX for user |
| Network Timeout | Partial data written | Rollback required | Duplicate/repeat requests needed | Frustrated users |

---

## 🎯 Penjelasan Solusi

### Solution A: Wrap Entire Operation in Database Transaction

#### Implementation in ApiController.php

```php
use Illuminate\Support\Facades\DB;
use App\Models\AmbiguityFlag;
use App\Models\ContradictionFlag;

class ApiController extends Controller
{
    private const DB_TIMEOUT_SECONDS = 10;
    private const MAX_RETRY_ATTEMPTS = 3;

    /**
     * Process user message WITHIN TRANSACTIONAL BOUNDARIES
     */
    private function processUserMessage(Project $project, string $content): void
    {
        $attempt = 0;
        
        while ($attempt < self::MAX_RETRY_ATTEMPTS) {
            try {
                DB::transaction(function () use ($project, $content) {
                    // START ATOMIC TRANSACTION
                    
                    // Step 1: Create user message record
                    $userMessage = $project->messages()->create([
                        'sender' => 'user',
                        'content' => $content,
                    ]);

                    // Step 2: Determine context based on project state
                    $latest = $project->prdVersions()
                        ->lockForUpdate() // Prevent concurrent reads during processing
                        ->latest('version_number')
                        ->first();

                    // Execute appropriate handler within same transaction
                    $this->executeHandler($project, $latest, $content);

                    // If all steps complete successfully → COMMIT happens automatically
                    
                }, 5, 1); // Max 5 attempts on deadlock, timeout 5 seconds
                
                return; // Success
                
            } catch (\Illuminate\Database\QueryException $e) {
                $attempt++;
                
                if ($this->isDeadlock($e) && $attempt < self::MAX_RETRY_ATTEMPTS) {
                    sleep(min(2, $attempt)); // Exponential backoff
                    continue;
                }
                
                // Re-throw final failure
                throw $e;
            }
        }
    }

    private function executeHandler(Project $project, ?PrdVersion $latest, string $content): void
    {
        // Handle initial idea
        if (! $latest) {
            $this->handleInitialIdeaAtomic($project, $content);
            return;
        }

        // Handle ambiguity answer
        $pendingAmbiguity = $latest->ambiguityFlags()
            ->where('is_resolved', false)
            ->lockForUpdate()
            ->first();
            
        if ($pendingAmbiguity) {
            $this->handleAmbiguityAnswerAtomic($project, $latest, $pendingAmbiguity, $content);
            return;
        }

        // Handle contradiction resolution
        $pendingContradiction = $latest->contradictionFlags()
            ->whereNull('resolution')
            ->lockForUpdate()
            ->first();
            
        if ($pendingContradiction) {
            $this->handleContradictionAnswerAtomic($project, $latest, $pendingContradiction, $content);
            return;
        }

        // Handle free revision
        $this->handleFreeRevisionAtomic($project, $latest, $content);
    }

    /**
     * Atomic version of handleInitialIdea
     */
    private function handleInitialIdeaAtomic(Project $project, string $content): void
    {
        // Step 1: Generate PRD from AI (outside transaction if AI is slow, but within retry scope)
        $prd = $this->retryableAiCall(fn() => $this->generator->generate($content));

        // Step 2: Create version
        $version = $this->newVersion($project, $prd, $this->generator->provider());

        // Update title if auto-generated
        if ($project->title === 'Proyek Baru' || $project->title === '') {
            $project->update(['title' => $prd['title']]);
        }

        // Step 3: Refresh flags (atomic update)
        $this->refreshFlags($version);

        // Step 4: Create AI response message
        $questions = $version->ambiguityFlags()->where('is_resolved', false)->get();

        if ($questions->isNotEmpty()) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => $this->formatClarificationResponse($questions),
                'quick_replies' => $this->flattenOptions($questions),
                'related_prd_version_id' => $version->id,
            ]);
        } else {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Draft PRD v{$version->version_number} sudah saya susun dan tidak ada pertanyaan tambahan.",
                'quick_replies' => ['Lihat dokumen lengkap'],
                'related_prd_version_id' => $version->id,
            ]);
        }
    }

    /**
     * Retry logic for external AI calls
     */
    private function retryableAiCall(callable $aiOperation, int $maxRetries = 3)
    {
        $lastException = null;
        
        for ($i = 0; $i < $maxRetries; $i++) {
            try {
                return $aiOperation();
            } catch (\Exception $e) {
                $lastException = $e;
                
                if ($i < $maxRetries - 1) {
                    // Sleep before retry
                    sleep(pow(2, $i)); // Exponential backoff: 1s, 2s, 4s
                }
            }
        }
        
        // All retries failed - decide what to do
        throw $lastException ?? new \RuntimeException('AI operation failed after retries');
    }

    /**
     * Atomic ambiguity resolution
     */
    private function handleAmbiguityAnswerAtomic(Project $project, PrdVersion $latest, AmbiguityFlag $flag, string $content): void
    {
        // Update this specific flag
        $flag->update([
            'is_resolved' => true,
            'resolution_answer' => $content,
            'resolved_at' => now(),
        ]);

        // Mark ALL other unresolved flags as resolved too (batch behavior preserved)
        $latest->ambiguityFlags()
            ->where('is_resolved', false)
            ->where('id', '!=', $flag->id)
            ->update([
                'is_resolved' => true,
                'resolution_answer' => $content,
                'resolved_at' => now(),
            ]);

        // Generate revised PRD
        $revised = $this->generator->revise($latest->decodedContent(), $content, $flag->question);
        $version = $this->newVersion($project, $revised, $this->generator->provider());

        // Refresh flags atomically
        $this->refreshFlags($version);

        // Determine next step and create AI message
        $rounds = $this->clarificationRounds($project);
        $remaining = $version->ambiguityFlags()->where('is_resolved', false)->get();

        if ($remaining->isNotEmpty() && $rounds >= self::MAX_CLARIFICATION_ROUNDS) {
            // Resolve remaining ambiguities automatically
            $this->resolveRemainingAmbiguities($version);
            $remaining = collect();
        }

        // Check for contradictions
        $contradiction = $version->contradictionFlags()->whereNull('resolution')->first();

        if ($remaining->isNotEmpty()) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => $this->formatNextClarification($remaining, $version->version_number),
                'quick_replies' => $this->flattenOptions($remaining),
                'related_prd_version_id' => $version->id,
            ]);
        } elseif ($contradiction) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Oke, sudah cukup jelas. Lanjut ke validasi kontradiksi...",
                'quick_replies' => ['Pakai A', 'Pakai B', 'Saya revisi manual'],
                'related_prd_version_id' => $version->id,
            ]);
        } else {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Sudah cukup, makasih! PRD sudah konsisten dan siap difinalisasi.",
                'quick_replies' => ['Tampilkan dokumen lengkap'],
                'related_prd_version_id' => $version->id,
            ]);
        }
    }

    /**
     * Helper: Detect deadlock exceptions
     */
    private function isDeadlock(\Illuminate\Database\QueryException $e): bool
    {
        return in_array($e->getCode(), [1205, 1213, 40001, 12116]); // MySQL/MariaDB/PostgreSQL deadlock codes
    }

    /**
     * Helper: Format clarification responses
     */
    private function formatClarificationResponse(\Illuminate\Support\Collection $questions): string
    {
        $formatted = $questions->values()->map(function ($flag, $i) {
            $options = collect($flag->options ?? [])
                ->map(fn ($opt) => "• {$opt}")
                ->implode("\n   ");
            
            return ($i + 1) . '. ' . $flag->question . ($options !== '' ? "\n   {$options}" : '');
        })->implode("\n\n");

        return "Draft PRD sudah saya buat. Biar hasilnya pas, saya perlu klarifikasi:\n\n$formatted";
    }

    private function formatNextClarification(Collection $remaining, int $versionNumber): string
    {
        return "Terima kasih, sudah saya perbarui ke v{$versionNumber}. Sedikit lagi ya:\n\n" .
               $this->formatClarificationResponse($remaining);
    }

    private function flattenOptions(Collection $questions): array
    {
        return $questions
            ->flatMap(fn ($flag) => $flag->options ?? [])
            ->filter()
            ->unique()
            ->take(6)
            ->values()
            ->all();
    }
}
```

---

### Solution B: Event-Based Processing with Compensation

Alternative approach using Laravel events for better separation:

```php
// Event class
class UserMessageReceived implements ShouldQueue
{
    public function __construct(
        public int $projectId,
        public int $messageId,
        public string $content
    ) {}

    public function handle(): void
    {
        DB::transaction(function () {
            $message = Message::findOrFail($this->messageId);
            $project = $message->project;

            // Process entire flow
            $this->processProjectState($project, $message);
        });
    }

    private function processProjectState(Project $project, Message $message): void
    {
        // Same logic as above...
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('[MessageProcessing] Transaction failed', [
            'message_id' => $this->messageId,
            'exception' => $exception->getMessage(),
        ]);

        // Optionally trigger compensation/cleanup action
        $this->compensateFailedTransaction();
    }

    private function compensateFailedTransaction(): void
    {
        // Logic to clean up partial state if needed
        // Could mark message for retry or notify admin
    }
}
```

Use in controller:

```php
private function processUserMessage(Project $project, string $content): void
{
    $message = $project->messages()->create([
        'sender' => 'user',
        'content' => $content,
    ]);

    // Dispatch event that will run in separate worker
    UserMessageReceived::dispatch($project->id, $message->id, $content);
}
```

---

## ⚙️ Additional Safeguards

### Add Idempotency Keys

Prevent duplicate processing if UI sends multiple requests:

```php
// Add idempotency_key column to messages table
Schema::table('messages', function (Blueprint $table) {
    $table->string('idempotency_key')->nullable()->after('id');
    $table->unique(['project_id', 'idempotency_key']);
});

// Middleware or controller check
$requestedIdempotencyKey = request()->header('X-Idempotency-Key');

if ($requestedIdempotencyKey) {
    $existing = Message::where('idempotency_key', $requestedIdempotencyKey)
        ->where('project_id', $project->id)
        ->first();
    
    if ($existing) {
        return response()->json(['status' => 'already_processed', 'message_id' => $existing->id]);
    }
}

// Store it
$message = $project->messages()->create([
    'sender' => 'user',
    'content' => $content,
    'idempotency_key' => $requestedIdempotencyKey,
]);
```

### Implement Circuit Breaker Pattern

Protect against cascading failures when AI services are down:

```php
class CircuitBreaker
{
    protected static array $states = [];
    protected static int $failureThreshold = 5;
    protected static int $resetTimeout = 300; // 5 minutes

    public static function execute(callable $operation, string $serviceId): mixed
    {
        if (static::isCircuitOpen($serviceId)) {
            throw new RuntimeException("Service $serviceId is currently unavailable");
        }

        try {
            $result = $operation();
            static::recordSuccess($serviceId);
            return $result;
        } catch (\Throwable $e) {
            static::recordFailure($serviceId);
            throw $e;
        }
    }

    protected static function isCircuitOpen(string $serviceId): bool
    {
        if (!isset(static::$states[$serviceId])) {
            return false;
        }

        $state = static::$states[$serviceId];
        if ($state['failures'] >= static::$failureThreshold) {
            $timeSinceLastFailure = now()->timestamp - $state['lastFailureTimestamp'];
            if ($timeSinceLastFailure < static::$resetTimeout) {
                return true; // Circuit still open
            }
            // Reset circuit
            static::$states[$serviceId] = ['failures' => 0, 'lastFailureTimestamp' => 0];
            return false;
        }

        return false;
    }

    protected static function recordFailure(string $serviceId): void
    {
        static::$states[$serviceId] = [
            'failures' => (static::$states[$serviceId]['failures'] ?? 0) + 1,
            'lastFailureTimestamp' => now()->timestamp,
        ];
    }

    protected static function recordSuccess(string $serviceId): void
    {
        static::$states[$serviceId] = ['failures' => 0, 'lastFailureTimestamp' => 0];
    }
}
```

Usage:

```php
$prd = CircuitBreaker::execute(
    fn() => $this->generator->generate($content),
    'ai_generator'
);
```

---

## 🧪 Testing Strategy

### Integration Test Template

```php
public function testMessageProcessingCompletesAtomically(): void
{
    $project = Project::factory()->create();
    
    $response = $this->withHeader('Authorization', 'Bearer ' . $project->user->createToken('test')->plainTextToken)
        ->postJson("/api/projects/{$project->id}/messages", [
            'content' => 'Test atomicity',
        ]);
    
    $response->assertStatus(201);
    
    // Verify both message and version were created
    $this->assertDatabaseCount('messages', 1);
    $this->assertDatabaseCount('prd_versions', 1);
    
    // Verify relationship integrity
    $message = Message::first();
    $this->assertEquals($project->id, $message->project_id);
}

public function testMessageProcessingRollsBackOnAiFailure(): void
{
    Mock::instanceOf(AiGateway::class)->shouldThrow(new \Exception('AI unavailable'));
    
    $project = Project::factory()->create();
    
    $response = $this->postJson("/api/projects/{$project->id}/messages", [
        'content' => 'This should fail safely',
    ]);
    
    $response->assertStatus(500);
    
    // NO partial data created
    $this->assertDatabaseCount('messages', 0);
    $this->assertDatabaseCount('prd_versions', 0);
}
```

---

## ✅ Deployment Checklist

- [ ] Wrap all multi-step operations in transactions
- [ ] Add proper error handling and logging
- [ ] Implement retry logic with exponential backoff
- [ ] Set appropriate timeouts and lock durations
- [ ] Add monitoring for transaction failures
- [ ] Document expected failure modes and recovery procedures
- [ ] Run load tests under concurrent conditions

---

**Critical Note**: Transaction boundaries must encompass ALL write operations that depend on each other for consistency. Separate long-running external calls (like AI generation) into retryable units within transactional context.
