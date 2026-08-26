import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Mesmos fallbacks de build do client de browser (ver src/lib/supabase.ts).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

/**
 * Client Supabase para Server Components / Route Handlers.
 * Lê a sessão dos cookies. Em Server Components os cookies são só-leitura,
 * por isso set/remove são tolerantes a erro — o refresh real ocorre no middleware.
 */
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(supabaseUrl, supabaseAnon, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(5_000) }),
    },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          /* Server Component: cookie store é só-leitura — ignorado de propósito */
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
