import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      publicDir: path.resolve(__dirname, 'public'),
      
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // 完全禁用@别名，强制使用相对路径
          // '@': path.resolve(__dirname, '.'), // 已注释
          'public': path.resolve(__dirname, 'public')
          '@/public': path.resolve(__dirname, 'public')
        }
      },
      build: {
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.json')) {
                return 'assets/json/[name][extname]';
              }
              return 'assets/[name][extname]';
            }
          }
        }
      }
    };
});