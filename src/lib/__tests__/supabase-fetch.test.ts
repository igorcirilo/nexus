import { describe, it, expect, vi, afterEach } from 'vitest'
import { createResilientFetch, withDeadline } from '@/lib/supabase-fetch'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

describe('createResilientFetch', () => {
  it('converte uma falha de rede em Response 503 em vez de rejeitar', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
    ) as unknown as typeof fetch

    const f = createResilientFetch(1_000)
    const res = await f('https://exemplo.supabase.co/auth/v1/user')

    expect(res.status).toBe(503)
  })

  // O CERNE DA CORRECAO: o auth-js so repete erros com `status: 0`
  // (AuthRetryableFetchError). Um status HTTP real torna o erro nao-retentavel
  // e corta a tempestade de retentativas que estourava os 25s da Vercel.
  it('devolve um status HTTP diferente de 0 (nao-retentavel pelo auth-js)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch

    const res = await createResilientFetch(1_000)('https://exemplo.supabase.co')

    expect(res.status).not.toBe(0)
    await expect(res.json()).resolves.toMatchObject({ error: 'supabase_unreachable' })
  })

  it('falha de imediato, sem chamar a rede, depois de esgotado o orcamento', async () => {
    const spy = vi.fn()
    globalThis.fetch = spy as unknown as typeof fetch

    const f = createResilientFetch(0) // orcamento ja esgotado
    const res = await f('https://exemplo.supabase.co')

    expect(res.status).toBe(503)
    expect(spy).not.toHaveBeenCalled()
  })

  it('deixa passar uma resposta bem-sucedida', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    ) as unknown as typeof fetch

    const res = await createResilientFetch(1_000)('https://exemplo.supabase.co')

    expect(res.status).toBe(200)
  })
})

describe('withDeadline', () => {
  it('resolve null quando a promessa excede o prazo', async () => {
    const lenta = new Promise((resolve) => setTimeout(resolve, 5_000))
    await expect(withDeadline(lenta, 20)).resolves.toBeNull()
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
