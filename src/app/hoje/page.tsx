'use client'
// src/app/hoje/page.tsx
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Nav from '@/components/Nav'
import XPBar from '@/components/XPBar'
import MissionCard from '@/components/MissionCard'
import MentorCard from '@/components/MentorCard'
import HabitItem from '@/components/HabitItem'
import XPToast, { triggerXP } from '@/components/XPToast'
import AvatarXP from '@/components/AvatarXP'
import NightSummaryCard from '@/components/NightSummaryCard'
import LevelUpModal from '@/components/LevelUpModal'
import {
  supabase,
  getProfile,
  getHabitsWithLogs,
  addXP,
  updateStreak,
  getCheckinsForDate,
  checkAndAwardBadges,
  claimLoginBonus,
  getWeeklyChallenge,
  saveWeeklyChallenge,
  generateWeeklyChallenge,
} from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import type { Profile, Habit, HabitLog, Checkin, WeeklyChallenge } from '@/types'
import StreakRecovery from '@/components/StreakRecovery'
import EmptyState from '@/components/EmptyState'

export default function HojePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [habits, setHabits] = useState<(Habit & { habit_logs: HabitLog[] })[]>([])
  const [missionPct, setMissionPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)
  const [todayCheckins, setTodayCheckins] = useState<Checkin[]>([])
  const [weekChallenge, setWeekChallenge] = useState<WeeklyChallenge>({ title: 'Semana da Consistência', done: 0, total: 7 })
  const [challengeDraft, setChallengeDraft] = useState('')
  const [editingChallenge, setEditingChallenge] = useState(false)
  const [challengeSaving, setChallengeSaving] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{ level: number; title: string } | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')
  const hour = new Date().getHours()

  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }
      setUserId(user.id)

      const [prof, hab, checkins, challenge] = await Promise.all([
        getProfile(user.id),
        getHabitsWithLogs(user.id, today),
        getCheckinsForDate(user.id, today),
        getWeeklyChallenge(user.id),
      ])

      if (prof && !prof.onboarded) {
        window.location.href = '/onboarding'
        return
      }

      const typedCheckins = (checkins ?? []) as Checkin[]
      setTodayCheckins(typedCheckins)

      const manhaCI = typedCheckins.find((c) => c.phase === 'manha')
      if (prof && manhaCI?.energy) prof.energy_today = manhaCI.energy
      if (prof && manhaCI?.mission) prof.mission_today = manhaCI.mission

      setProfile(prof)
      setHabits(hab as (Habit & { habit_logs: HabitLog[] })[])
      setWeekChallenge(challenge)
      setChallengeDraft(challenge.title)

      if (prof && prof.streak_current === 0 && prof.streak_best > 0) setShowRecovery(true)

      await updateStreak(user.id)

      const gotBonus = await claimLoginBonus(user.id)
      if (gotBonus) {
        triggerXP(10, '🎁 Login diário! +10 XP')
        if (prof) prof.xp_total += 10
      }

      if (prof) {
        const newBadges = await checkAndAwardBadges(user.id, {
          streak_current: prof.streak_current,
          xp_total: prof.xp_total,
        })
        newBadges.forEach((badge) => triggerXP(0, `Nova conquista: ${badge.name}`))
      }

      setLoading(false)
    }

    load()
  }, [today])

  async function handleXP(xp: number, msg: string) {
    if (!profile) return
    triggerXP(xp, msg)
    const oldLevel = profile.level
    await addXP(profile.id, xp)

    const updated = await getProfile(profile.id)
    if (updated) {
      setProfile(updated)
      if (updated.level > oldLevel) {
        setTimeout(() => {
          setLevelUpData({ level: updated.level, title: updated.title ?? 'Guerreiro' })
        }, 800)
      }
    } else {
      setProfile((p) => (p ? { ...p, xp_total: p.xp_total + xp } : p))
    }
  }

  const doneCnt = habits.filter((h) => h.habit_logs?.[0]?.completed).length
  const totalHabits = habits.length
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
    : { body: '…', action: '…' }

  async function handleSaveWeeklyChallenge() {
    if (!userId || !challengeDraft.trim()) return
    setChallengeSaving(true)
    const { error } = await saveWeeklyChallenge(userId, challengeDraft)
    if (!error) {
      setWeekChallenge((prev) => ({ ...prev, title: challengeDraft.trim() }))
      setEditingChallenge(false)
    }
    setChallengeSaving(false)
  }

  async function handleGenerateWeeklyChallenge() {
    if (!userId) return
    setChallengeSaving(true)
    const { data, error } = await generateWeeklyChallenge(userId)
    if (!error && data?.title) {
      setWeekChallenge((prev) => ({ ...prev, title: data.title as string }))
      setChallengeDraft(data.title as string)
      setEditingChallenge(false)
    }
    setChallengeSaving(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, color: 'var(--text3)' }}>a carregar…</div>
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

      {habits.length === 0 && profile && (
        <EmptyState
          hasHabits={habits.length > 0}
          hasMission={!!profile.mission_today}
          username={profile.username ?? 'Guerreiro'}
        />
      )}

      {showRecovery && profile && (
        <StreakRecovery
          prevBest={profile.streak_best}
          onDismiss={() => setShowRecovery(false)}
          onCheckin={() => { window.location.href = '/checkin' }}
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
          { icon: '⚡', bg: 'rgba(30,203,180,.12)', label: 'Energia',  value: `${profile?.energy_today ?? 5}`, suffix: '/10', color: 'var(--teal)' },
          { icon: '🎯', bg: 'rgba(127,119,221,.12)', label: 'Hábitos', value: `${doneCnt}`, suffix: `/${totalHabits}`, color: 'var(--accent)' },
          { icon: '📋', bg: 'rgba(232,168,56,.1)',   label: 'Check-in', value: hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite', suffix: '', color: 'var(--gold)' },
        ].map(({ icon, bg, label, value, suffix, color }) => (
          <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '12px 12px', minWidth: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{icon}</div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {value}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)' }}>{suffix}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: '12px 20px 0', padding: '14px 16px', borderRadius: 16, background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)' }} />
            <span style={{ fontSize: 11, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>
              Desafio da Semana
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
            {weekChallenge.done} / {weekChallenge.total} dias
          </span>
        </div>

        {editingChallenge ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
            <input
              value={challengeDraft}
              onChange={(e) => setChallengeDraft(e.target.value)}
              placeholder="Escreve o desafio desta semana"
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '0.5px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                color: 'var(--text1)',
                fontFamily: 'DM Sans, sans-serif',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveWeeklyChallenge} disabled={challengeSaving || !challengeDraft.trim()} style={{ flex: 1, background: 'var(--teal)', color: 'var(--bg0)', border: 'none', borderRadius: 12, padding: '11px 12px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: challengeSaving ? 0.7 : 1 }}>
                {challengeSaving ? 'A guardar…' : 'Guardar'}
              </button>
              <button onClick={() => { setEditingChallenge(false); setChallengeDraft(weekChallenge.title) }} disabled={challengeSaving} style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '11px 12px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text1)', marginBottom: 10 }}>
            {weekChallenge.title}
          </div>
        )}

        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5, marginBottom: 12 }}>
          <div style={{ height: '100%', borderRadius: 100, background: 'var(--teal)', width: `${Math.round((weekChallenge.done / Math.max(1, weekChallenge.total)) * 100)}%` }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditingChallenge(true)} disabled={challengeSaving} style={{ flex: 1, background: 'var(--bg3)', color: 'var(--text1)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '10px 12px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Editar texto
          </button>
          <button onClick={handleGenerateWeeklyChallenge} disabled={challengeSaving} style={{ flex: 1, background: 'rgba(232,168,56,.12)', color: 'var(--gold)', border: '0.5px solid rgba(232,168,56,.22)', borderRadius: 12, padding: '10px 12px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: challengeSaving ? 0.7 : 1 }}>
            {challengeSaving ? 'A gerar…' : 'Gerar novo'}
          </button>
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
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>Hábitos de hoje</h2>
          <a href="/habitos" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'none' }}>gerir</a>
        </div>

        {habits.length === 0 ? (
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 16, color: 'var(--text3)', fontSize: 13 }}>
            Ainda não tens hábitos activos.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {habits.map((habit) => (
              <HabitItem
                key={habit.id}
                habit={habit}
                log={habit.habit_logs?.[0] ?? null}
                userId={userId}
                date={today}
                onXP={handleXP}
              />
            ))}
          </div>
        )}
      </div>

      {profile && nightCheckin && (
        <NightSummaryCard
          xpHoje={xpHoje}
          habitsFeitos={doneCnt}
          habitsTotal={totalHabits}
          streak={profile.streak_current}
          onVerProgresso={() => { window.location.href = '/progresso' }}
        />
      )}

      <Nav />
    </main>
  )
}
