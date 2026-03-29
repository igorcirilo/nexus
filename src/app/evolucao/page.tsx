'use client'
// src/app/evolucao/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, getProfile, getUserBadges } from '@/lib/supabase'
import { xpForLevel, AREA_META, TITLES } from '@/types'
import type { Profile, UserBadge } from '@/types'

const ALL_BADGES = [
  { key: 'streak_7',    icon: '🔥', name: '7 Dias',          goal: 'streak_current >= 7' },
  { key: 'streak_14',   icon: '🔥', name: '14 Dias',         goal: 'streak_current >= 14' },
  { key: 'streak_30',   icon: '🏆', name: '30 Dias',         goal: 'streak_current >= 30' },
  { key: 'streak_90',   icon: '💎', name: '90 Dias',         goal: 'streak_current >= 90' },
  { key: 'energy_max',  icon: '⚡', name: 'Energia Máxima',  goal: 'energy 10/10' },
  { key: 'mission_done',icon: '🎯', name: 'Missão Cumprida', goal: 'missão 100%' },
  { key: 'focus_10',    icon: '🧠', name: 'Foco x10',        goal: '10 sessões Pomodoro' },
  { key: 'all_habits',  icon: '✨', name: 'Dia Perfeito',    goal: 'todos os hábitos num dia' },
]

const AREAS = Object.entries(AREA_META).map(([key, meta]) => ({
  key, ...meta,
  progress: Math.floor(Math.random() * 60 + 30), // substituir por dados reais
}))

export default function EvolucaoPage() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [badges, setBadges]     = useState<UserBadge[]>([])
  const [activeBadge, setActiveBadge] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      const [prof, ub] = await Promise.all([getProfile(user.id), getUserBadges(user.id)])
      setProfile(prof)
      setBadges(ub as UserBadge[])
    }
    load()
  }, [])

  const earned = new Set(badges.map(b => b.badge_key))

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="font-syne text-lg text-text-3">a carregar…</div>
    </div>
  )

  const level   = profile.level
  const xp      = profile.xp_total
  const prev    = xpForLevel(level - 1)
  const next    = xpForLevel(level)
  const pct     = Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100))

  // Progresso de streak para badges
  function badgeProgress(key: string): string {
    const s = profile.streak_current
    if (key === 'streak_7')  return `${Math.min(s,7)}/7 dias`
    if (key === 'streak_14') return `${Math.min(s,14)}/14 dias`
    if (key === 'streak_30') return `${Math.min(s,30)}/30 dias`
    if (key === 'streak_90') return `${Math.min(s,90)}/90 dias`
    return 'Em progresso'
  }

  return (
    <main className="animate-in pb-28">
      <div className="px-5 pt-7">
        <h1 className="font-syne font-bold text-[22px]">Evolução</h1>
      </div>

      {/* Level card */}
      <div className="card-gold mx-5 mt-4 p-5 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3"
             style={{ background: 'rgba(232,168,56,.08)', border: '0.5px solid rgba(232,168,56,.22)' }}>
          <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Nível</span>
          <span className="font-syne font-extrabold text-[26px]" style={{ color: 'var(--gold)' }}>{level}</span>
        </div>
        <div className="font-syne font-semibold text-[17px] mb-0.5">{profile.title}</div>
        <div className="text-[12px] text-text-3 mb-3">{TITLES[profile.title] ?? ''}</div>
        <div className="font-syne font-extrabold text-[32px]">{xp.toLocaleString('pt-PT')}</div>
        <div className="text-[12px] text-text-3 mb-4">XP total · {(next - xp).toLocaleString('pt-PT')} para Nível {level + 1}</div>
        <div className="xp-bar"><div className="xp-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      {/* Streak */}
      <div className="flex gap-2 px-5 mt-3">
        <div className="card flex-1 p-3 flex items-center gap-3">
          <span className="animate-flame text-2xl">🔥</span>
          <div>
            <div className="text-[10px] text-text-3">Streak actual</div>
            <div className="font-syne font-bold text-[22px]" style={{ color: 'var(--gold)' }}>
              {profile.streak_current} dias
            </div>
          </div>
        </div>
        <div className="card flex-1 p-3 flex items-center gap-3">
          <span className="text-2xl">🏅</span>
          <div>
            <div className="text-[10px] text-text-3">Streak máximo</div>
            <div className="font-syne font-bold text-[22px]" style={{ color: 'var(--accent)' }}>
              {profile.streak_best} dias
            </div>
          </div>
        </div>
      </div>

      {/* Áreas */}
      <p className="section-title px-5">Progresso por Área</p>
      <div className="grid grid-cols-2 gap-2.5 px-5">
        {AREAS.map(a => (
          <div key={a.key} className="card p-3.5">
            <div className="text-lg mb-2">{a.icon}</div>
            <div className="text-[12px] text-text-2 mb-1.5">{a.label}</div>
            <div className="bg-bg-3 rounded-full h-1.5 mb-1.5">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{ width: `${a.progress}%`, background: a.color }} />
            </div>
            <div className="text-[11px] text-text-3">{a.progress}%</div>
          </div>
        ))}
      </div>

      {/* Conquistas */}
      <p className="section-title px-5">Conquistas — toca para ver progresso</p>
      <div className="flex flex-wrap gap-3 px-5 pb-2">
        {ALL_BADGES.map(b => {
          const isEarned = earned.has(b.key)
          const isActive = activeBadge === b.key
          return (
            <button key={b.key}
              onClick={() => setActiveBadge(isActive ? null : b.key)}
              className="flex flex-col items-center gap-1.5 w-16">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all"
                   style={{
                     background: isEarned ? 'rgba(232,168,56,.1)' : 'var(--bg2)',
                     border: isEarned ? '1px solid rgba(232,168,56,.28)' : '0.5px solid var(--border)',
                     filter: isEarned ? 'none' : 'grayscale(1)',
                     opacity: isEarned ? 1 : 0.4,
                     transform: isActive ? 'scale(1.08)' : 'scale(1)',
                   }}>
                {b.icon}
              </div>
              <div className="text-[10px] text-text-3 text-center leading-tight">{b.name}</div>
              {isActive && (
                <div className="text-[10px] text-center leading-tight"
                     style={{ color: isEarned ? 'var(--teal)' : 'var(--gold)' }}>
                  {isEarned ? 'Conquistado!' : badgeProgress(b.key)}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <Nav />
    </main>
  )
}
