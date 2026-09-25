<?php

namespace App\Services\Ai;

/**
 * PrdGenerator: orkestrasi logika requirement-engineering RencanaKU.
 *
 * Bertanggung jawab atas:
 *  - generate draft PRD dari prompt awal,
 *  - mendeteksi ambiguitas,
 *  - mendeteksi kontradiksi,
 *  - merevisi PRD berdasarkan jawaban klarifikasi / resolusi / revisi bebas,
 *  - menghitung diff antar versi (untuk tampilan hijau/merah/kuning).
 */
class PrdGenerator
{
    public function __construct(private readonly AiGateway $gateway)
    {
    }

    public function provider(): ?string
    {
        return $this->gateway->lastProvider();
    }

    /**
     * Set konteks user/project agar pemakaian token tercatat ke pemilik yang benar.
     */
    public function setContext(?int $userId, ?int $projectId = null): static
    {
        $this->contextUserId = $userId;
        $this->contextProjectId = $projectId;

        return $this;
    }

    private ?int $contextUserId = null;
    private ?int $contextProjectId = null;

    /**
     * Jalankan gateway dengan konteks + label mode tertentu.
     */
    private function ask(string $mode, string $system, string $user): array
    {
        return $this->gateway
            ->withContext($this->contextUserId, $this->contextProjectId, $mode)
            ->chat($system, $user);
    }

    /**
     * Generate draft PRD dari ide awal user.
     */
    public function generate(string $prompt): array
    {
        $system = <<<'SYS'
        Kamu adalah asisten product manager senior untuk platform RencanaKU.
        Tugasmu mengubah ide kasar pengguna menjadi PRD (Product Requirement Document) terstruktur dalam Bahasa Indonesia.
        Selalu balas HANYA dengan JSON valid (tanpa markdown, tanpa penjelasan) dengan bentuk tepat:
        {
          "title": string,
          "background": string,
          "objectives": string[],
          "target_users": string[],
          "functional_requirements": string[],
          "non_functional_requirements": string[],
          "constraints": string[],
          "open_questions": string[]
        }
        Requirement harus spesifik, terukur bila memungkinkan, dan tidak saling bertentangan.
        SYS;

        $user = "[MODE:generate]\n[PROMPT:{$prompt}]";

        return $this->normalize($this->ask('generate', $system, $user), $prompt);
    }

    /**
     * Deteksi bagian requirement yang masih ambigu.
     * Mengembalikan daftar ['question' => string, 'requirement_ref' => ?string].
     */
    public function detectAmbiguities(array $prd): array
    {
        $prdText = $this->prdToText($prd);

        $system = <<<'SYS'
        Kamu adalah asisten product manager ramah untuk platform RencanaKU.
        Penggunamu adalah orang awam yang TIDAK paham istilah teknis.

        Aturan pertanyaan:
        - Ajukan maksimal 2 pertanyaan yang PALING penting saja.
        - Gunakan bahasa sehari-hari yang mudah dipahami orang awam (hindari kata seperti "requirement", "KPI", "SLA", "role", "2FA", "endpoint").
        - Setiap pertanyaan WAJIB menyertakan 2-3 pilihan jawaban siap-klik dalam bentuk singkat, agar pengguna tinggal memilih tanpa harus mengetik panjang.
        - Jika PRD sudah cukup jelas, kembalikan "ambiguities": [].

        Balas HANYA JSON valid dengan bentuk tepat:
        {
          "ambiguities": [
            {
              "question": string,
              "requirement_ref": string|null,
              "options": string[]
            }
          ]
        }
        SYS;

        $user = "[MODE:ambiguity]\n[PROMPT:{$prdText}]";

        $result = $this->ask('ambiguity', $system, $user);
        $items = $result['ambiguities'] ?? $result['questions'] ?? [];

        return $this->normalizeQuestions($items);
    }
    /**
     * Deteksi requirement yang saling bertentangan.
     * Mengembalikan daftar ['requirement_a', 'requirement_b', 'explanation'].
     */
    public function detectContradictions(array $prd): array
    {
        $prdText = $this->prdToText($prd);

        $system = <<<'SYS'
        Kamu adalah reviewer requirement. Temukan pasangan requirement yang saling bertentangan pada PRD.
        Balas HANYA JSON valid:
        { "contradictions": [ { "requirement_a": string, "requirement_b": string, "explanation": string } ] }
        Bahasa Indonesia. Bila tidak ada kontradiksi, kembalikan "contradictions": [].
        SYS;

        $user = "[MODE:contradiction]\n[PROMPT:{$prdText}]";

        $result = $this->ask('contradiction', $system, $user);
        $items = $result['contradictions'] ?? [];

        return $this->normalizeContradictions($items);
    }

    /**
     * Revisi PRD berdasarkan jawaban/masukan user + konteks pertanyaan.
     */
    public function revise(array $prd, string $instruction, ?string $question = null): array
    {
        $prdText = $this->prdToText($prd);
        $context = $question ? "Konteks pertanyaan klarifikasi: {$question}\n" : '';

        $system = <<<'SYS'
        Kamu memperbarui PRD berdasarkan masukan pengguna. Jangan menghapus requirement lama kecuali diminta.
        Gabungkan informasi baru secara konsisten. Balas HANYA JSON valid dengan bentuk PRD yang sama:
        {
          "title": string,
          "background": string,
          "objectives": string[],
          "target_users": string[],
          "functional_requirements": string[],
          "non_functional_requirements": string[],
          "constraints": string[],
          "open_questions": string[]
        }
        SYS;

        $user = "[MODE:revise]\n[PROMPT:{$instruction}]\n{$context}[PRD:{$prdText}]";

        return $this->normalize($this->ask('revise', $system, $user), $instruction, $prd);
    }

    /**
     * Normalisasi bentuk PRD agar field yang dibutuhkan frontend selalu ada.
     */
    private function normalize(array $data, string $fallbackPrompt, ?array $base = null): array
    {
        $base ??= [];
        $strings = fn ($value) => array_values(array_filter(array_map(
            fn ($item) => is_string($item) ? trim($item) : trim(json_encode($item)),
            (array) $value
        ), fn ($item) => $item !== ''));

        return [
            'title' => (string) ($data['title'] ?? $base['title'] ?? 'Proyek Baru'),
            'background' => (string) ($data['background'] ?? $base['background'] ?? ''),
            'objectives' => $strings($data['objectives'] ?? $base['objectives'] ?? []),
            'target_users' => $strings($data['target_users'] ?? $base['target_users'] ?? []),
            'functional_requirements' => $strings($data['functional_requirements'] ?? $base['functional_requirements'] ?? []),
            'non_functional_requirements' => $strings($data['non_functional_requirements'] ?? $base['non_functional_requirements'] ?? []),
            'constraints' => $strings($data['constraints'] ?? $base['constraints'] ?? []),
            'open_questions' => $strings($data['open_questions'] ?? $base['open_questions'] ?? []),
            'source_prompt' => (string) ($data['source_prompt'] ?? $base['source_prompt'] ?? $fallbackPrompt),
        ];
    }

    private function normalizeQuestions(array $items): array
    {
        $out = [];
        $seen = [];
        foreach ($items as $item) {
            if (is_string($item)) {
                $question = trim($item);
                $ref = null;
                $key = null;
                $options = [];
            } else {
                $question = trim((string) ($item['question'] ?? $item['text'] ?? ''));
                $ref = $item['requirement_ref'] ?? $item['ref'] ?? null;
                $key = $item['key'] ?? null;
                $options = array_values(array_filter(array_map(
                    fn ($opt) => is_string($opt) ? trim($opt) : trim((string) json_encode($opt)),
                    (array) ($item['options'] ?? [])
                ), fn ($opt) => $opt !== ''));
                $options = array_slice($options, 0, 3);
            }

            if ($question === '') {
                continue;
            }

            // Key stabil untuk deduplikasi lintas-versi: pakai key eksplisit
            // (local engine) atau hash dari teks pertanyaan yang dinormalisasi (LLM).
            $key ??= 'q_'.substr(md5(mb_strtolower(preg_replace('/\s+/', ' ', $question))), 0, 12);

            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;

            $out[] = ['key' => $key, 'question' => $question, 'requirement_ref' => $ref, 'options' => $options];
        }

        return array_slice($out, 0, 3);
    }

    private function normalizeContradictions(array $items): array
    {
        $out = [];
        foreach ($items as $item) {
            $a = trim((string) ($item['requirement_a'] ?? $item['a'] ?? ''));
            $b = trim((string) ($item['requirement_b'] ?? $item['b'] ?? ''));
            if ($a !== '' && $b !== '') {
                $out[] = [
                    'requirement_a' => $a,
                    'requirement_b' => $b,
                    'explanation' => trim((string) ($item['explanation'] ?? 'Kedua requirement saling bertentangan.')),
                ];
            }
        }

        return $out;
    }

    private function prdToText(array $prd): string
    {
        $lines = [];
        if (! empty($prd['source_prompt'])) {
            $lines[] = 'IDE AWAL PENGGUNA: '.$prd['source_prompt'];
        }
        foreach (['background', 'objectives', 'target_users', 'functional_requirements', 'non_functional_requirements', 'constraints'] as $key) {
            $value = $prd[$key] ?? null;
            if (is_array($value)) {
                $lines[] = strtoupper($key).': '.implode('; ', $value);
            } elseif (is_string($value) && $value !== '') {
                $lines[] = strtoupper($key).': '.$value;
            }
        }

        return implode("\n", $lines);
    }
}
