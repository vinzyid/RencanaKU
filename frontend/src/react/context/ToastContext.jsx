import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let idSeq = 0;

const PALETTE = {
    info: 'bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900',
    success: 'bg-emerald-600/95 text-white',
    error: 'bg-rose-600/95 text-white',
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const remove = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info') => {
        const id = ++idSeq;
        setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
        setTimeout(() => {
            setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
            setTimeout(() => remove(id), 300);
        }, 2600);
    }, [remove]);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`px-5 py-3 rounded-xl shadow-2xl text-xs font-semibold transition-all duration-300 ${PALETTE[t.type] || PALETTE.info} ${t.leaving ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
