import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            manifest: {
                name: '올라운더',
                short_name: '올라운더',
                description: '일정, 재정, 목표, 공부, 회고를 한 곳에서 관리하는 올인원 생산성 앱',
                theme_color: '#6366f1',
                background_color: '#09090b',
                display: 'standalone',
                start_url: '/',
                lang: 'ko',
                icons: [
                    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } },
                    },
                ],
            },
        }),
    ],
});