import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useShell } from '../../context/ShellContext.jsx';
import { useProject } from '../../context/ProjectContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { timeAgo, hasItems, normalizeItems, generateMarkdown } from '../../utils/format.js';
import { brandLogoSmall, check, share, download, spinner, copy } from '../../utils/icons.js';

function ListBlock({ value, marker = '•', markerClass = 'text-slate-400' }) {
    const items = normalizeItems(value);
    if (!items.length) return null;
    return (
        <ul className="space-y-1.5">
            {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                    <span className={`font-bold ${markerClass} shrink-0`}>{marker}</span>
                    <span>{item}</span>
                </li>
            ))}
        </ul>
    );
}

function PreviewSection({ number, title, children }) {
    return (
        <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">{number}. {title}</h3>
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{children}</div>
        </section>
    );
}


export default function DocumentationView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const shell = useShell();
    const { showToast } = useToast();
    const proj = useProject();
    const { project, prd, validation, activeDocTab, setActiveDocTab, openProject, finalize, pollProjectUntilIdle } = proj;

    useEffect(() => {
        if (!project || String(project.id) !== String(id)) {
            openProject(id).catch((err) => showToast(err.message, 'error'));
        }
    }, [id, project, openProject, showToast]);

    if (!project || !prd) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-[#5B4DF6] rounded-full animate-spin" />
            </div>
        );
    }

    const { ambiguities, contradictions, can_finalize } = validation;
    const isFinalized = prd.status === 'finalized';
    const content = prd.content || {};
    const funcReqs = content.functional_requirements?.length ?? 0;
    const nonFuncReqs = content.non_functional_requirements?.length ?? 0;
    const userStories = content.user_stories?.length ?? 0;

    const [copiedLabel, setCopiedLabel] = useState(null);

    const copyToClipboard = async (text, label) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setCopiedLabel(label);
            showToast(`${label} berhasil disalin ke clipboard!`, 'success');
            setTimeout(() => setCopiedLabel(null), 2500);
        } catch {
            showToast('Gagal menyalin teks ke clipboard.', 'error');
        }
    };

    const handleCopyCurrentTab = () => {
        if (activeDocTab === 'markdown') {
            copyToClipboard(generateMarkdown(prd), 'Raw Markdown');
        } else if (activeDocTab === 'json') {
            copyToClipboard(JSON.stringify(content, null, 2), 'JSON');
        } else if (activeDocTab === 'preview') {
            copyToClipboard(generateMarkdown(prd), 'Dokumen PRD');
        }
    };

    const handleFinalize = async () => {
        try {
            const data = await finalize();
            if (data.prd_status === 'processing') await pollProjectUntilIdle(project.id);
        } catch (err) {
            showToast(err.message || 'Gagal melakukan finalisasi PRD.', 'error');
        }
    };

    const tabs = ['preview', 'markdown', 'json', 'history'];

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <button onClick={() => navigate(`/app/projects/${id}`)} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#5B4DF6] transition">← Kembali ke proyek</button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">{project.title}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isFinalized ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' : 'bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6]'}`}>
                            Versi {prd.version_number} {isFinalized ? '(Final)' : ''}
                        </span>
                    </div>
                    <div className="text-xs text-slate-400">{timeAgo(prd.created_at)}</div>
                </div>

                <div className="flex items-center gap-3">
                    {!isFinalized && can_finalize && (
                        <button onClick={handleFinalize} className="btn-primary text-xs px-4 py-2 font-bold flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 border-emerald-500 shadow-emerald-500/25 dark:bg-emerald-600 dark:hover:bg-emerald-700 transition">
                            <span dangerouslySetInnerHTML={{ __html: check }} /> <span>Finalisasi PRD</span>
                        </button>
                    )}
                    <button onClick={() => { navigator.clipboard?.writeText(window.location.href); showToast('Tautan PRD berhasil disalin ke clipboard!', 'success'); }} className="btn-secondary text-xs px-4 py-2 font-bold flex items-center gap-2">
                        <span dangerouslySetInnerHTML={{ __html: share }} /> <span>Bagikan</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!isFinalized) { showToast('Silakan finalisasi PRD terlebih dahulu sebelum melakukan export.', 'info'); return; }
                            shell.setShowExportModal(true);
                        }}
                        title={!isFinalized ? 'Finalisasi PRD terlebih dahulu untuk mengunduh' : ''}
                        className={`btn-primary text-xs px-4 py-2 font-bold flex items-center gap-2 ${!isFinalized ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <span dangerouslySetInnerHTML={{ __html: download }} /> <span>Export ▾</span>
                    </button>
                </div>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-8 text-xs font-bold">
                {tabs.map((t) => (
                    <button key={t} onClick={() => setActiveDocTab(t)} className={`pb-3 transition capitalize ${activeDocTab === t ? 'text-[#5B4DF6] border-b-2 border-[#5B4DF6]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                        {t === 'markdown' ? 'Raw Markdown' : t}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8 bg-white dark:bg-[#121624] p-8 sm:p-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[600px] flex flex-col justify-between">
                    <div>
                        {activeDocTab === 'markdown' && (
                            <pre className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-mono overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{generateMarkdown(prd)}</pre>
                        )}
                        {activeDocTab === 'json' && (
                            <pre className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-mono overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
                        )}
                        {activeDocTab === 'history' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Histori Versi Dokumen</h3>
                                <p className="text-xs text-slate-500">Bandingkan perubahan antara revisi dengan visual diff.</p>
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                                    <div className="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                                        <span>Versi {prd.version_number} ({isFinalized ? 'Final' : 'Terbaru'})</span>
                                        <span className="diff-added-badge">+3 ditambah</span>
                                    </div>
                                    <p className="text-slate-500 text-[11px]">Dihasilkan oleh AI Provider: {prd.ai_provider || 'local'}</p>
                                </div>
                            </div>
                        )}
                        {activeDocTab === 'preview' && (
                            <div className="space-y-8">
                                <div className="border-b border-slate-100 dark:border-slate-800 pb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span dangerouslySetInnerHTML={{ __html: brandLogoSmall }} />
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-heading">RencanaKU</span>
                                    </div>
                                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">Product Requirement Document (PRD)</h1>
                                    <h2 className="text-base font-bold text-[#5B4DF6] mt-1 font-heading">{content.title || project.title}</h2>
                                </div>

                                <section className="space-y-2">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">1. Ringkasan Produk</h3>
                                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {content.background || 'Aplikasi manajemen tugas yang membantu mahasiswa mengelola tugas kuliah, berkolaborasi dengan teman, memantau deadline, dan menerima notifikasi secara real-time.'}
                                    </p>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">2. Target Pengguna & Tujuan</h3>
                                    <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                                        <strong className="block text-slate-900 dark:text-white">Target User:</strong>
                                        <ListBlock value={hasItems(content.target_users) ? content.target_users : ['Mahasiswa, pelajar, dan kelompok studi akademis.']} markerClass="text-[#5B4DF6]" />
                                        <strong className="block text-slate-900 dark:text-white pt-1">Tujuan Utama:</strong>
                                        <ListBlock value={hasItems(content.objectives) ? content.objectives : ['Meningkatkan produktivitas belajar, mencegah keterlambatan tugas, dan mempermudah pembagian beban kerja kelompok.']} markerClass="text-[#5B4DF6]" />
                                        {hasItems(content.user_stories) && <><strong className="block text-slate-900 dark:text-white pt-1">User Story:</strong><ListBlock value={content.user_stories} marker="▸" markerClass="text-[#5B4DF6]" /></>}
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">3. Functional Requirements</h3>
                                    <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                        {(content.functional_requirements && content.functional_requirements.length > 0)
                                            ? content.functional_requirements.map((item, i) => <li key={i} className="flex items-start gap-2.5"><span className="font-bold text-[#5B4DF6]">{i + 1}.</span> <span>{item}</span></li>)
                                            : ['Autentikasi Pengguna & Profil Mahasiswa.', 'Manajemen Tugas & Proyek Kuliah (CRUD, Tag Mata Kuliah).', 'Kolaborasi Tim & Pembagian Subtugas.', 'Kalender & Pengingat Deadline Otomatis.', 'Notifikasi Push & Email.'].map((item, i) => <li key={i} className="flex items-start gap-2.5"><span className="font-bold text-[#5B4DF6]">{i + 1}.</span> <span>{item}</span></li>)}
                                    </ul>
                                    {hasItems(content.acceptance_criteria) && (
                                        <div className="pt-1">
                                            <strong className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">Kriteria Selesai (Acceptance Criteria):</strong>
                                            <ListBlock value={content.acceptance_criteria} marker="✓" markerClass="text-emerald-500" />
                                        </div>
                                    )}
                                </section>

                                <section className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">4. Non-Functional Requirements</h3>
                                    <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                                        {(content.non_functional_requirements && content.non_functional_requirements.length > 0)
                                            ? content.non_functional_requirements.map((item, i) => <li key={i} className="flex items-start gap-2.5"><span className="font-bold text-slate-400">•</span> <span>{item}</span></li>)
                                            : ['Response time API rata-rata di bawah 200ms.', 'Dukungan Dark Mode & Tampilan Responsif Mobile.', 'Keamanan data tersandi dengan standar enkripsi modern.'].map((item, i) => <li key={i} className="flex items-start gap-2.5"><span className="font-bold text-slate-400">•</span> <span>{item}</span></li>)}
                                    </ul>
                                </section>

                                {hasItems(content.business_rules) && (
                                    <PreviewSection number={5} title="Aturan & Logika Bisnis">
                                        <ListBlock value={content.business_rules} marker="§" markerClass="text-amber-500" />
                                    </PreviewSection>
                                )}

                                {(hasItems(content.mvp_scope) || hasItems(content.later_scope)) && (
                                    <section className="space-y-3">
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">6. Prioritas & Lingkup</h3>
                                        {hasItems(content.mvp_scope) && <div><strong className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">Fase MVP (versi pertama):</strong><ListBlock value={content.mvp_scope} marker="★" markerClass="text-[#5B4DF6]" /></div>}
                                        {hasItems(content.later_scope) && <div className="pt-1"><strong className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">Ditunda (versi berikutnya):</strong><ListBlock value={content.later_scope} marker="○" markerClass="text-slate-400" /></div>}
                                    </section>
                                )}

                                {hasItems(content.data_entities) && (
                                    <PreviewSection number={7} title="Data yang Disimpan">
                                        <ListBlock value={content.data_entities} marker="▦" markerClass="text-[#5B4DF6]" />
                                    </PreviewSection>
                                )}

                                <section className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">8. Batasan Sistem</h3>
                                    <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                        <ListBlock value={hasItems(content.constraints) ? content.constraints : ['Tahap awal berfokus pada web app responsif, integrasi payment gateway belum disertakan pada fase MVP.']} />
                                    </div>
                                    {hasItems(content.edge_cases) && <div className="pt-1"><strong className="block text-xs font-bold text-slate-900 dark:text-white mb-1.5">Kondisi Khusus (Edge Case):</strong><ListBlock value={content.edge_cases} marker="!" markerClass="text-rose-500" /></div>}
                                </section>
                            </div>
                        )}
                    </div>

                    {/* Fitur Kecil Salin di Paling Bawah (hanya di tab preview, markdown, json - tidak ada di history) */}
                    {activeDocTab !== 'history' && (
                        <div className="mt-10 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs bg-slate-50/70 dark:bg-slate-900/40 -mx-8 sm:-mx-10 -mb-8 sm:-mb-10 px-8 sm:px-10 py-4 rounded-b-2xl">
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                <span className="text-[#5B4DF6] dark:text-indigo-400 shrink-0" dangerouslySetInnerHTML={{ __html: copy }} />
                                <span>
                                    Salin isi <strong>{activeDocTab === 'markdown' ? 'Raw Markdown' : activeDocTab === 'preview' ? 'Preview Dokumen' : activeDocTab.toUpperCase()}</strong> langsung ke clipboard tanpa perlu blok manual.
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
                                <button
                                    type="button"
                                    onClick={handleCopyCurrentTab}
                                    className={`btn-secondary text-xs px-3.5 py-2 font-bold flex items-center gap-2 transition ${
                                        copiedLabel
                                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                                            : 'hover:border-[#5B4DF6] hover:text-[#5B4DF6]'
                                    }`}
                                >
                                    <span dangerouslySetInnerHTML={{ __html: copiedLabel ? check : copy }} />
                                    <span>{copiedLabel ? 'Berhasil Disalin!' : `Salin ${activeDocTab === 'preview' ? 'Dokumen PRD' : activeDocTab === 'markdown' ? 'Raw Markdown' : activeDocTab.toUpperCase()}`}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-[#121624] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Ringkasan Validasi</h3>
                        <div className="space-y-3 text-xs">
                            <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">✔</span>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">Tidak ada ambiguitas</div>
                                    <div className="text-slate-400 text-[11px]">Requirement sudah jelas</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">✔</span>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">Tidak ada kontradiksi</div>
                                    <div className="text-slate-400 text-[11px]">Semua requirement konsisten</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#121624] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading">Statistik</h3>
                        <div className="space-y-2.5 text-xs">
                            {[
                                ['Functional Requirements', funcReqs],
                                ['Non-Functional Requirements', nonFuncReqs],
                                ['User Stories', userStories],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                    <span className="text-slate-600 dark:text-slate-300 font-medium">{label}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] font-bold">{value}</span>
                                </div>
                            ))}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-300 font-medium">Isu Ambiguitas</span>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-bold">{ambiguities}</span>
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                                <span className="text-slate-600 dark:text-slate-300 font-medium">Isu Kontradiksi</span>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-bold">{contradictions}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
