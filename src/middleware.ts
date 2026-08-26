import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createResilientFetch, withDeadline } from '@/lib/supabase-fetch'
import { needsSessionRefresh } from '@/lib/auth-cookie'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

// Timeout de cada chamada ao Supabase e prazo total da middleware. O prazo
// total e a garantia de que devolvemos SEMPRE resposta bem antes dos 25s da
// Vercel, mesmo que o auth-js insista em repetir o pedido por baixo.
const FETCH_TIMEOUT_MS = 2_500
const TOTAL_DEADLINE_MS = 3_000

// Rotas que nunca precisam de sessao fresca.
const PUBLIC_ROUTES = ['/auth', '/termos', '/privacidade']

type CookieWrite = { name: string; value: string; options: Record<string, unknown> }

/**
 * Mantem a sessao Supabase fresca, sincronizando os cookies de auth entre o
 * request e a response. Sem isto, tokens expirados nao seriam renovados do lado
 * do servidor e os Server Components veriam logouts intermitentes.
 *
 * Esta e a UNICA camada que refresca a sessao: os Server Components correm com
 * autoRefreshToken desligado (ver src/lib/supabase-server.ts), para nao haver
 * dois refreshes concorrentes a disputar a rotacao do mesmo refresh token.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

  // Na propria pagina de login nao ha sessao util para refrescar: um cookie
  // velho so gastava o prazo da middleware a tentar renovar algo que o
  // utilizador esta prestes a substituir. Era daqui que vinham os erros
  // registados em /auth.
  if (PUBLIC_ROUTES.some((r) => request.nextUrl.pathname.startsWith(r))) return response

  // Sem sessao, ou com token ainda longe de expirar, nao ha nada a fazer —
  // e poupamos a ida a rede na esmagadora maioria das navegacoes.
  if (!needsSessionRefresh(request.cookies.getAll())) return response

  // As escritas de cookie ficam em memoria e so vao para a response se o
  // refresh correr bem. Assim uma falha de rede NUNCA consegue apagar a sessao
  // do utilizador; um erro real de auth (refresh token invalido) ja vem com
  // gateway.failed() a false e e aplicado normalmente.
  const writes: CookieWrite[] = []
  const overrides = new Map<string, string>()
  const gateway = createResilientFetch(FETCH_TIMEOUT_MS)

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    global: { fetch: gateway.fetch },
    cookies: {
      get(name: string) {
        return overrides.has(name) ? overrides.get(name) : request.cookies.get(name)?.value
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        overrides.set(name, value)
        writes.push({ name, value, options })
      },
      remove(name: string, options: Record<string, unknown>) {
        overrides.set(name, '')
        writes.push({ name, value: '', options })
      },
    },
  })

  const settled = await withDeadline(supabase.auth.getUser(), TOTAL_DEADLINE_MS)

  // Timeout, falha de rede, ou nada para escrever: segue com os cookies
  // intactos. As paginas continuam a tratar da auth e o utilizador pode
  // sempre recarregar.
  if (settled === null || gateway.failed() || writes.length === 0) return response

  for (const w of writes) request.cookies.set({ name: w.name, value: w.value })
  const refreshed = NextResponse.next({ request: { headers: request.headers } })
  for (const w of writes) refreshed.cookies.set({ name: w.name, value: w.value, ...w.options })
  return refreshed
}

export const config = {
  // Corre so em navegacoes. Exclui assets do Next e QUALQUER pedido com
  // extensao de ficheiro — cobre favicon.ico/.png, manifest.json, sw.js,
  // workbox-*.js, push-worker.js e icon-*.png de uma so vez. (Nos logs,
  // /favicon.png estava a acordar a middleware sem necessidade.)
  matcher: ['/((?!_next/static|_next/image|.*\\.[\\w]+$).*)'],
}
