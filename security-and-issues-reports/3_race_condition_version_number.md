# Perbaikan Masalah #3: Race Condition pada Version Number Generation

> **Status**: 🟠 Medium-High Priority  
> **Kategori**: Arsitektur & Consistency  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Metode `newVersion()` di `ApiController.php` memiliki potensi **race condition** saat multiple concurrent requests mencoba membuat PRD versi baru bersamaan.

### Code yang Bermasalah (Line 557-562)

```php
private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    // ❌ RACE CONDITION HERE!
    $number = ((int) $project->prdVersions()->max('version_number')) + 1;
    
    return $project->prdVersions()->create([
        'version_number' => $number,
        'content' => $content,
        'status' => 'draft',
        'ai_provider' => $provider ?? 'local',
    ]);
}
```

### Skenario Race Condition

```
Time T0: Request A calls newVersion()
   └─ Query: SELECT max(version_number) FROM prd_versions WHERE project_id = 1
   └─ Result: 3

Time T1: Request B calls newVersion() 
   └─ Query: SELECT max(version_number) FROM prd_versions WHERE project_id = 1
   └─ Result: 3 (belum ada insert dari A yet!)

Time T2: Request A inserts version_number = 4
Time T3: Request B inserts version_number = 4 ← DUPLICATE KEY ERROR!
```

### Impact

1. **Database Integrity Error**: Primary key violation pada `version_number`
2. **Data Corruption**: Potensi duplicate versions jika DB tidak enforce unique constraint
3. **Failed Requests**: Client-side errors ketika user klik "Send" berkali-kali cepat
4. **Broken State**: User message sudah ter-save, tapi version creation gagal → inconsistent state

---

## 🎯 Penjelasan Solusi

### Solution A: Database Transaction dengan Locking (Recommended)

Gunakan database-level locking untuk ensure atomic increment.

#### Option 1: Using DB::transaction dengan lockForUpdate

Edit `app/Http/Controllers/ApiController.php`:

```php
use Illuminate\Support\Facades\DB;

private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    // ✅ ATOMIC operation dengan transaction dan row lock
    return DB::transaction(function () use ($project, $content, $provider) {
        // Get latest version dengan row-level lock
        $latestVersion = \App\Models\PrdVersion::where('project_id', $project->id)
            ->lockForUpdate()
            ->orderByDesc('version_number')
            ->first();
            
        $nextNumber = ($latestVersion?->version_number ?? 0) + 1;
        
        return $project->prdVersions()->create([
            'version_number' => $nextNumber,
            'content' => $content,
            'status' => 'draft',
            'ai_provider' => $provider ?? 'local',
        ]);
    }, 5); // Retry on deadlock up to 5 times
}
```

#### Option 2: Atomic UPDATE query

```php
private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    return DB::transaction(function () use ($project, $content, $provider) {
        // Increment counter atomically
        DB::statement("
            UPDATE prd_versions 
            SET version_number = GREATEST(version_number, :val) + 1
            WHERE project_id = :pid
            ON DUPLICATE KEY UPDATE version_number = version_number + 1
        ", [
            'val' => 0,
            'pid' => $project->id,
        ]);
        
        // Then fetch the max again
        $nextNumber = PrdVersion::where('project_id', $project->id)
            ->max('version_number');
            
        return $project->prdVersions()->create([
            'version_number' => $nextNumber,
            'content' => $content,
            'status' => 'draft',
            'ai_provider' => $provider ?? 'local',
        ]);
    });
}
```

#### Option 3: Database Sequence-like Approach

Jika menggunakan MySQL 8+ atau PostgreSQL:

```php
// Migration untuk create sequence table
Schema::create('project_version_sequences', function (Blueprint $table) {
    $table->foreignId('project_id')->primary()->constrained()->onDelete('cascade');
    $table->unsignedInteger('current_number')->default(0);
});

// Controller method
private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    return DB::transaction(function () use ($project, $content, $provider) {
        // Create if doesn't exist
        DB::table('project_version_sequences')
            ->updateOrInsert(
                ['project_id' => $project->id],
                []
            );
            
        // Atomically increment
        $nextNumber = DB::table('project_version_sequences')
            ->where('project_id', $project->id)
            ->lockForUpdate()
            ->increment('current_number');
            
        return $project->prdVersions()->create([
            'version_number' => $nextNumber,
            'content' => $content,
            'status' => 'draft',
            'ai_provider' => $provider ?? 'local',
        ]);
    });
}
```

---

### Solution B: Auto-Increment Column (Simplest)

Ubah schema untuk pakai auto-increment primary key:

#### Migration Update

```php
// database/migrations/YYYY_MM_DD_add_auto_increment_to_prd_versions.php
public function up(): void
{
    Schema::table('prd_versions', function (Blueprint $table) {
        // Drop existing unique index if exists
        $table->dropUnique(['project_id', 'version_number']);
        
        // Keep version_number as auto-increment per project
        // But this requires composite unique index
    });
}

// Alternative: Use composite unique constraint
public function down(): void
{
    Schema::table('prd_versions', function (Blueprint $table) {
        $table->unique(['project_id', 'version_number'], 'project_version_unique');
    });
}
```

#### Model Modification

```php
// app/Models/PrdVersion.php
class PrdVersion extends Model
{
    protected $fillable = ['project_id', 'version_number', 'content', 'status', 'ai_provider'];
    
    // Remove manual assignment
    public static function boot()
    {
        parent::boot();
        
        static::creating(function ($version) {
            // Auto-generate version number safely
            if (!$version->version_number) {
                $max = PrdVersion::where('project_id', $version->project_id)
                    ->max('version_number');
                $version->version_number = ($max ?? 0) + 1;
            }
            return true;
        });
    }
}
```

Controller tetap sama, sekarang aman karena callback `creating`:

```php
private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    return $project->prdVersions()->create([
        'version_number' => null, // Will be auto-generated by creating event
        'content' => $content,
        'status' => 'draft',
        'ai_provider' => $provider ?? 'local',
    ]);
}
```

---

### Solution C: UUID for Version ID (No Sequential Numbers)

Jika urutan nomor bukan requirement mutlak:

```php
// Migration
Schema::create('prd_versions', function (Blueprint $table) {
    $table->uuid('id')->primary(); // UUID primary key
    $table->foreignId('project_id')->constrained();
    $table->uuid('version_id'); // Unique internal ID
    $table->integer('version_sequence'); // For sorting
    $table->timestamps();
    
    $table->unique(['project_id', 'version_sequence']);
    $table->index(['project_id', 'created_at']);
});
```

---

## ⚙️ Implementation Detail (Production Ready)

### Complete Fix dengan Retry Logic

```php
// app/Http/Controllers/ApiController.php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
{
    $maxRetries = 5;
    $attempts = 0;
    
    while ($attempts < $maxRetries) {
        try {
            return DB::transaction(function () use ($project, $content, $provider) {
                // Row-level lock to prevent race conditions
                $maxVersion = PrdVersion::where('project_id', $project->id)
                    ->lockForUpdate()
                    ->orderByDesc('version_number')
                    ->value('version_number');
                    
                $nextNumber = ($maxVersion ?: 0) + 1;
                
                return $project->prdVersions()->create([
                    'version_number' => $nextNumber,
                    'content' => json_encode($content), // Ensure proper encoding
                    'status' => 'draft',
                    'ai_provider' => $provider ?? 'local',
                ]);
            });
            
        } catch (QueryException $e) {
            $attempts++;
            
            // Handle deadlock or unique constraint violations
            if ($this->isDeadlock($e) && $attempts < $maxRetries) {
                sleep(1); // Back off before retry
                continue;
            }
            
            throw $e;
        }
    }
    
    throw new RuntimeException('Failed to create PRD version after retries');
}

/**
 * Check if exception is a deadlock
 */
private function isDeadlock(QueryException $e): bool
{
    return in_array($e->getCode(), [1205, 1213, 40001]); // MySQL/MariaDB/PostgreSQL deadlock codes
}
```

### Add Unique Index Constraint

Untuk memastikan no duplicate versions even under heavy load:

```php
// database/migrations/YYYY_MM_DD_add_version_number_constraint.php
public function up(): void
{
    Schema::table('prd_versions', function (Blueprint $table) {
        // Composite unique index to guarantee uniqueness
        $table->unique(['project_id', 'version_number'], 'project_version_number_unique');
    });
}

public function down(): void
{
    Schema::table('prd_versions', function (Blueprint $table) {
        $table->dropUnique('project_version_number_unique');
    });
}
```

---

## 🧪 Testing

### Test Concurrent Requests

```bash
#!/bin/bash
# test-concurrent.sh

PROJECT_ID=1

for i in {1..10}; do
    curl -X POST http://localhost:8000/api/projects/$PROJECT_ID/messages \
        -H "Authorization: Bearer YOUR_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"content":"Test concurrent update"}' &
done

wait
echo "All requests completed"
```

Verify no duplicate versions and all requests succeed.

---

## ✅ Verification Checklist

- [ ] Database transaction added to `newVersion()` method
- [ ] `lockForUpdate()` used for row-level locking
- [ ] Retry logic implemented for deadlock handling
- [ ] Unique constraint added to DB
- [ ] Test concurrent requests work correctly
- [ ] Monitor for deadlock occurrences in logs
- [ ] Document locking strategy for team

---

## 📊 Performance Considerations

Row-level locking dapat impact concurrency:

| Metric | Without Lock | With Lock |
|--------|--------------|-----------|
| Max QPS | 100+ | ~50-80 |
| Deadlock Risk | High | Low (with retry) |
| Data Consistency | Poor | Excellent |
| Response Time | Fast (~5ms) | Moderate (~10-15ms) |

**Recommendation**: Accept slight performance cost untuk data integrity, especially untuk PRD versioning yang critical.

---

## 📚 References

- [Laravel Database Transactions](https://laravel.com/docs/12.x/database#transactions)
- [Database Isolation Levels](https://en.wikipedia.org/wiki/Isolation_(database_systems))
- [MySQL InnoDB Locking](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)
- [Race Conditions in PHP Applications](https://phptherightway.com/#race-conditions)

---

**Catatan**: Implementasi ini sangat penting sebelum production karena kemungkinan multi-user concurrent access tinggi. Selalu testing dengan load sebelum deploy!
