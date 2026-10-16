import { useAuth } from '../../context/AuthContext.jsx';
import { useShell } from '../../context/ShellContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { userProfile, palette, lock } from '../../utils/icons.js';

const TABS = [
    { id: 'profile', label: 'Profil Pengguna', icon: userProfile },
    { id: 'preferences', label: 'Preferensi Aplikasi', icon: palette },
    { id: 'security', label: 'Keamanan & Sandi', icon: lock },
];

function tabClass(active) {
    return `w-full text-left px-4 py-2.5 rounded-xl text-xs transition ${active ? 'font-bold text-[#5B4DF6] bg-indigo-50 dark:bg-indigo-950/60' : 'font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`;
}

export default function SettingsView() {
    const { user } = useAuth();
    const shell = useShell();
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Pengaturan Akun</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola preferensi dan informasi pribadi Anda di sini.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => shell.setSettingsTab(t.id)}
                            className={`${tabClass(shell.settingsTab === t.id)} flex items-center gap-2.5`}
                        >
                            <span className="w-4 h-4 flex items-center justify-center shrink-0" dangerouslySetInnerHTML={{ __html: t.icon }} />
                            <span>{t.label}</span>
                        </button>
                    ))}
                </div>

                <div className="md:col-span-2 space-y-8">
                    {shell.settingsTab === 'profile' && (
                        <div className="bg-white dark:bg-[#121624] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 border-b border-slate-100 dark:border-slate-800 pb-3 font-heading">Informasi Profil</h2>
                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); showToast('Pembaruan profil belum diimplementasikan di backend.', 'info'); }}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nama Lengkap</label>
                                        <input type="text" defaultValue={user?.name || ''} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Alamat Email</label>
                                        <input type="email" defaultValue={user?.email || ''} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Role / Peran</label>
                                    <input type="text" value={user?.is_admin ? 'Administrator' : 'Pengguna Standar'} readOnly className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed text-xs" />
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <button type="submit" className="btn-primary px-5 py-2 text-xs font-bold shadow-sm">Simpan Perubahan</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {shell.settingsTab === 'preferences' && (
                        <div className="bg-white dark:bg-[#121624] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 border-b border-slate-100 dark:border-slate-800 pb-3 font-heading">Preferensi Aplikasi</h2>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-slate-900 dark:text-white">Tema Gelap (Dark Mode)</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">Ubah antarmuka aplikasi menjadi mode gelap untuk kenyamanan mata.</div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={theme === 'dark'} onChange={toggleTheme} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#5B4DF6] rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-[#5B4DF6]" />
                                    </label>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-slate-900 dark:text-white">Format Export Default</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">Format file standar saat mengekspor dokumen PRD.</div>
                                    </div>
                                    <select value={shell.exportFormat} onChange={(e) => shell.setExportFormat(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]">
                                        <option value="md">Markdown (.md)</option>
                                        <option value="json">JSON (.json)</option>
                                        <option value="pdf">PDF (.pdf)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {shell.settingsTab === 'security' && (
                        <div className="bg-white dark:bg-[#121624] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-5 border-b border-slate-100 dark:border-slate-800 pb-3 font-heading">Keamanan & Sandi</h2>
                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); showToast('Pergantian password belum diimplementasikan di backend.', 'info'); }}>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Password Lama</label>
                                    <input type="password" placeholder="Masukkan password lama" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Password Baru</label>
                                        <input type="password" placeholder="Minimal 8 karakter" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Konfirmasi Password Baru</label>
                                        <input type="password" placeholder="Ulangi password baru" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]" />
                                    </div>
                                </div>
                                <div className="pt-2 flex justify-end">
                                    <button type="submit" className="btn-secondary border border-slate-200 dark:border-slate-700 px-5 py-2 text-xs font-bold shadow-sm rounded-xl">Perbarui Password</button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
