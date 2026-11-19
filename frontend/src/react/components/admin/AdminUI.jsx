import { formatNumber } from '../../utils/format.js';

/**
 * Ikon SVG line-style untuk panel admin (tanpa emoji).
 * Semua memakai stroke 1.8 dan viewBox 24 agar konsisten.
 */
export function AdminIcon({ name, className = 'h-5 w-5' }) {
    const common = {
        className,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    };

    const paths = {
        users: (
            <>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </>
        ),
        admin: (
            <>
                <path d="M12 3 4 6v6c0 4.5 3.2 7.7 8 9 4.8-1.3 8-4.5 8-9V6l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
        folder: (
            <>
                <path d="M4 6a2 2 0 0 1 2-2h3.5l2 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" />
            </>
        ),
        check: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12.5 2.5 2.5 4.5-5" />
            </>
        ),
        token: (
            <>
                <path d="M12 2v20" />
                <path d="M17 6.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </>
        ),
        request: (
            <>
                <path d="M4 5h16v12H7l-3 3V5Z" />
                <path d="M8 9h8M8 12.5h5" />
            </>
        ),
        arrowUp: (
            <>
                <path d="M12 19V5" />
                <path d="m6 11 6-6 6 6" />
            </>
        ),
        arrowDown: (
            <>
                <path d="M12 5v14" />
                <path d="m6 13 6 6 6-6" />
            </>
        ),
        bolt: (
            <>
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
            </>
        ),
        chart: (
            <>
                <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </>
        ),
        inbox: (
            <>
                <path d="M3 13h4l2 3h6l2-3h4" />
                <path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6l2-8Z" />
            </>
        ),
        clock: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        alert: (
            <>
                <path d="M12 3 2 20h20L12 3Z" />
                <path d="M12 10v4M12 17.5v.01" />
            </>
        ),
        leaf: (
            <>
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6" />
            </>
        ),
        emission: (
            <>
                <path d="M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path d="M9.5 17H17a4 4 0 0 0 0-8h-1" />
                <path d="M14 5h6M17 2v6" />
            </>
        ),
        water: (
            <>
                <path d="M12 2.5S5.5 9.5 5.5 14a6.5 6.5 0 0 0 13 0c0-4.5-6.5-11.5-6.5-11.5Z" />
            </>
        ),
        car: (
            <>
                <path d="M5 16H3v-4l2-5h12l3 5v4h-2" />
                <circle cx="7.5" cy="16.5" r="1.5" />
                <circle cx="16.5" cy="16.5" r="1.5" />
                <path d="M5 16h11" />
            </>
        ),
        phone: (
            <>
                <rect x="7" y="2.5" width="10" height="19" rx="2" />
                <path d="M11 18.5h2" />
            </>
        ),
        tree: (
            <>
                <path d="M12 3 6 12h3l-3 6h12l-3-6h3L12 3Z" />
                <path d="M12 18v3" />
            </>
        ),
        bulb: (
            <>
                <path d="M9 18h6" />
                <path d="M10 21h4" />
                <path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.1-.8.5-1.1A6 6 0 0 0 12 3Z" />
            </>
        ),
    };

    return <svg {...common}>{paths[name] || paths.inbox}</svg>;
}

// eyebrow tetap diterima demi kompatibilitas, tapi tidak ditampilkan:
// breadcrumb di header layout sudah memberi konteks halaman.
// eslint-disable-next-line no-unused-vars
export function AdminPageHeader({ eyebrow, title, description, actions }) {
    return (
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white font-heading">
                    {title}
                </h1>
                {description ? (
                    <p className="mt-1.5 max-w-[64ch] text-sm text-slate-500 dark:text-slate-400">{description}</p>
                ) : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
    );
}

export function AdminCard({ title, meta, children, className = '', bodyClassName = '' }) {
    return (
        <section className={`rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121624] ${className}`}>
            {(title || meta) && (
                <header className="flex items-baseline justify-between gap-4 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-heading">{title}</h2>
                    {meta ? <span className="text-[11px] text-slate-400">{meta}</span> : null}
                </header>
            )}
            <div className={bodyClassName || 'p-5'}>{children}</div>
        </section>
    );
}

const TILE_ACCENTS = {
    brand: 'text-[#5B4DF6] dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
    slate: 'text-slate-900 dark:text-white',
};

// Tile tunggal (dipakai halaman Token & Green dalam grid).
export function AdminStatTile({ label, value, sub, accent = 'slate', icon, loading }) {
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-[#121624]">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                {icon ? <AdminIcon name={icon} className="h-3.5 w-3.5 text-slate-400" /> : null}
                <span>{label}</span>
            </div>
            <div className={`mt-2 text-2xl font-bold tabular-nums tracking-tight font-heading ${TILE_ACCENTS[accent] || TILE_ACCENTS.slate}`}>
                {loading ? '—' : typeof value === 'number' ? formatNumber(value) : value}
            </div>
            {sub ? <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div> : null}
        </div>
    );
}

// Beberapa angka dalam satu strip bergaris pemisah (bukan kartu terpisah).
const STRIP_BORDERS = ['', 'border-l', 'border-t lg:border-t-0 lg:border-l', 'border-t border-l lg:border-t-0'];

export function AdminStatStrip({ items, loading }) {
    return (
        <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121624] lg:grid-cols-4">
            {items.map((it, i) => (
                <div key={it.label} className={`border-slate-200 px-5 py-5 dark:border-slate-800 ${STRIP_BORDERS[i] || ''}`}>
                    <div className={`text-3xl font-bold tabular-nums tracking-tight font-heading ${TILE_ACCENTS[it.accent] || TILE_ACCENTS.slate}`}>
                        {loading ? '—' : typeof it.value === 'number' ? formatNumber(it.value) : it.value}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{it.label}</div>
                    {it.sub ? <div className="mt-0.5 text-[11px] text-slate-400">{it.sub}</div> : null}
                </div>
            ))}
        </div>
    );
}

// eslint-disable-next-line no-unused-vars
export function AdminEmpty({ title, hint, icon = 'inbox' }) {
    return (
        <div className="py-12 px-1">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">{title}</div>
            {hint ? <div className="mt-1 max-w-[48ch] text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
        </div>
    );
}

export function AdminSkeleton({ rows = 4 }) {
    return (
        <div className="animate-pulse space-y-3 p-6">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                    <div className="h-4 w-1/4 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-4 w-1/5 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="ml-auto h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
            ))}
        </div>
    );
}

export function AdminError({ message, onRetry }) {
    return (
        <div className="flex flex-col items-start gap-2 border-l-2 border-rose-500 px-5 py-6">
            <div className="text-sm font-semibold text-slate-800 dark:text-white">Gagal memuat data</div>
            <div className="max-w-[56ch] text-xs text-rose-600 dark:text-rose-400">{message}</div>
            {onRetry ? (
                <button onClick={onRetry} className="mt-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                    Coba lagi
                </button>
            ) : null}
        </div>
    );
}

export function ProviderChip({ provider, active, onClick, count }) {
    const label = provider || 'unknown';
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-semibold transition ${
                active
                    ? 'border-[#5B4DF6] bg-indigo-50 text-[#5B4DF6] dark:border-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
        >
            {label}
            {typeof count === 'number' ? <span className="text-slate-400">{formatNumber(count)}</span> : null}
        </button>
    );
}
