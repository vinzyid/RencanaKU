<?php

return [
    /*
    |--------------------------------------------------------------------------
    | AI Provider Chain
    |--------------------------------------------------------------------------
    | RencanaKU memanggil LLM secara berantai (fallback chain). Bila provider
    | utama gagal (rate limit / quota / error jaringan), sistem otomatis
    | mencoba provider berikutnya. Bila seluruh provider LLM gagal, sistem
    | jatuh ke "local" generator deterministik agar fitur tetap berjalan
    | (transparan lewat kolom ai_provider pada tiap versi PRD).
    */
    /*
    | Setiap provider punya "driver" yang menentukan cara memanggil API-nya:
    |   - openai   : format OpenAI /chat/completions (dipakai GripHub & OpenRouter)
    |   - gemini   : format Google Gemini generateContent
    |   - local    : generator deterministik (fallback terakhir)
    */
    'providers' => [
        [
            'name' => 'griphub',
            'driver' => 'openai',
            'endpoint' => env('GRIPHUB_BASE_URL', 'https://griphubrouter.web.id/v1').'/chat/completions',
            'key' => env('GRIPHUB_API_KEY'),
            'model' => env('GRIPHUB_MODEL', 'deepseek-v4-flash'),
        ],
        [
            'name' => 'openrouter',
            'driver' => 'openai',
            'endpoint' => 'https://openrouter.ai/api/v1/chat/completions',
            'key' => env('OPENROUTER_API_KEY'),
            'model' => env('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),
        ],
        [
            'name' => 'gemini',
            'driver' => 'gemini',
            'endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            'key' => env('GEMINI_API_KEY'),
            'model' => env('GEMINI_MODEL', 'gemini-1.5-flash'),
        ],
        [
            'name' => 'local',
            'driver' => 'local',
            'endpoint' => null,
            'key' => null,
            'model' => 'deterministic',
        ],
    ],

    'timeout' => (int) env('AI_REQUEST_TIMEOUT', 30),

    /*
    |--------------------------------------------------------------------------
    | Admin Emails
    |--------------------------------------------------------------------------
    | Email yang otomatis diberi role "admin" saat mendaftar / login (manual,
    | Google, maupun GitHub). Daftar ini dipisah koma di env ADMIN_EMAILS.
    */
    'admin_emails' => array_values(array_filter(array_map(
        fn ($email) => mb_strtolower(trim($email)),
        explode(',', (string) env('ADMIN_EMAILS', ''))
    ))),
];
