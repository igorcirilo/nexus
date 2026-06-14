'use client'
// src/components/WeeklyLeagueCard.tsx

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { WeeklyLeagueOverview } from '@/types'

interface LeagueData {
  points: number
  tier: 'Bronze' | 'Prata' | 'Ouro' | 'Lenda'
  tierColor: string
  tierBg: string
  tierIcon: string
  pointsToNext: number | null
  nextTier: string | null
  pct: number
  resetDay: string
}

interface WeeklyLeagueCardProps {
  data: LeagueData
  overview?: WeeklyLeagueOverview | null
}

export function calcLeague(weekPoints: number): LeagueData {
  const TIERS = [
    { name: 'Bronze' as const, min: 0, max: 14, icon: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,.12)', next: 'Prata', nextMin: 15 },
    { name: 'Prata' as const, min: 15, max: 34, icon: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,.12)', next: 'Ouro', nextMin: 35 },
    { name: 'Ouro' as const, min: 35, max: 59, icon: '🥇', color: 'var(--gold)', bg: 'rgba(232,168,56,.12)', next: 'Lenda', nextMin: 60 },
    { name: 'Lenda' as const, min: 60, max: Infinity, icon: '👑', color: 'var(--teal)', bg: 'rgba(30,203,180,.12)', next: null, nextMin: null },
  ]

  const tier = TIERS.find(t => weekPoints >= t.min && weekPoints <= t.max) ?? TIERS[0]
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysLeft = dayOfWeek === 1 ? 7 : ((8 - dayOfWeek) % 7) || 7
  const resetDay = daysLeft === 1 ? 'amanhã' : `em ${daysLeft} dias`
  const range = tier.max === Infinity ? 60 : tier.max - tier.min + 1
  const inTier = weekPoints - tier.min
  const pct = tier.max === Infinity ? 100 : Math.min(100, Math.round((inTier / range) * 100))

  return {
    points: weekPoints,
    tier: tier.name,
    tierColor: tier.color,
    tierBg: tier.bg,
    tierIcon: tier.icon,
    pointsToNext: tier.nextMin !== null ? Math.max(0, tier.nextMin - weekPoints) : null,
    nextTier: tier.next,
    pct,
    resetDay,
  }
}

function medal(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export default function WeeklyLeagueCard({ data, overview }: WeeklyLeagueCardProps) {
  const { points, tier, tierColor, tierBg, tierIcon, pointsToNext, nextTier, pct, resetDay } = data
  const me = overview?.me ?? null
  const rankDelta = me && overview?.previous_rank
    ? overview.previous_rank - me.rank
    : null
  const weekLabel = overview
    ? `${format(new Date(`${overview.week_start}T12:00:00`), 'd MMM', { locale: pt })}–${format(new Date(`${overview.week_end}T12:00:00`), 'd MMM', { locale: pt })}`
    : null

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
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: tierBg,
        filter: 'blur(30px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierColor }} />
          <span style={{ fontSize: 11, color: tierColor, textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 600 }}>
            Liga Semanal
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
          {weekLabel ? `${weekLabel} · ` : ''}reinicia {resetDay}
        </span>
      </div>

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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text1)', lineHeight: 1 }}>
              {tier}
            </div>
            {me && (
              <span style={{ fontSize: 11, color: 'var(--text2)', background: 'var(--bg3)', padding: '4px 8px', borderRadius: 999 }}>
                rank #{me.rank} / {overview?.total_players ?? 1}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {points} pts esta semana
            {rankDelta !== null && (
              <span style={{ color: rankDelta > 0 ? 'var(--teal)' : rankDelta < 0 ? '#E24B4A' : 'var(--text3)' }}>
                {' '}· {rankDelta > 0 ? `subiste ${rankDelta}` : rankDelta < 0 ? `desceste ${Math.abs(rankDelta)}` : 'sem mudança'}
              </span>
            )}
          </div>
        </div>
      </div>

      {pointsToNext !== null ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Progresso do tier</span>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--bg3)', overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: tierColor, transition: 'width .25s ease' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: overview ? 14 : 0 }}>
            Faltam <span style={{ color: tierColor, fontWeight: 700 }}>{pointsToNext} pts</span> para {nextTier}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--teal)', marginBottom: overview ? 14 : 0 }}>
          Estás no topo da liga esta semana.
        </div>
      )}

      {overview && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Participantes</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, lineHeight: 1, color: 'var(--text1)', fontWeight: 700 }}>
                {overview.total_players}
              </div>
            </div>
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Semana passada</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, lineHeight: 1, color: 'var(--text1)', fontWeight: 700 }}>
                {overview.previous_rank ? `#${overview.previous_rank}` : '—'}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>Top da semana</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {overview.top.map(player => (
                <div key={player.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, textAlign: 'center', fontSize: 15 }}>{medal(player.rank)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: player.user_id === me?.user_id ? 700 : 500 }}>
                      {player.username}{player.user_id === me?.user_id ? ' · tu' : ''}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{player.title} · nível {player.level}</div>
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, color: player.user_id === me?.user_id ? tierColor : 'var(--text2)' }}>
                    {player.points}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {overview.history.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {overview.history.map(item => (
                <div key={item.week_start} style={{ minWidth: 112, background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>
                    {format(new Date(`${item.week_start}T12:00:00`), 'd MMM', { locale: pt })}
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)', lineHeight: 1, marginBottom: 4 }}>
                    {item.points} pts
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)' }}>
                    {item.tier}{item.rank ? ` · #${item.rank}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
