import { useCallback, useEffect, useState } from 'react';
import { api } from '../../utils/api.js';
import { formatNumber, formatDateTime, esc } from '../../utils/format.js';

function StatCard({ label, value, icon }) {
    return (
        <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
                <span className="text-base">{icon}</span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">{value}</div>
        </div>
    );
}

export default function AdminTokenView() {
    const [summary, setSummary] = useState({});
    const [providers, setProviders] = useState([]);
    const [recent, setRecent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api('/admin/token-usage');
            setSummary(data.summary || {});
            setProviders(data.by_provider || []);
            setRecent(data.recent || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Penggunaan Token</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pantau pemakaian token AI (khusus admin).</p>
                </div>
                <button onClick={load} className="btn-secondary text-xs px-4 py-2 font-semibold">Muat ulang</button>
            </div>

            {error ? (
                <p className="text-xs text-rose-500">{esc(error)}</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Total Token" value={loading ? '…' : formatNumber(summary.total_tokens)} icon="🧮" />
                        <StatCard label="Total Request" value={loading ? '…' : formatNumber(summary.requests)} icon="📨" />
                        <StatCard label="Prompt Token" value={loading ? '…' : formatNumber(summary.prompt_tokens)} icon="⬆️" />
                        <StatCard label="Completion Token" value={loading ? '…' : formatNumber(summary.completion_tokens)} icon="⬇️" />
                    </div>

                    <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Pemakaian per Provider</h2>
                        </div>
                        <div className="p-6">
                            {loading ? <p className="text-xs text-slate-400">Memuat…</p> : providers.length ? (
                                <div className="flex flex-wrap gap-2">
                                    {providers.map((p, i) => (
                                        <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                                            {esc(p.provider || 'unknown')} <span className="text-slate-400">·</span> {formatNumber(p.requests)} req <span className="text-slate-400">·</span> {formatNumber(p.total_tokens)} token
                                        </span>
                                    ))}
                                </div>
                            ) : <p className="text-xs text-slate-400">Belum ada pemakaian.</p>}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Detail per Request</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? <p className="text-xs text-slate-400 p-6">Memuat…</p> : recent.length ? (
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                                        <tr>
                                            <th className="text-left font-semibold px-4 py-3">Waktu</th>
                                            <th className="text-left font-semibold px-4 py-3">User</th>
                                            <th className="text-left font-semibold px-4 py-3">Proyek</th>
                                            <th className="text-left font-semibold px-4 py-3">Provider</th>
                                            <th className="text-left font-semibold px-4 py-3">Mode</th>
                                            <th className="text-right font-semibold px-4 py-3">Prompt</th>
                                            <th className="text-right font-semibold px-4 py-3">Completion</th>
                                            <th className="text-right font-semibold px-4 py-3">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {recent.map((r, i) => (
                                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-800 dark:text-slate-100">{esc(r.user_name)}</div>
                                                    <div className="text-[11px] text-slate-400">{esc(r.user_email)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{esc(r.project_title)}</td>
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{esc(r.provider || '-')}</td>
                                                <td className="px-4 py-3 text-slate-500">{esc(r.mode || '-')}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(r.prompt_tokens)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatNumber(r.completion_tokens)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{formatNumber(r.total_tokens)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : <p className="text-xs text-slate-400 p-6">Belum ada pemakaian token.</p>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
