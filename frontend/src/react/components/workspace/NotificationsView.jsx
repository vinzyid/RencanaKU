import { useShell } from '../../context/ShellContext.jsx';

export default function NotificationsView() {
    const shell = useShell();
    const { notifications } = shell;
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Pusat Notifikasi</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pembaruan aktivitas, peringatan sistem, dan informasi terbaru.</p>
                </div>
                {notifications.length > 0 && (
                    <div className="flex items-center gap-3">
                        <button onClick={shell.markAllRead} disabled={unreadCount === 0} className={`text-xs font-semibold text-[#5B4DF6] hover:text-[#4E3FE3] transition ${unreadCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>Tandai semua dibaca</button>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <button onClick={shell.clearNotifications} className="text-xs font-semibold text-rose-500 hover:text-rose-600 transition">Bersihkan</button>
                    </div>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-3xl mb-5 shadow-inner">🔕</div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Belum ada notifikasi</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Anda sudah membaca semua pemberitahuan. Kami akan memberi tahu Anda jika ada aktivitas baru.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <div key={notif.id} className={`relative bg-white dark:bg-[#121624] border ${notif.isRead ? 'border-slate-200/60 dark:border-slate-800/60' : 'border-[#5B4DF6]/30 dark:border-[#5B4DF6]/40'} rounded-2xl p-5 sm:p-6 flex gap-4 sm:gap-5 transition hover:shadow-md group`}>
                            {!notif.isRead && <div className="absolute top-5 right-5 w-2.5 h-2.5 bg-[#5B4DF6] rounded-full shadow-[0_0_8px_rgba(91,77,246,0.5)]" />}
                            <div className={`w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full flex items-center justify-center text-xl sm:text-2xl ${notif.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : notif.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500'}`}>{notif.icon}</div>
                            <div className="flex-1 min-w-0 pr-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1">
                                    <h3 className={`font-bold text-sm text-slate-900 dark:text-white truncate ${!notif.isRead ? 'font-extrabold' : ''}`}>{notif.title}</h3>
                                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap uppercase tracking-wider">{notif.timeAgo}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-3">{notif.desc}</p>
                                {!notif.isRead && (
                                    <button onClick={() => shell.markRead(notif.id)} className="text-[11px] font-bold text-[#5B4DF6] bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg transition">Tandai dibaca</button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
