# Handoff — Continuação de Sessão

**Projeto:** NEXUS v4  
**Repo:** https://github.com/igorcirilo/nexus  
**Branch ativa:** `design/nexus-mockups`  
**Stack:** Next.js 14 App Router · TypeScript strict · React inline styles · Supabase · `'use client'`  
**Dev server:** `npm run dev` → `http://localhost:3001`  
**Verificação:** `npx tsc --noEmit` (0 erros) + `npx vitest run` (40/40)

---

## Estado atual da branch

### O que está feito ✅

| Módulo | Ficheiros-chave | Estado |
|--------|----------------|--------|
| Hoje | `src/components/hoje/*`, `src/app/hoje/page.tsx` | Hub fiel ao mockup |
| Corpo | `src/components/corpo/BodyHub.tsx`, `src/app/corpo/page.tsx` | Hub fiel ao mockup |
| Hábitos | `src/components/habitos/HabitosHub.tsx`, `src/app/habitos/page.tsx` | Hub fiel; modo tracker diário + modo Gerir |
| Progresso | `src/components/progresso/ProgressoHub.tsx`, `src/app/progresso/page.tsx` | Hub fiel ao mockup |
| Finanças | `src/components/financas/FinancasHub.tsx`, `src/app/financas/page.tsx` | Hub + modal de transação hub-styled no Resumo |
| Leitura | `src/components/leitura/LeituraHub.tsx`, `src/app/leitura/page.tsx` | Hub + modal Biblioteca + highlights clicáveis |
| Objetivos | `src/components/objetivos/ObjetivosHub.tsx`, `src/app/objetivos/page.tsx` | Hub fiel ao mockup |
| Perfil | `src/components/perfil/PerfilHub.tsx`, `src/app/perfil/page.tsx` | Hub fiel ao mockup |
| Reader | `src/app/leitura/[id]/page.tsx` | URL `?page=N` implementado; botão "← Leitura" |

### Padrão de arquitetura usado em todos os módulos

```tsx
// Em page.tsx de cada módulo:
type AppTab = 'resumo' | 'subtab1' | 'subtab2' ...
const [tab, setTab] = useState<AppTab>('resumo')

// Early-return para o hub (full-bleed, sem chrome do app):
if (tab === 'resumo') {
  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh', background: '#07070F' }}>
      <ModuloHub ... onNavigate={setTab} />
      <Nav />
    </main>
  )
}

// Resto do return: sub-páginas com chrome legado
```

### Design tokens do hub (Inter, dark)

```
background: #07070F
container:  #0D0E20
gold:       #F5C842
teal:       #00C896 / #00D4C8
roxo:       #9D5CF5
input bg:   rgba(255,255,255,0.05)
input bdr:  1px solid rgba(255,255,255,0.08)
section lbl: 11px, weight 700, uppercase, color rgba(255,255,255,0.3)
font:       Inter, sans-serif
```

---

## Trabalho pendente

### Handoff 3 — Tracking de Sessões de Leitura

**Objetivo:** Implementar rastreio automático de tempo de leitura (começa quando o reader abre, termina quando fecha) e exibir estatísticas semanais no hub.

**O que vai aparecer no hub após a implementação:**
- Secção "Meta semanal": 7 círculos (SEG–DOM) com minutos lidos por dia
- Secção "Estatísticas": min esta semana / min/dia média / livros concluídos  
- ETA no card do livro atual: "Conclusão em ~N dias no seu ritmo"

---

#### PASSO 0 — Migration SQL (executar no Supabase Dashboard → SQL Editor)

```sql
create table if not exists reading_sessions (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  book_id          uuid references books(id) on delete cascade not null,
  date             date not null,
  duration_minutes integer not null default 0,
  pages_read       integer not null default 0,
  created_at       timestamptz default now()
);

alter table reading_sessions enable row level security;

create policy "users_own_reading_sessions"
  on reading_sessions for all
  using (auth.uid() = user_id);

create index if not exists reading_sessions_user_date
  on reading_sessions (user_id, date desc);
```

---

#### PASSO 1 — `src/types/index.ts`

Adicionar após a interface `BookProgress` (linha ~308):

```ts
export interface ReadingSession {
  id: string
  user_id: string
  book_id: string
  date: string
  duration_minutes: number
  pages_read: number
  created_at: string
}
```

---

#### PASSO 2 — `src/lib/supabase.ts`

Adicionar no **final do ficheiro**, após `deleteBookBookmark`:

```ts
// ── Sessões de leitura ─────────────────────────────────────
export async function saveReadingSession(payload: {
  user_id: string
  book_id: string
  date: string
  duration_minutes: number
  pages_read: number
}) {
  const { error } = await supabase.from('reading_sessions').insert(payload)
  if (error) reportError('saveReadingSession error', error.message)
  return { error }
}

export async function getReadingSessionsThisWeek(userId: string) {
  const now         = new Date()
  const dayOfWeek   = now.getDay()
  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday      = new Date(now)
  monday.setDate(now.getDate() - daysFromMon)
  const mondayStr   = monday.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('reading_sessions')
    .select('date, duration_minutes, pages_read')
    .eq('user_id', userId)
    .gte('date', mondayStr)
    .order('date', { ascending: true })

  if (error) reportError('getReadingSessionsThisWeek error', error.message)
  return (data ?? []) as Array<{ date: string; duration_minutes: number; pages_read: number }>
}
```

---

#### PASSO 3 — `src/app/leitura/[id]/page.tsx` (reader)

**3A** — Alterar a linha de import do React (adicionar `useRef`):

```tsx
// ANTES:
import { useEffect, useMemo, useState } from 'react'
// DEPOIS:
import { useEffect, useMemo, useRef, useState } from 'react'
```

**3B** — Adicionar `saveReadingSession` ao import de `@/lib/supabase` (já tem muitos outros — apenas acrescentar no final da lista):

```tsx
  saveReadingPreference,
  saveReadingSession,   // ← adicionar esta linha
} from '@/lib/supabase'
```

**3C** — Adicionar refs logo após `const [toast, setToast] = useState('')`:

```tsx
// ── Session tracking ───────────────────────────────────────
const sessionStartRef = useRef<{ time: number; page: number } | null>(null)
const currentPageRef  = useRef(1)
```

**3D** — Adicionar dois `useEffect` logo após o bloco `persistProgress` (que está em torno da linha 137):

```tsx
// Manter ref sincronizado para evitar stale closure no cleanup de sessão
useEffect(() => { currentPageRef.current = currentPage }, [currentPage])

// Tracking automático de sessão — começa no mount (com userId), termina no unmount
useEffect(() => {
  if (!userId || !bookId) return

  sessionStartRef.current = { time: Date.now(), page: currentPageRef.current }

  return () => {
    const start = sessionStartRef.current
    if (!start) return

    const durationMs      = Date.now() - start.time
    const durationMinutes = Math.min(Math.round(durationMs / 60000), 240) // cap 4h
    if (durationMinutes < 1) return // ignorar sessões < 1 min

    const pagesRead = Math.max(0, currentPageRef.current - start.page)

    void saveReadingSession({
      user_id:          userId,
      book_id:          bookId,
      date:             new Date().toISOString().split('T')[0],
      duration_minutes: durationMinutes,
      pages_read:       pagesRead,
    })
  }
}, [userId, bookId])
```

---

#### PASSO 4 — `src/app/leitura/page.tsx`

**4A** — Adicionar `getReadingSessionsThisWeek` ao import de supabase:

```tsx
// ANTES:
import { supabase, getBooks, getBookProgress, getBookHighlights, saveBook } from '@/lib/supabase'
// DEPOIS:
import { supabase, getBooks, getBookProgress, getBookHighlights, saveBook, getReadingSessionsThisWeek } from '@/lib/supabase'
```

**4B** — Adicionar interface e state antes do return (fora do componente, ou como interface interna — dentro do componente como const):

Adicionar a interface `WeeklyStats` no topo do ficheiro (fora do componente, após os imports):

```tsx
interface WeeklyStats {
  days: Array<{ date: string; minutes: number }>
  totalMinutes: number
  daysWithReading: number
  avgMinPerDay: number
  pagesPerDay: number
}
```

Adicionar o state dentro do componente `LeituraPage`, após `const [highlights, setHighlights] = useState<BookHighlight[]>([])`:

```tsx
const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>(() => {
  const now         = new Date()
  const dayOfWeek   = now.getDay()
  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday      = new Date(now)
  monday.setDate(now.getDate() - daysFromMon)
  return {
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return { date: d.toISOString().split('T')[0], minutes: 0 }
    }),
    totalMinutes: 0, daysWithReading: 0, avgMinPerDay: 0, pagesPerDay: 0,
  }
})
```

**4C** — Adicionar o bloco de sessões **no final da função `loadData`**, após o bloco de highlights:

```tsx
// ── Sessões desta semana ──────────────────────────────────
const sessions = await getReadingSessionsThisWeek(uid)

const now2        = new Date()
const dow2        = now2.getDay()
const dfm2        = dow2 === 0 ? 6 : dow2 - 1
const monday2     = new Date(now2)
monday2.setDate(now2.getDate() - dfm2)

const weekDays = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(monday2)
  d.setDate(monday2.getDate() + i)
  return d.toISOString().split('T')[0]
})

const minByDate:   Record<string, number> = {}
const pagesByDate: Record<string, number> = {}
sessions.forEach(s => {
  minByDate[s.date]   = (minByDate[s.date]   ?? 0) + s.duration_minutes
  pagesByDate[s.date] = (pagesByDate[s.date] ?? 0) + s.pages_read
})

const wDays           = weekDays.map(date => ({ date, minutes: minByDate[date] ?? 0 }))
const totalMinutes    = wDays.reduce((sum, d) => sum + d.minutes, 0)
const daysWithReading = wDays.filter(d => d.minutes > 0).length
const avgMinPerDay    = daysWithReading > 0 ? Math.round(totalMinutes / daysWithReading) : 0
const totalPages      = Object.values(pagesByDate).reduce((sum, p) => sum + p, 0)
const daysWPages      = Object.values(pagesByDate).filter(p => p > 0).length
const pagesPerDay     = daysWPages > 0 ? Math.round(totalPages / daysWPages) : 0

setWeeklyStats({ days: wDays, totalMinutes, daysWithReading, avgMinPerDay, pagesPerDay })
```

**4D** — Passar `weeklyStats` ao hub (adicionar a prop à chamada de `<LeituraHub ...>`):

```tsx
<LeituraHub
  currentBook={currentBook}
  currentProgress={currentBook ? (progressMap[currentBook.id] ?? null) : null}
  highlights={highlights}
  stats={stats}
  queue={queue}
  weeklyStats={weeklyStats}          {/* ← adicionar */}
  onOpenBook={(id) => router.push(`/leitura/${id}`)}
  onAdd={() => setShowImport(true)}
  onLibrary={() => setShowBiblioteca(true)}
  onHighlightClick={(bookId, page) => router.push(`/leitura/${bookId}?page=${page}`)}
/>
```

---

#### PASSO 5 — `src/components/leitura/LeituraHub.tsx`

**5A** — Adicionar interface `WeeklyStats` logo após `interface Stats`:

```tsx
interface WeeklyStats {
  days: Array<{ date: string; minutes: number }>
  totalMinutes: number
  daysWithReading: number
  avgMinPerDay: number
  pagesPerDay: number
}
```

**5B** — Adicionar `weeklyStats: WeeklyStats` à interface `Props`:

```tsx
interface Props {
  currentBook:      Book | null
  currentProgress:  BookProgress | null
  highlights:       BookHighlight[]
  stats:            Stats
  queue:            Book[]
  weeklyStats:      WeeklyStats        // ← adicionar
  onOpenBook:       (bookId: string) => void
  onAdd:            () => void
  onLibrary:        () => void
  onHighlightClick: (bookId: string, page: number) => void
}
```

**5C** — Adicionar `weeklyStats` à desestruturação da função:

```tsx
export default function LeituraHub({
  currentBook,
  currentProgress,
  highlights,
  stats,
  queue,
  weeklyStats,      // ← adicionar
  onOpenBook,
  onAdd,
  onLibrary,
  onHighlightClick,
}: Props) {
```

**5D** — Adicionar constantes antes do `return`:

```tsx
const DAY_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const todayStr   = new Date().toISOString().split('T')[0]
```

**5E** — Adicionar ETA no card do livro atual, após a barra de progresso (o `<div style={{ height: 6, ... }}>` da progress bar) e antes do `</div>` que fecha o bloco `.book-info`:

```tsx
{weeklyStats.pagesPerDay > 0 && pageCount > 0 && pct < 100 && (
  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 7 }}>
    Conclusão em ~{Math.ceil((pageCount - curPage) / weeklyStats.pagesPerDay)} dias no seu ritmo
  </div>
)}
```

**5F** — Substituir a secção "Biblioteca" atual pelas três novas secções.

Localizar o bloco que começa com `<SectionLabel>Biblioteca</SectionLabel>` e termina no `</div>` do wrapper `onClick={onLibrary}` (é uma div com `display: 'flex', gap: 10, cursor: 'pointer'` contendo 3 stat cards). Substituir esse bloco completo por:

```tsx
{/* ── Meta semanal ── */}
<SectionLabel style={{ marginTop: 18 }}>Meta semanal</SectionLabel>
<div style={{
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20, padding: '18px 20px',
}}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Esta semana</div>
    <div style={{
      fontSize: 13, fontWeight: 700,
      color: weeklyStats.daysWithReading >= 5 ? '#00C896'
           : weeklyStats.daysWithReading >= 3 ? '#F5C842'
           : 'rgba(255,255,255,0.4)',
    }}>
      {weeklyStats.daysWithReading}/7 dias
    </div>
  </div>
  <div style={{ display: 'flex', gap: 8 }}>
    {weeklyStats.days.map((d, i) => {
      const isToday = d.date === todayStr
      const isDone  = d.minutes > 0
      const label   = DAY_LABELS[i]
      let circleStyle: React.CSSProperties
      if (isDone) {
        circleStyle = { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, background:'rgba(245,200,66,0.2)', color:'#F5C842', border:'1.5px solid rgba(245,200,66,0.4)' }
      } else if (isToday) {
        circleStyle = { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, background:'#F5C842', color:'#0A0800', border:'none' }
      } else {
        circleStyle = { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.25)', border:'1px solid rgba(255,255,255,0.08)' }
      }
      return (
        <div key={d.date} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
          <div style={circleStyle}>{label.charAt(0)}</div>
          <div style={{ fontSize:9, fontWeight:600, color: isToday ? '#F5C842' : 'rgba(255,255,255,0.3)', letterSpacing:'0.04em' }}>
            {label}
          </div>
          <div style={{ fontSize:9, color: isToday && !isDone ? '#F5C842' : 'rgba(255,255,255,0.25)' }}>
            {isDone ? `${d.minutes}m` : isToday ? 'hoje' : '—'}
          </div>
        </div>
      )
    })}
  </div>
</div>

{/* ── Estatísticas ── */}
<SectionLabel style={{ marginTop: 18 }}>Estatísticas</SectionLabel>
<div style={{ display: 'flex', gap: 10 }}>
  {[
    { label: 'min esta semana',  value: weeklyStats.totalMinutes  || '—', color: '#fff'     },
    { label: 'min / dia (média)', value: weeklyStats.avgMinPerDay || '—', color: '#F5C842'  },
    { label: 'livros concluídos', value: stats.completed,                 color: '#00C896'  },
  ].map(s => (
    <div key={s.label} style={{
      flex:1, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
      borderRadius:16, padding:'14px 12px', textAlign:'center',
    }}>
      <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:500, marginTop:3 }}>{s.label}</div>
    </div>
  ))}
</div>

{/* ── Acesso à biblioteca ── */}
<div
  onClick={onLibrary}
  style={{ marginTop:10, display:'flex', justifyContent:'center', alignItems:'center', gap:6, padding:'10px 0', cursor:'pointer' }}
>
  <span style={{ fontSize:13, color:'rgba(255,255,255,0.35)', fontWeight:500 }}>Ver biblioteca completa</span>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
</div>
```

---

## Verificação final (Handoff 3)

```bash
npx tsc --noEmit    # deve retornar 0 erros
npx vitest run      # deve passar 40/40
```

Testes manuais no browser (`http://localhost:3001`):

1. Abrir `/leitura/[qualquer-id]` → navegar 3+ páginas → voltar para `/leitura`
2. Hub recarrega → círculo de hoje aparece destacado (gold sólido se ainda sem minutos, gold com borda se leu)
3. "Estatísticas": valores maiores que 0 após primeira sessão
4. ETA aparece no card do livro se `pagesPerDay > 0`
5. "Ver biblioteca completa" → modal de biblioteca abre (funcionalidade intacta)
6. Entrar novamente no reader → segunda sessão gravada separadamente (não substitui)

---

## Pendências futuras (fora do escopo deste handoff)

- **Alinhamento visual das sub-páginas** de Finanças, Hábitos, Leitura (atualmente em tokens `var(--gold)` / Syne legado)
- **Hub do Calendário** — mockup `03-calendario.html` já está refeito, implementação do hub pendente
- **Tracking de água no Corpo** — migrar de localStorage para Supabase (sync entre dispositivos)
- **Unificar helpers de dieta** — duplicação entre `DietTracker.tsx` e `body-plan.ts`
