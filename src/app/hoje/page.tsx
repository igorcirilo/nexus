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
import { supabase, getProfile, getHabitsWithLogs, addXP, updateStreak } from '@/lib/supabase'
import { getMentorMessage } from '@/lib/mentor'
import type { Profile, Habit, HabitLog } from '@/types'

export default function HojePage() {
  const [profile, setProfile]       = useState<Profile | null>(null)
  const [habits, setHabits]         = useState<(Habit & { habit_logs: HabitLog[] })[]>([])
  const [missionPct, setMissionPct] = useState(0)
  const [loading, setLoading]       = useState(true)
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
      setProfile(prof)
      setHabits(hab as (Habit & { habit_logs: HabitLog[] })[])
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
    <div className="flex items-center justify-center min-h-screen">
      <div className="font-syne text-lg text-text-3">a carregar…</div>
    </div>
  )

  return (
    <main className="animate-in pb-28">
      <XPToast />

      {/* Header */}
      <div className="px-5 pt-7">
        <p className="text-[13px] text-text-2">{greeting}, {profile?.username ?? 'Guerreiro'}</p>
        <h1 className="font-syne font-bold text-[22px] mt-0.5">
          Missão de <span style={{ color: 'var(--gold)' }}>Hoje</span>
        </h1>
      </div>

      {/* XP Bar */}
      {profile && <XPBar xp={profile.xp_total} level={profile.level} title={profile.title} />}

      {/* Stats row */}
      <div className="flex gap-2 px-5 mt-3">
        {[
          { label: 'Streak', value: `${profile?.streak_current ?? 0}`,   color: 'var(--gold)',   icon: '🔥', flame: true },
          { label: 'Energia', value: `${profile?.energy_today ?? 5}/10`, color: 'var(--teal)',   icon: '⚡' },
          { label: 'Hábitos', value: `${doneCnt}/${totalHabits}`,        color: 'var(--accent)', icon: '🎯' },
        ].map(({ label, value, color, icon, flame }) => (
          <div key={label} className="flex-1 card px-3 py-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[13px] flex-shrink-0"
                 style={{ background: `${color}18` }}>
              <span className={flame ? 'animate-flame' : ''}>{icon}</span>
            </div>
            <div>
              <div className="text-[10px] text-text-3">{label}</div>
              <div className="font-syne font-bold text-[17px] leading-none" style={{ color }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desafio semanal */}
      <div className="mx-5 mt-3 p-4 rounded-2xl" style={{ background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.2)' }}>
        <div className="flex justify-between items-center mb-2">
          <span className="chip-teal">Desafio da Semana</span>
          <span className="text-[11px] text-text-2">4 / 7 dias</span>
        </div>
        <div className="font-syne font-semibold text-[14px] mb-2">Semana do Foco Total</div>
        <div className="bg-bg-3 rounded-full h-1.5">
          <div className="h-full rounded-full" style={{ width: '57%', background: 'var(--teal)' }} />
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
