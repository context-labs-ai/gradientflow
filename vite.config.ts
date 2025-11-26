import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 5173,
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // Core React vendor bundle
                    'vendor-react': ['react', 'react-dom'],
                    // Animation library (large)
                    'vendor-motion': ['framer-motion'],
                    // UI utilities
                    'vendor-ui': ['clsx', 'dayjs', 'react-hot-toast'],
                    // Markdown rendering
                    'vendor-markdown': ['react-markdown'],
                    // Virtualization
                    'vendor-virtuoso': ['react-virtuoso'],
                },
            },
        },
        // Increase chunk size warning limit (optional)
        chunkSizeWarningLimit: 600,
    },
});
