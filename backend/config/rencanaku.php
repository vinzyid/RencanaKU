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

    /*
    |--------------------------------------------------------------------------
    | Green Computing (Estimasi Dampak Lingkungan)
    |--------------------------------------------------------------------------
    | Koefisien untuk mengestimasi listrik, karbon, dan air dari pemakaian
    | token AI. Semua nilai dapat di-override lewat .env agar admin bisa
    | memakai sumber/koefisien yang mereka percayai. Bersifat ESTIMASI.
    */
    'green_avg_target' => (float) env('GREEN_AVG_TOKEN_TARGET', 1500),

    'green' => [
        // Energi inferensi per 1.000 token (kWh).
        'kwh_per_1k_tokens' => (float) env('GREEN_KWH_PER_1K_TOKENS', 0.004),
        // Intensitas karbon grid (kg CO2e per kWh).
        'co2_kg_per_kwh' => (float) env('GREEN_CO2_KG_PER_KWH', 0.4),
        // Air pendinginan data center (liter per kWh).
        'water_liters_per_kwh' => (float) env('GREEN_WATER_L_PER_KWH', 1.8),
        // Padanan untuk konteks.
        'tree_kg_co2_per_year' => (float) env('GREEN_TREE_KG_PER_YEAR', 21.0),
        'car_kg_co2_per_km' => (float) env('GREEN_CAR_KG_PER_KM', 0.192),
        'smartphone_wh_per_charge' => (float) env('GREEN_PHONE_WH_PER_CHARGE', 12.0),
    ],
];
