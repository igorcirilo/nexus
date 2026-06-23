'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { darkCardInk } from '@/lib/theme'
import { format, getISOWeek, subDays } from 'date-fns'
import { pt } from 'date-fns/locale'
import { parseLocalDate } from '@/lib/date'
import { getProfile } from '@/lib/supabase'
import { getTrainingEntries, getDietMeals, getWeightLogs, type WeightLog } from '@/lib/body'
import {
  summarizeDietDay,
  type ParsedTrainingPlan,
  type ParsedDietPlan,
  type DietDaySummary,
} from '@/lib/body-plan'
import type { TrainingPlan, DietPlan, DietMeal, Profile } from '@/types'

type BodyTab = 'resumo' | 'treino' | 'dieta' | 'peso'

const FONT = 'Inter, sans-serif'
const WATER_CUPS = 8

interface Props {
  userId: string
  today: string
  trainingPlans: TrainingPlan[]
  dietPlans: DietPlan[]
  onNavigate: (tab: BodyTab) => void
}

// ── helpers ──────────────────────────────────────────────────────
function fmt1(n: number) {
  return n.toFixed(1).replace('.', ',')
}
function fmtInt(n: number) {
  return Math.round(n).toLocaleString('pt-BR')
}
// Faixa de IMC em termos clínicos e neutros — dá contexto sem juízo de valor.
function imcFaixa(v: number) {
  if (v < 18.5) return 'abaixo'
  if (v < 25) return 'normal'
  if (v < 30) return 'acima'
  return 'alto'
}
function getTrainingParsed(plan: TrainingPlan | null): ParsedTrainingPlan | null {
  if (!plan) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedTrainingPlan } | null
  return raw?.parsedPlan ?? null
}
function getDietParsed(plan: DietPlan | null): ParsedDietPlan | null {
  if (!plan) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedDietPlan } | null
  return raw?.parsedPlan ?? null
}
function parseExercisesDone(notes: string | null | undefined): Record<string, boolean> {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes)
    if (parsed?.exercises && typeof parsed.exercises === 'object') {
      const out: Record<string, boolean> = {}
      for (const [id, val] of Object.entries(parsed.exercises)) {
        const ex = val as { done?: boolean; checked?: boolean }
        out[id] = ex.done ?? ex.checked ?? false
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}
function readSession(today: string): { planId: string; sectionIdx: number; sectionTitle: string } | null {
  try {
    const stored = sessionStorage.getItem(`nexus-corpo-${today}`)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

type WorkoutSummary = {
  hasSelection: boolean
  sectionTitle: string
  planTitle: string | null
  total: number
  done: number
  exercises: { id: string; name: string; detail: string; done: boolean }[]
}

export default function BodyHub({ userId, today, trainingPlans, dietPlans, onNavigate }: Props) {
  const [weights, setWeights] = useState<WeightLog[] | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [workout, setWorkout] = useState<WorkoutSummary | null>(null)
  const [dietMeals, setDietMeals] = useState<DietMeal[] | null>(null)
  const [waterFilled, setWaterFilled] = useState(0)

  const selectedDietPlan = dietPlans[0] ?? null
  const dietParsed = getDietParsed(selectedDietPlan)

  // weights + profile
  useEffect(() => {
    let active = true
    Promise.all([getWeightLogs(userId, 90), getProfile(userId)]).then(([w, p]) => {
      if (!active) return
      setWeights(w)
      setProfile((p as Profile) ?? null)
    })
    return () => {
      active = false
    }
  }, [userId])

  // treino de hoje
  useEffect(() => {
    let active = true
    async function load() {
      const session = readSession(today)
      const entries = (await getTrainingEntries(userId, today)) as Array<{
        training_plan_id: string
        notes: string | null
      }>
      if (!active) return
      if (!session) {
        setWorkout({ hasSelection: false, sectionTitle: '', planTitle: null, total: 0, done: 0, exercises: [] })
        return
      }
      const plan = trainingPlans.find((p) => p.id === session.planId) ?? null
      const parsed = getTrainingParsed(plan)
      const section = parsed?.sections[session.sectionIdx] ?? null
      const entry = entries.find((e) => e.training_plan_id === session.planId)
      const doneMap = parseExercisesDone(entry?.notes)
      const exercises = (section?.exercises ?? []).map((ex) => ({
        id: ex.id,
        name: ex.name,
        detail: ex.detail ?? '',
        done: doneMap[ex.id] ?? false,
      }))
      setWorkout({
        hasSelection: true,
        sectionTitle: session.sectionTitle || section?.title || 'Treino',
        planTitle: plan?.title ?? null,
        total: exercises.length,
        done: exercises.filter((e) => e.done).length,
        exercises,
      })
    }
    load()
    return () => {
      active = false
    }
  }, [userId, today, trainingPlans])

  // dieta de hoje
  useEffect(() => {
    let active = true
    getDietMeals(userId, today).then((m) => {
      if (active) setDietMeals(m as DietMeal[])
    })
    return () => {
      active = false
    }
  }, [userId, today])

  // água (localStorage por dia)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`nexus-corpo-water-${today}`)
      setWaterFilled(raw ? Math.min(WATER_CUPS, Math.max(0, parseInt(raw, 10) || 0)) : 0)
    } catch {
      setWaterFilled(0)
    }
  }, [today])

  function setWater(n: number) {
    const next = Math.min(WATER_CUPS, Math.max(0, n))
    setWaterFilled(next)
    try {
      localStorage.setItem(`nexus-corpo-water-${today}`, String(next))
    } catch {
      /* ignore */
    }
  }

  const diet: DietDaySummary = summarizeDietDay(dietParsed, dietMeals ?? [], selectedDietPlan?.id ?? null)

  // ── derived: peso / hero ──────────────────────────────────────
  const latest = weights && weights.length ? weights[weights.length - 1] : null
  const monthAgoDate = format(subDays(parseLocalDate(today), 30), 'yyyy-MM-dd')
  const monthBase = weights?.find((w) => w.date >= monthAgoDate) ?? weights?.[0] ?? null
  const monthDelta =
    latest && monthBase && latest.id !== monthBase.id
      ? Number(latest.weight_kg) - Number(monthBase.weight_kg)
      : null
  const heightM = profile?.height_cm ? Number(profile.height_cm) / 100 : null
  const imc = latest && heightM ? Number(latest.weight_kg) / (heightM * heightM) : null
  const goalWeight = profile?.goal_weight ?? null

  const chartWeights = (weights ?? []).slice(-7).map((w) => Number(w.weight_kg))
  const chartMin = chartWeights.length ? Math.min(...chartWeights) : 0
  const chartMax = chartWeights.length ? Math.max(...chartWeights) : 1
  const chartRange = chartMax - chartMin || 1
  const bars = chartWeights.length
    ? chartWeights.map((w) => 35 + ((w - chartMin) / chartRange) * 60)
    : [40, 55, 48, 70, 60, 75, 65]

  // água
  const waterGoalL = (profile?.water_goal_ml ?? 3000) / 1000
  const perCupL = waterGoalL / WATER_CUPS
  const waterAmount = waterFilled * perCupL

  const headerSub = `${cap(format(parseLocalDate(today), 'EEEE', { locale: pt }))}, ${format(
    parseLocalDate(today),
    "d 'de' MMM",
    { locale: pt }
  )} · Semana ${getISOWeek(parseLocalDate(today))}`

  return (
    <div style={{ fontFamily: FONT, background: 'var(--surface-page)', minHeight: '100vh', padding: '0 22px 28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 6px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>Corpo</div>
          <div style={{ fontSize: 13, color: 'rgba(var(--ink-rgb),0.4)', fontWeight: 500, marginTop: 2 }}>{headerSub}</div>
        </div>
        <button
          onClick={() => onNavigate('treino')}
          aria-label="Adicionar"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(var(--ink-rgb),0.05)',
            border: '1px solid rgba(var(--ink-rgb),0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(var(--ink-rgb),0.6)',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Body Hero */}
      <div
        onClick={() => onNavigate('peso')}
        style={{
          ...darkCardInk,
          background: 'linear-gradient(135deg, #0A1A12 0%, #051408 100%)',
          border: '1px solid rgba(0,200,150,0.2)',
          borderRadius: 24,
          padding: '22px 22px 20px',
          marginBottom: 14,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -20,
            width: 140,
            height: 140,
            background: 'radial-gradient(circle, rgba(0,200,150,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18, position: 'relative' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-1.5px', lineHeight: 1 }}>
              {latest ? fmt1(Number(latest.weight_kg)) : '--'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(var(--ink-rgb),0.4)', fontWeight: 500, marginTop: 2 }}>kg · Peso atual</div>
            {monthDelta !== null && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(var(--ink-rgb),0.06)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(var(--ink-rgb),0.7)',
                  marginTop: 8,
                }}
              >
                {/* Seta indica só a direção — sem cor de "bom/mau". O corpo muda em ambos os sentidos. */}
                {Math.abs(monthDelta) >= 0.1 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {monthDelta < 0 ? <polyline points="6 9 12 15 18 9" /> : <polyline points="6 15 12 9 18 15" />}
                  </svg>
                )}
                {Math.abs(monthDelta) < 0.1 ? 'estável este mês' : `${fmt1(Math.abs(monthDelta))} kg este mês`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <HeroStat value={imc ? fmt1(imc) : '--'} label={imc ? `IMC · ${imcFaixa(imc)}` : 'IMC'} />
            <HeroStat value={goalWeight ? `${fmt1(Number(goalWeight))} kg` : '--'} label="Meta" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 32, position: 'relative' }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}%`,
                borderRadius: '3px 3px 0 0',
                background: i === bars.length - 1 ? '#00C896' : 'rgba(0,200,150,0.2)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Treino */}
      <SectionLabel>Treino de hoje</SectionLabel>
      <div
        onClick={() => onNavigate('treino')}
        style={{
          background: 'rgba(var(--ink-rgb),0.03)',
          border: '1px solid rgba(var(--ink-rgb),0.07)',
          borderRadius: 20,
          padding: '18px 20px',
          marginBottom: 14,
          cursor: 'pointer',
        }}
      >
        {workout?.hasSelection ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  {workout.planTitle && (
                    <span style={tagStyle('#9D5CF5', 'rgba(157,92,245,0.12)')}>{truncate(workout.planTitle, 22)}</span>
                  )}
                  {workout.total > 0 && workout.done === workout.total && (
                    <span style={tagStyle('#00C896', 'rgba(0,200,150,0.12)')}>✓ Concluído</span>
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{workout.sectionTitle}</div>
                <div style={{ fontSize: 13, color: 'rgba(var(--ink-rgb),0.45)', marginTop: 2 }}>
                  {workout.total} exercícios · {workout.done} concluídos
                </div>
              </div>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: 'rgba(0,200,150,0.12)',
                  border: '2px solid #00C896',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#00C896',
                  fontSize: workout.done === workout.total && workout.total > 0 ? 16 : 12,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {workout.total > 0 && workout.done === workout.total ? '✓' : `${workout.done}/${workout.total}`}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {workout.exercises.slice(0, 4).map((ex) => (
                <div
                  key={ex.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'rgba(var(--ink-rgb),0.03)',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(var(--ink-rgb),0.85)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ex.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {ex.detail && <div style={{ fontSize: 12, color: 'rgba(var(--ink-rgb),0.35)' }}>{ex.detail}</div>}
                    {ex.done && <div style={{ color: '#00C896', fontSize: 14, fontWeight: 700 }}>✓</div>}
                  </div>
                </div>
              ))}
              {workout.total > 4 && (
                <div style={{ fontSize: 12, color: 'rgba(var(--ink-rgb),0.3)', textAlign: 'center', paddingTop: 2 }}>
                  +{workout.total - 4} exercícios
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Nenhum treino selecionado</div>
              <div style={{ fontSize: 13, color: 'rgba(var(--ink-rgb),0.45)', marginTop: 2 }}>Escolhe o treino de hoje</div>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(157,92,245,0.12)',
                border: '2px solid #9D5CF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9D5CF5',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Nutrição */}
      <SectionLabel>Nutrição de hoje</SectionLabel>
      {dietParsed ? (
        <div
          onClick={() => onNavigate('dieta')}
          style={{ display: 'flex', gap: 10, marginBottom: 4, cursor: 'pointer' }}
        >
          <MacroCard
            color="#F5C842"
            value={fmtInt(diet.kcalSelected)}
            unit={`/ ${fmtInt(diet.kcalPlan)} kcal`}
            name="Calorias"
            pct={pctOf(diet.kcalSelected, diet.kcalPlan)}
          />
          <MacroCard
            color="#00C896"
            value={`${fmtInt(diet.macrosSelected.proteinas)} g`}
            unit={`/ ${fmtInt(diet.macrosPlan.proteinas)} g meta`}
            name="Proteína"
            pct={pctOf(diet.macrosSelected.proteinas, diet.macrosPlan.proteinas)}
          />
          <MacroCard
            color="#9D5CF5"
            value={`${fmtInt(diet.macrosSelected.carboidratos)} g`}
            unit={`/ ${fmtInt(diet.macrosPlan.carboidratos)} g meta`}
            name="Carb."
            pct={pctOf(diet.macrosSelected.carboidratos, diet.macrosPlan.carboidratos)}
          />
        </div>
      ) : (
        <div
          onClick={() => onNavigate('dieta')}
          style={{
            background: 'rgba(var(--ink-rgb),0.03)',
            border: '1px solid rgba(var(--ink-rgb),0.07)',
            borderRadius: 16,
            padding: '18px 20px',
            marginBottom: 4,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Sem plano alimentar</div>
            <div style={{ fontSize: 12, color: 'rgba(var(--ink-rgb),0.4)', marginTop: 2 }}>Importa um plano para acompanhar</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}

      {/* Hidratação */}
      <SectionLabel style={{ marginTop: 18 }}>Hidratação</SectionLabel>
      <div
        style={{
          background: 'rgba(0,180,220,0.05)',
          border: '1px solid rgba(0,180,220,0.15)',
          borderRadius: 20,
          padding: '18px 20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Água</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#00B4DC' }}>
            {fmt1(waterAmount)} / {fmt1(waterGoalL)} L
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {Array.from({ length: WATER_CUPS }).map((_, i) => {
            const filled = i < waterFilled
            return (
              <button
                key={i}
                onClick={() => setWater(waterFilled === i + 1 ? i : i + 1)}
                aria-label={`${i + 1} copos de água`}
                style={{
                  width: 36,
                  height: 42,
                  borderRadius: 8,
                  border: `1.5px solid ${filled ? 'rgba(0,180,220,0.6)' : 'rgba(0,180,220,0.25)'}`,
                  background: 'transparent',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {filled && (
                  <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, background: 'rgba(0,180,220,0.3)' }} />
                )}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={filled ? '#00B4DC' : 'none'}
                  stroke={filled ? '#00B4DC' : 'rgba(var(--ink-rgb),0.18)'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'relative', zIndex: 1 }}
                >
                  <path d="M12 2.7c3.5 4 6 7 6 10.3a6 6 0 0 1-12 0c0-3.3 2.5-6.3 6-10.3z" />
                </svg>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── small components / helpers ───────────────────────────────────

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}
function pctOf(a: number, b: number) {
  return b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0
}
function tagStyle(color: string, bg: string): CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: bg,
    color,
    borderRadius: 6,
    padding: '3px 7px',
  }
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        background: 'rgba(var(--ink-rgb),0.04)',
        border: '1px solid rgba(var(--ink-rgb),0.07)',
        borderRadius: 14,
        padding: '10px 14px',
        textAlign: 'right',
        minWidth: 92,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(var(--ink-rgb),0.35)', fontWeight: 500, marginTop: 1 }}>{label}</div>
    </div>
  )
}

function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'rgba(var(--ink-rgb),0.3)',
        marginBottom: 10,
        marginTop: 18,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function MacroCard({ color, value, unit, name, pct }: { color: string; value: string; unit: string; name: string; pct: number }) {
  return (
    <div
      style={{
        flex: 1,
        background: 'rgba(var(--ink-rgb),0.04)',
        border: '1px solid rgba(var(--ink-rgb),0.07)',
        borderRadius: 16,
        padding: '14px 12px',
        minWidth: 0,
      }}
    >
      <div style={{ height: 4, borderRadius: 4, marginBottom: 8, width: `${pct}%`, minWidth: 8, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(var(--ink-rgb),0.4)', fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{unit}</div>
      <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.3)', fontWeight: 500, marginTop: 4 }}>{name}</div>
    </div>
  )
}
