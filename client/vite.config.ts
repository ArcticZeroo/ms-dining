import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
      react()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: false,
        secure: false,
        configure(proxy) {
          proxy.on('error', err => {
            console.log('Proxy error: ', err);
          });

          proxy.on('proxyReq', (proxyRequest, request) => {
            console.log('Proxy request: ', request.method, request.url);
          });

          proxy.on('proxyRes', (proxyResponse, request) => {
            console.log('Proxy response: ', request.method, request.url, proxyResponse.statusCode, proxyResponse.statusMessage);
          });
        }
      }
    }
  }
})
