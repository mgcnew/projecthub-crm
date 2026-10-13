import { z } from 'zod'

// CSP estrita (sem 'unsafe-eval'): o Zod 4 compila schemas com `new Function` e sonda esse suporte;
// mesmo capturada, a sonda gera violação de CSP. `jitless` desliga ambos (config/security-headers.ts).
// Este módulo precisa ser o primeiro import de main.tsx, antes de qualquer schema ser criado.
z.config({ jitless: true })
