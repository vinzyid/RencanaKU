import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useShell } from '../../context/ShellContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../utils/api.js';
import { initialsOf } from '../../utils/format.js';
import { brandLogo, plus, search, sun, moon, bell, spinner, logout as logoutIcon, navHome, navDashboard, navProjects, navTemplates, navHistory, navSettings, crown, bellOff } from '../../utils/icons.js';
import ExportModal from '../modals/ExportModal.jsx';

const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: navDashboard },
    { key: 'projects', label: 'Proyek Saya', icon: navProjects },
    { key: 'templates', label: 'Template', icon: navTemplates },
    { key: 'history', label: 'Riwayat', icon: navHistory },
    { key: 'settings', label: 'Pengaturan', icon: navSettings },
];

const PAGE_LABELS = {
    dashboard: 'Dashboard',
    new: 'Proyek Baru',
    projects: 'Proyek Saya',
    templates: 'Template',
    history: 'Riwayat',
    settings: 'Pengaturan',
    notifications: 'Notifikasi',
};

export default function WorkspaceLayout() {
    const { user, logout, projects } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();
    const shell = useShell();
    const navigate = useNavigate();
    const location = useLocation();
    const [loggingOut, setLoggingOut] = useState(false);

    const userName = user?.name || 'Pengguna';
    const userEmail = user?.email || '';
    const userInitials = initialsOf(userName);

    const activeKey = location.pathname.split('/')[2] || 'dashboard';
    const activeProjectId = location.pathname.match(/^\/app\/projects\/([^/]+)/)?.[1] || null;
    const activeProject = activeProjectId ? projects.find((p) => String(p.id) === activeProjectId) : null;

    const recentProjects = [...projects]
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 20);

    // Semua tombol lama "New Project" (Dashboard, Proyek Saya, Template) masih
    // memanggil openNewProjectModal; arahkan ke halaman chat langsung.
    const { showNewProjectModal, newProjectPrefill, closeNewProjectModal } = shell;
    useEffect(() => {
        if (!showNewProjectModal) return;
        const prefill = newProjectPrefill;
        closeNewProjectModal();
        navigate('/app/new', { state: prefill ? { prefill } : null });
    }, [showNewProjectModal, newProjectPrefill, closeNewProjectModal, navigate]);

    const handleLogout = async () => {
        setLoggingOut(true);
        try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
        logout();
        navigate('/', { replace: true });
    };

    const unread = shell.notifications.some((n) => !n.isRead);

    const handleSearch = (value) => {
        shell.setSearchQuery(value);
        if (value && activeKey !== 'projects') navigate('/app/projects');
    };

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0D14] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
            <aside className="w-full md:w-60 bg-white dark:bg-[#10131F] border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 md:h-screen md:sticky md:top-0">
                <div className="px-4 pt-5 pb-4">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2.5" title="Kembali ke Beranda">
                        <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                    </button>
                </div>

                <div className="px-3 space-y-2">
                    <button
                        onClick={() => navigate('/app/new')}
                        className="w-full flex items-center gap-2 rounded-lg bg-[#5B4DF6] hover:bg-[#4E3FE3] px-3 py-2.5 text-[13px] font-semibold text-white transition active:scale-[0.98]"
                    >
                        <span dangerouslySetInnerHTML={{ __html: plus }} />
                        <span>Proyek baru</span>
                    </button>
                    <label className="relative block">
                        <span className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none" dangerouslySetInnerHTML={{ __html: search }} />
                        <input
                            type="text"
                            value={shell.searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Cari proyek"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700/80 bg-transparent pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#5B4DF6]"
                        />
                    </label>
                </div>

                <nav className="mt-5 px-3">
                    {NAV_ITEMS.map((item) => {
                        const active = activeKey === item.key;
                        return (
                            <button
                                key={item.key}
                                onClick={() => navigate(`/app/${item.key}`)}
                                className={`relative w-full flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition ${active ? 'font-semibold text-slate-900 dark:text-white bg-slate-100/80 dark:bg-slate-800/60' : 'font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                            >
                                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#5B4DF6]" />}
                                <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${active ? 'text-[#5B4DF6]' : ''}`} dangerouslySetInnerHTML={{ __html: item.icon }} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-6 px-3 flex-1 min-h-0 flex flex-col">
                    <div className="px-3 mb-1.5 flex items-baseline justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">Chat terakhir</span>
                        {projects.length > 0 && <span className="text-[10px] tabular-nums text-slate-400">{projects.length}</span>}
                    </div>
                    {recentProjects.length === 0 ? (
                        <p className="px-3 text-[11px] text-slate-400 leading-relaxed">Belum ada. Mulai dari tombol Proyek baru.</p>
                    ) : (
                        <ul className="overflow-y-auto max-h-60 md:max-h-none md:flex-1 -mr-1 pr-1">
                            {recentProjects.map((p) => {
                                const active = activeProjectId === String(p.id);
                                return (
                                    <li key={p.id}>
                                        <button
                                            onClick={() => navigate(`/app/projects/${p.id}`)}
                                            title={p.title}
                                            className={`w-full text-left rounded-md px-3 py-1.5 text-xs truncate transition ${active ? 'text-[#5B4DF6] font-semibold bg-indigo-50/70 dark:bg-indigo-950/40' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'}`}
                                        >
                                            {p.title || 'Proyek Baru'}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="mt-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => showToast('Upgrade ke Pro Plan akan segera hadir.', 'info')}
                        className="w-full flex items-center gap-2 px-6 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#5B4DF6] transition"
                    >
                        <span className="flex items-center scale-75 origin-left" dangerouslySetInnerHTML={{ __html: crown }} />
                        <span>Paket Gratis</span>
                        <span className="ml-auto font-semibold text-[#5B4DF6]">Upgrade</span>
                    </button>
                    <div className="flex items-center gap-2.5 px-4 py-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="w-8 h-8 shrink-0 rounded-md bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-[11px]">{userInitials}</div>
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={userName}>{userName}</div>
                            <div className="text-[10.5px] text-slate-400 truncate" title={userEmail}>{userEmail}</div>
                        </div>
                        <button
                            onClick={handleLogout}
                            disabled={loggingOut}
                            title="Keluar"
                            aria-label="Keluar"
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        >
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: loggingOut ? spinner : logoutIcon }} />
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-14 px-6 sm:px-10 border-b border-slate-200 dark:border-slate-800 bg-[#F8F9FD]/85 dark:bg-[#0B0D14]/85 backdrop-blur sticky top-0 z-20 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-2 text-[13px]">
                        <span className="text-slate-400">Workspace</span>
                        <span className="text-slate-300 dark:text-slate-700">/</span>
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {activeProject ? activeProject.title : PAGE_LABELS[activeKey] || 'Dashboard'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={() => navigate('/')} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Beranda" aria-label="Beranda">
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: navHome }} />
                        </button>
                        <button onClick={toggleTheme} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition" title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'} aria-label="Ganti tema">
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                        </button>
                        <div className="relative">
                            <button onClick={() => shell.setShowNotifPopup(!shell.showNotifPopup)} className={`relative p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition ${shell.showNotifPopup ? 'bg-slate-100 dark:bg-slate-800' : ''}`} aria-label="Notifikasi">
                                <span className="flex items-center" dangerouslySetInnerHTML={{ __html: bell }} />
                                {unread ? <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#5B4DF6] rounded-full" /> : null}
                            </button>

                            {shell.showNotifPopup && (
                                <>
                                    <div onClick={() => shell.setShowNotifPopup(false)} className="fixed inset-0 z-40" />
                                    <div className="absolute right-0 mt-2 w-[min(340px,calc(100vw-2rem))] bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 overflow-hidden flex flex-col">
                                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                            <span className="font-semibold text-xs text-slate-800 dark:text-white">Notifikasi</span>
                                            {unread && <button onClick={shell.markAllRead} className="text-[11px] font-semibold text-[#5B4DF6] hover:underline">Tandai dibaca</button>}
                                        </div>
                                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                            {shell.notifications.length === 0 ? (
                                                <div className="py-10 text-center flex flex-col items-center">
                                                    <div className="mb-2 opacity-50 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: bellOff }} />
                                                    <div className="text-xs text-slate-500">Belum ada notifikasi baru.</div>
                                                </div>
                                            ) : shell.notifications.map((n) => (
                                                <div key={n.id} className="relative px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition">
                                                    {!n.isRead && <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-[#5B4DF6]" />}
                                                    <div className={`text-xs truncate ${!n.isRead ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300'}`}>{n.title}</div>
                                                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">{n.desc}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1">{n.timeAgo}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => { shell.setShowNotifPopup(false); navigate('/app/notifications'); }} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[#5B4DF6] border-t border-slate-100 dark:border-slate-800 transition">
                                            Lihat semua notifikasi →
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 px-4 py-6 sm:px-10 sm:py-8">
                    <Outlet />
                </div>
            </main>

            {shell.showExportModal && <ExportModal />}
        </div>
    );
}
