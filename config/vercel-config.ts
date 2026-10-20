import { securityHeaders } from './security-headers.ts'

/**
 * Configuração do projeto na Vercel (gerada; ver scripts/generate-vercel-json.mjs e docs/DEPLOY.md).
 * Mesma CSP e demais cabeçalhos do `vite preview` verificado no E2E (config/security-headers.ts).
 * `supabaseOrigin` entra no `connect-src`; o padrão aceita qualquer projeto *.supabase.co e pode ser
 * trocado pela origem exata do projeto (mais estrito) ao gerar.
 */
export const DEFAULT_SUPABASE_ORIGIN = 'https://*.supabase.co'

export function buildVercelConfig(supabaseOrigin: string = DEFAULT_SUPABASE_ORIGIN) {
  const security = Object.entries(securityHeaders(supabaseOrigin)).map(([key, value]) => ({ key, value }))
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: 'vite',
    buildCommand: 'npm run build && npm run check:bundle',
    outputDirectory: 'dist',
    // SPA: toda rota desconhecida cai no index.html (o React Router resolve). Arquivos reais têm prioridade.
    rewrites: [{ source: '/(.*)', destination: '/index.html' }],
    headers: [
      {
        source: '/(.*)',
        headers: [
          ...security,
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // App privado (atrás de login): fora dos buscadores.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Assets com hash no nome: cache longo e imutável. O HTML nunca fica em cache (novo deploy vale na hora).
      { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      { source: '/index.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      // Service worker e manifesto: sempre revalidados, para uma versão nova chegar logo ao navegador.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/manifest.webmanifest', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ],
  }
}
