/**
 * Cabeçalhos de segurança da aplicação (fonte única).
 * Usados pelo `vite preview` (verificados no E2E `csp.e2e.ts`) e a replicar no host de produção (docs/DEPLOY.md).
 * Nunca aplicar ao servidor de desenvolvimento: o HMR do Vite precisa de script inline e WebSocket.
 */
export function securityHeaders(supabaseUrl: string): Record<string, string> {
  let supabaseOrigin = ''
  try {
    supabaseOrigin = new URL(supabaseUrl).origin
  } catch {
    // URL ausente/ inválida: connect-src fica restrito a 'self'.
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  return {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  }
}
