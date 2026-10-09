import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShell } from '../../context/ShellContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProject } from '../../context/ProjectContext.jsx';
import { brandLogoSmall, close } from '../../utils/icons.js';

export default function NewProjectModal() {
    const shell = useShell();
    const { refreshProjects } = useAuth();
    const { createProject, pollProjectUntilIdle, setIsAiTyping } = useProject();
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState(shell.newProjectPrefill || '');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');

        try {
            const data = await createProject({ title, prompt });
            shell.closeNewProjectModal();
            navigate(`/app/projects/${data.project.id}`);

            if (data.prd_status === 'processing') {
                setIsAiTyping(true);
                await pollProjectUntilIdle(data.project.id);
                setIsAiTyping(false);
            }
            await refreshProjects().catch(() => {});
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-white dark:bg-[#121624] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <span dangerouslySetInnerHTML={{ __html: brandLogoSmall }} />
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-heading">Mulai Proyek Baru</h2>
                    </div>
                    <button onClick={shell.closeNewProjectModal} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <span dangerouslySetInnerHTML={{ __html: close }} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Proyek (Opsional)</label>
                        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Aplikasi Manajemen Tugas Mahasiswa" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Ceritakan Ide Kamu *</label>
                        <textarea name="prompt" required rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Saya ingin membuat aplikasi manajemen tugas untuk mahasiswa yang bisa kolaborasi dengan teman, ada deadline, dan notifikasi..." className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                    </div>

                    {error ? <p className="text-xs text-rose-500 font-medium">{error}</p> : null}

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button type="button" onClick={shell.closeNewProjectModal} className="btn-secondary px-5 py-2.5 text-xs font-semibold">Batal</button>
                        <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5 text-xs font-bold shadow-md">
                            {busy ? 'Menyusun draft...' : 'Susun Draft PRD →'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
