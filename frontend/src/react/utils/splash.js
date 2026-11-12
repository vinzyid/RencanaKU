// Pengendali splash pembuka yang didefinisikan di index.html.
//
// Splash tampil sejak HTML pertama diterima. Ia disembunyikan setelah:
//   1. aplikasi React sudah ter-mount (markSplashReady), DAN
//   2. tidak ada layar yang masih "menahan" (holdSplash) — mis. pengecekan sesi
//      login pada halaman yang butuh login, DAN
//   3. logo sempat terlihat: animasi penuh pada pembukaan pertama di sesi ini,
//      versi ringkas (lebih singkat) pada muat ulang berikutnya, supaya
//      refresh tetap terasa cepat.

const FIRST_OPEN_MIN_MS = 900;
const REPEAT_MIN_MS = 500;
const LEAVE_MS = 200;

let ready = false;
let holds = 0;
let timer = null;
let finished = false;

function element() {
    return document.getElementById('splash');
}

function minimumVisibleMs() {
    return document.documentElement.getAttribute('data-splash') === 'repeat' ? REPEAT_MIN_MS : FIRST_OPEN_MIN_MS;
}

function leave() {
    timer = null;
    if (!ready || holds > 0 || finished) return;

    const el = element();
    finished = true;
    if (!el) return;

    el.classList.add('is-leaving');
    // Hapus dari DOM setelah fade selesai agar tidak menghalangi klik / pembaca layar.
    setTimeout(() => el.remove(), LEAVE_MS + 50);
}

function schedule() {
    if (finished || timer !== null || !ready || holds > 0) return;

    if (!element()) {
        finished = true;
        return;
    }

    // performance.now() = milidetik sejak halaman mulai dimuat.
    const wait = Math.max(0, minimumVisibleMs() - performance.now());
    timer = setTimeout(leave, wait);
}

/** Dipanggil sekali setelah aplikasi React pertama kali ter-mount. */
export function markSplashReady() {
    ready = true;
    schedule();
}

/**
 * Tahan splash selama sebuah layar masih memuat. Mengembalikan fungsi untuk
 * melepasnya. Aman dipanggil setelah splash hilang (tidak berbuat apa-apa).
 */
export function holdSplash() {
    if (finished) return () => {};

    holds += 1;
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }

    let released = false;

    return () => {
        if (released) return;
        released = true;
        holds = Math.max(0, holds - 1);
        schedule();
    };
}

/** Apakah splash pembuka masih menutupi layar. */
export function isSplashVisible() {
    return !finished && Boolean(element());
}
