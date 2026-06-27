'use client'

import { useEffect, useState } from 'react'
import { todayISO, phaseForHour } from '@/lib/date'
import Nav from '@/components/Nav'
import FeedbackToast, { triggerToast } from '@/components/FeedbackToast'
import AvatarXP from '@/components/AvatarXP'
import NightSummaryCard from '@/components/NightSummaryCard'
import LevelUpModal from '@/components/LevelUpModal'
import BadgeModal from '@/components/BadgeModal'
import EmptyState from '@/components/EmptyState'
import Icon from '@/components/ui/Icon'
import AddTaskSheet from '@/components/hoje/AddTaskSheet'
import MentorRead from '@/components/hoje/MentorRead'
import NextActionCard from '@/components/hoje/NextActionCard'
import DailyRing from '@/components/hoje/DailyRing'
import TodayHabitList, { type TodayHabitView } from '@/components/hoje/TodayHabitList'
import AgendaToday from '@/components/hoje/AgendaToday'
import LifeGrid from '@/components/hoje/LifeGrid'
import Goal90Card from '@/components/hoje/Goal90Card'
import InsightCard from '@/components/hoje/InsightCard'
import CaptureBar from '@/components/hoje/CaptureBar'
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
  supabase,
} from '@/lib/supabase'
import { getNextAction } from '@/lib/next-action'
import { buildMentorRead } from '@/lib/mentor-read'
import { getHomeExtras, type HomeExtras } from '@/lib/home-extras'
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
  // Sinais dos outros domínios (agenda, finanças, leitura, objetivo, insight).
  const [extras, setExtras] = useState<HomeExtras | null>(null)
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
      // atividade.
      if (initialProfile && initialProfile.streak_current === 0 && initialProfile.streak_best > 0) {
        setShowRecovery(true)
        setCanRecover(await canClaimStreakRecovery(userId))
      }

      const ritmoNow = await getRitmo(userId)
      if (!cancelled) setRitmo(ritmoNow)

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

  // Sinais dos outros domínios (read-only, defensivo). Carrega após o paint
  // inicial para não bloquear o essencial (estado + hábitos).
  useEffect(() => {
    let cancelled = false
    getHomeExtras(userId, today, initialProfile)
      .then((e) => {
        if (!cancelled) setExtras(e)
      })
      .catch((err) => console.error('[hoje] sinais dos domínios falharam:', err))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, today])

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
    const prevHabits = habits
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, habit_logs: [{ completed: done, date: today }] } : h)))
    const { error } = await toggleHabitLog(userId, id, today, done)
    if (error) {
      setHabits(prevHabits)
      triggerToast('Não foi possível guardar. Tenta de novo.')
      return
    }

    if (!done) {
      setRitmo(await getRitmo(userId))
      return
    }

    const h = prevHabits.find((x) => x.id === id)
    if (h) triggerToast(`${cleanDisplayText(h.name)} — feito`)

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

  async function handleBackfill() {
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
  const checkinPending = !todayCheckins.some((c) => c.phase === currentPhase)
  const habitViews: TodayHabitView[] = habits.map((h) => ({
    id: h.id,
    name: cleanDisplayText(h.name),
    areaLabel: AREA_META[h.area]?.label ?? h.area,
    color: AREA_META[h.area]?.color ?? 'var(--teal)',
    timeWindow: h.time_window,
    done: isDone(h),
  }))

  // Leitura do dia (ORIENTA): lê o estado real + o próximo evento/lembrete.
  const mentorRead = buildMentorRead({
    phase: currentPhase,
    energy: profile?.energy_today ?? 0,
    streak: profile?.streak_current ?? 0,
    habitsLeft: totalHabits - doneCnt,
    habitsTotal: totalHabits,
    nextEvent: extras?.nextEvent ?? null,
    reminder: extras?.reminder ?? null,
  })

  // "Agora": o condutor único, determinístico.
  const nextAction = getNextAction({
    phase: currentPhase,
    checkinPending,
    energy: profile?.energy_today ?? 0,
    mission: profile?.mission_today ? cleanDisplayText(profile.mission_today) : null,
    streak: profile?.streak_current ?? 0,
    habits: habitViews.map((h) => ({ id: h.id, name: h.name, done: h.done })),
    nightCheckinDone: Boolean(nightCheckin),
  })
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

      {/* Cabeçalho: identidade + momentum (MOTIVA), discreto. */}
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

        <a href="/progresso" aria-label="Ver progresso" style={{ display: 'flex', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(var(--ink-rgb),.04)', border: '0.5px solid var(--border)', borderRadius: 13, padding: '7px 10px', fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 14, color: 'var(--gold)' }}>
            <Icon name="flame" size={15} />
            {profile?.streak_current ?? 0}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', background: 'rgba(var(--ink-rgb),.04)', border: '0.5px solid var(--border)', borderRadius: 13, padding: '7px 10px', fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 800, fontSize: 14, color: 'var(--teal)' }}>
            Nív.{profile?.level ?? 1}
          </span>
        </a>
      </header>

      {/* ORIENTA — a leitura do dia. */}
      <MentorRead text={mentorRead} />

      {/* O condutor — "Agora". */}
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

      {/* CHECK — anel diário + hábitos para marcar. */}
      {profile && <DailyRing done={doneCnt} total={totalHabits} streak={profile.streak_current} />}

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

      {/* ORGANIZA + LEMBRA — agenda e lembretes. */}
      {extras && <AgendaToday events={extras.agenda} reminder={extras.reminder} />}

      {/* ORGANIZA (vida toda) — estado dos domínios. */}
      {extras && <LifeGrid domains={extras.domains} />}

      {/* Horizonte longo — objetivo dos 90 dias. */}
      {extras?.goal && <Goal90Card title={extras.goal.title} progress={extras.goal.progress} />}

      {/* ENSINA — o que o Nexus reparou. */}
      {extras?.insight && <InsightCard title={extras.insight.title} body={extras.insight.body} />}

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

      <CaptureBar />
      <Nav />
    </main>
  )
}
