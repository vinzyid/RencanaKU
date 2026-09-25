<?php

namespace App\Services\Ai;

use Illuminate\Support\Str;

/**
 * LocalPrdEngine: generator deterministik berbasis heuristik.
 *
 * Dipakai sebagai (a) fallback terakhir saat seluruh provider LLM gagal,
 * dan (b) generator cepat saat testing tanpa API key. Output-nya meniru
 * bentuk JSON yang sama dengan keluaran LLM agar kontrak data konsisten.
 */
class LocalPrdEngine
{
    /**
     * Entry point yang dipanggil AiGateway. Menerima user prompt (yang di
     * AiGateway diisi dengan instruksi ber-tag) dan mengembalikan array JSON.
     */
    public function respond(string $userPrompt): array
    {
        // Deteksi mode berdasar tag yang disisipkan oleh PrdGenerator.
        if (str_contains($userPrompt, '[MODE:ambiguity]')) {
            return ['ambiguities' => $this->detectAmbiguities($userPrompt)];
        }

        if (str_contains($userPrompt, '[MODE:contradiction]')) {
            return ['contradictions' => $this->detectContradictions($userPrompt)];
        }

        return $this->buildPrd($userPrompt);
    }

    public function buildPrd(string $prompt): array
    {
        $subject = $this->subject($prompt);
        $title = Str::title(Str::limit($this->stripTags($prompt), 70, ''));

        return [
            'title' => $title ?: 'Proyek Baru',
            'background' => "Solusi digital untuk {$subject}. Dokumen ini menyusun ide awal menjadi kebutuhan yang terstruktur, terukur, dan siap dieksekusi oleh tim maupun AI coding agent.",
            'objectives' => [
                "Merancang aplikasi {$subject} yang menyelesaikan masalah utama pengguna.",
                'Memastikan setiap kebutuhan terukur dan dapat diverifikasi.',
                'Menyediakan pengalaman penggunaan yang sederhana dan konsisten.',
            ],
            'target_users' => $this->targetUsers($prompt),
            'functional_requirements' => $this->functionalRequirements($prompt),
            'non_functional_requirements' => [
                'Antarmuka responsif dan dapat diakses dari perangkat desktop maupun mobile.',
                'Data pengguna terlindungi; akses tiap resource dibatasi berdasarkan kepemilikan akun.',
                'Waktu respons operasi utama maksimal 3 detik pada kondisi normal.',
                'Sistem tetap berfungsi (dengan pesan yang jelas) ketika layanan eksternal gagal.',
            ],
            'constraints' => [
                'Ruang lingkup berhenti pada dokumen kebutuhan (PRD), tidak mencakup pembangunan kode.',
                'Kualitas validasi bergantung pada model bahasa yang dipanggil.',
                'Satu proyek dimiliki oleh satu akun (tanpa kolaborasi real-time).',
            ],
            'open_questions' => $this->detectAmbiguities($prompt),
            'source_prompt' => $this->stripTags($prompt),
        ];
    }

    /**
     * Heuristik ambiguitas: cari kata samar / kebutuhan yang belum terukur.
     * Tiap pertanyaan punya `key` stabil agar bisa dideduplikasi terhadap
     * ambiguitas yang sudah pernah dijawab user.
     *
     * Pertanyaan ditulis dengan bahasa sehari-hari dan menyertakan pilihan
     * jawaban siap-klik agar ramah untuk pengguna awam.
     */
    public function detectAmbiguities(string $prompt): array
    {
        $questions = [];
        $text = mb_strtolower($this->stripTags($prompt));

        // key => [pola, pertanyaan, opsi jawaban]
        $rules = [
            'speed' => [
                '/(cepat|cepat sekali|real-?time|instan)/u',
                'Saat bilang "cepat", maksudnya seberapa cepat?',
                ['Langsung muncul (<1 detik)', 'Cukup cepat (<3 detik)', 'Tidak terlalu penting'],
            ],
            'scale' => [
                '/(banyak|banyak pengguna|user banyak|skala besar)/u',
                'Kira-kira berapa orang yang bakal pakai aplikasi ini?',
                ['Cuma saya sendiri', 'Sekitar 10-100 orang', 'Ratusan orang atau lebih'],
            ],
            'usability' => [
                '/(mudah|sederhana|simple|user ?friendly)/u',
                'Menurutmu, aplikasi ini sebaiknya seperti apa buat pengguna?',
                ['Sangat simpel, sekali klik', 'Cukup mudah dipahami', 'Boleh lengkap fiturnya'],
            ],
            'security' => [
                '/(aman|keamanan|secure|terlindungi)/u',
                'Seberapa penting keamanan data di aplikasi ini?',
                ['Biasa saja dulu', 'Penting (password & data aman)', 'Sangat ketat (data sensitif)'],
            ],
            'etc' => [
                '/(dll|dan sebagainya|lainnya|dsb)/u',
                'Tadi kamu sebut "dan lainnya" — fitur apa lagi yang kamu mau?',
                ['Belum kepikiran, bebas saja', 'Akan saya tulis di chat', 'Cukup yang sudah ada'],
            ],
            'report' => [
                '/(laporan|report|dashboard)/u',
                'Di bagian laporan/ringkasan, kamu mau lihat apa?',
                ['Sekadar total/ringkasan', 'Grafik sederhana', 'Detail lengkap semua data'],
            ],
            'payment' => [
                '/(bayar|pembayaran|payment|transaksi)/u',
                'Pembayarannya nanti pakai apa?',
                ['Belum perlu bayar', 'Transfer bank', 'E-wallet (OVO/GoPay/dll)'],
            ],
            'roles' => [
                '/(login|akun|auth)/u',
                'Siapa saja yang bakal punya akun di aplikasi ini?',
                ['Cuma saya sendiri', 'Ada admin & pengguna biasa', 'Banyak peran berbeda'],
            ],
        ];

        foreach ($rules as $key => [$pattern, $question, $options]) {
            if (preg_match($pattern, $text)) {
                $questions[] = [
                    'key' => $key,
                    'question' => $question,
                    'options' => $options,
                    'requirement_ref' => null,
                ];
            }
        }

        if (empty($questions)) {
            $questions[] = [
                'key' => 'general',
                'question' => 'Siapa yang bakal pakai aplikasi ini dan apa hasil paling penting yang kamu harapkan?',
                'options' => ['Untuk saya sendiri', 'Untuk teman/tim', 'Untuk pelanggan umum'],
                'requirement_ref' => null,
            ];
        }

        return array_slice($questions, 0, 2);
    }

    /**
     * Heuristik kontradiksi: pola aturan yang saling bertentangan.
     */
    public function detectContradictions(string $prompt): array
    {
        $clean = $this->stripTags($prompt);

        // Kontradiksi hanya dinilai dari ide awal pengguna (bila ada), agar
        // requirement generik yang kita buat sendiri tidak memicu false positive
        // (misal requirement "login" bawaan vs ide "tanpa login").
        if (preg_match('/IDE AWAL PENGGUNA:\s*(.+?)(?:\n|$)/u', $clean, $m)) {
            $clean = $m[1];
        }

        $text = mb_strtolower($clean);
        $found = [];

        // Pasangan (pola A, pola B, deskripsi A, deskripsi B, penjelasan).
        $pairs = [
            [
                '/tanpa (perlu )?login|tidak (perlu|harus) login|akses tanpa akun/u',
                '/harus login|wajib login|perlu login|login terlebih dahulu|autentikasi wajib/u',
                'Pengguna dapat mengakses fitur tanpa login.',
                'Pengguna harus login sebelum mengakses fitur.',
                'Dua aturan autentikasi ini berlawanan: satu membebaskan akses, satu mewajibkan login.',
            ],
            [
                '/\bgratis\b|tanpa biaya|\bfree\b|tidak berbayar/u',
                '/langganan|berbayar|subscription|premium|bayar untuk/u',
                'Aplikasi dapat digunakan secara gratis tanpa biaya.',
                'Aplikasi memerlukan langganan berbayar untuk fitur utama.',
                'Model gratis vs berlangganan tidak bisa keduanya menjadi ketentuan utama.',
            ],
            [
                '/\boffline\b|tanpa (koneksi )?internet|tanpa jaringan/u',
                '/real-?time|sinkron(isasi)? langsung|langsung dari server/u',
                'Aplikasi harus dapat digunakan tanpa koneksi internet (offline).',
                'Aplikasi menampilkan data secara real-time langsung dari server.',
                'Mode offline penuh dan real-time dari server saling tarik-menarik soal sumber kebenaran data.',
            ],
            [
                '/satu (akun|user|pengguna)|single user|hanya pemilik/u',
                '/multi ?user|banyak pengguna|kolaborasi|berbagi akun/u',
                'Aplikasi hanya digunakan oleh satu pengguna/pemilik.',
                'Aplikasi mendukung banyak pengguna/kolaborasi.',
                'Batasan jumlah pengguna tunggal bertentangan dengan kebutuhan multi-user.',
            ],
        ];

        foreach ($pairs as [$patternA, $patternB, $labelA, $labelB, $explanation]) {
            if (preg_match($patternA, $text) && preg_match($patternB, $text)) {
                $found[] = [
                    'requirement_a' => $labelA,
                    'requirement_b' => $labelB,
                    'explanation' => $explanation,
                ];
            }
        }

        return $found;
    }

    private function subject(string $prompt): string
    {
        $clean = $this->stripTags($prompt);
        $clean = preg_replace('/^(saya (mau|ingin|pengen)|buatkan|bikin|tolong buat)\s*/iu', '', $clean);
        $clean = Str::of($clean)->squish()->limit(90, '')->toString();

        return $clean !== '' ? 'untuk '.$clean : 'sesuai ide pengguna';
    }

    private function stripTags(string $prompt): string
    {
        // Buang penanda internal seperti [MODE:...] dan [PROMPT:...] / [PRD:...].
        $prompt = preg_replace('/\[MODE:\w+\]/i', '', $prompt);
        $prompt = preg_replace('/\[(?:PROMPT|PRD):([\s\S]*?)\]/i', '$1', $prompt);

        return trim($prompt);
    }

    private function targetUsers(string $prompt): array
    {
        $text = mb_strtolower($this->stripTags($prompt));
        $users = [];

        if (preg_match('/warung|toko|kasir|umkm|pedagang/u', $text)) {
            $users[] = 'Pemilik warung / pelaku UMKM sebagai pengelola utama.';
        }
        if (preg_match('/mahasiswa|kampus|kuliah/u', $text)) {
            $users[] = 'Mahasiswa sebagai pengguna utama.';
        }
        if (preg_match('/admin/u', $text)) {
            $users[] = 'Admin yang mengelola data dan pengguna.';
        }

        $users[] = 'Pengguna umum yang membutuhkan solusi sesuai ide awal.';

        return array_values(array_unique($users));
    }

    private function functionalRequirements(string $prompt): array
    {
        $text = mb_strtolower($this->stripTags($prompt));
        $reqs = ['Pengguna dapat membuat akun, login, dan mengelola profil.'];
        $reqs[] = 'Pengguna dapat membuat, melihat, mengubah, dan menghapus data utama aplikasi.';

        if (preg_match('/kasir|transaksi|jual|beli|penjualan/u', $text)) {
            $reqs[] = 'Sistem mencatat setiap transaksi penjualan beserta detail item dan totalnya.';
            $reqs[] = 'Sistem memperbarui stok secara otomatis setelah transaksi tercatat.';
        }
        if (preg_match('/laporan|report|ringkasan|dashboard/u', $text)) {
            $reqs[] = 'Sistem menampilkan laporan/ringkasan aktivitas dalam periode tertentu.';
        }
        if (preg_match('/notif|pemberitahuan|reminder|pengingat/u', $text)) {
            $reqs[] = 'Sistem mengirim notifikasi/pengingat untuk kejadian penting.';
        }

        $reqs[] = 'Sistem menyediakan validasi input dan umpan balik status pada setiap proses penting.';
        $reqs[] = 'Pengguna dapat menelusuri riwayat perubahan/aktivitas pada data mereka.';

        return array_values(array_unique($reqs));
    }
}
