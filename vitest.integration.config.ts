import { defineConfig } from 'vitest/config'

// Exige Supabase local rodando; use `npm run test:integration`.
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.int.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 20_000,
    fileParallelism: false,
  },
})
