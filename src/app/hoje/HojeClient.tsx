'use client'

import { useEffect, useState } from 'react'
import { todayISO, phaseForHour } from '@/lib/date'
import Nav from '@/components/Nav'
import RitmoBar from '@/components/RitmoBar'
import FeedbackToast, { triggerToast } from '@/components/FeedbackToast'
import AvatarXP from '@/components/AvatarXP'
import NightSummaryCard from '@/components/NightSummaryCard'
import LevelUpModal from '@/components/LevelUpModal'
import BadgeModal from '@/components/BadgeModal'
import EmptyState from '@/components/EmptyState'
import AddTaskSheet from '@/components/hoje/AddTaskSheet'
import ProactiveAssistant from '@/components/hoje/ProactiveAssistant'
import MetricsGrid from '@/components/hoje/MetricsGrid'
import TodayHabitList, { type TodayHabitView } from '@/components/hoje/TodayHabitList'
import Icon from '@/components/ui/Icon'
import {
  getProfile,
  getRitmo,
  updateStreak,
  getCheckinsForDate,
  getHabitsWithLogs,
  toggleHabitLog,
  createHabitQuick,
  checkAndAwardBadges,
  canClaimStreakRecovery,
  claimStreakRecovery,
  getGoals90,
  getAgendaEvents,
  supabase,
} from '@/lib/supabase'
import type { AgendaEvent } from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import { buildDayPlan } from '@/lib/day-planner'
import { detectPendencias } from '@/lib/pendencias'
import { getHojeMetrics } from '@/lib/hoje-metrics'
import type { HojeMetrics } from '@/lib/hoje-metrics'
import { repairMojibake } from '@/lib/text'
import { calculateScores } from '@/lib/profile-assessment'
import { suggestHabitLevel, generateHabitsFromAssessment } from '@/lib/assessment-to-habits'
import { AREA_META } from '@/types'
import type { Profile, Checkin, Habit, HabitArea, Answers, Goal90 } from '@/types'
import StreakRecovery from '@/components/StreakRecovery'

type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

const cleanDisplayText = repairMojibake

function seedProfile(initial: Profile | null, checkins: Checkin[]): Profile | null {
  if (!initial) return null
  const manhaCI = checkins.find((c) => c.phase === 'manha')
  return {
    ...initial,
    energy_today: manhaCI?.energy ?? initial.energy_today,
    mission_today: manhaCI?.mission ?? initial.mission_today,
  }
}

function isDone(h: HabitWithLog): boolean {
  return Boolean(h.habit_logs && h.habit_logs.length > 0 && h.habit_logs[0].completed)
}

interface HojeClientProps {
  userId: string
  serverToday: string
  initialProfile: Profile | null
  initialCheckins: Checkin[]
  initialHabits: HabitWithLog[]
  initialNoHabits: boolean
}

export default function HojeClient({
  userId,
  serverToday,
  initialProfile,
  initialCheckins,
  initialHabits,
  initialNoHabits,
}: HojeClientProps) {
  // Estado inicial vem do servidor → primeiro paint já com dados reais.
  const [profile, setProfile] = useState<Profile | null>(() => seedProfile(initialProfile, initialCheckins))
  const [ritmo, setRitmo] = useState(0)
  const [missionPct, setMissionPct] = useState(0)
  const [showRecovery, setShowRecovery] = useState(false)
  const [canRecover, setCanRecover] = useState(false)
  const [todayCheckins, setTodayCheckins] = useState<Checkin[]>(initialCheckins)
  const [habits, setHabits] = useState<HabitWithLog[]>(initialHabits)
  const [noHabits, setNoHabits] = useState(initialNoHabits)
  const [backfilling, setBackfilling] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addSaving, setAddSaving] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null)
  const [pendingBadges, setPendingBadges] = useState<{ key: string; name: string }[]>([])
  const [metrics, setMetrics] = useState<HojeMetrics | null>(null)
  const [goals, setGoals] = useState<Goal90[]>([])
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const today = todayISO()
  const hour = new Date().getHours()

  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Efeitos de gamificação (mutações) — correm uma vez no cliente, nunca no
  // render do servidor. Não bloqueiam a página: falhas só são registadas.
  useEffect(() => {
    let cancelled = false
    async function runSideEffects() {
      // Reconciliação de fuso: o servidor calcula "hoje" no SEU fuso (UTC em
      // produção). Se a data local do dispositivo diferir, recarrega os dados
      // sensíveis à data (check-ins + hábitos do dia).
      const dateMismatch = today !== serverToday
      if (dateMismatch) {
        const [freshCheckins, freshHabits] = await Promise.all([
          getCheckinsForDate(userId, today) as Promise<Checkin[]>,
          getHabitsWithLogs(userId, today) as Promise<HabitWithLog[]>,
        ])
        if (!cancelled) {
          setTodayCheckins(freshCheckins)
          setProfile((prev) => seedProfile(prev, freshCheckins))
          setHabits(freshHabits)
        }
      }

      // Recovery: avaliado a partir do perfil do SERVIDOR, antes de qualquer
      // atividade. A ofensiva já não é mexida ao abrir a app (ver P1.2), por
      // isso este sinal mantém-se fiel ao estado real do utilizador.
      if (initialProfile && initialProfile.streak_current === 0 && initialProfile.streak_best > 0) {
        setShowRecovery(true)
        setCanRecover(await canClaimStreakRecovery(userId))
      }

      const ritmoNow = await getRitmo(userId)
      if (!cancelled) setRitmo(ritmoNow)

      // Badges são idempotentes: recalculados a partir do estado REAL já
      // carregado (sem inflar a ofensiva). A ofensiva/level-up só avançam com
      // atividade real — ver handleToggleHabit e checkin/finish.
      if (initialProfile) {
        const newBadges = await checkAndAwardBadges(userId, {
          streak_current: initialProfile.streak_current,
          streak_best: initialProfile.streak_best,
          ritmo: ritmoNow,
        })
        if (!cancelled && newBadges.length > 0) setPendingBadges(newBadges)
      }
    }

    runSideEffects().catch((err) => console.error('[hoje] efeitos de gamificação falharam:', err))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dados do assistente (objetivos + agenda de hoje) e da grelha de métricas.
  useEffect(() => {
    let cancelled = false
    const now = new Date()
    Promise.all([
      getHojeMetrics(userId),
      getGoals90(userId),
      getAgendaEvents(userId, now.getFullYear(), now.getMonth() + 1),
    ])
      .then(([m, g, ev]) => {
        if (cancelled) return
        setMetrics(m)
        setGoals((g ?? []) as Goal90[])
        setEvents(((ev ?? []) as AgendaEvent[]).filter((e) => e.date === today))
      })
      .catch((err) => console.error('[hoje] métricas/assistente falharam:', err))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleStreakRecover() {
    const success = await claimStreakRecovery(userId)
    if (success) {
      setShowRecovery(false)
      setCanRecover(false)
      const updated = await getProfile(userId)
      if (updated) setProfile(updated as Profile)
    }
  }

  async function handleToggleHabit(id: string, done: boolean) {
    // Update otimista; o log usa a data local do dispositivo.
    const prevHabits = habits
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, habit_logs: [{ completed: done, date: today }] } : h)))
    const { error } = await toggleHabitLog(userId, id, today, done)
    if (error) {
      // Reverte o update otimista se a escrita falhar (P2.8).
      setHabits(prevHabits)
      triggerToast('Não foi possível guardar. Tenta de novo.')
      return
    }

    if (!done) {
      // Desmarcar não conta como atividade: não mexe na ofensiva.
      setRitmo(await getRitmo(userId))
      return
    }

    const h = prevHabits.find((x) => x.id === id)
    if (h) triggerToast(`${cleanDisplayText(h.name)} — feito`)

    // Atividade real concluída → avança a ofensiva e recalcula nível/badges.
    const prevLevel = profile?.level ?? 1
    await updateStreak(userId)
    const { data: streakFields } = await supabase
      .from('profiles')
      .select('streak_current, streak_best, streak_last_date, level, title')
      .eq('id', userId)
      .single()
    const ritmoNow = await getRitmo(userId)
    setRitmo(ritmoNow)

    if (streakFields) {
      setProfile((prev) => (prev ? { ...prev, ...streakFields } : prev))
      // Level-up: dispara a celebração só quando o nível realmente sobe (P2.1).
      if (streakFields.level > prevLevel) {
        setLevelUpData({ level: streakFields.level, title: streakFields.title })
      }
      const newBadges = await checkAndAwardBadges(userId, {
        streak_current: streakFields.streak_current,
        streak_best: streakFields.streak_best,
        ritmo: ritmoNow,
      })
      if (newBadges.length > 0) setPendingBadges(newBadges)
    }
  }

  async function handleCreateManualHabit(name: string, area: HabitArea) {
    setAddSaving(true)
    try {
      await createHabitQuick({ user_id: userId, name, area })
      const fresh = (await getHabitsWithLogs(userId, today)) as HabitWithLog[]
      setHabits(fresh)
      setNoHabits(fresh.length === 0)
      setAddOpen(false)
    } finally {
      setAddSaving(false)
    }
  }

  // Backfill para utilizadores legados (tinham programa, sem hábitos): gera os
  // hábitos a partir da última avaliação guardada.
  async function handleBackfill() {
    // Evita disparos concorrentes (duplo-clique) enquanto a geração corre.
    if (backfilling) return
    setBackfilling(true)
    try {
      const { data: assess } = await supabase
        .from('user_assessments')
        .select('id, responses')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!assess) {
        window.location.href = '/onboarding-v2'
        return
      }
      const answers = (assess.responses ?? {}) as Answers
      const scores = calculateScores(answers)
      const level = suggestHabitLevel(answers, scores)
      await generateHabitsFromAssessment(userId, assess.id as string, answers, level)
      const fresh = (await getHabitsWithLogs(userId, today)) as HabitWithLog[]
      setHabits(fresh)
      setNoHabits(false)
    } catch (err) {
      console.error('[hoje] backfill de hábitos falhou:', err)
    } finally {
      setBackfilling(false)
    }
  }

  const doneCnt = habits.filter(isDone).length
  const totalHabits = habits.length
  const nightCheckin = todayCheckins.find((c) => c.phase === 'noite') ?? null
  const currentPhase = phaseForHour(hour)
  const habitViews: TodayHabitView[] = habits.map((h) => ({
    id: h.id,
    name: cleanDisplayText(h.name),
    areaLabel: AREA_META[h.area]?.label ?? h.area,
    color: AREA_META[h.area]?.color ?? 'var(--teal)',
    timeWindow: h.time_window,
    done: isDone(h),
  }))

  const mentorMsg = profile
    ? getMentorMessage({
        energy: profile.energy_today,
        streak: profile.streak_current,
        habitsDone: doneCnt,
        habitsTotal: totalHabits,
        missionPct,
        phase: currentPhase,
        hour,
      })
    : { body: '...', action: '...' }

  // Assistente proativo: plano do dia priorizado + pendências (lógica pura).
  const dayPlan = buildDayPlan({
    phase: currentPhase,
    hour,
    energy: profile?.energy_today ?? null,
    programTasks: [],
    habits,
    events,
    goals,
    areaScores: {},
  })
  const pendencias = detectPendencias({
    hour,
    habits,
    hasCheckinToday: todayCheckins.length > 0,
    streakCurrent: profile?.streak_current ?? 0,
    overdueTasks: [],
    goals,
    todayISO: today,
    uncategorizedTx: 0,
  })
  const focusPhrase = dayPlan.focusSuggestion ?? dayPlan.capacityHint

  function scrollToHabits() {
    document.getElementById('hoje-habitos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', animation: 'fadeUp .3s ease' }}>
      <FeedbackToast />

      {levelUpData && (
        <LevelUpModal level={levelUpData.level} title={levelUpData.title} onClose={() => setLevelUpData(null)} />
      )}

      {pendingBadges.length > 0 && (
        <BadgeModal badges={pendingBadges} onClose={() => setPendingBadges((prev) => prev.slice(1))} />
      )}

      {showRecovery && profile && (
        <StreakRecovery
          prevBest={profile.streak_best}
          canRecover={canRecover}
          onRecover={handleStreakRecover}
          onDismiss={() => setShowRecovery(false)}
          onCheckin={() => {
            window.location.href = '/checkin'
          }}
        />
      )}

      <AddTaskSheet open={addOpen} saving={addSaving} onClose={() => setAddOpen(false)} onCreate={handleCreateManualHabit} />

      <header style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {profile && <AvatarXP level={profile.level} size={48} avatarUrl={profile.avatar_url} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>
              {greeting}, {profile?.username ?? 'Guerreiro'}
            </p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1 }}>Hoje</h1>
          </div>
        </div>

        <a href="/estatisticas" aria-label="Ver progresso" style={{ minWidth: 116, minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg, rgba(var(--card-rgb),.96), rgba(var(--card-rgb),.96))', border: '0.5px solid rgba(var(--ink-rgb),.08)', borderRadius: 18, padding: '8px 12px', color: 'var(--gold)', boxShadow: '0 14px 38px rgba(0,0,0,.22)', textDecoration: 'none', touchAction: 'manipulation' }}>
          <Icon name="flame" size={24} style={{ animation: 'flame 1.8s ease-in-out infinite', transformOrigin: 'bottom center' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>
              {profile?.streak_current ?? 0} dias
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1 }}>sequência</div>
          </div>
          <Icon name="chevron-right" size={16} color="var(--text3)" />
        </a>
      </header>

      {/* Topo: nível + ritmo. */}
      {profile && <RitmoBar ritmo={ritmo} level={profile.level} title={profile.title} streakBest={profile.streak_best} />}

      {/* Assistente proativo (mentor): missão do dia, mensagem, foco e pendências. */}
      <ProactiveAssistant
        message={cleanDisplayText(mentorMsg.body)}
        focusPhrase={focusPhrase ? cleanDisplayText(focusPhrase) : null}
        planCount={dayPlan.items.length}
        pendencias={pendencias}
        onFocusClick={scrollToHabits}
        mission={profile?.mission_today ? cleanDisplayText(profile.mission_today) : null}
        missionPct={missionPct}
        onMissionProgress={setMissionPct}
      />

      {noHabits ? (
        <div style={{ padding: '0 20px' }}>
          <EmptyState
            icon="target"
            title="Vamos configurar os teus hábitos"
            body="Atualizámos o Nexus para hábitos diários. Cria o teu conjunto inicial com base no teu diagnóstico."
            action={{ label: backfilling ? 'A preparar…' : 'Configurar hábitos', onClick: handleBackfill }}
          />
        </div>
      ) : (
        <div id="hoje-habitos">
          <TodayHabitList
            habits={habitViews}
            doneCount={doneCnt}
            totalCount={totalHabits}
            onToggle={handleToggleHabit}
            onAddHabit={() => setAddOpen(true)}
          />
        </div>
      )}

      {/* Grelha 2x3 com as métricas das páginas principais. */}
      {!noHabits && metrics && <MetricsGrid metrics={metrics} />}

      {profile && nightCheckin && (
        <NightSummaryCard
          ritmo={ritmo}
          habitsFeitos={doneCnt}
          habitsTotal={totalHabits}
          streak={profile.streak_current}
          onVerProgresso={() => {
            window.location.href = '/estatisticas'
          }}
        />
      )}

      <Nav />
    </main>
  )
}
