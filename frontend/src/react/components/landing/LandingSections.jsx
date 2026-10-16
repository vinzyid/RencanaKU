import { arrowRight, play, chatQuestion, searchAlert, lightning, history } from '../../utils/icons.js';
import { STEPS } from '../../utils/format.js';

const FEATURES = [
    { icon: chatQuestion, title: 'Klarifikasi Pintar', desc: 'AI akan mengajukan pertanyaan terarah untuk memperjelas ide dasar kamu secara bertahap.' },
    { icon: searchAlert, title: 'Deteksi Ambiguitas', desc: 'Menemukan requirement yang masih samar atau ambigu sebelum masuk ke tahap pengodean.' },
    { icon: lightning, title: 'Pengecekan Kontradiksi', desc: 'Memastikan tidak ada dua aturan spesifikasi yang bertentangan satu sama lain.' },
    { icon: history, title: 'Histori & Versioning', desc: 'Simpan setiap iterasi perubahan PRD secara terstruktur dengan fitur penomoran versi unik.' },
];

const TESTIMONIALS = [
    { quote: '"RencanaKU memangkas waktu pembuatan dokumen requirement dari 3 hari menjadi hanya 15 menit. Sangat membantu!"', name: 'Budi Santoso', role: 'Fullstack Developer' },
    { quote: '"Fitur deteksi kontradiksinya mantap banget. AI coding agent jadi ga bingung lagi baca spek proyek saya."', name: 'Siti Rahma', role: 'Software Engineer' },
    { quote: '"Versioning PRD sangat membantu melacak revisi tugas akhir aplikasi saya. Recommended!"', name: 'Andi Wijaya', role: 'Mahasiswa Teknik Informatika' },
];

const FAQS = [
    { q: 'Apa itu RencanaKU?', a: 'RencanaKU adalah platform berbasis AI untuk membantu kamu membuat dokumen Product Requirement Document (PRD) yang jelas dan siap dieksekusi.' },
    { q: 'Apakah bisa langsung diekspor ke PDF/Markdown?', a: 'Ya, hasil PRD dapat diekspor secara instan dalam format Markdown maupun PDF resmi.' },
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
    return (
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center animate-fadeIn">
            <div className="text-center max-w-xl mx-auto mb-10">
                <span className="text-xs font-bold uppercase tracking-widest text-[#5B4DF6] mb-2 block font-heading">Cara Kerja</span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-heading">5 Langkah Mudah Menuju PRD Sempurna</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {STEPS.map((s, idx) => (
                    <div key={s.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] font-bold text-sm flex items-center justify-center mb-3">{idx + 1}</div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{s.title}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{s.sub}</p>
                    </div>
                ))}
            </div>
        </main>
    );
}

export function TestimoniSection() {
    return (
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 flex flex-col justify-center animate-fadeIn">
            <SectionHeading kicker="Testimoni" title="Dipercaya Pengembang & Student Developer" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TESTIMONIALS.map((t) => (
                    <div key={t.name} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic mb-4">{t.quote}</p>
                        <div className="font-bold text-xs text-slate-900 dark:text-white">{t.name}</div>
                        <div className="text-[11px] text-slate-400">{t.role}</div>
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
                    <div key={f.q} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
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
