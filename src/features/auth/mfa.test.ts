import type { Session } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { needsSecondFactor, sessionAal, verifiedTotpFactor } from './mfa'

function jwt(claims: Record<string, unknown>) {
  const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${enc({ alg: 'HS256' })}.${enc(claims)}.sig`
}

function session(aal: string | undefined, factors: { status: string; factor_type?: string }[] | undefined) {
  return {
    access_token: jwt(aal ? { aal } : {}),
    user: { factors: factors?.map((f) => ({ id: 'f1', factor_type: 'totp', ...f })) },
  } as unknown as Session
}

describe('mfa', () => {
  it('lê o aal do JWT', () => {
    expect(sessionAal(session('aal2', []))).toBe('aal2')
    expect(sessionAal(session('aal1', []))).toBe('aal1')
    expect(sessionAal(session(undefined, []))).toBe('aal1')
    expect(sessionAal(null)).toBeNull()
    expect(sessionAal({ access_token: 'lixo', user: {} } as unknown as Session)).toBeNull()
  })

  it('só fator TOTP verificado conta', () => {
    expect(verifiedTotpFactor(session('aal1', [{ status: 'unverified' }]))).toBeNull()
    expect(verifiedTotpFactor(session('aal1', [{ status: 'verified', factor_type: 'phone' }]))).toBeNull()
    expect(verifiedTotpFactor(session('aal1', [{ status: 'verified' }]))).not.toBeNull()
    expect(verifiedTotpFactor(session('aal1', undefined))).toBeNull()
  })

  it('exige o segundo fator só com fator verificado e sessão aal1', () => {
    expect(needsSecondFactor(session('aal1', [{ status: 'verified' }]))).toBe(true)
    expect(needsSecondFactor(session('aal2', [{ status: 'verified' }]))).toBe(false)
    expect(needsSecondFactor(session('aal1', []))).toBe(false)
    expect(needsSecondFactor(session('aal1', [{ status: 'unverified' }]))).toBe(false)
    expect(needsSecondFactor(null)).toBe(false)
  })
})
