import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { brandLogo, sun, moon } from '../../utils/icons.js';
import {
    BerandaSection,
    FiturSection,
    CaraKerjaSection,
    TestimoniSection,
    FaqSection,
} from './LandingSections.jsx';

const TABS = [
    { id: 'beranda', label: 'Beranda' },
    { id: 'fitur', label: 'Fitur' },
    { id: 'cara-kerja', label: 'Cara Kerja' },
    { id: 'testimoni', label: 'Testimoni' },
    { id: 'faq', label: 'FAQ' },
];

export default function LandingPage() {
    const [tab, setTab] = useState('beranda');
    const { theme, toggleTheme } = useTheme();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const goAuth = (mode) => navigate('/auth', { state: { mode } });

    return (
        <div className="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0D14] flex flex-col transition-colors duration-200">
            <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-30">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setTab('beranda')}>
                    <span dangerouslySetInnerHTML={{ __html: brandLogo }} />
                    <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                </div>

                <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={tab === t.id
                                ? 'text-[#5B4DF6] font-bold border-b-2 border-[#5B4DF6] pb-0.5'
                                : 'text-slate-600 dark:text-slate-300 hover:text-[#5B4DF6] transition'}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    <button onClick={toggleTheme} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <span dangerouslySetInnerHTML={{ __html: theme === 'dark' ? sun : moon }} />
                    </button>
                    <button onClick={() => goAuth('login')} className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-[#5B4DF6] transition">Masuk</button>
                    <button onClick={() => goAuth('register')} className="btn-primary text-sm px-5 py-2.5">Daftar</button>
                </div>
            </header>

            {tab === 'fitur' && <FiturSection />}
            {tab === 'cara-kerja' && <CaraKerjaSection />}
            {tab === 'testimoni' && <TestimoniSection />}
            {tab === 'faq' && <FaqSection />}
            {tab === 'beranda' && (
                <BerandaSection
                    onStart={() => goAuth('register')}
                    onDemo={() => {
                        setTab('fitur');
                        showToast('Menampilkan fitur unggulan RencanaKU. 💡', 'info');
                    }}
                />
            )}
        </div>
    );
}
