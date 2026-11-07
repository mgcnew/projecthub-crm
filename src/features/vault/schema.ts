import { z } from 'zod'
import { masterPasswordIssues } from '@/lib/vaultCrypto'

const strongPassword = z.string().superRefine((v, ctx) => {
  for (const message of masterPasswordIssues(v)) ctx.addIssue({ code: 'custom', message })
})

export const ATTEMPT_OPTIONS = [3, 4, 5, 7, 10] as const

export const setupSchema = z
  .object({
    password: strongPassword,
    confirm: z.string(),
    maxAttempts: z.string(),
    understood: z.boolean().refine((v) => v, 'Confirme que você entendeu que não há como recuperar a senha mestra'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' })
export type SetupValues = z.infer<typeof setupSchema>

export const rekeySchema = z
  .object({
    current: z.string().min(1, 'Digite a senha mestra atual'),
    password: strongPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' })
  .refine((v) => v.password !== v.current, { path: ['password'], message: 'A nova senha precisa ser diferente da atual' })
export type RekeyValues = z.infer<typeof rekeySchema>

export const secretSchema = z.object({
  password: z.string().min(1, 'Informe a senha').max(2000, 'Máximo de 2.000 caracteres'),
  notes: z.string().max(5000, 'Máximo de 5.000 caracteres'),
})
export type SecretValues = z.infer<typeof secretSchema>
