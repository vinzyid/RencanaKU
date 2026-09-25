<?php

namespace App\Services\Ai;

use App\Models\TokenUsage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * AiGateway bertanggung jawab memanggil LLM lewat fallback chain:
 *   openrouter -> gemini -> local (deterministik)
 *
 * Setiap provider menerima system prompt + user prompt dan diharapkan
 * mengembalikan array JSON terstruktur. Bila sebuah provider gagal
 * (tanpa key, rate limit, error HTTP, JSON tidak valid), gateway otomatis
 * mencoba provider berikutnya dan mencatat provider yang akhirnya berhasil
 * lewat metode lastProvider().
 */
class AiGateway
{
    private ?string $lastProvider = null;

    /** @var array{user_id?: ?int, project_id?: ?int, mode?: ?string} */
    private array $context = [];

    public function __construct(private readonly LocalPrdEngine $localEngine)
    {
    }

    public function lastProvider(): ?string
    {
        return $this->lastProvider;
    }

    /**
     * Set konteks pemanggilan (user/project/mode) agar setiap pemakaian token
     * bisa diatribusikan ke user & proyek yang benar.
     */
    public function withContext(?int $userId, ?int $projectId = null, ?string $mode = null): static
    {
        $this->context = [
            'user_id' => $userId,
            'project_id' => $projectId,
            'mode' => $mode,
        ];

        return $this;
    }

    /**
     * Catat pemakaian token dari respons provider (bila tersedia).
     */
    private function recordUsage(string $provider, string $model, ?array $usage): void
    {
        if (! is_array($usage)) {
            return;
        }

        $prompt = (int) ($usage['prompt_tokens'] ?? $usage['promptTokenCount'] ?? 0);
        $completion = (int) ($usage['completion_tokens'] ?? $usage['candidatesTokenCount'] ?? 0);
        $total = (int) ($usage['total_tokens'] ?? $usage['totalTokenCount'] ?? ($prompt + $completion));

        if ($total === 0 && $prompt === 0 && $completion === 0) {
            return;
        }

        try {
            TokenUsage::create([
                'user_id' => $this->context['user_id'] ?? null,
                'project_id' => $this->context['project_id'] ?? null,
                'provider' => $provider,
                'model' => $model,
                'mode' => $this->context['mode'] ?? null,
                'prompt_tokens' => $prompt,
                'completion_tokens' => $completion,
                'total_tokens' => $total,
            ]);
        } catch (\Throwable $e) {
            // Pencatatan token tidak boleh mengganggu proses utama.
            Log::warning('[AiGateway] gagal mencatat token: '.$e->getMessage());
        }
    }

    /**
     * Jalankan chain sampai ada provider yang mengembalikan array valid.
     */
    public function chat(string $systemPrompt, string $userPrompt): array
    {
        foreach (config('rencanaku.providers', []) as $provider) {
            $name = $provider['name'] ?? 'unknown';
            $driver = $provider['driver'] ?? $name;

            try {
                $result = match ($driver) {
                    'openai' => $this->callOpenAiCompatible($provider, $systemPrompt, $userPrompt),
                    'gemini' => $this->callGemini($provider, $systemPrompt, $userPrompt),
                    default => $this->localEngine->respond($userPrompt),
                };

                if (is_array($result)) {
                    $this->lastProvider = $name;

                    return $result;
                }
            } catch (\Throwable $e) {
                Log::warning("[AiGateway] provider {$name} gagal: {$e->getMessage()}");
            }
        }

        // Seluruh provider gagal -> paksa local engine sebagai jaring terakhir.
        $this->lastProvider = 'local';

        return $this->localEngine->respond($userPrompt);
    }

    /**
     * Provider kompatibel OpenAI (GripHub Router, OpenRouter, dsb).
     * Endpoint: POST {endpoint} dengan body {model, messages, temperature}.
     *
     * Catatan: sebagian gateway (mis. GripHub/9Router) tidak menjamin dukungan
     * response_format/json_object, jadi kita tidak mengandalkannya. Format JSON
     * dijaga lewat instruksi di system prompt + parsing defensif di decodeJson().
     */
    private function callOpenAiCompatible(array $provider, string $systemPrompt, string $userPrompt): ?array
    {
        if (empty($provider['key'])) {
            throw new \RuntimeException(($provider['name'] ?? 'provider').' API key kosong');
        }

        $response = Http::withToken($provider['key'])
            ->timeout(config('rencanaku.timeout'))
            ->acceptJson()
            ->post($provider['endpoint'], [
                'model' => $provider['model'],
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                'temperature' => 0.4,
                // Batas token keluaran. Tanpa ini, sebagian gateway memakai
                // default kecil sehingga JSON PRD terpotong di tengah dan
                // dianggap tidak valid.
                'max_tokens' => (int) env('AI_MAX_TOKENS', 4096),
            ]);

        $response->throw();

        $json = $response->json();
        $this->recordUsage($provider['name'] ?? 'openai', $provider['model'] ?? '', $json['usage'] ?? null);

        $content = data_get($json, 'choices.0.message.content');

        return $this->decodeJson($content);
    }

    private function callGemini(array $provider, string $systemPrompt, string $userPrompt): ?array
    {
        if (empty($provider['key'])) {
            throw new \RuntimeException('GEMINI_API_KEY kosong');
        }

        $endpoint = str_replace('{model}', $provider['model'], $provider['endpoint']);

        $response = Http::timeout(config('rencanaku.timeout'))
            ->acceptJson()
            ->post($endpoint.'?key='.$provider['key'], [
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'contents' => [
                    ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
                ],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'temperature' => 0.4,
                ],
            ]);

        $response->throw();

        $json = $response->json();
        $this->recordUsage(
            $provider['name'] ?? 'gemini',
            $provider['model'] ?? '',
            $json['usageMetadata'] ?? null
        );

        $content = data_get($json, 'candidates.0.content.parts.0.text');

        return $this->decodeJson($content);
    }

    /**
     * LLM kadang membungkus JSON dengan code fence atau narasi.
     */
    private function decodeJson(?string $content): ?array
    {
        if (! is_string($content) || trim($content) === '') {
            throw new \RuntimeException('respons LLM kosong');
        }

        $clean = trim($content);
        $clean = preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $clean);

        if (preg_match('/\{.*\}/s', $clean, $match)) {
            $clean = $match[0];
        }

        $decoded = json_decode($clean, true);

        if (is_array($decoded)) {
            return $decoded;
        }

        // Percobaan penyelamatan: keluaran bisa terpotong di tengah (mis. kena
        // batas token). Coba ambil objek JSON terbesar yang masih utuh.
        $salvaged = $this->salvageTruncatedJson($clean);

        if (is_array($salvaged)) {
            Log::warning('[AiGateway] JSON terpotong, berhasil diselamatkan sebagian');

            return $salvaged;
        }

        throw new \RuntimeException('respons LLM bukan JSON valid');
    }

    /**
     * Selamatkan JSON yang terpotong dengan menutup kurung yang belum tertutup.
     */
    private function salvageTruncatedJson(string $json): ?array
    {
        $start = strpos($json, '{');
        if ($start === false) {
            return null;
        }

        $json = substr($json, $start);
        $stack = [];
        $inString = false;
        $escaped = false;

        for ($i = 0, $len = strlen($json); $i < $len; $i++) {
            $ch = $json[$i];

            if ($escaped) {
                $escaped = false;
                continue;
            }
            if ($ch === '\\') {
                $escaped = true;
                continue;
            }
            if ($ch === '"') {
                $inString = ! $inString;
                continue;
            }
            if ($inString) {
                continue;
            }

            if ($ch === '{' || $ch === '[') {
                $stack[] = $ch;
            } elseif ($ch === '}' || $ch === ']') {
                array_pop($stack);
            }
        }

        if ($inString) {
            $json .= '"';
        }

        // Tutup struktur yang belum selesai, dari dalam ke luar.
        while ($stack) {
            $open = array_pop($stack);
            $json .= $open === '{' ? '}' : ']';
        }

        $decoded = json_decode($json, true);

        return is_array($decoded) ? $decoded : null;
    }
}
