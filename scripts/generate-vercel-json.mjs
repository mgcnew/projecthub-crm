#!/usr/bin/env node
// Gera vercel.json a partir de config/vercel-config.ts (fonte única dos cabeçalhos de segurança).
// Uso: node scripts/generate-vercel-json.mjs [origem-do-supabase]
//   sem argumento: https://*.supabase.co (qualquer projeto); com a origem exata, o connect-src fica mais estrito.
import { writeFileSync } from 'node:fs'
import { buildVercelConfig } from '../config/vercel-config.ts'

const origin = process.argv[2]
const config = origin ? buildVercelConfig(origin) : buildVercelConfig()
writeFileSync(new URL('../vercel.json', import.meta.url), JSON.stringify(config, null, 2) + '\n')
console.log(`vercel.json gerado (connect-src: ${origin ?? 'https://*.supabase.co'})`)
