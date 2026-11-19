import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { initialsOf } from '../../utils/format.js';
import { api } from '../../utils/api.js';
import { brandLogo, sun, moon, spinner, logout as logoutIcon, navHome } from '../../utils/icons.js';

function NavIcon({ name }) {
    const common = {
        className: 'h-4 w-4',
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
    const location = useLocation();
    const [busy, setBusy] = useState(false);

    const handleLogout = async () => {
        setBusy(true);
        try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
        logout();
        navigate('/', { replace: true });
    };

    const current = ADMIN_NAV.find((item) => location.pathname.startsWith(item.to));

    return (
        <div className="flex min-h-screen flex-col bg-[#F8F9FD] text-slate-800 transition-colors dark:bg-[#0B0D14] dark:text-slate-100 md:flex-row">
            <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#10131F] md:h-screen md:w-60 md:sticky md:top-0 md:border-b-0 md:border-r">
                <div className="px-4 pt-5 pb-4">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2.5 text-left" title="Kembali ke Beranda">
                        <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                        <span className="leading-tight">
                            <span className="block text-lg font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                            <span className="block text-[11px] text-slate-400">Panel admin</span>
                        </span>
                    </button>
                </div>

                <nav className="mt-2 px-3">
                    {ADMIN_NAV.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition ${
                                    isActive
                                        ? 'bg-slate-100/80 font-semibold text-slate-900 dark:bg-slate-800/60 dark:text-white [&_.nav-ico]:text-[#5B4DF6] [&_.nav-bar]:block'
                                        : 'font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                }`
                            }
                        >
                            <span className="nav-bar absolute left-0 top-1.5 bottom-1.5 hidden w-[3px] rounded-full bg-[#5B4DF6]" />
                            <span className="nav-ico flex h-4 w-4 items-center justify-center"><NavIcon name={item.icon} /></span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-auto border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 px-4 py-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#5B4DF6] text-[11px] font-bold text-white">
                            {initialsOf(user?.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">{user?.name}</div>
                            <div className="truncate text-[10.5px] text-slate-400">Administrator · {user?.email}</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            disabled={busy}
                            title="Keluar"
                            aria-label="Keluar"
                            className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                        >
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: busy ? spinner : logoutIcon }} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-[#F8F9FD]/85 px-6 backdrop-blur dark:border-slate-800 dark:bg-[#0B0D14]/85 sm:px-10">
                    <div className="flex min-w-0 items-center gap-2 text-[13px]">
                        <span className="text-slate-400">Admin</span>
                        <span className="text-slate-300 dark:text-slate-700">/</span>
                        <span className="truncate font-semibold text-slate-900 dark:text-white">{current?.label || 'Panel'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigate('/')}
                            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title="Beranda"
                            aria-label="Beranda"
                        >
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: navHome }} />
                        </button>
                        <button
                            onClick={toggleTheme}
                            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
                            aria-label="Ganti tema"
                        >
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 px-4 py-6 sm:px-10 sm:py-8">
                    <div className="max-w-6xl">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
