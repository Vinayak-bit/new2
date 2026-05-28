import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/auth': 'http://localhost:8000',
            '/expenses': 'http://localhost:8000',
            '/budgets': 'http://localhost:8000',
            '/income': 'http://localhost:8000',
            '/zbb': 'http://localhost:8000',
            '/classify': 'http://localhost:8000',
            '/chat': 'http://localhost:8000',
            '/gamification': 'http://localhost:8000',
        },
    },
    // ── ADD THIS BUILD SECTION ───────────────────────────────────
    build: {
        outDir: '../dist',   // Outputs the build into the root folder where FastAPI looks for it
        emptyOutDir: true,   // Wipes any old builds before building a fresh one
    },
});