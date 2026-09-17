# Perbaikan Masalah #8: N+1 Query pada Versions Endpoint

> **Status**: 🟢 Low-Medium Priority  
> **Kategori**: Performance Optimization  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Endpoint `/api/projects/{project}/versions` melakukan N+1 query problem saat menghitung diff antara versi-versi PRD. Setiap kali user membuka halaman project, sistem melakukan comparison O(n²) yang sangat lambat untuk project dengan banyak revisi (50+).

### Problematic Code (Line 157-178 in ApiController.php)

```php
public function versions(Request $request, Project $project)
{
    // ✅ Fetch all versions - single query
    $versions = $project->prdVersions()->orderBy('version_number')->get();
    
    $result = [];
    
    foreach ($versions as $index => $version) {
        // ❌ EACH iteration calculates DIFF from scratch!
        $previous = $index > 0 ? $versions[$index - 1] : null;
        $result[] = [
            'id' => $version->id,
            'version_number' => $version->version_number,
            'status' => $version->status,
            'ai_provider' => $version->ai_provider,
            'created_at' => $version->created_at,
            'content' => $version->decodedContent(),
            'diff' => $previous 
                ? $this->diff->compare($previous->decodedContent(), $version->decodedContent()) 
                : [], // ❌ O(n) comparisons per version
        ];
    }

    return response()->json(['versions' => array_reverse($result)]);
}
```

### Complexity Analysis

| Scenario | Number of Versions | Diffs Calculated | Time Complexity | Expected Response Time |
|----------|-------------------|------------------|-----------------|----------------------|
| New Project | 1 | 0 | O(1) | < 5ms |
| Medium Usage | 10 | 9 | O(n²) ~ 90 ops | ~50-100ms |
| Heavy Usage | 50 | 49 | O(n²) ~ 2,450 ops | ~500-800ms ⚠️ |
| Extreme Case | 100 | 99 | O(n²) ~ 9,801 ops | ~2-3 seconds 🐌 |

### N+1 Problem Pattern

```
SELECT * FROM prd_versions WHERE project_id = X ORDER BY version_number  -- 1 query
├─ For version 1: compare content (n+1 queries total)
├─ For version 2: compare content again (n+2 queries)
├─ For version 3: compare AGAIN (same data) (n+3 queries)
└─ ... repeats for each version
```

Actually this is not classic N+1, but rather **quadratic re-computation** - same comparison done multiple times unnecessarily.

---

## 🎯 Penjelasan Solusi

### Solution A: Cache Diffs Client-Side + Server-Side Memoization

#### Server-Side: Store Precomputed Diffs

**Step 1: Add diffs storage table**

```php
// database/migrations/YYYY_MM_DD_create_version_diffs_table.php

Schema::create('version_diffs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('from_version_id')->constrained('prd_versions')->onDelete('cascade');
    $table->foreignId('to_version_id')->constrained('prd_versions')->onDelete('cascade');
    $table->json('diff_data'); // Store precomputed diff
    $table->string('algorithm_version')->default('v1'); // For algorithm updates
    $table->timestamps();
    
    $table->unique(['from_version_id', 'to_version_id']);
    $table->index(['from_version_id', 'to_version_id']);
});
```

**Step 2: Modify PrdDiff service to support caching**

```php
// app/Services/Ai/PrdDiff.php

class PrdDiff
{
    private const ALGORITHM_VERSION = 'v1';

    public function compareWithCache(array $before, array $after, int $fromVersionId, int $toVersionId): array
    {
        // Check cache first
        $cached = VersionDiff::where('from_version_id', $fromVersionId)
            ->where('to_version_id', $toVersionId)
            ->where('algorithm_version', self::ALGORITHM_VERSION)
            ->first();

        if ($cached) {
            Log::debug('[PrdDiff] Using cached diff', [
                'from' => $fromVersionId,
                'to' => $toVersionId,
            ]);
            
            return json_decode($cached->diff_data, true);
        }

        // Calculate new diff
        $diff = $this->compare($before, $after);

        // Store in cache
        VersionDiff::create([
            'from_version_id' => $fromVersionId,
            'to_version_id' => $toVersionId,
            'diff_data' => json_encode($diff),
            'algorithm_version' => self::ALGORITHM_VERSION,
        ]);

        return $diff;
    }

    /**
     * Invalidate all diffs for a specific version (when content changes)
     */
    public static function invalidateForVersion(int $versionId): void
    {
        VersionDiff::query()
            ->where('from_version_id', $versionId)
            ->orWhere('to_version_id', $versionId)
            ->delete();
    }

    // Keep original method for compatibility
    public function compare(array $before, array $after): array
    {
        // Original implementation...
    }
}
```

**Step 3: Update ApiController to use cached diffs**

```php
use App\Models\VersionDiff;
use App\Services\Ai\PrdDiff;

class ApiController extends Controller
{
    public function __construct(
        private readonly PrdGenerator $generator,
        private readonly PrdDiff $diff,
        private readonly ProjectFlow $flow,
    ) {}

    public function versions(Request $request, Project $project)
    {
        $versions = $project->prdVersions()
            ->withCount('messages')
            ->orderBy('version_number')
            ->get();

        $result = [];
        
        for ($index = 0; $index < count($versions); $index++) {
            $version = $versions[$index];
            $previous = $index > 0 ? $versions[$index - 1] : null;

            $result[] = [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'status' => $version->status,
                'ai_provider' => $version->ai_provider,
                'created_at' => $version->created_at,
                'content' => $version->decodedContent(),
                'diff' => $previous
                    ? $this->diff->compareWithCache(
                        $previous->decodedContent(),
                        $version->decodedContent(),
                        $previous->id,
                        $version->id
                    )
                    : [],
            ];
        }

        return response()->json(['versions' => array_reverse($result)]);
    }

    /**
     * Invalidate cache when new version created
     */
    private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
    {
        DB::transaction(function () use ($project, $content, $provider) {
            // Create version
            $number = ((int) $project->prdVersions()->max('version_number')) + 1;
            $version = $project->prdVersions()->create([
                'version_number' => $number,
                'content' => $content,
                'status' => 'draft',
                'ai_provider' => $provider ?? 'local',
            ]);

            // Invalidate any existing diffs involving this version
            PrdDiff::invalidateForVersion($version->id);

            // Clear old revisions if needed (optional based on business logic)
            // You might want to keep historical diffs
        });

        return $version;
    }
}
```

---

### Solution B: On-Demand Diff Loading (Lazy Loading Pattern)

Only compute and show diffs when user explicitly requests them:

```javascript
// Frontend modification (spa/app.js)

const renderVersionsList = async (versionsContainer, versions) => {
    return versions.map(async (version, index) => {
        const el = document.createElement('div');
        el.className = 'version-card';
        el.innerHTML = `
            <div class="version-header">
                <h4>Versio ${version.version_number}</h4>
                <button class="load-diff-btn" onclick="loadDiff(${version.id})">
                    Lihat Perubahan
                </button>
            </div>
            <div id="diff-${version.id}" class="diff-content hidden">
                Loading...
            </div>
        `;
        
        // Don't fetch diff initially - only when clicked
        return el;
    });
};

// Separate endpoint for on-demand diff fetching
async function loadDiff(versionId) {
    const diffEl = document.querySelector(`#diff-${versionId}`);
    diffEl.innerHTML = 'Loading...';
    
    try {
        const response = await api(`/projects/${projectId}/versions/${versionId}/diff`);
        diffEl.innerHTML = renderDiff(response.diff);
        diffEl.classList.remove('hidden');
    } catch (err) {
        diffEl.textContent = 'Gagal memuat perubahan';
    }
}
```

Backend:

```php
// routes/api.php

Route::get('/projects/{project}/versions/{version}/diff', [
    ApiController::class, 'getVersionDiff'
]);

public function getVersionDiff(Request $request, Project $project, PrdVersion $version)
{
    $this->authorizeProject($request, $project);

    $previous = $version->project->prdVersions()
        ->where('version_number', '<', $version->version_number)
        ->latest('version_number')
        ->first();

    if (!$previous) {
        return response()->json(['diff' => []], 200);
    }

    $diff = $this->diff->compare($previous->decodedContent(), $version->decodedContent());

    return response()->json(['diff' => $diff]);
}
```

---

### Solution C: Incremental Diff Algorithm Optimization

Instead of comparing complete contents, use smarter algorithms:

```php
class OptimizedPrdDiff extends PrdDiff
{
    public function compare(array $before, array $after): array
    {
        // Only compare fields that typically change
        $fieldsToCheck = ['functional_requirements', 'objectives'];
        
        $sections = [];
        
        foreach ($fieldsToCheck as $field) {
            $oldValue = $before[$field] ?? null;
            $newValue = $after[$field] ?? null;
            
            if (is_array($oldValue) && is_array($newValue)) {
                // Fast array comparison using hash
                $oldHash = md5(json_encode($oldValue));
                $newHash = md5(json_encode($newValue));
                
                if ($oldHash !== $newHash) {
                    $sections[] = $this->computeFieldDiff($field, $oldValue, $newValue);
                }
            } else if ($oldValue !== $newValue) {
                $sections[] = [
                    'field' => $field,
                    'label' => $this->label($field),
                    'type' => 'changed',
                    'before' => $oldValue,
                    'after' => $newValue,
                    'added' => [],
                    'removed' => [],
                    'changed' => true,
                ];
            }
        }
        
        return $sections;
    }

    private function computeFieldDiff(string $field, array $old, array $new): array
    {
        $added = array_values(array_diff($new, $old));
        $removed = array_values(array_diff($old, $new));
        
        return [
            'field' => $field,
            'label' => ucwords(str_replace('_', ' ', $field)),
            'type' => $added && !$removed ? 'added' : (!$added && $removed ? 'removed' : 'changed'),
            'before' => $old,
            'after' => $new,
            'added' => $added,
            'removed' => $removed,
            'changed' => true,
        ];
    }
}
```

---

### Solution D: Batch Diff Computation with Job Queue

Offload heavy computation to background jobs:

```php
// app/Jobs/ComputeVersionDiff.php

class ComputeVersionDiff implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function __construct(
        public int $fromVersionId,
        public int $toVersionId,
    ) {}

    public function handle(): void
    {
        $fromVersion = PrdVersion::findOrFail($this->fromVersionId);
        $toVersion = PrdVersion::findOrFail($this->toVersionId);

        $diff = app(PrdDiff::class)->compare(
            $fromVersion->decodedContent(),
            $toVersion->decodedContent()
        );

        VersionDiff::create([
            'from_version_id' => $this->fromVersionId,
            'to_version_id' => $this->toVersionId,
            'diff_data' => json_encode($diff),
        ]);

        Log::info('[VersionDiff] Computed diff successfully', [
            'from' => $this->fromVersionId,
            'to' => $this->toVersionId,
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('[VersionDiff] Failed to compute', [
            'from' => $this->fromVersionId,
            'to' => $this->toVersionId,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

Usage in API controller:

```php
private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    $version = $project->prdVersions()->create([...]);

    // If there's a previous version, queue diff computation
    $previous = $project->prdVersions()
        ->where('version_number', '<', $version->version_number)
        ->latest('version_number')
        ->first();

    if ($previous) {
        ComputeVersionDiff::dispatch($previous->id, $version->id);
    }

    return $version;
}
```

Frontend shows cached/placeholder diff until job completes.

---

## ⚙️ Complete Production Solution (Hybrid Approach)

Combine multiple strategies for best performance:

```php
class ApiControllerOptimized
{
    private const CACHE_TTL_MINUTES = 60;
    private const MAX_CACHED_VERSIONS = 20;

    public function versions(Request $request, Project $project)
    {
        $cacheKey = "project_{$project->id}_versions";
        
        // Try Redis cache first
        $cached = Cache::remember($cacheKey, self::CACHE_TTL_MINUTES, function () use ($project) {
            return $this->loadVersionsFromDb($project);
        });

        return response()->json(['versions' => $cached]);
    }

    private function loadVersionsFromDb(Project $project): array
    {
        $versions = $project->prdVersions()
            ->with(['ambiguityFlags', 'contradictionFlags'])
            ->orderBy('version_number')
            ->get();

        $result = [];
        
        // Only compute last 5 diffs on demand
        $computeAllDiffs = false;
        
        for ($index = 0; $index < count($versions); $index++) {
            $version = $versions[$index];
            $previous = $index > 0 ? $versions[$index - 1] : null;

            $versionData = [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'status' => $version->status,
                'created_at' => $version->created_at,
                'ai_provider' => $version->ai_provider,
                'content' => $version->decodedContent(),
                'has_changes' => false,
            ];

            // Only compute diff if requested OR if it's recent version
            if ($computeAllDiffs || $index >= count($versions) - 5) {
                $versionData['diff'] = $previous 
                    ? $this->loadOrComputeDiff($previous, $version)
                    : [];
                
                $versionData['has_changes'] = !empty($versionData['diff']);
            } else {
                $versionData['diff'] = null; // Placeholder
            }

            $result[] = $versionData;
        }

        return array_reverse($result);
    }

    private function loadOrComputeDiff(PrdVersion $from, PrdVersion $to): array
    {
        // First check cache
        $cached = VersionDiff::where('from_version_id', $from->id)
            ->where('to_version_id', $to->id)
            ->withTimestamps()
            ->first();

        if ($cached && $cached->freshTimestamp()->addMinutes(self::CACHE_TTL_MINUTES)->isFuture()) {
            return json_decode($cached->diff_data, true);
        }

        // Compute and store
        $diff = app(PrdDiff::class)->compare($from->decodedContent(), $to->decodedContent());
        
        VersionDiff::updateOrCreate(
            ['from_version_id' => $from->id, 'to_version_id' => $to->id],
            ['diff_data' => json_encode($diff)]
        );

        return $diff;
    }
}
```

---

## 🧪 Performance Testing

### Benchmark Test Setup

```bash
#!/bin/bash
# benchmark_versions.sh

PROJECT_ID=1
TOKEN="your_test_token"

# Load page 10 times, measure time
for i in {1..10}; do
    time curl -s -H "Authorization: Bearer $TOKEN" \
        "http://localhost:8000/api/projects/$PROJECT_ID/versions" | wc -c
done
```

### Expected Improvements

| Implementation | Avg Response Time | 99th Percentile | Memory Usage |
|----------------|-------------------|-----------------|--------------|
| Before (N+1) | 850ms | 2.1s | High |
| With Cache | 45ms | 120ms | Medium |
| On-Demand | 15ms (initial) + 50ms (on click) | 100ms | Low |
| Hybrid + Caching | 20ms | 80ms | Lowest |

---

## ✅ Deployment Checklist

- [ ] Create `version_diffs` migration
- [ ] Implement caching layer (Redis preferred)
- [ ] Add cache invalidation logic
- [ ] Monitor memory usage with many versions
- [ ] Set up background job workers for diff computation
- [ ] Add frontend lazy-loading for diffs
- [ ] Configure appropriate cache TTL values
- [ ] Test with projects having 100+ versions
- [ ] Document performance characteristics

---

## 📊 Monitoring & Alerting

Add performance metrics tracking:

```php
// In PrdDiff service
public function compare(array $before, array $after): array
{
    $startTime = microtime(true);
    
    $result = $this->doCompare($before, $after);
    
    $duration = microtime(true) - $startTime;
    
    if ($duration > 0.1) { // More than 100ms
        Log::warning('[PrdDiff.Slow]', [
            'duration_ms' => round($duration * 1000, 2),
            'before_size' => strlen(json_encode($before)),
            'after_size' => strlen(json_encode($after)),
        ]);
    }
    
    return $result;
}
```

Set alert threshold at 500ms average response time.

---

**Recommendation**: Start with **Solution A (Caching)** as it provides immediate 90%+ improvement with minimal complexity. Then add **lazy loading** for even better UX on large version histories.
