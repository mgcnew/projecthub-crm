/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { securityHeaders } from './config/security-headers.ts'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // PWA: instalável e com o app (HTML, JS, CSS, fontes) guardado para abrir sem rede. Os dados NÃO são
    // guardados pelo service worker: toda chamada ao Supabase vai direto à rede (nada de sessão em cache).
    // A atualização é por aviso ("prompt"): a nova versão só assume quando a pessoa clica em Atualizar,
    // para não recarregar a página no meio de um formulário.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/app',
        name: 'ProjectHub CRM',
        short_name: 'ProjectHub',
        description: 'Clientes, projetos, reuniões, tarefas e prospecção em um só lugar.',
        lang: 'pt-BR',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f7f8',
        theme_color: '#0455a1',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,webp,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // O runtime do Workbox vai dentro do sw.js (a CSP só permite script do próprio domínio).
        inlineWorkboxRuntime: true,
        runtimeCaching: [],
      },
    }),
  ],
  // Fontes nunca viram data: URI (a CSP de produção só permite font-src 'self'); demais assets seguem o padrão.
  build: { assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  // Pré-visualização do build de produção com os mesmos cabeçalhos do deploy (CSP verificada no E2E).
  preview: { headers: securityHeaders(loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL ?? '') },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['tests/integration/**', 'node_modules/**'],
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    },
  },
}))
