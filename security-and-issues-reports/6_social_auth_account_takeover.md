# Perbaikan Masalah #6: Social Auth Account Takeover Risk

> **Status**: 🔴 High Priority  
> **Kategori**: Keamanan (Security)  
> **Ditulis**: 2025-09-17

---

## 📋 Deskripsi Masalah

Mekanisme `SocialAuthController` menggunakan email matching untuk menghubungkan akun social login dengan akun existing, tanpa verifikasi apakah user asli telah mengizinkan linkage. Ini membuka risiko **account takeover** oleh attacker yang membuat akun Google/GitHub dengan email target user.

### Vulnerable Code (Line 34-57 in SocialAuthController.php)

```php
private function resolveUser(string $provider, SocialiteUser $socialUser, string $email, ?string $name): User
{
    // 1) Exact match on provider + provider_id
    $user = User::where('auth_provider', $provider)
        ->where('provider_id', $socialUser->getId())
        ->first();

    // ❌ VULNERABLE: Link to ANY existing account with same email!
    //    No verification if this linkage is authorized by original owner
    if (! $user) {
        $user = User::where('email', $email)->first();
    }

    if ($user) {
        $user->forceFill([
            'auth_provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'role' => User::roleForEmail($user->email),
        ])->save();

        return $user;
    }

    // Create new account...
}
```

### Attack Scenario

#### Step 1: Victim registers manually

```
User: john@example.com
Registration: Manual signup → password stored in database
auth_provider = null
provider_id = null
```

#### Step 2: Attacker creates controlled social account

```
Attacker creates:
- Gmail account: john.doe@gmail.com (spoofed display name)
- GitHub account: linked to john@example.com if GitHub allows external email
- OR uses same email address that victim registered with
```

#### Step 3: Attacker logs in via social auth

```
Request: POST /oauth/github/callback
Body: GitHub returns authenticated user with email john@example.com
System logic:
  ✓ Email "john@example.com" exists in database
  ✓ Attacker's account automatically linked to victim's identity
  ✓ User model updated: auth_provider='github', provider_id='123'
Result: Attacker gets full access to victim's account!
```

### Impact

1. **Account Hijacking**: Full takeover of existing accounts
2. **Data Theft**: Access all PRDs and project data
3. **Privilege Escalation**: If victim is admin, attacker becomes admin
4. **Audit Trail Corruption**: Actions attributed to wrong user
5. **Legal Liability**: Unauthorized actions under victim's identity

---

## 🎯 Penjelasan Solusi

### Solution A: Require Email Verification & Consent (Recommended)

Before linking social login to existing manual account, require explicit user consent through email confirmation.

#### Flow Diagram

```
┌─────────────────┐
│ Attacker logs   │
│ in with social  │
│ (john@example)  │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│ System detects  │
│ existing email  │
│ in database     │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│ Generate        │
│ temporary code  │
│ sent to email   │
│ (john@example)  │
└───────┬─────────┘
        │
        ▼
┌─────────────────┐
│ Victim receives │
│ email: "Someone │
│ tried to link   │
│ your account"   │
└───────┬─────────┘
        │
   ┌────┴────┐
   │         │
  YES        NO
   │         │
   ▼         ▼
┌───────┐ ┌──────────┐
│User   │ │Email     │
│clicks│ │link not  │
│link  │ │clicked   │
└───┬───┘ └────┬─────┘
    │          │
    ▼          ▼
┌─────────┐ ┌────────────┐
│Link     │ │Keep both  │
│accounts │ │separate   │
│merged   │ │accounts   │
└─────────┘ └────────────┘
```

#### Implementation Steps

**Step 1: Create Migration for Pending Link Requests**

```php
// database/migrations/YYYY_MM_DD_create_pending_social_links_table.php

Schema::create('pending_social_links', function (Blueprint $table) {
    $table->id();
    $table->foreignId('existing_user_id')->constrained('users')->onDelete('cascade');
    $table->string('email');
    $table->string('provider');       // google | github
    $table->string('provider_id');    // from OAuth provider
    $table->string('verification_code')->unique();
    $table->timestamp('expires_at');
    $table->enum('status', ['pending', 'verified', 'rejected', 'expired'])->default('pending');
    $table->timestamps();
    
    $table->index(['email', 'status']);
    $table->index('expires_at');
});
```

**Step 2: Update SocialAuthController Logic**

```php
use App\Models\PendingSocialLink;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class SocialAuthController extends Controller
{
    public function handleGoogleCallback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
            $email = $googleUser->getEmail();
            
            if (!$email) {
                return redirect('/?oauth_error=' . urlencode('Akun Google tidak menyediakan email.'));
            }
            
            $user = $this->resolveUser('google', $googleUser, $email, $googleUser->getName());
            
            return $this->tokenRedirect($user);
        } catch (\Throwable $e) {
            Log::error('Google OAuth failed: ' . $e->getMessage(), ['exception' => $e]);
            return redirect('/?oauth_error=' . urlencode('Google authentication failed.'));
        }
    }

    private function resolveUser(string $provider, SocialiteUser $socialUser, string $email, ?string $name): User
    {
        // 1) Check exact OAuth identity match first
        $user = User::where('auth_provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($user) {
            // Re-authenticate existing social-linked account
            $user->update([
                'email_verified_at' => now(),
            ]);
            
            return $user;
        }

        // 2) Check if email exists but NOT linked to this provider
        $existingManualUser = User::where('email', $email)
            ->whereNull('auth_provider')  // Or != $provider
            ->whereNotNull('password')    // Has manual login credentials
            ->first();

        if ($existingManualUser) {
            // ⚠️ SECURITY RISK DETECTED!
            // Don't auto-link. Instead, create pending verification request
            $pendingLink = PendingSocialLink::create([
                'existing_user_id' => $existingManualUser->id,
                'email' => $email,
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
                'verification_code' => $this->generateVerificationCode(),
                'expires_at' => now()->addHours(24),
                'status' => 'pending',
            ]);

            // Send email to existing user
            Mail::raw(function ($message) use ($email, $pendingLink, $name, $provider) {
                $message->to($email)
                    ->subject("⚠️ Someone tried to link your account to {$provider}")
                    ->html(view('emails.pending-social-link', [
                        'recipientEmail' => $email,
                        'requesterName' => $name,
                        'verificationUrl' => route('verify-social-link', ['code' => $pendingLink->verification_code]),
                        'expiresIn' => '24 hours',
                    ]));
            });

            // Redirect to special confirmation page instead of auto-logging in
            return redirect(route('confirm-social-link', [
                'user_id' => $existingManualUser->id,
                'verification_code' => $pendingLink->verification_code,
            ]));
        }

        // 3) Email doesn't exist or has no password - safe to create new account
        return User::create([
            'name' => $name ?: Str::before($email, '@'),
            'email' => $email,
            'password' => Hash::make(Str::random(64)), // Unusable password
            'auth_provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'role' => User::roleForEmail($email),
            'email_verified_at' => now(),
        ]);
    }

    private function generateVerificationCode(): string
    {
        return str_random(40); // Cryptographically secure random string
    }
}
```

**Step 3: Create Verification Routes and Controllers**

```php
// routes/api.php (add after Sanctum routes)

Route::middleware('guest')->group(function () {
    Route::get('/verify-social-link/{code}', [PendingSocialLinkController::class, 'show'])
        ->name('verify.social-link.show');
        
    Route::post('/verify-social-link/{code}/accept', [PendingSocialLinkController::class, 'accept'])
        ->name('verify.social-link.accept');
        
    Route::post('/verify-social-link/{code}/reject', [PendingSocialLinkController::class, 'reject'])
        ->name('verify.social-link.reject');
});
```

```php
// app/Http/Controllers/PendingSocialLinkController.php

class PendingSocialLinkController extends Controller
{
    public function show(string $code)
    {
        $pendingLink = PendingSocialLink::where('verification_code', $code)
            ->where('status', 'pending')
            ->with('existingUser')
            ->firstOrFail();

        if ($pendingLink->expires_at < now()) {
            $pendingLink->update(['status' => 'expired']);
            return back()->withErrors('Link verifikasi sudah expired.');
        }

        return view('auth.verify-social-link', compact('pendingLink'));
    }

    public function accept(Request $request, string $code)
    {
        $pendingLink = PendingSocialLink::where('verification_code', $code)
            ->where('status', 'pending')
            ->firstOrFail();

        // Verify it's the email owner accepting
        $ipMatch = $request->ip() === optional($pendingLink->createdViaIp)->ip;
        $tokenMatch = $request->user()?->id === $pendingLink->existing_user_id;
        
        if (!$tokenMatch && !$ipMatch) {
            abort(403, 'You cannot accept this request');
        }

        // Merge accounts
        $existingUser = $pendingLink->existingUser;
        
        $existingUser->update([
            'auth_provider' => $pendingLink->provider,
            'provider_id' => $pendingLink->provider_id,
            'password' => Hash::make(Str::random(64)), // Invalidate old password
            'email_verified_at' => now(),
        ]);

        // Transfer ownership of projects
        Project::where('user_id', $pendingLink->existing_user_id)
            ->update(['user_id' => $existingUser->id]); // This won't work due to FK constraint, need cascade

        $pendingLink->update(['status' => 'verified']);

        // Create token and redirect
        $token = $existingUser->createToken('social-link-migration')->plainTextToken;
        
        return redirect('/#/oauth_token=' . urlencode($token))
            ->with('success', 'Account successfully migrated to social login!');
    }

    public function reject(Request $request, string $code)
    {
        $pendingLink = PendingSocialLink::where('verification_code', $code)
            ->where('status', 'pending')
            ->firstOrFail();

        $pendingLink->update(['status' => 'rejected']);

        return back()->with('info', 'This social login attempt was rejected.');
    }
}
```

---

### Solution B: Provider-Exclusive Accounts (Simpler Alternative)

Require users to choose ONE authentication method per account:

```php
// When attempting to link different provider to same email
$existingWithSameEmailButDifferentProvider = User::where('email', $email)
    ->whereNotNull('auth_provider')
    ->where('auth_provider', '!=', $provider)
    ->first();

if ($existingWithSameEmailButDifferentProvider) {
    // Reject the social login attempt
    return redirect('/oauth/error')
        ->with('error', 'Email already used with different authentication method. Please use the same provider you originally signed up with.');
}
```

**Pros:**
✅ Simpler implementation  
✅ Clear separation between auth methods  
❌ Can't combine convenience of multiple login options  

---

### Solution C: Multi-Factor Linking (Most Secure)

Require BOTH email verification AND secondary authentication:

```php
if ($existingManualUser) {
    // Send verification code via EMAIL
    Mail::send('emails.verify-link', ['code' => $verificationCode]);
    
    // ALSO send SMS backup if phone number set
    if ($existingManualUser->phone_number) {
        Twilio::sendMessage(
            $existingManualUser->phone_number,
            "Your verification code for linking social account: $verificationCode"
        );
    }
    
    // Store multi-factor challenge
    MultiFactorChallenge::create([
        'user_id' => $existingManualUser->id,
        'challenge_type' => 'social-link',
        'challenge_data' => json_encode([
            'provider' => $provider,
            'provider_id' => $socialUser->getId(),
            'expires_at' => now()->addHour(),
        ]),
    ]);
}
```

---

## 🧪 Security Testing

### Test Case 1: Normal New User Flow

```php
public function testNewSocialUserAccountCreation(): void
{
    Mock::create(new MockUser());
    
    $response = $this->post('/oauth/google/callback', [
        'email' => 'newuser@example.com',
        'name' => 'New User',
        'provider_id' => 'google_abc123',
    ]);
    
    $this->assertDatabaseHas('users', [
        'email' => 'newuser@example.com',
        'auth_provider' => 'google',
        'provider_id' => 'google_abc123',
    ]);
}
```

### Test Case 2: Attempted Account Takeover (Should Be Blocked)

```php
public function testAttemptedAccountTakeoverIsBlocked(): void
{
    // Manually register user
    $victim = User::factory()->create(['email' => 'victim@example.com']);
    
    // Attacker tries social login with same email
    $response = $this->post('/oauth/google/callback', [
        'email' => 'victim@example.com',
        'name' => 'Attacker Name',
        'provider_id' => 'fake_google_id',
    ]);
    
    // Should redirect to verification page, not auto-login
    $response->assertRedirect(route('confirm-social-link'));
    
    // Verify pending link created
    $this->assertDatabaseHas('pending_social_links', [
        'existing_user_id' => $victim->id,
        'status' => 'pending',
    ]);
    
    // Original user should still have their password intact
    $this->assertTrue(Hash::check('original_password', $victim->password));
}
```

---

## ✅ Deployment Checklist

- [ ] Create `pending_social_links` table migration
- [ ] Implement email verification flow
- [ ] Add verification email template
- [ ] Create pending link controller and routes
- [ ] Implement verification acceptance/rejection logic
- [ ] Add audit logging for all link attempts
- [ ] Set up monitoring for high volume of link rejections
- [ ] Document security procedure for support team
- [ ] Train team on handling social auth edge cases
- [ ] Run security penetration test

---

## 📊 Compliance Requirements

If operating in regulated industry (healthcare, finance, etc.):

1. **GDPR**: Need explicit consent records for data processing
2. **SOC 2**: Must demonstrate access control measures
3. **HIPAA**: Audit trail for account modifications required
4. **PCI-DSS**: Strong authentication for financial transactions

Implement appropriate logging and consent tracking to meet compliance standards.

---

## 📚 References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/rfc8252)
- [Account Linking Security Considerations](https://auth0.com/docs/secure/tutorials/link-user-accounts)

---

**Critical Priority**: This vulnerability allows complete account takeover and must be addressed before production deployment. Implement Solution A as soon as possible.
