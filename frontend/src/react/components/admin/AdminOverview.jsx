import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api.js';
import { formatNumber, formatDateTime } from '../../utils/format.js';
import {
    AdminPageHeader,
    AdminCard,
    AdminStatTile,
    AdminEmpty,
    AdminSkeleton,
    AdminError,
    AdminIcon,
} from './AdminUI.jsx';

export default function AdminOverview() {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [tokens, setTokens] = useState(null);
    const [green, setGreen] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [statsRes, tokenRes, greenRes] = await Promise.all([
                api('/admin/stats'),
                api('/admin/token-usage'),
                api('/admin/green'),
            ]);
            setStats(statsRes);
            setTokens(tokenRes);
            setGreen(greenRes);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (error) {
        return (
            <>
                <AdminPageHeader eyebrow="Admin / Ringkasan" title="Ringkasan Platform" />
                <div className="mt-6 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-[#121624]">
                    <AdminError message={error} onRetry={load} />
                </div>
            </>
        );
    }

    const totalTokens = stats?.tokens?.all_time ?? tokens?.summary?.total_tokens ?? 0;
    const requests = tokens?.summary?.requests ?? 0;
    const avgPerRequest = requests > 0 ? Math.round(totalTokens / requests) : 0;
    const providers = tokens?.by_provider ?? [];

    return (
        <>
            <AdminPageHeader
                eyebrow="Admin / Ringkasan"
                title="Ringkasan Platform"
                description="Pantau kesehatan platform: pengguna, proyek, dan konsumsi token AI. Hanya terlihat oleh admin."
                actions={
                    <button onClick={load} className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        Muat ulang
                    </button>
                }
            />

            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AdminStatTile label="Total Pengguna" value={stats?.users?.total ?? 0} sub={`${formatNumber(stats?.users?.new_7d ?? 0)} baru · 7 hari`} accent="brand" icon="users" loading={loading} />
                <AdminStatTile label="Admin" value={stats?.users?.admins ?? 0} sub="akun berperan admin" accent="amber" icon="admin" loading={loading} />
                <AdminStatTile label="Total Proyek" value={stats?.projects?.total ?? 0} sub={`${formatNumber(stats?.projects?.processing ?? 0)} sedang diproses`} accent="emerald" icon="folder" loading={loading} />
                <AdminStatTile label="PRD Final" value={stats?.projects?.finalized ?? 0} sub="dokumen terselesaikan" accent="emerald" icon="check" loading={loading} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AdminStatTile label="Total Token" value={totalTokens} sub="sepanjang waktu" accent="brand" icon="token" loading={loading} />
                <AdminStatTile label="Token 7 Hari" value={stats?.tokens?.last_7d ?? 0} sub={`${formatNumber(stats?.tokens?.last_24h ?? 0)} dalam 24 jam`} accent="rose" icon="bolt" loading={loading} />
                <AdminStatTile label="Total Request AI" value={requests} sub="panggilan LLM tercatat" accent="slate" icon="request" loading={loading} />
                <AdminStatTile label="Rata-rata / Request" value={avgPerRequest} sub="token per panggilan" accent="slate" icon="chart" loading={loading} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <AdminCard
                    title="Pemakaian per Provider"
                    meta="distribusi token"
                    className="lg:col-span-7"
                >
                    {loading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                            ))}
                        </div>
                    ) : providers.length === 0 ? (
                        <AdminEmpty title="Belum ada pemakaian" hint="Pemakaian token akan muncul setelah pengguna menjalankan generator PRD." icon="chart" />
                    ) : (
                        <div className="space-y-3.5">
                            {providers.map((p) => {
                                const max = Math.max(...providers.map((x) => Number(x.total_tokens) || 0), 1);
                                const pct = Math.round(((Number(p.total_tokens) || 0) / max) * 100);
                                return (
                                    <div key={p.provider || 'unknown'}>
                                        <div className="flex items-center justify-between font-mono text-[11px]">
                                            <span className="text-slate-600 dark:text-slate-300">{p.provider || 'unknown'}</span>
                                            <span className="text-slate-400">
                                                {formatNumber(p.requests)} req · {formatNumber(p.total_tokens)} tok
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                            <div className="h-full rounded-full bg-[#5B4DF6]/80" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </AdminCard>

                <AdminCard title="Proyek Terbaru" meta="aktivitas AI" className="lg:col-span-5" bodyClassName="">
                    {loading ? (
                        <AdminSkeleton rows={5} />
                    ) : (tokens?.recent ?? []).length === 0 ? (
                        <AdminEmpty title="Belum ada aktivitas" hint="Riwayat panggilan AI akan tampil di sini." icon="clock" />
                    ) : (
                        <div>
                            {tokens.recent.slice(0, 6).map((r) => (
                                <div key={r.id} className="flex items-center gap-3 border-b border-slate-100 px-6 py-3.5 last:border-0 dark:border-slate-800/60">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{r.project_title}</div>
                                        <div className="truncate text-[10.5px] text-slate-400">{r.user_email}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{formatNumber(r.total_tokens)}</div>
                                        <div className="text-[10px] text-slate-400">{formatDateTime(r.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="border-t border-slate-100 px-6 py-3.5 dark:border-slate-800/70">
                        <button onClick={() => navigate('/admin/tokens')} className="text-xs font-bold text-[#5B4DF6] hover:underline">
                            Lihat semua pemakaian →
                        </button>
                    </div>
                </AdminCard>
            </div>

            {/* Green Computing highlight */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-teal-950/20">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <AdminIcon name="leaf" className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300 font-heading">Green Computing</div>
                            <p className="mt-1 max-w-[56ch] text-xs leading-relaxed text-emerald-700/90 dark:text-emerald-200/70">
                                Estimasi jejak karbon dari pemakaian token AI, sebagai komitmen pada teknologi hijau dan keberlanjutan.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 lg:shrink-0">
                        <div className="text-center">
                            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 font-heading">
                                {formatNumber(Math.round(green?.total?.co2_grams ?? 0))}
                                <span className="ml-1 text-xs font-semibold text-emerald-600/70 dark:text-emerald-300/60">g CO₂e</span>
                            </div>
                            <div className="text-[10.5px] text-emerald-700/70 dark:text-emerald-300/60">emisi estimasi</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 font-heading">
                                {(green?.total?.energy_kwh ?? 0).toFixed(3)}
                                <span className="ml-1 text-xs font-semibold text-emerald-600/70 dark:text-emerald-300/60">kWh</span>
                            </div>
                            <div className="text-[10.5px] text-emerald-700/70 dark:text-emerald-300/60">energi</div>
                        </div>
                        <button
                            onClick={() => navigate('/admin/green')}
                            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                            Lihat detail →
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
