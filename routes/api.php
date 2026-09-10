<?php

use App\Http\Controllers\ApiController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [ApiController::class, 'register']);
Route::post('/login', [ApiController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [ApiController::class, 'logout']);
    Route::get('/me', [ApiController::class, 'me']);

    Route::get('/projects', [ApiController::class, 'projects']);
    Route::post('/projects', [ApiController::class, 'createProject']);
    Route::get('/projects/{project}', [ApiController::class, 'showProject']);
    Route::patch('/projects/{project}', [ApiController::class, 'renameProject']);
    Route::delete('/projects/{project}', [ApiController::class, 'deleteProject']);

    // Chat thread: satu endpoint menangani ide awal, jawaban klarifikasi,
    // resolusi kontradiksi, dan revisi bebas.
    Route::get('/projects/{project}/messages', [ApiController::class, 'messages']);
    Route::post('/projects/{project}/messages', [ApiController::class, 'sendMessage']);

    Route::get('/projects/{project}/versions', [ApiController::class, 'versions']);
    Route::post('/projects/{project}/finalize', [ApiController::class, 'finalize']);
    Route::get('/projects/{project}/export/{format}', [ApiController::class, 'export']);
});
