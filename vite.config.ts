/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { securityHeaders } from './config/security-headers.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
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
