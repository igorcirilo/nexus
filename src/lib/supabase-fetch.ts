// src/lib/supabase-fetch.ts
// Fetch resiliente para os clients Supabase do servidor (middleware + Server
// Components).
//
// PORQUÊ: um fetch abortado chega ao @supabase/auth-js como
// AuthRetryableFetchError (`__isAuthError: true, status: 0`) — que ele
// considera RETENTÁVEL e repete com backoff exponencial. Com o Supabase lento,
// isso gerava 6-7 tentativas por pedido, todas a abortar, somando mais de 25s:
// a Vercel matava a middleware (504) e as rejeicoes orfas enchiam os logs de
// `DOMException [TimeoutError]`.
//
// COMO: em vez de rejeitar, devolvemos uma Response 503 sintetica. O auth-js
// converte respostas nao-ok em AuthApiError (status != 0), que NAO e
// retentavel — falha uma vez, de forma limpa e imediata.

function unreachable(): Response {
  return new Response(
    JSON.stringify({
      error: 'supabase_unreachable',
      error_description: 'Pedido ao Supabase abortado por timeout.',
    }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  )
}

/**
 * Cria um fetch com orcamento de tempo PARTILHADO por todas as chamadas do
 * mesmo client. Esgotado o orcamento, as chamadas seguintes falham de imediato
 * em vez de esperar — e o pedido nunca fica pendurado.
 */
export function createResilientFetch(budgetMs: number): typeof fetch {
  const deadline = Date.now() + budgetMs

  return async (input, init) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return unreachable()

    const timeout = AbortSignal.timeout(remaining)
    // Preserva um signal que o chamador ja tenha passado (ex.: cancelamento
    // do proprio auth-js), em vez de o descartar.
    const signal =
      init?.signal && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([init.signal, timeout])
        : timeout

    try {
      return await fetch(input, { ...init, signal })
    } catch {
      // Timeout ou falha de rede: nunca propagar a rejeicao.
      return unreachable()
    }
  }
}

/**
 * Resolve com `null` se `p` nao terminar dentro de `ms`. A rejeicao de `p` e
 * sempre absorvida, para nao deixar rejeicoes orfas no runtime da edge.
 */
export function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const guard = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  return Promise.race([p.catch(() => null), guard]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
