import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useShell } from '../../context/ShellContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../utils/api.js';
import { timeAgo } from '../../utils/format.js';
import { plus, trash } from '../../utils/icons.js';

const ICON_COLORS = [
    'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/70',
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70',
    'bg-rose-50 text-rose-600 dark:bg-rose-950/70',
    'bg-amber-50 text-amber-600 dark:bg-amber-950/70',
    'bg-purple-50 text-purple-600 dark:bg-purple-950/70',
    'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/70',
];

function ProjectCard({ project, index }) {
    const { setProjects } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const iconColor = ICON_COLORS[index % ICON_COLORS.length];
    const version = project.latest_version;
    const versionTag = version ? `v${version.version_number}` : 'v1.0';
    const isFinal = version?.status === 'finalized';

    const handleDelete = async (e) => {
        e.stopPropagation();
        if (!window.confirm('Hapus proyek ini? Tindakan tidak dapat dibatalkan.')) return;
        try {
            await api(`/projects/${project.id}`, { method: 'DELETE' });
            setProjects((prev) => prev.filter((p) => p.id != project.id));
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    return (
        <div onClick={() => navigate(`/app/projects/${project.id}`)} className="h-48 bg-white dark:bg-[#121624] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
            <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center font-bold text-sm`}>
                            {String(project.title || 'P').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#5B4DF6] transition font-heading truncate max-w-[170px]">{project.title}</h3>
                        </div>
                    </div>
                    <button onClick={handleDelete} title="Hapus proyek" className="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <span dangerouslySetInnerHTML={{ __html: trash }} />
                    </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {project.prompt || 'Draft PRD terstruktur untuk kebutuhan proyek.'}
                </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400">
                <span className={`px-2 py-0.5 rounded-full ${isFinal ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60' : 'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/60'} font-bold`}>{versionTag}</span>
                <span>{timeAgo(project.updated_at)}</span>
            </div>
        </div>
    );
}

export default function ProjectsView() {
    const { projects } = useAuth();
    const shell = useShell();

    const filteredProjects = projects.filter((p) => {
        if (!shell.searchQuery) return true;
        return p.title.toLowerCase().includes(shell.searchQuery) ||
            (p.prompt && p.prompt.toLowerCase().includes(shell.searchQuery));
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Proyek Saya</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola semua ide dan PRD kamu di sini.</p>
                </div>

                <div className="flex items-center gap-3">
                    <select className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none">
                        <option>Terbaru</option>
                        <option>Semua</option>
                        <option>Final</option>
                        <option>Draft</option>
                    </select>
                    <button onClick={() => shell.openNewProjectModal()} className="btn-primary text-xs px-4 py-2 font-bold shadow-sm flex items-center gap-2">
                        <span dangerouslySetInnerHTML={{ __html: plus }} /> <span>Proyek Baru</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((project, idx) => (
                    <ProjectCard key={project.id} project={project} index={idx} />
                ))}

                <button onClick={() => shell.openNewProjectModal()} className="h-48 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#5B4DF6] dark:hover:border-[#5B4DF6] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 flex flex-col items-center justify-center p-6 text-center transition group">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-[#5B4DF6] flex items-center justify-center mb-3 group-hover:scale-110 transition">
                        <span dangerouslySetInnerHTML={{ __html: plus }} />
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-white font-heading">Buat Proyek Baru</div>
                    <div className="text-xs text-slate-400 mt-1">Mulai dari ide baru sekarang</div>
                </button>
            </div>
        </div>
    );
}
