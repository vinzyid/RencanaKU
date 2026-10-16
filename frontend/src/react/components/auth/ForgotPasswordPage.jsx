import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { brandLogo, sun, moon, back, spinner } from '../../utils/icons.js';
import { api } from '../../utils/api.js';

const inputClass = 'w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition';

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();

    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        const payload = Object.fromEntries(new FormData(e.target));
        try {
            const data = await api('/forgot-password', { method: 'POST', body: JSON.stringify(payload) });
            setSent(true);
            showToast(data?.message || 'Tautan atur ulang terkirim.', 'success');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#0B0D14] transition-colors">
            <div className="min-h-screen flex flex-col p-6 sm:p-10 lg:p-12">
                <div className="flex items-center justify-between w-full">
                    <button onClick={() => navigate('/auth')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition group">
                        <span dangerouslySetInnerHTML={{ __html: back }} />
                        Kembali ke Masuk
                    </button>
                    <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <span dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center w-full py-10">
                    <div className="w-full max-w-md">
                        <div className="flex items-center gap-3 mb-8">
                            <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                        </div>

                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 font-heading">Lupa kata sandi?</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
                            Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
                        </p>

                        {sent ? (
                            <div className="space-y-5">
                                <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-5">
                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Tautan terkirim</p>
                                    <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
                                        Jika email tersebut terdaftar, tautan atur ulang sudah dikirim. Untuk alamat <span className="font-semibold">Gmail</span>, cek inbox Gmail Anda (termasuk folder Spam/Promotions). Tautan berlaku 60 menit.
                                    </p>
                                </div>
                                <button type="button" onClick={() => { setSent(false); setError(''); }} className="text-xs font-semibold text-[#5B4DF6] hover:underline">
                                    Kirim ke email lain
                                </button>
                                <button onClick={() => navigate('/auth')} className="w-full btn-primary py-3 text-sm font-bold shadow-lg shadow-indigo-500/25">
                                    Kembali ke halaman masuk
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                                    <input name="email" type="email" placeholder="nama@email.com" required className={inputClass} />
                                </div>

                                {error ? <p className="text-xs text-rose-500 font-medium min-h-[1rem]">{error}</p> : <p className="min-h-[1rem]" />}

                                <button type="submit" disabled={busy} className="w-full btn-primary py-3 text-sm font-bold shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2 transition">
                                    {busy
                                        ? <><span dangerouslySetInnerHTML={{ __html: spinner }} /> <span>Mengirim...</span></>
                                        : 'Kirim tautan atur ulang'}
                                </button>
                            </form>
                        )}

                        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8">
                            Belum punya akun?
                            <Link to="/auth" state={{ mode: 'register' }} className="text-[#5B4DF6] font-bold hover:underline ml-1">Daftar sekarang</Link>
                        </p>
                    </div>
                </div>

                <div className="text-center text-[11px] text-slate-400 w-full mt-auto">&copy; 2026 RencanaKU. All rights reserved.</div>
            </div>
        </div>
    );
}
