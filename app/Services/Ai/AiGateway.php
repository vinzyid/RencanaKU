<?php

namespace App\Services\Ai;

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

    public function __construct(private readonly LocalPrdEngine $localEngine)
    {
    }

    public function lastProvider(): ?string
    {
        return $this->lastProvider;
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
            ]);

        $response->throw();

        $content = data_get($response->json(), 'choices.0.message.content');

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

        $content = data_get($response->json(), 'candidates.0.content.parts.0.text');

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

        if (! is_array($decoded)) {
            throw new \RuntimeException('respons LLM bukan JSON valid');
        }

        return $decoded;
    }
}
