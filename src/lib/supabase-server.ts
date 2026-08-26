import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createResilientFetch } from '@/lib/supabase-fetch'

// Mesmos fallbacks de build do client de browser (ver src/lib/supabase.ts).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

// Orcamento para o render inteiro de um Server Component (auth + leituras).
// Mais folgado que a middleware, que so precisa de refrescar a sessao.
const SERVER_BUDGET_MS = 8_000

/**
 * Client Supabase para Server Components / Route Handlers.
 * Le a sessao dos cookies. Em Server Components os cookies sao so-leitura,
 * por isso set/remove sao tolerantes a erro — o refresh real ocorre no middleware.
 */
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnon, {
    // As paginas tambem chamam auth.getUser(): sem este wrapper, um timeout
    // desencadeava aqui a mesma tempestade de retentativas do auth-js que
    // derrubava a middleware. Ver src/lib/supabase-fetch.ts.
    global: { fetch: createResilientFetch(SERVER_BUDGET_MS) },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          /* Server Component: cookie store e so-leitura — ignorado de proposito */
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          /* idem */
        }
      },
    },
  })
}
