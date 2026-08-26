import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createResilientFetch, withDeadline } from '@/lib/supabase-fetch'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'

// Orcamento total para refrescar a sessao. Muito abaixo do limite de 25s da
// Vercel, para que a middleware devolva SEMPRE resposta em vez de ser morta.
const AUTH_BUDGET_MS = 3_000

/**
 * So ha sessao para refrescar se existir cookie de auth do Supabase
 * (`sb-<ref>-auth-token`, por vezes dividido em `.0`/`.1`). Sem ele, getUser()
 * nao teria nada que fazer: poupamos uma ida a rede em todos os pedidos de
 * visitantes nao autenticados.
 */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))
}

/**
 * Mantem a sessao Supabase fresca em cada request, sincronizando os cookies de
 * auth entre o request e a response. Sem isto, tokens expirados nao seriam
 * renovados do lado do servidor e os Server Components veriam logouts intermitentes.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  if (!hasAuthCookie(request)) return response

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    // Converte timeouts em erro nao-retentavel (ver src/lib/supabase-fetch.ts):
    // sem isto o auth-js repetia o pedido abortado ate estourar os 25s da Vercel.
    global: { fetch: createResilientFetch(AUTH_BUDGET_MS) },
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

  // Apenas refresca a sessao (nao bloqueia rotas — o redirect continua nas
  // paginas). Se falhar ou exceder o prazo, seguimos sem sessao fresca: as
  // paginas tratam da auth e o utilizador pode sempre recarregar.
  // O prazo aqui e a garantia final — nunca deixa a middleware passar dos 25s.
  await withDeadline(supabase.auth.getUser(), AUTH_BUDGET_MS + 500)

  return response
}

export const config = {
  // Corre so em navegacoes. Exclui assets do Next e QUALQUER pedido com
  // extensao de ficheiro — cobre favicon.ico/.png, manifest.json, sw.js,
  // workbox-*.js, push-worker.js e icon-*.png de uma so vez. (Nos logs,
  // /favicon.png estava a acordar a middleware sem necessidade.)
  matcher: ['/((?!_next/static|_next/image|.*\\.[\\w]+$).*)'],
}
