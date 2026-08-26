// src/lib/supabase-fetch.ts
// Fetch resiliente para os clients Supabase do servidor (middleware + Server
// Components).
//
// PROBLEMA: um fetch abortado chega ao @supabase/auth-js como
// AuthRetryableFetchError (status 0), que ele repete com backoff exponencial —
// 6-7 tentativas por pedido, somando mais de 25s. A Vercel matava a middleware
// e devolvia 504, e as rejeicoes orfas enchiam os logs de DOMException.
//
// SOLUCAO: em vez de rejeitar, devolvemos uma Response sintetica. Assim o
// auth-js recebe uma resposta HTTP normal e o pedido nunca fica pendurado.

/**
 * 503 e DELIBERADO — nao trocar por 500/400 sem ler isto.
 *
 * O auth-js trata [502, 503, 504] como falha de rede retentavel
 * (lib/fetch.js: NETWORK_ERROR_CODES). Qualquer outro status vira AuthApiError,
 * que ele considera NAO-retentavel — e em GoTrueClient._callRefreshToken um
 * erro nao-retentavel dispara `_removeSession()`, ou seja, DESLOGA o utilizador.
 *
 * Como aqui a falha e sempre transitoria (timeout/rede), tem de ficar na classe
 * retentavel: um Supabase lento nunca pode expulsar ninguem da conta. A duracao
 * do pedido e limitada por withDeadline, nao pela classificacao do erro.
 */
const UNREACHABLE_STATUS = 503

function unreachable(): Response {
  return new Response(
    JSON.stringify({
      error: 'supabase_unreachable',
      error_description: 'Pedido ao Supabase abortado por timeout.',
    }),
    { status: UNREACHABLE_STATUS, headers: { 'content-type': 'application/json' } },
  )
}

export type ResilientFetch = {
  fetch: typeof fetch
  /** true se alguma chamada falhou por timeout/rede (e nao por resposta do Supabase). */
  failed: () => boolean
}

/**
 * Fetch com timeout POR CHAMADA. Cada pedido tem o seu orcamento proprio — um
 * orcamento partilhado faria as ultimas leituras de uma pagina comecarem ja sem
 * tempo e falharem sem sequer tentar.
 */
export function createResilientFetch(perCallMs: number): ResilientFetch {
  let failed = false

  const resilient: typeof fetch = async (input, init) => {
    const timeout = AbortSignal.timeout(perCallMs)
    // Preserva um signal que o chamador ja tenha passado, em vez de o descartar.
    const signal =
      init?.signal && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([init.signal, timeout])
        : timeout

    try {
      return await fetch(input, { ...init, signal })
    } catch {
      failed = true
      return unreachable()
    }
  }

  return { fetch: resilient, failed: () => failed }
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
