<?php

namespace App\Http\Controllers;

use App\Models\TokenUsage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Controller khusus halaman admin (role "admin").
 * Dilindungi middleware "admin" pada definisi route.
 */
class AdminController extends Controller
{
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

        // Detail per request (terbaru dulu).
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
