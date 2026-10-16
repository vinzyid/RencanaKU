import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8000';

    return {
        plugins: [
            react(),
            tailwindcss(),
        ],
        base: '/',
        build: {
            outDir: 'dist',
            emptyOutDir: true,
        },
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: backendUrl,
                    changeOrigin: true,
                },
                '/oauth': {
                    target: backendUrl,
                    changeOrigin: true,
                },
            },
        },
    };
});
