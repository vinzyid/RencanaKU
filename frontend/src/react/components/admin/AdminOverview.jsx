import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api.js';
import { formatNumber, formatDateTime } from '../../utils/format.js';
import {
    AdminPageHeader,
    AdminCard,
    AdminStatStrip,
    AdminEmpty,
    AdminSkeleton,
    AdminError,
} from './AdminUI.jsx';

function Section({ title, action, className = '', children }) {
    return (
        <section className={className}>
            <div className="flex items-baseline justify-between border-b border-slate-900/80 pb-2 dark:border-slate-300/60">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

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
                <div className="mt-6">
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
        <div>
            <AdminPageHeader
                title="Ringkasan Platform"
                description="Pengguna, proyek, dan pemakaian token AI di seluruh RencanaKU."
                actions={
                    <button onClick={load} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                        Muat ulang
                    </button>
                }
            />

            <div className="mt-8">
                <AdminStatStrip
                    loading={loading}
                    items={[
                        { label: 'Pengguna', value: stats?.users?.total ?? 0, sub: `+${formatNumber(stats?.users?.new_7d ?? 0)} dalam 7 hari`, accent: 'brand' },
                        { label: 'Proyek', value: stats?.projects?.total ?? 0, sub: `${formatNumber(stats?.projects?.processing ?? 0)} sedang diproses` },
                        { label: 'PRD final', value: stats?.projects?.finalized ?? 0, sub: 'dokumen selesai', accent: 'emerald' },
                        { label: 'Token 7 hari', value: stats?.tokens?.last_7d ?? 0, sub: `${formatNumber(stats?.tokens?.last_24h ?? 0)} dalam 24 jam` },
                    ]}
                />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
                <Section title="Pemakaian per provider" className="lg:col-span-7">
                    {loading ? (
                        <div className="space-y-4 pt-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                            ))}
                        </div>
                    ) : providers.length === 0 ? (
                        <AdminEmpty title="Belum ada pemakaian" hint="Pemakaian token muncul setelah pengguna menjalankan generator PRD." />
                    ) : (
                        <div className="space-y-4 pt-4">
                            {providers.map((p) => {
                                const max = Math.max(...providers.map((x) => Number(x.total_tokens) || 0), 1);
                                const pct = Math.round(((Number(p.total_tokens) || 0) / max) * 100);
                                return (
                                    <div key={p.provider || 'unknown'}>
                                        <div className="flex items-baseline justify-between text-xs">
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{p.provider || 'unknown'}</span>
                                            <span className="font-mono text-[11px] tabular-nums text-slate-400">
                                                {formatNumber(p.requests)} req · {formatNumber(p.total_tokens)} tok
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                            <div className="h-full rounded-full bg-[#5B4DF6]" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Section>

                <Section
                    title="Aktivitas AI terbaru"
                    className="lg:col-span-5"
                    action={<button onClick={() => navigate('/admin/tokens')} className="text-xs font-medium text-slate-500 transition hover:text-[#5B4DF6]">Semua →</button>}
                >
                    {loading ? (
                        <AdminSkeleton rows={5} />
                    ) : (tokens?.recent ?? []).length === 0 ? (
                        <AdminEmpty title="Belum ada aktivitas" hint="Riwayat panggilan AI akan tampil di sini." />
                    ) : (
                        <ul>
                            {tokens.recent.slice(0, 6).map((r) => (
                                <li key={r.id} className="flex items-baseline gap-3 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{r.project_title}</div>
                                        <div className="truncate text-[11px] text-slate-400">{r.user_email}</div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-200">{formatNumber(r.total_tokens)}</div>
                                        <div className="text-[10px] text-slate-400">{formatDateTime(r.created_at)}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Section>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12">
                <Section title="Angka lain" className="lg:col-span-7">
                    <dl>
                        {[
                            ['Akun admin', stats?.users?.admins ?? 0],
                            ['Total token sepanjang waktu', totalTokens],
                            ['Total request AI', requests],
                            ['Rata-rata token per request', avgPerRequest],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-baseline justify-between border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
                                <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                                <dd className="font-mono text-sm tabular-nums text-slate-900 dark:text-white">{loading ? '—' : formatNumber(value)}</dd>
                            </div>
                        ))}
                    </dl>
                </Section>

                <Section
                    title="Green computing"
                    className="lg:col-span-5"
                    action={<button onClick={() => navigate('/admin/green')} className="text-xs font-medium text-slate-500 transition hover:text-emerald-600">Detail →</button>}
                >
                    <div className="grid grid-cols-2 gap-6 pt-4">
                        <div>
                            <div className="text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400 font-heading">
                                {formatNumber(Math.round(green?.total?.co2_grams ?? 0))}
                                <span className="ml-1 text-xs font-medium text-slate-400">g CO₂e</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">emisi estimasi</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white font-heading">
                                {(green?.total?.energy_kwh ?? 0).toFixed(3)}
                                <span className="ml-1 text-xs font-medium text-slate-400">kWh</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">energi terpakai</div>
                        </div>
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-slate-400">Diestimasi dari jumlah token AI yang dipakai seluruh pengguna.</p>
                </Section>
            </div>
        </div>
    );
}
