import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

/**
 * Mantém a sessão Supabase fresca em cada request, sincronizando os cookies de
 * auth entre o request e a response. Sem isto, tokens expirados não seriam
 * renovados do lado do servidor e os Server Components veriam logouts intermitentes.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    global: {
      // Aborta chamadas ao Supabase que fiquem penduradas. Sem isto, um Supabase
      // lento/em baixo segura o request até ao limite da middleware (504 ou timeout
      // de 25s do Vercel). Usa 2 segundos (curto o bastante para reagir rápido).
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(2_000) }),
    },
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value, ...options })
      },
      remove(name: string, options: Record<string, unknown>) {
        request.cookies.set({ name, value: '' })
        response = NextResponse.next({ request: { headers: request.headers } })
        response.cookies.set({ name, value: '', ...options })
      },
    },
  })

  // Apenas refresca a sessão (não bloqueia rotas — o redirect continua nas páginas).
  // Se o refresh falhar ou exceder o timeout, seguimos sem sessão fresca:
  // as páginas continuam a tratar da auth e o utilizador pode sempre recarregar.
  try {
    await supabase.auth.getUser()
  } catch {
    // Supabase indisponível/lento — não bloquear o request. Erros de timeout ou
    // rede são esperados e silenciosos (cliente/páginas ficam responsáveis pela auth).
  }

  return response
}

export const config = {
  // Corre em todas as rotas exceto assets estáticos e ficheiros do PWA.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|worker-.*|push-worker.js|icon-.*).*)'],
}
