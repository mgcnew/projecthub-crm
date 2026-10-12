import { z } from 'zod'

// Somente valores públicos. service_role e segredos jamais entram no bundle (AGENTS.md #6).
export const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(raw: Record<string, unknown>) {
  return envSchema.safeParse(raw)
}
