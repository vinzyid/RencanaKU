import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useShell } from '../../context/ShellContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../utils/api.js';
import { initialsOf, esc } from '../../utils/format.js';
import { brandLogo, plus, search, sun, moon, bell, spinner, logout as logoutIcon, navDashboard, navProjects, navTemplates, navHistory, navSettings, crown, bellOff } from '../../utils/icons.js';
import NewProjectModal from '../modals/NewProjectModal.jsx';
import ExportModal from '../modals/ExportModal.jsx';

const NAV_ITEMS = [
    { key: 'dashboard', label: 'Dashboard', icon: navDashboard },
    { key: 'projects', label: 'Proyek Saya', icon: navProjects, match: ['projects'] },
    { key: 'templates', label: 'Template', icon: navTemplates },
    { key: 'history', label: 'Riwayat', icon: navHistory },
    { key: 'settings', label: 'Pengaturan', icon: navSettings },
];

export default function WorkspaceLayout() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();
    const shell = useShell();
    const navigate = useNavigate();
    const location = useLocation();
    const [loggingOut, setLoggingOut] = useState(false);

    const userName = user?.name || 'Abyan Bergas';
    const userEmail = user?.email || 'abyan@email.com';
    const userInitials = initialsOf(userName);

    const activeKey = (() => {
        const seg = location.pathname.split('/')[2] || 'dashboard';
        if (seg.startsWith('projects')) return 'projects';
        return seg;
    })();

    const handleLogout = async () => {
        setLoggingOut(true);
        try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
        logout();
        navigate('/', { replace: true });
    };

    const unread = shell.notifications.some((n) => !n.isRead);

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0D14] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
            <aside className="w-full md:w-64 bg-white dark:bg-[#121624] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 md:h-screen md:sticky md:top-0">
                <div className="p-5 overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                        <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                    </div>

                    <button onClick={() => shell.openNewProjectModal()} className="w-full btn-primary py-3 mb-6 text-sm font-bold flex items-center justify-center gap-2 shadow-md">
                        <span dangerouslySetInnerHTML={{ __html: plus }} /> <span>New Project</span>
                    </button>

                    <nav className="space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const active = activeKey === item.key;
                            return (
                                <button
                                    key={item.key}
                                    onClick={() => navigate(`/app/${item.key}`)}
                                    className={`nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition ${active ? 'font-bold text-[#5B4DF6] bg-indigo-50 dark:bg-indigo-950/60' : 'font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <span className="w-4 h-4 flex items-center justify-center shrink-0" dangerouslySetInnerHTML={{ __html: item.icon }} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-5 border-t border-slate-100 dark:border-slate-800/80 space-y-3 shrink-0">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/70 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 shadow-xs">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center" dangerouslySetInnerHTML={{ __html: crown }} />
                            <span className="text-xs font-bold text-slate-900 dark:text-white font-heading">Pro Plan</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2.5">Buka semua fitur premium dan batas lebih tinggi.</p>
                        <button onClick={() => showToast('Upgrade ke Pro Plan akan segera hadir. 🚧', 'info')} className="w-full py-2 bg-[#5B4DF6] hover:bg-[#4E3FE3] text-white text-xs font-bold rounded-xl shadow-xs transition">Upgrade</button>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 shadow-xs">
                        <div className="flex items-center gap-2.5 min-w-0 mb-2.5">
                            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-[#5B4DF6] to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">{userInitials}</div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate" title={userName}>{userName}</div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-400 truncate" title={userEmail}>{userEmail}</div>
                            </div>
                        </div>
                        <button onClick={handleLogout} disabled={loggingOut} className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200/80 dark:border-slate-700 hover:border-rose-200 dark:hover:border-rose-900/50 rounded-xl shadow-2xs transition group cursor-pointer" title="Keluar dari akun">
                            {loggingOut
                                ? <><span dangerouslySetInnerHTML={{ __html: spinner }} /> <span>Memproses...</span></>
                                : <><span dangerouslySetInnerHTML={{ __html: logoutIcon }} /> <span>Keluar</span></>}
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                <header className="h-16 px-6 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#121624]/70 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between gap-4">
                    <div className="relative w-full max-w-md">
                        <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none" dangerouslySetInnerHTML={{ __html: search }} />
                        <input
                            type="text"
                            value={shell.searchQuery}
                            onChange={(e) => shell.setSearchQuery(e.target.value)}
                            placeholder="Cari proyek..."
                            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={toggleTheme} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            <span dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                        </button>
                        <div className="relative">
                            <button onClick={() => shell.setShowNotifPopup(!shell.showNotifPopup)} className={`relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition ${shell.showNotifPopup ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                                <span dangerouslySetInnerHTML={{ __html: bell }} />
                                {unread ? <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#5B4DF6] rounded-full ring-2 ring-white dark:ring-[#121624]" /> : null}
                            </button>

                            {shell.showNotifPopup && (
                                <>
                                    <div onClick={() => shell.setShowNotifPopup(false)} className="fixed inset-0 z-40" />
                                    <div className="absolute right-0 mt-2 w-[340px] bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col">
                                        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/40">
                                            <span className="font-bold text-xs text-slate-800 dark:text-white">Notifikasi Terbaru</span>
                                            {unread && <button onClick={shell.markAllRead} className="text-[10px] font-semibold text-[#5B4DF6] hover:underline transition">Tandai dibaca</button>}
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {shell.notifications.length === 0 ? (
                                                <div className="py-10 text-center flex flex-col items-center">
                                                    <div className="mb-2 opacity-50 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: bellOff }} />
                                                    <div className="text-xs text-slate-500">Belum ada notifikasi baru.</div>
                                                </div>
                                            ) : shell.notifications.map((n) => (
                                                <div key={n.id} className={`p-3.5 border-b border-slate-100/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${!n.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                                                    <div className="flex gap-3.5">
                                                        <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 mt-0.5" dangerouslySetInnerHTML={{ __html: n.icon }} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`font-bold text-xs truncate ${!n.isRead ? 'text-[#5B4DF6] dark:text-[#5B4DF6]' : 'text-slate-900 dark:text-white'}`}>{n.title}</div>
                                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">{n.desc}</div>
                                                            <div className="text-[9px] text-slate-400 mt-1.5 uppercase tracking-wider font-semibold">{n.timeAgo}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => { shell.setShowNotifPopup(false); navigate('/app/notifications'); }} className="p-3 text-center text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#5B4DF6] dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#5B4DF6] transition bg-white dark:bg-[#121624]">
                                            Lihat Semua Notifikasi →
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shadow-sm cursor-default">{userInitials}</div>
                    </div>
                </header>

                <div className="flex-1 p-6 sm:p-8">
                    <Outlet />
                </div>
            </main>

            {shell.showNewProjectModal && <NewProjectModal />}
            {shell.showExportModal && <ExportModal />}
        </div>
    );
}
