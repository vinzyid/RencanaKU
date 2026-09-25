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
          "business_rules": string[],
          "user_stories": string[],
          "acceptance_criteria": string[],
          "mvp_scope": string[],
          "later_scope": string[],
          "data_entities": string[],
          "edge_cases": string[],
          "constraints": string[],
          "open_questions": string[]
        }
        Aturan pengisian:
        - Semua field berupa daftar WAJIB diisi sebagai poin-poin singkat, JANGAN digabung menjadi satu paragraf panjang.
        - "business_rules": aturan/logika inti aplikasi (bukan hanya rumus matematika). Contoh untuk aplikasi kasir: "Stok berkurang otomatis setiap transaksi". Contoh untuk aplikasi tugas: "Data yang melewati tenggat ditandai terlambat". Untuk aplikasi kalkulator, tuliskan rumusnya secara eksplisit (contoh: "Harga jual = HPP x (1 + margin%)"). Sesuaikan dengan domain ide; bila tidak ada aturan khusus, isi array kosong.
        - "user_stories": format "Sebagai <peran>, saya ingin <aksi>, agar <manfaat>". Sesuaikan peran dengan ide pengguna (contoh: pemilik toko, mahasiswa, guru, pasien).
        - "acceptance_criteria": syarat terukur yang menandakan sebuah fitur dianggap selesai.
        - "mvp_scope": fitur yang masuk versi pertama. "later_scope": fitur yang ditunda.
        - "data_entities": data utama yang disimpan beserta field pentingnya. Sesuaikan dengan domain (contoh kasir: "Transaksi: item, jumlah, total, waktu"; contoh tugas: "Tugas: judul, tenggat, status"). 
        - "edge_cases": kondisi batas/kondisi tidak biasa yang harus ditangani, sesuai domain ide (contoh umum: "input kosong", "data tidak ditemukan"; untuk kalkulator boleh "pembagian dengan nol").
        Requirement harus spesifik, terukur bila memungkinkan, dan tidak saling bertentangan.

        PENTING — tetap setia pada permintaan pengguna:
        - JANGAN menambah fitur yang tidak diminta atau tidak tersirat dari ide pengguna (mis. login/autentikasi, cloud, multi-bahasa, notifikasi, laporan, ekspor PDF) kecuali pengguna menyebutkannya.
        - JANGAN mencantumkan angka/klaim teknis yang tidak diminta dan tidak bisa dipastikan dari ide (mis. "uptime 99%", "enkripsi AES-256", "1000 pengguna bersamaan", "SLA"). Cukup tulis kebutuhan yang wajar dan relevan.
        - Fokus pada kebutuhan inti sesuai ide. Bila ragu, lebih baik lebih sedikit dan benar daripada banyak tapi mengada-ada.
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
        - Ajukan maksimal 1 pertanyaan yang PALING penting saja.
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
        Kamu adalah reviewer requirement. Temukan HANYA pasangan requirement yang benar-benar saling bertentangan secara logis pada PRD.

        Kriteria kontradiksi (harus memenuhi):
        - Kedua requirement tidak bisa dipenuhi bersamaan tanpa kompromi nyata.
        - Bukan sekadar "tantangan implementasi", "butuh usaha tambahan", atau perbedaan prioritas.
        - Bukan dua hal yang sebenarnya saling melengkapi.

        Jika suatu pasangan hanyalah tantangan implementasi atau bisa diselesaikan bersamaan, JANGAN masukkan ke daftar.
        Bila tidak ada kontradiksi nyata, kembalikan "contradictions": [].

        Balas HANYA JSON valid:
        { "contradictions": [ { "requirement_a": string, "requirement_b": string, "explanation": string } ] }
        Bahasa Indonesia.
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
          "business_rules": string[],
          "user_stories": string[],
          "acceptance_criteria": string[],
          "mvp_scope": string[],
          "later_scope": string[],
          "data_entities": string[],
          "edge_cases": string[],
          "constraints": string[],
          "open_questions": string[]
        }
        Pertahankan field yang sudah ada; perbarui/hambah hanya yang terpengaruh masukan baru.
        Setiap field berupa daftar tetap ditulis sebagai poin-poin, bukan paragraf.
        SYS;

        $user = "[MODE:revise]\n[PROMPT:{$instruction}]\n{$context}[PRD:{$prdText}]";

        return $this->normalize($this->ask('revise', $system, $user), $instruction, $prd);
    }

    /**
     * Normalisasi bentuk PRD agar field yang dibutuhkan frontend selalu ada.
     *
     * Model LLM kadang tidak mengembalikan seluruh field yang diminta
     * (terutama untuk ide yang sederhana/statis seperti web profil). Bila
     * field turunan kosong, kita isi lewat derivasi dari field lain yang sudah
     * ada, sehingga dokumen tidak pernah tampil setengah kosong untuk jenis
     * aplikasi apa pun.
     */
    /**
     * Bersihkan teks dari artefak keluaran model: karakter CJK/Han yang
     * kadang menyelip (mis. "跟进") dan spasi berlebih. Teks Latin/Indonesia
     * (termasuk aksen) tetap dipertahankan.
     */
    private function cleanText(string $text): string
    {
        // Buang blok CJK (Chinese/Japanese/Korean) bila muncul di tengah teks Latin.
        $text = preg_replace('/[\x{4E00}-\x{9FFF}\x{3040}-\x{30FF}\x{AC00}-\x{D7AF}]+/u', '', $text);
        // Rapikan spasi ganda sisa pembersihan.
        $text = preg_replace('/\s{2,}/u', ' ', $text);

        return trim($text);
    }

    private function normalize(array $data, string $fallbackPrompt, ?array $base = null): array
    {
        $base ??= [];
        $strings = fn ($value) => array_values(array_filter(array_map(
            fn ($item) => is_string($item) ? $this->cleanText($item) : $this->cleanText(trim(json_encode($item))),
            (array) $value
        ), fn ($item) => $item !== ''));

        $title = $this->cleanText((string) ($data['title'] ?? $base['title'] ?? 'Proyek Baru'));
        $background = $this->cleanText((string) ($data['background'] ?? $base['background'] ?? ''));
        $objectives = $strings($data['objectives'] ?? $base['objectives'] ?? []);
        $targetUsers = $strings($data['target_users'] ?? $base['target_users'] ?? []);
        $functional = $strings($data['functional_requirements'] ?? $base['functional_requirements'] ?? []);
        $nonFunctional = $strings($data['non_functional_requirements'] ?? $base['non_functional_requirements'] ?? []);
        $constraints = $strings($data['constraints'] ?? $base['constraints'] ?? []);
        $openQuestions = $strings($data['open_questions'] ?? $base['open_questions'] ?? []);

        $businessRules = $strings($data['business_rules'] ?? $base['business_rules'] ?? []);
        $userStories = $strings($data['user_stories'] ?? $base['user_stories'] ?? []);
        $acceptance = $strings($data['acceptance_criteria'] ?? $base['acceptance_criteria'] ?? []);
        $mvp = $strings($data['mvp_scope'] ?? $base['mvp_scope'] ?? []);
        $later = $strings($data['later_scope'] ?? $base['later_scope'] ?? []);
        $entities = $strings($data['data_entities'] ?? $base['data_entities'] ?? []);
        $edges = $strings($data['edge_cases'] ?? $base['edge_cases'] ?? []);

        // --- Derivasi bila model tidak mengisi field turunan (jaminan general) ---

        if (! $userStories) {
            $roles = $targetUsers ?: ['pengguna'];
            $userStories = array_map(
                fn ($role) => 'Sebagai '.rtrim($role, '. ').', saya ingin memakai '.$title.' sesuai kebutuhan saya, agar pekerjaan menjadi lebih mudah.',
                array_slice($roles, 0, 3)
            );
        }

        if (! $mvp) {
            $mvp = $functional ?: $objectives;
        }

        if (! $acceptance) {
            $acceptance = [
                'Semua kebutuhan fungsional utama dapat dijalankan tanpa error pada alur normal.',
                'Input tidak valid ditolak dengan pesan yang jelas dalam Bahasa Indonesia.',
                'Informasi yang ditampilkan sesuai dengan data yang tersimpan.',
            ];
        }

        if (! $businessRules) {
            $businessRules = [
                'Setiap perubahan data harus disimpan beserta waktu pembuatannya.',
                'Operasi yang bergantung pada data pengguna wajib memeriksa kepemilikan/kewenangan data tersebut.',
                'Input yang tidak valid harus ditolak dengan pesan yang jelas.',
            ];
            foreach ($constraints as $c) {
                $lower = mb_strtolower($c);
                if (str_contains($lower, 'tidak ada login') || str_contains($lower, 'tanpa login')) {
                    $businessRules[] = 'Halaman publik dapat diakses tanpa login.';
                }
                if (str_contains($lower, 'statis') || str_contains($lower, 'manual')) {
                    $businessRules[] = 'Konten diperbarui secara manual oleh pengelola.';
                }
            }
        }

        if (! $entities) {
            $entities = [
                'Konten/entri utama: judul, isi/deskripsi, media (bila ada).',
                'Kategori/tag: pengelompokan konten untuk navigasi.',
            ];
            foreach ($functional as $f) {
                $lower = mb_strtolower($f);
                if (str_contains($lower, 'kontak') || str_contains($lower, 'formulir')) {
                    $entities[] = 'Pesan kontak: nama, email, isi pesan, waktu masuk.';
                    break;
                }
            }
        }

        if (! $edges) {
            $edges = [
                'Konten yang diminta tidak ditemukan.',
                'Pengguna mengirim input kosong atau hanya spasi.',
                'Gambar/media gagal dimuat.',
            ];
        }

        if (! $later) {
            $later = $openQuestions;
        }

        return [
            'title' => $title,
            'background' => $background,
            'objectives' => $objectives,
            'target_users' => $targetUsers,
            'functional_requirements' => $functional,
            'non_functional_requirements' => $nonFunctional,
            'business_rules' => $businessRules,
            'user_stories' => $userStories,
            'acceptance_criteria' => $acceptance,
            'mvp_scope' => $mvp,
            'later_scope' => $later,
            'data_entities' => $entities,
            'edge_cases' => $edges,
            'constraints' => $constraints,
            'open_questions' => $openQuestions,
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

        return array_slice($out, 0, 1);
    }

    private function normalizeContradictions(array $items): array
    {
        $out = [];
        foreach ($items as $item) {
            $a = trim((string) ($item['requirement_a'] ?? $item['a'] ?? ''));
            $b = trim((string) ($item['requirement_b'] ?? $item['b'] ?? ''));
            $explanation = trim((string) ($item['explanation'] ?? 'Kedua requirement saling bertentangan.'));

            if ($a === '' || $b === '') {
                continue;
            }

            // Saring false positive: model kadang tetap mengembalikan pasangan
            // yang isinya sendiri menyatakan BUKAN kontradiksi (mis. "tidak ada
            // kontradiksi, hanya tantangan implementasi"). Jangan ditampilkan.
            if ($this->looksLikeNonContradiction($explanation)) {
                continue;
            }

            // Kode stabil untuk deduplikasi lintas-versi. Dibuat dari kata
            // kunci signifikan (bukan teks penuh), supaya revisi kecil seperti
            // penambahan "(opsi B)" tidak dianggap kontradiksi baru.
            $code = 'c_'.substr(md5($this->contradictionFingerprint($a).'|'.$this->contradictionFingerprint($b)), 0, 12);

            $out[] = [
                'code' => $code,
                'requirement_a' => $a,
                'requirement_b' => $b,
                'explanation' => $explanation,
            ];
        }

        return $out;
    }

    /**
     * Deteksi kalimat penjelasan yang justru menyangkal adanya kontradiksi.
     */
    private function looksLikeNonContradiction(string $explanation): bool
    {
        $text = mb_strtolower($explanation);

        return (bool) preg_match(
            '/(tidak (ada|terdapat|menemukan) kontradiksi|bukan kontradiksi|bukan pertentangan|no contradiction|tidak saling bertentangan|saling melengkapi|hanya tantangan)/u',
            $text
        );
    }

    /**
     * Kata kunci signifikan dari sebuah teks requirement (huruf kecil, tanpa
     * stopword/isi kurung/tanda baca) — dasar untuk menyidik duplikasi.
     *
     * @return string[]
     */
    public function contradictionKeywords(string $text): array
    {
        $clean = mb_strtolower($text);
        $clean = preg_replace('/\([^)]*\)/u', ' ', $clean);
        $clean = preg_replace('/[^a-z0-9\s]/u', ' ', $clean);
        $clean = preg_replace('/\s+/', ' ', trim($clean));

        $stopwords = ['harus', 'wajib', 'dapat', 'bisa', 'akan', 'dan', 'atau', 'yang', 'untuk', 'pada', 'di', 'ke', 'dengan', 'dalam', 'adalah', 'selesai', 'secara', 'the', 'a', 'an', 'of', 'to', 'and', 'or', 'ini', 'itu', 'juga'];

        return array_values(array_filter(
            array_unique(explode(' ', $clean)),
            fn ($w) => $w !== '' && ! in_array($w, $stopwords, true)
        ));
    }

    /**
     * Sidik jari teks requirement berbasis kata kunci inti. Revisi kecil yang
     * hanya menambah/mengurangi kata umum menghasilkan fingerprint sama.
     */
    private function contradictionFingerprint(string $text): string
    {
        $words = array_slice($this->contradictionKeywords($text), 0, 6);

        return implode(' ', $words) ?: 'unknown';
    }

    private function prdToText(array $prd): string
    {
        $lines = [];
        if (! empty($prd['title'])) {
            $lines[] = 'TITLE: '.$prd['title'];
        }
        if (! empty($prd['source_prompt'])) {
            $lines[] = 'IDE AWAL PENGGUNA: '.$prd['source_prompt'];
        }
        foreach (['background', 'objectives', 'target_users', 'functional_requirements', 'non_functional_requirements', 'business_rules', 'user_stories', 'acceptance_criteria', 'mvp_scope', 'later_scope', 'data_entities', 'edge_cases', 'constraints'] as $key) {
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
