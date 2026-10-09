import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { initialsOf } from '../../utils/format.js';
import { api } from '../../utils/api.js';
import { brandLogo, sun, moon, spinner, logout as logoutIcon } from '../../utils/icons.js';

function NavIcon({ name }) {
    const common = {
        className: 'h-[18px] w-[18px]',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    };

    if (name === 'overview') {
        return (
            <svg {...common}>
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
        );
    }
    if (name === 'users') {
        return (
            <svg {...common}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        );
    }
    if (name === 'tokens') {
        return (
            <svg {...common}>
                <path d="M12 2v20" />
                <path d="M17 6.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        );
    }
    if (name === 'green') {
        return (
            <svg {...common}>
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6" />
            </svg>
        );
    }
    return null;
}

const ADMIN_NAV = [
    { to: '/admin/overview', label: 'Ringkasan', icon: 'overview', hint: 'Metrik platform' },
    { to: '/admin/users', label: 'Pengguna', icon: 'users', hint: 'Akun & peran' },
    { to: '/admin/tokens', label: 'Token AI', icon: 'tokens', hint: 'Pemakaian & biaya' },
    { to: '/admin/green', label: 'Green Computing', icon: 'green', hint: 'Jejak karbon AI' },
];

export default function AdminLayout() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);

    const handleLogout = async () => {
        setBusy(true);
        try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
        logout();
        navigate('/', { replace: true });
    };

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FD] text-slate-800 transition-colors dark:bg-[#0B0D14] dark:text-slate-100 md:flex-row">
            <aside className="flex w-full shrink-0 flex-col justify-between border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121624] md:h-screen md:w-64 md:sticky md:top-0 md:border-b-0 md:border-r">
                <div className="p-5">
                    <div className="flex items-center gap-3">
                        <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                        <div className="leading-tight">
                            <span className="block text-xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#5B4DF6]">Admin Panel</span>
                        </div>
                    </div>

                    <nav className="mt-7 space-y-1">
                        {ADMIN_NAV.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs transition ${
                                        isActive
                                            ? 'bg-indigo-50 font-bold text-[#5B4DF6] dark:bg-indigo-950/60'
                                            : 'font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                                    }`
                                }
                            >
                                <span className="text-[#5B4DF6] dark:text-indigo-400"><NavIcon name={item.icon} /></span>
                                <span className="flex-1">
                                    <span className="block">{item.label}</span>
                                    <span className="block text-[10.5px] font-normal text-slate-400">{item.hint}</span>
                                </span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="border-t border-slate-100 p-5 dark:border-slate-800/80">
                    <div className="mb-3 rounded-2xl border border-slate-200/70 bg-slate-50/90 p-2.5 dark:border-slate-700/60 dark:bg-slate-800/50">
                        <div className="mb-2.5 flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#5B4DF6] to-indigo-500 text-xs font-bold text-white">
                                {initialsOf(user?.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-bold text-slate-900 dark:text-white">{user?.name}</div>
                                <div className="truncate text-[11px] text-slate-400">{user?.email}</div>
                            </div>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5B4DF6] dark:bg-indigo-950/60 dark:text-indigo-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#5B4DF6]" /> Administrator
                        </span>
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={busy}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-rose-900/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                    >
                        {busy
                            ? <><span dangerouslySetInnerHTML={{ __html: spinner }} /> <span>Memproses...</span></>
                            : <><span dangerouslySetInnerHTML={{ __html: logoutIcon }} /> <span>Keluar</span></>}
                    </button>
                </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/70 px-6 backdrop-blur-md dark:border-slate-800 dark:bg-[#121624]/70 sm:px-8">
                    <div className="text-xs font-semibold text-slate-400">
                        <span className="text-[#5B4DF6] font-bold">Admin</span>
                        <span className="mx-1.5 text-slate-300 dark:text-slate-700">/</span>
                        <span>Panel Kontrol</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggleTheme}
                            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
                        >
                            <span dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                        </button>
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5B4DF6] text-xs font-bold text-white shadow-sm">
                            {initialsOf(user?.name)}
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-6 sm:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
