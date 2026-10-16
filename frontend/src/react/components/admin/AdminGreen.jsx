import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { formatNumber } from '../../utils/format.js';
import {
    AdminPageHeader,
    AdminCard,
    AdminEmpty,
    AdminSkeleton,
    AdminError,
    AdminIcon,
} from './AdminUI.jsx';

function LeafMark() {
    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <AdminIcon name="leaf" className="h-6 w-6" />
        </div>
    );
}

function MetricCard({ icon, label, value, unit, sub, accent = 'emerald' }) {
    const tone = {
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
        sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
        brand: 'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/60 dark:text-indigo-400',
    }[accent] || 'bg-emerald-50 text-emerald-600';

    return (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#121624]">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <AdminIcon name={icon} className="h-6 w-6" />
            </div>
            <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
                    {value}<span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span>
                </div>
                {sub ? <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div> : null}
            </div>
        </div>
    );
}

export default function AdminGreen() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api('/admin/green');
            setData(res);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const total = data?.total ?? {};
    const daily = data?.daily ?? [];
    const providers = data?.by_provider ?? [];
    const efficiency = data?.efficiency ?? { score: 0, avg_tokens_per_request: 0, target: 0 };
    const coeff = data?.coefficients ?? {};

    const maxDailyCo2 = Math.max(...daily.map((d) => d.co2_grams || 0), 1);
    const maxProviderCo2 = Math.max(...providers.map((p) => p.co2_grams || 0), 1);

    const scoreTone = efficiency.score >= 75 ? 'text-emerald-600 dark:text-emerald-400'
        : efficiency.score >= 50 ? 'text-amber-600 dark:text-amber-400'
        : 'text-rose-600 dark:text-rose-400';

    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Sustainability"
                title="Green Computing"
                description="Estimasi jejak lingkungan dari pemakaian token AI. Angka dihitung dari koefisien rata-rata industri dan bersifat estimasi, bukan pengukuran langsung."
                actions={
                    <button onClick={load} className="btn-secondary text-xs font-semibold px-4 py-2">
                        Muat ulang
                    </button>
                }
            />

            {error ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#121624]">
                    <AdminError message={error} onRetry={load} />
                </div>
            ) : loading ? (
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
                    ))}
                </div>
            ) : (
                <>
                    {/* Banner hijau */}
                    <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-6 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-teal-950/20">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4">
                                <LeafMark />
                                <div>
                                    <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300 font-heading">
                                        Teknologi hijau, diukur dan ditingkatkan
                                    </div>
                                    <p className="mt-1 max-w-[58ch] text-xs leading-relaxed text-emerald-700/90 dark:text-emerald-200/70">
                                        Setiap panggilan AI mengonsumsi listrik di data center dan air untuk pendinginan. RencanaKU memantau estimasi ini agar tim dapat menekan pemborosan token dan menekan dampak karbon.
                                    </p>
                                </div>
                            </div>
                            <div className="shrink-0 rounded-2xl border border-emerald-200/70 bg-white/70 px-5 py-4 text-center backdrop-blur dark:border-emerald-900/40 dark:bg-emerald-950/30">
                                <div className="text-[10.5px] font-bold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Skor Efisiensi</div>
                                <div className={`text-3xl font-extrabold font-heading ${scoreTone}`}>{efficiency.score}</div>
                                <div className="text-[10.5px] text-emerald-700/70 dark:text-emerald-300/60">
                                    {formatNumber(efficiency.avg_tokens_per_request)} tok/req
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metrik utama */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <MetricCard icon="emission" label="Emisi CO₂e" value={formatNumber(Math.round(total.co2_grams ?? 0))} unit="g" sub="akumulasi estimasi" accent="emerald" />
                        <MetricCard icon="bolt" label="Energi" value={(total.energy_kwh ?? 0).toFixed(3)} unit="kWh" sub="listrik data center" accent="amber" />
                        <MetricCard icon="water" label="Air Pendinginan" value={(total.water_liters ?? 0).toFixed(2)} unit="L" sub="konsumsi air" accent="sky" />
                        <MetricCard icon="token" label="Total Token" value={formatNumber(total.tokens ?? 0)} unit="" sub={`${formatNumber(total.requests ?? 0)} request`} accent="brand" />
                    </div>

                    {/* Padanan */}
                    <AdminCard title="Padanan Dampak" meta="supaya mudah dibayangkan">
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            {[
                                { icon: 'car', label: 'Setara berkendara', value: `${(total.equivalences?.car_km ?? 0).toFixed(2)} km` },
                                { icon: 'phone', label: 'Isi daya ponsel', value: `${formatNumber(total.equivalences?.smartphone_charges ?? 0)}×` },
                                { icon: 'tree', label: 'Serapan pohon', value: `${(total.equivalences?.tree_days ?? 0).toFixed(1)} hari` },
                                { icon: 'bulb', label: 'Lampu LED', value: `${formatNumber(total.equivalences?.led_bulb_hours ?? 0)} jam` },
                            ].map((e) => (
                                <div key={e.label} className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800/50">
                                    <div className="flex justify-center text-slate-500 dark:text-slate-300">
                                        <AdminIcon name={e.icon} className="h-6 w-6" />
                                    </div>
                                    <div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white font-heading">{e.value}</div>
                                    <div className="text-[10.5px] text-slate-400">{e.label}</div>
                                </div>
                            ))}
                        </div>
                    </AdminCard>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* Tren 7 hari */}
                        <AdminCard title="Tren Emisi 7 Hari" meta="gram CO₂e / hari" className="lg:col-span-7">
                            {daily.every((d) => !d.co2_grams) ? (
                                <AdminEmpty title="Belum ada aktivitas" hint="Grafik tren akan terisi setelah ada pemakaian AI." icon="leaf" />
                            ) : (
                                <>
                                    <div className="flex h-40 items-end gap-2">
                                        {daily.map((d) => (
                                            <div key={d.date} className="group flex flex-1 flex-col items-center gap-2">
                                                <div className="flex w-full flex-1 items-end">
                                                    <div
                                                        className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/60 to-emerald-400 transition-all group-hover:from-emerald-500 group-hover:to-emerald-300"
                                                        style={{ height: `${Math.max((d.co2_grams / maxDailyCo2) * 100, 2)}%` }}
                                                        title={`${d.co2_grams} g CO₂e`}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-semibold text-slate-400">{d.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800/70">
                                        <span>Maksimal harian: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatNumber(Math.round(maxDailyCo2))} g</span></span>
                                        <span>Total 7 hari: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatNumber(Math.round(daily.reduce((a, d) => a + d.co2_grams, 0)))} g</span></span>
                                    </div>
                                </>
                            )}
                        </AdminCard>

                        {/* Per provider */}
                        <AdminCard title="Emisi per Provider" meta="gram CO₂e" className="lg:col-span-5">
                            {providers.length === 0 ? (
                                <AdminEmpty title="Belum ada data" icon="leaf" />
                            ) : (
                                <div className="space-y-4">
                                    {providers.map((p) => (
                                        <div key={p.provider}>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-semibold capitalize text-slate-700 dark:text-slate-200">{p.provider}</span>
                                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{p.co2_grams.toFixed(2)} g</span>
                                            </div>
                                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-teal-400/70" style={{ width: `${Math.round((p.co2_grams / maxProviderCo2) * 100)}%` }} />
                                            </div>
                                            <div className="mt-1 text-[10.5px] text-slate-400">
                                                {formatNumber(p.tokens)} token · {p.energy_kwh.toFixed(4)} kWh
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </AdminCard>
                    </div>

                    {/* Catatan koefisien */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800/80 dark:bg-slate-800/30">
                        <div className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            <span className="font-bold text-slate-600 dark:text-slate-300">Metodologi (estimasi):</span>{' '}
                            Energi {coeff.kwh_per_1k_tokens} kWh/1.000 token · Intensitas karbon {coeff.co2_kg_per_kwh} kg CO₂e/kWh ·
                            Air pendinginan {coeff.water_liters_per_kwh} L/kWh. Koefisien dapat disesuaikan administrator untuk mencerminkan sumber listrik dan model AI yang digunakan.
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
