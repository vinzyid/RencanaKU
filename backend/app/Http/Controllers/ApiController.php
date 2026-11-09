<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessProjectMessage;
use App\Models\AmbiguityFlag;
use App\Models\ContradictionFlag;
use App\Models\PrdVersion;
use App\Models\Project;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\Ai\PrdDiff;
use App\Services\Ai\PrdGenerator;
use App\Services\ProjectFlow;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

class ApiController extends Controller
{
    public function __construct(
        private readonly PrdGenerator $generator,
        private readonly PrdDiff $diff,
        private readonly ProjectFlow $flow,
    ) {}

    // ---------------------------------------------------------------------
    // Auth (Laravel Sanctum, token-based)
    // ---------------------------------------------------------------------

    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'remember' => 'sometimes|boolean',
        ]);

        $remember = $request->boolean('remember');
        unset($data['remember']);

        // Pendaftaran manual TIDAK pernah memberi role admin, walau emailnya
        // ada di ADMIN_EMAILS: kepemilikan email belum terbukti, sehingga siapa
        // pun bisa mendaftar duluan memakai email admin. Role admin baru
        // disinkronkan setelah email terbukti (login Google/GitHub atau reset
        // kata sandi lewat tautan email).
        $data['role'] = User::ROLE_USER;

        $user = User::create($data);

        return $this->tokenResponse($user, 201, $remember);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'remember' => 'sometimes|boolean',
        ]);
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Akun OAuth yang belum pernah mengeset kata sandi tidak akan pernah
            // cocok di sini. Beri arahan jelas: pakai tombol Google, atau buat
            // kata sandi lewat "Lupa password".
            if ($user && ! $user->hasPassword() && in_array($user->auth_provider, ['google', 'github'], true)) {
                $provider = ucfirst($user->auth_provider);

                return response()->json([
                    'message' => "Akun ini terdaftar lewat {$provider}. Masuk dengan tombol {$provider}, atau klik \"Lupa password\" untuk membuat kata sandi baru.",
                ], 422);
            }

            return response()->json(['message' => 'Email atau password salah.'], 422);
        }

        return $this->tokenResponse($user, 200, $request->boolean('remember'));
    }

    /**
     * Kirim tautan atur ulang kata sandi ke email user.
     *
     * Berlaku untuk akun manual maupun OAuth: akun Google/GitHub yang belum
     * punya kata sandi terpakai bisa memakai alur ini untuk membuat kata sandi
     * pertamanya, sehingga selanjutnya bisa masuk manual.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(
            ['email' => 'required|email'],
            ['email.required' => 'Email wajib diisi.', 'email.email' => 'Format email tidak valid.']
        );

        // Broker Laravel menyimpan token di tabel password_reset_tokens lalu
        // memicu User::sendPasswordResetNotification (lihat notifikasi kustom).
        $status = Password::broker()->sendResetLink(['email' => $data['email']]);

        if ($status === Password::RESET_THROTTLED) {
            return response()->json([
                'message' => 'Permintaan atur ulang baru saja dikirim. Silakan tunggu sebentar sebelum mencoba lagi.',
            ], 429);
        }

        // Jangan ungkap apakah email terdaftar atau tidak (anti user-enumeration).
        return response()->json([
            'message' => 'Jika email tersebut terdaftar, kami telah mengirim tautan atur ulang kata sandi. Silakan cek kotak masuk (dan folder spam).',
        ]);
    }

    /**
     * Setel ulang kata sandi memakai token dari email.
     */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ], [
            'token.required' => 'Token atur ulang tidak ditemukan.',
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ]);

        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                // Reset lewat tautan email membuktikan user memiliki email ini,
                // jadi email ditandai terverifikasi dan role disinkronkan dengan
                // ADMIN_EMAILS (jalur sah admin yang mendaftar manual). Admin yang
                // sudah ada tidak diturunkan di sini.
                $user->forceFill([
                    'password' => $password,
                    'password_set_at' => now(),
                    'remember_token' => Str::random(60),
                    'email_verified_at' => $user->email_verified_at ?? now(),
                    'role' => $user->isAdmin() ? User::ROLE_ADMIN : User::roleForEmail($user->email),
                ])->save();

                // Cabut seluruh token lama: sesi/perangkat sebelumnya logout.
                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Kata sandi berhasil diatur ulang. Silakan masuk dengan kata sandi baru Anda.',
            ]);
        }

        return response()->json(['message' => $this->passwordStatusMessage($status)], 422);
    }

    /**
     * Ganti / setel kata sandi dari halaman Pengaturan (user sudah login).
     *
     * Kata sandi lama hanya diwajibkan bila akun sudah punya kata sandi terpakai.
     * Akun OAuth yang belum pernah mengeset kata sandi boleh langsung mengeset.
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => [$user->hasPassword() ? 'required' : 'nullable', 'string'],
            'password' => 'required|string|min:8|confirmed',
        ], [
            'current_password.required' => 'Kata sandi lama wajib diisi.',
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.min' => 'Kata sandi minimal 8 karakter.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ]);

        if ($user->hasPassword() && ! Hash::check((string) $data['current_password'], $user->password)) {
            return response()->json(['message' => 'Kata sandi lama tidak sesuai.'], 422);
        }

        $user->forceFill([
            'password' => $data['password'],
            'password_set_at' => now(),
        ])->save();

        // Cabut token lain agar perangkat lain ikut logout (token sesi ini tetap).
        if ($current = $user->currentAccessToken()) {
            $user->tokens()->whereKeyNot($current->getKey())->delete();
        }

        return response()->json([
            'message' => 'Kata sandi berhasil diperbarui.',
            'user' => UserResource::make($user->fresh()),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil logout.']);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => UserResource::make($request->user())]);
    }

    // ---------------------------------------------------------------------
    // Projects
    // ---------------------------------------------------------------------

    public function projects(Request $request)
    {
        $projects = $request->user()->projects()
            ->with(['prdVersions' => fn ($q) => $q->latest('version_number')])
            ->withCount('messages')
            ->latest()
            ->get()
            ->map(fn (Project $project) => $this->projectSummary($project));

        return response()->json(['projects' => $projects]);
    }

    public function createProject(Request $request)
    {
        // Membuat proyek = membuka thread chat baru. Prompt awal bersifat opsional
        // (UI fase Input Ide mengirim pesan terpisah lewat /messages), tapi kalau
        // dikirim sekaligus kita proses langsung jadi draft PRD.
        $data = $request->validate([
            'title' => 'nullable|string|max:160',
            'prompt' => 'nullable|string|min:10',
        ]);

        $project = $request->user()->projects()->create([
            'title' => $data['title'] ?? null ?: 'Proyek Baru',
        ]);

        if (! empty($data['prompt'])) {
            $this->dispatchProcessing($project, $data['prompt']);
        }

        return response()->json($this->projectPayload($project), 201);
    }

    public function showProject(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);

        return response()->json($this->projectPayload($project));
    }

    public function renameProject(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);
        $project->update($request->validate(['title' => 'required|string|max:160']));

        return response()->json(['project' => $project]);
    }

    public function deleteProject(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);
        $project->delete();

        return response()->json(['message' => 'Proyek dihapus.']);
    }

    // ---------------------------------------------------------------------
    // Chat thread (satu endpoint untuk semua jenis input user)
    // ---------------------------------------------------------------------

    public function messages(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);

        return response()->json(['messages' => $this->threadPayload($project)]);
    }

    public function sendMessage(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);

        $data = $request->validate([
            'content' => 'required|string|min:1|max:5000',
        ]);

        $this->dispatchProcessing($project, trim($data['content']));

        return response()->json($this->projectPayload($project), 202);
    }

    // ---------------------------------------------------------------------
    // Versioning, finalize, export
    // ---------------------------------------------------------------------

    public function versions(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);

        $versions = $project->prdVersions()->orderBy('version_number')->get();
        $result = [];

        foreach ($versions as $index => $version) {
            $previous = $index > 0 ? $versions[$index - 1] : null;
            $result[] = [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'status' => $version->status,
                'ai_provider' => $version->ai_provider,
                'created_at' => $version->created_at,
                'content' => $version->decodedContent(),
                'diff' => $previous
                    ? $this->diff->compareWithCache(
                        $previous->decodedContent(),
                        $version->decodedContent(),
                        $previous->id,
                        $version->id,
                    )
                    : [],
            ];
        }

        return response()->json(['versions' => array_reverse($result)]);
    }

    public function finalize(Request $request, Project $project)
    {
        $this->authorizeProject($request, $project);

        $version = $project->prdVersions()->latest('version_number')->first();

        if (! $version) {
            return response()->json(['message' => 'Belum ada PRD untuk difinalisasi.'], 422);
        }

        $blocking = $this->flow->blockingIssues($version);

        if ($blocking['ambiguities'] > 0 || $blocking['contradictions'] > 0) {
            return response()->json([
                'message' => 'Selesaikan semua ambiguitas dan kontradiksi sebelum finalisasi.',
                'ambiguities' => $blocking['ambiguities'],
                'contradictions' => $blocking['contradictions'],
            ], 422);
        }

        $version->update(['status' => 'finalized']);

        return response()->json($this->projectPayload($project));
    }

    public function export(Request $request, Project $project, string $format)
    {
        $this->authorizeProject($request, $project);

        abort_unless(in_array($format, ['md', 'json', 'pdf'], true), 404, 'Format tidak didukung.');

        $version = $project->prdVersions()->latest('version_number')->first();
        abort_if(! $version, 422, 'Belum ada PRD untuk diexport.');
        abort_unless($version->status === 'finalized', 422, 'Finalisasi PRD sebelum mengunduh.');

        $content = $version->decodedContent();
        $slug = $this->slug($project->title);

        if ($format === 'json') {
            return response()->json($content, 200, [
                'Content-Disposition' => "attachment; filename=\"{$slug}.json\"",
            ]);
        }

        if ($format === 'pdf') {
            return $this->exportPdf($project, $content);
        }

        return response($this->markdown($project, $version, $content), 200, [
            'Content-Type' => 'text/markdown; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$slug}.md\"",
        ]);
    }

    // ---------------------------------------------------------------------
    // Core: chat processing driven by project state machine
    // ---------------------------------------------------------------------

    /**
     * Proses satu pesan user, tentukan konteks berdasarkan state proyek,
     * panggil AI yang sesuai, simpan versi PRD baru, dan hasilkan balasan AI
     * (dengan quick-reply chip bila relevan).
     *
     * Dua tahap terpisah:
     *  1. planTurn()   — membaca state & memanggil AI, DI LUAR transaksi DB.
     *                    Panggilan AI bisa puluhan detik; menahannya di dalam
     *                    transaksi berarti mengunci baris proyek & koneksi DB
     *                    selama itu, dan catatan pemakaian token ikut
     *                    ter-rollback bila ada langkah yang gagal.
     *  2. commitTurn() — menulis semua hasil dalam SATU transaksi singkat
     *                    (Masalah #7): bila gagal, tidak ada state setengah
     *                    jadi seperti pesan user tanpa balasan AI.
     *
     * Bila ada pesan lain yang lebih dulu tersimpan selama AI bekerja (versi
     * terbaru berubah), hasil AI dibuang dan giliran diproses ulang dari state
     * terbaru agar versi tidak saling menimpa.
     *
     * Metode ini bersifat publik karena dipanggil dari background job
     * ProcessProjectMessage (Opsi 3 - queue), bukan langsung dari request HTTP.
     */
    public function processUserMessage(Project $project, string $content): void
    {
        // Semua pemakaian token dalam alur ini diatribusikan ke user & proyek.
        $this->generator->setContext($project->user_id, $project->id);

        for ($attempt = 1; $attempt <= self::TURN_ATTEMPTS; $attempt++) {
            $plan = $this->planTurn($project, $content);

            if ($this->commitTurn($project, $content, $plan)) {
                return;
            }
        }

        throw new \RuntimeException('Proyek berubah terus saat pesan diproses. Silakan kirim ulang.');
    }

    /**
     * Batas jumlah pertanyaan klarifikasi yang ditanyakan satu per satu
     * (Masalah #4, Solution A). Setelah batas ini, sisa pertanyaan diisi
     * asumsi wajar dan disebutkan secara terbuka kepada user.
     */
    private const MAX_CLARIFICATION_QUESTIONS = 5;

    /**
     * Batas putaran kontradiksi. Setelah melewati batas ini, sisa kontradiksi
     * dianggap selesai agar alur tidak berputar tanpa henti (sebelumnya
     * kontradiksi tidak punya batas, sehingga bisa terjadi loop tak berujung).
     */
    private const MAX_CONTRADICTION_ROUNDS = 3;

    /** Percobaan ulang transaksi saat deadlock (deteksi otomatis oleh Laravel). */
    private const DB_TRANSACTION_ATTEMPTS = 3;

    /** Percobaan ulang satu giliran bila proyek berubah selama AI bekerja. */
    private const TURN_ATTEMPTS = 2;

    private const ASSUMED_ANSWER = 'Diasumsikan wajar oleh sistem.';

    private const CONTRADICTION_CHIPS = ['Pakai A', 'Pakai B', 'Saya revisi manual'];

    /**
     * Tahap 1: baca state proyek lalu panggil AI. Tidak menulis apa pun ke DB
     * (selain catatan pemakaian token oleh AiGateway, yang memang harus tetap
     * tersimpan walau langkah berikutnya gagal).
     */
    private function planTurn(Project $project, string $content): array
    {
        $latest = $project->prdVersions()->latest('version_number')->first();

        $plan = [
            'base_version_id' => $latest?->id,
            'mode' => 'revision',
            'ambiguity_id' => null,
            'contradiction_id' => null,
            'resolution' => null,
        ];

        if (! $latest) {
            // STATE: belum ada PRD sama sekali -> generate draft pertama.
            $plan['mode'] = 'initial';
            $plan['prd'] = $this->generator->generate($content);
        } elseif ($ambiguity = $latest->ambiguityFlags()->where('is_resolved', false)->orderBy('id')->first()) {
            // STATE: ada pertanyaan klarifikasi yang sedang ditanyakan -> ini jawabannya.
            $plan['mode'] = 'ambiguity';
            $plan['ambiguity_id'] = $ambiguity->id;
            $plan['prd'] = $this->generator->revise($latest->decodedContent(), $content, $ambiguity->question);
        } elseif ($contradiction = $latest->contradictionFlags()->whereNull('resolution')->orderBy('id')->first()) {
            // STATE: ada kontradiksi yang sedang ditanyakan -> ini resolusinya.
            $plan['mode'] = 'contradiction';
            $plan['contradiction_id'] = $contradiction->id;
            $plan['resolution'] = $this->flow->interpretResolution($content);
            $instruction = "Selesaikan kontradiksi antara '{$contradiction->requirement_a}' dan '{$contradiction->requirement_b}'. Keputusan pengguna: {$content}.";
            $plan['prd'] = $this->generator->revise($latest->decodedContent(), $instruction);
        } else {
            // STATE: draft sudah bersih -> ini revisi bebas (tahap Dokumentasi).
            $plan['prd'] = $this->generator->revise($latest->decodedContent(), $content);
        }

        // Ambil provider sekarang: panggilan deteksi di bawah akan menimpanya.
        $plan['provider'] = $this->generator->provider();
        $plan['ambiguities'] = $this->generator->detectAmbiguities($plan['prd']);
        $plan['contradictions'] = $this->generator->detectContradictions($plan['prd']);

        return $plan;
    }

    /**
     * Tahap 2: tulis seluruh hasil giliran dalam satu transaksi singkat.
     * Mengembalikan false bila proyek berubah selama AI bekerja.
     */
    private function commitTurn(Project $project, string $content, array $plan): bool
    {
        return DB::transaction(function () use ($project, $content, $plan) {
            // Kunci proyek: serialisasi penulisan pada proyek yang sama.
            Project::whereKey($project->id)->lockForUpdate()->first();

            $latest = $project->prdVersions()->latest('version_number')->first();

            if ($latest?->id !== $plan['base_version_id']) {
                return false;
            }

            $project->messages()->create(['sender' => 'user', 'content' => $content]);

            // Catat jawaban HANYA untuk pertanyaan/kontradiksi yang sedang ditanyakan.
            if ($plan['ambiguity_id']) {
                AmbiguityFlag::whereKey($plan['ambiguity_id'])->update([
                    'is_resolved' => true,
                    'resolution_answer' => $content,
                ]);
            }

            if ($plan['contradiction_id']) {
                ContradictionFlag::whereKey($plan['contradiction_id'])->update(['resolution' => $plan['resolution']]);
            }

            $version = $this->newVersion($project, $plan['prd'], $plan['provider']);

            if ($plan['mode'] === 'initial' && ($project->title === 'Proyek Baru' || $project->title === '')) {
                $project->update(['title' => $plan['prd']['title']]);
            }

            // Pertanyaan & kontradiksi yang belum selesai ikut pindah ke versi
            // baru, sehingga tidak ada yang hilang diam-diam.
            if ($latest) {
                $this->carryOverOpenFlags($latest, $version);
            }

            $this->storeDetectedFlags($version, $plan['ambiguities'], $plan['contradictions']);

            $notes = [];

            if ($plan['mode'] === 'revision') {
                // Revisi bebas tidak memicu interogasi baru: pertanyaan yang muncul
                // dari revisi dianggap sudah terjawab agar alur tetap sederhana & cepat.
                $this->assumeOpenAmbiguities($version);
            } elseif ($this->answeredClarifications($project) >= self::MAX_CLARIFICATION_QUESTIONS) {
                $assumed = $this->assumeOpenAmbiguities($version);
                if ($assumed !== []) {
                    $notes[] = "Supaya tidak terlalu banyak pertanyaan, hal berikut saya isi dengan asumsi wajar (bisa kamu revisi kapan saja):\n".collect($assumed)->map(fn ($q) => "• {$q}")->implode("\n");
                }
            }

            if ($this->answeredContradictions($project) >= self::MAX_CONTRADICTION_ROUNDS) {
                if ($this->autoResolveOpenContradictions($version) > 0) {
                    $notes[] = 'Kontradiksi yang tersisa saya anggap selesai agar alur tidak berputar terus. Kamu tetap bisa merevisinya manual.';
                }
            }

            $lead = match ($plan['mode']) {
                'initial' => "Draft PRD v{$version->version_number} sudah saya susun.",
                'ambiguity' => "Terima kasih, sudah saya catat. PRD diperbarui ke v{$version->version_number}.",
                'contradiction' => "Kontradiksi sudah saya selesaikan sesuai pilihanmu. PRD kini v{$version->version_number}.",
                default => "Revisi diterapkan ke v{$version->version_number}.",
            };

            $this->presentNextStep($project, $version, $plan['mode'], $lead, $notes);

            return true;
        }, self::DB_TRANSACTION_ATTEMPTS);
    }

    /**
     * Buat balasan AI berikutnya: tanyakan SATU pertanyaan klarifikasi yang
     * tersisa, atau satu kontradiksi, atau nyatakan PRD siap difinalisasi.
     */
    private function presentNextStep(Project $project, PrdVersion $version, string $mode, string $lead, array $notes): void
    {
        $intro = implode("\n\n", array_filter([$lead, ...$notes]));

        $openQuestions = $version->ambiguityFlags()->where('is_resolved', false)->orderBy('id')->get();

        if ($openQuestions->isNotEmpty()) {
            $question = $openQuestions->first();
            $number = $this->answeredClarifications($project) + 1;
            $total = $number + $openQuestions->count() - 1;
            $options = collect($question->options ?? [])->filter()->values()->all();
            $optionText = $options ? "\n".collect($options)->map(fn ($o) => "   • {$o}")->implode("\n") : '';
            $prefix = match (true) {
                $mode !== 'initial' => 'Pertanyaan berikutnya:',
                $openQuestions->count() === 1 => 'Biar hasilnya pas, ada 1 hal yang perlu saya pastikan:',
                default => "Biar hasilnya pas, ada {$openQuestions->count()} hal yang perlu saya pastikan. Saya tanyakan satu per satu ya.",
            };

            $project->messages()->create([
                'sender' => 'ai',
                'content' => "{$intro}\n\n{$prefix}\n\n({$number}/{$total}) {$question->question}{$optionText}",
                'quick_replies' => $options ?: null,
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        $contradiction = $version->contradictionFlags()->whereNull('resolution')->orderBy('id')->first();

        if ($contradiction) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "{$intro}\n\nSaya menemukan requirement yang saling bertentangan:\n\nA) {$contradiction->requirement_a}\nB) {$contradiction->requirement_b}".($contradiction->explanation ? "\n\n{$contradiction->explanation}" : ''),
                'quick_replies' => self::CONTRADICTION_CHIPS,
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        $project->messages()->create([
            'sender' => 'ai',
            'content' => "{$intro}\n\nPRD sudah konsisten dan siap difinalisasi. Klik Finalisasi di panel PRD, atau ketik revisi tambahan di sini.",
            'quick_replies' => ['Lihat dokumen lengkap'],
            'related_prd_version_id' => $version->id,
        ]);
    }

    /**
     * Pindahkan pertanyaan & kontradiksi yang belum selesai dari versi lama ke
     * versi baru (baris yang sama, bukan salinan), agar tetap ditanyakan dan
     * tidak tertinggal "yatim" di versi lama.
     */
    private function carryOverOpenFlags(PrdVersion $from, PrdVersion $to): void
    {
        AmbiguityFlag::where('prd_version_id', $from->id)
            ->where('is_resolved', false)
            ->update(['prd_version_id' => $to->id]);

        ContradictionFlag::where('prd_version_id', $from->id)
            ->whereNull('resolution')
            ->update(['prd_version_id' => $to->id]);
    }

    /**
     * Simpan hasil deteksi AI untuk versi baru. Ambiguitas/kontradiksi yang
     * sudah pernah muncul di proyek ini TIDAK dibuat ulang. Ini mencegah loop
     * tak berujung: begitu user menjawab, pertanyaan yang sama tidak muncul
     * lagi meski teks PRD masih memuat kata pemicunya.
     */
    private function storeDetectedFlags(PrdVersion $version, array $ambiguities, array $contradictions): void
    {
        $projectAmbiguities = AmbiguityFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $version->project_id));

        $knownAmbiguityCodes = (clone $projectAmbiguities)->pluck('code')->filter()->all();
        $seenAmbiguityTexts = (clone $projectAmbiguities)->pluck('question')
            ->map(fn ($q) => mb_strtolower(trim($q)))
            ->all();

        foreach ($ambiguities as $ambiguity) {
            $code = $ambiguity['key'] ?? null;
            $normalizedQuestion = mb_strtolower(trim($ambiguity['question']));

            // Sudah pernah ditanyakan (kode sama) atau teksnya sama -> lewati.
            if (($code && in_array($code, $knownAmbiguityCodes, true)) || in_array($normalizedQuestion, $seenAmbiguityTexts, true)) {
                continue;
            }

            $version->ambiguityFlags()->create([
                'code' => $code,
                'question' => $ambiguity['question'],
                'options' => $ambiguity['options'] ?? null,
                'is_resolved' => false,
            ]);

            $knownAmbiguityCodes[] = $code;
            $seenAmbiguityTexts[] = $normalizedQuestion;
        }

        $projectContradictions = ContradictionFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $version->project_id));

        $knownContradictionCodes = (clone $projectContradictions)->pluck('code')->filter()->all();
        $knownContradictions = (clone $projectContradictions)->get()
            ->map(fn ($c) => mb_strtolower($c->requirement_a.'||'.$c->requirement_b))
            ->all();

        foreach ($contradictions as $contradiction) {
            $code = $contradiction['code'] ?? null;
            $signature = mb_strtolower($contradiction['requirement_a'].'||'.$contradiction['requirement_b']);

            // Sudah pernah muncul (kode stabil sama) atau teks identik -> lewati.
            if (($code && in_array($code, $knownContradictionCodes, true)) || in_array($signature, $knownContradictions, true)) {
                continue;
            }

            $version->contradictionFlags()->create([
                'code' => $code,
                'requirement_a' => $contradiction['requirement_a'],
                'requirement_b' => $contradiction['requirement_b'],
                'explanation' => $contradiction['explanation'],
            ]);

            $knownContradictionCodes[] = $code;
            $knownContradictions[] = $signature;
        }
    }

    /**
     * Tandai pertanyaan yang belum terjawab di versi ini sebagai "diasumsikan
     * wajar". Mengembalikan daftar teks pertanyaan yang diasumsikan.
     */
    private function assumeOpenAmbiguities(PrdVersion $version): array
    {
        $open = $version->ambiguityFlags()->where('is_resolved', false)->orderBy('id')->get();

        $open->each(fn ($flag) => $flag->update([
            'is_resolved' => true,
            'resolution_answer' => self::ASSUMED_ANSWER,
        ]));

        return $open->pluck('question')->all();
    }

    /** Tandai kontradiksi yang tersisa di versi ini sebagai selesai otomatis. */
    private function autoResolveOpenContradictions(PrdVersion $version): int
    {
        return $version->contradictionFlags()->whereNull('resolution')->update(['resolution' => 'auto_resolved']);
    }

    /** Jumlah pertanyaan klarifikasi yang sudah dijawab user di proyek ini. */
    private function answeredClarifications(Project $project): int
    {
        return AmbiguityFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $project->id))
            ->where('is_resolved', true)
            ->where(fn ($q) => $q->whereNull('resolution_answer')->orWhere('resolution_answer', '!=', self::ASSUMED_ANSWER))
            ->count();
    }

    /** Jumlah kontradiksi yang sudah diputuskan user (bukan otomatis) di proyek ini. */
    private function answeredContradictions(Project $project): int
    {
        return ContradictionFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $project->id))
            ->whereNotNull('resolution')
            ->where('resolution', '!=', 'auto_resolved')
            ->count();
    }

    private function newVersion(Project $project, array $content, ?string $provider): PrdVersion
    {
        return DB::transaction(function () use ($project, $content, $provider) {
            $latestVersion = PrdVersion::where('project_id', $project->id)
                ->lockForUpdate()
                ->orderByDesc('version_number')
                ->first();

            $nextNumber = ($latestVersion?->version_number ?? 0) + 1;

            return $project->prdVersions()->create([
                'version_number' => $nextNumber,
                'content' => $content,
                'status' => 'draft',
                'ai_provider' => $provider ?? 'local',
            ]);
        }, self::DB_TRANSACTION_ATTEMPTS);
    }

    private function tokenResponse(User $user, int $status = 200, bool $remember = false)
    {
        $token = $user->issueSpaToken($remember);

        // Response user disanitasi lewat UserResource agar field "role" mentah
        // tidak bocor ke klien (Masalah #12).
        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user),
        ], $status);
    }

    /**
     * Terjemahkan status PasswordBroker menjadi pesan bahasa Indonesia.
     */
    private function passwordStatusMessage(string $status): string
    {
        return match ($status) {
            Password::INVALID_USER => 'Email tersebut tidak terdaftar.',
            Password::INVALID_TOKEN => 'Tautan atur ulang tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.',
            Password::RESET_THROTTLED => 'Terlalu banyak percobaan. Silakan coba lagi nanti.',
            default => 'Gagal mengatur ulang kata sandi. Silakan coba lagi.',
        };
    }

    private function authorizeProject(Request $request, Project $project): void
    {
        abort_unless($project->user_id === $request->user()->id, 404);
    }

    /**
     * Tandai proyek sedang diproses lalu jalankan pemrosesan pesan di
     * background job (Opsi 3 - queue). Request HTTP tidak menunggu AI.
     */
    private function dispatchProcessing(Project $project, string $content): void
    {
        $project->forceFill([
            'prd_status' => 'processing',
            'prd_error' => null,
        ])->save();

        ProcessProjectMessage::dispatch($project->id, $content);
    }

    /**
     * Payload lengkap proyek: thread chat + PRD terbaru + flag + versi + stage.
     */
    private function projectPayload(Project $project): array
    {
        $project->loadMissing('prdVersions');
        $versions = $project->prdVersions()->orderBy('version_number')->get();
        $latest = $versions->last();
        $previous = $versions->count() > 1 ? $versions->get($versions->count() - 2) : null;

        $summary = $this->projectSummary($project);

        return [
            'project' => $summary,
            'messages' => $this->threadPayload($project),
            'prd' => $latest ? $this->versionPayload($latest) : null,
            'diff' => ($latest && $previous)
                ? $this->diff->compare($previous->decodedContent(), $latest->decodedContent())
                : [],
            'stage' => $this->flow->stage($latest),
            'validation' => $latest ? $this->flow->validationSummary($latest) : [
                'ambiguities' => 0,
                'contradictions' => 0,
                'can_finalize' => false,
            ],
            'prd_status' => $project->prd_status ?? 'idle',
            'prd_error' => $project->prd_error,
        ];
    }

    private function projectSummary(Project $project): array
    {
        $latest = $project->relationLoaded('prdVersions')
            ? $project->prdVersions->sortByDesc('version_number')->first()
            : $project->prdVersions()->latest('version_number')->first();

        return [
            'id' => $project->id,
            'title' => $project->title,
            'created_at' => $project->created_at,
            'updated_at' => $project->updated_at,
            'message_count' => $project->messages_count ?? $project->messages()->count(),
            'latest_version' => $latest ? [
                'version_number' => $latest->version_number,
                'status' => $latest->status,
                'ai_provider' => $latest->ai_provider,
            ] : null,
            'stage' => $this->flow->stage($latest),
            'prd_status' => $project->prd_status ?? 'idle',
        ];
    }

    private function versionPayload(PrdVersion $version): array
    {
        return [
            'id' => $version->id,
            'version_number' => $version->version_number,
            'status' => $version->status,
            'ai_provider' => $version->ai_provider,
            'content' => $version->decodedContent(),
            'created_at' => $version->created_at,
            'ambiguity_flags' => $version->ambiguityFlags()->orderBy('id')->get(),
            'contradiction_flags' => $version->contradictionFlags()->orderBy('id')->get(),
        ];
    }

    private function threadPayload(Project $project): array
    {
        return $project->messages()
            ->orderBy('id')
            ->get()
            ->map(fn ($message) => [
                'id' => $message->id,
                'sender' => $message->sender,
                'content' => $message->content,
                'quick_replies' => $message->quick_replies,
                'related_prd_version_id' => $message->related_prd_version_id,
                'created_at' => $message->created_at,
            ])
            ->all();
    }

    private function markdown(Project $project, PrdVersion $version, array $content): string
    {
        $out = "# {$content['title']}\n\n";
        $out .= "> Status: {$version->status} · Versi {$version->version_number} · AI: {$version->ai_provider}\n\n";

        $labels = [
            'background' => 'Latar Belakang',
            'objectives' => 'Tujuan',
            'target_users' => 'Target User',
            'user_stories' => 'User Story',
            'functional_requirements' => 'Requirement Fungsional',
            'acceptance_criteria' => 'Kriteria Selesai (Acceptance Criteria)',
            'non_functional_requirements' => 'Requirement Non-Fungsional',
            'business_rules' => 'Aturan & Logika Bisnis',
            'mvp_scope' => 'Lingkup MVP',
            'later_scope' => 'Ditunda (Versi Berikutnya)',
            'data_entities' => 'Data yang Disimpan',
            'constraints' => 'Batasan',
            'edge_cases' => 'Kondisi Khusus (Edge Case)',
            'open_questions' => 'Pertanyaan Terbuka',
        ];

        foreach ($labels as $key => $label) {
            $value = $content[$key] ?? null;
            if (empty($value)) {
                continue;
            }
            $out .= "## {$label}\n";
            if (is_array($value)) {
                foreach ($value as $item) {
                    $out .= "- {$item}\n";
                }
            } else {
                $out .= "{$value}\n";
            }
            $out .= "\n";
        }

        return $out;
    }

    /**
     * Export PDF. Memakai DomPDF untuk menghasilkan berkas PDF valid
     * (Masalah #9). Tidak ada lagi HTML yang disamarkan sebagai PDF: bila
     * pembuatan gagal, respons berisi pesan jelas beserta alternatif format
     * markdown/json alih-alih berkas rusak.
     */
    private function exportPdf(Project $project, array $content)
    {
        $slug = $this->slug($project->title);

        try {
            $pdf = Pdf::loadView('exports.prd-pdf', [
                'project' => $project,
                'content' => $content,
            ])
                ->setPaper('a4', 'portrait')
                ->setOption('isRemoteEnabled', false)
                ->setOption('isHtml5ParserEnabled', true)
                ->setOption('defaultFont', 'DejaVu Sans');

            return $pdf->download("{$slug}.pdf");
        } catch (\Throwable $e) {
            Log::error('[Export.PDF] gagal membuat PDF', [
                'project_id' => $project->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Gagal membuat PDF. Silakan pakai format markdown atau JSON.',
                'alternatives' => [
                    ['format' => 'markdown', 'url' => "/api/projects/{$project->id}/export/md"],
                    ['format' => 'json', 'url' => "/api/projects/{$project->id}/export/json"],
                ],
            ], 500);
        }
    }

    private function slug(string $value): string
    {
        $slug = preg_replace('/[^A-Za-z0-9]+/', '-', $value);

        return trim($slug, '-') ?: 'rencanaku-prd';
    }
}
