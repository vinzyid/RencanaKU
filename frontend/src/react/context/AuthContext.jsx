import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, configureApi, consumeOAuthChoice, STORAGE_KEY, API_BASE } from '../utils/api.js';

const AuthContext = createContext(null);

const PROFILE_RETRIES = 2;
const PROFILE_RETRY_DELAY_MS = 2000;

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
    const [user, setUser] = useState(null);
    const [projects, setProjects] = useState([]);
    const [bootstrapping, setBootstrapping] = useState(Boolean(localStorage.getItem(STORAGE_KEY)));
    const [oauthError, setOauthError] = useState('');
    const tokenRef = useRef(token);
    tokenRef.current = token;

    const setSession = useCallback((newToken, newUser = null) => {
        if (newToken) {
            localStorage.setItem(STORAGE_KEY, newToken);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
        setToken(newToken || null);
        if (newUser !== null) setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
        setProjects([]);
    }, []);

    useEffect(() => {
        configureApi({
            getToken: () => tokenRef.current,
            onUnauthorized: (rejectedToken) => {
                if (rejectedToken && rejectedToken === tokenRef.current) logout();
            },
        });
    }, [logout]);

    const login = useCallback(async (endpoint, payload) => {
        const data = await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
        setSession(data.token, data.user);
        return data;
    }, [setSession]);

    const loadProfile = useCallback(async () => {
        // Nama pengguna ditampilkan begitu /me selesai, tanpa menunggu /projects.
        const mePromise = api('/me').then((res) => {
            setUser(res.user);
            return res;
        });
        const [meRes, projectsRes] = await Promise.all([mePromise, api('/projects')]);
        setProjects(projectsRes.projects || []);
        return { user: meRes.user, projects: projectsRes.projects || [] };
    }, []);

    const refreshProjects = useCallback(async () => {
        const data = await api('/projects');
        setProjects(data.projects || []);
        return data.projects || [];
    }, []);

    // Tangkap hasil callback OAuth (kode sekali-pakai) dan error OAuth.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get('oauth_error');
        if (error) {
            setOauthError(error);
            window.history.replaceState({}, '', window.location.pathname);
        }

        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const oauthCode = hash.get('oauth_code');
        if (!oauthCode) return;

        window.history.replaceState({}, '', window.location.pathname);

        (async () => {
            try {
                const response = await fetch(`${API_BASE}/api/oauth/token/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ code: oauthCode, remember: consumeOAuthChoice() }),
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.token) {
                    setOauthError(data?.message || 'Gagal menyelesaikan login. Silakan coba lagi.');
                    return;
                }
                setSession(data.token, data.user || null);
            } catch {
                setOauthError('Gagal menyelesaikan login. Silakan coba lagi.');
            }
        })();
    }, [setSession]);

    // Muat profil saat token tersedia.
    useEffect(() => {
        if (!token) {
            setBootstrapping(false);
            return;
        }
        let cancelled = false;
        setBootstrapping(true);
        (async () => {
            // Gangguan sementara (jaringan, 5xx, 429) dicoba ulang dan tidak
            // menghapus sesi. Hanya 401 (token ditolak) yang berarti logout,
            // dan itu sudah ditangani oleh onUnauthorized di atas.
            for (let attempt = 0; attempt <= PROFILE_RETRIES && !cancelled; attempt++) {
                try {
                    await loadProfile();
                    break;
                } catch (error) {
                    if (cancelled || error?.status === 401) break;
                    if (attempt < PROFILE_RETRIES) {
                        await new Promise((resolve) => setTimeout(resolve, PROFILE_RETRY_DELAY_MS));
                    }
                }
            }
            if (!cancelled) setBootstrapping(false);
        })();
        return () => { cancelled = true; };
    }, [token, loadProfile, logout]);

    const value = {
        token,
        user,
        projects,
        setProjects,
        bootstrapping,
        oauthError,
        isAuthenticated: Boolean(token),
        login,
        logout,
        loadProfile,
        refreshProjects,
        setUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
