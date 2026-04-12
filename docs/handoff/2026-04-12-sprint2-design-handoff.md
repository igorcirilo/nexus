# Handoff — Sprint 2 / Design (2026-04-12)

## Contexto do Projeto

Nexus v4 está sendo transformado no produto **Rise** — um sistema de reset de hábitos orientado por diagnóstico, programa de 66 dias, execução diária e academia. O workflow é: **Arquiteto (Claude) gera Ordens de Serviço → Operário (Codex) implementa → Arquiteto revisa → próxima OS**.

## Estado Atual

### Sprint 1 — COMPLETA ✅

A espinha dorsal do produto está funcionando end-to-end:

1. **Onboarding diagnóstico v2** (`/onboarding-v2`) — 17 perguntas, 8 blocos, draft em localStorage
2. **Análise inicial** (`/analise-inicial`) — score global + 7 áreas calculados localmente, barras visuais
3. **Geração de programa** — `generateProgramFromAssessment` orquestra: score → salva → cria programa → busca templates → seleciona → gera semana 1
4. **Página /hoje** refatorada — mostra tarefas do programa (ProgramTask), botões Pular/Feito, fallback para noProgram
5. **Onboarding unificado** — `/onboarding` antigo redireciona para `/onboarding-v2`

### Bugs corrigidos nesta sessão

| Bug | Causa | Fix |
|-----|-------|-----|
| `submitAssessment` falhava | Tabelas não existiam no Supabase | Migration aplicada via MCP |
| 0 tarefas geradas | `.insert(dayRows).select()` retornava `[]` por RLS subquery no SELECT-back | Separou INSERT de SELECT em `generateWeek1` (`program-engine.ts:100-107`) |
| Draft não persistia no onboarding | Usuário estava em modo anônimo (localStorage apagado ao fechar) | Comportamento esperado — testar em aba normal |

### Migration Aplicada ✅

Tabelas criadas no Supabase (projeto `jsslyritdivjtsiwdorm`):
- `task_templates` (10 seeds de dificuldade 1)
- `user_assessments` + RLS
- `life_area_scores` + RLS
- `programs` + RLS
- `program_weeks` + RLS
- `program_days` + RLS
- `program_tasks` + RLS
- `profiles` estendido com `program_id`, `initial_score`, `current_score`, `onboarding_version`

### Dados de Teste no Banco

Existe 1 programa ativo (`e96fed8e-6513-467d-8017-80802c8b268d`) com 7 dias e 3 tarefas inseridas manualmente para 2026-04-12:
- "Beber 2L de água" (corpo)
- "Planejar o dia (5min)" (produtividade)
- "Escrever 1 gratidão" (emocoes)

---

## Próximo Passo — Sprint 2 em Execução

### O que está pendente: D-1 + D-2 (Redesign Visual)

As páginas novas usam Tailwind utilities (`bg-zinc-950`, `text-violet-400`) em vez do design system do app (CSS variables + inline styles). Isso causa o visual "cru" sem estilo.

**Duas OS já escritas e aprovadas pelo Arquiteto:**

#### OS D-1: Redesign Componentes Onboarding
**Arquivos:**
- `src/components/onboarding/ProgressBar.tsx`
- `src/components/onboarding/ScaleQuestion.tsx`
- `src/components/onboarding/SingleQuestion.tsx`
- `src/components/onboarding/MultipleQuestion.tsx`
- `src/components/onboarding/RankingQuestion.tsx`
- `src/app/onboarding-v2/page.tsx`

**Resumo do redesign:**
- Substituir todas as classes Tailwind de cor/layout por inline styles com CSS variables
- ProgressBar: fill em `var(--accent)`, barra h=3px bg3
- ScaleQuestion: botões 52x52px, bg2, selecionado = accent border + bg rgba(127,119,221,.12)
- Single/Multiple: cards bg2 com border, selecionado = accent
- Ranking: badge gold (`var(--gold)`) para posição, selecionado = gold border
- Page container: flex column, header com progresso, content centralizado, footer com `.btn-ghost` (Voltar) + `.btn-primary` (Próxima/ouro)

#### OS D-2: Redesign Página Analise-Inicial
**Arquivo:** `src/app/analise-inicial/page.tsx`

**Resumo do redesign:**
- Score global: 64px, Syne 800, `var(--gold)`
- Cards de área: `.card` class, barra fill em `var(--teal)`
- CTA: `.btn-primary`
- Chip "Diagnóstico inicial": `.chip.chip-accent`

---

## Design System — Referência Rápida

```css
/* CSS Variables (globals.css) */
--bg0: #0D0F14   /* fundo de página */
--bg1: #141720   /* sidebar */
--bg2: #1C2030   /* cards */
--bg3: #252A3A   /* elementos internos, barras vazias */
--text1: #F0EDE8  /* texto primário */
--text2: #9BA0B0  /* texto secundário */
--text3: #5A6070  /* labels, meta */
--gold:   #E8A838  /* destaque, XP, CTAs primários */
--teal:   #1ECBB4  /* sucesso, progresso */
--accent: #7F77DD  /* ações secundárias, seleção */
--border: rgba(255,255,255,0.07)

/* Classes globais */
.card        → bg2 + border + borderRadius 16px
.btn-primary → fundo gold, Syne 700, borderRadius 16px
.btn-ghost   → fundo accent/8%, borda accent, Syne 600
.chip-accent → badge pequeno accent
.chip-gold   → badge pequeno gold
```

**Fontes:** Syne (headings, botões, labels em caps) | DM Sans (body, opções)

**Padrão de código:** inline styles com CSS variables — NÃO usar Tailwind para cor/layout/espaçamento.

---

## Arquitetura dos Arquivos Novos (Sprint 1)

```
src/
├── types/index.ts                    ← +12 tipos Sprint 1 (AreaScores, Program, ProgramTask, etc.)
├── lib/
│   ├── onboarding-engine.ts          ← saveDraft/loadDraft/submitAssessment + ONBOARDING_QUESTIONS (17)
│   ├── profile-assessment.ts         ← calculateScores (puro) + saveScores (lazy Supabase)
│   ├── program-engine.ts             ← shouldTaskBeOnDay + selectTemplatesForWeek1 + createProgram + generateWeek1
│   ├── assessment-to-program.ts      ← orquestrador 8 passos
│   ├── program.ts                    ← getProgramDayByDate + getProgramTasks + updateTaskStatus + createManualTask
│   └── __tests__/
│       ├── onboarding-engine.test.ts  (7 testes)
│       ├── profile-assessment.test.ts (4 testes)
│       └── program-engine.test.ts     (8 testes)
├── components/onboarding/
│   ├── ProgressBar.tsx
│   ├── ScaleQuestion.tsx
│   ├── SingleQuestion.tsx
│   ├── MultipleQuestion.tsx
│   ├── RankingQuestion.tsx
│   └── QuestionRenderer.tsx
├── app/
│   ├── onboarding/page.tsx           ← redirect para /onboarding-v2
│   ├── onboarding-v2/page.tsx        ← fluxo completo 17 perguntas
│   ├── analise-inicial/page.tsx      ← scores + CTA gerar plano
│   └── hoje/page.tsx                 ← refatorado para mostrar ProgramTasks
supabase/
└── sprint1_program_v1.sql            ← migration já aplicada
```

## Padrão Lazy Import (Supabase)

Todos os arquivos `lib/*.ts` que usam Supabase fazem import lazy para não quebrar testes unitários:

```ts
// ✅ Correto — dentro de função async
export async function minhaFuncao() {
  const { supabase } = await import('@/lib/supabase')
  // ...
}

// ❌ Errado — import top-level quebra Vitest
import { supabase } from '@/lib/supabase'
```

## Testes

```bash
npm test        # 4 suites, 20 testes, todos passando
npm run build   # 21 páginas estáticas, sem erros
```

## Roadmap Após D-1 + D-2

Fase 2 do roadmap Rise:
1. Gerar 66 dias completos (hoje só gera semana 1)
2. Visualização semanal/calendário do programa
3. XP real ao completar task do programa
4. Score snapshots + comparativo "antes vs agora"

## Instrução para o Arquiteto

Ao receber o reporte do Operário sobre D-1 e D-2:
1. Verificar se `tsc --noEmit` passou
2. Verificar visual em `/onboarding-v2` e `/analise-inicial`
3. Se aprovado, escrever OS para Sprint 2 / Fase 2 (geração de 66 dias)
