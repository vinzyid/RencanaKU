import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useShell } from '../../context/ShellContext.jsx';
import { timeAgo } from '../../utils/format.js';
import { plus, statFolder, statHourglass, statCheckCircle, statAlertTriangle, statFolderOpen } from '../../utils/icons.js';

export default function DashboardView() {
    const { user, projects } = useAuth();
    const shell = useShell();
    const navigate = useNavigate();

    const totalProjects = projects.length;
    const finalizedProjects = projects.filter((p) => p.latest_version?.status === 'finalized').length;
    const draftProjects = totalProjects - finalizedProjects;

    const recentProjects = [...projects]
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);

    const stats = [
        { icon: statFolder, color: 'bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6]', label: 'Total Proyek', value: totalProjects },
        { icon: statHourglass, color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-500', label: 'Dalam Proses', value: draftProjects },
        { icon: statCheckCircle, color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500', label: 'PRD Selesai', value: finalizedProjects },
        { icon: statAlertTriangle, color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-500', label: 'Kontradiksi Ditemukan', value: 0 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Dashboard RencanaKU</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Selamat datang kembali, {user?.name || 'Pengguna'}.</p>
                </div>
                <button onClick={() => shell.openNewProjectModal()} className="btn-primary text-xs px-4 py-2 font-bold shadow-sm flex items-center gap-2">
                    <span dangerouslySetInnerHTML={{ __html: plus }} /> <span>Proyek Baru</span>
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <div key={s.label} className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center`} dangerouslySetInnerHTML={{ __html: s.icon }} />
                        <div>
                            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{s.label}</div>
                            <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Proyek Terbaru</h2>
                    <button onClick={() => navigate('/app/projects')} className="text-xs font-semibold text-[#5B4DF6] hover:underline">Lihat Semua</button>
                </div>

                {recentProjects.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
                                <tr>
                                    <th className="text-left font-semibold px-6 py-3">Nama Proyek</th>
                                    <th className="text-left font-semibold px-6 py-3">Status</th>
                                    <th className="text-left font-semibold px-6 py-3">Terakhir Diperbarui</th>
                                    <th className="text-right font-semibold px-6 py-3">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recentProjects.map((p) => {
                                    const isFinal = p.latest_version?.status === 'finalized';
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white">{p.title}</div>
                                                <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs mt-0.5">{p.prompt || 'Draft ide'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[10px] ${isFinal ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60' : 'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/60'}`}>
                                                    {isFinal ? 'Final' : 'Proses'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{timeAgo(p.updated_at)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => navigate(`/app/projects/${p.id}`)} className="text-[#5B4DF6] font-semibold hover:underline">Buka →</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-10 text-center flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4" dangerouslySetInnerHTML={{ __html: statFolderOpen }} />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Belum ada proyek</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">Mulai rancang ide kamu sekarang juga.</p>
                        <button onClick={() => shell.openNewProjectModal()} className="btn-primary text-xs px-4 py-2 font-bold shadow-sm">Buat Proyek Pertama</button>
                    </div>
                )}
            </div>
        </div>
    );
}
