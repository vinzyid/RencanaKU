// RencanaKU SPA — Redesigned with Modern Purple Aesthetic & Full Reference Fidelity

const STORAGE_KEY = 'rencanaku_token';
const THEME_KEY = 'rencanaku_theme';

const STEPS = [
    { id: 'input_idea', num: '1', title: 'Input Ide', sub: 'Ceritakan ide kamu' },
    { id: 'clarification', num: '2', title: 'Klarifikasi', sub: 'Jawab pertanyaan AI' },
    { id: 'validation', num: '3', title: 'Validasi', sub: 'Cek ambiguitas & kontradiksi' },
    { id: 'documentation', num: '4', title: 'Dokumentasi', sub: 'Lihat PRD lengkap' },
    { id: 'export', num: '5', title: 'Export', sub: 'Unduh & gunakan' },
];

const state = {
    token: localStorage.getItem(STORAGE_KEY),
    theme: localStorage.getItem(THEME_KEY) || 'light',
    user: null,
    projects: [],
    searchQuery: '',
    selectedFilter: 'all',
    // Proyek aktif
    project: null,
    messages: [],
    prd: null,
    diff: [],
    stage: 'input_idea',
    validation: { ambiguities: 0, contradictions: 0, can_finalize: false },
    versions: null,
    diffRange: null,
    activeDocTab: 'preview', // 'preview' | 'markdown' | 'json' | 'history'
    view: 'dashboard', // 'landing' | 'auth' | 'dashboard' | 'project' | 'documentation'
    authMode: 'login', // 'login' | 'register'
    busy: false,
    showNewProjectModal: false,
    showExportModal: false,
    exportFormat: 'md',
    isAiTyping: false,
};

// ---------------------------------------------------------------------------
// Theme Management
// ---------------------------------------------------------------------------
function initTheme() {
    if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleTheme(root) {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, state.theme);
    initTheme();
    render(root);
}

// ---------------------------------------------------------------------------
// API Helper
// ---------------------------------------------------------------------------
async function api(path, options = {}) {
    const response = await fetch(`/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
            ...(options.headers || {}),
        },
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        let message = data?.message;
        if (!message) {
            if (response.status === 419) {
                message = 'Sesi kadaluarsa. Silakan muat ulang halaman.';
            } else if (response.status === 401) {
                message = 'Sesi tidak valid. Silakan login ulang.';
                logout();
            } else if (response.status === 422) {
                message = data?.errors ? Object.values(data.errors).flat().join(', ') : 'Data tidak valid.';
            } else {
                message = `Terjadi kesalahan (${response.status}).`;
            }
        }
        throw new Error(message);
    }

    return data;
}

// ---------------------------------------------------------------------------
// Utilities & Icons
// ---------------------------------------------------------------------------
const esc = (value) =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

const nl2br = (value) => esc(value).replace(/\n/g, '<br>');

function logout() {
    localStorage.removeItem(STORAGE_KEY);
    state.token = null;
    state.user = null;
    state.projects = [];
    state.project = null;
    state.view = 'landing';
}

function resetProjectState() {
    state.project = null;
    state.messages = [];
    state.prd = null;
    state.diff = [];
    state.stage = 'input_idea';
    state.validation = { ambiguities: 0, contradictions: 0, can_finalize: false };
    state.versions = null;
    state.diffRange = null;
    state.activeDocTab = 'preview';
    state.showExportModal = false;
    state.view = 'dashboard';
}

function timeAgo(dateString) {
    if (!dateString) return 'Baru saja';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Baru saja';
    if (diffSec < 3600) return `Diperbarui ${Math.floor(diffSec / 60)} menit lalu`;
    if (diffSec < 86400) return `Diperbarui ${Math.floor(diffSec / 3600)} jam lalu`;
    return `Diperbarui ${Math.floor(diffSec / 86400)} hari lalu`;
}

// SVG Icons
const icons = {
    brandLogo: `<div class="brand-badge"><span class="tracking-tighter">R</span></div>`,
    brandLogoSmall: `<div class="w-7 h-7 rounded-lg bg-[#5B4DF6] text-white flex items-center justify-center font-extrabold text-sm shadow-md">R</div>`,
    sun: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>`,
    moon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>`,
    bell: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>`,
    plus: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>`,
    search: `<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`,
    check: `<svg class="w-4 h-4 text-emerald-500 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>`,
    checkCircle: `<svg class="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>`,
    paperclip: `<svg class="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>`,
    send: `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>`,
    arrowRight: `<svg class="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>`,
    share: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>`,
    download: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`,
    dots: `<svg class="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>`,
    close: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`,
    google: `<svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3 0-.9.2-1.7.4-2.4L1.6 7.1C.6 9.1 0 11.5 0 14s.6 4.9 1.6 6.9l3.7-2.9c0-.4 0-.8 0-3.3z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.1L1.6 16.1C3.5 19.9 7.4 23 12 23z"/></svg>`,
    github: `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
    play: `<svg class="w-4 h-4 text-[#5B4DF6] inline-block" fill="currentColor" viewBox="0 0 20 20"><path d="M4.518 3.322a1 1 0 00-1.518.86v11.636a1 1 0 001.518.86l10-5.818a1 1 0 000-1.72l-10-5.818z" /></svg>`,
};

// ---------------------------------------------------------------------------
// Main Mount & Router
// ---------------------------------------------------------------------------
export function mountApp(root) {
    initTheme();
    window.addEventListener('popstate', () => route(root));
    if (state.token) {
        state.view = 'dashboard';
    } else {
        state.view = 'landing';
    }
    render(root);
}

function route(root) {
    render(root);
}

function render(root) {
    if (!state.token && state.view !== 'landing' && state.view !== 'auth') {
        state.view = 'landing';
    }

    if (state.view === 'landing') {
        return renderLanding(root);
    }
    if (state.view === 'auth') {
        return renderAuth(root);
    }

    // Authenticated Views: Dashboard, Project Chat/Stepper, Documentation
    renderWorkspaceShell(root);
}

// ---------------------------------------------------------------------------
// 1. Landing Page (Public View)
// ---------------------------------------------------------------------------
function renderLanding(root) {
    root.innerHTML = `
    <div class="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0D14] flex flex-col transition-colors duration-200">
        <!-- Navbar -->
        <header class="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-30">
            <div class="flex items-center gap-3">
                ${icons.brandLogo}
                <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
            </div>
            
            <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
                <a href="#beranda" class="hover:text-[#5B4DF6] text-[#5B4DF6] font-semibold transition">Beranda</a>
                <a href="#fitur" class="hover:text-[#5B4DF6] transition">Fitur</a>
                <a href="#cara-kerja" class="hover:text-[#5B4DF6] transition">Cara Kerja</a>
                <a href="#testimoni" class="hover:text-[#5B4DF6] transition">Testimoni</a>
                <a href="#faq" class="hover:text-[#5B4DF6] transition">FAQ</a>
            </nav>

            <div class="flex items-center gap-3">
                <button id="theme-toggle" class="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    ${state.theme === 'dark' ? icons.sun : icons.moon}
                </button>
                <button id="landing-login" class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-[#5B4DF6] transition">Masuk</button>
                <button id="landing-register" class="btn-primary text-sm px-5 py-2.5">Daftar</button>
            </div>
        </header>

        <!-- Hero Section -->
        <main class="flex-1 max-w-7xl mx-auto px-6 pt-10 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <!-- Left Hero Content -->
            <div class="lg:col-span-6 flex flex-col items-start gap-6">
                <!-- Tag Pill -->
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 text-[#5B4DF6] dark:text-indigo-400 text-xs font-semibold tracking-wide">
                    <span>✨</span> Spec-first, Better Results
                </div>

                <!-- Headline -->
                <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white leading-[1.18] tracking-tight font-heading">
                    Dari Ide Kasar<br>Menjadi <span class="text-[#5B4DF6]">PRD yang Siap Dieksekusi.</span>
                </h1>

                <!-- Subtitle -->
                <p class="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                    RencanaKU membantu kamu mengubah ide menjadi <strong>Product Requirement Document (PRD)</strong> yang terstruktur, jelas, dan bebas kontradiksi — sebelum dipakai ke AI coding agent manapun.
                </p>

                <!-- CTA Buttons -->
                <div class="flex flex-wrap items-center gap-4 pt-2">
                    <button id="hero-cta-start" class="btn-primary px-6 py-3 text-base shadow-lg shadow-indigo-500/25">
                        Mulai Gratis ${icons.arrowRight}
                    </button>
                    <button id="hero-cta-demo" class="btn-secondary px-5 py-3 text-base flex items-center gap-2.5 border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                        ${icons.play} <span>Lihat Demo</span>
                    </button>
                </div>

                <!-- Feature Checkpoints -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 pt-4 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] flex items-center justify-center font-bold">✔</span>
                        <span>Deteksi ambiguitas otomatis</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] flex items-center justify-center font-bold">✔</span>
                        <span>Histori revisi terstruktur</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] flex items-center justify-center font-bold">✔</span>
                        <span>Pengecekan kontradiksi</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] flex items-center justify-center font-bold">✔</span>
                        <span>Siap dipakai ke AI agent manapun</span>
                    </div>
                </div>
            </div>

            <!-- Right Hero Illustration & Mockup Graphics -->
            <div class="lg:col-span-6 relative flex items-center justify-center">
                <!-- Background Ambient Glow -->
                <div class="absolute w-80 h-80 bg-[#5B4DF6]/15 dark:bg-[#5B4DF6]/25 rounded-full blur-3xl -z-10 animate-glow"></div>

                <!-- Main Hero Illustration Canvas -->
                <div class="relative w-full max-w-lg">
                    <div class="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-900">
                        <img src="/images/hero_developer.jpg" alt="Developer RencanaKU" class="w-full h-auto object-cover block">
                    </div>

                    <!-- Floating Speech Bubbles -->
                    <div class="absolute -top-4 right-4 speech-bubble animate-float shadow-xl">
                        Bikin aplikasi manajemen tugas..
                    </div>
                    <div class="absolute top-1/4 -left-6 speech-bubble animate-float shadow-xl" style="animation-delay: -2s;">
                        Untuk mahasiswa...
                    </div>
                    <div class="absolute top-1/2 -left-4 speech-bubble animate-float shadow-xl" style="animation-delay: -3.5s;">
                        Bisa kolaborasi juga...
                    </div>

                    <!-- Floating Inspiring Quote -->
                    <div class="absolute bottom-6 right-2 bg-gradient-to-r from-indigo-500/90 to-purple-600/90 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-lg backdrop-blur-md italic">
                        "Ide besar, mulai dari sini!"
                    </div>

                    <!-- Floating PRD Status Card -->
                    <div class="absolute -bottom-8 -left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl w-48 text-left animate-float" style="animation-delay: -1s;">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white font-heading">PRD</span>
                        </div>
                        <ul class="space-y-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <li class="flex items-center gap-1.5"><span class="text-emerald-500">✔</span> Terstruktur</li>
                            <li class="flex items-center gap-1.5"><span class="text-emerald-500">✔</span> Jelas</li>
                            <li class="flex items-center gap-1.5"><span class="text-emerald-500">✔</span> Bebas kontradiksi</li>
                            <li class="flex items-center gap-1.5"><span class="text-emerald-500">✔</span> Siap dieksekusi</li>
                        </ul>
                    </div>
                </div>
            </div>
        </main>

        <!-- Features Section (Bottom Bar / Cards) -->
        <section id="fitur" class="w-full max-w-7xl mx-auto px-6 pb-20">
            <div class="text-center max-w-xl mx-auto mb-12">
                <span class="text-xs font-bold uppercase tracking-widest text-[#5B4DF6] mb-2 block font-heading">FITUR UNGGULAN</span>
                <h2 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
                    Semua yang kamu butuhkan, dalam satu platform.
                </h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Card 1 -->
                <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-indigo-100 transition group">
                    <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                        💬
                    </div>
                    <h3 class="font-bold text-slate-900 dark:text-white text-base mb-2 font-heading">Klarifikasi Pintar</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        AI akan mengajukan pertanyaan untuk memperjelas ide kamu.
                    </p>
                </div>

                <!-- Card 2 -->
                <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-indigo-100 transition group">
                    <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                        🔍
                    </div>
                    <h3 class="font-bold text-slate-900 dark:text-white text-base mb-2 font-heading">Deteksi Ambiguitas</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Menemukan requirement yang masih tidak jelas secara presisi.
                    </p>
                </div>

                <!-- Card 3 -->
                <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-indigo-100 transition group">
                    <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                        ⚡
                    </div>
                    <h3 class="font-bold text-slate-900 dark:text-white text-base mb-2 font-heading">Pengecekan Kontradiksi</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Memastikan tidak ada requirement yang saling bertentangan.
                    </p>
                </div>

                <!-- Card 4 -->
                <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/80 shadow-sm hover:shadow-md hover:border-indigo-100 transition group">
                    <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition">
                        📜
                    </div>
                    <h3 class="font-bold text-slate-900 dark:text-white text-base mb-2 font-heading">Histori & Versioning</h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Simpan semua revisi dengan detail dan mudah ditelusuri per diff.
                    </p>
                </div>
            </div>
        </section>
    </div>`;

    // Event Listeners
    root.querySelector('#theme-toggle').onclick = () => toggleTheme(root);
    root.querySelector('#landing-login').onclick = () => {
        state.authMode = 'login';
        state.view = 'auth';
        render(root);
    };
    root.querySelector('#landing-register').onclick = () => {
        state.authMode = 'register';
        state.view = 'auth';
        render(root);
    };
    root.querySelector('#hero-cta-start').onclick = () => {
        state.authMode = 'register';
        state.view = 'auth';
        render(root);
    };
    root.querySelector('#hero-cta-demo').onclick = () => {
        // Fast demo login with demo user credentials or open register
        state.authMode = 'login';
        state.view = 'auth';
        render(root);
    };
}

// ---------------------------------------------------------------------------
// 2. Auth Page (Login & Register - Split Screen Design)
// ---------------------------------------------------------------------------
function renderAuth(root) {
    const isRegister = state.authMode === 'register';

    root.innerHTML = `
    <div class="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-[#0B0D14] transition-colors">
        <!-- Left Side: Auth Form -->
        <div class="lg:col-span-7 flex flex-col justify-between p-8 sm:p-14 lg:p-20">
            <!-- Brand header -->
            <div class="flex items-center justify-between">
                <a href="#" id="auth-back-home" class="flex items-center gap-3">
                    ${icons.brandLogo}
                    <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                </a>
                <button id="auth-theme-toggle" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                    ${state.theme === 'dark' ? icons.sun : icons.moon}
                </button>
            </div>

            <!-- Form Container -->
            <div class="w-full max-w-md mx-auto my-10">
                <div class="mb-8">
                    <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white mb-2 font-heading">
                        ${isRegister ? 'Buat akun RencanaKU' : 'Masuk ke akun kamu'}
                    </h1>
                    <p class="text-sm text-slate-500 dark:text-slate-400">
                        ${isRegister ? 'Mulai rancang ide requirement kamu secara terstruktur.' : 'Lanjutkan perjalanan dari ide menjadi PRD yang nyata.'}
                    </p>
                </div>

                <form id="auth-form" class="space-y-4">
                    ${isRegister ? `
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                        <input name="name" type="text" placeholder="Abyan Bergas" required class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition">
                    </div>` : ''}

                    <div>
                        <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                        <input name="email" type="email" placeholder="nama@email.com" required class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition">
                    </div>

                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                            ${!isRegister ? '<a href="#" class="text-xs font-semibold text-[#5B4DF6] hover:underline">Lupa password?</a>' : ''}
                        </div>
                        <div class="relative">
                            <input name="password" id="auth-password" type="password" placeholder="Masukkan password" required minlength="8" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6] transition">
                            <button type="button" id="toggle-pwd" class="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 text-xs font-semibold">Lihat</button>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <input type="checkbox" id="remember" class="w-4 h-4 rounded text-[#5B4DF6] focus:ring-[#5B4DF6] border-slate-300">
                        <label for="remember" class="text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer">Ingat saya</label>
                    </div>

                    <p id="auth-error" class="text-xs text-rose-500 font-medium min-h-[1rem]"></p>

                    <button type="submit" id="auth-submit-btn" class="w-full btn-primary py-3 text-sm font-bold shadow-lg shadow-indigo-500/25">
                        ${isRegister ? 'Daftar Sekarang' : 'Masuk'}
                    </button>
                </form>

                <!-- Social divider -->
                <div class="relative my-6 text-center">
                    <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                    <span class="relative bg-white dark:bg-[#0B0D14] px-4 text-xs text-slate-400 font-medium">atau masuk dengan</span>
                </div>

                <!-- Social buttons -->
                <div class="grid grid-cols-2 gap-3">
                    <button type="button" class="btn-secondary py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2">
                        ${icons.google} Google
                    </button>
                    <button type="button" class="btn-secondary py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2">
                        ${icons.github} GitHub
                    </button>
                </div>

                <!-- Switch login/register -->
                <p class="text-center text-xs text-slate-500 dark:text-slate-400 mt-8">
                    ${isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
                    <a href="#" id="auth-switch-mode" class="text-[#5B4DF6] font-bold hover:underline">
                        ${isRegister ? 'Masuk sekarang' : 'Daftar sekarang'}
                    </a>
                </p>
            </div>

            <!-- Footer note -->
            <div class="text-center text-[11px] text-slate-400">
                &copy; 2026 RencanaKU. All rights reserved.
            </div>
        </div>

        <!-- Right Side: Decorative Creative Night Banner -->
        <div class="hidden lg:col-span-5 relative bg-[#1E1B4B] overflow-hidden lg:flex flex-col justify-between p-12 text-white">
            <div class="absolute inset-0 z-0">
                <img src="/images/auth_banner.jpg" alt="Night Scene RencanaKU" class="w-full h-full object-cover opacity-80 mix-blend-overlay">
                <div class="absolute inset-0 bg-gradient-to-t from-[#100D2D] via-[#1E1B4B]/70 to-transparent"></div>
            </div>

            <div class="relative z-10">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-200">
                    ✨ Plan Better, Build Smarter
                </div>
            </div>

            <div class="relative z-10 space-y-4 max-w-sm">
                <h2 class="text-3xl font-extrabold leading-tight font-heading">
                    “Ide yang jelas, membuat hasil nyata.”
                </h2>
                <p class="text-sm text-indigo-200 leading-relaxed">
                    Dari pemikiran sederhana, menuju produk yang luar biasa bersama RencanaKU.
                </p>
                <div class="pt-4 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">R</div>
                    <div>
                        <div class="text-xs font-bold">RencanaKU Workspace</div>
                        <div class="text-[11px] text-indigo-300">Spec-First AI Generator</div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Events
    root.querySelector('#auth-back-home').onclick = (e) => {
        e.preventDefault();
        state.view = 'landing';
        render(root);
    };

    root.querySelector('#auth-theme-toggle').onclick = () => toggleTheme(root);

    root.querySelector('#auth-switch-mode').onclick = (e) => {
        e.preventDefault();
        state.authMode = isRegister ? 'login' : 'register';
        render(root);
    };

    const pwdInput = root.querySelector('#auth-password');
    const togglePwd = root.querySelector('#toggle-pwd');
    if (togglePwd && pwdInput) {
        togglePwd.onclick = () => {
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                togglePwd.textContent = 'Sembunyikan';
            } else {
                pwdInput.type = 'password';
                togglePwd.textContent = 'Lihat';
            }
        };
    }

    root.querySelector('#auth-form').onsubmit = async (event) => {
        event.preventDefault();
        const submitBtn = root.querySelector('#auth-submit-btn');
        const errorEl = root.querySelector('#auth-error');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memproses...';
        errorEl.textContent = '';

        const formData = new FormData(event.target);
        const payload = Object.fromEntries(formData);

        try {
            const endpoint = isRegister ? '/register' : '/login';
            const data = await api(endpoint, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            state.token = data.token;
            localStorage.setItem(STORAGE_KEY, state.token);
            state.user = data.user;
            state.view = 'dashboard';
            render(root);
        } catch (err) {
            errorEl.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = isRegister ? 'Daftar Sekarang' : 'Masuk';
        }
    };
}

// ---------------------------------------------------------------------------
// 3. Workspace Shell & Navigation (Dashboard, Project, Documentation)
// ---------------------------------------------------------------------------
async function renderWorkspaceShell(root) {
    // If we don't have user yet, fetch user and projects
    if (!state.user && state.token) {
        try {
            const [{ user }, { projects }] = await Promise.all([api('/me'), api('/projects')]);
            state.user = user;
            state.projects = projects;
        } catch {
            logout();
            return render(root);
        }
    }

    const userName = state.user?.name || 'Abyan Bergas';
    const userEmail = state.user?.email || 'abyan@email.com';
    const userInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'RK';

    root.innerHTML = `
    <div class="min-h-screen bg-[#F8F9FD] dark:bg-[#0B0D14] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
        <!-- Sidebar Navigation -->
        <aside class="w-full md:w-64 bg-white dark:bg-[#121624] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0">
            <!-- Top brand & navigation -->
            <div class="p-6">
                <!-- Logo -->
                <div class="flex items-center gap-3 mb-6">
                    ${icons.brandLogo}
                    <span class="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">RencanaKU</span>
                </div>

                <!-- + New Project Button -->
                <button id="sidebar-new-project-btn" class="w-full btn-primary py-3 mb-6 text-sm font-bold flex items-center justify-center gap-2 shadow-md">
                    ${icons.plus} <span>New Project</span>
                </button>

                <!-- Nav Menu Items -->
                <nav class="space-y-1">
                    <a href="#" data-nav="dashboard" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
                        <span class="text-base">📊</span> Dashboard
                    </a>
                    <a href="#" data-nav="projects" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#5B4DF6] bg-indigo-50 dark:bg-indigo-950/60 transition">
                        <span class="text-base">📁</span> Proyek Saya
                    </a>
                    <a href="#" data-nav="templates" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
                        <span class="text-base">📋</span> Template
                    </a>
                    <a href="#" data-nav="history" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
                        <span class="text-base">🕒</span> Riwayat
                    </a>
                    <a href="#" data-nav="settings" class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
                        <span class="text-base">⚙️</span> Pengaturan
                    </a>
                </nav>
            </div>

            <!-- Bottom: Pro Plan Widget & User profile -->
            <div class="p-6 space-y-4">
                <!-- Pro Plan Card -->
                <div class="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm">👑</span>
                        <span class="text-xs font-bold text-slate-900 dark:text-white font-heading">Pro Plan</span>
                    </div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                        Buka semua fitur premium dan batas lebih tinggi.
                    </p>
                    <button class="w-full py-2 bg-[#5B4DF6] hover:bg-[#4E3FE3] text-white text-xs font-bold rounded-xl shadow-sm transition">
                        Upgrade
                    </button>
                </div>

                <!-- User Bar -->
                <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs">
                            ${userInitials}
                        </div>
                        <div class="overflow-hidden">
                            <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${esc(userName)}</div>
                            <div class="text-[11px] text-slate-400 truncate">${esc(userEmail)}</div>
                        </div>
                    </div>
                    <button id="btn-logout" title="Keluar" class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main Workspace Area -->
        <main class="flex-1 flex flex-col min-w-0 overflow-y-auto">
            <!-- Top Header Bar -->
            <header class="h-16 px-6 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#121624]/70 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between gap-4">
                <!-- Search bar -->
                <div class="relative w-full max-w-md">
                    <span class="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">${icons.search}</span>
                    <input id="search-input" type="text" value="${esc(state.searchQuery)}" placeholder="Cari proyek..." class="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]">
                </div>

                <!-- Right actions: Theme toggle, notification, avatar -->
                <div class="flex items-center gap-3">
                    <button id="ws-theme-toggle" class="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        ${state.theme === 'dark' ? icons.sun : icons.moon}
                    </button>
                    <button class="relative p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        ${icons.bell}
                        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-[#5B4DF6] rounded-full"></span>
                    </button>
                    <div class="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                        ${userInitials}
                    </div>
                </div>
            </header>

            <!-- Dynamic Workspace Content -->
            <div id="workspace-content" class="flex-1 p-6 sm:p-8">
                <!-- Injected based on state.view -->
            </div>
        </main>
    </div>

    <!-- Global Modals (New Project Modal & Export Modal) -->
    ${state.showNewProjectModal ? renderNewProjectModal() : ''}
    ${state.showExportModal ? renderExportModal() : ''}
    `;

    // Bind Workspace Shell Events
    root.querySelector('#ws-theme-toggle').onclick = () => toggleTheme(root);
    root.querySelector('#btn-logout').onclick = async () => {
        try { await api('/logout', { method: 'POST' }); } catch {}
        logout();
        render(root);
    };

    root.querySelector('#sidebar-new-project-btn').onclick = () => {
        state.showNewProjectModal = true;
        render(root);
    };

    const searchInput = root.querySelector('#search-input');
    if (searchInput) {
        searchInput.oninput = (e) => {
            state.searchQuery = e.target.value.toLowerCase();
            renderWorkspaceContent(root);
        };
    }

    root.querySelectorAll('[data-nav]').forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            resetProjectState();
            state.view = 'dashboard';
            render(root);
        };
    });

    renderWorkspaceContent(root);
}

// ---------------------------------------------------------------------------
// 4. Render Dynamic Workspace Content
// ---------------------------------------------------------------------------
function renderWorkspaceContent(root) {
    const container = root.querySelector('#workspace-content');
    if (!container) return;

    if (state.view === 'project') {
        renderProjectChatView(root, container);
    } else if (state.view === 'documentation') {
        renderDocumentationView(root, container);
    } else {
        renderProjectsGrid(root, container);
    }
}

// ---------------------------------------------------------------------------
// 5. Dashboard / "Proyek Saya" Grid View
// ---------------------------------------------------------------------------
function renderProjectsGrid(root, container) {
    const filteredProjects = state.projects.filter(p => {
        if (!state.searchQuery) return true;
        return p.title.toLowerCase().includes(state.searchQuery) ||
               (p.prompt && p.prompt.toLowerCase().includes(state.searchQuery));
    });

    container.innerHTML = `
    <div class="space-y-6">
        <!-- Section Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Proyek Saya</h1>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kelola semua ide dan PRD kamu di sini.</p>
            </div>

            <div class="flex items-center gap-3">
                <select class="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none">
                    <option>Terbaru</option>
                    <option>Semua</option>
                    <option>Final</option>
                    <option>Draft</option>
                </select>
                <button id="btn-create-project-top" class="btn-primary text-xs px-4 py-2 font-bold shadow-sm">
                    ${icons.plus} <span>Proyek Baru</span>
                </button>
            </div>
        </div>

        <!-- Project Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            ${filteredProjects.map((project, idx) => projectCard(project, idx)).join('')}

            <!-- "+ Buat Proyek Baru" Dashed Card -->
            <button id="btn-card-create-project" class="h-48 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#5B4DF6] dark:hover:border-[#5B4DF6] hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 flex flex-col items-center justify-center p-6 text-center transition group">
                <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950 text-[#5B4DF6] flex items-center justify-center mb-3 group-hover:scale-110 transition">
                    ${icons.plus}
                </div>
                <div class="text-sm font-bold text-slate-800 dark:text-white font-heading">Buat Proyek Baru</div>
                <div class="text-xs text-slate-400 mt-1">Mulai dari ide baru sekarang</div>
            </button>
        </div>
    </div>`;

    // Events
    const topCreateBtn = container.querySelector('#btn-create-project-top');
    if (topCreateBtn) topCreateBtn.onclick = () => { state.showNewProjectModal = true; render(root); };

    const cardCreateBtn = container.querySelector('#btn-card-create-project');
    if (cardCreateBtn) cardCreateBtn.onclick = () => { state.showNewProjectModal = true; render(root); };

    container.querySelectorAll('[data-open-project]').forEach(btn => {
        btn.onclick = () => openProject(root, btn.dataset.openProject);
    });

    container.querySelectorAll('[data-delete-project]').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Hapus proyek ini? Tindakan tidak dapat dibatalkan.')) {
                try {
                    await api(`/projects/${btn.dataset.deleteProject}`, { method: 'DELETE' });
                    state.projects = state.projects.filter(p => p.id != btn.dataset.deleteProject);
                    render(root);
                } catch (err) {
                    alert(err.message);
                }
            }
        };
    });
}

function projectCard(project, idx) {
    const iconColors = [
        'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/70',
        'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70',
        'bg-rose-50 text-rose-600 dark:bg-rose-950/70',
        'bg-amber-50 text-amber-600 dark:bg-amber-950/70',
        'bg-purple-50 text-purple-600 dark:bg-purple-950/70',
        'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/70',
    ];
    const iconColor = iconColors[idx % iconColors.length];
    const version = project.latest_version;
    const versionTag = version ? `v${version.version_number}` : 'v1.0';
    const isFinal = version?.status === 'finalized';

    return `
    <div data-open-project="${project.id}" class="h-48 bg-white dark:bg-[#121624] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:shadow-md transition cursor-pointer flex flex-col justify-between group">
        <div>
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl ${iconColor} flex items-center justify-center font-bold text-sm">
                        ${esc(project.title.slice(0, 1).toUpperCase())}
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#5B4DF6] transition font-heading truncate max-w-[170px]">
                            ${esc(project.title)}
                        </h3>
                    </div>
                </div>

                <div class="relative group/menu">
                    <button data-delete-project="${project.id}" title="Hapus proyek" class="p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                ${esc(project.prompt || 'Draft PRD terstruktur untuk kebutuhan proyek.')}
            </p>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400">
            <span class="px-2 py-0.5 rounded-full ${isFinal ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60' : 'bg-indigo-50 text-[#5B4DF6] dark:bg-indigo-950/60'} font-bold">
                ${versionTag}
            </span>
            <span>${timeAgo(project.updated_at)}</span>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// 6. Stepper & Interactive Chat Workflow View
// ---------------------------------------------------------------------------
function renderProjectChatView(root, container) {
    const project = state.project;
    if (!project) {
        state.view = 'dashboard';
        return render(root);
    }

    container.innerHTML = `
    <div class="space-y-6 max-w-5xl mx-auto">
        <!-- Sticky Stepper Bar -->
        <div class="bg-white dark:bg-[#121624] p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            ${renderStepper()}
        </div>

        <!-- Chat Card Container -->
        <div class="bg-white dark:bg-[#121624] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col h-[650px] overflow-hidden">
            <!-- Header inside chat -->
            <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <button id="chat-back-btn" class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 class="text-base font-bold text-slate-900 dark:text-white font-heading">${esc(project.title)}</h2>
                        <span class="text-[11px] font-semibold text-[#5B4DF6]">${esc(stageLabel(state.stage))}</span>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    ${state.prd ? `
                    <button id="btn-view-doc" class="btn-secondary text-xs px-3.5 py-1.5 font-bold flex items-center gap-1.5">
                        📄 Lihat Dokumen PRD
                    </button>` : ''}
                </div>
            </div>

            <!-- Chat Messages Scroll Area -->
            <div id="chat-thread" class="flex-1 p-6 overflow-y-auto space-y-6">
                ${renderChatThread()}
                ${state.isAiTyping ? renderTypingIndicator() : ''}
            </div>

            <!-- Bottom Composer -->
            <div class="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                <form id="chat-form" class="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#5B4DF6]">
                    <button type="button" class="p-1">${icons.paperclip}</button>
                    <textarea id="chat-input" rows="1" placeholder="Tulis pesanmu di sini..." class="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none max-h-32"></textarea>
                    <div class="hidden sm:block text-[11px] text-slate-400 shrink-0 font-medium">Shift + Enter untuk baris baru</div>
                    <button type="submit" id="chat-send" class="w-8 h-8 rounded-full bg-[#5B4DF6] hover:bg-[#4E3FE3] text-white flex items-center justify-center shrink-0 shadow-sm transition">
                        ${icons.send}
                    </button>
                </form>
                <p id="chat-error" class="text-xs text-rose-500 font-medium mt-2 px-2"></p>
            </div>
        </div>
    </div>`;

    // Events
    container.querySelector('#chat-back-btn').onclick = () => {
        resetProjectState();
        render(root);
    };

    const viewDocBtn = container.querySelector('#btn-view-doc');
    if (viewDocBtn) {
        viewDocBtn.onclick = () => {
            state.view = 'documentation';
            render(root);
        };
    }

    mountChatInteractions(root, container);
}

function renderStepper() {
    const currentIndex = STEPS.findIndex(s => s.id === state.stage);

    return `
    <div class="flex items-center justify-between relative">
        ${STEPS.map((step, idx) => {
            const isCompleted = idx < currentIndex;
            const isActive = idx === currentIndex;
            const circleClass = isCompleted
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                : isActive
                    ? 'bg-[#5B4DF6] text-white ring-4 ring-indigo-100 dark:ring-indigo-950 shadow-md shadow-indigo-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700';

            return `
            <div class="flex items-center gap-3 z-10">
                <div class="w-8 h-8 rounded-full ${circleClass} flex items-center justify-center font-bold text-xs transition-all">
                    ${isCompleted ? '✓' : step.num}
                </div>
                <div class="hidden md:block">
                    <div class="text-xs font-bold ${isActive ? 'text-[#5B4DF6]' : isCompleted ? 'text-slate-800 dark:text-white' : 'text-slate-400 font-heading'}">${step.title}</div>
                    <div class="text-[10px] text-slate-400">${step.sub}</div>
                </div>
            </div>
            ${idx < STEPS.length - 1 ? `
            <div class="flex-1 h-[2px] mx-2 sm:mx-4 ${idx < currentIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'} transition-all"></div>
            ` : ''}
            `;
        }).join('')}
    </div>`;
}

function renderChatThread() {
    if (!state.messages.length) {
        return `
        <div class="flex items-start gap-3.5">
            <div class="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">R</div>
            <div class="space-y-2 max-w-xl">
                <div class="chat-bubble-ai p-4">
                    <div class="text-xs sm:text-sm leading-relaxed">
                        Halo! Aku <strong>RencanaKU</strong>, siap membantu mengubah ide kamu menjadi PRD yang terstruktur dan bebas kontradiksi.<br><br>Mau bikin apa hari ini?
                    </div>
                </div>
                <div class="text-[10px] text-slate-400 px-1">Baru saja</div>
            </div>
        </div>`;
    }

    return state.messages.map(message => {
        const isUser = message.sender === 'user';
        const chips = (message.quick_replies || [])
            .map(chip => `<button data-chip="${esc(chip)}" class="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 hover:bg-[#5B4DF6] hover:text-white transition">${esc(chip)}</button>`)
            .join('');

        if (isUser) {
            return `
            <div class="flex justify-end">
                <div class="space-y-1.5 max-w-lg">
                    <div class="chat-bubble-user p-4 text-xs sm:text-sm leading-relaxed">
                        ${nl2br(message.content)}
                    </div>
                    <div class="text-[10px] text-slate-400 text-right px-1">Terkirim</div>
                </div>
            </div>`;
        }

        return `
        <div class="flex items-start gap-3.5">
            <div class="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">R</div>
            <div class="space-y-3 max-w-xl">
                <div class="chat-bubble-ai p-4 text-xs sm:text-sm leading-relaxed space-y-2">
                    <div>${nl2br(message.content)}</div>
                    ${chips ? `<div class="pt-2 flex flex-wrap gap-2">${chips}</div>` : ''}
                </div>
                <div class="text-[10px] text-slate-400 px-1">${timeAgo(message.created_at)}</div>
            </div>
        </div>`;
    }).join('');
}

function renderTypingIndicator() {
    return `
    <div class="flex items-start gap-3.5">
        <div class="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">R</div>
        <div class="chat-bubble-ai p-4 space-y-2">
            <div class="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                <span>RencanaKU sedang memproses ide kamu...</span>
            </div>
            <div class="flex items-center gap-1.5 pt-1">
                <div class="w-2 h-2 rounded-full bg-[#5B4DF6] typing-dot"></div>
                <div class="w-2 h-2 rounded-full bg-[#5B4DF6] typing-dot"></div>
                <div class="w-2 h-2 rounded-full bg-[#5B4DF6] typing-dot"></div>
            </div>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// 7. PRD Detail & Documentation View (Tabs: Preview, Markdown, JSON, History)
// ---------------------------------------------------------------------------
function renderDocumentationView(root, container) {
    const project = state.project;
    const prd = state.prd;

    if (!project || !prd) {
        state.view = 'project';
        return render(root);
    }

    const { ambiguities, contradictions, can_finalize } = state.validation;
    const isFinalized = prd.status === 'finalized';

    // Count statistics
    const funcReqs = prd.content?.functional_requirements?.length || 12;
    const nonFuncReqs = prd.content?.non_functional_requirements?.length || 5;
    const userStories = 8;

    container.innerHTML = `
    <div class="space-y-6 max-w-6xl mx-auto">
        <!-- Breadcrumb & Top Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
                <button id="doc-back-btn" class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#5B4DF6] transition">
                    ← Kembali ke proyek
                </button>
                <div class="flex items-center gap-3">
                    <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">${esc(project.title)}</h1>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6]">
                        Versi ${prd.version_number}
                    </span>
                </div>
                <div class="text-xs text-slate-400">${timeAgo(prd.created_at)}</div>
            </div>

            <!-- Action buttons: Share & Export -->
            <div class="flex items-center gap-3">
                <button id="btn-share-prd" class="btn-secondary text-xs px-4 py-2 font-bold flex items-center gap-2">
                    ${icons.share} <span>Bagikan</span>
                </button>
                <button id="btn-open-export" class="btn-primary text-xs px-4 py-2 font-bold flex items-center gap-2">
                    ${icons.download} <span>Export ▾</span>
                </button>
            </div>
        </div>

        <!-- Document Tabs Nav -->
        <div class="border-b border-slate-200 dark:border-slate-800 flex items-center gap-8 text-xs font-bold">
            <button data-tab="preview" class="pb-3 ${state.activeDocTab === 'preview' ? 'text-[#5B4DF6] border-b-2 border-[#5B4DF6]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} transition">Preview</button>
            <button data-tab="markdown" class="pb-3 ${state.activeDocTab === 'markdown' ? 'text-[#5B4DF6] border-b-2 border-[#5B4DF6]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} transition">Raw Markdown</button>
            <button data-tab="json" class="pb-3 ${state.activeDocTab === 'json' ? 'text-[#5B4DF6] border-b-2 border-[#5B4DF6]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} transition">JSON</button>
            <button data-tab="history" class="pb-3 ${state.activeDocTab === 'history' ? 'text-[#5B4DF6] border-b-2 border-[#5B4DF6]' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} transition">History</button>
        </div>

        <!-- 2 Column Layout: Main Document Card & Right Widgets -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <!-- Left Column: Document Canvas -->
            <div class="lg:col-span-8 bg-white dark:bg-[#121624] p-8 sm:p-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm min-h-[600px]">
                ${renderActiveDocumentContent(prd)}
            </div>

            <!-- Right Column: Validation & Statistics Widgets -->
            <div class="lg:col-span-4 space-y-6">
                <!-- Ringkasan Validasi Card -->
                <div class="bg-white dark:bg-[#121624] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">Ringkasan Validasi</h3>
                    
                    <div class="space-y-3 text-xs">
                        <div class="flex items-start gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">✔</span>
                            <div>
                                <div class="font-bold text-slate-800 dark:text-slate-200">Tidak ada ambiguitas</div>
                                <div class="text-slate-400 text-[11px]">Requirement sudah jelas</div>
                            </div>
                        </div>

                        <div class="flex items-start gap-2.5">
                            <span class="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">✔</span>
                            <div>
                                <div class="font-bold text-slate-800 dark:text-slate-200">Tidak ada kontradiksi</div>
                                <div class="text-slate-400 text-[11px]">Semua requirement konsisten</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Statistik Card -->
                <div class="bg-white dark:bg-[#121624] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
                    <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">Statistik</h3>

                    <div class="space-y-2.5 text-xs">
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span class="text-slate-600 dark:text-slate-300 font-medium">Functional Requirements</span>
                            <span class="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] font-bold">${funcReqs}</span>
                        </div>
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span class="text-slate-600 dark:text-slate-300 font-medium">Non-Functional Requirements</span>
                            <span class="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] font-bold">${nonFuncReqs}</span>
                        </div>
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span class="text-slate-600 dark:text-slate-300 font-medium">User Stories</span>
                            <span class="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 text-[#5B4DF6] font-bold">${userStories}</span>
                        </div>
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span class="text-slate-600 dark:text-slate-300 font-medium">Isu Ambiguitas</span>
                            <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-bold">${ambiguities}</span>
                        </div>
                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <span class="text-slate-600 dark:text-slate-300 font-medium">Isu Kontradiksi</span>
                            <span class="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-bold">${contradictions}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    // Events
    container.querySelector('#doc-back-btn').onclick = () => {
        state.view = 'project';
        render(root);
    };

    container.querySelector('#btn-open-export').onclick = () => {
        state.showExportModal = true;
        render(root);
    };

    container.querySelector('#btn-share-prd').onclick = () => {
        navigator.clipboard?.writeText(window.location.href);
        alert('Tautan PRD berhasil disalin ke clipboard!');
    };

    container.querySelectorAll('[data-tab]').forEach(tabBtn => {
        tabBtn.onclick = () => {
            state.activeDocTab = tabBtn.dataset.tab;
            render(root);
        };
    });
}

function renderActiveDocumentContent(prd) {
    const content = prd.content || {};

    if (state.activeDocTab === 'markdown') {
        const mdText = generateMarkdown(prd);
        return `<pre class="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-mono overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre-wrap">${esc(mdText)}</pre>`;
    }

    if (state.activeDocTab === 'json') {
        return `<pre class="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-mono overflow-x-auto text-slate-800 dark:text-slate-200 whitespace-pre-wrap">${esc(JSON.stringify(content, null, 2))}</pre>`;
    }

    if (state.activeDocTab === 'history') {
        return renderHistoryTabContent();
    }

    // Default: 'preview' Document Canvas
    return `
    <div class="space-y-8">
        <!-- Document Title & Header -->
        <div class="border-b border-slate-100 dark:border-slate-800 pb-6">
            <div class="flex items-center gap-2 mb-3">
                ${icons.brandLogoSmall}
                <span class="text-xs font-extrabold uppercase tracking-wider text-slate-400 font-heading">RencanaKU</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
                Product Requirement Document (PRD)
            </h1>
            <h2 class="text-base font-bold text-[#5B4DF6] mt-1 font-heading">
                ${esc(content.title || state.project.title)}
            </h2>
        </div>

        <!-- 1. Ringkasan Produk -->
        <section class="space-y-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">1. Ringkasan Produk</h3>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ${nl2br(content.background || 'Aplikasi manajemen tugas yang membantu mahasiswa mengelola tugas kuliah, berkolaborasi dengan teman, memantau deadline, dan menerima notifikasi secara real-time.')}
            </p>
        </section>

        <!-- 2. Tujuan & Target Pengguna -->
        <section class="space-y-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">2. Target Pengguna & Tujuan</h3>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Target User:</strong> ${nl2br(content.target_users || 'Mahasiswa, pelajar, dan kelompok studi akademis.')}<br>
                <strong>Tujuan Utama:</strong> ${nl2br(content.objectives || 'Meningkatkan produktivitas belajar, mencegah keterlambatan tugas, dan mempermudah pembagian beban kerja kelompok.')}
            </p>
        </section>

        <!-- 3. Functional Requirements -->
        <section class="space-y-3">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">3. Functional Requirements</h3>
            <ul class="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                ${(content.functional_requirements && content.functional_requirements.length > 0)
                    ? content.functional_requirements.map((item, i) => `<li class="flex items-start gap-2.5"><span class="font-bold text-[#5B4DF6]">${i+1}.</span> <span>${esc(item)}</span></li>`).join('')
                    : `
                    <li class="flex items-start gap-2.5"><span class="font-bold text-[#5B4DF6]">1.</span> <span>Autentikasi Pengguna & Profil Mahasiswa.</span></li>
                    <li class="flex items-start gap-2.5"><span class="font-bold text-[#5B4DF6]">2.</span> <span>Manajemen Tugas & Proyek Kuliah (CRUD, Tag Mata Kuliah).</span></li>
                    <li class="flex items-start gap-2.5"><span class="font-bold text-[#5B4DF6]">3.</span> <span>Kolaborasi Tim & Pembagian Subtugas.</span></li>
                    <li class="flex items-start gap-2.5"><span class="font-bold text-[#5B4DF6]">4.</span> <span>Kalender & Pengingat Deadline Otomatis.</span></li>
                    <li class="flex items-start gap-2.5"><span class="font-bold text-[#5B4DF6]">5.</span> <span>Notifikasi Push & Email.</span></li>
                    `
                }
            </ul>
        </section>

        <!-- 4. Non-Functional Requirements -->
        <section class="space-y-3">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">4. Non-Functional Requirements</h3>
            <ul class="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                ${(content.non_functional_requirements && content.non_functional_requirements.length > 0)
                    ? content.non_functional_requirements.map((item, i) => `<li class="flex items-start gap-2.5"><span class="font-bold text-slate-400">•</span> <span>${esc(item)}</span></li>`).join('')
                    : `
                    <li class="flex items-start gap-2.5"><span class="font-bold text-slate-400">•</span> <span>Response time API rata-rata di bawah 200ms.</span></li>
                    <li class="flex items-start gap-2.5"><span class="font-bold text-slate-400">•</span> <span>Dukungan Dark Mode & Tampilan Responsif Mobile.</span></li>
                    <li class="flex items-start gap-2.5"><span class="font-bold text-slate-400">•</span> <span>Keamanan data tersandi dengan standar enkripsi modern.</span></li>
                    `
                }
            </ul>
        </section>

        <!-- 5. Batasan & Pertanyaan Terbuka -->
        <section class="space-y-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">5. Batasan Sistem</h3>
            <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ${nl2br(content.constraints || 'Tahap awal berfokus pada web app responsif, integrasi payment gateway belum disertakan pada fase MVP.')}
            </p>
        </section>
    </div>`;
}

function renderHistoryTabContent() {
    return `
    <div class="space-y-4">
        <h3 class="text-sm font-bold text-slate-900 dark:text-white font-heading">Histori Versi Dokumen</h3>
        <p class="text-xs text-slate-500">Bandingkan perubahan antara revisi dengan visual diff.</p>
        <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <div class="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                <span>Versi 1.2 (Terbaru)</span>
                <span class="diff-added-badge">+3 ditambah</span>
            </div>
            <p class="text-slate-500 text-[11px]">Memperjelas requirement non-fungsional dan menambahkan fitur notifikasi deadline.</p>
        </div>
    </div>`;
}

function generateMarkdown(prd) {
    const c = prd.content || {};
    return `# Product Requirement Document (PRD)
## ${c.title || 'RencanaKU Project'}

### 1. Ringkasan & Latar Belakang
${c.background || ''}

### 2. Tujuan & Target User
- **Target User:** ${c.target_users || ''}
- **Tujuan:** ${c.objectives || ''}

### 3. Functional Requirements
${(c.functional_requirements || []).map((r, i) => `${i+1}. ${r}`).join('\n')}

### 4. Non-Functional Requirements
${(c.non_functional_requirements || []).map(r => `- ${r}`).join('\n')}

### 5. Batasan
${c.constraints || ''}
`;
}

// ---------------------------------------------------------------------------
// 8. Modals: New Project Modal & Export Modal
// ---------------------------------------------------------------------------
function renderNewProjectModal() {
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div class="w-full max-w-lg bg-white dark:bg-[#121624] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5">
                    ${icons.brandLogoSmall}
                    <h2 class="text-lg font-extrabold text-slate-900 dark:text-white font-heading">Mulai Proyek Baru</h2>
                </div>
                <button id="close-new-project-modal" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    ${icons.close}
                </button>
            </div>

            <form id="new-project-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Proyek (Opsional)</label>
                    <input name="title" placeholder="Contoh: Aplikasi Manajemen Tugas Mahasiswa" class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Ceritakan Ide Kamu *</label>
                    <textarea name="prompt" required rows="4" placeholder="Saya ingin membuat aplikasi manajemen tugas untuk mahasiswa yang bisa kolaborasi dengan teman, ada deadline, dan notifikasi..." class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#5B4DF6]"></textarea>
                </div>

                <p id="new-project-error" class="text-xs text-rose-500 font-medium"></p>

                <div class="flex items-center justify-end gap-3 pt-2">
                    <button type="button" id="cancel-new-project-btn" class="btn-secondary px-5 py-2.5 text-xs font-semibold">Batal</button>
                    <button type="submit" id="submit-new-project-btn" class="btn-primary px-6 py-2.5 text-xs font-bold shadow-md">
                        Susun Draft PRD →
                    </button>
                </div>
            </form>
        </div>
    </div>`;
}

function renderExportModal() {
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div class="w-full max-w-md bg-white dark:bg-[#121624] rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <!-- Modal Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-extrabold text-slate-900 dark:text-white font-heading">Export PRD</h2>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Pilih format yang kamu inginkan:</p>
                </div>
                <button id="close-export-modal" class="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    ${icons.close}
                </button>
            </div>

            <!-- Format Options -->
            <div class="space-y-3">
                <!-- Option 1: Markdown -->
                <label class="flex items-center justify-between p-4 rounded-2xl border ${state.exportFormat === 'md' ? 'border-[#5B4DF6] bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800'} cursor-pointer transition">
                    <div class="flex items-center gap-3">
                        <span class="text-xl">📄</span>
                        <div>
                            <div class="text-xs font-bold text-slate-900 dark:text-white">Markdown (.md)</div>
                            <div class="text-[11px] text-slate-500 dark:text-slate-400">Format standar, cocok untuk AI agent</div>
                        </div>
                    </div>
                    <input type="radio" name="export-format" value="md" ${state.exportFormat === 'md' ? 'checked' : ''} class="text-[#5B4DF6] focus:ring-[#5B4DF6]">
                </label>

                <!-- Option 2: JSON -->
                <label class="flex items-center justify-between p-4 rounded-2xl border ${state.exportFormat === 'json' ? 'border-[#5B4DF6] bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800'} cursor-pointer transition">
                    <div class="flex items-center gap-3">
                        <span class="text-xl">📦</span>
                        <div>
                            <div class="text-xs font-bold text-slate-900 dark:text-white">JSON (.json)</div>
                            <div class="text-[11px] text-slate-500 dark:text-slate-400">Struktur data untuk integrasi</div>
                        </div>
                    </div>
                    <input type="radio" name="export-format" value="json" ${state.exportFormat === 'json' ? 'checked' : ''} class="text-[#5B4DF6] focus:ring-[#5B4DF6]">
                </label>

                <!-- Option 3: PDF -->
                <label class="flex items-center justify-between p-4 rounded-2xl border ${state.exportFormat === 'pdf' ? 'border-[#5B4DF6] bg-indigo-50/50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800'} cursor-pointer transition">
                    <div class="flex items-center gap-3">
                        <span class="text-xl">📑</span>
                        <div>
                            <div class="text-xs font-bold text-slate-900 dark:text-white">PDF (.pdf)</div>
                            <div class="text-[11px] text-slate-500 dark:text-slate-400">Dokumen siap dibagikan</div>
                        </div>
                    </div>
                    <input type="radio" name="export-format" value="pdf" ${state.exportFormat === 'pdf' ? 'checked' : ''} class="text-[#5B4DF6] focus:ring-[#5B4DF6]">
                </label>
            </div>

            <!-- Download Button -->
            <button id="btn-do-download" class="w-full btn-primary py-3 text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2">
                ${icons.download} <span>Download</span>
            </button>

            <!-- Footer Helper Note -->
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-2">
                <span>💡</span>
                <span>PRD ini bisa digunakan ke Claude Code, Cursor, atau AI agent lainnya.</span>
            </div>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// 9. Handlers & Interactivity Mounting
// ---------------------------------------------------------------------------
function mountChatInteractions(root, container) {
    const form = container.querySelector('#chat-form');
    if (!form) return;

    const input = form.querySelector('#chat-input');
    const thread = container.querySelector('#chat-thread');

    const scrollToBottom = () => {
        if (thread) thread.scrollTop = thread.scrollHeight;
    };

    // Auto-resize
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    });

    // Send with Enter
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const content = input.value.trim();
        if (!content) return;
        input.value = '';
        input.style.height = 'auto';
        await handleSendMessage(root, content);
    };

    container.querySelectorAll('[data-chip]').forEach(chip => {
        chip.onclick = async () => {
            await handleSendMessage(root, chip.dataset.chip);
        };
    });

    setTimeout(scrollToBottom, 50);
}

async function handleSendMessage(root, content) {
    if (!content || !state.project) return;

    // Optimistic user message
    state.messages.push({
        id: `tmp-${Date.now()}`,
        sender: 'user',
        content,
        created_at: new Date().toISOString()
    });
    state.isAiTyping = true;
    render(root);

    try {
        const data = await api(`/projects/${state.project.id}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
        applyProjectPayload(data);
    } catch (err) {
        state.messages = state.messages.filter(m => !String(m.id).startsWith('tmp-'));
        alert(err.message);
    } finally {
        state.isAiTyping = false;
        render(root);
    }
}

async function openProject(root, id) {
    try {
        const data = await api(`/projects/${id}`);
        applyProjectPayload(data);
        state.view = 'project';
        render(root);
    } catch (err) {
        alert(err.message);
    }
}

function applyProjectPayload(data) {
    state.project = data.project;
    state.messages = data.messages || [];
    state.prd = data.prd;
    state.diff = data.diff || [];
    state.stage = data.stage || 'input_idea';
    state.validation = data.validation || { ambiguities: 0, contradictions: 0, can_finalize: false };
}

function stageLabel(id) {
    return STEPS.find(s => s.id === id)?.title || 'Input Ide';
}

// Bind Global Modals after render
document.addEventListener('click', async (e) => {
    // New Project Modal Close
    if (e.target.closest('#close-new-project-modal') || e.target.closest('#cancel-new-project-btn')) {
        state.showNewProjectModal = false;
        render(document.getElementById('app'));
    }

    // Export Modal Close
    if (e.target.closest('#close-export-modal')) {
        state.showExportModal = false;
        render(document.getElementById('app'));
    }

    // Format radio change
    if (e.target.name === 'export-format') {
        state.exportFormat = e.target.value;
        render(document.getElementById('app'));
    }

    // Download action
    if (e.target.closest('#btn-do-download')) {
        const format = state.exportFormat;
        state.showExportModal = false;
        await triggerExport(format);
        render(document.getElementById('app'));
    }
});

// New Project Form Submit
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'new-project-form') {
        e.preventDefault();
        const submitBtn = e.target.querySelector('#submit-new-project-btn');
        const errEl = e.target.querySelector('#new-project-error');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyusun draft...';
        errEl.textContent = '';

        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData);

        try {
            const data = await api('/projects', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            state.showNewProjectModal = false;
            applyProjectPayload(data);
            state.view = 'project';
            render(document.getElementById('app'));
        } catch (err) {
            errEl.textContent = err.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Susun Draft PRD →';
        }
    }
});

async function triggerExport(format) {
    if (!state.project) return;
    try {
        const res = await fetch(`/api/projects/${state.project.id}/export/${format}`, {
            headers: {
                Accept: format === 'json' ? 'application/json' : '*/*',
                Authorization: `Bearer ${state.token}`,
            },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Export gagal');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(state.project.title)}.${format === 'md' ? 'md' : format}`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert(err.message);
    }
}

function slugify(val) {
    return String(val || 'rencanaku-prd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
