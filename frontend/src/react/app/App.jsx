import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { markSplashReady } from '../utils/splash.js';
import { AppLoader, GlobalLoadingBar } from '../components/common/LoadingIndicator.jsx';
import LandingPage from '../components/landing/LandingPage.jsx';
import AuthPage from '../components/auth/AuthPage.jsx';
import ForgotPasswordPage from '../components/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from '../components/auth/ResetPasswordPage.jsx';
import WorkspaceLayout from '../components/workspace/WorkspaceLayout.jsx';
import DashboardView from '../components/workspace/DashboardView.jsx';
import ProjectsView from '../components/workspace/ProjectsView.jsx';
import TemplatesView from '../components/workspace/TemplatesView.jsx';
import HistoryView from '../components/workspace/HistoryView.jsx';
import SettingsView from '../components/workspace/SettingsView.jsx';
import NotificationsView from '../components/workspace/NotificationsView.jsx';
import ProjectView from '../components/workspace/ProjectView.jsx';
import DocumentationView from '../components/workspace/DocumentationView.jsx';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import AdminOverview from '../components/admin/AdminOverview.jsx';
import AdminUsers from '../components/admin/AdminUsers.jsx';
import AdminTokens from '../components/admin/AdminTokens.jsx';
import AdminGreen from '../components/admin/AdminGreen.jsx';

function RequireAuth({ children }) {
    const { isAuthenticated, bootstrapping, user } = useAuth();
    if (bootstrapping) return <AppLoader />;
    if (!isAuthenticated) return <Navigate to="/" replace />;
    // Admin murni hanya area admin.
    if (user?.is_admin) return <Navigate to="/admin/overview" replace />;
    return children;
}

function RequireAdmin({ children }) {
    const { isAuthenticated, bootstrapping, user } = useAuth();
    if (bootstrapping) return <AppLoader />;
    if (!isAuthenticated) return <Navigate to="/" replace />;
    if (!user?.is_admin) return <Navigate to="/app/dashboard" replace />;
    return children;
}

export default function App() {
    // Aplikasi sudah ter-mount: splash pembuka boleh ditutup (kecuali masih
    // ditahan oleh layar yang sedang memuat, lihat AppLoader).
    useEffect(() => {
        markSplashReady();
    }, []);

    return (
        <>
        <GlobalLoadingBar />
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
                path="/app"
                element={
                    <RequireAuth>
                        <WorkspaceLayout />
                    </RequireAuth>
                }
            >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardView />} />
                <Route path="projects" element={<ProjectsView />} />
                <Route path="projects/:id" element={<ProjectView />} />
                <Route path="projects/:id/documentation" element={<DocumentationView />} />
                <Route path="templates" element={<TemplatesView />} />
                <Route path="history" element={<HistoryView />} />
                <Route path="notifications" element={<NotificationsView />} />
                <Route path="settings" element={<SettingsView />} />
            </Route>
            <Route
                path="/admin"
                element={
                    <RequireAdmin>
                        <AdminLayout />
                    </RequireAdmin>
                }
            >
                <Route index element={<Navigate to="overview" replace />} />
                <Route path="overview" element={<AdminOverview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="tokens" element={<AdminTokens />} />
                <Route path="green" element={<AdminGreen />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </>
    );
}
