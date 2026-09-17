# Perbaikan Masalah #2: CORS Configuration Missing

> **Status**: 🟠 Medium Priority  
> **Kategori**: Konfigurasi & Deployment  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

File konfigurasi CORS `config/cors.php` **tidak ada** dalam project RencanaKU. Laravel 12+ tidak secara otomatis membuat config file ini, melainkan menggunakan nilai default yang mungkin tidak sesuai dengan kebutuhan aplikasi.

### Impact

1. **Production Deployment Block**: Saat deploy API dan SPA ke domain berbeda (misal `api.rencanaku.com` vs `app.rencanaku.com`), browser akan block requests karena Origin mismatch
2. **Subdomain Isolation**: Jika kedua service di-hosting di subdomain terpisah, kemungkinan besar blocked
3. **CORS Preflight Fail**: Browser sending OPTIONS requests may return 403 Forbidden
4. **Silent API Failure**: Frontend errors seperti "CORS policy" muncul di console tanpa error HTTP response

---

## 🎯 Penjelasan Solusi

### Membuat File CORS Configuration

Buat file baru `config/cors.php`:

```php
<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Untuk proyek RencanaKU dengan SPA frontend yang terpisah dari API backend,
    | konfigurasi CORS harus allow origins yang spesifik untuk production-ready.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'], // Allow all methods for flexibility

    'allowed_origins' => [
        // Development
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        
        // Production - UPDATE THESE BEFORE DEPLOYMENT
        // Replace with actual frontend domain(s)
        // 'https://rencanaku.app',
        // 'https://app.rencanaku.com',
        // 'https://*.replanku.com', // Wildcard subdomain (advanced)
    ],

    'allowed_origins_pattern' => '', // Optional: Regex pattern for dynamic origins
    
    'allowed_headers' => ['*'], // Allow all headers
        
    'exposed_headers' => [],
    
    'max_age' => 0, // No caching of preflight requests by default
    
    'supports_credentials' => true, // Required for Sanctum cookie-based auth
];
```

### Update untuk Environment Different

Gunakan environment variable untuk flexible configuration:

```php
// config/cors.php
return [
    'paths' => ['api/*', 'sanctum/cs-gitlcookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', 
        'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')),
    'allowed_origins_pattern' => env('CORS_ALLOWED_ORIGINS_PATTERN', ''),
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
```

### Configure `.env` Files

Edit file `.env` (development) and create `.env.example` updated:

**.env.development**:
```env
# CORS Configuration for Local Development
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
CORS_ALLOWED_ORIGINS_PATTERN=
```

**.env.production**:
```env
# CORS Configuration for Production
# For multi-domain deployments
CORS_ALLOWED_ORIGINS=https://rencanaku.app,https://app.rencanaku.com,https://staging.rencanaku.app
CORS_ALLOWED_ORIGINS_PATTERN=^https://.*\.ren\c.anaku\.com$
```

---

## ⚙️ Advanced Scenarios

### Scenario 1: Single Page Application on Same Domain

Jika frontend dan backend di server yang sama tapi port berbeda:

```php
'allowed_origins' => [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:8000', // If API served separately
],
'supports_credentials' => false, // If using token-only auth (Sanctum)
```

### Scenario 2: Mobile App Integration

Jika ada mobile app yang consume same API:

```php
'allowed_origins' => [
    'https://rencanaku.app',       // Web frontend
    'https://api.rencanaku.mobile', // Not used for native apps but good practice
],

// Untuk native apps, biasanya tidak perlu CORS
// Tapi tetap set allowed_origins jika pakai WebView
```

### Scenario 3: Multiple Domains per Region

Untuk deployment multi-region:

```php
'allowed_origins' => [
    // Asia region
    'https://ap-rencanaku.com',
    'https://asia.api.rencanaku.com',
    
    // Europe region
    'https://eu-rencanaku.com',
    'https://europe.api.rencanaku.com',
    
    // US region
    'https://us-rencanaku.com',
    'https://america.api.rencanaku.com',
],
```

### Scenario 4: Using Allowed Origins Pattern

Jika banyak subdomain yang valid:

```php
'allowed_origins_pattern' => '/^(https?:\\/\\/)?(www\\.)?([a-z0-9-]+\\.)?rencanaku\\.com$/i',
```

Pattern ini akan match:
- `https://app.rencanaku.com`
- `https://staging.rencanaku.com`
- `https://dev.rencanaku.com`

---

## 🧪 Testing CORS Configuration

### Test 1: Browser Console

1. Buka browser dev tools → Network tab
2. Send request to `/api/projects`
3. Check Response Headers:
   ```
   Access-Control-Allow-Origin: http://localhost:3000 ✓
   Access-Control-Allow-Credentials: true ✓
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS ✓
   Access-Control-Allow-Headers: Content-Type, Authorization ✓
   ```

### Test 2: Curl Request with Pre-flight

```bash
curl -X OPTIONS http://localhost:8000/api/projects \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" \
    -v

# Expected:
# < HTTP/1.1 204 No Content
# < Access-Control-Allow-Origin: http://localhost:3000
```

### Test 3: Production Environment Test

```bash
# Simulate from external domain
curl -X POST http://api-server:8000/api/login \
    -H "Origin: https://frontend-server:443" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}' \
    -I

# Should NOT see:
# HTTP/1.1 403 Forbidden (CORS error)
```

---

## 🔒 Security Considerations

### ❌ Dangerous Configuration (Avoid!)

```php
// NEVER do this in production!
'allowed_origins' => ['*'],  // Exposes entire API to anyone
```

Ini membuka risiko:
- CSRF attacks (even with Sanctum)
- Credential theft via malicious sites
- Data exfiltration

### ✅ Best Practice Configuration

```php
// Specific domains only
'allowed_origins' => [
    'https://specific-domain.com',
    'https://another-approved-domain.com',
],

// OR use regex pattern for controlled subdomains
'allowed_origins_pattern' => '/^https:\/\/[a-z0-9-]+\.rencanaku\.com$/i',
```

### Dynamic Origin Handling

Untuk whitelist approach (more secure):

```php
// bootstrap/app.php or RouteServiceProvider
Route::configureMiddleware(function ($middleware) {
    $middleware->throttle(api: []);
});

// Dalam AppServiceProvider atau middleware custom
class CorsConfigurator
{
    public static function configure(): void
    {
        $allowed = config('cors.allowed_origins');
        $whitelist = getEnv('API_WHITELIST_DOMAINS');
        
        if (!empty($whitelist)) {
            $approved = json_decode($whitelist, true);
            if (is_array($approved) && in_array('*', $approved)) {
                config(['cors.allowed_origins' => ['*']]); // Only for trusted environments
            } else {
                config(['cors.allowed_origins' => array_merge($allowed, $approved)]);
            }
        }
    }
}
```

---

## 🚀 Deployment Checklist

- [ ] Create `config/cors.php` with proper configuration
- [ ] Update `.env` for each environment (local, staging, prod)
- [ ] Set correct `allowed_origins` based on deployment architecture
- [ ] Test CORS headers with browser dev tools
- [ ] Verify preflight OPTIONS responses
- [ ] Document CORS requirements for team
- [ ] Consider rate limiting per origin IP
- [ ] Add monitoring for rejected CORS requests

---

## 📊 Monitoring CORS Issues

Tambahkan logging untuk track CORS failures:

```php
// app/Exceptions/Handler.php
public function register()
{
    if (config('app.debug')) {
        $this->reportable(function (RequestException $e) {
            if ($e->getResponse()?->getStatusCode() === 403) {
                Log::warning('[CORS] Forbidden request detected', [
                    'origin' => request()->header('Origin'),
                    'referer' => request()->header('Referer'),
                    'method' => request()->method(),
                    'path' => request()->path(),
                ]);
            }
        });
    }
}
```

---

## 🔄 Migration from Default

Jika ingin migrate dari default behavior:

```bash
# 1. Publish default config (optional - recommended)
php artisan vendor:publish --tag="laravel-cors"

# 2. Edit config/cors.php
# 3. Clear config cache
php artisan config:clear
php artisan config:cache

# 4. Restart PHP-FPM / Laravel
sudo systemctl restart php8.2-fpm
# or
sudo systemctl restart laravel-worker
```

---

## ✅ Final Verification

Setelah implementasi, verify bahwa:

✅ CORS headers appear in all API responses  
✅ Preflight OPTIONS requests succeed  
✅ Credentials properly handled (if using cookies)  
✅ Production domains correctly configured  
✅ No "CORS policy" errors in browser console  

---

**Catatan Penting**: Selalu test CORS configuration sebelum deploy ke production! Gunakan browser developer tools untuk memverifikasi headers dan pastikan tidak ada request yang diblock oleh browser.
