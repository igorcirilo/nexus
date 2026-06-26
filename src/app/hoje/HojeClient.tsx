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
import AddTaskSheet from '@/components/hoje/AddTaskSheet'
import MentorInsight from '@/components/hoje/MentorInsight'
import CaptureBar from '@/components/hoje/CaptureBar'
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
  supabase,
} from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import { repairMojibake } from '@/lib/text'
import { calculateScores } from '@/lib/profile-assessment'
import { suggestHabitLevel, generateHabitsFromAssessment } from '@/lib/assessment-to-habits'
import { AREA_META } from '@/types'
import type { Profile, Checkin, Habit, HabitArea, Answers } from '@/types'
import StreakRecovery from '@/components/StreakRecovery'

type HabitWithLog = Habit & { habit_logs?: { completed: boolean; date: string }[] }

const cleanDisplayText = repairMojibake

function cleanActionText(value: string) {
  const text = cleanDisplayText(value)
    .replace(/^Pr\S*ximo passo:\s*/i, '')
    .replace(/\s+Isso j\S* \S* progresso\.$/i, '')
    .trim()
  return text ? text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1) : text
}

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
  const [commandDismissed, setCommandDismissed] = useState(false)

  const today = todayISO()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    let cancelled = false
    async function runSideEffects() {
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

  useEffect(() => {
    if (sessionStorage.getItem('hoje-command-dismissed') === today) {
      setCommandDismissed(true)
    }
  }, [today])

  function handleDismissCommand() {
    setCommandDismissed(true)
    sessionStorage.setItem('hoje-command-dismissed', today)
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

  const mentorMsg = profile
    ? getMentorMessage({
        energy: profile.energy_today,
        streak: profile.streak_current,
        habitsDone: doneCnt,
        habitsTotal: totalHabits,
        missionPct,
        phase: phaseForHour(hour),
        hour,
      })
    : { body: '...', action: '...' }
  const primaryAction = cleanActionText(mentorMsg.action)

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

      {/* ── Header compacto ────────────────────────────────────────── */}
      <header
        style={{
          padding: '28px 20px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {profile && <AvatarXP level={profile.level} size={48} avatarUrl={profile.avatar_url} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 1 }}>{greeting}</p>
            <h1
              style={{
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 22,
                lineHeight: 1.1,
                marginBottom: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {profile?.username ?? 'Guerreiro'}
            </h1>
            {profile && (
              <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1 }}>
                Nível {profile.level} · {profile.title}
                {ritmo > 0 ? ` · Ritmo ${ritmo}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Ofensiva pill — link para progresso */}
        <a
          href="/progresso"
          aria-label={`Ofensiva: ${profile?.streak_current ?? 0} dias`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(var(--card-rgb),.96), rgba(var(--card-rgb),.96))',
            border: '0.5px solid rgba(var(--ink-rgb),.08)',
            boxShadow: '0 10px 30px rgba(0,0,0,.18)',
            textDecoration: 'none',
            touchAction: 'manipulation',
            flexShrink: 0,
          }}
        >
          <Icon
            name="flame"
            size={20}
            style={{
              animation: 'flame 1.8s ease-in-out infinite',
              transformOrigin: 'bottom center',
              color: 'var(--gold)',
            }}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: 'var(--gold)',
                lineHeight: 1,
              }}
            >
              {profile?.streak_current ?? 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, lineHeight: 1 }}>dias</div>
          </div>
        </a>
      </header>

      {/* ── Sinal único do mentor (missão + orientação) ─────────────── */}
      {!nightCheckin && profile && (
        <MentorInsight
          phase={currentPhase}
          mission={profile.mission_today}
          missionProgress={missionPct}
          mentorBody={mentorMsg.body}
          primaryAction={primaryAction}
          checkinPending={checkinPending}
          dismissed={commandDismissed}
          onDismiss={handleDismissCommand}
          onMissionProgress={setMissionPct}
        />
      )}

      {/* ── Anel diário de hábitos ───────────────────────────────────── */}
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

      {/* ── Captura / conversa com o Nexus ──────────────────────────── */}
      <CaptureBar />

      {/* ── Resumo de fim de dia (substitui mentor quando noite concluída) */}
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
