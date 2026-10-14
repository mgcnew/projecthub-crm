import { defineConfig, devices } from '@playwright/test'

// Exige o Supabase local (`npx supabase start`); use `npm run test:e2e`.
// O servidor Vite é reaproveitado se já estiver de pé na porta 5173.
const baseURL = 'http://127.0.0.1:5173'
// Build de produção servido pelo `vite preview` com CSP e demais cabeçalhos de segurança.
const previewURL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'pt-BR',
    // Fuso fixo: lembretes e "hoje" dependem do fuso do navegador.
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/mobile.e2e.ts', '**/csp.e2e.ts', '**/panel-mobile.e2e.ts'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: ['**/mobile.e2e.ts', '**/a11y.e2e.ts', '**/panel-mobile.e2e.ts', '**/password-reset.e2e.ts', '**/search.e2e.ts', '**/access.e2e.ts', '**/finance.e2e.ts', '**/client-registry.e2e.ts', '**/client-relationship.e2e.ts'],
    },
    {
      name: 'csp',
      use: { ...devices['Desktop Chrome'], baseURL: previewURL },
      testMatch: '**/csp.e2e.ts',
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: previewURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
