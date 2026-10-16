<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\PrdVersion;
use App\Models\Project;
use App\Models\TokenUsage;
use App\Models\User;
use App\Services\GreenComputing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Controller khusus halaman admin (role "admin").
 * Dilindungi middleware "admin" pada definisi route.
 */
class AdminController extends Controller
{
    /**
     * Estimasi dampak lingkungan (Green Computing) dari pemakaian token AI.
     */
    public function green(GreenComputing $green)
    {
        return response()->json($green->report());
    }
    /**
     * Ringkasan platform untuk halaman overview admin.
     */
    public function stats(Request $request)
    {
        return response()->json([
            'users' => [
                'total' => User::query()->count(),
                'admins' => User::query()->where('role', User::ROLE_ADMIN)->count(),
                'new_7d' => User::query()->where('created_at', '>=', now()->subDays(7))->count(),
            ],
            'projects' => [
                'total' => Project::query()->count(),
                'finalized' => PrdVersion::query()->where('status', 'finalized')->count(),
                'processing' => Project::query()->where('prd_status', 'processing')->count(),
            ],
            'messages' => [
                'total' => Message::query()->count(),
            ],
            'tokens' => [
                'all_time' => (int) TokenUsage::query()->sum('total_tokens'),
                'last_24h' => (int) TokenUsage::query()->where('created_at', '>=', now()->subDay())->sum('total_tokens'),
                'last_7d' => (int) TokenUsage::query()->where('created_at', '>=', now()->subDays(7))->sum('total_tokens'),
            ],
        ]);
    }

    /**
     * Daftar pengguna (read-only) untuk halaman admin.
     *
     * Catatan keamanan: endpoint ini HANYA dapat diakses role admin
     * (middleware "admin"), dan status admin memang perlu terlihat di
     * console admin. Kolom sensitif (password, remember_token) tetap tidak
     * diekspos. Hanya kolom yang aman + jumlah proyek.
     */
    public function users(Request $request)
    {
        $search = trim((string) $request->query('q', ''));

        $users = User::query()
            ->select(['id', 'name', 'email', 'auth_provider', 'role', 'created_at'])
            ->withCount('projects')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'auth_provider' => $user->auth_provider ?: 'password',
                'is_admin' => $user->isAdmin(),
                'projects_count' => (int) $user->projects_count,
                'created_at' => $user->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'total' => $users->count(),
            'users' => $users,
        ]);
    }
    /**
     * Ringkasan pemakaian token + daftar detail per request.
     */
    public function tokenUsage(Request $request)
    {
        // Ringkasan agregat keseluruhan.
        $totals = TokenUsage::query()->selectRaw(
            'COUNT(*) as requests,
             COALESCE(SUM(prompt_tokens), 0) as prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) as completion_tokens,
             COALESCE(SUM(total_tokens), 0) as total_tokens'
        )->first();

        // Ringkasan per provider.
        $byProvider = TokenUsage::query()
            ->select('provider', DB::raw('COUNT(*) as requests'), DB::raw('COALESCE(SUM(total_tokens), 0) as total_tokens'))
            ->groupBy('provider')
            ->orderByDesc('total_tokens')
            ->get();

        // Ringkasan per user.
        // CATATAN (Masalah #12): hanya ambil kolom yang aman (id, name, email).
        // Kolom "role" sengaja TIDAK di-select agar tidak ikut terekspos di
        // response, sehingga daftar admin tidak mudah dikenali attacker.
        $byUser = TokenUsage::query()
            ->select('user_id', DB::raw('COUNT(*) as requests'), DB::raw('COALESCE(SUM(total_tokens), 0) as total_tokens'))
            ->with('user:id,name,email')
            ->groupBy('user_id')
            ->orderByDesc('total_tokens')
            ->limit(20)
            ->get()
            ->map(fn ($row) => [
                'user_id' => $row->user_id,
                'name' => $row->user->name ?? 'Anonim',
                'email' => $row->user->email ?? '-',
                'requests' => (int) $row->requests,
                'total_tokens' => (int) $row->total_tokens,
            ]);

        // Detail per request (terbaru dulu). Sama seperti di atas: hanya kolom
        // aman yang diambil, tanpa "role".
        $recent = TokenUsage::query()
            ->with(['user:id,name,email', 'project:id,title'])
            ->latest('id')
            ->limit(100)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->id,
                'user_name' => $row->user->name ?? 'Anonim',
                'user_email' => $row->user->email ?? '-',
                'project_title' => $row->project->title ?? '-',
                'provider' => $row->provider,
                'model' => $row->model,
                'mode' => $row->mode,
                'prompt_tokens' => $row->prompt_tokens,
                'completion_tokens' => $row->completion_tokens,
                'total_tokens' => $row->total_tokens,
                'created_at' => $row->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'summary' => [
                'requests' => (int) ($totals->requests ?? 0),
                'prompt_tokens' => (int) ($totals->prompt_tokens ?? 0),
                'completion_tokens' => (int) ($totals->completion_tokens ?? 0),
                'total_tokens' => (int) ($totals->total_tokens ?? 0),
            ],
            'by_provider' => $byProvider,
            'by_user' => $byUser,
            'recent' => $recent,
        ]);
    }
}
