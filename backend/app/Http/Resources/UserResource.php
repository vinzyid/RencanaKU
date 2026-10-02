<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Representasi user untuk API (Masalah #12).
 *
 * Field mentah "role" sengaja TIDAK diekspos: membocorkan siapa yang admin
 * memudahkan attacker melakukan reconnaissance dan merencanakan privilege
 * escalation. Sebagai gantinya kita kirim flag boolean "is_admin" yang hanya
 * bermakna untuk user yang sedang login (dipakai frontend untuk menampilkan
 * menu admin), tanpa mengungkap nilai role mentah.
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'auth_provider' => $this->auth_provider,
            // Flag turunan, bukan nilai role mentah. Aman untuk konsumsi
            // frontend karena hanya menyatakan "user ini admin atau bukan".
            'is_admin' => $this->isAdmin(),
            'created_at' => $this->created_at,
        ];
    }
}
