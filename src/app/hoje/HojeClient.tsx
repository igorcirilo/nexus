'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
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
import DailyRing from '@/components/hoje/DailyRing'
import NextActionCard from '@/components/hoje/NextActionCard'
import GapCard from '@/components/hoje/GapCard'
import TodayHabitList, { type TodayHabitView } from '@/components/hoje/TodayHabitList'
import {
  getProfile,
  getRitmo,
  updateStreak,
  getCheckinsForDate,
  getHabitsWithLogs,
  getHabitActivity,
  toggleHabitLog,
  createHabitQuick,
  checkAndAwardBadges,
  canClaimStreakRecovery,
  claimStreakRecovery,
  supabase,
} from '@/lib/supabase'
import { getNextAction } from '@/lib/next-action'
import { detectGap, type Gap } from '@/lib/gaps'
import { repairMojibake } from '@/lib/text'
import { calculateScores } from '@/lib/profile-assessment'
import { suggestHabitLevel, generateHabitsFromAssessment } from '@/lib/assessment-to-habits'
import { AREA_META } from '@/types'
import type { Profile, Checkin, Habit, HabitArea, Answers } from '@/types'
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

function scrollToHabits() {
  document.getElementById('habitos-hoje')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  const [nextBusy, setNextBusy] = useState(false)
  const [gap, setGap] = useState<Gap | null>(null)
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

  // Mentor de lacuna: deteta (determinístico) a área deixada cair há mais
  // tempo. Uma por dia — fica adiada por hoje quando o utilizador a dispensa.
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('hoje-gap-dismissed') === today) return
    let cancelled = false
    async function detect() {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const { habits: actHabits, logs } = await getHabitActivity(userId, format(since, 'yyyy-MM-dd'))
      const found = detectGap(
        actHabits.map((h) => ({ ...h, name: cleanDisplayText(h.name) })),
        logs,
        today,
      )
      if (!cancelled) setGap(found)
    }
    detect().catch((err) => console.error('[hoje] deteção de lacuna falhou:', err))
    return () => {
      cancelled = true
    }
  }, [today, userId])

  function dismissGap() {
    setGap(null)
    if (typeof window !== 'undefined') localStorage.setItem('hoje-gap-dismissed', today)
  }

  function showGapInList() {
    dismissGap()
    scrollToHabits()
  }

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
  const allDone = totalHabits > 0 && doneCnt === totalHabits
  const nightCheckin = todayCheckins.find((c) => c.phase === 'noite') ?? null
  const currentPhase = phaseForHour(hour)
  const checkinPending = !todayCheckins.some((c) => c.phase === currentPhase)
  const habitViews: TodayHabitView[] = habits.map((h) => ({
    id: h.id,
    name: cleanDisplayText(h.name),
    areaLabel: AREA_META[h.area]?.label ?? h.area,
    color: AREA_META[h.area]?.color ?? 'var(--teal)',
    timeWindow: h.time_window,
    done: isDone(h),
  }))

  // "A seguir": o condutor único, escolhido de forma determinística a partir do
  // estado real do dia.
  const nextAction = getNextAction({
    phase: currentPhase,
    checkinPending,
    energy: profile?.energy_today ?? 0,
    mission: profile?.mission_today ? cleanDisplayText(profile.mission_today) : null,
    streak: profile?.streak_current ?? 0,
    habits: habitViews.map((h) => ({ id: h.id, name: h.name, done: h.done })),
    nightCheckinDone: Boolean(nightCheckin),
  })
  // Postura adaptativa: o Construtor (em ritmo) recebe um cartão colapsado.
  const compactPosture = (profile?.streak_current ?? 0) >= 7 && ritmo >= 60

  function handleNextAction() {
    if (nextAction.kind === 'checkin') {
      window.location.href = '/checkin'
      return
    }
    if (nextAction.kind === 'progress') {
      window.location.href = '/progresso'
      return
    }
    setNextBusy(true)
    handleToggleHabit(nextAction.habitId, true).finally(() => setNextBusy(false))
  }

  const gapMeta = gap ? AREA_META[gap.area] : null

  return (
    <main style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))', minHeight: '100dvh', animation: 'fadeUp .3s ease' }}>
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

      {/* Cabeçalho leve: identidade, sem competir com a âncora. */}
      <header style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        {profile && <AvatarXP level={profile.level} size={48} avatarUrl={profile.avatar_url} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>
            {greeting}, {profile?.username ?? 'Guerreiro'}
          </p>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1 }}>Hoje</h1>
        </div>
      </header>

      {/* Âncora: o anel diário de hábitos + sequência num relance. */}
      {profile && <DailyRing done={doneCnt} total={totalHabits} streak={profile.streak_current} />}

      {/* Condutor único — propõe, não exige. */}
      {!noHabits && (
        <NextActionCard
          title={nextAction.title}
          why={nextAction.why}
          ctaLabel={nextAction.ctaLabel}
          compact={compactPosture}
          busy={nextBusy}
          onPrimary={handleNextAction}
          onSecondary={nextAction.kind === 'habit' ? scrollToHabits : undefined}
        />
      )}

      {noHabits ? (
        <div style={{ padding: '16px 20px 0' }}>
          <EmptyState
            icon="target"
            title="Vamos configurar os teus hábitos"
            body="Atualizámos o Nexus para hábitos diários. Cria o teu conjunto inicial com base no teu diagnóstico."
            action={{ label: backfilling ? 'A preparar…' : 'Configurar hábitos', onClick: handleBackfill }}
          />
        </div>
      ) : (
        <TodayHabitList
          habits={habitViews}
          doneCount={doneCnt}
          totalCount={totalHabits}
          onToggle={handleToggleHabit}
          onAddHabit={() => setAddOpen(true)}
        />
      )}

      {/* Mentor de lacuna: 1 sinal/dia, dispensável, só quando há lacuna real e
          ainda há margem no dia (não aparece com tudo cumprido). */}
      {gap && gapMeta && !allDone && (
        <GapCard
          habitName={gap.habitName}
          areaLabel={gapMeta.label}
          color={gapMeta.color}
          days={gap.days}
          onShow={showGapInList}
          onDismiss={dismissGap}
        />
      )}

      {/* Ritmo & nível: feedback, não direção — fica discreto, abaixo da ação. */}
      {profile && <RitmoBar ritmo={ritmo} level={profile.level} title={profile.title} streakBest={profile.streak_best} />}

      {profile && nightCheckin && (
        <NightSummaryCard
          ritmo={ritmo}
          habitsFeitos={doneCnt}
          habitsTotal={totalHabits}
          streak={profile.streak_current}
          onVerProgresso={() => {
            window.location.href = '/progresso'
          }}
        />
      )}

      <Nav />
    </main>
  )
}
