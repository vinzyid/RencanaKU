import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { timeAgo } from '../../utils/format.js';

export default function HistoryView() {
    const { projects } = useAuth();
    const navigate = useNavigate();

    const events = [];
    projects.forEach((p) => {
        events.push({
            date: new Date(p.created_at),
            timeAgo: timeAgo(p.created_at),
            title: `Proyek Dibuat: ${p.title}`,
            desc: 'Mulai merancang ide untuk aplikasi ini.',
            projectId: p.id,
            iconColor: 'bg-emerald-500',
        });

        const tCreated = new Date(p.created_at).getTime();
        const tUpdated = new Date(p.updated_at).getTime();
        if (tUpdated - tCreated > 60000) {
            const isFinal = p.latest_version?.status === 'finalized';
            events.push({
                date: new Date(p.updated_at),
                timeAgo: timeAgo(p.updated_at),
                title: isFinal ? `PRD Final: ${p.title}` : `Update Dokumen: ${p.title}`,
                desc: isFinal ? 'Dokumen PRD telah berhasil difinalisasi.' : 'Melakukan klarifikasi, validasi, atau menyunting requirement.',
                projectId: p.id,
                iconColor: isFinal ? 'bg-amber-500' : 'bg-[#5B4DF6]',
            });
        }
    });

    events.sort((a, b) => b.date - a.date);

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Riwayat Aktivitas</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pantau timeline perjalanan semua draft dokumen PRD kamu.</p>
                </div>
            </div>

            {events.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-2xl mb-4">🕒</div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Belum ada riwayat</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-4">Mulai proyek pertama kamu untuk melihat aktivitas di sini.</p>
                </div>
            ) : (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 md:ml-6 mt-4 space-y-10 pb-6">
                    {events.map((ev, idx) => (
                        <div key={idx} className="relative pl-8 md:pl-10">
                            <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full ring-4 ring-[#F8F9FD] dark:ring-[#0B0D14] ${ev.iconColor}`} />
                            <div className="text-[11px] text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                                {ev.date.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} • {ev.timeAgo}
                            </div>
                            <div className="bg-white dark:bg-[#121624] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm inline-block w-full sm:w-[400px]">
                                <div className="font-bold text-sm text-slate-900 dark:text-white">{ev.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{ev.desc}</div>
                                <button onClick={() => navigate(`/app/projects/${ev.projectId}`)} className="text-xs font-semibold text-[#5B4DF6] mt-3.5 hover:underline flex items-center gap-1">Lihat Proyek →</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
