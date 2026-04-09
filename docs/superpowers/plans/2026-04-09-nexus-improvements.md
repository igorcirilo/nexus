# NEXUS Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar sistema de toast global, notificações de badge, streak recovery, CSV parser para finanças, e review modal para imports de Corpo.

**Architecture:** Toast via CustomEvent bridge (supabase.ts não é React), badges com modal dedicado, streak com coluna nova no perfil, CSV com parser robusto + preview, Corpo com modal de revisão antes de guardar.

**Tech Stack:** Next.js 14, React 18, Supabase, TypeScript — sem dependências novas.

---

## File Map

| Ficheiro | Acção |
|---------|-------|
| `src/components/Toast.tsx` | Criar — ToastProvider, useToast, emitToast |
| `src/app/layout.tsx` | Modificar — adicionar ToastProvider |
| `src/lib/supabase.ts` | Modificar — substituir console.error por emitToast |
| `src/components/BadgeModal.tsx` | Criar — modal de conquista |
| `src/components/StreakRecovery.tsx` | Modificar — adicionar botão de freeze recovery |
| `src/app/hoje/page.tsx` | Modificar — integrar BadgeModal + streak recovery |
| `src/lib/csv-parser.ts` | Criar — parser CSV robusto |
| `src/app/financas/page.tsx` | Modificar — substituir importCSV por parser + preview |
| `src/lib/body-plan.ts` | Modificar — melhorar parser |
| `src/components/PlanReviewModal.tsx` | Criar — review antes de guardar |
| `src/app/corpo/page.tsx` | Modificar — usar PlanReviewModal |

---

## FASE 1 — Sistema de Toast Global

### Task 1.1: Criar Toast.tsx

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Criar o ficheiro**

```typescript
// src/components/Toast.tsx
'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; type: ToastType }
type ToastCtx = { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++nextId.current
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent<{ message: string; type: ToastType }>).detail
      add(message, type)
    }
    window.addEventListener('nexus-toast', handler)
    return () => window.removeEventListener('nexus-toast', handler)
  }, [add])

  const BG: Record<ToastType, string> = {
    success: '#1D9E75',
    error:   '#E24B4A',
    info:    '#7F77DD',
  }

  return (
    <Ctx.Provider value={{ success: m => add(m, 'success'), error: m => add(m, 'error'), info: m => add(m, 'info') }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 88, right: 16, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: BG[t.type],
            color: '#fff',
            padding: '11px 16px',
            borderRadius: 12,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 500,
            boxShadow: '0 4px 20px rgba(0,0,0,.4)',
            animation: 'fadeUp .2s ease',
            maxWidth: 300,
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast fora de ToastProvider')
  return ctx
}

/** Usável fora do React (ex: supabase.ts) */
export function emitToast(message: string, type: ToastType = 'error') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nexus-toast', { detail: { message, type } }))
  }
}
```

- [ ] **Step 2: Verificar que não há erros de TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add global Toast system with emitToast bridge"
```

---

### Task 1.2: Integrar ToastProvider no layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Adicionar import e wrapper**

Substituir o conteúdo de `src/app/layout.tsx`:

```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import Sidebar from '@/components/Sidebar'
import dynamic from 'next/dynamic'
import './globals.css'

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400','500','700','800'] })
const dm   = DM_Sans({ subsets: ['latin'], variable: '--font-dm',   weight: ['300','400','500'] })

const GlobalUI    = dynamic(() => import('@/components/GlobalUI'),             { ssr: false })
const ToastClient = dynamic(() => import('@/components/Toast').then(m => ({ default: m.ToastProvider })), { ssr: false })

export const metadata: Metadata = {
  title: 'NEXUS — Evolução Pessoal',
  description: 'O teu sistema diário de alta performance',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'NEXUS' },
  icons: { apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: '#0D0F14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${syne.variable} ${dm.variable}`}>
      <body className={`${syne.variable} ${dm.variable}`}>
        <ToastClient>
          <div className="nexus-layout">
            <div className="nexus-sidebar">
              <Sidebar />
            </div>
            <div className="nexus-content">
              {children}
              <GlobalUI />
            </div>
          </div>
        </ToastClient>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wrap app in ToastProvider"
```

---

### Task 1.3: Substituir console.error em supabase.ts

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Adicionar import no topo do ficheiro**

Após a linha `export const supabase = createClient(supabaseUrl, supabaseAnon)`, adicionar:

```typescript
import { emitToast } from '@/components/Toast'

function reportError(context: string, message: string) {
  console.error(`${context}:`, message)
  emitToast(`Erro: ${context.replace(' error', '').replace(/([A-Z])/g, ' $1').trim()}`, 'error')
}
```

- [ ] **Step 2: Substituir todos os console.error de operações de utilizador**

Substituir cada bloco do padrão:
```typescript
if (error) {
  console.error('NOME error:', error.message)
  return []
}
```
por:
```typescript
if (error) {
  reportError('NOME error', error.message)
  return []
}
```

E cada linha solta:
```typescript
if (error) console.error('NOME error:', error.message)
```
por:
```typescript
if (error) reportError('NOME error', error.message)
```

Funções a atualizar (em ordem de aparição no ficheiro):
- `getAgendaEvents` — `console.error('getAgendaEvents error:', ...)`
- `saveAgendaEvent` — `console.error('saveAgendaEvent update error:', ...)` e `console.error('saveAgendaEvent insert error:', ...)`
- `deleteAgendaEvent` — `console.error('deleteAgendaEvent error:', ...)`
- `getTransactions` — `console.error('getTransactions error:', ...)`
- `getTransactionsByMonth` — `console.error('getTransactionsByMonth error:', ...)`
- `saveTransaction` — `console.error('saveTransaction error:', ...)`
- `saveTransactionsBulk` — `console.error('saveTransactionsBulk error:', ...)`
- `deleteTransaction` — `console.error('deleteTransaction error:', ...)`
- `getTrainingPlans` — `console.error('getTrainingPlans error:', ...)`
- `saveTrainingPlan` — `console.error('saveTrainingPlan error:', ...)`
- `getDietPlans` — `console.error('getDietPlans error:', ...)`
- `saveDietPlan` — `console.error('saveDietPlan error:', ...)`
- `getBooks` — `console.error('getBooks error:', ...)`
- `getBookById` — `console.error('getBookById error:', ...)`
- `saveBook` — `console.error('saveBook error:', ...)`
- `getBookProgress` — `console.error('getBookProgress error:', ...)`
- `saveBookProgress` — `console.error('saveBookProgress error:', ...)`
- `getBookHighlights` — `console.error('getBookHighlights error:', ...)`
- `saveBookHighlight` — `console.error('saveBookHighlight error:', ...)`
- `deleteBookHighlight` — `console.error('deleteBookHighlight error:', ...)`
- `getBookNotes` — `console.error('getBookNotes error:', ...)`
- `saveBookNote` — `console.error('saveBookNote error:', ...)`
- `deleteBookNote` — `console.error('deleteBookNote error:', ...)`
- `getBookBookmarks` — `console.error('getBookBookmarks error:', ...)`
- `saveBookBookmark` — `console.error('saveBookBookmark error:', ...)`
- `deleteBookBookmark` — `console.error('deleteBookBookmark error:', ...)`
- `getReadingPreference` — `console.error('getReadingPreference error:', ...)`
- `saveReadingPreference` — `console.error('saveReadingPreference error:', ...)`

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: replace silent console.error with user-visible toasts in supabase.ts"
```

---

## FASE 2 — Badge Notifications + Streak Recovery

### Task 2.1: Criar BadgeModal.tsx

**Files:**
- Create: `src/components/BadgeModal.tsx`

- [ ] **Step 1: Criar o ficheiro**

```typescript
// src/components/BadgeModal.tsx
'use client'

const BADGE_ICONS: Record<string, string> = {
  primeiro_checkin: '🌅',
  streak_7:         '🔥',
  streak_21:        '⚡',
  streak_100:       '🏆',
  xp_1000:          '💎',
  xp_5000:          '🌟',
  xp_10000:         '👑',
}

const BADGE_DESC: Record<string, string> = {
  primeiro_checkin: 'Fizeste o teu primeiro check-in. O começo é o mais difícil.',
  streak_7:         'Uma semana completa de consistência. Isso não é sorte.',
  streak_21:        'Três semanas. Já é quase um hábito automático.',
  streak_100:       'Cem dias. Isso é raro. Genuinamente raro.',
  xp_1000:          'Mil pontos conquistados. Estás a construir algo real.',
  xp_5000:          'Veterano. 5000 XP de trabalho acumulado.',
  xp_10000:         'Elite. Chegar aqui exige quem não para.',
}

interface Props {
  badges: { key: string; name: string }[]
  onClose: () => void
}

export default function BadgeModal({ badges, onClose }: Props) {
  if (badges.length === 0) return null
  const badge = badges[0]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9998, padding: 24,
        animation: 'fadeUp .2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg1)',
          border: '0.5px solid rgba(232,168,56,.4)',
          borderRadius: 24, padding: '36px 28px',
          maxWidth: 320, width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 60, marginBottom: 16, lineHeight: 1 }}>
          {BADGE_ICONS[badge.key] ?? '🎖️'}
        </div>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 800,
          fontSize: 10, letterSpacing: 2.5,
          color: 'var(--gold)', marginBottom: 10,
          textTransform: 'uppercase',
        }}>
          Conquista desbloqueada
        </div>
        <div style={{
          fontFamily: 'Syne, sans-serif', fontWeight: 700,
          fontSize: 22, color: 'var(--text1)', marginBottom: 12,
        }}>
          {badge.name}
        </div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65, marginBottom: 28 }}>
          {BADGE_DESC[badge.key] ?? ''}
        </p>
        <button
          onClick={onClose}
          style={{
            background: 'var(--gold)', color: 'var(--bg0)',
            border: 'none', borderRadius: 12,
            padding: '13px 36px',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BadgeModal.tsx
git commit -m "feat: add BadgeModal component for earned achievements"
```

---

### Task 2.2: Integrar BadgeModal em hoje/page.tsx

**Files:**
- Modify: `src/app/hoje/page.tsx`

- [ ] **Step 1: Adicionar import de BadgeModal**

Após a linha `import LevelUpModal from '@/components/LevelUpModal'`, adicionar:

```typescript
import BadgeModal from '@/components/BadgeModal'
```

- [ ] **Step 2: Adicionar estado para badges pendentes**

Após a linha `const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null)`, adicionar:

```typescript
const [pendingBadges, setPendingBadges] = useState<{ key: string; name: string }[]>([])
```

- [ ] **Step 3: Substituir a exibição de badge por trigger do modal**

Localizar o bloco (linhas ~98-103):
```typescript
if (prof) {
  const newBadges = await checkAndAwardBadges(user.id, {
    streak_current: prof.streak_current,
    xp_total: prof.xp_total,
  })
  newBadges.forEach((badge) => triggerXP(0, `Nova conquista: ${badge.name}`))
}
```

Substituir por:
```typescript
if (prof) {
  const newBadges = await checkAndAwardBadges(user.id, {
    streak_current: prof.streak_current,
    xp_total: prof.xp_total,
  })
  if (newBadges.length > 0) {
    setPendingBadges(newBadges)
  }
}
```

- [ ] **Step 4: Adicionar BadgeModal ao JSX**

Após o bloco `{levelUpData && (<LevelUpModal .../>)}`, adicionar:

```tsx
{pendingBadges.length > 0 && (
  <BadgeModal
    badges={pendingBadges}
    onClose={() => setPendingBadges(prev => prev.slice(1))}
  />
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/hoje/page.tsx
git commit -m "feat: show BadgeModal when new achievements are earned"
```

---

### Task 2.3: Streak Recovery — SQL + supabase.ts

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Executar migração SQL no Supabase**

No painel do Supabase → SQL Editor, executar:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_used_week TEXT;
```

- [ ] **Step 2: Adicionar funções de streak recovery ao supabase.ts**

No final do ficheiro `src/lib/supabase.ts`, adicionar:

```typescript
// ── Streak Recovery (freeze semanal) ───────────────────────

/** Semana ISO no formato YYYY-Www (ex: 2026-W15) */
function currentISOWeek(): string {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const week = Math.ceil(((now.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Verifica se o utilizador pode usar o streak freeze.
 * Condições: streak atual = 0, streak_best > 0,
 *            último log de hábito foi ontem ou hoje,
 *            freeze ainda não usado esta semana.
 */
export async function canClaimStreakRecovery(userId: string): Promise<boolean> {
  const { data: prof } = await supabase
    .from('profiles')
    .select('streak_current, streak_best, streak_freeze_used_week')
    .eq('id', userId)
    .single()

  if (!prof) return false
  if (prof.streak_current > 0) return false
  if (!prof.streak_best || prof.streak_best === 0) return false
  if (prof.streak_freeze_used_week === currentISOWeek()) return false

  // Verificar se teve atividade nos últimos 2 dias
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 2)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('date', cutoffStr)
    .limit(1)

  return (logs ?? []).length > 0
}

/**
 * Aplica o streak freeze: restaura o streak para 1 e marca a semana como usada.
 */
export async function claimStreakRecovery(userId: string): Promise<boolean> {
  const canRecover = await canClaimStreakRecovery(userId)
  if (!canRecover) return false

  const { error } = await supabase
    .from('profiles')
    .update({
      streak_current: 1,
      streak_freeze_used_week: currentISOWeek(),
    })
    .eq('id', userId)

  if (error) {
    reportError('claimStreakRecovery error', error.message)
    return false
  }
  return true
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add canClaimStreakRecovery and claimStreakRecovery to supabase"
```

---

### Task 2.4: Atualizar StreakRecovery.tsx com botão de freeze

**Files:**
- Modify: `src/components/StreakRecovery.tsx`

- [ ] **Step 1: Adicionar prop canRecover e onRecover**

Substituir o conteúdo completo do ficheiro:

```typescript
'use client'
// src/components/StreakRecovery.tsx

interface Props {
  prevBest: number
  canRecover: boolean
  onRecover: () => void
  onDismiss: () => void
  onCheckin: () => void
}

export default function StreakRecovery({ prevBest, canRecover, onRecover, onDismiss, onCheckin }: Props) {
  return (
    <div style={{
      margin: '12px 20px 0',
      padding: '18px 16px',
      borderRadius: 18,
      background: 'var(--bg2)',
      border: '0.5px solid rgba(232,168,56,.25)',
      position: 'relative',
    }}>
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute', top: 12, right: 12,
          width: 26, height: 26, borderRadius: 8,
          background: 'var(--bg3)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text3)', fontSize: 14, lineHeight: 1,
        }}>
        ×
      </button>

      <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>

      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--text1)', marginBottom: 8, lineHeight: 1.3 }}>
        Ontem não aconteceu.<br />Hoje é o Dia 1.
      </div>

      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
        O teu melhor streak foi de{' '}
        <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{prevBest} dias</span>.
        {' '}Isso não desapareceu — está guardado em ti.
      </p>

      <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

      {canRecover && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
            Tens 1 freeze disponível esta semana:
          </div>
          <button
            onClick={onRecover}
            style={{
              width: '100%', background: 'var(--gold)', color: 'var(--bg0)',
              border: 'none', borderRadius: 12, padding: '12px',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', marginBottom: 8,
            }}>
            🧊 Usar freeze — recuperar streak
          </button>
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
        </>
      )}

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        Próximo passo — uma acção, agora:
      </div>
      <button
        onClick={onCheckin}
        style={{
          width: '100%', background: 'var(--bg3)', color: 'var(--text1)',
          border: '0.5px solid var(--border)', borderRadius: 12, padding: '12px',
          fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13,
          cursor: 'pointer',
        }}>
        Fazer o check-in da manhã →
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StreakRecovery.tsx
git commit -m "feat: add freeze recovery button to StreakRecovery component"
```

---

### Task 2.5: Ligar streak recovery em hoje/page.tsx

**Files:**
- Modify: `src/app/hoje/page.tsx`

- [ ] **Step 1: Adicionar imports**

Adicionar `canClaimStreakRecovery` e `claimStreakRecovery` ao import de supabase:

```typescript
import {
  supabase,
  getProfile,
  getHabitsWithLogs,
  addXP,
  updateStreak,
  getDynamicWeeklyChallenge,
  getCheckinsForDate,
  checkAndAwardBadges,
  claimLoginBonus,
  canClaimStreakRecovery,
  claimStreakRecovery,
} from '@/lib/supabase'
```

- [ ] **Step 2: Adicionar estado canRecover**

Após `const [showRecovery, setShowRecovery] = useState(false)`, adicionar:

```typescript
const [canRecover, setCanRecover] = useState(false)
```

- [ ] **Step 3: Verificar canRecover no load**

Localizar o bloco onde `setShowRecovery(true)` é chamado (linha ~86):

```typescript
if (prof && prof.streak_current === 0 && prof.streak_best > 0) setShowRecovery(true)
```

Substituir por:

```typescript
if (prof && prof.streak_current === 0 && prof.streak_best > 0) {
  setShowRecovery(true)
  const canRec = await canClaimStreakRecovery(user.id)
  setCanRecover(canRec)
}
```

- [ ] **Step 4: Adicionar handler de recovery**

Após `function handleSwapChallenge()`, adicionar:

```typescript
async function handleStreakRecover() {
  if (!userId) return
  const success = await claimStreakRecovery(userId)
  if (success) {
    setShowRecovery(false)
    setCanRecover(false)
    const updated = await getProfile(userId)
    if (updated) setProfile(updated)
  }
}
```

- [ ] **Step 5: Passar props para StreakRecovery no JSX**

Localizar o bloco JSX de StreakRecovery (~linha 184) e substituir por:

```tsx
{showRecovery && profile && (
  <StreakRecovery
    prevBest={profile.streak_best}
    canRecover={canRecover}
    onRecover={handleStreakRecover}
    onDismiss={() => setShowRecovery(false)}
    onCheckin={() => { window.location.href = '/checkin' }}
  />
)}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/hoje/page.tsx
git commit -m "feat: wire streak freeze recovery in hoje page"
```

---

## FASE 3 — CSV Import para Finanças

### Task 3.1: Criar csv-parser.ts

**Files:**
- Create: `src/lib/csv-parser.ts`

- [ ] **Step 1: Criar o ficheiro**

```typescript
// src/lib/csv-parser.ts

export type CsvRow = Record<string, string>

export type ParsedCsvResult = {
  headers: string[]
  rows: CsvRow[]
  separator: ',' | ';'
}

/** Deteta separador dominante na primeira linha */
function detectSeparator(firstLine: string): ',' | ';' {
  const commas     = (firstLine.match(/,/g) ?? []).length
  const semicolons = (firstLine.match(/;/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}

/** Parseia CSV respeitando campos entre aspas */
function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

/** Normaliza valor monetário: "1.234,56" → 1234.56 | "1234.56" → 1234.56 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '')
  // Formato europeu: 1.234,56
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  // Formato com vírgula decimal: 1234,56
  if (/^\d+,\d+$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'))
  }
  return parseFloat(cleaned) || 0
}

/** Normaliza data: DD/MM/YYYY ou YYYY-MM-DD → YYYY-MM-DD */
export function parseDate(value: string): string {
  const dmY = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2,'0')}-${dmY[1].padStart(2,'0')}`
  const ymd = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`
  return value
}

/** Infere tipo (entrada/saida) a partir de texto ou sinal do valor */
export function inferType(typeField: string, amount: number): 'entrada' | 'saida' {
  const norm = typeField.toLowerCase()
  if (norm.includes('entrada') || norm.includes('receita') || norm.includes('credit')) return 'entrada'
  if (norm.includes('saida') || norm.includes('saída') || norm.includes('despesa') || norm.includes('debit')) return 'saida'
  return amount >= 0 ? 'entrada' : 'saida'
}

/** Tenta encontrar coluna por lista de candidatos (case-insensitive) */
function findCol(headers: string[], candidates: string[]): string | null {
  const norm = headers.map(h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  for (const c of candidates) {
    const idx = norm.indexOf(c)
    if (idx >= 0) return headers[idx]
  }
  return null
}

export type CsvColumnMap = {
  date:        string | null
  amount:      string | null
  type:        string | null
  category:    string | null
  description: string | null
}

/** Deteta mapeamento de colunas automaticamente */
export function detectColumnMap(headers: string[]): CsvColumnMap {
  return {
    date:        findCol(headers, ['data', 'date', 'dia']),
    amount:      findCol(headers, ['valor', 'amount', 'montante', 'quantia', 'value']),
    type:        findCol(headers, ['tipo', 'type', 'movimento', 'natureza']),
    category:    findCol(headers, ['categoria', 'category', 'descricao_categoria']),
    description: findCol(headers, ['descricao', 'description', 'descr', 'historico', 'memo', 'obs']),
  }
}

/** Parseia texto CSV completo e retorna headers + rows */
export function parseCsvText(text: string): ParsedCsvResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length === 0) return { headers: [], rows: [], separator: ',' }

  const sep = detectSeparator(lines[0])
  const headers = parseCsvLine(lines[0], sep)
  const rows = lines.slice(1).map(line => {
    const values = parseCsvLine(line, sep)
    const row: CsvRow = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  }).filter(row => Object.values(row).some(v => v.trim()))

  return { headers, rows, separator: sep }
}

export type TransactionCandidate = {
  date:        string
  amount:      number
  type:        'entrada' | 'saida'
  category:    string
  description: string
}

/** Converte rows parseados em TransactionCandidates usando o mapa de colunas */
export function rowsToTransactions(
  rows: CsvRow[],
  map: CsvColumnMap,
): TransactionCandidate[] {
  return rows.map(row => {
    const rawAmount = map.amount ? (row[map.amount] ?? '0') : '0'
    const amount    = Math.abs(parseAmount(rawAmount))
    const rawType   = map.type ? (row[map.type] ?? '') : ''
    const type      = inferType(rawType, parseAmount(rawAmount))

    return {
      date:        parseDate(map.date        ? (row[map.date]        ?? '') : ''),
      amount,
      type,
      category:    map.category    ? (row[map.category]    ?? 'Outro') : 'Outro',
      description: map.description ? (row[map.description] ?? '')      : '',
    }
  }).filter(t => t.amount > 0 && t.date)
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/csv-parser.ts
git commit -m "feat: add robust CSV parser with auto-detection of columns and formats"
```

---

### Task 3.2: Atualizar financas/page.tsx com preview de CSV

**Files:**
- Modify: `src/app/financas/page.tsx`

- [ ] **Step 1: Adicionar imports**

No topo de `src/app/financas/page.tsx`, após os imports existentes, adicionar:

```typescript
import {
  parseCsvText, detectColumnMap, rowsToTransactions,
  type CsvColumnMap, type TransactionCandidate,
} from '@/lib/csv-parser'
import { saveTransactionsBulk } from '@/lib/supabase'
```

- [ ] **Step 2: Adicionar estados de preview CSV**

Após `const csvRef = useRef<HTMLInputElement>(null)`, adicionar:

```typescript
const [csvPreview, setCsvPreview]   = useState<TransactionCandidate[] | null>(null)
const [csvImporting, setCsvImporting] = useState(false)
```

- [ ] **Step 3: Substituir função importCSV**

Localizar e substituir a função `importCSV` completa (linhas ~162-179) por:

```typescript
function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file || !userId) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = ev.target?.result as string
    const { headers, rows } = parseCsvText(text)
    if (rows.length === 0) { showToast('CSV sem dados reconhecidos.'); return }
    const map = detectColumnMap(headers)
    const candidates = rowsToTransactions(rows, map)
    if (candidates.length === 0) { showToast('Não foi possível interpretar o CSV. Verifica o formato.'); return }
    setCsvPreview(candidates)
  }
  reader.readAsText(file, 'UTF-8')
  e.target.value = ''
}

async function confirmCsvImport() {
  if (!csvPreview || !userId) return
  setCsvImporting(true)
  const payloads = csvPreview.map(t => ({
    user_id:     userId,
    date:        t.date,
    type:        t.type,
    category:    t.category || 'Outro',
    amount:      t.amount,
    description: t.description || null,
  }))
  const { error } = await saveTransactionsBulk(payloads)
  if (error) { showToast('Erro ao importar transacções.'); setCsvImporting(false); return }
  const [r, h] = await Promise.all([
    getTransactions(userId, 2),
    getTransactionsByMonth(userId, 6),
  ])
  setTxs(r as Transaction[])
  setHistory(h as Transaction[])
  showToast(`${csvPreview.length} transacções importadas!`)
  setCsvPreview(null)
  setCsvImporting(false)
}
```

- [ ] **Step 4: Adicionar modal de preview CSV no JSX**

Antes do `return (` principal, adicionar o modal de preview. Localizar o bloco `{toast && ...}` e antes dele inserir:

```tsx
{csvPreview && (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
    zIndex: 9000, display: 'flex', alignItems: 'flex-end',
    padding: '0 0 0 0',
  }}>
    <div style={{
      background: 'var(--bg1)', borderRadius: '20px 20px 0 0',
      padding: '24px 20px', width: '100%', maxHeight: '80vh',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
        Pré-visualização — {csvPreview.length} transacções
      </div>
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {csvPreview.slice(0, 20).map((t, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 12px', background: 'var(--bg2)', borderRadius: 10,
            fontSize: 13,
          }}>
            <div>
              <span style={{ color: t.type === 'entrada' ? '#1D9E75' : '#E24B4A', fontWeight: 600 }}>
                {t.type === 'entrada' ? '+' : '-'}{fmt(t.amount)}
              </span>
              <span style={{ color: 'var(--text3)', marginLeft: 8 }}>{t.category}</span>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>{t.date}</span>
          </div>
        ))}
        {csvPreview.length > 20 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: 8 }}>
            +{csvPreview.length - 20} mais...
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => setCsvPreview(null)}
          style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text2)', border: 'none', borderRadius: 12, padding: 13, fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button
          onClick={confirmCsvImport}
          disabled={csvImporting}
          style={{ flex: 2, background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 12, padding: 13, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: csvImporting ? .6 : 1 }}
        >
          {csvImporting ? 'A importar...' : `Importar ${csvPreview.length} transacções`}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/financas/page.tsx
git commit -m "feat: add CSV preview and robust import to financas page"
```

---

## FASE 4 — Parser de Corpo com Revisão Manual

### Task 4.1: Melhorar body-plan.ts

**Files:**
- Modify: `src/lib/body-plan.ts`

- [ ] **Step 1: Expandir TRAINING_NOISE_PATTERNS**

Localizar `const TRAINING_NOISE_PATTERNS` e substituir por:

```typescript
const TRAINING_NOISE_PATTERNS = [
  /^exerc/i,
  /^series?$/i,
  /^repet/i,
  /^descanso$/i,
  /^rpe$/i,
  /^tempo$/i,
  /^tecnica$/i,
  /^t[eé]cnicas?/i,
  /^sigla/i,
  /^significado$/i,
  /^observa/i,
  /^carga$/i,
  /^check$/i,
  /^ok$/i,
  /^pendente$/i,
  /^s[eé]t?s?$/i,
  /^reps?$/i,
  /^rest$/i,
  /^peso$/i,
  /^notas?$/i,
  /^comments?$/i,
  /^info$/i,
  /^\d+[\s\.]+$/,
  /^[-–—]+$/,
  /^[A-Z]{1,4}$/,    // Siglas puras (RPE, RM, RIR, etc.)
  /^\d+%$/,          // Percentagens sozinhas
  /^(seg|ter|qua|qui|sex|sab|dom)\.?$/i, // Abreviações de dias
]
```

- [ ] **Step 2: Melhorar isLikelySection com scoring**

Localizar a função `isLikelySection` e substituir por:

```typescript
function isLikelySection(line: string): boolean {
  const normalized = normalizeText(line)
  if (!normalized || normalized.length < 2) return false

  let score = 0

  // Marcador explícito de dia/grupo muscular
  if (TRAINING_SECTION_MARKERS.test(normalized)) score += 3

  // Linha curta e sem detalhes métricos
  if (normalized.length <= 28) score += 1
  if (normalized.split(' ').length <= 4) score += 1

  // Sem números de séries/reps (indício de que é secção, não exercício)
  if (!/\d+\s*x\s*\d+/.test(normalized)) score += 1

  // Só letras e espaços (sem siglas numéricas)
  if (/^[a-z\s]+$/.test(normalized)) score += 1

  // Penalizar se parece detalhe de exercício
  if (TRAINING_DETAIL_HINT.test(normalized)) score -= 3

  return score >= 3
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/body-plan.ts
git commit -m "feat: improve training plan parser with scoring and expanded noise filters"
```

---

### Task 4.2: Criar PlanReviewModal.tsx

**Files:**
- Create: `src/components/PlanReviewModal.tsx`

- [ ] **Step 1: Criar o ficheiro**

```typescript
// src/components/PlanReviewModal.tsx
'use client'
import { useState } from 'react'
import type { ParsedTrainingPlan, ParsedDietPlan, TrainingSectionPlan, DietMealPlan } from '@/lib/body-plan'

type Mode = 'training' | 'diet'

interface Props {
  mode: Mode
  plan: ParsedTrainingPlan | ParsedDietPlan
  onConfirm: (plan: ParsedTrainingPlan | ParsedDietPlan) => void
  onCancel: () => void
}

export default function PlanReviewModal({ mode, plan, onConfirm, onCancel }: Props) {
  const [editedPlan, setEditedPlan] = useState(plan)
  const [editingItem, setEditingItem] = useState<{ sectionIdx: number; itemIdx: number } | null>(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(sectionIdx: number, itemIdx: number, currentValue: string) {
    setEditingItem({ sectionIdx, itemIdx })
    setEditValue(currentValue)
  }

  function commitEdit() {
    if (!editingItem) return
    const { sectionIdx, itemIdx } = editingItem
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: s.exercises.map((e, ei) =>
            ei !== itemIdx ? e : { ...e, name: editValue }
          ),
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : {
          ...m,
          items: m.items.map((item, ii) => ii !== itemIdx ? item : editValue),
        }
      )
      setEditedPlan({ ...p, meals })
    }
    setEditingItem(null)
    setEditValue('')
  }

  function deleteItem(sectionIdx: number, itemIdx: number) {
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: s.exercises.filter((_, ei) => ei !== itemIdx),
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : {
          ...m,
          items: m.items.filter((_, ii) => ii !== itemIdx),
        }
      )
      setEditedPlan({ ...p, meals })
    }
  }

  function addItem(sectionIdx: number) {
    const name = prompt(mode === 'training' ? 'Nome do exercício:' : 'Item:')
    if (!name?.trim()) return
    if (mode === 'training') {
      const p = editedPlan as ParsedTrainingPlan
      const sections = p.sections.map((s, si) =>
        si !== sectionIdx ? s : {
          ...s,
          exercises: [...s.exercises, { id: `manual-${Date.now()}`, name: name.trim() }],
        }
      )
      setEditedPlan({ ...p, sections })
    } else {
      const p = editedPlan as ParsedDietPlan
      const meals = p.meals.map((m, mi) =>
        mi !== sectionIdx ? m : { ...m, items: [...m.items, name.trim()] }
      )
      setEditedPlan({ ...p, meals })
    }
  }

  const sections: Array<{ title: string; items: string[] }> = mode === 'training'
    ? (editedPlan as ParsedTrainingPlan).sections.map(s => ({
        title: s.title,
        items: s.exercises.map(e => e.detail ? `${e.name} — ${e.detail}` : e.name),
      }))
    : (editedPlan as ParsedDietPlan).meals.map(m => ({
        title: m.label,
        items: m.items,
      }))

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)',
      zIndex: 9500, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 16px',
        background: 'var(--bg1)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>
            Rever {mode === 'training' ? 'Treino' : 'Dieta'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {sections.length} secções · {totalItems} itens
          </div>
        </div>
        <button onClick={onCancel} style={{
          background: 'var(--bg3)', border: 'none', borderRadius: 8,
          color: 'var(--text2)', fontSize: 18, width: 32, height: 32,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sections.map((section, si) => (
          <div key={si} style={{
            background: 'var(--bg2)', borderRadius: 14,
            border: '0.5px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 14px',
              borderBottom: '0.5px solid var(--border)',
              fontFamily: 'Syne, sans-serif', fontWeight: 700,
              fontSize: 13, color: 'var(--gold)',
            }}>
              {section.title}
            </div>
            {section.items.map((item, ii) => (
              <div key={ii} style={{
                padding: '9px 14px',
                borderBottom: ii < section.items.length - 1 ? '0.5px solid var(--border)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                {editingItem?.sectionIdx === si && editingItem?.itemIdx === ii ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingItem(null) }}
                    onBlur={commitEdit}
                    style={{
                      flex: 1, background: 'var(--bg3)', border: '0.5px solid var(--gold)',
                      borderRadius: 8, padding: '6px 10px', color: 'var(--text1)',
                      fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => startEdit(si, ii, mode === 'training'
                      ? (editedPlan as ParsedTrainingPlan).sections[si].exercises[ii].name
                      : item
                    )}
                    style={{ flex: 1, fontSize: 13, color: 'var(--text1)', cursor: 'text', lineHeight: 1.4 }}
                  >
                    {item}
                  </span>
                )}
                <button
                  onClick={() => deleteItem(si, ii)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text3)',
                    cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => addItem(si)}
              style={{
                width: '100%', background: 'none', border: 'none',
                color: 'var(--text3)', padding: '9px 14px', textAlign: 'left',
                fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer',
              }}
            >
              + Adicionar item
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 16px',
        background: 'var(--bg1)',
        borderTop: '0.5px solid var(--border)',
        display: 'flex', gap: 10,
      }}>
        <button onClick={onCancel} style={{
          flex: 1, background: 'var(--bg3)', color: 'var(--text2)',
          border: 'none', borderRadius: 12, padding: 13,
          fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          Cancelar
        </button>
        <button onClick={() => onConfirm(editedPlan)} style={{
          flex: 2, background: 'var(--gold)', color: 'var(--bg0)',
          border: 'none', borderRadius: 12, padding: 13,
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          Confirmar e Guardar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanReviewModal.tsx
git commit -m "feat: add PlanReviewModal for editing imports before saving"
```

---

### Task 4.3: Integrar PlanReviewModal em corpo/page.tsx

**Files:**
- Modify: `src/app/corpo/page.tsx`

- [ ] **Step 1: Adicionar imports**

No topo de `src/app/corpo/page.tsx`, adicionar:

```typescript
import PlanReviewModal from '@/components/PlanReviewModal'
import type { ParsedTrainingPlan, ParsedDietPlan } from '@/lib/body-plan'
```

- [ ] **Step 2: Adicionar estado para review**

Após `const [saving, setSaving] = useState(false)`, adicionar:

```typescript
const [trainingReview, setTrainingReview] = useState<{ result: FileImportResult; parsed: ParsedTrainingPlan } | null>(null)
const [dietReview,     setDietReview]     = useState<{ result: FileImportResult; parsed: ParsedDietPlan } | null>(null)
```

- [ ] **Step 3: Modificar handleTrainingImport para abrir review**

Substituir a função `handleTrainingImport` completa por:

```typescript
async function handleTrainingImport(result: FileImportResult) {
  if (!userId) return
  const parsedPlan = parseTrainingImport(result)
  setTrainingReview({ result, parsed: parsedPlan })
  setShowTrainingImport(false)
}

async function confirmTrainingImport(confirmed: ParsedTrainingPlan | ParsedDietPlan) {
  if (!userId || !trainingReview) return
  const parsedPlan = confirmed as ParsedTrainingPlan
  const summary = parsedPlan.summary || getImportSummary(trainingReview.result)

  const { error } = await saveTrainingPlan({
    user_id: userId,
    title: `Treino importado · ${trainingReview.result.meta.fileName}`,
    source_type: trainingReview.result.kind,
    source_file_name: trainingReview.result.meta.fileName,
    summary,
    raw_content: { ...trainingReview.result, parsedPlan },
  })

  if (error) { showToast('Erro ao guardar treino.'); return }
  setTrainingReview(null)
  await loadBodyData(userId)
  showToast('Plano de treino importado!')
}
```

- [ ] **Step 4: Modificar handleDietImport para abrir review**

Substituir a função `handleDietImport` completa por:

```typescript
async function handleDietImport(result: FileImportResult) {
  if (!userId) return
  const parsedPlan = parseDietImport(result)
  setDietReview({ result, parsed: parsedPlan })
  setShowDietImport(false)
}

async function confirmDietImport(confirmed: ParsedTrainingPlan | ParsedDietPlan) {
  if (!userId || !dietReview) return
  const parsedPlan = confirmed as ParsedDietPlan
  const summary = parsedPlan.summary || getImportSummary(dietReview.result)

  const { error } = await saveDietPlan({
    user_id: userId,
    title: `Dieta importada · ${dietReview.result.meta.fileName}`,
    source_type: dietReview.result.kind,
    source_file_name: dietReview.result.meta.fileName,
    summary,
    raw_content: { ...dietReview.result, parsedPlan },
  })

  if (error) { showToast('Erro ao guardar dieta.'); return }
  setDietReview(null)
  await loadBodyData(userId)
  showToast('Plano de dieta importado!')
}
```

- [ ] **Step 5: Adicionar modais de review ao JSX**

No final do JSX principal (antes do `</main>` de fecho), adicionar:

```tsx
{trainingReview && (
  <PlanReviewModal
    mode="training"
    plan={trainingReview.parsed}
    onConfirm={confirmTrainingImport}
    onCancel={() => setTrainingReview(null)}
  />
)}
{dietReview && (
  <PlanReviewModal
    mode="diet"
    plan={dietReview.parsed}
    onConfirm={confirmDietImport}
    onCancel={() => setDietReview(null)}
  />
)}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/corpo/page.tsx
git commit -m "feat: show PlanReviewModal before saving training and diet imports"
```

---

## Verificação Final

- [ ] **Iniciar servidor de desenvolvimento**

```bash
npm run dev
```

- [ ] **Testar Fase 1:** Simular erro de rede no Supabase → verificar toast vermelho no ecrã

- [ ] **Testar Fase 2:** Ganhar um badge no check-in → verificar modal de conquista

- [ ] **Testar Fase 3:** Importar CSV em Finanças → verificar preview antes de importar

- [ ] **Testar Fase 4:** Importar planilha ou PDF em Corpo → verificar modal de revisão com secções editáveis
