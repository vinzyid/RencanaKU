import { useState } from 'react';
import { arrowRight, play, chatQuestion, searchAlert, lightning, history } from '../../utils/icons.js';
import { STEPS } from '../../utils/format.js';

const FEATURES = [
    { icon: chatQuestion, title: 'Klarifikasi Pintar', desc: 'AI akan mengajukan pertanyaan terarah untuk memperjelas ide dasar kamu secara bertahap.' },
    { icon: searchAlert, title: 'Deteksi Ambiguitas', desc: 'Menemukan requirement yang masih samar atau ambigu sebelum masuk ke tahap pengodean.' },
    { icon: lightning, title: 'Pengecekan Kontradiksi', desc: 'Memastikan tidak ada dua aturan spesifikasi yang bertentangan satu sama lain.' },
    { icon: history, title: 'Histori & Versioning', desc: 'Simpan setiap iterasi perubahan PRD secara terstruktur dengan fitur penomoran versi unik.' },
];

const TESTIMONIALS = [
    { quote: '"RencanaKU memangkas waktu pembuatan dokumen requirement dari 3 hari menjadi hanya 15 menit. Sangat membantu!"', name: 'Budi Santoso', initials: 'BS', avatarTone: 'from-indigo-500 to-violet-600', role: 'Fullstack Developer' },
    { quote: '"Fitur deteksi kontradiksinya mantap banget. AI coding agent jadi ga bingung lagi baca spek proyek saya."', name: 'Siti Rahma', initials: 'SR', avatarTone: 'from-fuchsia-500 to-purple-600', role: 'Software Engineer' },
    { quote: '"Versioning PRD sangat membantu melacak revisi tugas akhir aplikasi saya. Recommended!"', name: 'Andi Wijaya', initials: 'AW', avatarTone: 'from-blue-500 to-indigo-600', role: 'Mahasiswa Teknik Informatika' },
];

const testimonialStar = '<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.93 5.94 6.56.95-4.75 4.63 1.12 6.54L12 17.47l-5.86 3.09 1.12-6.54L2.51 9.39l6.56-.95L12 2.5z" /></svg>';

const FAQS = [
    { q: 'Apa itu RencanaKU?', a: 'RencanaKU adalah platform berbasis AI untuk membantu kamu membuat dokumen Product Requirement Document (PRD) yang jelas dan siap dieksekusi.' },
    { q: 'Bagaimana cara kerja deteksi ambiguitas dan kontradiksi?', a: 'Sistem AI menganalisis setiap poin requirement untuk menemukan logika yang ambigu atau saling bertentangan, lalu memberi peringatan serta saran perbaikan sebelum spesifikasi dieksekusi.' },
    { q: 'Apakah hasil PRD bisa langsung dipakai untuk AI coding agent seperti Cursor atau Claude?', a: 'Tentu saja! Dokumen PRD diformat secara terstruktur dengan standar industri yang rapi, sehingga siap diumpankan langsung sebagai context prompt ke Cursor, Claude Code, Windsurf, maupun tim developer.' },
    { q: 'Apakah riwayat perubahan dan versi PRD tersimpan secara otomatis?', a: 'Ya, setiap iterasi dan pembaruan PRD dicatat dalam histori revisi terstruktur dengan penomoran versi (v1.0, v1.1, dst.), memudahkan kamu melacak perkembangan ide atau kembali ke versi sebelumnya.' },
    { q: 'Apakah bisa langsung diekspor ke PDF/Markdown?', a: 'Ya, hasil PRD dapat diekspor secara instan dalam format Markdown maupun file dokumen PDF resmi lengkap dengan tata letak profesional.' },
];

function SectionHeading({ kicker, title, subtitle }) {
    return (
        <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#5B4DF6] mb-2 block font-heading">{kicker}</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">{title}</h2>
            {subtitle ? <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">{subtitle}</p> : null}
        </div>
    );
}

export function FiturSection() {
    return (
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center animate-fadeIn">
            <SectionHeading
                kicker="Fitur Unggulan"
                title="Semua yang kamu butuhkan, dalam satu platform."
                subtitle="RencanaKU dirancang khusus untuk memastikan spesifikasi PRD kamu lengkap, jelas, dan siap diproses oleh AI agent."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {FEATURES.map((f) => (
                    <div key={f.title} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800/60 transition group">
                        <div
                            className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#5B4DF6] group-hover:text-white transition duration-300"
                            dangerouslySetInnerHTML={{ __html: f.icon }}
                        />
                        <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2 font-heading">{f.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                    </div>
                ))}
            </div>
        </main>
    );
}

export function CaraKerjaSection() {
    const [activeStep, setActiveStep] = useState(null);
    const stepDetails = [
        'Tuangkan ide awal, masalah yang ingin diselesaikan, dan siapa pengguna utamanya. Tidak perlu rapi—mulai saja dari gambaran besarnya.',
        'AI mengajukan pertanyaan yang relevan untuk menggali tujuan, fitur, alur pengguna, serta batasan proyek secara bertahap.',
        'Setiap requirement diperiksa untuk menemukan bagian yang samar, tidak lengkap, atau saling bertentangan sebelum menjadi spesifikasi final.',
        'Hasil analisis dirangkai menjadi PRD yang terstruktur, lengkap dengan alur, aturan bisnis, dan detail yang mudah dipahami tim.',
        'Unduh PRD dalam format yang siap dibagikan atau langsung digunakan sebagai konteks untuk AI coding agent pilihanmu.',
    ];

    // Setiap koneksi panah punya karakter kurva & warna yang berbeda-beda.
    const arrowVariants = [
        { d: 'M6 36 C 28 36, 28 132, 54 108', hue: '#818CF8', head: 'M54 108 L 46 100 M54 108 L 55 96' },
        { d: 'M6 108 C 22 108, 38 28, 54 36', hue: '#A78BFA', head: 'M54 36 L 46 44 M54 36 L 55 48' },
        { d: 'M6 36 C 16 120, 38 8, 54 108', hue: '#6366F1', head: 'M54 108 L 46 100 M54 108 L 55 96' },
        { d: 'M6 108 C 30 108, 26 44, 54 36', hue: '#8B5CF6', head: 'M54 36 L 46 44 M54 36 L 55 48' },
    ];

    return (
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center animate-fadeIn">
            <div className="text-center max-w-2xl mx-auto mb-12">
                <span className="text-xs font-bold uppercase tracking-widest text-[#5B4DF6] mb-2 block font-heading">Cara Kerja</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">5 Langkah Mudah Menuju PRD Sempurna</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3">Dari ide yang masih mentah hingga dokumen siap eksekusi—ikuti alurnya dan biarkan RencanaKU merapikan sisanya.</p>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-5 md:gap-8">
                {STEPS.map((s, idx) => {
                    const isUp = idx % 2 === 0; // kartu berselang: ganjil di atas, genap turun
                    const isActive = activeStep === idx;
                    return (
                        <div key={s.id} className="relative">
                            <div
                                className={`step-card h-full bg-white dark:bg-slate-900 p-5 rounded-3xl border text-center flex flex-col items-center shadow-sm transition-all duration-300 card-enter cursor-default ${isActive
                                        ? 'border-indigo-300 dark:border-indigo-600 -translate-y-1.5 shadow-xl shadow-indigo-500/15'
                                        : 'border-slate-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-800'
                                    } ${isUp ? 'md:mt-0' : 'md:mt-16'}`}
                                style={{ animationDelay: `${idx * 130}ms` }}
                                onMouseEnter={() => setActiveStep(idx)}
                                onMouseLeave={() => setActiveStep((cur) => (cur === idx ? null : cur))}
                                tabIndex={0}
                                onFocus={() => setActiveStep(idx)}
                                onBlur={() => setActiveStep((cur) => (cur === idx ? null : cur))}
                            >
                                <div className="relative mb-4">
                                    {/* Hexagon nomor langkah */}
                                    <div className={`relative w-12 h-12 flex items-center justify-center transition-transform duration-300 ${isActive ? 'rotate-3' : ''}`}>
                                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                                            <polygon
                                                points="24,2 45,13 45,35 24,46 3,35 3,13"
                                                className={isActive ? 'fill-[#5B4DF6]' : 'fill-indigo-50 dark:fill-indigo-950/60'}
                                                stroke={isActive ? '#4E3FE3' : '#C7D2FE'}
                                                strokeWidth="1.5"
                                            />
                                            <polygon
                                                points="24,2 45,13 45,35 24,46 3,35 3,13"
                                                fill="none"
                                                stroke="#5B4DF6"
                                                strokeWidth="2"
                                                strokeDasharray="60 200"
                                                strokeLinecap="round"
                                                className={`workflow-arrow transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}
                                                style={{ animationDuration: '2.4s' }}
                                            />
                                        </svg>
                                        <span className={`relative font-extrabold text-base font-heading transition-colors duration-300 ${isActive ? 'text-white' : 'text-[#5B4DF6] dark:text-indigo-300'}`}>
                                            {idx + 1}
                                        </span>
                                    </div>
                                </div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 font-heading">{s.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{stepDetails[idx]}</p>
                            </div>

                            {idx < STEPS.length - 1 && (
                                <svg
                                    className="hidden md:block absolute top-1/2 -translate-y-1/2 -right-9 z-10 pointer-events-none overflow-visible"
                                    width="64"
                                    height="180"
                                    viewBox="0 0 64 180"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <defs>
                                        <linearGradient id={`stepGrad${idx}`} x1="0" y1="0" x2="64" y2="180" gradientUnits="userSpaceOnUse">
                                            <stop stopColor={arrowVariants[idx].hue} stopOpacity="0.35" />
                                            <stop offset="0.5" stopColor={arrowVariants[idx].hue} />
                                            <stop offset="1" stopColor={arrowVariants[idx].hue} stopOpacity="0.35" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d={arrowVariants[idx].d}
                                        stroke={`url(#stepGrad${idx})`}
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeDasharray="8 7"
                                        className={`workflow-arrow transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-50'}`}
                                        style={{ animationDelay: `${idx * 0.22}s` }}
                                    />
                                    <path
                                        d={arrowVariants[idx].head}
                                        stroke={arrowVariants[idx].hue}
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-50'}`}
                                    />
                                </svg>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Rel alur tipis di bawah sebagai pemandu visual */}
            <div className="hidden md:block relative mt-6 h-px">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200/50 dark:via-indigo-800/40 to-transparent" />
            </div>
        </main>
    );
}

export function TestimoniSection() {
    const [active, setActive] = useState(null);

    const stats = [
        { value: '4.9', label: 'Rating rata-rata', suffix: '/5' },
        { value: '1.200+', label: 'PRD dibuat' },
        { value: '98%', label: 'Merekomendasikan' },
    ];

    return (
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center animate-fadeIn">
            <SectionHeading
                kicker="Testimoni"
                title="Dipercaya Pengembang & Student Developer"
                subtitle="Cerita nyata dari mereka yang mengubah ide mentah menjadi spesifikasi siap eksekusi bersama RencanaKU."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                {stats.map((s) => (
                    <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center gap-4 shadow-sm">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] flex items-center justify-center">
                            <span dangerouslySetInnerHTML={{ __html: testimonialStar }} />
                        </div>
                        <div className="leading-tight">
                            <div className="text-xl font-extrabold text-slate-900 dark:text-white font-heading">
                                {s.value}
                                {s.suffix ? <span className="text-xs font-bold text-slate-400 ml-0.5">{s.suffix}</span> : null}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TESTIMONIALS.map((t, i) => (
                    <div
                        key={t.name}
                        className={`testimonial-card card-enter relative rounded-3xl border bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col transition-all duration-300 ${active === i
                                ? 'border-indigo-300 dark:border-indigo-700 shadow-xl shadow-indigo-500/15 -translate-y-1'
                                : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-xl hover:shadow-indigo-500/10'
                            }`}
                        style={{ animationDelay: `${i * 120}ms` }}
                        onMouseEnter={() => setActive(i)}
                        onMouseLeave={() => setActive((cur) => (cur === i ? null : cur))}
                        tabIndex={0}
                        onFocus={() => setActive(i)}
                        onBlur={() => setActive((cur) => (cur === i ? null : cur))}
                    >
                        <div className="absolute top-5 right-5 text-6xl leading-none text-indigo-100 dark:text-indigo-950/70 font-heading select-none pointer-events-none">&ldquo;</div>

                        <div className="flex items-center gap-1 mb-4 text-amber-400">
                            {[0, 1, 2, 3, 4].map((k) => (
                                <span
                                    key={k}
                                    className="testimonial-star"
                                    style={{ animationDelay: `${i * 120 + 400 + k * 90}ms` }}
                                    dangerouslySetInnerHTML={{ __html: testimonialStar }}
                                />
                            ))}
                            <span className="ml-1.5 text-[11px] font-bold text-slate-400">5.0</span>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 flex-1">{t.quote}</p>

                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.avatarTone} text-white text-xs font-extrabold flex items-center justify-center shadow-md`}>
                                {t.initials}
                            </div>
                            <div className="leading-tight">
                                <div className="font-bold text-xs text-slate-900 dark:text-white">{t.name}</div>
                                <div className="text-[11px] text-slate-400">{t.role}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}

export function FaqSection() {
    return (
        <main className="flex-1 max-w-4xl mx-auto px-6 py-12 flex flex-col justify-center animate-fadeIn">
            <div className="text-center max-w-xl mx-auto mb-8">
                <span className="text-xs font-bold uppercase tracking-widest text-[#5B4DF6] mb-2 block font-heading">Pertanyaan Umum</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-4">
                {FAQS.map((f) => (
                    <div key={f.q} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-md transition">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{f.q}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{f.a}</p>
                    </div>
                ))}
            </div>
        </main>
    );
}

const CHECKPOINTS = [
    'Deteksi ambiguitas otomatis',
    'Histori revisi terstruktur',
    'Pengecekan kontradiksi',
    'Siap dipakai ke AI agent manapun',
];

export function BerandaSection({ onStart, onDemo }) {
    return (
        <main className="flex-1 max-w-7xl mx-auto px-6 pt-6 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 flex flex-col items-start gap-6">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-[#5B4DF6] dark:text-indigo-400 text-xs font-semibold tracking-wide">
                    <span>✨</span> Spec-first, Better Results
                </div>

                <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white leading-[1.18] tracking-tight font-heading">
                    Dari Ide Kasar<br />Menjadi <span className="text-[#5B4DF6]">PRD yang Siap Dieksekusi.</span>
                </h1>

                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                    RencanaKU membantu kamu mengubah ide menjadi <strong>Product Requirement Document (PRD)</strong> yang terstruktur, jelas, dan bebas kontradiksi — sebelum dipakai ke AI coding agent manapun.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button onClick={onStart} className="btn-primary px-6 py-3 text-base shadow-lg shadow-indigo-500/25">
                        Mulai Gratis <span dangerouslySetInnerHTML={{ __html: arrowRight }} />
                    </button>
                    <button onClick={onDemo} className="btn-secondary px-5 py-3 text-base flex items-center gap-2.5 border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        <span dangerouslySetInnerHTML={{ __html: play }} /> <span>Lihat Demo</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 pt-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {CHECKPOINTS.map((c) => (
                        <div key={c} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] flex items-center justify-center font-bold">✔</span>
                            <span>{c}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-6 relative flex items-center justify-center">
                <div className="absolute w-80 h-80 bg-[#5B4DF6]/15 dark:bg-[#5B4DF6]/25 rounded-full blur-3xl -z-10 animate-glow" />
                <div className="relative w-full max-w-lg px-8 sm:px-10">
                    <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-900">
                        <img src="/images/hero_developer.jpg" alt="Developer RencanaKU" className="w-full h-auto object-cover block" />
                    </div>

                    <div className="hidden sm:block absolute -top-5 right-2 speech-bubble animate-float shadow-xl z-10">Bikin aplikasi manajemen tugas..</div>
                    <div className="hidden sm:block absolute -top-4 -left-6 speech-bubble animate-float shadow-xl z-10" style={{ animationDelay: '-2s' }}>Untuk mahasiswa...</div>

                    <div className="absolute -bottom-4 right-2 bg-gradient-to-r from-indigo-500/90 to-purple-600/90 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg backdrop-blur-md italic z-10">"Ide besar, mulai dari sini!"</div>
                </div>
            </div>
        </main>
    );
}
