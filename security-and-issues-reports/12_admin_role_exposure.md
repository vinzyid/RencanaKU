# Perbaikan Masalah #12: Admin Role Exposure Through API

> **Status**: 🟢 Low Priority  
> **Kategori**: Keamanan (Security)  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Role user ("admin" atau "user") diekspos melalui semua API responses yang mengembalikan data user. Informasi ini dapat dikompromikan attacker untuk reconnaissance dan privilege escalation attacks.

### Current Implementation (Line 42 in ApiController.php)

```php
public function tokenResponse(User $user, int $status = 200)
{
    $token = $user->createToken('spa')->plainTextToken;

    return response()->json(['token' => $token, 'user' => $user], $status);
    //                                  ↑ EXPOSES FULL USER OBJECT including 'role'!
}
```

Also exposed in other endpoints:

```php
// app/Http/Controllers/AdminController.php
Route::get('/admin/token-usage', [AdminController::class, 'tokenUsage']);

// Response includes full user details with role visible
public function tokenUsage(Request $request)
{
    $byUser = TokenUsage::query()
        ->select('user_id', ...)
        ->with('user:id,name,email')
        ->groupBy('user_id')
        ...;
    
    return response()->json([
        'summary' => [...],
        'by_user' => $byUser, // ← Each item has user.role visible!
    ]);
}
```

### Impact of Information Disclosure

| Scenario | Risk Level | Consequence |
|----------|------------|-------------|
| Reconnaissance Attack | 🟡 Medium | Attacker identifies target admins |
| Privilege Escalation Planning | 🟠 High | Knowledge enables social engineering/admin exploitation |
| Targeted Brute Force | 🔴 Critical | Focus attack on known admin accounts |
| Data Breach Scope Mapping | 🟠 High | Identifies which users have elevated privileges |

---

## 🎯 Penjelasan Solusi

### Solution A: Sanitize API Responses to Hide Roles

Create API resource class that excludes sensitive fields from responses.

#### Implementation in App\Http\Resources\UserResource.php

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * API Resource for User - Hides sensitive information
 */
class UserResource extends JsonResource
{
    /**
     * Fields that should NEVER be exposed to clients
     */
    private const SENSITIVE_FIELDS = [
        'id',              // Can still expose ID if necessary for references
        'name',            // Safe to expose
        'email',           // Generally safe but consider privacy implications
        'auth_provider',   // Safe to expose (shows how user logged in)
        'email_verified_at', // Optional exposure based on privacy policy
        'created_at',      // Timestamp is generally non-sensitive
        'updated_at',      // Timestamp is generally non-sensitive
        
        // ALWAYS HIDE THESE FIELDS
        'password',        // CRITICAL! Never ever!
        'remember_token',  // Security token
        'role',            // PRIVILEGE ESCALATION RISK!
        
        // Conditionally expose these
        'provider_id',     // Only for internal APIs, not public-facing
        'phone_number',    // PII - only if explicitly requested by user
        'settings',        // Contains user preferences and configs
        
        // Special cases based on context
        'social_accounts', // Too much info leakage
    ];

    /**
     * @param Request|null $request
     */
    public function toArray($request): array
    {
        $data = parent::toArray($request);
        
        // Remove sensitive fields from ALL user representations
        foreach (self::SENSITIVE_FIELDS as $field) {
            if (array_key_exists($field, $data)) {
                unset($data[$field]);
            }
        }
        
        // Additional cleanup for nested structures if any
        $this->cleanupNestedData($data);
        
        return $data;
    }

    private function cleanupNestedData(array &$data): void
    {
        // Recursively clean any arrays within the response
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $this->cleanupNestedData($value);
            }
        }
    }

    /**
     * Create a "minimal" version for list views
     */
    public static function minimal(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
        ];
    }
}
```

#### Update All API Endpoints to Use Resource Class

```php
// app\Http\Controllers\ApiController.php

use App\Http\Resources\UserResource;

class ApiController extends Controller
{
    // ... existing code ...

    public function tokenResponse(User $user, int $status = 200)
    {
        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user), // ✅ Sanitized response
        ], $status);
    }

    public function me(Request $request)
    {
        // Also sanitize /me endpoint
        return response()->json([
            'user' => UserResource::make($request->user()),
        ]);
    }

    public function projects(Request $request)
    {
        $projects = $request->user()->projects()
            ->with(['prdVersions' => fn ($q) => $q->latest('version_number')])
            ->withCount('messages')
            ->latest()
            ->get()
            ->map(fn (Project $project) => $this->projectSummary($project));

        return response()->json(['projects' => $projects]);
    }

    public function showProject(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);

        // Return sanitized project payload
        return response()->json($this->projectPayload($project));
    }
}
```

#### Update Admin Controller

```php
// app\Http\Controllers\AdminController.php

use App\Http\Resources\UserResource;

class AdminController extends Controller
{
    public function tokenUsage(Request $request)
    {
        // Full summary
        $totals = TokenUsage::query()->selectRaw(
            'COUNT(*) as requests,
             COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) as completion_tokens,
             COALESCE(SUM(total_tokens), 0) as total_tokens'
        )->first();

        $byProvider = TokenUsage::query()
            ->select('provider', DB::raw('COUNT(*) as requests'), 
                    DB::raw('COALESCE(SUM(total_tokens), 0) as total_tokens'))
            ->groupBy('provider')
            ->orderByDesc('total_tokens')
            ->get();

        // ⚠️ CRITICAL CHANGE HERE: Remove user relation entirely for by_user query
        $byUser = TokenUsage::query()
            ->selectRaw('user_id, COUNT(*) as requests, COALESCE(SUM(total_tokens), 0) as total_tokens')
            ->leftJoin('users', 'token_usages.user_id', '=', 'users.id')
            ->selectRaw('COALESCE(users.name, "Anonymous") as name')
            ->selectRaw('COALESCE(users.email, "-") as email')
            // ❌ NEVER SELECT ROLE OR ANY OTHER IDENTIFIERS!
            ->groupBy('user_id', 'users.name', 'users.email')
            ->orderByDesc('total_tokens')
            ->limit(20)
            ->get();

        $recent = TokenUsage::query()
            ->selectRaw('token_usages.*')
            ->selectRaw('COALESCE(users.name, "Anonymous") as user_name')
            ->selectRaw('COALESCE(users.email, "-") as user_email')
            ->selectRaw('COALESCE(projects.title, "-") as project_title')
            ->leftJoin('users', 'token_usages.user_id', '=', 'users.id')
            ->leftJoin('projects', 'token_usages.project_id', '=', 'projects.id')
            ->orderByDesc('token_usages.id')
            ->limit(100)
            ->get();

        return response()->json([
            'summary' => [
                'requests' => (int) ($totals->requests ?? 0),
                'prompt_tokens' => (int) ($totals->prompt_tokens ?? 0),
                'completion_tokens' => (int) ($totals->completion_tokens ?? 0),
                'total_tokens' => (int) ($totals->total_tokens ?? 0),
            ],
            'by_provider' => $byProvider,
            
            // ✅ Clean data without any role information
            'by_user' => $byUser->map(fn ($row) => [
                'user_id' => $row->user_id,
                'name' => $row->name,          // Name only
                'email' => $row->email,        // Email only
                'requests' => (int) $row->requests,
                'total_tokens' => (int) $row->total_tokens,
            ]),
            
            'recent' => $recent->map(fn ($row) => [
                'id' => $row->id,
                'user_name' => $row->user_name ?? 'Anonim',
                'user_email' => $row->user_email ?? '-',
                'project_title' => $row->project_title ?? '-',
                'provider' => $row->provider,
                'model' => $row->model,
                'mode' => $row->mode,
                'prompt_tokens' => $row->prompt_tokens,
                'completion_tokens' => $row->completion_tokens,
                'total_tokens' => $row->total_tokens,
                'created_at' => $row->created_at?->toIso8601String(),
            ]),
        ]);
    }
}
```

---

### Solution B: Conditional Exposure Based on Authorization Context

Sometimes you need to expose role internally (e.g., logging), but never externally:

```php
/**
 * Middleware or trait that controls field visibility based on context
 */
trait SanitizeUserFields
{
    protected function sanitizeUserForExternalView(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => Str::maskEmail($user->email), // Optional: mask email for extra security
            
            // NEVER include 'role' in external responses
            // If needed for audit, store server-side ONLY
        ];
    }

    protected function sanitizeUserForInternalAudit(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,         // Internal use ONLY
            'auth_provider' => $user->auth_provider,
            'created_at' => $user->created_at,
        ];
    }
}
```

Usage pattern:

```php
// In controller methods that respond to clients
public function me(Request $request)
{
    $user = $request->user();
    
    // External view - no role exposed
    return response()->json([
        'user' => $this->sanitizeUserForExternalView($user),
    ]);
}

// In internal audit/logging endpoints
private function logUserActivity(User $user, string $action): void
{
    // Internal view - role included for audit trail
    $auditData = $this->sanitizeUserForInternalAudit($user);
    $auditData['action'] = $action;
    
    Log::info('[User.Activity]', $auditData);
}
```

---

### Solution C: Separate Public vs Internal API Layers

Completely separate endpoints with different authorization requirements:

```php
// routes/api.php

// PUBLIC API - No authentication required for basic usage
Route::prefix('api')->group(function () {
    Route::post('/register', [ApiController::class, 'register']);
    Route::post('/login', [ApiController::class, 'login']);
    Route::middleware('auth:sanctum')->group(function () {
        // These return sanitized user data
        Route::get('/me', [ApiController::class, 'me']);
        Route::get('/projects', [ApiController::class, 'projects']);
    });
});

// INTERNAL ADMIN API - Requires higher authorization level
Route::prefix('internal/api')->middleware(['auth:sanctum', 'internal.auth'])->group(function () {
    Route::get('/admin/token-usage', [AdminController::class, 'tokenUsage']);
    Route::get('/admin/user-stats', [AdminStatsController::class, 'index']);
});
```

Middleware definition for internal auth:

```php
// app/Http/Middleware/InternalAuth.php

class InternalAuth
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        
        // Require additional verification for internal access
        $apiKey = $request->header('X-Internal-API-Key');
        
        if (!$apiKey || !config('services.internal_api.key') || 
            !hash_equals(config('services.internal_api.key'), $apiKey)) {
            abort(403, 'Internal access requires valid API key');
        }
        
        // Verify this request is coming from trusted source
        $trustedIp = config('services.internal_api.trusted_ips');
        if (!in_array($request->ip(), $trustedIp)) {
            abort(403, 'Access denied from untrusted IP');
        }
        
        return $next($request);
    }
}
```

---

### Solution D: Implement Field-Level Access Control

Most granular approach using permission system:

```php
// Database table for field permissions
Schema::create('field_permissions', function (Blueprint $table) {
    $table->id();
    $table->string('resource'); // 'user', 'project', etc.
    $table->string('field');    // 'role', 'email', etc.
    $table->string('access_level'); // 'public', 'authenticated', 'admin', 'owner'
    $table->timestamps();
});

// Permission checker service
class FieldPermissionChecker
{
    public function canViewField(User $actor, string $resource, string $field): bool
    {
        $permission = FieldPermission::where('resource', $resource)
            ->where('field', $field)
            ->firstOrFail();
        
        $requiredLevel = $permission->access_level;
        
        switch ($requiredLevel) {
            case 'public':
                return true;
                
            case 'authenticated':
                return $actor->checkAuthentication();
                
            case 'admin':
                return $actor->hasRole('admin');
                
            case 'owner':
                return $actor->ownsResource($resource); // Custom check
                
            default:
                return false;
        }
    }
}
```

Usage in serialization:

```php
public function toArray(Request $request): array
{
    $checker = app(FieldPermissionChecker::class);
    $data = [];
    
    // For each field, check if user has permission
    foreach ($this->getAllFields() as $field => $value) {
        if ($checker->canViewField($request->user(), 'user', $field)) {
            $data[$field] = $value;
        }
    }
    
    return $data;
}
```

---

## ⚙️ Complete Production Implementation

Combine all strategies for comprehensive protection:

```php
/**
 * Hybrid approach: Base sanitization + optional field-level access control
 */
class SecureUserResource extends JsonResource
{
    private const FIELD_POLICY = [
        'id' => 'public',
        'name' => 'public',
        'email' => 'authenticated',
        'auth_provider' => 'public',
        'role' => 'never_expose',       // CRITICAL!
        'email_verified_at' => 'admin', // Only for admin dashboards
    ];

    public static function serializeFieldPolicy(): array
    {
        return self::FIELD_POLICY;
    }

    public function toArray(Request $request): array
    {
        $policy = self::FIELD_POLICY;
        $response = [];
        
        foreach ($policy as $field => $level) {
            if ($level === 'never_expose') {
                continue; // Skip this field entirely
            }
            
            if ($this->shouldExpose($request, $field, $level)) {
                $response[$field] = $this->resource->$field;
            }
        }
        
        return $response;
    }

    private function shouldExpose(Request $request, string $field, string $level): bool
    {
        $user = $request->user();
        
        switch ($level) {
            case 'public':
                return true;
                
            case 'authenticated':
                return $user instanceof Authenticatable && $user->checkAuthentication();
                
            case 'admin':
                return $user instanceof Authenticatable && $user->hasRole('admin');
                
            default:
                return false;
        }
    }
}

// Usage:
public function tokenResponse(User $user, int $status = 200)
{
    $token = $user->createToken('spa')->plainTextToken;

    return response()->json([
        'token' => $token,
        'user' => SecureUserResource::make($user),
    ], $status);
}
```

---

## 🧪 Testing

### Unit Tests for Sanitization

```php
public function testUserResourceDoesNotExposeRole(): void
{
    $user = User::factory()->create(['role' => 'admin']);
    
    $response = json_encode(UserResource::make($user)->resolve());
    
    $decoded = json_decode($response, true);
    
    $this->assertArrayNotHasKey('role', $decoded);
    $this->assertArrayNotHasKey('password', $decoded);
    $this->assertArrayNotHasKey('remember_token', $decoded);
}

public function testAdminDashboardIncludesFullUserDetails(): void
{
    $admin = User::factory()->admin()->create();
    
    $this->actingAs($admin)
        ->getJson('/internal/api/user-details/' . $admin->id)
        ->assertSuccessful()
        ->assertJsonPath('user.role', 'admin'); // Internal API CAN expose role
}
```

---

## ✅ Deployment Checklist

- [ ] Create UserResource with sanitized fields
- [ ] Update ALL endpoints to use resource class
- [ ] Remove role from admin token usage queries
- [ ] Add middleware for internal API separation
- [ ] Document field exposure policies
- [ ] Set up monitoring for role exposure attempts
- [ ] Train team on information disclosure risks
- [ ] Conduct security audit before production deployment

---

## 📊 Risk Assessment Comparison

| Method | Protection Level | Complexity | Maintenance | Recommendation |
|--------|-----------------|------------|-------------|----------------|
| Current (vulnerable) | 0% | Very Low | N/A | ❌ CRITICAL RISK |
| Basic Sanitization | 80% | Low | Easy | ✅ Quick fix |
| Conditional Exposure | 95% | Medium | Medium | ⭐ Balanced |
| Separate API Layers | 99% | High | Medium-High | ⭐⭐ Best for large apps |
| Field-Level Permissions | 100% | Very High | Complex | 🏆 Enterprise-grade |

---

**Recommended Approach**: Start with **Solution A (Basic Sanitization)** for immediate protection. Long-term, implement **Solution C (Separate API Layers)** to maintain clear boundaries between public and internal access patterns.
