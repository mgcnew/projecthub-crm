import { z } from 'zod'

// Mesma política do Auth (supabase/config.toml): 12+ caracteres com minúscula, maiúscula e dígito (D024).
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use pelo menos 12 caracteres')
      .regex(/[a-z]/, 'Inclua uma letra minúscula')
      .regex(/[A-Z]/, 'Inclua uma letra maiúscula')
      .regex(/\d/, 'Inclua um número'),
    confirm: z.string().min(1, 'Repita a senha'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não coincidem' })

export type NewPasswordValues = z.infer<typeof newPasswordSchema>

export const recoverSchema = z.object({ email: z.email('Informe um e-mail válido') })
export type RecoverValues = z.infer<typeof recoverSchema>

export const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Digite os 6 dígitos do aplicativo'),
})
export type CodeValues = z.infer<typeof codeSchema>
