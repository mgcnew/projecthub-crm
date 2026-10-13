#!/usr/bin/env node
// Falha se o bundle de produção (dist/) contiver credenciais privilegiadas.
// Procura VALORES (não palavras): chaves sb_secret_ com sufixo, JWTs com role privilegiada,
// blocos de chave privada e URLs de conexão Postgres com senha.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2] ?? 'dist'
const findings = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(js|mjs|css|html|json|map|txt)$/.test(name)) scan(p, readFileSync(p, 'utf8'))
  }
}

function scan(file, text) {
  for (const m of text.matchAll(/sb_secret_[A-Za-z0-9_-]{16,}/g)) findings.push(`${file}: chave sb_secret_ (${m[0].slice(0, 14)}…)`)
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'))
      if (payload.role && payload.role !== 'anon' && payload.role !== 'authenticated')
        findings.push(`${file}: JWT com role "${payload.role}"`)
    } catch {
      // não era um JWT
    }
  }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) findings.push(`${file}: bloco de chave privada`)
  for (const m of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"`:@/]+:[^\s'"`@/]+@[^\s'"`]+/g))
    findings.push(`${file}: URL de conexão Postgres com senha (${m[0].slice(0, 20)}…)`)
}

walk(root)
if (findings.length) {
  console.error(`Segredos possíveis em ${root}/:\n- ${findings.join('\n- ')}`)
  process.exit(1)
}
console.log(`OK: nenhum segredo privilegiado encontrado em ${root}/`)
