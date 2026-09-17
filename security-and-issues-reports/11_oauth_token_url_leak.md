# Perbaikan Masalah #11: OAuth Token URL Leak

> **Status**: 🟡 Medium Priority  
> **Kategori**: Keamanan (Security)  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Token OAuth/Sanctum dikirimkan melalui URL fragment (`#oauth_token=...`) saat callback dari social login provider (Google/GitHub). Fragment URL masih dapat bocor ke berbagai logging systems dan exposed di UI yang seharusnya lebih aman dengan HTTP-only cookie atau server-side session.

### Vulnerable Code (Line 20-25 in SocialAuthController.php)

```php
private function tokenRedirect(User $user): \Illuminate\Http\RedirectResponse
{
    $token = $user->createToken('spa')->plainTextToken;

    // ❌ TOKEN IN URL FRAGMENT!
    return redirect('/#oauth_token=' . urlencode($token));
}
```

### Frontend Reception (spa/app.js)

```javascript
// Capture token from URL fragment
function captureOAuthResult() {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthToken = hash.get('oauth_token');

    if (oauthToken) {
        state.token = oauthToken;
        localStorage.setItem(STORAGE_KEY, oauthToken); // Also stored in localStorage
    }
}
```

### Security Risks of URL Token Storage

| Risk Vector | Severity | Explanation |
|-------------|----------|-------------|
| Browser History | 🔴 High | Full URL with token saved in browser history forever |
| Server Logs | 🔴 Critical | Referer header may contain full URL including fragment |
| Network Sniffing | 🟠 Medium | If not HTTPS, fragment visible on network monitoring tools |
| Shoulder Surfing | 🟠 Medium | Anyone viewing screen can see token in address bar |
| Bookmark Sharing | 🟡 Low | User might accidentally bookmark URL with token |
| Third-party Analytics | 🔴 High | Tools like Google Analytics could log full URL including sensitive params |
| Referrer Policy Bypass | 🟡 Medium | When user visits other sites, referer header may leak URL |

---

## 🎯 Penjelasan Solusi

### Solution A: Use Server-Side Session with HTTP-Only Cookie (Recommended)

Instead of passing token through URL, use Laravel's built-in session mechanism.

#### Step 1: Modify SocialAuthController to Store Token in Session

```php
use Illuminate\Support\Facades\Cookie;

class SocialAuthController extends Controller
{
    /**
     * Generate token and store it in secure session instead of URL
     */
    private function authenticateUser(User $user): void
    {
        $token = $user->createToken('social-login')->plainTextToken;

        // Store token temporarily in session (for immediate use after OAuth callback)
        request()->session()->put('social_auth_token', [
            'token' => $token,
            'expires_at' => now()->addMinutes(5), // Short-lived for security
            'user_id' => $user->id,
        ]);

        // Redirect without token in URL
        redirect('/#/auth-complete');
    }
}
```

#### Step 2: Create Backend Endpoint to Exchange Temporary Session Token

```php
// routes/api.php

Route::middleware('guest')->group(function () {
    Route::post('/oauth/token/complete', [SocialAuthController::class, 'completeLogin'])
        ->name('oauth.token.complete');
});
```

```php
// app/Http/Controllers/SocialAuthController.php

public function completeLogin(Request $request)
{
    $authData = $request->session()->get('social_auth_token');

    if (!$authData || !$authData['token'] || $authData['expires_at']->isPast()) {
        abort(403, 'Invalid or expired authentication session');
    }

    // Verify token matches user ID
    $storedUserId = $authData['user_id'];
    $token = $authData['token'];

    try {
        $user = User::findOrFail($storedUserId);
        
        // Verify the Sanctum token is still valid for this user
        $sanctumToken = $user->tokens()->where('token', hash('sha256', $token))->first();
        
        if (!$sanctumToken) {
            abort(403, 'Token mismatch detected - possible security breach');
        }
        
        // Create fresh long-lived token for SPA
        $newToken = $user->createToken('web-session')->plainTextToken;
        
        // Set secure cookie instead of localStorage
        $response = response()->json([
            'token' => $newToken,
            'user' => $this->sanitizeUserInfo($user),
            'message' => 'Authentication successful',
        ], 200, [
            'Set-Cookie' => "sanctum_token={$newToken}; Path=/; Secure; HttpOnly; SameSite=Lax",
        ]);
        
        // Clean up temporary session data
        $request->session()->forget('social_auth_token');
        
        return $response;
        
    } finally {
        // Always clear temporary token from session
        $request->session()->forget('social_auth_token');
    }
}

private function sanitizeUserInfo(User $user): array
{
    return [
        'id' => $user->id,
        'name' => $user->name,
        'email' => $user->email,
        'role' => $user->role, // Only expose role if truly necessary
        'auth_provider' => $user->auth_provider ?? null,
    ];
}
```

#### Step 3: Update Frontend to Use Cookie-Based Authentication

```javascript
// spa/app.js

// Remove token parameter extraction
function captureOAuthResult() {
    // Don't parse from URL anymore!
    // Instead, backend will set cookie automatically
    window.location.hash = '';
}

// Login flow using cookie exchange
async function completeOAuthFlow() {
    try {
        const response = await fetch('/api/oauth/token/complete', {
            method: 'POST',
            credentials: 'include', // IMPORTANT: Send cookies!
        });
        
        if (!response.ok) {
            throw new Error('Authentication failed');
        }
        
        const data = await response.json();
        
        // Store token in memory only (not localStorage!)
        state.token = data.token;
        state.user = data.user;
        state.view = 'dashboard';
        
        render(document.querySelector('#app'));
        
    } catch (err) {
        showError('Authentication failed. Please try again.');
    }
}
```

#### Step 4: Configure CORS & CSRF Properly

```php
// config/cors.php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_origins' => ['https://your-app-domain.com'],
    'supports_credentials' => true, // Allow cookies
];
```

```php
// bootstrap/app.php
return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi(); // Required for Sanctum cookies
        
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);
    })
```

---

### Solution B: Keep Current Flow but Secure It (Short-term Fix)

If immediate changes needed, at least improve current implementation:

#### Enhanced Version with Better Security

**Backend:**

```php
private function tokenRedirect(User $user): \Illuminate\Http\RedirectResponse
{
    $token = $user->createToken('spa-temp-' . uniqid())->plainTextToken;

    // Encrypt token before embedding in URL
    $encryptedToken = encrypt($token);
    
    // Add expiration time (very short)
    $expiry = now()->addMinutes(2)->timestamp;
    
    // Build payload with multiple safety checks
    $payload = json_encode([
        'token' => $encryptedToken,
        'expires' => $expiry,
        'ip_hash' => md5(request()->ip()), // Bind to IP
        'user_agent' => md5(request()->userAgent()), // Bind to UA
    ]);
    
    // Base64 encode for URL safety
    $safePayload = base64_encode($payload);
    
    // Return redirect WITHOUT token directly in URL
    return redirect("/#oauth_data={$safePayload}&_e={$expiry}");
}
```

**Frontend (enhanced validation):**

```javascript
function captureOAuthResult() {
    const hash = window.location.hash;
    
    // Extract encrypted token
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const oauthData = params.get('oauth_data');
    const expiryParam = parseInt(params.get('_e') || '0');
    
    // Clear URL immediately to prevent leaks
    window.history.replaceState({}, '', window.location.pathname);
    
    if (!oauthData || expiryParam < Date.now() / 1000) {
        showError('Authentication link expired or invalid');
        state.view = 'auth';
        render(document.querySelector('#app'));
        return;
    }
    
    try {
        // Decrypt and verify token
        const decrypted = decrypt(atob(oauthData));
        const { token, expires, ip_hash, user_agent } = JSON.parse(decrypted);
        
        // Check expiration
        if (expires < Date.now() / 1000) {
            throw new Error('Token expired');
        }
        
        // Additional security: check if original IP/user-agent match
        // (requires storing in session temporarily)
        
        state.token = token;
        localStorage.setItem(STORAGE_KEY, token);
        
        // Clear sensitive params from URL completely
        history.pushState(null, null, '#');
        
    } catch (err) {
        console.error('OAuth token processing failed:', err);
        showError('Authentication error occurred');
        state.view = 'auth';
    }
    
    render(document.querySelector('#app'));
}
```

---

### Solution C: Implement OAuth State Parameter Standard

Following OAuth 2.0 best practices for additional security:

```php
// When initiating OAuth
public function redirectToGoogle()
{
    // Generate cryptographically random state parameter
    $state = Str::random(40);
    
    // Store state in session with timestamp
    session(['oauth_state' => [
        'value' => $state,
        'created_at' => now()->timestamp,
        'redirect_uri' => url()->current(),
    ]]);
    
    return Socialite::driver('google')
        ->with(['state' => $state])
        ->redirect();
}

// In callback handler
public function handleGoogleCallback()
{
    $requestState = request()->input('state');
    
    // Validate state parameter first!
    $validState = session('oauth_state.value');
    if (!$validState || !hash_equals($validState, $requestState)) {
        Log::warning('[OAuth] Invalid state parameter detected');
        return redirect('/?oauth_error=' . urlencode('Authentication integrity check failed'));
    }
    
    // Check state expiration (max 10 minutes)
    $createdAt = session('oauth_state.created_at');
    if ($createdAt && (now()->timestamp - $createdAt) > 600) {
        return redirect('/?oauth_error=' . urlencode('OAuth state expired'));
    }
    
    // Proceed with normal flow AFTER state validation
    try {
        $googleUser = Socialite::driver('google')->user();
        $email = $googleUser->getEmail();
        
        if (!$email) {
            return redirect('/?oauth_error=' . urlencode('Email not available'));
        }
        
        $user = $this->resolveUser('google', $googleUser, $email, $googleUser->getName());
        
        // Now implement Solution A (HTTP-Only cookie) instead of URL token
        $this->authenticateUserInSession($user);
        
        return redirect(route('oauth.complete', [], false));
        
    } catch (\Throwable $e) {
        Log::error('Google OAuth failed: ' . $e->getMessage());
        return redirect('/?oauth_error=' . urlencode('Authentication failed'));
    }
}

// New endpoint to finalize authenticated session
public function oauthComplete()
{
    return view('auth.oauth-success'); // Simple page that triggers cookie exchange
}
```

---

## ⚙️ Comprehensive Protection Strategy

Combine all solutions for maximum security:

### Layered Defense Approach

```php
/**
 * Multi-layer OAuth security implementation
 */
class SocialAuthSecurity
{
    public function handleCallback(User $user): Response
    {
        // Layer 1: State parameter validation (prevent CSRF attacks)
        $this->validateStateParameter();
        
        // Layer 2: Rate limiting per IP
        $throttleKey = 'oauth:' . request()->ip();
        if (Cache::hits($throttleKey) >= 3) {
            throw new TooManyRequestsException('Too many attempts');
        }
        
        // Layer 3: Generate short-lived auth code instead of token
        $authCode = Str::random(64);
        
        Cache::set("auth_code_{$authCode}", [
            'user_id' => $user->id,
            'provider' => 'google',
            'expires_at' => now()->addMinutes(5),
        ], 300); // 5 minutes TTL
        
        // Layer 4: Return URL with ONLY the code (NOT actual token!)
        return redirect(route('oauth.verify', ['code' => $authCode]));
    }
    
    public function verifyAndIssueToken(string $authCode, Request $request): JsonResponse
    {
        $cachedData = Cache::get("auth_code_{$authCode}");
        
        if (!$cachedData || $cachedData['expires_at']->isPast()) {
            Cache::delete("auth_code_{$authCode}");
            abort(403, 'Invalid or expired verification code');
        }
        
        // Layer 5: Validate additional context before issuing token
        $contextMatch = $this->verifyRequestContext($cachedData);
        if (!$contextMatch) {
            Cache::delete("auth_code_{$authCode}");
            Log::warning('[OAuth.ContextMismatch]', ['user_id' => $cachedData['user_id']]);
            abort(403, 'Context mismatch detected');
        }
        
        // All validations passed → Issue final token securely
        $user = User::findOrFail($cachedData['user_id']);
        $finalToken = $user->createToken('secure-web-session')->plainTextToken;
        
        // Clean up auth code
        Cache::delete("auth_code_{$authCode}");
        
        // Return via HTTP-Only cookie + Content-Type application/json
        return response()->json([
            'success' => true,
            'message' => 'Authentication completed successfully',
        ], 200, [
            'Set-Cookie' => "laravel_session={$finalToken}; 
                           Path=/; 
                           Secure; 
                           HttpOnly; 
                           SameSite=Lax; 
                           Max-Age=" . env('SESSION_LIFETIME', 86400),
        ]);
    }
    
    private function validateStateParameter(): void
    {
        $requestState = request()->input('state');
        $sessionState = session('oauth.state');
        
        if (!$sessionState || !hash_equals($sessionState, $requestState)) {
            throw new UnauthorizedHttpException('CSRF protection failed');
        }
        
        session()->foreget('oauth.state');
    }
    
    private function verifyRequestContext(array $cachedData): bool
    {
        // Check if device fingerprint matches
        $fingerprint = hash('sha256', 
            request()->ip() . request()->userAgent()
        );
        
        $storedFingerprint = $cachedData['device_fingerprint'] ?? null;
        
        // If no previous fingerprint, allow first-time setup
        if (!$storedFingerprint) {
            return true;
        }
        
        // For subsequent logins, strict matching required
        return hash_equals($storedFingerprint, $fingerprint);
    }
}
```

---

## 🧪 Testing Security Measures

### Security Test Suite

```php
public function testOAuthTokenNotExposedInUrl(): void
{
    $user = User::factory()->create();
    
    $response = $this->post('/oauth/google/callback', [
        'email' => $user->email,
        'provider_id' => 'google_123',
        'state' => 'valid_state_value',
    ]);
    
    // Should NOT redirect to URL with token
    $response->assertRedirect('/');
    $this->assertStringNotContainsString('token=', (string) $response->getTargetUrl());
    $this->assertStringNotContainsString($user->createToken('test')->plainTextToken, 
        (string) $response->getTargetUrl());
}

public function testOAuthStateParameterValidation(): void
{
    $this->withoutExceptionHandling();
    
    // Try without state parameter
    $response = $this->get('/oauth/google/callback');
    $response->assertRedirectToIntended('/?oauth_error');
    
    // Try with wrong state
    $response = $this->get('/oauth/google/callback?state=invalid');
    $response->assertRedirectToIntended('/?oauth_error');
}

public function testTokenNotStoredInHistory(): void
{
    Mockery::mock(\Symfony\Component\HttpFoundation\Request::class);
    
    $response = $this->post('/oauth/google/callback', [...]);
    
    // Should clear URL after token consumption
    $this->assertEquals('', (string) parse_url((string) $response->getTargetUrl(), PHP_URL_FRAGMENT));
}
```

---

## ✅ Production Deployment Checklist

- [ ] Implement HTTP-Only cookie for token storage
- [ ] Add OAuth state parameter validation
- [ ] Set proper CORS headers (Allow-Credentials: true)
- [ ] Enable CSRF protection for API endpoints
- [ ] Configure secure cookie attributes (Secure, HttpOnly, SameSite)
- [ ] Add rate limiting per IP on OAuth callbacks
- [ ] Implement token rotation/expiry logic
- [ ] Set up monitoring for failed authentication attempts
- [ ] Document OAuth security procedures
- [ ] Train team on security best practices

---

## 📊 Security Level Comparison

| Implementation | URL Exposure | Cookie Security | Overall Protection |
|---------------|--------------|-----------------|-------------------|
| Current (vulnerable) | 🔴 Full URL exposure | N/A | CRITICAL |
| With encryption | 🟡 Encrypted in URL | Medium | IMPROVED |
| State parameter | 🟢 No URL token | Medium | GOOD |
| HTTP-Only cookie | 🟢 No token in URL | HIGH | BEST |
| Full layered approach | 🟢 Zero exposure | MAXIMUM | PRODUCTION READY |

---

**Critical Priority**: Migrate away from URL-based token传递 IMMEDIATELY. Implement HTTP-Only cookies as primary solution. State parameters are mandatory for production OAuth flows.
