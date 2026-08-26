import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createResilientFetch } from '@/lib/supabase-fetch'

// Mesmos fallbacks de build do client de browser (ver src/lib/supabase.ts).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

const FETCH_TIMEOUT_MS = 5_000

/**
 * Client Supabase para Server Components / Route Handlers.
 * Le a sessao dos cookies. Em Server Components os cookies sao so-leitura,
 * por isso set/remove sao tolerantes a erro — o refresh real ocorre no middleware.
 */
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnon, {
    auth: {
      // Aqui o refresh seria sempre inutil (nao ha onde persistir o token novo)
      // e ativamente nocivo: corria em paralelo com o da middleware, no mesmo
      // pedido e com o mesmo refresh token, disputando a rotacao no Supabase.
      // Era esse refresh condenado que produzia o AuthRetryableFetchError com
      // stack de /var/task nos logs de /hoje. A middleware ja garante que o
      // token que chega aqui esta fresco.
      autoRefreshToken: false,
    },
    global: { fetch: createResilientFetch(FETCH_TIMEOUT_MS).fetch },
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
