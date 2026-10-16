import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../utils/api.js';
import { formatDateTime, initialsOf } from '../../utils/format.js';
import {
    AdminPageHeader,
    AdminEmpty,
    AdminSkeleton,
    AdminError,
} from './AdminUI.jsx';

const PROVIDER_STYLE = {
    google: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400',
    github: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    password: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
};

function ProviderTag({ provider }) {
    return (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${PROVIDER_STYLE[provider] || PROVIDER_STYLE.github}`}>
            {provider}
        </span>
    );
}

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api('/admin/users');
            setUsers(data.users || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            if (roleFilter === 'admin' && !u.is_admin) return false;
            if (roleFilter === 'user' && u.is_admin) return false;
            if (!q) return true;
            return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        });
    }, [users, query, roleFilter]);

    const adminCount = users.filter((u) => u.is_admin).length;

    const tabs = [
        { id: 'all', label: `Semua (${users.length})` },
        { id: 'admin', label: `Admin (${adminCount})` },
        { id: 'user', label: `Pengguna (${users.length - adminCount})` },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow="Manajemen Pengguna"
                title="Pengguna"
                description="Daftar akun terdaftar. Mode baca-saja — perubahan peran dilakukan lewat konfigurasi ADMIN_EMAILS, bukan dari panel ini."
                actions={
                    <button onClick={load} className="btn-secondary text-xs font-semibold px-4 py-2">
                        Muat ulang
                    </button>
                }
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-[#121624]">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setRoleFilter(t.id)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                roleFilter === t.id
                                    ? 'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/60 dark:text-indigo-300'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Cari nama atau email…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-800 outline-none transition focus:border-[#5B4DF6] focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:ring-indigo-950/50 sm:w-64"
                />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#121624]">
                <div className="hidden grid-cols-12 gap-4 border-b border-slate-100 px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-800/70 md:grid">
                    <div className="col-span-4">Pengguna</div>
                    <div className="col-span-3">Metode Login</div>
                    <div className="col-span-2 text-center">Proyek</div>
                    <div className="col-span-3 text-right">Terdaftar</div>
                </div>

                {error ? (
                    <AdminError message={error} onRetry={load} />
                ) : loading ? (
                    <AdminSkeleton rows={6} />
                ) : filtered.length === 0 ? (
                    <AdminEmpty title="Tidak ada pengguna" hint="Tidak ada akun yang cocok dengan filter atau pencarian." icon="users" />
                ) : (
                    <div>
                        {filtered.map((u) => (
                            <div key={u.id} className="grid grid-cols-1 gap-2 border-b border-slate-100 px-6 py-4 transition last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-800/30 md:grid-cols-12 md:items-center md:gap-4">
                                <div className="col-span-4 flex items-center gap-3">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                        u.is_admin
                                            ? 'bg-gradient-to-tr from-[#5B4DF6] to-indigo-500 text-white'
                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                        {initialsOf(u.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-xs font-bold text-slate-900 dark:text-white">{u.name}</span>
                                            {u.is_admin && (
                                                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-[#5B4DF6] dark:bg-indigo-950/60 dark:text-indigo-300">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                        <div className="truncate text-[11px] text-slate-400">{u.email}</div>
                                    </div>
                                </div>

                                <div className="col-span-3">
                                    <ProviderTag provider={u.auth_provider} />
                                </div>

                                <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300 md:text-center">
                                    {u.projects_count}
                                </div>

                                <div className="col-span-3 text-[11px] text-slate-400 md:text-right">
                                    {formatDateTime(u.created_at)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
