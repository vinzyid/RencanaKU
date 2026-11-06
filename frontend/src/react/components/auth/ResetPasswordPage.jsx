import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../utils/api.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { brandLogo, sun, moon, spinner, back, key, statCheckCircle } from '../../utils/icons.js';

/**
 * Halaman tujuan tautan atur ulang kata sandi dari email.
 *
 * URL yang dikirim backend: {APP_FRONTEND_URL}/reset-password?token=...&email=...
 * Token divalidasi ulang di backend (PasswordBroker) saat submit; halaman ini
 * hanya mengumpulkan kata sandi baru lalu memanggil POST /api/reset-password.
 */
export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();

    const token = params.get('token') || '';
    const email = params.get('email') || '';
    const invalidLink = useMemo(() => !token || !email, [token, email]);

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Kata sandi minimal 8 karakter.');
            return;
        }
        if (password !== confirm) {
            setError('Konfirmasi kata sandi tidak cocok.');
            return;
        }

        setBusy(true);
        try {
            await api('/reset-password', {
                method: 'POST',
                body: JSON.stringify({ token, email, password, password_confirmation: confirm }),
            });
            setDone(true);
            showToast('Kata sandi berhasil diatur ulang.', 'success');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-white dark:bg-[#0B0D14] transition-colors">
            <div className="flex items-center justify-between p-6 sm:p-10 lg:p-12">
                <Link to="/auth" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition group no-underline">
                    <span dangerouslySetInnerHTML={{ __html: back }} />
                    Kembali ke Halaman Masuk
                </Link>
                <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    <span dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                </button>
            </div>

            <div className="flex-1 flex items-center justify-center px-6 pb-16">
                <div className="w-full max-w-md">
                    <div className="flex items-center gap-3 mb-8 justify-center">
                        <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                        <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                    </div>

                    <div className="bg-white dark:bg-[#121624] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                        {invalidLink ? (
                            <div className="space-y-4 text-center">
                                <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-500">
                                    <span dangerouslySetInnerHTML={{ __html: key }} />
                                </div>
                                <h1 className="text-lg font-extrabold text-slate-900 dark:text-white font-heading">Tautan tidak valid</h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Tautan atur ulang kata sandi tidak lengkap atau sudah kedaluwarsa. Silakan minta tautan baru dari halaman masuk.
                                </p>
                                <button onClick={() => navigate('/auth')} className="btn-primary px-6 py-2.5 text-xs font-bold shadow-md">
                                    Minta Tautan Baru
                                </button>
                            </div>
                        ) : done ? (
                            <div className="space-y-5 text-center">
                                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500">
                                    <span dangerouslySetInnerHTML={{ __html: statCheckCircle }} />
                                </div>
                                <div className="space-y-2">
                                    <h1 className="text-lg font-extrabold text-slate-900 dark:text-white font-heading">Kata sandi diperbarui</h1>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        Kata sandi akun <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span> berhasil diatur ulang. Semua sesi lain sudah keluar.
                                    </p>
                                </div>
                                <button onClick={() => navigate('/auth')} className="btn-primary w-full py-3 text-sm font-bold shadow-md">
                                    Masuk Sekarang
                                </button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">Atur Ulang Kata Sandi</h1>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Buat kata sandi baru untuk <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>.
                                    </p>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Kata Sandi Baru</label>
                                        <div className="relative">
                                            <input
                                                type={showPwd ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Minimal 8 karakter"
                                                required
                                                minLength={8}
                                                autoFocus
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition"
                                            />
                                            <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 text-xs font-semibold">{showPwd ? 'Sembunyikan' : 'Lihat'}</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Konfirmasi Kata Sandi Baru</label>
                                        <input
                                            type={showPwd ? 'text' : 'password'}
                                            value={confirm}
                                            onChange={(e) => setConfirm(e.target.value)}
                                            placeholder="Ulangi kata sandi baru"
                                            required
                                            minLength={8}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition"
                                        />
                                    </div>

                                    {error ? <p className="text-xs text-rose-500 font-medium">{error}</p> : null}

                                    <button type="submit" disabled={busy} className="w-full btn-primary py-3 text-sm font-bold shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2 transition">
                                        {busy
                                            ? <><span dangerouslySetInnerHTML={{ __html: spinner }} /> <span>Menyimpan...</span></>
                                            : 'Simpan Kata Sandi Baru'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>

                    <p className="text-center text-[11px] text-slate-400 mt-8">&copy; 2026 RencanaKU. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
}
