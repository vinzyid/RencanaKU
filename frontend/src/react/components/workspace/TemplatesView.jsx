import { useShell } from '../../context/ShellContext.jsx';
import {
    tplCart,
    tplClinic,
    tplPos,
    tplLms,
    tplTask,
    tplHris,
    tplHotel,
    tplFinance,
    tplInventory,
    tplCrm,
} from '../../utils/icons.js';

const TEMPLATES = [
    { icon: tplCart, title: 'E-Commerce / Marketplace', desc: 'Aplikasi jual beli online dengan keranjang belanja, integrasi pembayaran, dan manajemen produk.', prompt: 'Saya ingin membuat platform e-commerce. Pengguna bisa mencari produk, menambahkan ke keranjang, dan melakukan checkout. Fitur utamanya mencakup katalog produk dengan filter, integrasi payment gateway, dan dashboard admin untuk mengelola inventaris. Aplikasi ini diperuntukkan untuk mobile dan web.' },
    { icon: tplClinic, title: 'Sistem Manajemen Klinik', desc: 'Aplikasi untuk menjadwalkan konsultasi dokter, rekam medis pasien, dan tagihan.', prompt: 'Saya ingin membangun sistem manajemen klinik kesehatan. Pasien dapat membuat janji temu secara online. Dokter memiliki akses untuk melihat jadwal dan mencatat rekam medis. Admin klinik mengelola pembayaran dan tagihan. Harus sangat aman (HIPAA/standard privasi).' },
    { icon: tplPos, title: 'Aplikasi Point of Sales (POS)', desc: 'Sistem kasir untuk restoran atau toko ritel dengan manajemen stok dan laporan penjualan.', prompt: 'Saya butuh aplikasi kasir (POS) untuk restoran berbasis tablet. Fiturnya meliputi pemesanan makanan berdasarkan nomor meja, cetak struk ke printer thermal, manajemen stok bahan baku dapur yang berkurang otomatis setiap ada pesanan, dan laporan penjualan harian.' },
    { icon: tplLms, title: 'Learning Management System (LMS)', desc: 'Platform kursus online dengan materi video, kuis interaktif, dan sertifikat.', prompt: 'Platform LMS (Learning Management System) untuk kursus online. Instruktur bisa mengunggah video materi dan membuat kuis. Siswa bisa mendaftar kursus, menonton video, mengikuti kuis, dan mendapatkan sertifikat digital jika lulus. Ada forum diskusi per kursus.' },
    { icon: tplTask, title: 'Task Management / To-Do List', desc: 'Aplikasi produktivitas untuk mengelola tugas tim dengan deadline dan kolaborasi.', prompt: 'Aplikasi manajemen tugas (seperti Trello/Asana) di mana pengguna dapat membuat proyek, membagi tugas ke dalam kolom (To Do, In Progress, Done), menetapkan deadline, assign tugas ke anggota tim, dan meninggalkan komentar pada tugas tersebut.' },
    { icon: tplHris, title: 'Human Resource (HRIS)', desc: 'Sistem manajemen kepegawaian meliputi absensi, cuti, dan penggajian (payroll).', prompt: 'Saya ingin membuat sistem Human Resource Information System (HRIS). Karyawan bisa melakukan absensi via mobile dengan geolokasi, mengajukan cuti, dan melihat slip gaji. HR/Admin dapat menyetujui cuti, menghitung payroll otomatis berdasarkan kehadiran, dan mengelola database karyawan.' },
    { icon: tplHotel, title: 'Booking & Reservasi Hotel', desc: 'Aplikasi pencarian kamar hotel, pengecekan ketersediaan, dan sistem booking.', prompt: 'Aplikasi booking hotel dimana tamu bisa mencari kamar berdasarkan tanggal dan tipe, melihat fasilitas kamar, dan melakukan pembayaran. Admin hotel memiliki dashboard untuk melihat reservasi masuk, mengubah status kamar menjadi tersedia/kotor, dan laporan okupansi harian.' },
    { icon: tplFinance, title: 'Personal Finance Tracker', desc: 'Aplikasi pelacakan pemasukan, pengeluaran, dan manajemen budget pribadi.', prompt: 'Aplikasi pelacak keuangan pribadi (Personal Finance Tracker). Pengguna bisa mencatat pemasukan dan pengeluaran harian, mengkategorikan transaksi (makanan, transportasi, dll), menetapkan budget bulanan, dan melihat grafik analisis pengeluaran. Mendukung ekspor laporan ke CSV atau PDF.' },
    { icon: tplInventory, title: 'Inventory & Warehouse', desc: 'Sistem manajemen gudang, pelacakan stok barang masuk/keluar, dan barcode scanning.', prompt: 'Sistem manajemen gudang (Warehouse Management System). Mendukung fitur pencatatan barang masuk (inbound) dan barang keluar (outbound). Admin bisa melacak sisa stok secara real-time, mendapatkan alert jika stok menipis, dan fitur scan barcode menggunakan kamera perangkat mobile.' },
    { icon: tplCrm, title: 'Customer Relationship (CRM)', desc: 'Platform untuk mengelola interaksi dengan prospek (leads) dan klien pelanggan.', prompt: 'Aplikasi Customer Relationship Management (CRM) untuk tim sales. Fitur utama mencakup manajemen data klien (leads), mencatat riwayat komunikasi/meeting, memantau tahapan sales pipeline (prospecting, negotiation, closed-won), dan pengingat jadwal follow-up otomatis.' },
];

export default function TemplatesView() {
    const shell = useShell();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-heading">Template RencanaKU</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pilih template awal untuk mempercepat pembuatan draft PRD.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {TEMPLATES.map((tpl) => (
                    <div key={tpl.title} className="bg-white dark:bg-[#121624] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-[#5B4DF6] dark:hover:border-[#5B4DF6] transition flex flex-col justify-between group">
                        <div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#5B4DF6] [&_svg]:group-hover:text-white transition duration-300" dangerouslySetInnerHTML={{ __html: tpl.icon }} />
                            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2 font-heading group-hover:text-[#5B4DF6] transition">{tpl.title}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">{tpl.desc}</p>
                        </div>
                        <button onClick={() => shell.openNewProjectModal(tpl.prompt)} className="w-full py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 group-hover:bg-[#5B4DF6] group-hover:text-white group-hover:border-[#5B4DF6] transition shadow-xs">
                            Gunakan Template Ini
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
