export const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#96;',
};

export const esc = (value) => {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(/[&<>"'/`]/g, (char) => ESCAPE_MAP[char])
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
};

export const nl2br = (value) => esc(value).replace(/\n/g, '<br>');

export const hasItems = (value) =>
    Array.isArray(value)
        ? value.some((item) => String(item ?? '').trim() !== '')
        : String(value ?? '').trim() !== '';

export function normalizeItems(value) {
    return Array.isArray(value)
        ? value.filter((item) => String(item ?? '').trim() !== '')
        : String(value ?? '').trim() !== ''
            ? [value]
            : [];
}

export function timeAgo(dateString) {
    if (!dateString) return 'Baru saja';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Baru saja';
    if (diffSec < 3600) return `Diperbarui ${Math.floor(diffSec / 60)} menit lalu`;
    if (diffSec < 86400) return `Diperbarui ${Math.floor(diffSec / 3600)} jam lalu`;
    return `Diperbarui ${Math.floor(diffSec / 86400)} hari lalu`;
}

export function formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

export function formatDateTime(iso) {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return '-';
    }
}

export function slugify(val) {
    return String(val || 'rencanaku-prd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function initialsOf(name) {
    return (
        String(name || 'RK')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'RK'
    );
}

export const STEPS = [
    { id: 'input_idea', num: '1', title: 'Input Ide', sub: 'Ceritakan ide kamu' },
    { id: 'clarification', num: '2', title: 'Klarifikasi', sub: 'Jawab pertanyaan AI' },
    { id: 'validation', num: '3', title: 'Validasi', sub: 'Cek ambiguitas & kontradiksi' },
    { id: 'documentation', num: '4', title: 'Dokumentasi', sub: 'Lihat PRD lengkap' },
    { id: 'export', num: '5', title: 'Export', sub: 'Unduh & gunakan' },
];

export function stageLabel(id) {
    return STEPS.find((s) => s.id === id)?.title || 'Input Ide';
}
