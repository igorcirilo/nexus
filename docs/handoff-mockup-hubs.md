# Handoff — Redesign "Hub fiel ao mockup" (continuar em nova sessão)

> Companheiro do [roadmap-mockup-hubs.md](./roadmap-mockup-hubs.md) (fonte da verdade).
> Este doc dá o **estado atual**, a **receita**, o **ambiente** e o **próximo passo exato**
> para retomar sem perder contexto.

## TL;DR — onde estamos
- **Branch:** `design/nexus-mockups` (derivada de `codex/ui-roadmap-local`, NÃO de `main`).
- **Nada foi commitado** nesta fase. A árvore tem MUITA coisa não-commitada herdada do codex
  (Hoje, Calendário, etc.) misturada com o nosso trabalho. Ao commitar, separar só os arquivos
  desta fase (listados abaixo) — não commitar a árvore inteira às cegas.
- **Objetivo:** cada módulo ganha uma tela **Resumo/hub** visualmente idêntica ao mockup
  (`design/mockups/0X-*.html`), com **dados reais** e **sem quebrar** as subpáginas existentes.

## Status por módulo
| # | Módulo | Mockup | Estado |
|---|--------|--------|--------|
| 1 | Hoje | 01 | ✅ Já feito (codex) — não mexer |
| 2 | Corpo | 02 | ✅ Hub implementado (aguarda ajuste fino) |
| 3 | Calendário | 03 | ✅ Mockup **refeito**; hub **ainda não implementado** |
| 4 | Hábitos | 04 | ✅ Hub (tracker diário) implementado |
| 5 | **Progresso** | 05 | 🔜 **PRÓXIMO** |
| 6 | Finanças | 06 | ✅ Hub implementado |
| 7 | Leitura | 07 | ⬜ A fazer |
| 8 | Objetivos | 08 | ⬜ A fazer |
| 9 | Perfil | 09 | ⬜ A fazer |

## Receita (seguir para cada módulo)
1. Ler `design/mockups/0X-modulo.html` e mapear cada bloco visual.
2. Ler `src/app/<modulo>/page.tsx` + componentes/libs — inventariar funções de dados e abas.
3. Criar `src/components/<modulo>/<Modulo>Hub.tsx` replicando o mockup:
   - Fonte **Inter** (`FONT = 'Inter, sans-serif'`), fundo `#07070F`, **full-bleed** (`padding: '0 22px 28px'`).
   - Cores do mockup: gold `#F5C842`, teal `#00C896`/`#00D4C8`, roxo `#9D5CF5`, água `#00B4DC`, vermelho `#FF6B6B`.
   - **Sem emoji** como ícone (usar SVG inline ou inicial em quadrado colorido).
   - Dados reais via props (preferir) ou fetch nas libs existentes. Cards fazem `onNavigate(...)`.
4. Integrar em `page.tsx` com **early-return** quando a aba/modo for o hub:
   ```tsx
   if (tab === 'resumo') {
     return (
       <main style={{ paddingBottom: 100, minHeight: '100vh', background: '#07070F' }}>
         <XHub ... onNavigate={setTab} />
         <Nav />
       </main>
     )
   }
   ```
   Subpáginas mantêm o chrome atual (h1 + tab-bar, com aba/botão para voltar ao hub).
   ⚠️ O early-return **estreita o tipo** do estado de aba — TS vai acusar blocos
   `{tab==='resumo' && ...}` que sobraram; **remova-os** (foi o que aconteceu em Finanças).
5. **Honestidade de dados:** o mockup tem números fictícios. Para cada dado que o app não
   rastreia: (a) mapear p/ um real equivalente mantendo o visual, (b) construir tracking
   aditivo, ou (c) omitir. **Nunca falsear.** Registrar a decisão no roadmap.
6. Verificar (ver comandos abaixo) e atualizar o roadmap.

## Decisões honestas já tomadas (padrão a seguir)
- **Corpo:** água = tracker funcional via `localStorage` (`nexus-corpo-water-<data>`), gota em SVG.
  Gordura/massa magra → **IMC + Meta** (reais). Metas de macro → **totais do plano**. Treino:
  tag = nome do plano + "X exercícios · Y concluídos" (sem duração/kcal fictícios).
- **Finanças:** moeda mantida em **EUR (€)** (mockup mostrava R$ — trocar é decisão à parte).
  Ícone de categoria = quadrado colorido + inicial (sem emoji). Metas reais do perfil.
- **Hábitos:** **streak por hábito NÃO existe** (só streak global) → omitido; meta mostra
  horário/área + XP. Áreas = as 7 reais do app, não as 4 do mockup. Toggle grava em
  `habit_logs` mas **não dispara** o RPC `update_streak` (evitar interferir no Hoje).

## Arquivos desta fase (para commit seletivo)
**Criados:**
- `src/components/corpo/BodyHub.tsx`
- `src/components/financas/FinancasHub.tsx`
- `src/components/habitos/HabitosHub.tsx`
- `docs/roadmap-mockup-hubs.md`, `docs/handoff-mockup-hubs.md`

**Modificados:**
- `src/app/corpo/page.tsx` (aba resumo full-bleed; BodyHeroSection movido p/ dentro do hub)
- `src/app/financas/page.tsx` (early-return resumo → FinancasHub; bloco antigo removido)
- `src/app/habitos/page.tsx` (modo tracker/gerir; fetch `getHabitsWithLogs`; `toggleToday`)
- `src/lib/body-plan.ts` (`summarizeDietDay` + helpers de dieta exportados)
- `src/app/globals.css` (import da fonte **Inter**)
- `design/mockups/03-calendario.html` (refeito)
- `docs/roadmap-mockup-hubs.md` (status)

## Ambiente
- **Dev server:** `npm run dev` → porta **3001** (rodando em background nesta sessão; pode
  já não estar de pé na próxima — subir de novo se preciso).
- **Rotas exigem auth (Supabase)** → não dá para tirar screenshot logado pelas ferramentas
  de preview. Validação visual é o Igor abrindo no browser dele. Verificação automatizada =
  typecheck + testes + rota compila (HTTP 200, sem marcadores de erro do Next).
- **Mockups estáticos:** servir `design/mockups/` (ex.: `python -m http.server 4300` nessa
  pasta) e abrir `0X-*.html` para comparar. (O `npx serve` via preview travou no update-check;
  o servidor Python foi mais confiável.)

## Comandos de verificação
```bash
npx tsc --noEmit            # deve sair 0
npx vitest run             # 40/40 atualmente
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/<rota>   # 200
```

## Próximo passo EXATO — Progresso (mockup 05)
1. Ler `design/mockups/05-progresso.html`.
2. Ler `src/app/progresso/page.tsx` (tem 2 abas: **Evolução** e **Stats** — nível/XP, radar
   "roda da vida", progresso por área, conquistas/badges, heatmap 28d, gráficos energia/sono).
   Dados já computados lá; reusar.
3. Criar `src/components/progresso/ProgressoHub.tsx` fiel ao mockup 05, recebendo dados via
   props da page. Mapear: nível/XP/ranking, barras/anéis de evolução, consistência, badges,
   áreas da vida. Conferir o que é real vs. fictício no mockup (provável: ranking/percentis —
   confirmar se existe; se não, omitir ou mapear para algo real).
4. Integrar com early-return na aba de overview; manter a aba Stats/detalhe.
5. Verificar + atualizar roadmap.

## Pendências / a confirmar com o Igor
- Ajuste fino visual de Corpo / Finanças / Hábitos.
- Finanças: manter **EUR** ou migrar para **R$** (afeta todas as abas)?
- Hábitos: o tracker deve **disparar `update_streak`** ao concluir? (hoje não dispara).
- Água (Corpo): manter `localStorage` ou migrar para Supabase (sync entre dispositivos)?
- Limpeza: duplicação dos helpers de dieta entre `DietTracker.tsx` e `body-plan.ts`.
- Implementar o **hub do Calendário** (mockup 03 já pronto).
- Revisar a **bottom nav** global (fora de escopo até agora).
