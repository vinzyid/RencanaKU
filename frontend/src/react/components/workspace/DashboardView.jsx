import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { timeAgo } from '../../utils/format.js';
import { send } from '../../utils/icons.js';

const STAT_BORDERS = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-t border-l lg:border-t-0'];

function StatusLabel({ final }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${final ? 'text-emerald-600 dark:text-emerald-400' : 'text-[#5B4DF6] dark:text-indigo-300'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${final ? 'bg-emerald-500' : 'bg-[#5B4DF6]'}`} />
            {final ? 'Final' : 'Draft'}
        </span>
    );
}

export default function DashboardView() {
    const { user, projects } = useAuth();
    const navigate = useNavigate();
    const [idea, setIdea] = useState('');

    const firstName = user?.name?.split(' ')[0] || 'Pengguna';
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const isFinal = (p) => p.latest_version?.status === 'finalized';
    const sorted = [...projects].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const total = projects.length;
    const finalized = projects.filter(isFinal).length;
    const drafts = total - finalized;
    const pct = total ? Math.round((finalized / total) * 100) : 0;
    const recent = sorted.slice(0, 6);
    const continueProject = sorted.find((p) => !isFinal(p));
    const thisWeek = projects.filter((p) => Date.now() - new Date(p.created_at).getTime() < 7 * 864e5).length;

    const stats = [
        { label: 'Total proyek', value: total },
        { label: 'Masih draft', value: drafts },
        { label: 'PRD final', value: finalized },
        { label: 'Dibuat minggu ini', value: thisWeek },
    ];

    const summary = total === 0
        ? 'Belum ada proyek. Tulis ide pertamamu di bawah, sisanya kita susun bareng.'
        : `Ada ${drafts} proyek yang masih draft dan ${finalized} PRD yang sudah final.`;

    const startIdea = (e) => {
        e.preventDefault();
        const value = idea.trim();
        if (!value) return;
        navigate('/app/new', { state: { prefill: value, autoSubmit: true } });
    };

    return (
        <div className="max-w-6xl space-y-10">
            <header className="space-y-6">
                <div>
                    <p className="text-xs text-slate-400 first-letter:uppercase">{today}</p>
                    <h1 className="mt-1.5 text-3xl sm:text-[2.5rem] leading-tight font-bold tracking-tight text-slate-900 dark:text-white font-heading">
                        Halo, {firstName}.
                    </h1>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{summary}</p>
                </div>

                <form onSubmit={startIdea} className="flex items-center gap-2 max-w-2xl rounded-lg border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-[#121624] pl-4 pr-1.5 py-1.5 focus-within:border-[#5B4DF6] transition">
                    <input
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="Punya ide baru? Ceritakan singkat di sini…"
                        className="flex-1 min-w-0 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none py-1.5"
                    />
                    <button type="submit" disabled={!idea.trim()} className="shrink-0 inline-flex items-center gap-2 rounded-md bg-[#5B4DF6] hover:bg-[#4E3FE3] px-3.5 py-2 text-xs font-semibold text-white transition disabled:opacity-40">
                        <span>Mulai</span>
                        <span className="flex items-center rotate-90" dangerouslySetInnerHTML={{ __html: send }} />
                    </button>
                </form>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121624]">
                {stats.map((s, i) => (
                    <div key={s.label} className={`px-5 py-5 border-slate-200 dark:border-slate-800 ${STAT_BORDERS[i]}`}>
                        <div className={`text-3xl font-bold tabular-nums tracking-tight font-heading ${i === 0 ? 'text-[#5B4DF6]' : 'text-slate-900 dark:text-white'}`}>{s.value}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                    </div>
                ))}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <section className="lg:col-span-2">
                    <div className="flex items-baseline justify-between border-b border-slate-900/80 dark:border-slate-300/60 pb-2">
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Proyek terbaru</h2>
                        {total > 0 && <button onClick={() => navigate('/app/projects')} className="text-xs font-medium text-slate-500 hover:text-[#5B4DF6] transition">Semua proyek →</button>}
                    </div>

                    {recent.length > 0 ? (
                        <ol>
                            {recent.map((p, i) => (
                                <li key={p.id}>
                                    <button
                                        onClick={() => navigate(`/app/projects/${p.id}`)}
                                        className="group w-full grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-3 py-4 border-b border-slate-200 dark:border-slate-800 text-left"
                                    >
                                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-[#5B4DF6] transition">{p.title}</span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{p.prompt || 'Belum ada ringkasan ide'}</span>
                                        </span>
                                        <span className="flex flex-col items-end gap-1 shrink-0">
                                            <StatusLabel final={isFinal(p)} />
                                            <span className="text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(p.updated_at)}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <div className="py-12 text-sm text-slate-500 dark:text-slate-400">
                            Daftar ini masih kosong. Proyek yang kamu mulai akan muncul di sini dan di sidebar.
                            <button onClick={() => navigate('/app/templates')} className="block mt-3 text-xs font-semibold text-[#5B4DF6] hover:underline">Atau mulai dari template →</button>
                        </div>
                    )}
                </section>

                <aside className="space-y-8">
                    <section>
                        <h2 className="border-b border-slate-900/80 dark:border-slate-300/60 pb-2 text-sm font-bold text-slate-900 dark:text-white font-heading">Progres PRD</h2>
                        <div className="pt-4">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white font-heading">{pct}%</span>
                                <span className="text-xs text-slate-500">sudah final</span>
                            </div>
                            <div className="mt-3 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-[#5B4DF6] rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="mt-2 text-[11px] text-slate-400 tabular-nums">{finalized} dari {total} proyek</p>
                        </div>
                    </section>

                    <section>
                        <h2 className="border-b border-slate-900/80 dark:border-slate-300/60 pb-2 text-sm font-bold text-slate-900 dark:text-white font-heading">Lanjutkan</h2>
                        {continueProject ? (
                            <div className="pt-4">
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{continueProject.title}</div>
                                <div className="mt-0.5 text-xs text-slate-500">Terakhir dibuka {timeAgo(continueProject.updated_at)}</div>
                                <button onClick={() => navigate(`/app/projects/${continueProject.id}`)} className="mt-3 text-xs font-semibold text-[#5B4DF6] hover:underline">Lanjutkan chat →</button>
                            </div>
                        ) : (
                            <p className="pt-4 text-xs text-slate-500 leading-relaxed">Tidak ada draft yang menunggu. Semua proyekmu sudah final atau belum dimulai.</p>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}
