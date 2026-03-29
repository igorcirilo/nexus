'use client'
// src/app/evolucao/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, getProfile, getUserBadges } from '@/lib/supabase'
import { xpForLevel, AREA_META, TITLES } from '@/types'
import type { Profile, UserBadge } from '@/types'
import { format, subDays } from 'date-fns'

const ALL_BADGES = [
  { key: 'streak_7',    icon: '🔥', name: '7 dias',        xp: 100, desc: '7 dias consecutivos'       },
  { key: 'streak_14',   icon: '🔥', name: '14 dias',       xp: 150, desc: 'Duas semanas sem parar'    },
  { key: 'streak_30',   icon: '🏆', name: '30 dias',       xp: 500, desc: 'Um mês de consistência'    },
  { key: 'streak_90',   icon: '💎', name: '90 dias',       xp: 2000,desc: 'Antifrágil — 3 meses'      },
  { key: 'energy_max',  icon: '⚡', name: 'Energia máx',  xp: 50,  desc: 'Energia 10/10 num check-in' },
  { key: 'mission_done',icon: '🎯', name: 'Missão feita', xp: 75,  desc: 'Missão principal concluída' },
  { key: 'focus_10',    icon: '🧠', name: 'Foco x10',     xp: 200, desc: '10 sessões de 25 min'       },
  { key: 'all_habits',  icon: '✨', name: 'Dia perfeito', xp: 150, desc: 'Todos os hábitos num dia'   },
]

type AreaProgress = { key: string; label: string; icon: string; color: string; pct: number; done: number; total: number }

export default function EvolucaoPage() {
  const [profile,      setProfile]      = useState<Profile | null>(null)
  const [badges,       setBadges]       = useState<UserBadge[]>([])
  const [areas,        setAreas]        = useState<AreaProgress[]>([])
  const [activeBadge,  setActiveBadge]  = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }

      const since = format(subDays(new Date(), 29), 'yyyy-MM-dd')

      const [prof, ub, { data: habits }, { data: logs }] = await Promise.all([
        getProfile(user.id),
        getUserBadges(user.id),
        supabase.from('habits').select('id, area, active').eq('user_id', user.id).eq('active', true),
        supabase.from('habit_logs').select('habit_id, completed, date')
          .eq('user_id', user.id).gte('date', since),
      ])

      setProfile(prof)
      setBadges(ub as UserBadge[])

      // Calcular progresso real por área (% de conclusão nos últimos 30 dias)
      const habitsByArea = (habits ?? []).reduce((acc: Record<string, string[]>, h: { id: string; area: string }) => {
        if (!acc[h.area]) acc[h.area] = []
        acc[h.area].push(h.id)
        return acc
      }, {})

      const areaList: AreaProgress[] = Object.entries(AREA_META).map(([key, meta]) => {
        const ids   = habitsByArea[key] ?? []
        const total = ids.length * 30 // 30 dias × hábitos dessa área
        const done  = (logs ?? []).filter((l: { habit_id: string; completed: boolean }) =>
          ids.includes(l.habit_id) && l.completed
        ).length
        const pct = total > 0 ? Math.round(done / total * 100) : 0
        return { key, label: meta.label, icon: meta.icon, color: meta.color, pct, done, total }
      })
      setAreas(areaList)
      setLoading(false)
    }
    load()
  }, [])

  const earned = new Set(badges.map(b => b.badge_key))

  if (loading || !profile) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text3)' }}>a carregar…</div>
    </div>
  )

  const level = profile.level
  const xp    = profile.xp_total
  const prev  = xpForLevel(level - 1)
  const next  = xpForLevel(level)
  const pct   = Math.min(100, Math.round(((xp - prev) / (next - prev)) * 100))

  function streakProgress(key: string) {
    const s = profile!.streak_current
    if (key === 'streak_7')  return { cur: Math.min(s, 7),  max: 7  }
    if (key === 'streak_14') return { cur: Math.min(s, 14), max: 14 }
    if (key === 'streak_30') return { cur: Math.min(s, 30), max: 30 }
    if (key === 'streak_90') return { cur: Math.min(s, 90), max: 90 }
    return null
  }

  const earnedCount = earned.size
  const totalBadges = ALL_BADGES.length
  const topArea = [...areas].sort((a, b) => b.pct - a.pct)[0]

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 3 }}>Evolução</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>
          {earnedCount}/{totalBadges} conquistas · {topArea?.pct > 0 ? `melhor área: ${topArea.label}` : 'começa hoje'}
        </p>
      </div>

      {/* ── CARD DE NÍVEL ── */}
      <div style={{
        margin: '16px 20px 0', padding: '24px 20px', borderRadius: 20,
        background: 'var(--bg2)', border: '0.5px solid rgba(232,168,56,.25)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(232,168,56,.06)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          {/* Nível + título */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                background: 'rgba(232,168,56,.12)', border: '0.5px solid rgba(232,168,56,.3)',
                borderRadius: 10, padding: '4px 12px',
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: 'var(--gold)',
                letterSpacing: '.5px',
              }}>NÍV. {level}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text1)' }}>
                {profile.title}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>{TITLES[profile.title] ?? ''}</div>
          </div>
          {/* XP total */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 30, color: 'var(--text1)', lineHeight: 1 }}>
              {xp.toLocaleString('pt-PT')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>XP total</div>
          </div>
        </div>

        {/* Barra XP */}
        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 8, marginBottom: 8 }}>
          <div style={{
            height: '100%', borderRadius: 100,
            background: 'linear-gradient(90deg, var(--gold), #F0C060)',
            width: `${pct}%`, transition: 'width .8s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
          <span>{pct}% para Nível {level + 1}</span>
          <span>{(next - xp).toLocaleString('pt-PT')} XP em falta</span>
        </div>
      </div>

      {/* ── STREAK + STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '12px 20px 0' }}>
        {[
          { label: 'Streak',    value: `${profile.streak_current}`, unit: 'dias', color: 'var(--gold)',   icon: '🔥', flame: true },
          { label: 'Recorde',   value: `${profile.streak_best}`,    unit: 'dias', color: 'var(--accent)', icon: '🏅' },
          { label: 'Conquistas',value: `${earnedCount}/${totalBadges}`, unit: '',  color: 'var(--teal)',   icon: '✨' },
        ].map(({ label, value, unit, color, icon, flame }) => (
          <div key={label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 6, display: 'inline-block', ...(flame ? { animation: 'flame 1.8s ease-in-out infinite', transformOrigin: 'bottom center' } : {}) }}>
              {icon}
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color, lineHeight: 1 }}>
              {value}
            </div>
            {unit && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{unit}</div>}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── PROGRESSO POR ÁREA ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Progresso por Área — últimos 30 dias
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {areas.map(a => (
            <div key={a.key} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '13px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)' }}>{a.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{a.done}/{a.total > 0 ? a.total : '—'}</span>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: a.pct >= 70 ? 'var(--teal)' : a.pct >= 40 ? 'var(--gold)' : 'var(--text3)', minWidth: 36, textAlign: 'right' }}>
                    {a.total > 0 ? `${a.pct}%` : '—'}
                  </span>
                </div>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5 }}>
                <div style={{
                  height: '100%', borderRadius: 100, transition: 'width .8s ease',
                  width: `${a.pct}%`,
                  background: a.pct >= 70 ? 'var(--teal)' : a.pct >= 40 ? 'var(--gold)' : a.color,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONQUISTAS ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
          Conquistas
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {ALL_BADGES.map(b => {
            const isEarned = earned.has(b.key)
            const isActive = activeBadge === b.key
            const sp = streakProgress(b.key)

            return (
              <button key={b.key}
                onClick={() => setActiveBadge(isActive ? null : b.key)}
                style={{
                  background: isActive ? (isEarned ? 'rgba(232,168,56,.08)' : 'var(--bg3)') : 'var(--bg2)',
                  border: isActive
                    ? (isEarned ? '1px solid rgba(232,168,56,.3)' : '0.5px solid var(--accent)')
                    : '0.5px solid var(--border)',
                  borderRadius: 14, padding: '14px 8px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  transition: 'all .15s',
                  filter: isEarned ? 'none' : 'grayscale(.8)',
                  opacity: isEarned ? 1 : 0.55,
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                }}>
                <span style={{ fontSize: 24 }}>{b.icon}</span>
                <span style={{ fontSize: 10, color: isEarned ? 'var(--text1)' : 'var(--text3)', textAlign: 'center', lineHeight: 1.3 }}>
                  {b.name}
                </span>
                {isEarned && (
                  <span style={{ fontSize: 9, color: 'var(--teal)' }}>+{b.xp} XP</span>
                )}
                {/* Progresso de streak */}
                {isActive && !isEarned && sp && (
                  <div style={{ width: '100%', marginTop: 2 }}>
                    <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 3 }}>
                      <div style={{
                        height: '100%', borderRadius: 100, background: 'var(--gold)',
                        width: `${Math.round(sp.cur / sp.max * 100)}%`,
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--gold)', textAlign: 'center', marginTop: 3 }}>
                      {sp.cur}/{sp.max}
                    </div>
                  </div>
                )}
                {isActive && isEarned && (
                  <div style={{ fontSize: 9, color: 'var(--teal)', textAlign: 'center' }}>Conquistado ✓</div>
                )}
                {isActive && !isEarned && !sp && (
                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.3 }}>{b.desc}</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── PRÓXIMO NÍVEL ── */}
      <div style={{ margin: '20px 20px 0', padding: '16px', borderRadius: 14, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Percurso de Títulos</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { title: 'Recruta',     min: 1,  max: 2  },
            { title: 'Consistente', min: 3,  max: 4  },
            { title: 'Focado',      min: 5,  max: 7  },
            { title: 'Estrategista',min: 8,  max: 10 },
            { title: 'Imparável',   min: 11, max: 14 },
            { title: 'Antifrágil',  min: 15, max: 20 },
          ].map(t => {
            const isCurrent = level >= t.min && level <= t.max
            const isPast    = level > t.max
            return (
              <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: isPast ? 'var(--teal)' : isCurrent ? 'var(--gold)' : 'var(--bg3)',
                }} />
                <div style={{ flex: 1, fontSize: 13, color: isCurrent ? 'var(--text1)' : isPast ? 'var(--text3)' : 'var(--text3)', fontWeight: isCurrent ? 600 : 400 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Nív. {t.min}–{t.max}</div>
                {isCurrent && <div style={{ fontSize: 10, color: 'var(--gold)', fontFamily: 'Syne, sans-serif' }}>← aqui</div>}
                {isPast && <div style={{ fontSize: 10, color: 'var(--teal)' }}>✓</div>}
              </div>
            )
          })}
        </div>
      </div>

      <Nav />
    </main>
  )
}
