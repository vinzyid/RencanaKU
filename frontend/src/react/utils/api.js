export const STORAGE_KEY = 'rencanaku_token';

// Pilihan "Ingat saya" disimpan sementara selama browser pergi ke Google/GitHub,
// lalu dibaca sekali saat kode OAuth ditukar dengan token.
const OAUTH_REMEMBER_KEY = 'rencanaku_oauth_remember';

export function rememberOAuthChoice(remember) {
    try { sessionStorage.setItem(OAUTH_REMEMBER_KEY, remember ? '1' : '0'); } catch { /* abaikan */ }
}

export function consumeOAuthChoice() {
    try {
        const value = sessionStorage.getItem(OAUTH_REMEMBER_KEY);
        sessionStorage.removeItem(OAUTH_REMEMBER_KEY);
        return value === '1';
    } catch {
        return false;
    }
}

// Base URL backend. Kosong = pakai path relatif (dev proxy Vite / satu domain).
// Produksi terpisah: set VITE_API_URL=https://api.domain.com
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let tokenGetter = () => localStorage.getItem(STORAGE_KEY);
let unauthorizedHandler = () => {};

export function configureApi(options = {}) {
    if (options.getToken) tokenGetter = options.getToken;
    if (options.onUnauthorized) unauthorizedHandler = options.onUnauthorized;
}

export async function api(path, options = {}) {
    const token = tokenGetter();

    const response = await fetch(`${API_BASE}/api${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
            } else if (response.status === 422) {
                message = data?.errors ? Object.values(data.errors).flat().join(', ') : 'Data tidak valid.';
            } else {
                message = `Terjadi kesalahan (${response.status}).`;
            }
        }
        // Logout hanya bila token yang ditolak adalah token yang sedang aktif,
        // agar respons 401 dari request lama tidak menghapus sesi yang baru.
        if (response.status === 401) unauthorizedHandler(token);
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return data;
}

export async function triggerExport(projectId, format, projectTitle) {
    const token = tokenGetter();

    const res = await fetch(`${API_BASE}/api/projects/${projectId}/export/${format}`, {
        headers: {
            Accept: format === 'json' ? 'application/json' : '*/*',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    a.download = `${slugify(projectTitle)}.${format === 'md' ? 'md' : format}`;
    a.click();
    URL.revokeObjectURL(url);
}

function slugify(val) {
    return String(val || 'rencanaku-prd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
