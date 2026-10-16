import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { brandLogo, sun, moon, google, github, spinner, back } from '../../utils/icons.js';
import { API_BASE } from '../../utils/api.js';

// Tentukan halaman awal setelah login: admin langsung ke console, selain itu
// ke workspace.
export function landingPathFor(user) {
    return user?.is_admin ? '/admin/overview' : '/app/dashboard';
}

export default function AuthPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { login, isAuthenticated, user, oauthError } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();

    const [isRegister, setIsRegister] = useState(location.state?.mode === 'register');
    const [showPwd, setShowPwd] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAuthenticated) navigate(landingPathFor(user), { replace: true });
    }, [isAuthenticated, user, navigate]);

    useEffect(() => {
        if (oauthError) setError(oauthError);
    }, [oauthError]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');

        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData);

        try {
            const data = await login(isRegister ? '/register' : '/login', payload);
            navigate(landingPathFor(data.user), { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#0B0D14] transition-colors">
            <div className="lg:col-span-7 flex flex-col min-h-screen lg:min-h-0 p-6 sm:p-10 lg:p-12 relative">
                <div className="flex items-center justify-between w-full">
                    <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition group">
                        <span dangerouslySetInnerHTML={{ __html: back }} />
                        Kembali ke Beranda
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

                        <div className="mb-8">
                            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 font-heading">
                                {isRegister ? 'Buat akun RencanaKU' : 'Masuk ke akun kamu'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {isRegister ? 'Mulai rancang ide requirement kamu secara terstruktur.' : 'Lanjutkan perjalanan dari ide menjadi PRD yang nyata.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {isRegister && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                                    <input name="name" type="text" placeholder="Abyan Bergas" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition" />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                                <input name="email" type="email" placeholder="nama@email.com" required className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition" />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                                    {!isRegister && (
                                        <button type="button" onClick={() => showToast('Fitur lupa password akan segera hadir. 🚧', 'info')} className="text-xs font-semibold text-[#5B4DF6] hover:underline">Lupa password?</button>
                                    )}
                                </div>
                                <div className="relative">
                                    <input name="password" type={showPwd ? 'text' : 'password'} placeholder="Masukkan password" required minLength={8} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition" />
                                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 text-xs font-semibold">{showPwd ? 'Sembunyikan' : 'Lihat'}</button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input type="checkbox" id="remember" className="w-4 h-4 rounded text-[#5B4DF6] focus:ring-[#5B4DF6] border-slate-300" />
                                <label htmlFor="remember" className="text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer">Ingat saya</label>
                            </div>

                            {error ? <p className="text-xs text-rose-500 font-medium min-h-[1rem]">{error}</p> : <p className="min-h-[1rem]" />}

                            <button type="submit" disabled={busy} className="w-full btn-primary py-3 text-sm font-bold shadow-lg shadow-indigo-500/25 flex justify-center items-center gap-2 transition">
                                {busy
                                    ? <><span dangerouslySetInnerHTML={{ __html: spinner }} /> <span>Memproses...</span></>
                                    : (isRegister ? 'Daftar Sekarang' : 'Masuk')}
                            </button>
                        </form>

                        <div className="relative my-6 text-center">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
                            <span className="relative bg-white dark:bg-[#0B0D14] px-4 text-xs text-slate-400 font-medium">atau masuk dengan</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <a href={`${API_BASE}/oauth/google`} className="btn-secondary py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 no-underline">
                                <span dangerouslySetInnerHTML={{ __html: google }} /> Google
                            </a>
                            <a href={`${API_BASE}/oauth/github`} className="btn-secondary py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 no-underline">
                                <span dangerouslySetInnerHTML={{ __html: github }} /> GitHub
                            </a>
                        </div>

                        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-8">
                            {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
                            <button onClick={() => { setIsRegister((v) => !v); setError(''); }} className="text-[#5B4DF6] font-bold hover:underline ml-1">
                                {isRegister ? 'Masuk sekarang' : 'Daftar sekarang'}
                            </button>
                        </p>
                    </div>
                </div>

                <div className="text-center text-[11px] text-slate-400 w-full mt-auto">&copy; 2026 RencanaKU. All rights reserved.</div>
            </div>

            <div className="hidden lg:col-span-5 relative bg-[#1E1B4B] overflow-hidden lg:flex flex-col justify-between p-12 text-white">
                <div className="absolute inset-0 z-0">
                    <img src="/images/auth_banner.jpg" alt="Night Scene RencanaKU" className="w-full h-full object-cover opacity-80 mix-blend-overlay" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#100D2D] via-[#1E1B4B]/70 to-transparent" />
                </div>

                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200">✨ Plan Better, Build Smarter</div>
                </div>

                <div className="relative z-10 space-y-4 max-w-sm">
                    <h2 className="text-3xl font-extrabold leading-tight font-heading">“Ide yang jelas, membuat hasil nyata.”</h2>
                    <p className="text-sm text-indigo-200 leading-relaxed">Dari pemikiran sederhana, menuju produk yang luar biasa bersama RencanaKU.</p>
                    <div className="pt-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">R</div>
                        <div>
                            <div className="text-xs font-bold">RencanaKU Workspace</div>
                            <div className="text-[11px] text-indigo-300">Spec-First AI Generator</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
