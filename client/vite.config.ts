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
    server:  {
        proxy: {
            '/api':    defaultLocalProxy,
            '/static': defaultLocalProxy
        }
    },
    build: {
        rollupOptions: {
            output: {
                // Avoids issues with sleeping tabs/keeping the site loaded around when changes are made
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        }
    }
}));
