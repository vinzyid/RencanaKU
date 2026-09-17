# Perbaikan Masalah #1: Tidak Ada Rate Limiting pada API

> **Status**: 🔴 High Priority  
> **Kategori**: Keamanan (Security)  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Endpoint API di aplikasi RencanaKU **tidak memiliki proteksi rate limiting**, sehingga user dapat melakukan:

- Brute force password pada endpoint `/api/login`
- Spam AI calls pada endpoint `/api/projects/{project}/messages`
- DDOS atau eksploitasi untuk menghabiskan token cost API

### Impact

1. **Brute Force Attacks**: Password guessing tanpa batasan → akun user compromised
2. **Token Cost Explosion**: User/spammer bisa drain budget dengan request berulang ke AI
3. **Resource Exhaustion**: Server overload dari request spam
4. **Admin Token Usage Tracking Ineffective**: Fitur monitoring admin jadi tidak berguna karena abuse tidak terkontrol

---

## 🎯 Penjelasan Solusi

### Implementasi Laravel Rate Limiting

Laravel menyediakan middleware `ThrottleRequests` yang dapat dikonfigurasi per-endpoint.

#### Langkah 1: Tambahkan Middleware ke Routes

Edit `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->api(prepend: [
        \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        \Illuminate\Routing\Middleware\ThrottleRequests::class.':api',
    ]);

    $middleware->route('api', [
        \Illuminate\Routing\Middleware\ThrottleRequests::class.':api',
    ]);

    $middleware->alias([
        'admin' => EnsureUserIsAdmin::class,
    ]);
})
```

#### Langkah 2: Konfigurasi Rate Limiting Rules

Tambahkan di `config/services.php` atau buat config custom:

```php
// Di dalam Application Configuration
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Standard rate limiters
        $middleware->throttle(api: [
            'login' => '5,1',           // 5 attempts per minute on login
            'register' => '5,1',        // 5 registration attempts per minute
            'logout' => '10,1',         // 10 requests per minute
            'me' => '60,1',             // 60 requests per minute
            'projects' => '100,1',      // 100 requests per minute
            'messages' => '30,1',       // 30 messages per minute (per project)
            'versions' => '60,1',       // 60 version fetches per minute
            'finalize' => '10,1',       // 10 finalizations per minute
            'export' => '20,1',         // 20 exports per minute
            'admin/token-usage' => '100,1', // Admin dashboard refreshable
        ]);
        
        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);
    })
```

#### Langkah 3: Configure Rate Limiter in AppServiceProvider

Edit `app/Providers/AppServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Login protection - strict
        RateLimiter::for('login', function ($request) {
            return RateLimiter::by($request->input('email'))
                ->frequency(5)
                ->period(60);
        });

        // General API protection
        RateLimiter::for('api', function ($request) {
            return RateLimiter::by($request->user()?->id ?? $request->ip())
                ->frequency(100)
                ->period(60);
        });

        // AI message processing - more lenient but still protected
        RateLimiter::for('ai-messages', function ($request) {
            return RateLimiter::by($request->user()?->id)
                ->frequency(30)
                ->period(60);
        });
    }
}
```

#### Langkah 4: Add Throttling to Specific Routes

Untuk kontrol lebih granular, tambahkan throttle langsung di route:

```php
// routes/api.php

Route::post('/register', [ApiController::class, 'register'])
    ->throttle('register'); // Custom limiter
    
Route::post('/login', [ApiController::class, 'login'])
    ->throttle('login'); // Custom limiter

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [ApiController::class, 'logout'])
        ->throttle('logout');
    
    Route::post('/projects/{project}/messages', [ApiController::class, 'sendMessage'])
        ->throttle('ai-messages');
    
    // ... other routes with appropriate limits
});
```

---

## ⚙️ Advanced Configuration

### Per-IP vs Per-User Rate Limiting

Untuk mencegah bypass via multiple IPs, combine both:

```php
RateLimiter::for('login', function ($request) {
    return RateLimiter::by($request->input('email'))
        ->plus(RateLimiter::by($request->ip()))
        ->frequency(5)
        ->period(60);
});
```

### Redis Backend (Production Recommended)

Jika deploy production dengan Redis:

```bash
php artisan config:cache
```

Update `.env`:
```env
CACHE_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

---

## 🧪 Testing & Verification

### Test Rate Limiting

```bash
# Test login rate limiting (send 10 requests rapidly)
for i in {1..10}; do
    curl -X POST http://localhost:8000/api/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"wrong"}'
    echo ""
done

# Check response headers
curl -i -X POST http://localhost:8000/api/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}'
```

Expected response after limit reached:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
```

---

## 📊 Monitoring & Alerting

Tambahkan monitoring untuk rate limit hits:

```php
// Dalam AppServiceProvider atau event listener
RateLimiter::limiter(function () {
    return new class
    {
        public function __invoke(Request $request)
        {
            $limit = RateLimiter::for($request)->limiter();
            
            if ($limit >= config('services.limits.hit') && ! app()->environment('local')) {
                Log::warning('[RATE_LIMIT] Heavy usage detected', [
                    'email' => $request->input('email'),
                    'ip' => $request->ip(),
                    'endpoint' => $request->path(),
                ]);
            }
            
            return $limit;
        }
    };
});
```

---

## 🚨 Emergency Response

If rate limits are being abused despite protections:

1. **Immediate**: Block specific IP patterns via firewall
2. **Short-term**: Increase rate limits severity temporarily
3. **Long-term**: Implement CAPTCHA after 3 failed attempts
   ```php
   // Use reCAPTCHA v3 or hCaptcha integration
   ```

---

## ✅ Checklist Implementasi

- [ ] Add throttle middleware to bootstrap/app.php
- [ ] Configure RateLimiter rules in AppServiceProvider
- [ ] Test rate limiting with automated scripts
- [ ] Add monitoring alerts for rate limit hits
- [ ] Document rate limits for frontend developers
- [ ] Consider CAPTCHA integration for repeated failures

---

## 📚 References

- [Laravel Rate Limiting Documentation](https://laravel.com/docs/12.x/rate-limiting)
- [Throttle Requests Middleware](https://laravel.com/api/12.x/Illuminate/Routing/Middleware/ThrottleRequests.html)
- [Best Practices for API Security](https://owasp.org/www-project-api-security/)

---

**Catatan**: Setelah implementasi rate limiting, perlu update dokumentasi API dan informasikan kepada tim frontend tentang batas request yang ada agar UI bisa handle 429 response dengan proper UX (retry-with-backoff).
