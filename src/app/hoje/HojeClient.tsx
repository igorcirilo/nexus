'use client'

import { useEffect, useState } from 'react'
import { todayISO } from '@/lib/date'
import Nav from '@/components/Nav'
import RitmoBar from '@/components/RitmoBar'
import FeedbackToast, { triggerToast } from '@/components/FeedbackToast'
import AvatarXP from '@/components/AvatarXP'
import NightSummaryCard from '@/components/NightSummaryCard'
import LevelUpModal from '@/components/LevelUpModal'
import BadgeModal from '@/components/BadgeModal'
import EmptyState from '@/components/EmptyState'
import AddTaskSheet from '@/components/hoje/AddTaskSheet'
import TodayCommandPanel from '@/components/hoje/TodayCommandPanel'
import TodayMetrics from '@/components/hoje/TodayMetrics'
import TodayMissionPanel from '@/components/hoje/TodayMissionPanel'
import TodayTaskList, { type TodayTaskView } from '@/components/hoje/TodayTaskList'
import WeeklyChallengeStrip from '@/components/hoje/WeeklyChallengeStrip'
import Icon from '@/components/ui/Icon'
import {
  getProfile,
  getRitmo,
  updateStreak,
  getCheckinsForDate,
  checkAndAwardBadges,
  claimLoginBonus,
  canClaimStreakRecovery,
  claimStreakRecovery,
  supabase,
} from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import { repairMojibake } from '@/lib/text'
import type { Profile, Checkin, ProgramDay, ProgramTask, HabitArea } from '@/types'
import { getProgramDayByDate, getProgramTasks, getFirstProgramDayWithTasks, ensureProgramHasTasks, updateTaskStatus, createManualTask, getCurrentProgramWeekFocus, type ProgramWeekFocus } from '@/lib/program'
import StreakRecovery from '@/components/StreakRecovery'

type ProfileWithProgram = Profile & {
  program_id?: string | null
  onboarding_version?: number | null
}

const AREA_LABELS: Record<HabitArea, string> = {
  corpo: 'Corpo',
  produtividade: 'Produtividade',
  idiomas: 'Idiomas',
  carreira: 'Carreira',
  financas: 'Finanças',
  emocoes: 'Emoções',
  relacionamentos: 'Relacionamentos',
}

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

interface HojeClientProps {
  userId: string
  serverToday: string
  initialProfile: Profile | null
  initialCheckins: Checkin[]
  initialProgramDay: ProgramDay | null
  initialTasks: ProgramTask[]
  initialNoProgram: boolean
}

export default function HojeClient({
  userId,
  serverToday,
  initialProfile,
  initialCheckins,
  initialProgramDay,
  initialTasks,
  initialNoProgram,
}: HojeClientProps) {
  // Estado inicial vem do servidor → primeiro paint já com dados reais.
  const [profile, setProfile] = useState<Profile | null>(() => seedProfile(initialProfile, initialCheckins))
  const [ritmo, setRitmo] = useState(0)
  const [missionPct, setMissionPct] = useState(0)
  const [showRecovery, setShowRecovery] = useState(false)
  const [canRecover, setCanRecover] = useState(false)
  const [todayCheckins, setTodayCheckins] = useState<Checkin[]>(initialCheckins)
  const [weekFocus, setWeekFocus] = useState<ProgramWeekFocus | null>(null)
  const [programDay, setProgramDay] = useState<ProgramDay | null>(initialProgramDay)
  const [tasks, setTasks] = useState<ProgramTask[]>(initialTasks)
  const noProgram = initialNoProgram
  const [selectedTask, setSelectedTask] = useState<ProgramTask | null>(null)
  const [addTaskOpen, setAddTaskOpen] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [challengeOpen, setChallengeOpen] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null)
  const [pendingBadges, setPendingBadges] = useState<{ key: string; name: string }[]>([])
  const hour = new Date().getHours()

  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  // Efeitos de gamificação (mutações) — correm uma vez no cliente, nunca no
  // render do servidor. Não bloqueiam a página: falhas só são registadas.
  useEffect(() => {
    let cancelled = false
    async function runSideEffects() {
      const programId = (initialProfile as ProfileWithProgram | null)?.program_id ?? null

      // Reconciliação de fuso: o servidor calcula "hoje" no SEU fuso (UTC em
      // produção), que pode estar desfasado um dia do utilizador. Se a data
      // local do dispositivo diferir, recarrega os dados sensíveis à data.
      const clientToday = todayISO()
      const dateMismatch = clientToday !== serverToday
      if (dateMismatch) {
        const freshCheckins = (await getCheckinsForDate(userId, clientToday)) as Checkin[]
        if (!cancelled) {
          setTodayCheckins(freshCheckins)
          setProfile((prev) => seedProfile(prev, freshCheckins))
        }
      }

      if (initialProfile && initialProfile.streak_current === 0 && initialProfile.streak_best > 0) {
        setShowRecovery(true)
        setCanRecover(await canClaimStreakRecovery(userId))
      }

      // Recarrega o dia do programa quando: faltam tarefas (precisa semear) ou
      // a data do cliente diverge da do servidor.
      if (!noProgram && programId && (initialTasks.length === 0 || dateMismatch)) {
        if (initialTasks.length === 0) await ensureProgramHasTasks(userId, programId)
        const day = await getProgramDayByDate(programId)
        if (!cancelled && day) {
          let dayTasks = await getProgramTasks(day.id)
          let resolvedDay = day
          if (dayTasks.length === 0) {
            const fallback = await getFirstProgramDayWithTasks(programId)
            if (fallback) {
              resolvedDay = fallback
              dayTasks = await getProgramTasks(fallback.id)
            }
          }
          if (!cancelled) {
            setProgramDay(resolvedDay)
            setTasks(dayTasks)
          }
        }
      }

      const focus = await getCurrentProgramWeekFocus(userId)
      if (!cancelled) setWeekFocus(focus)

      await updateStreak(userId)
      // Lê só as colunas recalculadas pelo RPC e funde no perfil já carregado.
      const { data: streakFields } = await supabase
        .from('profiles')
        .select('streak_current, streak_best, streak_last_date, level, title')
        .eq('id', userId)
        .single()
      if (!cancelled && streakFields) {
        setProfile((prev) => (prev ? { ...prev, ...streakFields } : prev))
      }

      const ritmoNow = await getRitmo(userId)
      if (!cancelled) setRitmo(ritmoNow)

      await claimLoginBonus(userId)

      const streakForBadges = streakFields ?? initialProfile
      if (streakForBadges) {
        const newBadges = await checkAndAwardBadges(userId, {
          streak_current: streakForBadges.streak_current,
          streak_best: streakForBadges.streak_best,
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
    if (!selectedTask) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedTask(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedTask])

  async function handleStreakRecover() {
    const success = await claimStreakRecovery(userId)
    if (success) {
      setShowRecovery(false)
      setCanRecover(false)
      const updated = await getProfile(userId)
      if (updated) setProfile(updated)
    }
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
    triggerToast(`${cleanDisplayText(task.title)} — feito`)
    setRitmo(await getRitmo(userId))
  }

  async function handleCreateManualTask(title: string, area: HabitArea) {
    if (!programDay) return
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
  // Ritmo esperado: fração do "dia ativo" (07h–22h) já decorrida.
  // Compara o progresso real com o esperado para dizer se está no caminho.
  const dayFraction = Math.min(1, Math.max(0, (hour - 7) / (22 - 7)))
  const donePct = totalHabits > 0 ? doneCnt / totalHabits : 0
  const paceCaption =
    totalHabits === 0
      ? 'Sem tarefas'
      : doneCnt === totalHabits
        ? 'Tudo feito'
        : donePct >= dayFraction
          ? 'No ritmo'
          : 'Dá para acelerar'
  const nightCheckin = todayCheckins.find((c) => c.phase === 'noite') ?? null
  const currentPhase = hour < 12 ? 'manha' : hour < 18 ? 'tarde' : 'noite'
  const checkinLabel = hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'
  const checkinPending = !todayCheckins.some((c) => c.phase === currentPhase)
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

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', animation: 'fadeUp .3s ease' }}>
      <FeedbackToast />

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
          {profile && <AvatarXP level={profile.level} size={48} avatarUrl={profile.avatar_url} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 2 }}>
              {greeting}, {profile?.username ?? 'Guerreiro'}
            </p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 26, lineHeight: 1 }}>
              Hoje
            </h1>
          </div>
        </div>

        <a href="/progresso" aria-label="Ver progresso" style={{ minWidth: 116, minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg, rgba(28,32,48,.96), rgba(20,23,32,.96))', border: '0.5px solid rgba(255,255,255,.08)', borderRadius: 18, padding: '8px 12px', color: 'var(--gold)', boxShadow: '0 14px 38px rgba(0,0,0,.22)', textDecoration: 'none', touchAction: 'manipulation' }}>
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

      {/* Acima da dobra: a ação principal e as pendências vêm primeiro.
          A RitmoBar (gamificação) desce para o fim — é contexto, não a prioridade. */}
      <TodayCommandPanel action={primaryAction} context={mentorMsg.body} checkinPending={checkinPending} />

      <div style={{ padding: '0 20px' }}>
        {noProgram ? (
          <EmptyState
            icon="target"
            title="Complete seu diagnóstico"
            body="Responda algumas perguntas para receber seu plano personalizado de 63 dias."
            action={{ label: 'Começar diagnóstico', href: '/onboarding-v2' }}
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

          {weekFocus && (
            <WeeklyChallengeStrip
              theme={weekFocus.theme}
              weekNumber={weekFocus.weekNumber}
              totalWeeks={weekFocus.totalWeeks}
              done={weekFocus.done}
              total={weekFocus.total}
              open={challengeOpen}
              onToggle={() => setChallengeOpen(open => !open)}
            />
          )}
        </>
      )}

      <TodayMetrics
        metrics={[
          { icon: 'zap', label: 'Energia', value: `${profile?.energy_today ?? 5}/10`, color: 'var(--teal)', progress: ((profile?.energy_today ?? 5) / 10) * 100, caption: 'Moderada' },
          { icon: 'target', label: 'Hábitos', value: `${doneCnt}/${totalHabits}`, color: 'var(--accent)', progress: donePct * 100, caption: paceCaption },
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

      {selectedTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedTaskTitle}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,.5)' }}
          onClick={() => setSelectedTask(null)}
        >
          <div
            style={{ width: '100%', maxWidth: 512, margin: '0 auto', background: 'var(--bg2)', borderRadius: '20px 20px 0 0', padding: '20px 24px calc(28px + env(safe-area-inset-bottom))', maxHeight: 'min(86dvh, 720px)', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{selectedTaskArea}</p>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 8 }}>{selectedTaskTitle}</h3>
            {selectedTaskDescription && (
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>{selectedTaskDescription}</p>
            )}
            <div style={{ display: 'flex', gap: 12, fontSize: 13, marginBottom: 24 }}>
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
