import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

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
export default defineConfig({
    plugins: [
        react()
    ],
    server:  {
        proxy: {
            '/api':    defaultLocalProxy,
            '/static': defaultLocalProxy
        }
    }
})
