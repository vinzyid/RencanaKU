<?php

namespace App\Http\Controllers;

use App\Models\AmbiguityFlag;
use App\Models\ContradictionFlag;
use App\Models\PrdVersion;
use App\Models\Project;
use App\Models\User;
use App\Services\Ai\PrdDiff;
use App\Services\Ai\PrdGenerator;
use App\Services\ProjectFlow;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

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
        ]);

        $data['role'] = User::roleForEmail($data['email']);

        $user = User::create($data);

        return $this->tokenResponse($user, 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate(['email' => 'required|email', 'password' => 'required|string']);
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Email atau password salah.'], 422);
        }

        return $this->tokenResponse($user);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Berhasil logout.']);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $request->user()]);
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
            $this->processUserMessage($project, $data['prompt']);
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

        $this->processUserMessage($project, trim($data['content']));

        return response()->json($this->projectPayload($project), 201);
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
     * panggil AI yang sesuai, simpan versi PRD bila berubah, dan hasilkan
     * balasan AI (dengan quick-reply chip bila relevan).
     *
     * Seluruh operasi tulis dibungkus satu transaksi database (Masalah #7):
     * bila salah satu langkah gagal, tidak ada state setengah jadi seperti
     * pesan user tersimpan tanpa balasan AI. Baris proyek dikunci
     * (lockForUpdate) agar pesan-pesan yang datang bersamaan diproses
     * berurutan, bukan saling menimpa versi.
     */
    private function processUserMessage(Project $project, string $content): void
    {
        // Semua pemakaian token dalam alur ini diatribusikan ke user & proyek.
        $this->generator->setContext($project->user_id, $project->id);

        DB::transaction(function () use ($project, $content) {
            // Kunci proyek: serialisasi pesan yang masuk bersamaan pada proyek
            // yang sama agar penomoran versi & flag tidak balapan.
            Project::whereKey($project->id)->lockForUpdate()->first();

            $project->messages()->create(['sender' => 'user', 'content' => $content]);

            $latest = $project->prdVersions()->latest('version_number')->first();

            // STATE: belum ada PRD sama sekali -> generate draft pertama.
            if (! $latest) {
                $this->handleInitialIdea($project, $content);

                return;
            }

            // STATE: ada ambiguitas belum terselesaikan -> ini jawaban klarifikasi.
            $pendingAmbiguity = $latest->ambiguityFlags()
                ->where('is_resolved', false)
                ->lockForUpdate()
                ->first();

            if ($pendingAmbiguity) {
                $this->handleAmbiguityAnswer($project, $latest, $pendingAmbiguity, $content);

                return;
            }

            // STATE: ada kontradiksi belum terselesaikan -> ini resolusi kontradiksi.
            $pendingContradiction = $latest->contradictionFlags()
                ->whereNull('resolution')
                ->lockForUpdate()
                ->first();

            if ($pendingContradiction) {
                $this->handleContradictionAnswer($project, $latest, $pendingContradiction, $content);

                return;
            }

            // STATE: draft sudah bersih -> ini revisi bebas (tahap Dokumentasi).
            $this->handleFreeRevision($project, $latest, $content);
        }, self::DB_TRANSACTION_ATTEMPTS);
    }

    private const MAX_CLARIFICATION_ROUNDS = 2;

    /** Percobaan ulang transaksi saat deadlock (deteksi otomatis oleh Laravel). */
    private const DB_TRANSACTION_ATTEMPTS = 3;

    private function handleInitialIdea(Project $project, string $content): void
    {
        $prd = $this->generator->generate($content);
        $version = $this->newVersion($project, $prd, $this->generator->provider());

        if ($project->title === 'Proyek Baru' || $project->title === '') {
            $project->update(['title' => $prd['title']]);
        }

        $this->refreshFlags($version);

        $questions = $version->ambiguityFlags()->where('is_resolved', false)->get();

        if ($questions->isNotEmpty()) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Draft PRD v{$version->version_number} sudah saya susun. Biar hasilnya pas, saya perlu tahu sedikit lagi:\n\n".$this->formatQuestions($questions),
                'quick_replies' => $this->flattenOptions($questions),
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        $project->messages()->create([
            'sender' => 'ai',
            'content' => "Draft PRD v{$version->version_number} sudah saya susun dan tidak ada pertanyaan tambahan. Saya mulai cek kontradiksi.",
            'quick_replies' => ['Lihat dokumen lengkap'],
            'related_prd_version_id' => $version->id,
        ]);
    }

    /**
     * Format daftar pertanyaan klarifikasi jadi satu pesan ringkas
     * (bukan satu pesan per pertanyaan) beserta pilihan jawaban.
     */
    private function formatQuestions(Collection $questions): string
    {
        return $questions->values()->map(function ($flag, $i) {
            $options = collect($flag->options ?? [])
                ->map(fn ($opt) => "   • {$opt}")
                ->implode("\n");

            return ($i + 1).'. '.$flag->question.($options !== '' ? "\n{$options}" : '');
        })->implode("\n\n");
    }

    /**
     * Kumpulkan semua opsi jawaban dari daftar pertanyaan menjadi chip
     * siap-klik, dibatasi agar tidak membanjiri antarmuka.
     */
    private function flattenOptions(Collection $questions): array
    {
        return $questions
            ->flatMap(fn ($flag) => $flag->options ?? [])
            ->filter()
            ->unique()
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * Menandai seluruh ambiguitas yang belum terjawab sebagai terselesaikan
     * dengan asumsi wajar, dipakai saat batas putaran klarifikasi tercapai
     * agar pengguna tidak ditanya tanpa henti.
     */
    private function resolveRemainingAmbiguities(PrdVersion $version): void
    {
        $version->ambiguityFlags()
            ->where('is_resolved', false)
            ->get()
            ->each(fn ($flag) => $flag->update([
                'is_resolved' => true,
                'resolution_answer' => 'Diasumsikan wajar oleh sistem.',
            ]));
    }

    /**
     * Berapa putaran klarifikasi yang sudah dilewati proyek ini.
     * Dihitung dari jumlah versi yang memiliki flag ambiguitas.
     */
    private function clarificationRounds(Project $project): int
    {
        return (int) $project->prdVersions()
            ->whereHas('ambiguityFlags')
            ->count();
    }

    private function handleAmbiguityAnswer(Project $project, PrdVersion $latest, AmbiguityFlag $flag, string $content): void
    {
        // Tandai HANYA pertanyaan spesifik ini yang terselesaikan dengan jawaban pengguna.
        $flag->update([
            'is_resolved' => true,
            'resolution_answer' => $content,
        ]);

        $revised = $this->generator->revise($latest->decodedContent(), $content, $flag->question);
        $version = $this->newVersion($project, $revised, $this->generator->provider());
        $this->refreshFlags($version);

        $rounds = $this->clarificationRounds($project);
        $remaining = $version->ambiguityFlags()->where('is_resolved', false)->get();

        // Batas putaran tercapai -> berhenti bertanya, pakai asumsi wajar.
        if ($remaining->isNotEmpty() && $rounds >= self::MAX_CLARIFICATION_ROUNDS) {
            $this->resolveRemainingAmbiguities($version);
            $remaining = collect();
        }

        $contradiction = $version->contradictionFlags()->whereNull('resolution')->first();

        if ($remaining->isNotEmpty()) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Terima kasih, sudah saya perbarui ke v{$version->version_number}.\n\nSedikit lagi ya:\n\n".$this->formatQuestions($remaining),
                'quick_replies' => $this->flattenOptions($remaining),
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        if ($contradiction) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Oke, sudah cukup jelas. PRD kini v{$version->version_number}. Lanjut ke validasi kontradiksi.\n\nSaya menemukan requirement yang saling bertentangan:\n\nA) {$contradiction->requirement_a}\nB) {$contradiction->requirement_b}\n\n{$contradiction->explanation}",
                'quick_replies' => ['Pakai A', 'Pakai B', 'Saya revisi manual'],
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        $project->messages()->create([
            'sender' => 'ai',
            'content' => "Sudah cukup, makasih! PRD v{$version->version_number} sudah konsisten dan siap difinalisasi. Kamu masih bisa mengetik revisi bebas kapan saja.",
            'quick_replies' => ['Lihat dokumen lengkap'],
            'related_prd_version_id' => $version->id,
        ]);
    }

    private function handleContradictionAnswer(Project $project, PrdVersion $latest, ContradictionFlag $flag, string $content): void
    {
        $resolution = $this->flow->interpretResolution($content);
        $flag->update(['resolution' => $resolution]);

        $instruction = "Selesaikan kontradiksi antara '{$flag->requirement_a}' dan '{$flag->requirement_b}'. Keputusan pengguna: {$content}.";
        $revised = $this->generator->revise($latest->decodedContent(), $instruction);
        $version = $this->newVersion($project, $revised, $this->generator->provider());
        $this->refreshFlags($version);

        $nextContradiction = $version->contradictionFlags()->whereNull('resolution')->first();

        if ($nextContradiction) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Kontradiksi diperbarui ke v{$version->version_number}. Masih ada satu lagi:\n\nA) {$nextContradiction->requirement_a}\nB) {$nextContradiction->requirement_b}",
                'quick_replies' => ['Pakai A', 'Pakai B', 'Saya revisi manual'],
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        $project->messages()->create([
            'sender' => 'ai',
            'content' => "Semua kontradiksi selesai. PRD v{$version->version_number} sudah konsisten dan siap difinalisasi. Silakan klik Finalisasi di panel PRD, atau ketik revisi tambahan di sini.",
            'quick_replies' => ['Tampilkan dokumen lengkap'],
            'related_prd_version_id' => $version->id,
        ]);
    }

    private function handleFreeRevision(Project $project, PrdVersion $latest, string $content): void
    {
        $revised = $this->generator->revise($latest->decodedContent(), $content);
        $version = $this->newVersion($project, $revised, $this->generator->provider());
        $this->refreshFlags($version);

        // Revisi bebas tidak memicu interogasi baru: pertanyaan yang muncul dari
        // revisi dianggap sudah terjawab agar alur tetap sederhana & cepat.
        $this->resolveRemainingAmbiguities($version);

        $contradiction = $version->contradictionFlags()->whereNull('resolution')->first();

        if ($contradiction) {
            $project->messages()->create([
                'sender' => 'ai',
                'content' => "Revisi masuk ke v{$version->version_number}, namun muncul kontradiksi baru:\n\nA) {$contradiction->requirement_a}\nB) {$contradiction->requirement_b}",
                'quick_replies' => ['Pakai A', 'Pakai B', 'Saya revisi manual'],
                'related_prd_version_id' => $version->id,
            ]);

            return;
        }

        $project->messages()->create([
            'sender' => 'ai',
            'content' => "Revisi diterapkan ke v{$version->version_number}. PRD tetap konsisten dan siap difinalisasi.",
            'related_prd_version_id' => $version->id,
        ]);
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    /**
     * Deteksi ulang ambiguitas & kontradiksi untuk sebuah versi PRD baru.
     *
     * Ambiguitas/kontradiksi yang sudah pernah muncul di versi sebelumnya
     * TIDAK dibuat ulang. Ini mencegah loop tak berujung: begitu user
     * menjawab sebuah ambiguitas, pertanyaan yang sama tidak muncul lagi
     * meski teks PRD masih memuat kata pemicunya.
     */
    private function refreshFlags(PrdVersion $version): void
    {
        $content = $version->decodedContent();

        $knownAmbiguityCodes = AmbiguityFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $version->project_id))
            ->pluck('code')
            ->filter()
            ->all();

        $seenAmbiguityTexts = AmbiguityFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $version->project_id))
            ->pluck('question')
            ->map(fn ($q) => mb_strtolower(trim($q)))
            ->all();

        foreach ($this->generator->detectAmbiguities($content) as $ambiguity) {
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
        }

        $knownContradictions = ContradictionFlag::query()
            ->whereHas('prdVersion', fn ($q) => $q->where('project_id', $version->project_id))
            ->get()
            ->map(fn ($c) => mb_strtolower($c->requirement_a.'||'.$c->requirement_b))
            ->all();

        foreach ($this->generator->detectContradictions($content) as $contradiction) {
            $signature = mb_strtolower($contradiction['requirement_a'].'||'.$contradiction['requirement_b']);

            if (in_array($signature, $knownContradictions, true)) {
                continue;
            }

            $version->contradictionFlags()->create([
                'requirement_a' => $contradiction['requirement_a'],
                'requirement_b' => $contradiction['requirement_b'],
                'explanation' => $contradiction['explanation'],
            ]);
        }
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

    private function tokenResponse(User $user, int $status = 200)
    {
        $token = $user->createToken('spa')->plainTextToken;

        return response()->json(['token' => $token, 'user' => $user], $status);
    }

    private function authorizeProject(Request $request, Project $project): void
    {
        abort_unless($project->user_id === $request->user()->id, 404);
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
            'functional_requirements' => 'Requirement Fungsional',
            'non_functional_requirements' => 'Requirement Non-Fungsional',
            'constraints' => 'Batasan',
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
