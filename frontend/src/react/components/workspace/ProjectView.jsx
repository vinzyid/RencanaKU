import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useProject } from '../../context/ProjectContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { STEPS, stageLabel, timeAgo, nl2br, esc } from '../../utils/format.js';
import { chevronLeft, paperclip, send } from '../../utils/icons.js';

function Stepper({ stage }) {
    const currentIndex = STEPS.findIndex((s) => s.id === stage);

    return (
        <div className="flex items-center justify-between relative">
            {STEPS.map((step, idx) => {
                const isCompleted = idx < currentIndex;
                const isActive = idx === currentIndex;
                const circleClass = isCompleted
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                    : isActive
                        ? 'bg-[#5B4DF6] text-white ring-4 ring-indigo-100 dark:ring-indigo-950 shadow-md shadow-indigo-500/25'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700';

                return (
                    <div key={step.id} className="contents">
                        <div className="flex items-center gap-3 z-10">
                            <div className={`w-8 h-8 rounded-full ${circleClass} flex items-center justify-center font-bold text-xs transition-all`}>
                                {isCompleted ? '✓' : step.num}
                            </div>
                            <div className="hidden md:block">
                                <div className={`text-xs font-bold ${isActive ? 'text-[#5B4DF6]' : isCompleted ? 'text-slate-800 dark:text-white' : 'text-slate-400 font-heading'}`}>{step.title}</div>
                                <div className="text-[10px] text-slate-400">{step.sub}</div>
                            </div>
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`flex-1 h-[2px] mx-2 sm:mx-4 ${idx < currentIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'} transition-all`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">R</div>
            <div className="chat-bubble-ai p-4 space-y-2">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                    <span>RencanaKU sedang memproses ide kamu...</span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                    <div className="w-2 h-2 rounded-full bg-[#5B4DF6] typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-[#5B4DF6] typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-[#5B4DF6] typing-dot" />
                </div>
            </div>
        </div>
    );
}

function ChatThread({ messages, onChip }) {
    if (!messages.length) {
        return (
            <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">R</div>
                <div className="space-y-2 max-w-xl">
                    <div className="chat-bubble-ai p-4">
                        <div className="text-xs sm:text-sm leading-relaxed">
                            Halo! Aku <strong>RencanaKU</strong>, siap membantu mengubah ide kamu menjadi PRD yang terstruktur dan bebas kontradiksi.<br /><br />Mau bikin apa hari ini?
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 px-1">Baru saja</div>
                </div>
            </div>
        );
    }

    return messages.map((message, i) => {
        const isUser = message.sender === 'user';
        const chips = message.quick_replies || [];

        if (isUser) {
            return (
                <div key={message.id || i} className="flex justify-end">
                    <div className="space-y-1.5 max-w-lg">
                        <div className="chat-bubble-user p-4 text-xs sm:text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: nl2br(message.content) }} />
                        <div className="text-[10px] text-slate-400 text-right px-1">Terkirim</div>
                    </div>
                </div>
            );
        }

        return (
            <div key={message.id || i} className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-[#5B4DF6] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">R</div>
                <div className="space-y-3 max-w-xl">
                    <div className="chat-bubble-ai p-4 text-xs sm:text-sm leading-relaxed space-y-2">
                        <div dangerouslySetInnerHTML={{ __html: nl2br(message.content) }} />
                        {chips.length > 0 && (
                            <div className="pt-2 flex flex-wrap gap-2">
                                {chips.map((chip) => (
                                    <button key={chip} onClick={() => onChip(chip)} className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-[#5B4DF6] dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 hover:bg-[#5B4DF6] hover:text-white transition">{chip}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="text-[10px] text-slate-400 px-1">{timeAgo(message.created_at)}</div>
                </div>
            </div>
        );
    });
}

export default function ProjectView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { refreshProjects } = useAuth();
    const { showToast } = useToast();
    const project = useProject();
    const { project: current, messages, stage, prd, isAiTyping, sendMessage, openProject, resetProjectState } = project;

    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const threadRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await openProject(id);
            } catch (err) {
                if (!cancelled) showToast(err.message, 'error');
            }
        })();
        return () => { cancelled = true; };
    }, [id, openProject, showToast]);

    useEffect(() => {
        if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }, [messages, isAiTyping]);

    if (!current) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-[#5B4DF6] rounded-full animate-spin" />
            </div>
        );
    }

    const handleSend = async (content) => {
        const value = content.trim();
        if (!value) return;
        setError('');
        try {
            await sendMessage(value);
            refreshProjects().catch(() => {});
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const value = input;
        setInput('');
        handleSend(value);
    };

    const handleChip = (chip) => {
        if (chip.toLowerCase().includes('dokumen')) {
            navigate(`/app/projects/${id}/documentation`);
            return;
        }
        handleSend(chip);
    };

    const handleBack = () => {
        resetProjectState();
        navigate('/app/dashboard');
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white dark:bg-[#121624] p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                <Stepper stage={stage} />
            </div>

            <div className="bg-white dark:bg-[#121624] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col h-[650px] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={handleBack} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                            <span dangerouslySetInnerHTML={{ __html: chevronLeft }} />
                        </button>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">{current.title}</h2>
                            <span className="text-[11px] font-semibold text-[#5B4DF6]">{stageLabel(stage)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {prd && (
                            <button onClick={() => navigate(`/app/projects/${id}/documentation`)} className="btn-secondary text-xs px-3.5 py-1.5 font-bold flex items-center gap-1.5">📄 Lihat Dokumen PRD</button>
                        )}
                    </div>
                </div>

                <div ref={threadRef} className="flex-1 p-6 overflow-y-auto space-y-6">
                    <ChatThread messages={messages} onChip={handleChip} />
                    {isAiTyping && <TypingIndicator />}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <form onSubmit={handleSubmit} className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-[#5B4DF6]">
                        <button type="button" onClick={() => showToast('Upload lampiran akan segera hadir. 🚧', 'info')} className="p-1"><span dangerouslySetInnerHTML={{ __html: paperclip }} /></button>
                        <textarea
                            rows={1}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    e.currentTarget.form.requestSubmit();
                                }
                            }}
                            placeholder="Tulis pesanmu di sini..."
                            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none resize-none max-h-32"
                        />
                        <div className="hidden sm:block text-[11px] text-slate-400 shrink-0 font-medium">Shift + Enter untuk baris baru</div>
                        <button type="submit" className="w-8 h-8 rounded-full bg-[#5B4DF6] hover:bg-[#4E3FE3] text-white flex items-center justify-center shrink-0 shadow-sm transition">
                            <span dangerouslySetInnerHTML={{ __html: send }} />
                        </button>
                    </form>
                    {error ? <p className="text-xs text-rose-500 font-medium mt-2 px-2">{error}</p> : null}
                </div>
            </div>
        </div>
    );
}
