<?php

namespace App\Services;

use App\Models\TokenUsage;
use Illuminate\Support\Facades\DB;

/**
 * Estimasi dampak lingkungan dari pemakaian token AI (Green Computing).
 *
 * PENTING: semua angka di sini adalah ESTIMASI, bukan pengukuran langsung.
 * AI inference memang mengonsumsi listrik di data center (GPU) plus air untuk
 * pendinginan. Kita memakai koefisien rata-rata industri yang transparan dan
 * dapat diubah lewat config/env, supaya admin bisa menyesuaikan dengan sumber
 * yang mereka percayai.
 *
 * Rujukan orde besaran (literatur publik 2023-2024):
 * - Energi inferensi LLM: ~0.001-0.01 kWh per 1.000 token (tergantung model).
 *   Kita pakai default 0.004 kWh / 1.000 token sebagai titik tengah.
 * - Intensitas karbon grid: ~0.4 kg CO2e / kWh (rata-rata global).
 * - Air pendinginan data center: ~1.8 L / kWh (WUE rata-rata).
 *
 * Nilai-nilai ini sengaja konservatif dan diberi label "estimasi" di UI.
 */
class GreenComputing
{
    public const CONFIG_KEY = 'rencanaku.green';

    /**
     * Ambil koefisien (dari config agar bisa di-override via .env).
     */
    private function coefficients(): array
    {
        $defaults = [
            'kwh_per_1k_tokens' => 0.004,
            'co2_kg_per_kwh' => 0.4,
            'water_liters_per_kwh' => 1.8,
            'tree_kg_co2_per_year' => 21.0,
            'car_kg_co2_per_km' => 0.192,
            'smartphone_wh_per_charge' => 12.0,
        ];

        return array_merge($defaults, (array) config(self::CONFIG_KEY, []));
    }

    /**
     * Konversi total token menjadi metrik lingkungan.
     */
    public function impactFromTokens(int $tokens): array
    {
        $c = $this->coefficients();

        $energyKwh = ($tokens / 1000) * $c['kwh_per_1k_tokens'];
        $co2Kg = $energyKwh * $c['co2_kg_per_kwh'];
        $waterLiters = $energyKwh * $c['water_liters_per_kwh'];

        return [
            'tokens' => $tokens,
            'energy_kwh' => round($energyKwh, 4),
            'co2_kg' => round($co2Kg, 4),
            'co2_grams' => round($co2Kg * 1000, 2),
            'water_liters' => round($waterLiters, 3),
        ];
    }

    /**
     * Terjemahkan dampak menjadi padanan yang mudah dibayangkan.
     */
    public function equivalences(array $impact): array
    {
        $c = $this->coefficients();

        $co2Kg = $impact['co2_kg'];
        $energyKwh = $impact['energy_kwh'];

        return [
            'car_km' => round($co2Kg / max($c['car_kg_co2_per_km'], 0.0001), 2),
            'smartphone_charges' => (int) round(($energyKwh * 1000) / max($c['smartphone_wh_per_charge'], 0.0001)),
            'tree_days' => round(($co2Kg / max($c['tree_kg_co2_per_year'], 0.0001)) * 365, 1),
            'led_bulb_hours' => round(($energyKwh * 1000) / 9, 1),
        ];
    }

    /**
     * Laporan lengkap: total, per provider, tren 7 hari, dan skor efisiensi.
     */
    public function report(): array
    {
        $c = $this->coefficients();

        $totalTokens = (int) TokenUsage::query()->sum('total_tokens');
        $totalImpact = $this->impactFromTokens($totalTokens);

        // Per provider.
        $byProvider = TokenUsage::query()
            ->select('provider', DB::raw('COALESCE(SUM(total_tokens), 0) as total_tokens'))
            ->groupBy('provider')
            ->orderByDesc('total_tokens')
            ->get()
            ->map(function ($row) {
                $impact = $this->impactFromTokens((int) $row->total_tokens);
                return [
                    'provider' => $row->provider ?: 'unknown',
                    'tokens' => (int) $row->total_tokens,
                    'co2_grams' => $impact['co2_grams'],
                    'energy_kwh' => $impact['energy_kwh'],
                ];
            })
            ->values();

        // Tren harian 7 hari terakhir.
        $since = now()->subDays(6)->startOfDay();
        $dailyRows = TokenUsage::query()
            ->selectRaw('DATE(created_at) as day, COALESCE(SUM(total_tokens), 0) as total_tokens')
            ->where('created_at', '>=', $since)
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $daily = [];
        for ($i = 6; $i >= 0; $i--) {
            $date = now()->subDays($i)->startOfDay();
            $key = $date->toDateString();
            $tokens = (int) ($dailyRows[$key]->total_tokens ?? 0);
            $impact = $this->impactFromTokens($tokens);
            $daily[] = [
                'date' => $key,
                'label' => $date->translatedFormat('D'),
                'tokens' => $tokens,
                'co2_grams' => $impact['co2_grams'],
                'energy_kwh' => $impact['energy_kwh'],
            ];
        }

        // "Skor efisiensi": makin sedikit token per request, makin efisien.
        // Dihitung terhadap target 1.500 token/request (generator PRD terarah).
        $requests = (int) TokenUsage::query()->count();
        $avgTokPerReq = $requests > 0 ? $totalTokens / $requests : 0;
        $target = (float) config('rencanaku.green_avg_target', 1500);
        $efficiency = $avgTokPerReq > 0
            ? max(0, min(100, (int) round(($target / max($avgTokPerReq, 1)) * 100)))
            : 100;

        return [
            'coefficients' => [
                'kwh_per_1k_tokens' => $c['kwh_per_1k_tokens'],
                'co2_kg_per_kwh' => $c['co2_kg_per_kwh'],
                'water_liters_per_kwh' => $c['water_liters_per_kwh'],
            ],
            'total' => array_merge($totalImpact, [
                'requests' => $requests,
                'equivalences' => $this->equivalences($totalImpact),
            ]),
            'by_provider' => $byProvider,
            'daily' => $daily,
            'efficiency' => [
                'score' => $efficiency,
                'avg_tokens_per_request' => (int) round($avgTokPerReq),
                'target' => (int) $target,
            ],
        ];
    }
}
