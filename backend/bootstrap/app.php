<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Di produksi request datang lewat Caddy (reverse proxy) ke container
        // yang hanya mendengarkan 127.0.0.1, jadi header X-Forwarded-* aman
        // dipercaya. Tanpa ini Laravel mengira request-nya http://.
        $middleware->trustProxies(at: '*');

        $middleware->api(prepend: [
            EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);

        // API stateless: jangan pernah redirect tamu ke route "login" (yang
        // tidak ada), cukup lempar AuthenticationException agar dirender 401.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // API bersifat stateless: kegagalan autentikasi harus mengembalikan
        // 401 JSON, bukan mencoba redirect ke route "login" yang tidak ada
        // (yang sebelumnya menyebabkan 500 RouteNotFoundException).
        $exceptions->render(function (AuthenticationException $e, $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });
    })->create();
