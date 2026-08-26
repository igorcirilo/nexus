import { describe, it, expect } from 'vitest'
import { supabase } from '@/lib/supabase'

// Regressao: o @supabase/ssr 0.1.0 faz `({ cookies, ...resto } = options)`.
// Passar opcoes (ex.: global.fetch) SEM a chave `cookies` deixa-a undefined e o
// adaptador de storage rebenta em `cookies.get`. Em producao isso significa que
// a sessao nunca chega a ser gravada: o login parece correr bem e nunca avanca.
//
// Este teste exercita o client REAL do app — se alguem voltar a passar opcoes
// sem `cookies: {}` em src/lib/supabase.ts, falha aqui.
describe('client de browser do app', () => {
  it('le a sessao sem rebentar no adaptador de cookies', async () => {
    await expect(supabase.auth.getSession()).resolves.toMatchObject({
      data: expect.anything(),
    })
  })
})
