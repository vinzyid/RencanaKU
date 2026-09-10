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
    'providers' => [
        [
            'name' => 'openrouter',
            'endpoint' => 'https://openrouter.ai/api/v1/chat/completions',
            'key' => env('OPENROUTER_API_KEY'),
            'model' => env('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),
        ],
        [
            'name' => 'gemini',
            'endpoint' => 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            'key' => env('GEMINI_API_KEY'),
            'model' => env('GEMINI_MODEL', 'gemini-1.5-flash'),
        ],
        [
            'name' => 'local',
            'endpoint' => null,
            'key' => null,
            'model' => 'deterministic',
        ],
    ],

    'timeout' => (int) env('AI_REQUEST_TIMEOUT', 30),
];
