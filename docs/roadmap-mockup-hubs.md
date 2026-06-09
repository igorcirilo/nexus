# Roadmap — Redesign "Hub fiel ao mockup" por módulo

> **Fonte da verdade desta fase.** Objetivo: cada módulo ganha uma tela **Resumo (hub)**
> visualmente **idêntica ao mockup** correspondente (`design/mockups/*.html`), populada com
> **dados reais**, servindo de porta de entrada para as **subpáginas/abas existentes** — que
> permanecem 100% funcionais. Não confundir com `roadmap-ui-hoje-corpo-calendario.md` (refactor
> anterior, já incorporado pela branch codex).

## Contexto / decisão de arquitetura
- **Padrão "Hub + Detalhe"**: o mockup é a tela inicial do módulo (aba "Resumo", default).
  Os cards do hub fazem deep-link para as abas existentes (Treino/Dieta/Peso, etc.).
  Nenhuma funcionalidade é removida — só reorganizada.
- **Fidelidade visual = prioridade**: na aba Resumo usamos a linguagem exata do mockup
  (fonte **Inter**, fundo `#07070F`, acentos `#F5C842` gold / `#00C896`–`#00D4C8` teal /
  `#9D5CF5` roxo / `#00B4DC` água), **full-bleed** (sem h1 nem tab-bar do app na Resumo).
  As **subpáginas** continuam no estilo atual do app (tokens `--gold/--teal/--accent`, Syne).
- **Bottom nav**: fora de escopo por enquanto ("exceto a navbar").
- **Honestidade de dados**: nunca exibir métrica falsa. Quando o mockup mostra um dado que o
  app não rastreia, ou (a) mapeamos para um dado real equivalente mantendo o visual, ou
  (b) construímos o tracking de forma aditiva (ex.: água), ou (c) omitimos.

## Status por módulo

| # | Módulo | Mockup | Status | Observações |
|---|--------|--------|--------|-------------|
| 1 | Hoje | 01 | ✅ Feito (branch codex) | Já incorporado; `src/components/hoje/*`. Não mexer agora. |
| 2 | Corpo | 02 | ✅ Hub fiel implementado | Aguarda ajuste fino visual do Igor. |
| 3 | Calendário | 03 | ✅ Mockup refeito | Implementação do hub pendente. |
| 4 | Hábitos | 04 | ✅ Hub (tracker diário) implementado | Modo tracker (check diário via habit_logs) + modo Gerir (CRUD atual). Streak por hábito omitido (não existe no modelo). |
| 5 | Progresso | 05 | ✅ Hub implementado | Ranking substituído por streak_current (ranking multi-user não disponível na page). Áreas: quadrado colorido + inicial (sem emoji). Badges: 4 earned mais recentes + locked a completar 5 slots. |
| 6 | **Finanças** | 06 | ✅ Hub fiel implementado | Aguarda ajuste fino/visual do Igor. EUR mantido (mockup mostrava R$). |
| 7 | Leitura | 07 | ✅ Hub implementado | ETA omitida (sem tracking de sessões). Meta semanal (minutos) → stats reais (total/em leitura/concluídos). Destaques reais via getBookHighlights. Fila = livros com progress_pct=0. |
| 8 | Objetivos | 08 | ✅ Hub implementado | Sub-labels monetários (R$ 2.100/mês → meta) omitidos (Goal90 só tem progress 0-100). Substituídos por "X de Y marcos". Focus banner = primeiro objetivo ativo. Próximas ações = primeiro milestone não-feito por objetivo. |
| 9 | Perfil | 09 | ✅ Hub implementado | Ranking substituído por badges count. Jornada (treinos/páginas) → metas 90d do perfil (personal/career/health). Preferências → 4 links de navegação para seções de edição. Logout mantido no hub. |

## Receita de implementação (por módulo)
1. Ler o mockup `design/mockups/0X-modulo.html` e mapear cada bloco visual.
2. Inventariar a página real (`src/app/<modulo>/page.tsx`) e suas abas/funcionalidades.
3. Criar `src/components/<modulo>/<Modulo>Hub.tsx` replicando o mockup (Inter, cores, espaçamentos),
   com dados reais via as funções existentes em `src/lib/*`. Cards → `onNavigate(aba)`.
4. Em `page.tsx`: aba `resumo` default e **full-bleed** (sem h1/tab-bar, fundo `#07070F`);
   subpáginas mantêm o chrome atual (h1 + tab-bar com aba "Resumo" para voltar).
5. Para dados inexistentes: mapear p/ real, construir aditivo, ou omitir (nunca falsear).
6. Verificar: `npx tsc --noEmit` + `npx vitest run` + rota compila + revisão visual.

## Log de decisões (Corpo — referência p/ os próximos)
- **Água**: app só tinha `water_goal_ml` (meta). Construído tracker **funcional via localStorage**
  por dia (`nexus-corpo-water-<data>`), copos tocáveis. Gota em **SVG** (não emoji).
- **Gordura corp./Massa magra** (não rastreados) → substituídos por **IMC** (peso÷altura²)
  e **Meta** (`goal_weight`) — mesmo visual, dado real.
- **Metas de macro** (não existem no perfil) → usar **totais do plano importado** como alvo
  (`summarizeDietDay` retorna `kcalPlan`/`macrosPlan`).
- **Tipo/duração/kcal do treino** (não rastreados) → tag com nome do plano + "X exercícios ·
  Y concluídos" + ✓ por exercício (tudo real).
- **Duplicação consciente**: helpers de parsing de dieta existem em `DietTracker` e também em
  `body-plan.ts` (para o hub). Follow-up de limpeza: unificar numa fonte só (evitado refatorar
  o `DietTracker` por causa de caracteres unicode delicados).

## Arquivos-chave já criados/alterados nesta fase
- `src/components/corpo/BodyHub.tsx` (novo)
- `src/app/corpo/page.tsx` (aba resumo full-bleed)
- `src/lib/body-plan.ts` (`summarizeDietDay` + helpers de dieta)
- `src/app/globals.css` (import da fonte Inter)
- `design/mockups/03-calendario.html` (mockup refeito)

## Próximos passos
1. **Finanças (06)** — implementar `FinancasHub` fiel ao mockup sobre as 4 abas atuais
   (Resumo/Movimentos/Orçamento/Metas). Manter import CSV/PDF, categorias, projeções.
2. Seguir ordem sugerida: Finanças → Hábitos → Progresso → Leitura → Objetivos → Perfil.
3. Implementar o hub do Calendário (mockup 03 já pronto).
4. (Depois) revisar a bottom nav globalmente.

## Pendências / a confirmar com o Igor
- Ajuste fino visual do Corpo/Resumo.
- Unificar duplicação dos helpers de dieta (limpeza).
- Tracking de água: manter localStorage ou migrar para Supabase (sync entre dispositivos)?
