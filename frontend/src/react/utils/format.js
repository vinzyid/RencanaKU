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

export function generateMarkdown(prd) {
    if (!prd) return '';
    const c = prd.content || {};
    const list = (v, ordered = false) => {
        const items = normalizeItems(v);
        return items.map((item, i) => `${ordered ? `${i + 1}.` : '-'} ${item}`).join('\n');
    };
    return `# Product Requirement Document (PRD)
## ${c.title || 'RencanaKU Project'}

### 1. Ringkasan & Latar Belakang
${c.background || ''}

### 2. Tujuan & Target User
**Target User:**
${list(c.target_users)}

**Tujuan:**
${list(c.objectives)}
${hasItems(c.user_stories) ? `\n**User Story:**\n${list(c.user_stories)}` : ''}

### 3. Functional Requirements
${list(c.functional_requirements, true)}
${hasItems(c.acceptance_criteria) ? `\n**Kriteria Selesai (Acceptance Criteria):**\n${list(c.acceptance_criteria)}` : ''}

### 4. Non-Functional Requirements
${list(c.non_functional_requirements)}
${hasItems(c.business_rules) ? `\n### 5. Aturan & Logika Bisnis\n${list(c.business_rules)}` : ''}
${hasItems(c.mvp_scope) || hasItems(c.later_scope) ? `\n### 6. Prioritas & Lingkup\n**Fase MVP:**\n${list(c.mvp_scope)}\n\n**Ditunda:**\n${list(c.later_scope)}` : ''}
${hasItems(c.data_entities) ? `\n### 7. Data yang Disimpan\n${list(c.data_entities)}` : ''}

### 8. Batasan
${list(c.constraints)}
${hasItems(c.edge_cases) ? `\n**Kondisi Khusus (Edge Case):**\n${list(c.edge_cases)}` : ''}
`;
}
