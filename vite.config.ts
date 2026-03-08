import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          }
        }
      },
      plugins: [
        react(),
        {
          name: 'landing-redirect',
          configureServer(server) {
            server.middlewares.use((req, res, next) => {
              // '/' 요청만 landing.html로 리다이렉트
              // '/?q=...' 는 쿼리스트링이 있으므로 통과 → React 앱
              if (req.url === '/' || req.url === '/index.html') {
                res.writeHead(302, { Location: '/landing.html' });
                res.end();
                return;
              }
              next();
            });
          }
        }
      ],
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom', 'lucide-react'],
              firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
              ai: ['@google/genai'],
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_MEDIA_API_KEY': JSON.stringify(env.GEMINI_MEDIA_API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_IMAGE_MODEL': JSON.stringify(env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation'),
        'process.env.GEMINI_IMAGE_FALLBACK_MODEL': JSON.stringify(env.GEMINI_IMAGE_FALLBACK_MODEL || 'imagen-4.0-generate-001'),
        'process.env.GEMINI_VIDEO_MODEL': JSON.stringify(env.GEMINI_VIDEO_MODEL || 'veo-3.1-fast-generate-preview'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
