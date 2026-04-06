
'use client'

export interface LegacyLeagueData {
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

export function calcLeague(weekXP: number): LegacyLeagueData {
  const TIERS = [
    { name: 'Bronze' as const, min: 0, max: 149, icon: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,.12)', next: 'Prata', nextMin: 150 },
    { name: 'Prata' as const, min: 150, max: 399, icon: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,.12)', next: 'Ouro', nextMin: 400 },
    { name: 'Ouro' as const, min: 400, max: 749, icon: '🥇', color: 'var(--gold)', bg: 'rgba(232,168,56,.12)', next: 'Lenda', nextMin: 750 },
    { name: 'Lenda' as const, min: 750, max: Infinity, icon: '👑', color: 'var(--teal)', bg: 'rgba(30,203,180,.12)', next: null, nextMin: null },
  ]
  const tier = TIERS.find(t => weekXP >= t.min && weekXP <= t.max) ?? TIERS[0]
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysLeft = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7) || 7
  const resetDay = daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`
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

export default function WeeklyLeagueCard() {
  return null
}
