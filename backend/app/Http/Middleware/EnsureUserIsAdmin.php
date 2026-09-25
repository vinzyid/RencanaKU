<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Membatasi akses agar hanya user dengan role "admin" yang bisa lewat.
 * Dipakai pada route admin (mis. pemantauan pemakaian token AI).
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isAdmin()) {
            abort(403, 'Akses hanya untuk admin.');
        }

        return $next($request);
    }
}
