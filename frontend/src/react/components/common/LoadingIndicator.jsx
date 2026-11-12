import { useEffect, useState } from 'react';
import { getPendingCount, subscribePending } from '../../utils/api.js';
import { holdSplash } from '../../utils/splash.js';

// Request yang selesai cepat tidak perlu indikator (hanya akan berkedip).
const SHOW_AFTER_MS = 300;
// Setelah selama ini, jelaskan dengan kata-kata bahwa aplikasi masih bekerja.
const SLOW_AFTER_MS = 6000;

const LOGO_SRC = '/logo/Logo Revisi Abyan Suka Warna Ungu.png';

/**
 * Indikator loading global: bar tipis di tepi atas selama ada request ke
 * server, plus keterangan singkat bila request berjalan lama. Tujuannya satu:
 * pengguna bisa membedakan "sedang memuat" dari "macet".
 */
export function GlobalLoadingBar() {
    const [pending, setPending] = useState(getPendingCount);
    const [active, setActive] = useState(false);
    const [slow, setSlow] = useState(false);

    useEffect(() => subscribePending(setPending), []);

    const busy = pending > 0;

    useEffect(() => {
        if (!busy) {
            setActive(false);
            setSlow(false);
            return undefined;
        }

        const showTimer = setTimeout(() => setActive(true), SHOW_AFTER_MS);
        const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

        return () => {
            clearTimeout(showTimer);
            clearTimeout(slowTimer);
        };
    }, [busy]);

    return (
        <>
            <div className="loading-bar" data-active={active} aria-hidden="true" />
            <div className="loading-pill" data-visible={slow} role="status" aria-live="polite">
                {slow && (
                    <>
                        <span className="loading-pill-spinner" aria-hidden="true" />
                        <span>Masih memuat… koneksi sedang lambat, mohon tunggu.</span>
                    </>
                )}
            </div>
        </>
    );
}

/**
 * Layar memuat satu halaman penuh (mis. saat sesi login sedang diperiksa).
 * Tata letaknya sama persis dengan splash pembuka di index.html: selama
 * splash masih ada, layar ini cukup "menahannya" sehingga tidak ada kedipan
 * di antara keduanya.
 */
export function AppLoader() {
    useEffect(() => holdSplash(), []);

    return (
        <div className="app-loader" role="status" aria-live="polite" aria-label="Memuat">
            <div className="app-loader-brand">
                <img className="app-loader-logo" src={LOGO_SRC} alt="" width="56" height="56" />
                <span className="app-loader-name">RencanaKU</span>
            </div>
            <div className="app-loader-bar" aria-hidden="true" />
            <p className="app-loader-hint">Masih memuat… koneksi sedang lambat, mohon tunggu sebentar.</p>
        </div>
    );
}
