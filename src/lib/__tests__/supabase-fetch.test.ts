import { describe, it, expect, vi, afterEach } from 'vitest'
import { createResilientFetch, withDeadline } from '@/lib/supabase-fetch'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

function mockFetch(impl: unknown) {
  globalThis.fetch = impl as typeof fetch
}

describe('createResilientFetch', () => {
  it('converte uma falha de rede em Response em vez de rejeitar', async () => {
    mockFetch(vi.fn().mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    ))

    const res = await createResilientFetch(1_000).fetch('https://exemplo.supabase.co')

    expect(res.ok).toBe(false)
    await expect(res.json()).resolves.toMatchObject({ error: 'supabase_unreachable' })
  })

  // INVARIANTE DE SEGURANCA — nao relaxar sem ler o comentario em supabase-fetch.ts.
  // O auth-js so considera [502, 503, 504] retentaveis; qualquer outro status vira
  // AuthApiError nao-retentavel, e GoTrueClient._callRefreshToken responde a isso
  // com _removeSession() — ou seja, deslogaria o utilizador a cada timeout.
  it('falha com um status que o auth-js considera retentavel (nunca desloga)', async () => {
    mockFetch(vi.fn().mockRejectedValue(new Error('network down')))

    const res = await createResilientFetch(1_000).fetch('https://exemplo.supabase.co')

    expect([502, 503, 504]).toContain(res.status)
  })

  it('marca failed() apenas quando a falha e de rede', async () => {
    mockFetch(vi.fn().mockResolvedValue(new Response('{}', { status: 400 })))
    const ok = createResilientFetch(1_000)
    await ok.fetch('https://exemplo.supabase.co')
    // 400 e resposta legitima do Supabase, nao falha de transporte.
    expect(ok.failed()).toBe(false)

    mockFetch(vi.fn().mockRejectedValue(new Error('boom')))
    const bad = createResilientFetch(1_000)
    await bad.fetch('https://exemplo.supabase.co')
    expect(bad.failed()).toBe(true)
  })

  it('da a cada chamada o seu proprio orcamento de tempo', async () => {
    // Um orcamento partilhado faria a 2a chamada nascer sem tempo; aqui as duas
    // recebem o mesmo prazo e ambas passam.
    mockFetch(vi.fn().mockResolvedValue(new Response('{}', { status: 200 })))
    const f = createResilientFetch(50).fetch

    await new Promise((r) => setTimeout(r, 80))
    const res = await f('https://exemplo.supabase.co')

    expect(res.status).toBe(200)
  })

  it('deixa passar uma resposta bem-sucedida', async () => {
    mockFetch(vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 })))
    const res = await createResilientFetch(1_000).fetch('https://exemplo.supabase.co')
    expect(res.status).toBe(200)
  })
})

describe('withDeadline', () => {
  it('resolve null quando a promessa excede o prazo', async () => {
    await expect(withDeadline(new Promise((r) => setTimeout(r, 5_000)), 20)).resolves.toBeNull()
  })

  it('devolve o valor quando a promessa termina a tempo', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 1_000)).resolves.toBe('ok')
  })

  // Sem isto, as tentativas abandonadas apareciam nos logs da Vercel como
  // `DOMException [TimeoutError]` soltas (rejeicoes orfas).
  it('absorve a rejeicao em vez de a deixar orfa', async () => {
    const orfa = vi.fn()
    process.on('unhandledRejection', orfa)

    await expect(withDeadline(Promise.reject(new Error('boom')), 50)).resolves.toBeNull()
    await new Promise((r) => setTimeout(r, 30))

    process.off('unhandledRejection', orfa)
    expect(orfa).not.toHaveBeenCalled()
  })
})
