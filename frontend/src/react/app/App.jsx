import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import LandingPage from '../components/landing/LandingPage.jsx';
import AuthPage from '../components/auth/AuthPage.jsx';
import WorkspaceLayout from '../components/workspace/WorkspaceLayout.jsx';
import DashboardView from '../components/workspace/DashboardView.jsx';
import ProjectsView from '../components/workspace/ProjectsView.jsx';
import TemplatesView from '../components/workspace/TemplatesView.jsx';
import HistoryView from '../components/workspace/HistoryView.jsx';
import SettingsView from '../components/workspace/SettingsView.jsx';
import NotificationsView from '../components/workspace/NotificationsView.jsx';
import AdminTokenView from '../components/workspace/AdminTokenView.jsx';
import ProjectView from '../components/workspace/ProjectView.jsx';
import DocumentationView from '../components/workspace/DocumentationView.jsx';

function RequireAuth({ children }) {
    const { isAuthenticated, bootstrapping } = useAuth();
    if (bootstrapping) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8F9FD] dark:bg-[#0B0D14]">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-[#5B4DF6] rounded-full animate-spin" />
            </div>
        );
    }
    if (!isAuthenticated) return <Navigate to="/" replace />;
    return children;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
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
                <Route path="admin-tokens" element={<AdminTokenView />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
