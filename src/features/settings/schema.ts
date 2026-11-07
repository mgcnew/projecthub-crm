import { z } from 'zod'

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Informe seu nome').max(120, 'Máximo de 120 caracteres'),
})
export type ProfileValues = z.infer<typeof profileSchema>

export const workspaceSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do espaço').max(120, 'Máximo de 120 caracteres'),
})
export type WorkspaceValues = z.infer<typeof workspaceSchema>

export const emailChangeSchema = z.object({
  email: z.string().trim().min(1, 'Informe o novo e-mail').pipe(z.email('E-mail inválido')),
})
export type EmailChangeValues = z.infer<typeof emailChangeSchema>

export const roleLabels: Record<string, string> = { owner: 'Proprietário', member: 'Membro' }
