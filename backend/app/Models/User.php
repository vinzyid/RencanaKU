<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Notifications\ResetPasswordNotification;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'auth_provider',
        'provider_id',
        'role',
    ];

    public const ROLE_USER = 'user';
    public const ROLE_ADMIN = 'admin';

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /**
     * Akun manual (tanpa auth_provider) dibuat dengan kata sandi yang langsung
     * terpakai, jadi tandai password_set_at sejak awal. Akun OAuth dibiarkan
     * NULL karena password-nya acak/tidak terpakai.
     */
    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if ($user->password_set_at === null && $user->auth_provider === null) {
                $user->password_set_at = now();
            }
        });
    }

    /**
     * Apakah akun ini punya kata sandi yang benar-benar dipakai user.
     *
     * Akun OAuth dibuat dengan password acak tanpa nilai `password_set_at`,
     * sehingga NULL berarti "belum pernah mengeset kata sandi" — user boleh
     * mengesetnya tanpa perlu memasukkan kata sandi lama.
     */
    public function hasPassword(): bool
    {
        return $this->password_set_at !== null;
    }

    /**
     * Pakai notifikasi atur ulang kita sendiri agar tautan mengarah ke
     * frontend SPA (bukan route web Laravel yang tidak ada di backend ini).
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    /**
     * Role default untuk sebuah email: "admin" bila terdaftar di
     * config('rencanaku.admin_emails'), selain itu "user".
     */
    public static function roleForEmail(?string $email): string
    {
        $normalized = mb_strtolower(trim((string) $email));

        return in_array($normalized, config('rencanaku.admin_emails', []), true)
            ? self::ROLE_ADMIN
            : self::ROLE_USER;
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'password_set_at' => 'datetime',
        ];
    }

    public function projects(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function messages(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(Message::class, Project::class);
    }
}
