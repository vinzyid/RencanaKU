import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProject } from '../../context/ProjectContext.jsx';
import { send, spinner } from '../../utils/icons.js';

const SUGGESTIONS = [
    'Aplikasi manajemen tugas untuk mahasiswa dengan deadline dan kolaborasi tim',
    'Marketplace jasa freelance lokal dengan sistem rating dan pembayaran',
    'Dashboard CRM sederhana untuk tim sales UMKM',
    'Aplikasi booking lapangan futsal dengan jadwal real-time',
];

export default function NewChatView() {
    const { user, refreshProjects } = useAuth();
    const { createProject, resetProjectState } = useProject();
    const navigate = useNavigate();
    const location = useLocation();

    const [input, setInput] = useState(location.state?.prefill || '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        resetProjectState();
        inputRef.current?.focus();
    }, [resetProjectState]);

    // Prefill dari Template: isi ulang setiap kali state navigasi berubah.
    // autoSubmit (dari input ide di Dashboard): langsung mulai chat.
    const autoSubmittedRef = useRef(false);
    useEffect(() => {
        const prefill = location.state?.prefill;
        if (!prefill) return;
        setInput(prefill);
        if (location.state?.autoSubmit && !autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            start(prefill);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    const firstName = (user?.name || '').split(' ')[0];

    const start = async (raw) => {
        const content = raw.trim();
        if (!content || busy) return;
        setBusy(true);
        setError('');
        try {
            // Proyek dibuat kosong dulu (judul sementara "Proyek Baru"), lalu
            // pesan pertama dikirim dari halaman chat. Backend mengganti judul
            // otomatis dari hasil draft PRD pertama.
            const data = await createProject({});
            refreshProjects().catch(() => {});
            navigate(`/app/projects/${data.project.id}`, { state: { initialMessage: content } });
        } catch (err) {
            setError(err.message || 'Gagal memulai proyek baru.');
            setBusy(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        start(input);
    };

    return (
        <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
            <div className="text-center mb-8 space-y-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white font-heading">
                    {firstName ? <>Hai {firstName}, mau bikin apa hari ini?</> : 'Mau bikin apa hari ini?'}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Ceritakan ide aplikasimu. RencanaKU langsung menyusun draft PRD-nya dan proyek otomatis tersimpan di daftar.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 focus-within:ring-2 focus-within:ring-[#5B4DF6] transition">
                <textarea
                    ref={inputRef}
                    rows={3}
                    value={input}
                    disabled={busy}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form.requestSubmit();
                        }
                    }}
                    placeholder="Contoh: Saya ingin membuat aplikasi kasir untuk warung kopi yang bisa catat stok dan laporan harian..."
                    className="w-full bg-transparent px-2 py-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none max-h-60"
                />
                <div className="flex items-center justify-between pt-2">
                    <span className="hidden sm:block text-[11px] text-slate-400 font-medium px-2">Enter untuk kirim · Shift + Enter untuk baris baru</span>
                    <button
                        type="submit"
                        disabled={busy || !input.trim()}
                        className="ml-auto w-10 h-10 rounded-full bg-[#5B4DF6] hover:bg-[#4E3FE3] text-white flex items-center justify-center shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Kirim"
                    >
                        <span className="flex items-center" dangerouslySetInnerHTML={{ __html: busy ? spinner : send }} />
                    </button>
                </div>
            </form>

            {error ? <p className="w-full text-xs text-rose-500 font-medium mt-3 px-2">{error}</p> : null}

            <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        disabled={busy}
                        onClick={() => start(s)}
                        className="text-left px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#121624]/60 text-xs text-slate-600 dark:text-slate-300 hover:border-[#5B4DF6] hover:text-[#5B4DF6] dark:hover:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition disabled:opacity-50"
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}
