import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

const backendPath = resolve(__dirname, '../backend');

export default defineConfig({
    plugins: [
        laravel({
            hotFile: resolve(backendPath, 'public/hot'),
            buildDirectory: 'build',
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
    build: {
        outDir: resolve(backendPath, 'public/build'),
        emptyOutDir: true,
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
        fs: {
            allow: [resolve(__dirname), backendPath],
        },
    },
});
