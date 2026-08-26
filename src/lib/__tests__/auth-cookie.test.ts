import { describe, it, expect } from 'vitest'
import {
  needsSessionRefresh,
  readSessionCookie,
  sessionExpiresAt,
  REFRESH_MARGIN_S,
} from '@/lib/auth-cookie'

const NOW_MS = 1_700_000_000_000
const NOW_S = NOW_MS / 1000
const REF = 'sb-jsslyritdivjtsiwdorm-auth-token'

const session = (expiresAt: number) =>
  JSON.stringify({ access_token: 'jwt', refresh_token: 'r', expires_at: expiresAt })

describe('readSessionCookie', () => {
  it('devolve null quando nao ha cookie de sessao', () => {
    expect(readSessionCookie([{ name: 'nexus-theme', value: 'dark' }])).toBeNull()
  })

  it('junta os chunks pela ordem numerica, nao alfabetica', () => {
    // Alfabeticamente ".10" viria antes de ".2" — o que corromperia o JSON.
    const cookies = [
      { name: `${REF}.10`, value: 'K' },
      { name: `${REF}.2`, value: 'C' },
      { name: `${REF}.0`, value: 'A' },
      { name: `${REF}.1`, value: 'B' },
    ]
    expect(readSessionCookie(cookies)).toBe('ABCK')
  })
})

describe('sessionExpiresAt', () => {
  it('le JSON puro', () => {
    expect(sessionExpiresAt(session(1234))).toBe(1234)
  })

  it('le o formato base64- das versoes recentes do @supabase/ssr', () => {
    const b64 = 'base64-' + Buffer.from(session(4321)).toString('base64')
    expect(sessionExpiresAt(b64)).toBe(4321)
  })

  it('le o valor url-encoded', () => {
    expect(sessionExpiresAt(encodeURIComponent(session(999)))).toBe(999)
  })

  it('devolve null em conteudo ilegivel', () => {
    expect(sessionExpiresAt('nao-e-json')).toBeNull()
    expect(sessionExpiresAt(JSON.stringify({ sem: 'expires_at' }))).toBeNull()
  })
})

describe('needsSessionRefresh', () => {
  it('nao vai a rede quando nao ha sessao', () => {
    expect(needsSessionRefresh([{ name: 'outro', value: 'x' }], NOW_MS)).toBe(false)
  })

  // O ganho principal: com o token valido por mais 50 minutos, a middleware
  // deixa de contactar o Supabase em cada navegacao.
  it('nao refresca um token ainda longe de expirar', () => {
    const cookies = [{ name: REF, value: session(NOW_S + 3000) }]
    expect(needsSessionRefresh(cookies, NOW_MS)).toBe(false)
  })

  it('refresca dentro da margem de expiracao', () => {
    const cookies = [{ name: REF, value: session(NOW_S + REFRESH_MARGIN_S - 1) }]
    expect(needsSessionRefresh(cookies, NOW_MS)).toBe(true)
  })

  it('refresca um token ja expirado', () => {
    const cookies = [{ name: REF, value: session(NOW_S - 60) }]
    expect(needsSessionRefresh(cookies, NOW_MS)).toBe(true)
  })

  it('em caso de duvida tenta refrescar (falha segura)', () => {
    const cookies = [{ name: REF, value: 'lixo-ilegivel' }]
    expect(needsSessionRefresh(cookies, NOW_MS)).toBe(true)
  })

  it('usa a margem exata do auth-js (EXPIRY_MARGIN_MS = 90s)', () => {
    expect(REFRESH_MARGIN_S).toBe(90)
  })
})
