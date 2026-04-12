# Check-in Tasks Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um step de resumo de tasks (read-only) ao final do check-in noturno, mostrando Feitas/Puladas/Pendentes do dia antes do "Fechar o Dia".

**Architecture:** Nova função `getTasksForDate(userId, date)` em `program.ts` busca as tasks do dia do programa ativo. `checkin/page.tsx` fetcha as tasks no load, guarda em estado `nightTasks[]`, e insere um 4º step condicional na fase `noite` (só aparece se `nightTasks.length > 0`).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (lazy import), Vitest (tsc --noEmit para funções Supabase-bound)

---

## Mapa de ficheiros

| Ficheiro | Mudança |
|----------|---------|
| `src/lib/program.ts` | Adicionar `getTasksForDate` no final |
| `src/app/checkin/page.tsx` | Import, estado `nightTasks`, fetch no useEffect, step 3 condicional na fase noite |

---

### Task 1: `getTasksForDate` em `program.ts`

**Files:**
- Modify: `src/lib/program.ts` (append ao final, linha 325)

- [ ] **Step 1: Adicionar a função no final de `src/lib/program.ts`**

Adicionar imediatamente após a última linha (`}`):

```ts
export async function getTasksForDate(
  userId: string,
  date: string
): Promise<ProgramTask[]> {
  const { supabase } = await import('@/lib/supabase')

  const { data: prog } = await supabase
    .from('programs')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (!prog) return []

  const { data: day } = await supabase
    .from('program_days')
    .select('id')
    .eq('program_id', prog.id)
    .eq('date', date)
    .maybeSingle()

  if (!day) return []

  return getProgramTasks(day.id)
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/program.ts
git commit -m "feat: add getTasksForDate to program.ts"
```

---

### Task 2: Estado e fetch em `checkin/page.tsx`

**Files:**
- Modify: `src/app/checkin/page.tsx`

- [ ] **Step 1: Adicionar import de `getTasksForDate` e `ProgramTask`**

Linha 8, o import de tipos já existe: `import type { Profile, CheckinPhase } from '@/types'`

Linha 9, o import de program já existe:
```ts
// não há import de program.ts ainda — adicionar nova linha após linha 8:
import type { ProgramTask } from '@/types'
import { getTasksForDate } from '@/lib/program'
```

Verificar se `ProgramTask` já está importado de `@/types` (linha 8). Se sim, apenas adicionar `ProgramTask` ao import existente. O ficheiro actual tem:
```ts
import type { Profile, CheckinPhase } from '@/types'
```

Substituir por:
```ts
import type { Profile, CheckinPhase, ProgramTask } from '@/types'
import { getTasksForDate } from '@/lib/program'
```

- [ ] **Step 2: Adicionar estado `nightTasks`**

Após a linha `const [moodNight, setMoodNight] = useState(3)` (linha 106), adicionar:

```ts
const [nightTasks, setNightTasks] = useState<ProgramTask[]>([])
```

- [ ] **Step 3: Fetch de tasks no `useEffect`**

Dentro do `useEffect` (linha 108), após `setProfile(prof)` e antes da determinação da fase activa, adicionar o fetch de tasks:

```ts
// Buscar tasks do dia para o resumo noturno
const { data: { user: currentUser } } = await supabase.auth.getUser()
if (currentUser) {
  const todayTasks = await getTasksForDate(currentUser.id, today)
  setNightTasks(todayTasks)
}
```

Atenção: o `useEffect` já tem `user` disponível na closure. Usar `user.id` directamente em vez de chamar `getUser()` de novo:

```ts
// Adicionar após: setProfile(prof)
const todayTasks = await getTasksForDate(user.id, today)
setNightTasks(todayTasks)
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/app/checkin/page.tsx
git commit -m "feat: fetch nightTasks in checkin useEffect"
```

---

### Task 3: Step de tasks_summary na fase noite

**Files:**
- Modify: `src/app/checkin/page.tsx`

Este task adiciona o step 3 condicional na fase noite. As mudanças são:
1. `StepDots` passa de `total={3}` para `total={nightTasks.length > 0 ? 4 : 3}`
2. O botão final do step 2 fica condicional: se há tasks, vai para step 3; se não, chama `finish('noite')`
3. Novo bloco `{step === 3 && ...}` com o resumo de tasks

- [ ] **Step 1: Tornar `StepDots` da fase noite condicional**

Localizar no bloco `{!isDone && activePhase === 'noite' && (` (linha 371):

```tsx
<StepDots total={3} current={step} />
```

Substituir por:

```tsx
<StepDots total={nightTasks.length > 0 ? 4 : 3} current={step} />
```

- [ ] **Step 2: Tornar o botão do step 2 condicional**

Localizar no step 2 da fase noite (linha ~416):

```tsx
<button disabled={submitting} onClick={() => finish('noite')} style={{
  width: '100%', background: 'var(--gold)', color: 'var(--bg0)', border: 'none',
  borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}}>{submitting ? 'A guardar…' : 'Fechar o Dia ✓'}</button>
```

Substituir por:

```tsx
<button
  disabled={submitting}
  onClick={() => nightTasks.length > 0 ? setStep(3) : finish('noite')}
  style={{
    width: '100%', background: 'var(--gold)', color: 'var(--bg0)', border: 'none',
    borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
  }}
>
  {submitting ? 'A guardar…' : nightTasks.length > 0 ? 'Próxima →' : 'Fechar o Dia ✓'}
</button>
```

- [ ] **Step 3: Adicionar o bloco do step 3 (tasks_summary)**

Após o bloco `{step === 2 && (...)}`  e antes do `</>` que fecha a fase noite, adicionar:

```tsx
{step === 3 && (() => {
  const doneTasks  = nightTasks.filter(t => t.status === 'completed')
  const skipped    = nightTasks.filter(t => t.status === 'skipped')
  const pending    = nightTasks.filter(t => t.status === 'pending')
  const tasksXp    = doneTasks.reduce((s, t) => s + t.xp_reward, 0)
  return (
    <div>
      {/* Título */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 6 }}>
          Check-in noturno
        </p>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: 'var(--text1)', lineHeight: 1.1 }}>
          Tasks do dia
        </h2>
      </div>

      {/* Contador 3 colunas */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '18px 16px', background: 'var(--bg2)',
        border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: 16,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--teal)', lineHeight: 1 }}>
            {doneTasks.length}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5, color: 'var(--text3)' }}>
            Feitas
          </div>
        </div>
        <div style={{ width: '0.5px', height: 36, background: 'var(--border)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
            {skipped.length}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5, color: 'var(--text3)' }}>
            Puladas
          </div>
        </div>
        <div style={{ width: '0.5px', height: 36, background: 'var(--border)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--bg3)', lineHeight: 1 }}>
            {pending.length}
          </div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5, color: 'var(--text3)' }}>
            Pendentes
          </div>
        </div>
      </div>

      {/* Lista de tasks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {nightTasks.map(task => (
          <div
            key={task.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 14,
              background: task.status === 'completed' ? 'rgba(30,203,180,.04)' : 'var(--bg2)',
              border: `0.5px solid ${task.status === 'completed' ? 'rgba(30,203,180,.2)' : 'var(--border)'}`,
              opacity: task.status === 'pending' ? 0.35 : task.status === 'skipped' ? 0.5 : 1,
            }}
          >
            {task.status === 'completed' && (
              <span style={{ color: 'var(--teal)', fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>✓</span>
            )}
            {task.status === 'skipped' && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#666', background: 'var(--bg3)', padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                pulado
              </span>
            )}
            {task.status === 'pending' && (
              <span style={{ color: 'var(--text3)', fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>○</span>
            )}
            <span style={{
              flex: 1, fontSize: 14, fontWeight: 500,
              color: task.status === 'completed' ? 'var(--text3)' : 'var(--text2)',
              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
            }}>
              {task.title}
            </span>
            {task.status === 'completed' && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)', flexShrink: 0 }}>
                +{task.xp_reward} XP
              </span>
            )}
          </div>
        ))}
      </div>

      {/* XP total (só se > 0) */}
      {tasksXp > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: 14, background: 'rgba(232,168,56,.06)',
          border: '0.5px solid rgba(232,168,56,.18)', borderRadius: 14, marginBottom: 12,
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
            +{tasksXp} XP em tasks hoje
          </span>
        </div>
      )}

      {/* Botão fechar dia */}
      <button
        disabled={submitting}
        onClick={() => finish('noite')}
        style={{
          width: '100%', padding: 17,
          background: 'var(--accent)', color: '#fff', border: 'none',
          borderRadius: 16, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16,
          cursor: 'pointer', letterSpacing: '.3px',
        }}
      >
        {submitting ? 'A guardar…' : 'Fechar o Dia 🌙'}
      </button>
    </div>
  )
})()}
```

- [ ] **Step 4: Verificar tipos**

```bash
npx tsc --noEmit
```

Esperado: 0 erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/app/checkin/page.tsx
git commit -m "feat: add tasks_summary step to night check-in"
```

---

### Task 4: Build e testes finais

**Files:** nenhum (verificação)

- [ ] **Step 1: Correr testes**

```bash
npx vitest run
```

Esperado:
```
Test Files  4 passed (4)
Tests       30 passed (30)
```

- [ ] **Step 2: Build de produção**

```bash
npm run build
```

Esperado: `✓ Compiled successfully` sem erros.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify build and tests for sprint 4 checkin tasks summary"
```
