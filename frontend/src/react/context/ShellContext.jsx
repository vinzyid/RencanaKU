import { createContext, useCallback, useContext, useState } from 'react';

const ShellContext = createContext(null);

const DEFAULT_NOTIFICATIONS = [
    { id: 1, type: 'success', icon: '✅', title: 'Dokumen PRD Selesai', desc: 'Proyek terbaru Anda telah berhasil difinalisasi dan siap untuk diekspor ke PDF/Markdown.', timeAgo: 'Baru saja', isRead: false },
    { id: 2, type: 'warning', icon: '⚠️', title: 'Ambiguitas Terdeteksi', desc: 'AI mendeteksi 2 poin requirement yang masih ambigu pada draft terbaru Anda. Mohon lakukan klarifikasi.', timeAgo: '2 jam yang lalu', isRead: false },
    { id: 3, type: 'info', icon: '👋', title: 'Selamat Datang di RencanaKU', desc: 'Ubah ide aplikasimu menjadi spesifikasi PRD profesional dalam hitungan menit. Coba gunakan fitur Template untuk memulai!', timeAgo: '1 hari yang lalu', isRead: true },
];

export function ShellProvider({ children }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProjectPrefill, setNewProjectPrefill] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState('md');
    const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
    const [showNotifPopup, setShowNotifPopup] = useState(false);
    const [settingsTab, setSettingsTab] = useState('profile');

    const openNewProjectModal = useCallback((prefill = null) => {
        setNewProjectPrefill(prefill);
        setShowNewProjectModal(true);
    }, []);

    const closeNewProjectModal = useCallback(() => {
        setShowNewProjectModal(false);
        setNewProjectPrefill(null);
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }, []);

    const markRead = useCallback((id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    }, []);

    const clearNotifications = useCallback(() => setNotifications([]), []);

    const value = {
        searchQuery, setSearchQuery,
        showNewProjectModal, openNewProjectModal, closeNewProjectModal, newProjectPrefill,
        showExportModal, setShowExportModal,
        exportFormat, setExportFormat,
        notifications, markAllRead, markRead, clearNotifications,
        showNotifPopup, setShowNotifPopup,
        settingsTab, setSettingsTab,
    };

    return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
    const ctx = useContext(ShellContext);
    if (!ctx) throw new Error('useShell must be used within ShellProvider');
    return ctx;
}
