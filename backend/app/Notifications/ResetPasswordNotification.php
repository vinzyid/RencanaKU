<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Notifikasi atur ulang kata sandi.
 *
 * Berbeda dari notifikasi bawaan Laravel yang menautkan ke route web
 * `password.reset` (yang tidak ada di backend headless ini), notifikasi ini
 * mengarahkan user ke halaman React di `APP_FRONTEND_URL/reset-password`.
 */
class ResetPasswordNotification extends ResetPassword
{
    protected function buildMailMessage($url): MailMessage
    {
        $expire = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

        return (new MailMessage)
            ->subject('Atur Ulang Kata Sandi RencanaKU')
            ->greeting('Halo!')
            ->line('Kami menerima permintaan untuk mengatur ulang kata sandi akun RencanaKU Anda.')
            ->action('Atur Ulang Kata Sandi', $url)
            ->line('Tautan ini hanya berlaku selama '.$expire.' menit.')
            ->line('Jika Anda tidak meminta atur ulang kata sandi, abaikan saja email ini. Kata sandi Anda tidak akan berubah.')
            ->salutation('Salam, Tim RencanaKU');
    }

    protected function resetUrl($notifiable): string
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $base.'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->getEmailForPasswordReset(),
        ]);
    }
}
