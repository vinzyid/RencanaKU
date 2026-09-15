<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Controller\Auth\SocialAuthController;

Route::get('/', function () {
    return view('welcome');
});

// Social authentication (Google / GitHub OAuth)
Route::get('/oauth/google', [SocialAuthController::class, 'redirectToGoogle'])->name('google.login');
Route::get('/oauth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);

Route::get('/oauth/github', [SocialAuthController::class, 'redirectToGithub'])->name('github.login');
Route::get('/oauth/github/callback', [SocialAuthController::class, 'handleGithubCallback']);
