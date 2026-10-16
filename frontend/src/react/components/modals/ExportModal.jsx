import { useState } from 'react';
import { useShell } from '../../context/ShellContext.jsx';
import { useProject } from '../../context/ProjectContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { triggerExport } from '../../utils/api.js';
import { close, download, fileMd, fileJson, filePdf, lightbulb } from '../../utils/icons.js';

const FORMATS = [
    { value: 'md', icon: fileMd, label: 'Markdown (.md)', desc: 'Format standar, cocok untuk AI agent' },
    { value: 'json', icon: fileJson, label: 'JSON (.json)', desc: 'Struktur data untuk integrasi' },
    { value: 'pdf', icon: filePdf, label: 'PDF (.pdf)', desc: 'Dokumen siap dibagikan' },
];

export default function ExportModal() {
    const shell = useShell();
    const { project } = useProject();
    const { showToast } = useToast();
    const [format, setFormat] = useState(shell.exportFormat);
    const [busy, setBusy] = useState(false);

    const handleDownload = async () => {
        if (!project) return;
        setBusy(true);
        shell.setExportFormat(format);
        try {
            await triggerExport(project.id, format, project.title);
            shell.setShowExportModal(false);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-white dark:bg-[#121624] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-heading">Export PRD</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Pilih format yang kamu inginkan:</p>
                    </div>
                    <button onClick={() => shell.setShowExportModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <span dangerouslySetInnerHTML={{ __html: close }} />
                    </button>
                </div>

                <div className="space-y-3">
                    {FORMATS.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFormat(f.value)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition text-left ${format === f.value ? 'border-[#5B4DF6] bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0" dangerouslySetInnerHTML={{ __html: f.icon }} />
                                <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">{f.label}</div>
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{f.desc}</div>
                                </div>
                            </div>
                            <input type="radio" name="export-format" value={f.value} checked={format === f.value} readOnly className="text-[#5B4DF6] focus:ring-[#5B4DF6]" />
                        </button>
                    ))}
                </div>

                <button onClick={handleDownload} disabled={busy} className="w-full btn-primary py-3 text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2">
                    <span dangerouslySetInnerHTML={{ __html: download }} /> <span>{busy ? 'Mengunduh...' : 'Download'}</span>
                </button>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5" dangerouslySetInnerHTML={{ __html: lightbulb }} />
                    <span>PRD ini bisa digunakan ke Claude Code, Cursor, atau AI agent lainnya.</span>
                </div>
            </div>
        </div>
    );
}
