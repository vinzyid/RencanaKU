import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { api } from '../utils/api.js';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
    const [project, setProject] = useState(null);
    const [messages, setMessages] = useState([]);
    const [prd, setPrd] = useState(null);
    const [diff, setDiff] = useState([]);
    const [stage, setStage] = useState('input_idea');
    const [validation, setValidation] = useState({ ambiguities: 0, contradictions: 0, can_finalize: false });
    const [prdStatus, setPrdStatus] = useState('idle');
    const [prdError, setPrdError] = useState(null);
    const [isAiTyping, setIsAiTyping] = useState(false);
    const [activeDocTab, setActiveDocTab] = useState('preview');
    const pollRef = useRef(null);

    const applyProjectPayload = useCallback((data) => {
        setProject(data.project || null);
        setMessages(data.messages || []);
        setPrd(data.prd || null);
        setDiff(data.diff || []);
        setStage(data.stage || 'input_idea');
        setValidation(data.validation || { ambiguities: 0, contradictions: 0, can_finalize: false });
        setPrdStatus(data.prd_status || data.project?.prd_status || 'idle');
        setPrdError(data.prd_error || null);
    }, []);

    const resetProjectState = useCallback(() => {
        setProject(null);
        setMessages([]);
        setPrd(null);
        setDiff([]);
        setStage('input_idea');
        setValidation({ ambiguities: 0, contradictions: 0, can_finalize: false });
        setPrdStatus('idle');
        setPrdError(null);
        setIsAiTyping(false);
        setActiveDocTab('preview');
        if (pollRef.current) clearInterval(pollRef.current);
    }, []);

    const openProject = useCallback(async (id) => {
        const data = await api(`/projects/${id}`);
        applyProjectPayload(data);
        return data;
    }, [applyProjectPayload]);

    const pollProjectUntilIdle = useCallback(async (projectId) => {
        const intervalMs = 2000;
        const maxMs = 5 * 60 * 1000;
        const startedAt = Date.now();

        while (Date.now() - startedAt < maxMs) {
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
            try {
                const data = await api(`/projects/${projectId}`);
                applyProjectPayload(data);
                if ((data.prd_status || data.project?.prd_status) !== 'processing') {
                    if (data.prd_error) {
                        // biarkan pemanggil menampilkan alert
                        return data.prd_error;
                    }
                    return null;
                }
            } catch {
                // retry sampai timeout
            }
        }
        return null;
    }, [applyProjectPayload]);

    const sendMessage = useCallback(async (content) => {
        if (!content) return;
        const projectId = project?.id;
        if (!projectId) return;

        setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, sender: 'user', content, created_at: new Date().toISOString() }]);
        setIsAiTyping(true);

        try {
            const data = await api(`/projects/${projectId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
            applyProjectPayload(data);
            if ((data.prd_status || data.project?.prd_status) === 'processing') {
                const err = await pollProjectUntilIdle(projectId);
                if (err) window.alert(err);
            }
            return null;
        } catch (err) {
            setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('tmp-')));
            throw err;
        } finally {
            setIsAiTyping(false);
        }
    }, [project, applyProjectPayload, pollProjectUntilIdle]);

    const finalize = useCallback(async () => {
        const data = await api(`/projects/${project.id}/finalize`, { method: 'POST' });
        applyProjectPayload(data);
        return data;
    }, [project, applyProjectPayload]);

    const createProject = useCallback(async (payload) => {
        const data = await api('/projects', { method: 'POST', body: JSON.stringify(payload) });
        applyProjectPayload(data);
        return data;
    }, [applyProjectPayload]);

    const value = {
        project, messages, prd, diff, stage, validation, prdStatus, prdError, isAiTyping, activeDocTab,
        setActiveDocTab, applyProjectPayload, resetProjectState, openProject,
        pollProjectUntilIdle, sendMessage, finalize, createProject, setIsAiTyping, setProject, setPrd, setValidation, setStage,
    };

    return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
    const ctx = useContext(ProjectContext);
    if (!ctx) throw new Error('useProject must be used within ProjectProvider');
    return ctx;
}
