<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Controller\Auth\SocialAuthController;

/*
|--------------------------------------------------------------------------
| Web Routes (Backend API — Headless)
|--------------------------------------------------------------------------
| Frontend di-serve terpisah (React). Backend hanya menyediakan:
| - Redirect OAuth (Google/GitHub) yang lalu memutar balik ke frontend.
| Tidak ada view apa pun yang dirender di sini.
*/

// Social authentication (Google / GitHub OAuth)
Route::get('/oauth/google', [SocialAuthController::class, 'redirectToGoogle'])->name('google.login');
Route::get('/oauth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);

Route::get('/oauth/github', [SocialAuthController::class, 'redirectToGithub'])->name('github.login');
Route::get('/oauth/github/callback', [SocialAuthController::class, 'handleGithubCallback']);
