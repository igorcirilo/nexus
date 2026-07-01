# Handoff — Redesign do login (Orbit) + mobile "Hero Glow" + login social

> Documento de passagem para continuar noutra sessão. A sessão anterior ficou
> presa a **verificar** o resultado num servidor `next start` zombie (servia
> chunks `.next` antigos), não por qualquer bug de código. **O código está
> correto, commitado e pushed.**

## Branch e PR
- **Branch:** `claude/new-session-x93fnu` (tudo pushed).
- **PR:** #21 — https://github.com/igorcirilo/nexus/pull/21 (base `main`).
- Últimos commits relevantes:
  - `fix(ssr)` — ToastProvider deixou de ser `ssr:false` (a app voltou a renderizar no servidor).
  - `feat(auth)` Orbit — split-screen desktop com showcase do produto.
  - `feat(auth)` Hero Glow + Google/Apple — **HEAD atual**.

## Estado atual (verificado)
`src/app/auth/page.tsx` reescrito:
- **Mobile:** "Hero Glow" — glow dourado/roxo, logo, título, subtítulo, pills
  (🎯 Hábitos · 🧠 Foco · ⏰ Rotina · 📊 Insights) sobre um card de formulário.
- **Desktop (≥820px):** split-screen Orbit — form à esquerda, showcase do ecrã
  "Hoje" (métricas, hábitos, pills flutuantes, bolha do assistente) à direita.
- **Login social Google/Apple:** implementado via `supabase.auth.signInWithOAuth`,
  desativado atrás da flag `SOCIAL_LOGIN_ENABLED = false` no topo do ficheiro.
  Enquanto `false`, clicar mostra "chega em breve" (sem redirect partido).
- **Preservado:** email+password, alternância entrar/criar conta, campo Nome +
  checkbox de consentimento (Termos/Privacidade/dados de saúde) no registo,
  recuperação de password, redirect `/hoje`. Usa CSS vars → tema claro/escuro.

Checks que passam: `npm run typecheck`, `npm run build`, `npm test` (123/123).
SSR de `/auth` inclui hero+form+showcase. Clique em Google mostra a mensagem e
NÃO redireciona (confirmado com Playwright).

## ⚠️ Regra de ouro para verificar (evita o loop da sessão anterior)
**NUNCA** deixes dois `next start` na mesma porta. O sintoma do zombie: o browser
mostra HTML/JS antigo apesar do rebuild. Diagnóstico rápido — comparar o chunk
servido com o do disco; se diferirem, há servidor velho a servir:
```bash
# mata TUDO o que for next antes de arrancar
ps aux | grep -E "next-server|next start" | grep -v grep | awk '{print $2}' | xargs -r kill -9

# rebuild limpo
rm -rf .next && npm run build

# arranca UM servidor numa porta livre
NODE_ENV=production node_modules/.bin/next start -p 3120 &
# espera ficar pronto: curl -sf http://127.0.0.1:3120/auth

# CONFIRMA que o chunk servido == disco (têm de ser iguais):
curl -s http://127.0.0.1:3120/auth | grep -o "app/auth/page-[a-z0-9]*.js" | sort -u
ls .next/static/chunks/app/auth/
```
Preferir inspecionar o prerender estático em `.next/server/app/auth.html` (não
precisa de servidor). Screenshots: Chromium em `/opt/pw-browsers/chromium-1194/
chrome-linux/chrome` via `playwright-core` (já instalado; correr o script a
partir da raiz do projeto, não de /tmp, senão a resolução ESM falha).

## Próximos passos possíveis (nada é bloqueante)
1. **Ativar login social a sério:** no painel Supabase → Authentication →
   Providers, ativar Google e/ou Apple e configurar as credenciais/redirect
   (`<origin>/hoje`). Depois pôr `SOCIAL_LOGIN_ENABLED = true` em
   `src/app/auth/page.tsx`. Considerar: o registo por OAuth **não passa** pelo
   checkbox de consentimento — decidir como capturar o aceite de Termos/saúde
   para contas criadas via social (ex.: ecrã de consentimento pós-primeiro login).
2. (Opcional) Guardar os mockups mobile em `design/login-mobile/` para referência.
3. Rever/mergear o PR #21.

## Contexto útil
- Design tokens: `src/app/globals.css` (`--gold #E8A838`, `--teal #1ECBB4`,
  `--accent #7F77DD`, etc.). Breakpoint da app: 768px; o login usa 820px.
- Mockups de origem dos conceitos: branch `origin/claude/login-redesign-5-concepts-vka4ot`
  (apenas HTML/PNG em `design/`, sem código).
- Este ficheiro (`HANDOFF.md`) é temporário — apagar quando o PR #21 fechar.
