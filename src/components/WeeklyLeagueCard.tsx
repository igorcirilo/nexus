'use client'
// src/components/WeeklyLeagueCard.tsx

interface LeagueData {
  xp: number
  tier: 'Bronze' | 'Prata' | 'Ouro' | 'Lenda'
  tierColor: string
  tierBg: string
  tierIcon: string
  xpToNext: number | null
  nextTier: string | null
  pct: number
  resetDay: string
}

interface WeeklyLeagueCardProps {
  data: LeagueData
}

export function calcLeague(weekXP: number): LeagueData {
  const TIERS = [
    { name: 'Bronze' as const, min: 0,   max: 149,  icon: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,.12)',  next: 'Prata',  nextMin: 150 },
    { name: 'Prata'  as const, min: 150, max: 399,  icon: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,.12)', next: 'Ouro',   nextMin: 400 },
    { name: 'Ouro'   as const, min: 400, max: 749,  icon: '🥇', color: 'var(--gold)', bg: 'rgba(232,168,56,.12)', next: 'Lenda', nextMin: 750 },
    { name: 'Lenda'  as const, min: 750, max: Infinity, icon: '👑', color: 'var(--teal)', bg: 'rgba(30,203,180,.12)', next: null, nextMin: null },
  ]

  const tier = TIERS.find(t => weekXP >= t.min && weekXP <= t.max) ?? TIERS[0]

  // Dias até segunda
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=dom, 1=seg...
  const daysLeft = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7) || 7
  const resetDay = daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`

  // Progresso dentro do tier
  const range = tier.max === Infinity ? 750 : tier.max - tier.min + 1
  const inTier = weekXP - tier.min
  const pct = tier.max === Infinity ? 100 : Math.min(100, Math.round((inTier / range) * 100))

  return {
    xp: weekXP,
    tier: tier.name,
    tierColor: tier.color,
    tierBg: tier.bg,
    tierIcon: tier.icon,
    xpToNext: tier.nextMin !== null ? Math.max(0, tier.nextMin - weekXP) : null,
    nextTier: tier.next,
    pct,
    resetDay,
  }
}

export default function WeeklyLeagueCard({ data }: WeeklyLeagueCardProps) {
  const { xp, tier, tierColor, tierBg, tierIcon, xpToNext, nextTier, pct, resetDay } = data

  return (
    <div style={{
      margin: '12px 20px 0',
      background: 'var(--bg2)',
      border: `0.5px solid ${tierColor}33`,
      borderRadius: 16,
      padding: '16px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Brilho de fundo */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: tierBg,
        filter: 'blur(30px)',
        pointerEvents: 'none',
      }} />

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierColor }} />
          <span style={{ fontSize: 11, color: tierColor, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>
            Liga Semanal
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          Reinicia {resetDay}
        </span>
      </div>

      {/* Tier + XP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: tierBg,
          border: `1px solid ${tierColor}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, flexShrink: 0,
        }}>
          {tierIcon}
        </div>
        <div>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 700,
            fontSize: 20, color: tierColor, lineHeight: 1,
          }}>
            {tier}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 3 }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--text1)' }}>
              {xp}
            </span>
            {' '}XP esta semana
          </div>
        </div>

        {/* Próximo tier */}
        {nextTier && xpToNext !== null && (
          <div style={{
            marginLeft: 'auto', textAlign: 'right', flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>para {nextTier}</div>
            <div style={{
              fontFamily: 'Syne, sans-serif', fontWeight: 700,
              fontSize: 16, color: 'var(--text1)', lineHeight: 1,
            }}>
              -{xpToNext} XP
            </div>
          </div>
        )}

        {tier === 'Lenda' && (
          <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: tierColor, fontWeight: 600 }}>Nível máximo</div>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>
            {tier === 'Lenda' ? 'Mantém o ritmo' : `Progresso para ${nextTier}`}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{pct}%</span>
        </div>
        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5 }}>
          <div style={{
            height: '100%', borderRadius: 100,
            background: tier === 'Lenda'
              ? 'linear-gradient(90deg, var(--teal), var(--accent))'
              : tierColor,
            width: `${pct}%`,
            transition: 'width .6s ease',
          }} />
        </div>

        {/* Marcadores de tier */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          {['🥉', '🥈', '🥇', '👑'].map((icon, i) => (
            <span key={i} style={{ fontSize: 12, opacity: i <= ['Bronze','Prata','Ouro','Lenda'].indexOf(tier) ? 1 : .25 }}>
              {icon}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
