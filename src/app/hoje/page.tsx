'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Nav from '@/components/Nav'
import XPBar from '@/components/XPBar'
import XPToast, { triggerXP } from '@/components/XPToast'
import AvatarXP from '@/components/AvatarXP'
import NightSummaryCard from '@/components/NightSummaryCard'
import LevelUpModal from '@/components/LevelUpModal'
import BadgeModal from '@/components/BadgeModal'
import EmptyState from '@/components/EmptyState'
import AddTaskSheet from '@/components/hoje/AddTaskSheet'
import HojeLoading from '@/components/hoje/HojeLoading'
import TodayCommandPanel from '@/components/hoje/TodayCommandPanel'
import TodayMetrics from '@/components/hoje/TodayMetrics'
import TodayMissionPanel from '@/components/hoje/TodayMissionPanel'
import TodayTaskList, { type TodayTaskView } from '@/components/hoje/TodayTaskList'
import WeeklyChallengeStrip from '@/components/hoje/WeeklyChallengeStrip'
import Icon from '@/components/ui/Icon'
import {
  supabase,
  getProfile,
  addXP,
  updateStreak,
  getDynamicWeeklyChallenge,
  getCheckinsForDate,
  checkAndAwardBadges,
  claimLoginBonus,
  canClaimStreakRecovery,
  claimStreakRecovery,
} from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import type { Profile, Checkin, ProgramDay, ProgramTask, HabitArea } from '@/types'
import { getProgramDayByDate, getProgramTasks, getFirstProgramDayWithTasks, ensureProgramHasTasks, updateTaskStatus, createManualTask } from '@/lib/program'
import StreakRecovery from '@/components/StreakRecovery'

type ProfileWithProgram = Profile & {
  program_id?: string | null
  onboarding_version?: number | null
}

const CHALLENGE_LIBRARY = [
  'Semana da Consistencia',
  'Semana do Foco Profundo',
  'Semana Corpo em Movimento',
  'Semana de Leitura Diaria',
  'Semana de Check-ins Completos',
  'Semana Sem Falhar o Basico',
]

const AREA_LABELS: Record<HabitArea, string> = {
  corpo: 'Corpo',
  produtividade: 'Produtividade',
  idiomas: 'Idiomas',
  carreira: 'Carreira',
  financas: 'Finanças',
  emocoes: 'Emoções',
  relacionamentos: 'Relacionamentos',
}

function cleanDisplayText(value: string | null | undefined) {
  if (!value || !/[ÃÂâ]/.test(value)) return value ?? ''

  try {
    return new TextDecoder('utf-8').decode(Uint8Array.from(Array.from(value), char => char.charCodeAt(0) & 255))
  } catch {
    return value
  }
}

function cleanActionText(value: string) {
  const text = cleanDisplayText(value)
    .replace(/^Pr\S*ximo passo:\s*/i, '')
    .replace(/\s+Isso j\S* \S* progresso\.$/i, '')
    .trim()
  return text ? text.charAt(0).toLocaleUpperCase('pt-PT') + text.slice(1) : text
}

export default function HojePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [missionPct, setMissionPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)
  const [canRecover, setCanRecover] = useState(false)
  const [todayCheckins, setTodayCheckins] = useState<Checkin[]>([])
  const [weekChallenge, setWeekChallenge] = useState({ title: 'Semana da Consistencia', done: 0, total: 7 })
  const [programDay, setProgramDay] = useState<ProgramDay | null>(null)
  const [tasks, setTasks] = useState<ProgramTask[]>([])
  const [noProgram, setNoProgram] = useState(false)
  const [selectedTask, setSelectedTask] = useState<ProgramTask | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null)
  const [pendingBadges, setPendingBadges] = useState<{ key: string; name: string }[]>([])
  const today = format(new Date(), 'yyyy-MM-dd')
  const hour = new Date().getHours()

  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUserId(user.id)

      const [prof, checkins] = await Promise.all([
        getProfile(user.id),
        getCheckinsForDate(user.id, today),
      ])

      const hasCompletedV2Onboarding = Boolean(
        prof &&
        ((prof as ProfileWithProgram).program_id) &&
        ((((prof as ProfileWithProgram).onboarding_version) ?? 1) >= 2)
      )

      if (prof && !prof.onboarded && !hasCompletedV2Onboarding) {
        window.location.href = '/onboarding-v2'
        return
      }
      if (prof && !hasCompletedV2Onboarding) {
        setNoProgram(true)
      }

      const typedCheckins = (checkins ?? []) as Checkin[]
      setTodayCheckins(typedCheckins)

      const manhaCI = typedCheckins.find((c) => c.phase === 'manha')
      if (prof && manhaCI?.energy) prof.energy_today = manhaCI.energy
      if (prof && manhaCI?.mission) prof.mission_today = manhaCI.mission

      setProfile(prof)

      if (prof && prof.streak_current === 0 && prof.streak_best > 0) {
        setShowRecovery(true)
        const canRec = await canClaimStreakRecovery(user.id)
        setCanRecover(canRec)
      }

      if (hasCompletedV2Onboarding) {
        const programId = (prof as ProfileWithProgram).program_id!
        await ensureProgramHasTasks(user.id, programId)
        const day = await getProgramDayByDate(programId)
        if (day) {
          const dayTasks = await getProgramTasks(day.id)

          if (dayTasks.length > 0) {
            setProgramDay(day)
            setTasks(dayTasks)
          } else {
            const fallbackDay = await getFirstProgramDayWithTasks(programId)
            if (fallbackDay) {
              const fallbackTasks = await getProgramTasks(fallbackDay.id)
              setProgramDay(fallbackDay)
              setTasks(fallbackTasks)
            } else {
              setProgramDay(day)
              setTasks([])
            }
          }
        }
      }

      const challenge = await getDynamicWeeklyChallenge(user.id)
      setWeekChallenge(challenge)
      await updateStreak(user.id)

      const gotBonus = await claimLoginBonus(user.id)
      if (gotBonus) {
        triggerXP(10, 'Login diario! +10 XP')
        if (prof) prof.xp_total += 10
      }

      if (prof) {
        const newBadges = await checkAndAwardBadges(user.id, {
          streak_current: prof.streak_current,
          xp_total: prof.xp_total,
        })
        if (newBadges.length > 0) {
          setPendingBadges(newBadges)
        }
      }

      setLoading(false)
    }

    load()
  }, [today])

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

  function handleSwapChallenge() {
    setWeekChallenge((current) => {
      const index = CHALLENGE_LIBRARY.indexOf(current.title)
      const nextIndex = index >= 0 ? (index + 1) % CHALLENGE_LIBRARY.length : 0
      return { ...current, title: CHALLENGE_LIBRARY[nextIndex] }
    })
  }

  async function handleSkipTask(task: ProgramTask) {
    await updateTaskStatus(task.id, 'skipped')
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'skipped' } : t))
  }

  async function handleCompleteTask(task: ProgramTask) {
    await updateTaskStatus(task.id, 'completed')
    setTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t
    ))
    if (userId) await addXP(userId, task.xp_reward)
  }

  async function handleCreateManualTask(title: string, area: HabitArea) {
    if (!userId || !programDay) return
    setTaskSaving(true)
    try {
      const task = await createManualTask(userId, programDay.id, programDay.program_id, title, area)
      setTasks(prev => [...prev, task])
      setAddTaskOpen(false)
    } finally {
      setTaskSaving(false)
    }
  }

  const doneCnt = tasks.filter((t) => t.status === 'completed').length
  const totalHabits = tasks.length
  const xpHoje = todayCheckins.reduce((sum, c) => sum + (c.xp_earned ?? 0), 0)
  const nightCheckin = todayCheckins.find((c) => c.phase === 'noite') ?? null
  const checkinLabel = hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'
  const todayTaskViews: TodayTaskView[] = tasks.map(task => ({
    task,
    title: cleanDisplayText(task.title),
    description: cleanDisplayText(task.description),
    areaLabel: AREA_LABELS[task.area] ?? task.area,
  }))

  const mentorMsg = profile
    ? getMentorMessage({
        energy: profile.energy_today,
        streak: profile.streak_current,
        habitsDone: doneCnt,
        habitsTotal: totalHabits,
        missionPct,
        phase: hour < 13 ? 'manha' : hour < 19 ? 'tarde' : 'noite',
        hour,
      })
    : { body: '...', action: '...' }
  const primaryAction = cleanActionText(mentorMsg.action)

  const selectedTaskTitle = selectedTask ? cleanDisplayText(selectedTask.title) : ''
  const selectedTaskDescription = selectedTask ? cleanDisplayText(selectedTask.description) : ''
  const selectedTaskArea = selectedTask ? AREA_LABELS[selectedTask.area] ?? selectedTask.area : ''

  if (loading) {
    return <HojeLoading />
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh', animation: 'fadeUp .3s ease' }}>
      <XPToast />

      {levelUpData && (
        <LevelUpModal
          level={levelUpData.level}
          title={levelUpData.title}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {pendingBadges.length > 0 && (
        <BadgeModal
          badges={pendingBadges}
          onClose={() => setPendingBadges(prev => prev.slice(1))}
        />
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

      <AddTaskSheet
        open={addTaskOpen}
        saving={taskSaving}
        onClose={() => setAddTaskOpen(false)}
        onCreate={handleCreateManualTask}
      />

      <header style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {profile && <AvatarXP level={profile.level} size={48} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>
              {greeting}, {profile?.username ?? 'Guerreiro'}
            </p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1 }}>
              Hoje
            </h1>
          </div>
        </div>

        <div style={{ minWidth: 116, minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg, rgba(28,32,48,.96), rgba(20,23,32,.96))', border: '0.5px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '8px 12px', color: 'var(--gold)', boxShadow: '0 14px 38px rgba(0,0,0,.22)' }}>
          <Icon name="flame" size={24} style={{ animation: 'flame 1.8s ease-in-out infinite', transformOrigin: 'bottom center' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>
              {profile?.streak_current ?? 0} dias
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, lineHeight: 1 }}>sequência</div>
          </div>
          <Icon name="chevron-right" size={16} color="var(--text3)" />
        </div>
      </header>

      {profile && <XPBar xp={profile.xp_total} level={profile.level} title={profile.title} />}

      <TodayCommandPanel action={primaryAction} context={mentorMsg.body} />

      <TodayMetrics
        metrics={[
          { icon: 'zap', label: 'Energia', value: `${profile?.energy_today ?? 5}/10`, color: 'var(--teal)', progress: ((profile?.energy_today ?? 5) / 10) * 100, caption: 'Moderada' },
          { icon: 'target', label: 'Hábitos', value: `${doneCnt}/${totalHabits}`, color: 'var(--accent)', progress: totalHabits > 0 ? (doneCnt / totalHabits) * 100 : 0, caption: `${totalHabits > 0 ? Math.round((doneCnt / totalHabits) * 100) : 0}% concluídos` },
          { icon: 'clipboard', label: 'Check-in', value: checkinLabel, color: 'var(--teal)', caption: todayCheckins.length > 0 ? 'Em andamento' : 'Pendente' },
        ]}
      />

      {profile && (
        <TodayMissionPanel
          mission={profile.mission_today || 'Definir a missão no check-in da manhã'}
          progress={missionPct}
          onProgress={setMissionPct}
        />
      )}

      <div style={{ padding: '0 20px' }}>
        {noProgram ? (
          <EmptyState
            icon="target"
            title="Complete seu diagnóstico"
            body="Responda algumas perguntas para receber seu plano personalizado de 63 dias."
            action={{ label: 'Começar diagnóstico', href: '/onboarding' }}
          />
        ) : !programDay ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Seu próximo dia ainda está sendo preparado
          </div>
        ) : null}
      </div>

      {!noProgram && programDay && (
        <>
          <TodayTaskList
            tasks={todayTaskViews}
            doneCount={doneCnt}
            totalCount={totalHabits}
            onAddTask={() => setAddTaskOpen(true)}
            onSelectTask={setSelectedTask}
            onSkipTask={handleSkipTask}
            onCompleteTask={handleCompleteTask}
          />

          <WeeklyChallengeStrip
            title={weekChallenge.title}
            done={weekChallenge.done}
            total={weekChallenge.total}
            open={challengeOpen}
            onToggle={() => setChallengeOpen(open => !open)}
            onSwap={handleSwapChallenge}
          />

          <div style={{ padding: '0 20px', marginTop: 8 }}>
            <a
              href="/programa"
              className="btn-ghost"
              style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', textDecoration: 'none', touchAction: 'manipulation' }}
            >
              Ver programa completo
              <Icon name="chevron-right" size={15} />
            </a>
          </div>
        </>
      )}

      {profile && nightCheckin && (
        <NightSummaryCard
          xpHoje={xpHoje}
          habitsFeitos={doneCnt}
          habitsTotal={totalHabits}
          streak={profile.streak_current}
          onVerProgresso={() => {
            window.location.href = '/progresso'
          }}
        />
      )}

      {selectedTask && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.5)' }}
          onClick={() => setSelectedTask(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 512, margin: '0 auto', background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '20px 24px 32px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{selectedTaskArea}</p>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 8 }}>{selectedTaskTitle}</h3>
            {selectedTaskDescription && (
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>{selectedTaskDescription}</p>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 24 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+{selectedTask.xp_reward} XP</span>
              <span style={{ color: 'var(--border)' }}>·</span>
              <span style={{ color: 'var(--text3)' }}>Dificuldade {selectedTask.difficulty}</span>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              style={{ width: '100%', padding: 14, borderRadius: 14, background: 'var(--bg3)', color: 'var(--text2)', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
