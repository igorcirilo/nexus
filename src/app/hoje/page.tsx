'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Nav from '@/components/Nav'
import XPBar from '@/components/XPBar'
import MissionCard from '@/components/MissionCard'
import MentorCard from '@/components/MentorCard'
import XPToast, { triggerXP } from '@/components/XPToast'
import AvatarXP from '@/components/AvatarXP'
import NightSummaryCard from '@/components/NightSummaryCard'
import LevelUpModal from '@/components/LevelUpModal'
import BadgeModal from '@/components/BadgeModal'
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

  const doneCnt = tasks.filter((t) => t.status === 'completed').length
  const totalHabits = tasks.length
  const xpHoje = todayCheckins.reduce((sum, c) => sum + (c.xp_earned ?? 0), 0)
  const nightCheckin = todayCheckins.find((c) => c.phase === 'noite') ?? null

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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, color: 'var(--text3)' }}>a carregar...</div>
      </div>
    )
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

      <div style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {profile && <AvatarXP level={profile.level} size={50} />}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 3 }}>
              {greeting}, {profile?.username ?? 'Guerreiro'}
            </p>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, lineHeight: 1.1 }}>
              Missão de <span style={{ color: 'var(--gold)' }}>Hoje</span>
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(232,168,56,.1)', border: '0.5px solid rgba(232,168,56,.25)', borderRadius: 12, padding: '8px 12px' }}>
          <span style={{ fontSize: 18, animation: 'flame 1.8s ease-in-out infinite', display: 'inline-block', transformOrigin: 'bottom center' }}>🔥</span>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>
              {profile?.streak_current ?? 0}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>dias</div>
          </div>
        </div>
      </div>

      {profile && <XPBar xp={profile.xp_total} level={profile.level} title={profile.title} />}

      <div style={{ display: 'flex', gap: 8, padding: '12px 20px 0' }}>
        {[
          { icon: '⚡', bg: 'rgba(30,203,180,.12)', label: 'Energia', value: `${profile?.energy_today ?? 5}`, suffix: '/10', color: 'var(--teal)' },
          { icon: '🎯', bg: 'rgba(127,119,221,.12)', label: 'Hábitos', value: `${doneCnt}`, suffix: `/${totalHabits}`, color: 'var(--accent)' },
          { icon: '📋', bg: 'rgba(232,168,56,.1)', label: 'Check-in', value: hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite', suffix: '', color: 'var(--gold)' },
        ].map(({ icon, bg, label, value, suffix, color }) => (
          <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '12px 12px', minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {value}
                <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)' }}>{suffix}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: '12px 20px 0', padding: '14px 16px', borderRadius: 16, background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
            <span style={{ fontSize: 11, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>
              Desafio da Semana
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
              {weekChallenge.done} / {weekChallenge.total} dias
            </span>
            <button
              onClick={handleSwapChallenge}
              style={{
                border: '0.5px solid rgba(127,119,221,.28)',
                borderRadius: 10,
                background: 'rgba(127,119,221,.08)',
                color: 'var(--accent)',
                padding: '7px 10px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Trocar
            </button>
          </div>
        </div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text1)', marginBottom: 10 }}>
          {weekChallenge.title}
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5 }}>
          <div style={{ height: '100%', borderRadius: 100, background: 'var(--teal)', width: `${Math.round((weekChallenge.done / Math.max(1, weekChallenge.total)) * 100)}%` }} />
        </div>
      </div>

      {profile && (
        <div style={{ padding: '12px 20px 0' }}>
          <MissionCard mission={profile.mission_today || 'Definir a missão no check-in da manhã'} onProgress={setMissionPct} />
        </div>
      )}

      <MentorCard body={mentorMsg.body} action={mentorMsg.action} />

      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>Tarefas de hoje</h2>
        </div>

        {noProgram ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 32 }}>🎯</span>
            <p style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 15 }}>Faça seu diagnóstico</p>
            <p style={{ color: 'var(--text3)', fontSize: 13 }}>
              Responda algumas perguntas para receber seu plano personalizado de 60 dias
            </p>
            <a
              href="/onboarding-v2"
              style={{ padding: '10px 24px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
            >
              Começar diagnóstico
            </a>
          </div>
        ) : programDay ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {tasks.length > 0 && (
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text3)', paddingBottom: 4 }}>
                <span>✅ {doneCnt}/{totalHabits} concluídas</span>
                {tasks.some(t => t.status === 'skipped') && (
                  <span>⏭ {tasks.filter(t => t.status === 'skipped').length} puladas</span>
                )}
              </div>
            )}

            {tasks.map(task => (
              <div
                key={task.id}
                style={{
                  background: 'var(--bg2)',
                  border: `0.5px solid ${task.status === 'completed' ? 'rgba(30,203,180,.3)' : task.status === 'skipped' ? 'var(--border)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '12px 14px',
                  opacity: task.status !== 'pending' ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <button
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onClick={() => setSelectedTask(task)}
                  >
                    <p
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: task.status === 'completed' ? 'var(--text3)' : 'var(--text1)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        marginBottom: 2,
                      }}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>{task.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                      <span style={{ color: 'var(--text3)', textTransform: 'capitalize' }}>{task.area}</span>
                      <span style={{ color: 'var(--accent)' }}>+{task.xp_reward} XP</span>
                    </div>
                  </button>

                  {task.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={async () => {
                          await updateTaskStatus(task.id, 'skipped')
                          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'skipped' } : t))
                        }}
                        style={{ padding: '5px 10px', borderRadius: 8, background: 'var(--bg3)', border: '0.5px solid var(--border)', color: 'var(--text3)', fontSize: 12, cursor: 'pointer' }}
                      >
                        Pular
                      </button>
                      <button
                        onClick={async () => {
                          await updateTaskStatus(task.id, 'completed')
                          setTasks(prev => prev.map(t =>
                            t.id === task.id ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t
                          ))
                          if (userId) await addXP(userId, task.xp_reward)
                        }}
                        style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none' }}
                      >
                        Feito ✓
                      </button>
                    </div>
                  )}
                  {task.status === 'completed' && (
                    <span style={{ color: 'var(--teal)', fontSize: 18 }}>✓</span>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={async () => {
                const title = prompt('Título da tarefa:')
                if (!title || !userId || !programDay) return
                const task = await createManualTask(userId, programDay.id, programDay.program_id, title, 'produtividade' as HabitArea)
                setTasks(prev => [...prev, task])
              }}
              style={{ width: '100%', padding: '12px', borderRadius: 14, border: '0.5px dashed var(--border)', background: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}
            >
              + Adicionar tarefa manual
            </button>
          </div>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Seu próximo dia ainda está sendo preparado
          </div>
        )}
      </div>

      {programDay && (
        <div style={{ padding: '0 20px', marginTop: 8 }}>
          <a
            href="/programa"
            className="btn-ghost"
            style={{ width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none' }}
          >
            Ver programa completo →
          </a>
        </div>
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
            <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'capitalize', letterSpacing: '.5px', marginBottom: 4 }}>{selectedTask.area}</p>
            <h3 style={{ fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 8 }}>{selectedTask.title}</h3>
            {selectedTask.description && (
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16 }}>{selectedTask.description}</p>
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
