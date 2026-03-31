'use client'
// src/app/hoje/page.tsx
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import XPBar from '@/components/XPBar'
import MissionCard from '@/components/MissionCard'
import MentorCard from '@/components/MentorCard'
import HabitItem from '@/components/HabitItem'
import XPToast, { triggerXP } from '@/components/XPToast'
import { supabase, getProfile, getHabitsWithLogs, addXP, updateStreak, getDynamicWeeklyChallenge, getCheckinsForDate } from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import type { Profile, Habit, HabitLog } from '@/types'
import StreakRecovery from '@/components/StreakRecovery'
import EmptyState from '@/components/EmptyState'

export default function HojePage() {
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [habits, setHabits]           = useState<(Habit & { habit_logs: HabitLog[] })[]>([])
  const [missionPct, setMissionPct]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [showRecovery, setShowRecovery] = useState(false)
  const [todayCheckins, setTodayCheckins] = useState<{phase:string;energy?:number;sleep_hours?:number;mood?:number;mission?:string}[]>([])
  const [weekChallenge, setWeekChallenge] = useState({ title: 'Semana da Consistência', done: 0, total: 7 })
  const today = format(new Date(), 'yyyy-MM-dd')
  const hour  = new Date().getHours()

  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }

      const [prof, hab] = await Promise.all([
        getProfile(user.id),
        getHabitsWithLogs(user.id, today),
      ])

      // Redirecionar para onboarding se ainda não fez
      if (prof && !prof.onboarded) {
        window.location.href = '/onboarding'
        return
      }

      // Carregar check-ins de hoje para dados reais
      const checkins = await getCheckinsForDate(user.id, today)
      setTodayCheckins(checkins as {phase:string;energy?:number;sleep_hours?:number;mood?:number;mission?:string}[])

      // Energia real do check-in da manhã
      const manhaCI = (checkins as {phase:string;energy?:number;mission?:string}[]).find(c => c.phase === 'manha')
      if (manhaCI?.energy && prof) {
        prof.energy_today = manhaCI.energy
      }
      // Missão real do check-in
      if (manhaCI?.mission && prof) {
        prof.mission_today = manhaCI.mission
      }

      setProfile(prof)
      setHabits(hab as (Habit & { habit_logs: HabitLog[] })[])

      // Mostrar card de recuperação se streak = 0 mas tem histórico
      if (prof && prof.streak_current === 0 && prof.streak_best > 0) {
        setShowRecovery(true)
      }

      const challenge = await getDynamicWeeklyChallenge(user.id)
      setWeekChallenge(challenge)
      await updateStreak(user.id)
      setLoading(false)
    }
    load()
  }, [today])

  async function handleXP(xp: number, msg: string) {
    if (!profile) return
    triggerXP(xp, msg)
    await addXP(profile.id, xp)
    setProfile(p => p ? { ...p, xp_total: p.xp_total + xp } : p)
  }

  const doneCnt    = habits.filter(h => h.habit_logs?.[0]?.completed).length
  const totalHabits = habits.length

  const mentorMsg = profile ? getMentorMessage({
    energy:      profile.energy_today,
    streak:      profile.streak_current,
    habitsDone:  doneCnt,
    habitsTotal: totalHabits,
    missionPct,
    phase:       hour < 13 ? 'manha' : hour < 19 ? 'tarde' : 'noite',
    hour,
  }) : { body: '…', action: '…' }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ fontFamily: "Syne, sans-serif", fontSize: 18, color: "var(--text3)" }}>a carregar…</div>
    </div>
  )

  return (
    <main style={{ paddingBottom: 100, minHeight: "100vh", animation: "fadeUp .3s ease" }}>
      <XPToast />

      {/* ── ESTADO VAZIO ── */}
      {habits.length === 0 && profile && (
        <EmptyState
          hasHabits={habits.length > 0}
          hasMission={!!profile.mission_today}
          username={profile.username ?? 'Guerreiro'}
        />
      )}

      {/* ── RECUPERAÇÃO DE STREAK ── */}
      {showRecovery && profile && (
        <StreakRecovery
          prevBest={profile.streak_best}
          onDismiss={() => setShowRecovery(false)}
          onCheckin={() => { window.location.href = '/checkin' }}
        />
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: '28px 20px 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 3 }}>
            {greeting}, {profile?.username ?? 'Guerreiro'}
          </p>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, lineHeight: 1.1 }}>
            Missão de <span style={{ color: 'var(--gold)' }}>Hoje</span>
          </h1>
        </div>
        {/* Streak badge no canto */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(232,168,56,.1)', border: '0.5px solid rgba(232,168,56,.25)',
          borderRadius: 12, padding: '8px 12px',
        }}>
          <span style={{ fontSize: 18, animation: 'flame 1.8s ease-in-out infinite', display: 'inline-block', transformOrigin: 'bottom center' }}>🔥</span>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>
              {profile?.streak_current ?? 0}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>dias</div>
          </div>
        </div>
      </div>

      {/* ── XP BAR ── */}
      {profile && <XPBar xp={profile.xp_total} level={profile.level} title={profile.title} />}

      {/* ── STATS PILLS ── */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px 0' }}>
        {/* Energia */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
          borderRadius: 14, padding: '11px 14px',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(30,203,180,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>⚡</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Energia</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--teal)', lineHeight: 1 }}>
              {profile?.energy_today ?? 5}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>/10</span>
            </div>
          </div>
        </div>
        {/* Hábitos */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
          borderRadius: 14, padding: '11px 14px',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(127,119,221,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🎯</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Hábitos</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--accent)', lineHeight: 1 }}>
              {doneCnt}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>/{totalHabits}</span>
            </div>
          </div>
        </div>
        {/* Check-ins */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
          borderRadius: 14, padding: '11px 14px',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(232,168,56,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>📋</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Check-in</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 17, color: 'var(--gold)', lineHeight: 1 }}>
              {hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'}
            </div>
          </div>
        </div>
      </div>

      {/* ── DESAFIO SEMANAL DINÂMICO ── */}
      <div style={{
        margin: '12px 20px 0', padding: '14px 16px', borderRadius: 16,
        background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: 'var(--text1)', marginBottom: 10 }}>
          {weekChallenge.title}
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5 }}>
          <div style={{ height: '100%', borderRadius: 100, background: 'var(--teal)', width: `${Math.round(weekChallenge.done / weekChallenge.total * 100)}%`, transition: 'width .5s' }} />
        </div>
      </div>

      {/* Missão principal */}
      {profile && (
        <MissionCard
          mission={profile.mission_today ?? ''}
          progress={missionPct}
          userId={profile.id}
          onXP={handleXP}
          onProgressUpdate={setMissionPct}
        />
      )}

      {/* Mentor */}
      <MentorCard body={mentorMsg.body} action={mentorMsg.action} />

      {/* Hábitos */}
      <p className="section-title px-5">Hábitos de Hoje</p>
      <div className="px-5 flex flex-col gap-2">
        {habits.length === 0 ? (
          <p className="text-[13px] text-text-3 py-4">
            Ainda não tens hábitos. Adiciona no menu Sistema Pessoal.
          </p>
        ) : habits.map(h => (
          <HabitItem
            key={h.id}
            habit={h}
            log={h.habit_logs?.[0] ?? null}
            userId={profile!.id}
            date={today}
            onXP={handleXP}
          />
        ))}
      </div>

      {/* Preview amanhã (aparece se streak > 0) */}
      {(profile?.streak_current ?? 0) > 0 && (
        <div className="mx-5 mt-4 p-4 rounded-2xl"
             style={{ background: 'var(--bg1)', border: '0.5px dashed rgba(127,119,221,.28)' }}>
          <div className="chip-accent mb-1.5">Preview de Amanhã</div>
          <div className="font-syne font-semibold text-[14px] mb-1">
            Streak {(profile?.streak_current ?? 0) + 1} dias 🔥
          </div>
          <div className="text-[12px] text-text-3">
            Próxima conquista: {(profile?.streak_current ?? 0) >= 29 ? '90 dias' : (profile?.streak_current ?? 0) >= 13 ? '30 dias' : '14 dias'} de streak
          </div>
        </div>
      )}

      {/* CTA check-in */}
      <div className="px-5 mt-4">
        <button className="btn-primary" onClick={() => window.location.href = '/checkin'}>
          Fazer Check-in →
        </button>
      </div>

      <Nav />
    </main>
  )
}
