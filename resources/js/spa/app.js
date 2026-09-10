// RencanaKU SPA — model hybrid: stepper permanen di atas + chat thread berkelanjutan.
// Struktur: state global sederhana -> render oleh router kecil -> event binding per layar.

const STORAGE_KEY = 'rencanaku_token';

const STEPS = [
    { id: 'input_idea', label: 'Input Ide', num: '01' },
    { id: 'clarification', label: 'Klarifikasi', num: '02' },
    { id: 'validation', label: 'Validasi', num: '03' },
    { id: 'documentation', label: 'Dokumentasi', num: '04' },
    { id: 'export', label: 'Export', num: '05' },
];

const state = {
    token: localStorage.getItem(STORAGE_KEY),
    user: null,
    projects: [],
    // layar proyek aktif
    project: null,
    messages: [],
    prd: null,
    diff: [],
    stage: 'input_idea',
    validation: { ambiguities: 0, contradictions: 0, can_finalize: false },
    versions: null, // diisi saat buka histori versi
    diffRange: null, // { from, to } untuk pemilih diff
    view: 'dashboard', // dashboard | project | versions | export
    busy: false,
};

// ---------------------------------------------------------------------------
// API helper
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
                message = 'Sesi kadaluarsa (CSRF). Silakan muat ulang halaman (Ctrl+Shift+R) lalu coba lagi.';
            } else if (response.status === 401) {
                message = 'Sesi tidak valid. Silakan login ulang.';
            } else if (response.status === 422) {
                message = 'Data yang dikirim tidak valid. Periksa kembali isian Anda.';
            } else if (response.status >= 500) {
                message = `Terjadi kesalahan pada server (${response.status}). Cek log Laravel untuk detail.`;
            } else {
                message = `Terjadi kesalahan (${response.status}).`;
            }
        }

        throw new Error(message);
    }

    return data;
}

// ---------------------------------------------------------------------------
// Utils
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
    state.view = 'dashboard';
}

// ---------------------------------------------------------------------------
// Mount & router
// ---------------------------------------------------------------------------
export function mountApp(root) {
    window.addEventListener('popstate', () => route(root));
    render(root);
}

function route(root) {
    if (!state.token) return renderAuth(root);
    renderShell(root);
    if (state.view === 'project' || state.view === 'versions' || state.view === 'export') {
        renderProjectView(root);
    } else {
        renderDashboard(root);
    }
}

function render(root) {
    if (!state.token) return renderAuth(root);
    route(root);
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function renderAuth(root, mode = 'login') {
    const isRegister = mode === 'register';

    root.innerHTML = `
        <div class="auth-page">
            <div class="auth-card">
                <div class="brand">Rencana<span>KU</span></div>
                <p class="eyebrow">SPEC-FIRST WORKSPACE</p>
                <h1>Ubah ide kasar menjadi PRD yang siap dieksekusi.</h1>
                <p class="muted">Validasi requirement, temukan ambiguitas & kontradiksi, dan rapikan spesifikasi sebelum mulai membangun.</p>
                <form id="auth-form">
                    ${isRegister ? '<input name="name" placeholder="Nama lengkap" required>' : ''}
                    <input name="email" type="email" placeholder="Email" required>
                    <input name="password" type="password" placeholder="Password (min. 8 karakter)" required>
                    <button class="primary" type="submit">${isRegister ? 'Daftar & Mulai' : 'Masuk'}</button>
                </form>
                <p id="auth-error" class="error"></p>
                <p class="auth-switch">
                    ${isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
                    <a href="#" id="auth-toggle">${isRegister ? 'Masuk' : 'Daftar sekarang'}</a>
                </p>
            </div>
        </div>`;

    root.querySelector('#auth-toggle').onclick = (event) => {
        event.preventDefault();
        renderAuth(root, isRegister ? 'login' : 'register');
    };

    root.querySelector('#auth-form').onsubmit = async (event) => {
        event.preventDefault();
        const button = event.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Memproses...';

        const form = new FormData(event.target);
        const payload = Object.fromEntries(form);

        try {
            const data = await api(isRegister ? '/register' : '/login', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            state.token = data.token;
            localStorage.setItem(STORAGE_KEY, state.token);
            state.user = data.user;
            resetProjectState();
            render(root);
        } catch (error) {
            root.querySelector('#auth-error').textContent = error.message;
            button.disabled = false;
            button.textContent = isRegister ? 'Daftar & Mulai' : 'Masuk';
        }
    };
}

// ---------------------------------------------------------------------------
// Shell (header + main container)
// ---------------------------------------------------------------------------
function renderShell(root) {
    root.innerHTML = `
        <div class="shell">
            <header>
                <a class="brand" href="#" id="brand-home">Rencana<span>KU</span></a>
                <div class="user">
                    <span class="user-name">${esc(state.user?.name || 'Workspace')}</span>
                    <button id="logout" class="ghost">Keluar</button>
                </div>
            </header>
            <main id="main"></main>
        </div>`;

    root.querySelector('#brand-home').onclick = (event) => {
        event.preventDefault();
        resetProjectState();
        render(root);
    };

    root.querySelector('#logout').onclick = async () => {
        try {
            await api('/logout', { method: 'POST' });
        } catch {
            /* token mungkin sudah invalid, abaikan */
        }
        logout();
        render(root);
    };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function renderDashboard(root) {
    const main = root.querySelector('#main');
    main.innerHTML = '<div class="loading">Memuat workspace...</div>';

    try {
        const [{ user }, { projects }] = await Promise.all([api('/me'), api('/projects')]);
        state.user = user;
        state.projects = projects;
    } catch {
        logout();
        return render(root);
    }

    main.innerHTML = `
        <section class="hero">
            <div>
                <p class="eyebrow">YOUR REQUIREMENT WORKSPACE</p>
                <h1>Mulai dari ide.<br><em>Berakhir dengan kejelasan.</em></h1>
                <p class="muted">Tulis apa pun yang ada di kepala. RencanaKU menyusunnya menjadi dokumen requirement terstruktur — lengkap dengan deteksi ambiguitas &amp; kontradiksi.</p>
            </div>
            <div class="hero-mark">RK</div>
        </section>
        <section class="workspace-grid">
            <div class="panel create-panel">
                <div class="panel-head">
                    <div><p class="eyebrow">LANGKAH 01</p><h2>Mulai proyek baru</h2></div>
                    <span class="dot"></span>
                </div>
                <form id="project-form">
                    <input name="title" placeholder="Nama proyek (opsional)">
                    <textarea name="prompt" required minlength="10" placeholder="Contoh: Saya mau membuat aplikasi kasir untuk warung yang bisa mencatat transaksi dan stok, cepat dan mudah dipakai..."></textarea>
                    <button class="primary" type="submit">Susun draft PRD <span>→</span></button>
                </form>
                <p id="create-error" class="error"></p>
            </div>
            <div class="panel projects-panel">
                <div class="panel-head">
                    <div><p class="eyebrow">WORKSPACE</p><h2>Proyek saya</h2></div>
                    <strong>${state.projects.length}</strong>
                </div>
                <div class="project-list">
                    ${state.projects.length
                        ? state.projects.map(projectCard).join('')
                        : '<p class="empty">Belum ada proyek. Mulai dari ide pertamamu.</p>'}
                </div>
            </div>
        </section>`;

    main.querySelector('#project-form').onsubmit = async (event) => {
        event.preventDefault();
        const form = new FormData(event.target);
        const button = event.target.querySelector('button');
        button.disabled = true;
        button.textContent = 'Menyusun draft...';
        try {
            const data = await api('/projects', {
                method: 'POST',
                body: JSON.stringify({ ...Object.fromEntries(form), prompt: form.get('prompt') }),
            });
            applyProjectPayload(data);
            state.view = 'project';
            render(root);
            mountChatInteractions(root);
        } catch (error) {
            main.querySelector('#create-error').textContent = error.message;
            button.disabled = false;
            button.textContent = 'Susun draft PRD →';
        }
    };

    main.querySelectorAll('[data-open-project]').forEach((button) => {
        button.onclick = () => openProject(root, button.dataset.openProject);
    });
}

function stageLabel(id) {
    return STEPS.find((step) => step.id === id)?.label || 'Input Ide';
}

function projectCard(project) {
    const version = project.latest_version;
    const status = version ? `${version.status === 'finalized' ? 'Final' : 'Draft'} · v${version.version_number}` : 'Thread baru';
    return `
        <button class="project-card" data-open-project="${project.id}">
            <span class="project-icon">${esc(project.title.slice(0, 1).toUpperCase())}</span>
            <span>
                <b>${esc(project.title)}</b>
                <small>${status} · ${stageLabel(project.stage)}</small>
            </span>
            <span class="project-card-arrow">→</span>
        </button>`;
}

async function openProject(root, id) {
    try {
        const data = await api(`/projects/${id}`);
        applyProjectPayload(data);
        state.view = 'project';
        render(root);
        mountChatInteractions(root);
    } catch (error) {
        alert(error.message);
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

// ---------------------------------------------------------------------------
// Project view (stepper + chat + split panel)
// ---------------------------------------------------------------------------
function renderProjectView(root) {
    const main = root.querySelector('#main');
    const project = state.project;

    if (!project) {
        resetProjectState();
        return renderDashboard(root);
    }

    const hasPrd = !!state.prd;

    main.innerHTML = `
        ${renderStepper()}
        ${state.view === 'versions' ? renderVersionHistory() : ''}
        ${state.view === 'export' ? renderExportView() : ''}
        ${state.view === 'project' ? renderProjectBody(root, hasPrd) : ''}
    `;

    bindProjectActions(root);
    if (state.view === 'project') {
        mountChatInteractions(root);
    }
}

function renderStepper() {
    const currentIndex = STEPS.findIndex((step) => step.id === state.stage);
    const items = STEPS.map((step, index) => {
        const isDone = index < currentIndex;
        const isActive = index === currentIndex;
        const cls = isDone ? 'done' : isActive ? 'active' : '';
        const marker = isDone ? '✓' : step.num;
        return `
            <li class="step ${cls}">
                <span class="step-marker">${marker}</span>
                <span class="step-label">${step.label}</span>
            </li>`;
    }).join('<li class="step-sep" aria-hidden="true"></li>');

    return `<ol class="stepper" aria-label="Progres tahapan">${items}</ol>`;
}

function renderProjectBody(root, hasPrd) {
    if (!hasPrd) {
        return `
            <div class="empty-stage">
                <div class="empty-hero">
                    <div class="auth-brand-wrap"><span class="brand big">Rencana<span>KU</span></span></div>
                    <h2>Mau bikin apa?</h2>
                    <p class="muted">Ceritakan idemu dalam bahasa bebas. RencanaKU akan menyusun draft PRD-nya, lalu mengajak klarifikasi hal-hal yang masih ambigu.</p>
                </div>
                ${renderComposer('Ceritakan idemu di sini...')}
            </div>`;
    }

    return `
        <div class="split-panel">
            <section class="chat-column">
                <div class="chat-head">
                    <div>
                        <p class="eyebrow">${esc(stageLabel(state.stage)).toUpperCase()}</p>
                        <h2>${esc(state.project.title)}</h2>
                    </div>
                    <button id="back-dashboard" class="ghost">← Semua proyek</button>
                </div>
                <div id="chat-thread" class="chat-thread">${renderThread()}</div>
                ${renderComposer(state.stage === 'export' ? 'Ketik revisi tambahan (opsional)...' : 'Ketik jawaban atau revisi bebas...')}
            </section>
            <aside class="prd-column">
                ${renderPrdPanel()}
            </aside>
        </div>`;
}

function renderThread() {
    if (!state.messages.length) {
        return '<p class="empty">Belum ada percakapan.</p>';
    }

    return state.messages
        .map((message) => {
            const isUser = message.sender === 'user';
            const chips = (message.quick_replies || [])
                .map((chip) => `<button class="chip" data-chip="${esc(chip)}">${esc(chip)}</button>`)
                .join('');
            return `
                <div class="bubble-row ${isUser ? 'from-user' : 'from-ai'}">
                    <div class="bubble ${isUser ? 'bubble-user' : 'bubble-ai'}">
                        ${nl2br(message.content)}
                        ${chips ? `<div class="chips">${chips}</div>` : ''}
                    </div>
                </div>`;
        })
        .join('');
}

function renderComposer(placeholder) {
    return `
        <form id="chat-form" class="composer">
            <textarea id="chat-input" rows="1" placeholder="${esc(placeholder)}"></textarea>
            <button class="primary" type="submit" id="chat-send">Kirim →</button>
        </form>
        <p id="chat-error" class="error"></p>`;
}

function renderPrdPanel() {
    const prd = state.prd;
    if (!prd) return '';

    const { ambiguities, contradictions, can_finalize } = state.validation;
    const isFinalized = prd.status === 'finalized';

    const banner = isFinalized
        ? `<div class="validation-banner ok">✓ PRD sudah difinalisasi (v${prd.version_number}).</div>`
        : can_finalize
            ? `<div class="validation-banner ok">✓ Semua validasi selesai. PRD siap difinalisasi.</div>`
            : `<div class="validation-banner warn">Masih ada ${ambiguities} ambiguitas &amp; ${contradictions} kontradiksi yang perlu diselesaikan.</div>`;

    const contradictionsList = (prd.contradiction_flags || [])
        .filter((flag) => !flag.resolution)
        .map((flag) => `
            <div class="flag contradiction">
                <b>Kontradiksi</b>
                <p>${esc(flag.explanation)}</p>
                <small><span class="tag-a">A</span> ${esc(flag.requirement_a)}<br><span class="tag-b">B</span> ${esc(flag.requirement_b)}</small>
                <div class="chips">
                    <button class="chip" data-chip="Pakai A">Pakai A</button>
                    <button class="chip" data-chip="Pakai B">Pakai B</button>
                    <button class="chip" data-chip="Saya revisi manual">Revisi manual</button>
                </div>
            </div>`)
        .join('');

    return `
        <div class="panel prd-panel">
            <div class="prd-toolbar">
                <div>
                    <b>Dokumen PRD</b>
                    <small>Versi ${prd.version_number} · ${esc(prd.ai_provider || 'local')} · ${esc(prd.status)}</small>
                </div>
                <div class="prd-actions">
                    <button id="open-versions" class="secondary">Histori</button>
                    <button id="finalize" class="primary" ${isFinalized || !can_finalize ? 'disabled' : ''}>Finalisasi</button>
                </div>
            </div>
            ${banner}
            ${contradictionsList}
            <div class="prd-body">${renderPrdContent(prd.content)}</div>
        </div>`;
}

function renderPrdContent(content) {
    if (!content) return '<p class="empty">Belum ada isi PRD.</p>';

    const labels = {
        background: 'Latar Belakang',
        objectives: 'Tujuan',
        target_users: 'Target User',
        functional_requirements: 'Requirement Fungsional',
        non_functional_requirements: 'Requirement Non-Fungsional',
        constraints: 'Batasan',
        open_questions: 'Pertanyaan Terbuka',
    };

    const changedFields = new Set((state.diff || []).map((section) => section.field));

    return Object.entries(labels)
        .map(([key, label]) => {
            const value = content[key];
            if (!value || (Array.isArray(value) && value.length === 0)) return '';

            const isChanged = changedFields.has(key);
            const added = new Set(
                (state.diff || []).filter((d) => d.field === key).flatMap((d) => d.added || [])
            );

            const body = Array.isArray(value)
                ? `<ul>${value
                      .map((item) =>
                          added.has(item)
                              ? `<li class="diff-added">${esc(item)} <span class="diff-tag">baru</span></li>`
                              : `<li>${esc(item)}</li>`
                      )
                      .join('')}</ul>`
                : `<p>${nl2br(value)}</p>`;

            return `
                <section class="prd-section ${isChanged ? 'diff-changed' : ''}">
                    <p class="eyebrow">${label}</p>
                    ${body}
                </section>`;
        })
        .join('');
}

// ---------------------------------------------------------------------------
// Version history (diff view)
// ---------------------------------------------------------------------------
function renderVersionHistory() {
    if (!state.versions || !state.versions.length) {
        return '<p class="empty">Belum ada histori versi.</p>';
    }

    const firstVersion = state.versions[state.versions.length - 1];
    const latestVersion = state.versions[0];

    const fromId = state.diffRange?.from ?? firstVersion.id;
    const toId = state.diffRange?.to ?? latestVersion.id;
    const fromVersion = state.versions.find((v) => v.id === fromId) || firstVersion;
    const toVersion = state.versions.find((v) => v.id === toId) || latestVersion;

    const options = (selectedId) =>
        state.versions
            .map((v) => `<option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>Versi ${v.version_number} (${esc(v.status)})</option>`)
            .join('');

    return `
        <div class="page-head">
            <div>
                <p class="eyebrow">DOKUMENTASI / HISTORI</p>
                <h2>${esc(state.project.title)}</h2>
            </div>
            <button id="close-versions" class="ghost">← Kembali ke percakapan</button>
        </div>
        <div class="panel versions-panel">
            <div class="versions-toolbar">
                <label>Bandingkan
                    <select id="diff-from">${options(fromVersion.id)}</select>
                </label>
                <span class="diff-arrow">→</span>
                <label>dengan
                    <select id="diff-to">${options(toVersion.id)}</select>
                </label>
            </div>
            <div class="diff-legend">
                <span class="legend"><i class="swatch added"></i> Ditambah</span>
                <span class="legend"><i class="swatch removed"></i> Dihapus</span>
                <span class="legend"><i class="swatch changed"></i> Diubah</span>
            </div>
            <div id="diff-result" class="diff-result">${renderDiffResult(fromVersion, toVersion)}</div>
        </div>`;
}

function renderDiffResult(from, to) {
    if (!from || !to) return '<p class="empty">Pilih versi untuk dibandingkan.</p>';
    if (from.id === to.id) return '<p class="empty">Pilih dua versi yang berbeda untuk melihat perubahan.</p>';

    const labels = {
        title: 'Judul',
        background: 'Latar Belakang',
        objectives: 'Tujuan',
        target_users: 'Target User',
        functional_requirements: 'Requirement Fungsional',
        non_functional_requirements: 'Requirement Non-Fungsional',
        constraints: 'Batasan',
        open_questions: 'Pertanyaan Terbuka',
    };

    // Bandingkan dari versi `to` (konten penuh) dengan menandai item yang
    // berbeda relatif terhadap `from`.
    const sections = diffContent(from.content, to.content);

    if (!sections.length) {
        return '<p class="empty">Tidak ada perbedaan pada rentang versi ini.</p>';
    }

    return sections
        .map((section) => {
            const label = labels[section.field] || section.field;
            let body = '';

            if (Array.isArray(section.before) || Array.isArray(section.after)) {
                const before = section.before || [];
                const after = section.after || [];
                const afterSet = new Set(after);
                const beforeSet = new Set(before);

                body = `<ul class="diff-list">
                    ${before
                        .filter((item) => !afterSet.has(item))
                        .map((item) => `<li class="diff-removed">${esc(item)}</li>`)
                        .join('')}
                    ${after
                        .filter((item) => !beforeSet.has(item))
                        .map((item) => `<li class="diff-added">${esc(item)}</li>`)
                        .join('')}
                </ul>`;
            } else {
                body = `
                    <div class="diff-text removed">${nl2br(section.before || '(kosong)')}</div>
                    <div class="diff-text added">${nl2br(section.after || '(kosong)')}</div>`;
            }

            return `<section class="diff-section"><p class="eyebrow">${label}</p>${body}</section>`;
        })
        .join('');
}

// Diff konten sisi-klien (fallback ringan bila backend tidak mengirim diff).
function diffContent(before, after) {
    const fields = [
        'title',
        'background',
        'objectives',
        'target_users',
        'functional_requirements',
        'non_functional_requirements',
        'constraints',
        'open_questions',
    ];
    const sections = [];

    fields.forEach((field) => {
        const a = before?.[field] ?? '';
        const b = after?.[field] ?? '';
        const aIsArray = Array.isArray(a);
        const bIsArray = Array.isArray(b);

        if (aIsArray || bIsArray) {
            const aa = aIsArray ? a : [];
            const bb = bIsArray ? b : [];
            const as = new Set(aa);
            const bs = new Set(bb);
            const changed = aa.some((item) => !bs.has(item)) || bb.some((item) => !as.has(item));
            if (changed) sections.push({ field, before: aa, after: bb });
        } else if (String(a) !== String(b)) {
            sections.push({ field, before: a, after: b });
        }
    });

    return sections;
}

// ---------------------------------------------------------------------------
// Export view
// ---------------------------------------------------------------------------
function renderExportView() {
    const prd = state.prd;

    if (!prd) {
        return `
            <div class="page-head"><div><p class="eyebrow">EXPORT</p><h2>Belum ada PRD</h2></div>
            <button id="close-export" class="ghost">← Kembali</button></div>
            <div class="panel"><p class="empty">Finalisasi PRD terlebih dahulu untuk bisa mengekspor.</p></div>`;
    }

    const isFinalized = prd.status === 'finalized';

    return `
        <div class="page-head">
            <div><p class="eyebrow">TAHAP 05 / EXPORT</p><h2>${esc(state.project.title)}</h2></div>
            <button id="close-export" class="ghost">← Kembali ke percakapan</button>
        </div>
        <div class="export-grid">
            <div class="panel export-card">
                <p class="eyebrow">STATUS</p>
                <h3>${isFinalized ? 'PRD Final ✓' : 'PRD masih draft'}</h3>
                <p class="muted">${isFinalized
                    ? 'PRD sudah final dan siap ditempel sebagai instruksi ke AI coding agent mana pun (Claude Code, Cursor, dll).'
                    : 'Finalisasi PRD dulu di panel PRD sebelum mengekspor versi final.'}</p>
                <div class="export-actions">
                    <button data-export="md" class="primary" ${isFinalized ? '' : 'disabled'}>Export Markdown</button>
                    <button data-export="json" class="secondary" ${isFinalized ? '' : 'disabled'}>Export JSON</button>
                    <button data-export="pdf" class="secondary" ${isFinalized ? '' : 'disabled'}>Export PDF</button>
                </div>
            </div>
            <div class="panel export-preview">
                <p class="eyebrow">PRATINJAU DOKUMEN</p>
                <div class="prd-body">${renderPrdContent(prd.content)}</div>
            </div>
        </div>`;
}

// ---------------------------------------------------------------------------
// Event bindings
// ---------------------------------------------------------------------------
function bindProjectActions(root) {
    const main = root.querySelector('#main');

    const back = main.querySelector('#back-dashboard');
    if (back) {
        back.onclick = () => {
            resetProjectState();
            render(root);
        };
    }

    const openVersions = main.querySelector('#open-versions');
    if (openVersions) {
        openVersions.onclick = async () => {
            try {
                const { versions } = await api(`/projects/${state.project.id}/versions`);
                state.versions = versions;
                state.diffRange = null;
                state.view = 'versions';
                render(root);
            } catch (error) {
                alert(error.message);
            }
        };
    }

    const closeVersions = main.querySelector('#close-versions');
    if (closeVersions) {
        closeVersions.onclick = () => {
            state.view = 'project';
            render(root);
            mountChatInteractions(root);
        };
    }

    const diffFrom = main.querySelector('#diff-from');
    const diffTo = main.querySelector('#diff-to');
    if (diffFrom && diffTo) {
        const rerenderDiff = () => {
            state.diffRange = { from: parseInt(diffFrom.value, 10), to: parseInt(diffTo.value, 10) };
            const from = state.versions.find((v) => v.id === state.diffRange.from);
            const to = state.versions.find((v) => v.id === state.diffRange.to);
            main.querySelector('#diff-result').innerHTML = renderDiffResult(from, to);
        };
        diffFrom.onchange = rerenderDiff;
        diffTo.onchange = rerenderDiff;
    }

    const finalize = main.querySelector('#finalize');
    if (finalize) {
        finalize.onclick = async () => {
            if (!confirm('Finalisasi PRD ini? Status akan berubah menjadi final.')) return;
            try {
                const data = await api(`/projects/${state.project.id}/finalize`, { method: 'POST' });
                applyProjectPayload(data);
                state.view = 'export';
                render(root);
            } catch (error) {
                alert(error.message);
            }
        };
    }

    const closeExport = main.querySelector('#close-export');
    if (closeExport) {
        closeExport.onclick = () => {
            state.view = 'project';
            render(root);
            mountChatInteractions(root);
        };
    }

    main.querySelectorAll('[data-export]').forEach((button) => {
        button.onclick = () => exportPrd(button.dataset.export);
    });
}

async function exportPrd(format) {
    try {
        const response = await fetch(`/api/projects/${state.project.id}/export/${format}`, {
            headers: {
                Accept: format === 'json' ? 'application/json' : '*/*',
                Authorization: `Bearer ${state.token}`,
            },
        });

        if (!response.ok) {
            let message = 'Export gagal.';
            try {
                message = (await response.json())?.message || message;
            } catch { /* noop */ }
            return alert(message);
        }

        const blob = await response.blob();
        const extension = format === 'md' ? 'md' : format;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${slugify(state.project.title)}.${extension}`;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        alert(error.message);
    }
}

function slugify(value) {
    return String(value).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'rencanaku-prd';
}

// ---------------------------------------------------------------------------
// Chat interactions (dipakai layar project & empty stage)
// ---------------------------------------------------------------------------
function mountChatInteractions(root) {
    const main = root.querySelector('#main');
    const form = main.querySelector('#chat-form');
    if (!form) return;

    const input = form.querySelector('#chat-input');
    const thread = main.querySelector('#chat-thread');

    const scrollToBottom = () => {
        if (thread) thread.scrollTop = thread.scrollHeight;
        if (typeof window.scrollTo === 'function') {
            try {
                window.scrollTo({ top: document.body.scrollHeight });
            } catch {
                /* sebagian environment tidak mendukung scrollTo */
            }
        }
    };

    // auto-resize textarea
    const autosize = () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    };
    input.addEventListener('input', autosize);

    // kirim dengan Enter (Shift+Enter untuk baris baru)
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    form.onsubmit = async (event) => {
        event.preventDefault();
        await sendMessage(root, input.value.trim());
    };

    // quick-reply chips (di dalam bubble & di panel PRD)
    main.querySelectorAll('[data-chip]').forEach((chip) => {
        chip.onclick = async () => {
            await sendMessage(root, chip.dataset.chip);
        };
    });

    setTimeout(scrollToBottom, 30);
}

async function sendMessage(root, content) {
    if (!content) return;

    const main = root.querySelector('#main');
    const errorEl = main.querySelector('#chat-error');
    const submitButton = main.querySelector('#chat-send');

    // optimistic: tampilkan bubble user langsung (hanya bila thread sudah ada)
    state.messages.push({ id: `tmp-${Date.now()}`, sender: 'user', content, quick_replies: null });

    if (errorEl) errorEl.textContent = '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Menyusun...';
    }

    // re-render thread optimistik
    if (state.prd) {
        const thread = main.querySelector('#chat-thread');
        if (thread) thread.innerHTML = renderThread();
    } else {
        // empty stage: tampilkan indikator mengetik
        main.querySelector('.empty-stage')?.classList.add('is-loading');
    }

    try {
        const data = await api(`/projects/${state.project.id}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content }),
        });
        applyProjectPayload(data);
        state.view = 'project';
        render(root);
        mountChatInteractions(root);
    } catch (error) {
        // rollback bubble optimistik
        state.messages = state.messages.filter((m) => !String(m.id).startsWith('tmp-'));
        if (errorEl) errorEl.textContent = error.message;
        else alert(error.message);
        render(root);
        mountChatInteractions(root);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Kirim →';
        }
    }
}
