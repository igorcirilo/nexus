# 63-Day Program Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-week program generation with a full 63-day (9 weeks) program, with difficulty progression across three phases (Fundação → Desenvolvimento → Maestria).

**Architecture:** Two new pure functions handle difficulty mapping and template selection per week; `generate63Days` orchestrates 9 weekly Supabase inserts batch-by-batch; `assessment-to-program` calls the new function passing `scores` and `priorityArea`; SQL migration seeds 10 difficulty-2 and 10 difficulty-3 templates.

**Tech Stack:** TypeScript, Next.js 14 App Router, Supabase (PostgreSQL + RLS), Vitest, date-fns

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/sprint2_63days.sql` | Create | Seeds: 10 diff-2 + 10 diff-3 task templates |
| `src/lib/program-engine.ts` | Modify | Add `difficultyForWeek`, `selectTemplatesForProgram`, `generate63Days`; fix `createProgram` ends_at; remove `generateWeek1` |
| `src/lib/assessment-to-program.ts` | Modify | Import `generate63Days`; remove pre-selection logic; pass `scores` + `priorityArea` |
| `src/app/analise-inicial/page.tsx` | Modify | Copy: "60/66 dias" → "63 dias" |
| `src/lib/__tests__/program-engine.test.ts` | Modify | Add tests for `difficultyForWeek` and `selectTemplatesForProgram` |

---

## Task 1: SQL migration — seeds dificuldade 2 e 3

**Files:**
- Create: `supabase/sprint2_63days.sql`

- [ ] **Step 1: Criar arquivo de migration**

Crie `supabase/sprint2_63days.sql` com o conteúdo:

```sql
-- Sprint 2: Task templates de dificuldade 2 (Desenvolvimento) e 3 (Maestria)

INSERT INTO task_templates (area, title, description, difficulty, frequency_per_week, xp_reward, tags, active)
VALUES
  -- Dificuldade 2
  ('corpo',           'Treinar 30min',                      'Faça 30 minutos de exercício moderado.',                  2, 3, 25, ARRAY['exercicio','corpo'],       true),
  ('corpo',           'Dormir antes das 23h',               'Respeite seu horário de dormir.',                         2, 7, 20, ARRAY['sono','recuperacao'],       true),
  ('corpo',           'Caminhar 20min ao ar livre',         'Uma caminhada rápida para ativar o corpo.',               2, 5, 20, ARRAY['caminhada','saude'],        true),
  ('produtividade',   'Bloco de foco de 60min',             'Trabalhe 60min sem notificações.',                        2, 5, 25, ARRAY['foco','deep-work'],         true),
  ('produtividade',   'Revisar e fechar tarefas pendentes', 'Reserve 20min para limpar pendências do dia.',            2, 5, 20, ARRAY['revisao','organizacao'],    true),
  ('idiomas',         'Praticar idioma 20min',              'Use Duolingo, Anki ou vídeo no idioma-alvo.',             2, 5, 25, ARRAY['idioma','pratica'],         true),
  ('carreira',        'Ler artigo da área',                 'Leia 1 artigo relevante para sua carreira.',              2, 3, 20, ARRAY['leitura','carreira'],       true),
  ('financas',        'Registrar gastos do dia',            'Anote todos os gastos do dia.',                           2, 7, 20, ARRAY['financas','habito'],        true),
  ('emocoes',         'Meditação 10min',                    'Meditação guiada ou respiração consciente.',              2, 5, 25, ARRAY['meditacao','bem-estar'],    true),
  ('relacionamentos', 'Mensagem para alguém próximo',       'Envie uma mensagem genuína para alguém.',                 2, 3, 20, ARRAY['conexao','relacionamento'], true),

  -- Dificuldade 3
  ('corpo',           'Treinar 45min com intensidade',          'Treino de alta intensidade ou musculação.',               3, 4, 40, ARRAY['treino','intensidade'],     true),
  ('corpo',           'Protocolo de recuperação',               'Alongamento + hidratação + 10min de descanso ativo.',     3, 3, 30, ARRAY['recuperacao','corpo'],      true),
  ('corpo',           'Treino em jejum ou protocolo nutricional','Exercite-se em jejum ou siga protocolo nutricional.',    3, 3, 35, ARRAY['nutricao','treino'],        true),
  ('produtividade',   'Deep work: 2h sem interrupção',          'Dois blocos de 60min em tarefa de alta prioridade.',      3, 5, 40, ARRAY['deep-work','foco'],        true),
  ('produtividade',   'Revisão semanal (30min)',                'Avalie a semana e planeje a próxima.',                    3, 1, 40, ARRAY['revisao','planejamento'],   true),
  ('idiomas',         'Conteúdo 30min no idioma-alvo',          'Assista ou ouça algo no idioma-alvo por 30min.',          3, 5, 35, ARRAY['idioma','imersao'],         true),
  ('carreira',        'Projeto pessoal 45min',                  'Trabalhe 45min no seu projeto ou portfólio.',             3, 3, 40, ARRAY['projeto','carreira'],       true),
  ('financas',        'Revisar orçamento e projeção mensal',    'Analise gastos e ajuste projeção do mês.',                3, 1, 40, ARRAY['financas','planejamento'],  true),
  ('emocoes',         'Journaling reflexivo 15min',             'Escreva sobre o dia: aprendizados e intenções.',          3, 5, 30, ARRAY['journaling','reflexao'],    true),
  ('relacionamentos', 'Ligação ou encontro de qualidade',       'Ligue ou encontre alguém importante para você.',          3, 1, 40, ARRAY['relacionamento','conexao'], true);
```

- [ ] **Step 2: Aplicar migration via MCP**

Use a ferramenta `mcp__5002f499-cb0b-4806-b22d-44711e740b14__apply_migration` com:
- `name`: `sprint2_63days`
- `query`: (conteúdo do SQL acima)

- [ ] **Step 3: Verificar seeds**

Use `mcp__5002f499-cb0b-4806-b22d-44711e740b14__execute_sql`:

```sql
SELECT difficulty, COUNT(*) as total FROM task_templates GROUP BY difficulty ORDER BY difficulty;
```

Esperado: `difficulty 1 → 10`, `difficulty 2 → 10`, `difficulty 3 → 10`

- [ ] **Step 4: Commit**

```bash
git add supabase/sprint2_63days.sql
git commit -m "feat: add difficulty 2 and 3 task template seeds"
```

---

## Task 2: TDD — `difficultyForWeek`

**Files:**
- Modify: `src/lib/__tests__/program-engine.test.ts`
- Modify: `src/lib/program-engine.ts`

- [ ] **Step 1: Escrever teste com falha**

Em `src/lib/__tests__/program-engine.test.ts`, atualize o import do topo:

```ts
import { describe, it, expect } from 'vitest'
import { selectTemplatesForWeek1, shouldTaskBeOnDay, difficultyForWeek } from '@/lib/program-engine'
import type { TaskTemplate, AreaScores, HabitArea } from '@/types'
```

Adicione ao final do arquivo:

```ts
describe('difficultyForWeek', () => {
  it('returns 1 for weeks 1–3', () => {
    expect(difficultyForWeek(1)).toBe(1)
    expect(difficultyForWeek(2)).toBe(1)
    expect(difficultyForWeek(3)).toBe(1)
  })

  it('returns 2 for weeks 4–6', () => {
    expect(difficultyForWeek(4)).toBe(2)
    expect(difficultyForWeek(5)).toBe(2)
    expect(difficultyForWeek(6)).toBe(2)
  })

  it('returns 3 for weeks 7–9', () => {
    expect(difficultyForWeek(7)).toBe(3)
    expect(difficultyForWeek(8)).toBe(3)
    expect(difficultyForWeek(9)).toBe(3)
  })
})
```

- [ ] **Step 2: Verificar falha**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Esperado: FAIL com `difficultyForWeek is not a function`

- [ ] **Step 3: Implementar**

Em `src/lib/program-engine.ts`, adicione após a constante `AREAS` (linha ~8):

```ts
export function difficultyForWeek(weekNumber: number): 1 | 2 | 3 {
  if (weekNumber <= 3) return 1
  if (weekNumber <= 6) return 2
  return 3
}
```

- [ ] **Step 4: Verificar aprovação**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Esperado: PASS — suite `difficultyForWeek` (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/program-engine.ts src/lib/__tests__/program-engine.test.ts
git commit -m "feat: add difficultyForWeek helper"
```

---

## Task 3: TDD — `selectTemplatesForProgram`

**Files:**
- Modify: `src/lib/__tests__/program-engine.test.ts`
- Modify: `src/lib/program-engine.ts`

- [ ] **Step 1: Escrever teste com falha**

Atualize o import do topo de `src/lib/__tests__/program-engine.test.ts`:

```ts
import { selectTemplatesForWeek1, shouldTaskBeOnDay, difficultyForWeek, selectTemplatesForProgram } from '@/lib/program-engine'
```

Adicione ao final do arquivo:

```ts
const makeTemplateWithDifficulty = (
  area: HabitArea,
  freq: number,
  id: string,
  difficulty: 1 | 2 | 3
): TaskTemplate => ({
  id,
  area,
  title: `Template ${id}`,
  description: null,
  difficulty,
  frequency_per_week: freq,
  xp_reward: 20,
  tags: [],
  active: true,
  created_at: new Date().toISOString(),
})

const mixedTemplates: TaskTemplate[] = [
  makeTemplateWithDifficulty('corpo',         7, 'd1-corpo', 1),
  makeTemplateWithDifficulty('produtividade', 7, 'd1-prod',  1),
  makeTemplateWithDifficulty('financas',      7, 'd1-fin',   1),
  makeTemplateWithDifficulty('corpo',         5, 'd2-corpo', 2),
  makeTemplateWithDifficulty('produtividade', 5, 'd2-prod',  2),
  makeTemplateWithDifficulty('financas',      5, 'd2-fin',   2),
  makeTemplateWithDifficulty('corpo',         4, 'd3-corpo', 3),
  makeTemplateWithDifficulty('produtividade', 5, 'd3-prod',  3),
  makeTemplateWithDifficulty('financas',      1, 'd3-fin',   3),
]

describe('selectTemplatesForProgram', () => {
  it('returns only difficulty 1 templates for week 1', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    expect(selected.every(t => t.difficulty === 1)).toBe(true)
  })

  it('returns only difficulty 2 templates for week 4', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 4)
    expect(selected.every(t => t.difficulty === 2)).toBe(true)
  })

  it('returns only difficulty 3 templates for week 7', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 7)
    expect(selected.every(t => t.difficulty === 3)).toBe(true)
  })

  it('returns at most 3 templates', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    expect(selected.length).toBeLessThanOrEqual(3)
  })

  it('includes template from lowest scoring area when available', () => {
    // baseScores: financas=50 é o menor
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    expect(selected.some(t => t.area === 'financas')).toBe(true)
  })

  it('falls back to difficulty 1 when no templates exist for requested difficulty', () => {
    const diff1Only = mixedTemplates.filter(t => t.difficulty === 1)
    const selected = selectTemplatesForProgram(diff1Only, baseScores, 'corpo', 4)
    expect(selected.every(t => t.difficulty === 1)).toBe(true)
    expect(selected.length).toBeGreaterThan(0)
  })

  it('does not return duplicates', () => {
    const selected = selectTemplatesForProgram(mixedTemplates, baseScores, 'corpo', 1)
    const ids = selected.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Verificar falha**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Esperado: FAIL com `selectTemplatesForProgram is not a function`

- [ ] **Step 3: Implementar**

Em `src/lib/program-engine.ts`, adicione após `difficultyForWeek`:

```ts
export function selectTemplatesForProgram(
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea,
  weekNumber: number
): TaskTemplate[] {
  const targetDifficulty = difficultyForWeek(weekNumber)
  let candidates = templates.filter(t => t.difficulty === targetDifficulty && t.active)

  // Fallback para difficulty 1 se nenhum template do nível alvo estiver disponível
  if (candidates.length === 0) {
    candidates = templates.filter(t => t.difficulty === 1 && t.active)
  }

  const lowestArea = AREAS.reduce((a, b) => (scores[a] < scores[b] ? a : b))
  const selected: TaskTemplate[] = []

  const fromLowest = candidates.find(t => t.area === lowestArea)
  if (fromLowest) selected.push(fromLowest)

  if (priorityArea !== lowestArea) {
    const fromPriority = candidates.find(
      t => t.area === priorityArea && !selected.some(s => s.id === t.id)
    )
    if (fromPriority) selected.push(fromPriority)
  }

  const remaining = candidates
    .filter(t => !selected.some(s => s.id === t.id))
    .sort((a, b) => b.frequency_per_week - a.frequency_per_week)

  for (const template of remaining) {
    if (selected.length >= 3) break
    selected.push(template)
  }

  return selected.slice(0, 3)
}
```

- [ ] **Step 4: Verificar aprovação**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Esperado: PASS — suite `selectTemplatesForProgram` (7 testes) + suites anteriores

- [ ] **Step 5: Commit**

```bash
git add src/lib/program-engine.ts src/lib/__tests__/program-engine.test.ts
git commit -m "feat: add selectTemplatesForProgram with difficulty phases and fallback"
```

---

## Task 4: Implementar `generate63Days` e remover `generateWeek1`

> Nota: `generate63Days` é uma função de orquestração Supabase. Seguindo o padrão do projeto (sem testes para `generateWeek1` ou `createProgram`), a verificação é feita via build + tsc.

**Files:**
- Modify: `src/lib/program-engine.ts`

- [ ] **Step 1: Adicionar constante `WEEK_THEMES`**

Em `src/lib/program-engine.ts`, adicione após `selectTemplatesForProgram`:

```ts
const WEEK_THEMES = [
  'Fundação',
  'Ritmo',
  'Consistência',
  'Foco',
  'Expansão',
  'Profundidade',
  'Resistência',
  'Excelência',
  'Legado',
] as const
```

- [ ] **Step 2: Adicionar `generate63Days`**

Adicione logo após `WEEK_THEMES`:

```ts
export async function generate63Days(
  userId: string,
  programId: string,
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea,
  startDate: Date = new Date()
): Promise<void> {
  const { supabase } = await import('@/lib/supabase')

  for (let weekIndex = 0; weekIndex < 9; weekIndex++) {
    const weekNumber = weekIndex + 1
    const weekStart = addDays(startDate, weekIndex * 7)

    const { data: week, error: weekError } = await supabase
      .from('program_weeks')
      .insert({
        program_id: programId,
        week_number: weekNumber,
        theme: WEEK_THEMES[weekIndex],
        starts_on: format(weekStart, 'yyyy-MM-dd'),
      })
      .select('id')
      .single()

    if (weekError) throw weekError

    const dayRows = Array.from({ length: 7 }, (_, i) => ({
      program_id: programId,
      week_id: week.id,
      day_number: weekIndex * 7 + i + 1,
      date: format(addDays(weekStart, i), 'yyyy-MM-dd'),
    }))

    const { error: daysError } = await supabase
      .from('program_days')
      .insert(dayRows)

    if (daysError) throw daysError

    const { data: days, error: fetchError } = await supabase
      .from('program_days')
      .select('id, day_number')
      .eq('week_id', week.id)
      .order('day_number')

    if (fetchError) throw fetchError
    if (!days || days.length === 0) throw new Error(`Nenhum dia criado para a semana ${weekNumber}`)

    const weekTemplates = selectTemplatesForProgram(templates, scores, priorityArea, weekNumber)
    const taskRows: Record<string, unknown>[] = []

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const day = days[dayIndex]
      for (const template of weekTemplates) {
        if (!shouldTaskBeOnDay(template.frequency_per_week, dayIndex)) continue
        taskRows.push({
          program_id: programId,
          day_id: day.id,
          user_id: userId,
          template_id: template.id,
          title: template.title,
          description: template.description,
          area: template.area,
          difficulty: template.difficulty,
          xp_reward: template.xp_reward,
          status: 'pending',
          source: 'generated',
        })
      }
    }

    if (taskRows.length > 0) {
      const { error: tasksError } = await supabase
        .from('program_tasks')
        .insert(taskRows)

      if (tasksError) throw tasksError
    }
  }
}
```

- [ ] **Step 3: Remover `generateWeek1`**

Localize e apague a função `generateWeek1` completa (começa em `export async function generateWeek1` e vai até o fechamento `}`). A função `generate63Days` a substitui completamente.

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Esperado: sem erros de tipo

- [ ] **Step 5: Verificar testes**

```bash
npm test 2>&1 | tail -10
```

Esperado: PASS — todas as suites existentes continuam passando

- [ ] **Step 6: Commit**

```bash
git add src/lib/program-engine.ts
git commit -m "feat: add generate63Days, remove generateWeek1"
```

---

## Task 5: Fix `createProgram` — ends_at correto

**Files:**
- Modify: `src/lib/program-engine.ts`

- [ ] **Step 1: Corrigir ends_at**

Em `src/lib/program-engine.ts`, dentro de `createProgram`, localize:

```ts
const endsAt = format(addDays(today, 60), 'yyyy-MM-dd')
```

Substitua por:

```ts
const endsAt = format(addDays(today, 62), 'yyyy-MM-dd')
```

_(62 dias além do dia de início = 63 dias totais, 0-indexed)_

- [ ] **Step 2: Verificar testes**

```bash
npm test 2>&1 | tail -10
```

Esperado: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/program-engine.ts
git commit -m "fix: set program ends_at to day 62 (63 days total)"
```

---

## Task 6: Atualizar `assessment-to-program.ts`

**Files:**
- Modify: `src/lib/assessment-to-program.ts`

- [ ] **Step 1: Atualizar imports**

Localize no topo do arquivo:

```ts
import { createProgram, generateWeek1, selectTemplatesForWeek1, FALLBACK_TASK_TEMPLATES } from '@/lib/program-engine'
```

Substitua por:

```ts
import { createProgram, generate63Days, FALLBACK_TASK_TEMPLATES } from '@/lib/program-engine'
```

_(`selectTemplatesForProgram` é chamada internamente por `generate63Days`)_

- [ ] **Step 2: Substituir seleção + geração**

Localize o bloco:

```ts
  const selectedTemplates = selectTemplatesForWeek1(
    availableTemplates,
    scores,
    priorityArea
  )

  await generateWeek1(userId, program.id, selectedTemplates)
```

Substitua por:

```ts
  await generate63Days(userId, program.id, availableTemplates, scores, priorityArea)
```

- [ ] **Step 3: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Esperado: sem erros

- [ ] **Step 4: Verificar testes**

```bash
npm test 2>&1 | tail -10
```

Esperado: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/assessment-to-program.ts
git commit -m "feat: wire generate63Days into assessment-to-program orchestrator"
```

---

## Task 7: Atualizar copy — "63 dias"

**Files:**
- Modify: `src/app/analise-inicial/page.tsx`

- [ ] **Step 1: Atualizar CTA**

Em `src/app/analise-inicial/page.tsx`, localize:

```tsx
{generating ? 'Gerando seu plano...' : 'Ver meu plano de 60 dias →'}
```

Substitua por:

```tsx
{generating ? 'Gerando seu plano...' : 'Ver meu plano de 63 dias →'}
```

- [ ] **Step 2: Atualizar subtítulo**

Localize:

```tsx
Vamos montar sua semana 1 personalizada com base no seu diagnóstico
```

Substitua por:

```tsx
Vamos montar seu plano de 63 dias personalizado com base no seu diagnóstico
```

- [ ] **Step 3: Commit**

```bash
git add src/app/analise-inicial/page.tsx
git commit -m "fix: update copy to 63 dias"
```

---

## Task 8: Build final

**Files:** nenhum (verificação)

- [ ] **Step 1: Build completo**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully`, 0 erros TypeScript

- [ ] **Step 2: Testes completos**

```bash
npm test 2>&1 | tail -15
```

Esperado: todas as suites PASS (mínimo: 27 testes — 20 existentes + 7 novos de `selectTemplatesForProgram` + 3 de `difficultyForWeek`)
