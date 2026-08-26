// src/lib/auth-cookie.ts
// Le a sessao do Supabase a partir dos cookies, SEM ida a rede.
//
// O @supabase/ssr guarda a sessao em `sb-<ref>-auth-token`, dividida em
// `.0`, `.1`, ... quando excede o tamanho maximo de um cookie. O corpo e o JSON
// da sessao, que inclui `expires_at` (epoch em segundos).
//
// PORQUE EXISTE: sem isto a middleware ia a rede em TODAS as navegacoes, mesmo
// com o token valido por mais 50 minutos. Alem do custo, esses refreshes
// concorrentes (middleware + Server Component no mesmo pedido) disputavam a
// rotacao do refresh token no Supabase — a origem dos timeouts.

/**
 * Igual ao EXPIRY_MARGIN_MS do auth-js (AUTO_REFRESH_TICK_THRESHOLD 3 x
 * AUTO_REFRESH_TICK_DURATION_MS 30s = 90s). Manter alinhado garante que nunca
 * saltamos um refresh que o auth-js faria a seguir.
 */
export const REFRESH_MARGIN_S = 90

const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

export type CookieLike = { name: string; value: string }

function chunkIndex(name: string): number {
  const m = name.match(/\.(\d+)$/)
  return m ? Number(m[1]) : -1
}

/** Junta os chunks (por ordem numerica) e devolve o valor cru do cookie. */
export function readSessionCookie(cookies: CookieLike[]): string | null {
  const parts = cookies.filter((c) => AUTH_COOKIE.test(c.name))
  if (parts.length === 0) return null

  const raw =
    parts.length === 1
      ? parts[0].value
      : parts
          .slice()
          .sort((a, b) => chunkIndex(a.name) - chunkIndex(b.name))
          .map((c) => c.value)
          .join('')

  return raw || null
}

function decode(raw: string): string {
  // `base64-` e usado por versoes mais recentes do @supabase/ssr; aceitamos os
  // dois formatos para a leitura nao partir num upgrade da dependencia.
  if (raw.startsWith('base64-')) return atob(raw.slice('base64-'.length))
  if (raw.trimStart().startsWith('{')) return raw
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** `expires_at` da sessao (epoch em segundos), ou null se ilegivel. */
export function sessionExpiresAt(raw: string): number | null {
  try {
    const parsed = JSON.parse(decode(raw)) as { expires_at?: unknown }
    const exp = parsed?.expires_at
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

/**
 * Vale a pena gastar um pedido de rede a refrescar a sessao?
 * - Sem cookie de sessao -> nao ha nada que refrescar.
 * - Cookie ilegivel -> tenta (falha segura: no pior caso e o comportamento antigo).
 * - Caso normal -> so dentro da margem de expiracao.
 */
export function needsSessionRefresh(cookies: CookieLike[], nowMs: number = Date.now()): boolean {
  const raw = readSessionCookie(cookies)
  if (!raw) return false

  const exp = sessionExpiresAt(raw)
  if (exp === null) return true

  return exp - nowMs / 1000 <= REFRESH_MARGIN_S
}
