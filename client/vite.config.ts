import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { visualizer } from 'rollup-plugin-visualizer';
import type { PluginOption } from 'vite';

const defaultLocalProxy = {
    target:       'http://localhost:3002',
    changeOrigin: false,
    secure:       false,
    configure(proxy) {
        proxy.on('error', err => {
            console.error('ERR:', err);
        });

        proxy.on('proxyReq', (proxyRequest, request) => {
            console.log('REQ:', request.method, request.url);
        });

        proxy.on('proxyRes', (proxyResponse, request) => {
            console.log('RES:', request.method, request.url, proxyResponse.statusCode, proxyResponse.statusMessage);
        });
    }
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        mode === 'analyze' && visualizer({
            filename: 'stats.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
        }) as PluginOption,
    ],
    resolve: {
        dedupe: ['zod'],
    },
    server:  {
        proxy: {
            '/api':    defaultLocalProxy,
            '/static': defaultLocalProxy
        }
    },
    build: {
        // Don't wipe dist/ — we keep old hashed assets around so stale
        // tabs can still load them after a deploy. A post-build script
        // cleans up assets older than 14 days.
        emptyOutDir: false,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        }
    }
}));
