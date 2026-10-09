import { ThemeProvider } from '../context/ThemeContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { ShellProvider } from '../context/ShellContext.jsx';
import { ProjectProvider } from '../context/ProjectContext.jsx';

export function AppProviders({ children }) {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <ShellProvider>
                        <ProjectProvider>{children}</ProjectProvider>
                    </ShellProvider>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
