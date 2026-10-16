<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\ApiController;
use App\Http\Controllers\Controller\Auth\SocialAuthController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [ApiController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [ApiController::class, 'login'])->middleware('throttle:login');

// Lupa & atur ulang kata sandi (publik, dibatasi rate limit).
Route::post('/forgot-password', [ApiController::class, 'forgotPassword'])->middleware('throttle:password-email');
Route::post('/reset-password', [ApiController::class, 'resetPassword'])->middleware('throttle:password-reset');

// Tukar kode OAuth sekali-pakai (dari callback social login) menjadi token
// Sanctum via POST, sehingga token tidak pernah muncul di URL (Masalah #11).
Route::post('/oauth/token/complete', [SocialAuthController::class, 'completeLogin'])
    ->middleware('throttle:login');

Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    Route::post('/logout', [ApiController::class, 'logout']);
    Route::get('/me', [ApiController::class, 'me']);

    // Ganti / setel kata sandi dari halaman Pengaturan.
    Route::post('/password', [ApiController::class, 'changePassword']);

    Route::get('/projects', [ApiController::class, 'projects']);
    Route::post('/projects', [ApiController::class, 'createProject']);
    Route::get('/projects/{project}', [ApiController::class, 'showProject']);
    Route::patch('/projects/{project}', [ApiController::class, 'renameProject']);
    Route::delete('/projects/{project}', [ApiController::class, 'deleteProject']);

    // Chat thread: satu endpoint menangani ide awal, jawaban klarifikasi,
    // resolusi kontradiksi, dan revisi bebas.
    Route::get('/projects/{project}/messages', [ApiController::class, 'messages']);
    Route::post('/projects/{project}/messages', [ApiController::class, 'sendMessage'])->middleware('throttle:ai-messages');

    Route::get('/projects/{project}/versions', [ApiController::class, 'versions']);
    Route::post('/projects/{project}/finalize', [ApiController::class, 'finalize']);
    Route::get('/projects/{project}/export/{format}', [ApiController::class, 'export']);
});

// Admin (hanya role admin)
Route::middleware(['auth:sanctum', 'admin', 'throttle:api'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminController::class, 'stats']);
    Route::get('/green', [AdminController::class, 'green']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::get('/token-usage', [AdminController::class, 'tokenUsage']);
});

