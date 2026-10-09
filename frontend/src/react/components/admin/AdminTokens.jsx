import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api.js';
import { formatNumber, formatDateTime } from '../../utils/format.js';
import {
    AdminPageHeader,
    AdminCard,
    AdminStatTile,
    AdminEmpty,
    AdminSkeleton,
    AdminError,
    ProviderChip,
} from './AdminUI.jsx';

export default function AdminTokens() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [providerFilter, setProviderFilter] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api('/admin/token-usage');
            setData(res);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const summary = data?.summary ?? {};
    const providers = data?.by_provider ?? [];
    const byUser = data?.by_user ?? [];
    const recent = data?.recent ?? [];

    const filteredRecent = useMemo(() => {
        if (providerFilter === 'all') return recent;
        return recent.filter((r) => (r.provider || 'unknown') === providerFilter);
    }, [recent, providerFilter]);

    const requests = summary.requests ?? 0;
    const avgTokens = requests > 0 ? Math.round((summary.total_tokens ?? 0) / requests) : 0;
    const maxUserTokens = Math.max(...byUser.map((u) => u.total_tokens || 0), 1);

    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Pemakaian AI"
                title="Token AI"
                description="Rincian konsumsi token lintas provider, pengguna, dan request. Mode baca-saja."
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
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <AdminStatTile label="Total Token" value={summary.total_tokens ?? 0} sub="akumulasi" accent="brand" icon="token" loading={loading} />
                        <AdminStatTile label="Total Request" value={requests} sub="panggilan LLM" accent="brand" icon="request" loading={loading} />
                        <AdminStatTile label="Prompt Token" value={summary.prompt_tokens ?? 0} sub="input" accent="emerald" icon="arrowUp" loading={loading} />
                        <AdminStatTile label="Completion Token" value={summary.completion_tokens ?? 0} sub={`≈ ${formatNumber(avgTokens)} / request`} accent="amber" icon="arrowDown" loading={loading} />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        <AdminCard title="Komposisi Provider" meta="token & request" className="lg:col-span-4">
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}
                                </div>
                            ) : providers.length === 0 ? (
                                <AdminEmpty title="Belum ada data" icon="inbox" />
                            ) : (
                                <div className="space-y-3">
                                    {providers.map((p) => (
                                        <div key={p.provider || 'unknown'} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/50">
                                            <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-200">{p.provider || 'unknown'}</span>
                                            <span className="text-[11px] text-slate-400">
                                                {formatNumber(p.requests)} req · {formatNumber(p.total_tokens)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </AdminCard>

                        <AdminCard title="Token per Pengguna" meta="top 20" className="lg:col-span-8">
                            {loading ? (
                                <AdminSkeleton rows={5} />
                            ) : byUser.length === 0 ? (
                                <AdminEmpty title="Belum ada pemakaian" icon="chart" />
                            ) : (
                                <div className="space-y-3.5">
                                    {byUser.map((u) => (
                                        <div key={u.user_id ?? u.email}>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="truncate text-slate-700 dark:text-slate-200">
                                                    <span className="font-semibold">{u.name}</span> <span className="text-slate-400">· {u.email}</span>
                                                </span>
                                                <span className="ml-3 shrink-0 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                    {formatNumber(u.total_tokens)} tok · {formatNumber(u.requests)} req
                                                </span>
                                            </div>
                                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                                <div className="h-full rounded-full bg-[#5B4DF6]/70" style={{ width: `${Math.round((u.total_tokens / maxUserTokens) * 100)}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </AdminCard>
                    </div>

                    <AdminCard
                        title="Detail per Request"
                        meta={`${formatNumber(filteredRecent.length)} baris`}
                        bodyClassName=""
                    >
                        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800/70">
                            <ProviderChip provider="all" active={providerFilter === 'all'} onClick={() => setProviderFilter('all')} />
                            {providers.map((p) => (
                                <ProviderChip
                                    key={p.provider || 'unknown'}
                                    provider={p.provider}
                                    count={Number(p.requests) || 0}
                                    active={providerFilter === p.provider}
                                    onClick={() => setProviderFilter(p.provider)}
                                />
                            ))}
                        </div>

                        {loading ? (
                            <AdminSkeleton rows={6} />
                        ) : filteredRecent.length === 0 ? (
                            <AdminEmpty title="Tidak ada request" hint="Tidak ada pemakaian untuk provider ini." icon="clock" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[720px] text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800/70">
                                            <th className="px-6 py-3 font-bold">Waktu</th>
                                            <th className="px-6 py-3 font-bold">Pengguna</th>
                                            <th className="px-6 py-3 font-bold">Proyek</th>
                                            <th className="px-6 py-3 font-bold">Provider</th>
                                            <th className="px-6 py-3 font-bold">Mode</th>
                                            <th className="px-6 py-3 text-right font-bold">Prompt</th>
                                            <th className="px-6 py-3 text-right font-bold">Completion</th>
                                            <th className="px-6 py-3 text-right font-bold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecent.map((r) => (
                                            <tr key={r.id} className="border-b border-slate-50 transition hover:bg-slate-50/70 dark:border-slate-800/40 dark:hover:bg-slate-800/30">
                                                <td className="whitespace-nowrap px-6 py-3.5 text-[11px] text-slate-400">{formatDateTime(r.created_at)}</td>
                                                <td className="px-6 py-3.5">
                                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{r.user_name}</div>
                                                    <div className="text-[10.5px] text-slate-400">{r.user_email}</div>
                                                </td>
                                                <td className="px-6 py-3.5 text-xs text-slate-600 dark:text-slate-300">{r.project_title}</td>
                                                <td className="px-6 py-3.5 text-xs capitalize text-slate-500 dark:text-slate-400">{r.provider || '—'}</td>
                                                <td className="px-6 py-3.5 text-xs text-slate-500 dark:text-slate-400">{r.mode || '—'}</td>
                                                <td className="px-6 py-3.5 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatNumber(r.prompt_tokens)}</td>
                                                <td className="px-6 py-3.5 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">{formatNumber(r.completion_tokens)}</td>
                                                <td className="px-6 py-3.5 text-right text-xs font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(r.total_tokens)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </AdminCard>
                </>
            )}
        </div>
    );
}
