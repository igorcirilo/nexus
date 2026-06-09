'use client'

import type { CSSProperties } from 'react'
import type { Profile, UserBadge } from '@/types'

const FONT = 'Inter, sans-serif'

type Section = 'corpo' | 'metas' | 'objetivos' | 'xp'

const ALL_BADGES = [
  { key: 'primeiro_checkin', name: 'Primeira Vez', color: '#F5C842' },
  { key: 'streak_7',         name: 'Uma Semana',   color: '#F5C842' },
  { key: 'streak_21',        name: 'Três Semanas', color: '#9D5CF5' },
  { key: 'streak_100',       name: 'Centenário',   color: '#00D4C8' },
  { key: 'xp_1000',          name: 'Mil Pontos',   color: '#F5C842' },
  { key: 'xp_5000',          name: 'Veterano',     color: '#9D5CF5' },
]

const METAS_90 = [
  { key: 'goal_90_personal' as const, label: 'Pessoal', color: '#9D5CF5' },
  { key: 'goal_90_career'   as const, label: 'Carreira', color: '#00D4C8' },
  { key: 'goal_90_health'   as const, label: 'Saúde',    color: '#00C896' },
]

const NAV_SECTIONS: { section: Section; label: string; sub: string; color: string }[] = [
  { section: 'corpo',     label: 'Corpo & Físico',      sub: 'Peso, altura, idade, sexo', color: '#00C896' },
  { section: 'metas',     label: 'Metas & Hábitos',     sub: 'Água, treinos, sono, leitura', color: '#00D4C8' },
  { section: 'objetivos', label: 'Objetivos 90 Dias',   sub: 'Pessoal, carreira, saúde',  color: '#9D5CF5' },
  { section: 'xp',        label: 'XP & Desempenho',     sub: 'Meta semanal, taxa de conclusão', color: '#F5C842' },
]

interface Props {
  profile: Profile
  badges: UserBadge[]
  email: string
  onEdit: (section?: Section) => void
  onLogout: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
      marginBottom: 10, marginTop: 20,
    }}>
      {children}
    </div>
  )
}

function hexAlpha(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function PerfilHub({ profile, badges, email, onEdit, onLogout }: Props) {
  const earnedKeys = new Set(badges.map(b => b.badge_key))
  const earnedBadges = ALL_BADGES.filter(b => earnedKeys.has(b.key))
  const lockedBadges = ALL_BADGES.filter(b => !earnedKeys.has(b.key))

  const initial = (profile.username ?? email ?? 'U').charAt(0).toUpperCase()
  const xpToNextLevel = Math.max(0, (profile.level * 1000) - profile.xp_total)
  const xpPct = Math.min(100, Math.round(((profile.xp_total % 1000) / 1000) * 100))

  const activeMetas = METAS_90.filter(m => (profile[m.key] as string | null | undefined))

  return (
    <div style={{ fontFamily: FONT, background: '#07070F', minHeight: '100vh', paddingBottom: 28 }}>

      {/* ── Hero Section ── */}
      <div style={{
        background: 'linear-gradient(180deg, #10102A 0%, #07070F 100%)',
        padding: '40px 22px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
      }}>
        {/* Edit button */}
        <button
          onClick={() => onEdit()}
          style={{
            position: 'absolute', top: 20, right: 20,
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
          }}
          aria-label="Editar perfil"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        {/* Avatar with conic ring */}
        <div style={{
          width: 92, height: 92, borderRadius: '50%',
          background: 'conic-gradient(#F5C842 0deg, #9D5CF5 120deg, #00D4C8 240deg, #F5C842 360deg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#10102A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 900, color: '#fff',
          }}>
            {initial}
          </div>
        </div>

        {/* Username */}
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4, letterSpacing: '-0.3px' }}>
          {profile.username ?? 'Sem nome'}
        </div>

        {/* Level badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
        }}>
          {(profile.title) && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              {profile.title} ·
            </div>
          )}
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            background: 'rgba(245,200,66,0.12)', color: '#F5C842',
            borderRadius: 7, padding: '3px 10px',
          }}>
            NÍVEL {profile.level}
          </div>
        </div>

        {/* XP bar */}
        <div style={{ width: '100%', maxWidth: 320, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{profile.xp_total} XP total</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{xpToNextLevel} XP até Nível {profile.level + 1}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${xpPct}%`,
              background: 'linear-gradient(90deg, #9D5CF5, #00D4C8)', borderRadius: 6,
            }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 320 }}>
          {[
            { label: 'XP Total',  value: profile.xp_total,        color: '#F5C842' },
            { label: 'Sequência', value: profile.streak_current,   color: '#FF6B6B' },
            { label: 'Badges',    value: earnedBadges.length,      color: '#9D5CF5' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '12px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>

        {/* ── Streak banner ── */}
        {profile.streak_current > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #1A1000 0%, #201600 100%)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 18, padding: '16px 18px', marginTop: 20,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: 'rgba(245,200,66,0.12)', border: '1px solid rgba(245,200,66,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#F5C842">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(245,200,66,0.6)', marginBottom: 2 }}>
                Sequência activa
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#F5C842', lineHeight: 1 }}>
                {profile.streak_current} dias
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Máximo</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                {profile.streak_best}d
              </div>
            </div>
          </div>
        )}

        {/* ── Conquistas ── */}
        <SectionLabel>Conquistas</SectionLabel>
        {earnedBadges.length > 0 ? (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {earnedBadges.map(b => (
              <div key={b.key} style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 74,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: hexAlpha(b.color, 0.12), border: `1px solid ${hexAlpha(b.color, 0.3)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 900, color: b.color,
                }}>
                  {b.name.charAt(0)}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                  textAlign: 'center', lineHeight: 1.3,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {b.name}
                </div>
              </div>
            ))}
            {lockedBadges.slice(0, Math.max(0, 6 - earnedBadges.length)).map(b => (
              <div key={b.key} style={{
                flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 74, opacity: 0.3,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.3 }}>
                  {b.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '18px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Faz check-in diário para desbloquear conquistas</div>
          </div>
        )}

        {/* ── Metas 90 dias ── */}
        {activeMetas.length > 0 && (
          <>
            <SectionLabel>Metas 90 dias</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeMetas.map(m => (
                <div
                  key={m.key}
                  onClick={() => onEdit('objetivos')}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                    background: hexAlpha(m.color, 0.12),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: m.color,
                  }}>
                    {m.label.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: hexAlpha(m.color, 0.8), marginBottom: 4 }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, fontWeight: 500 }}>
                      {profile[m.key] as string}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Configurar perfil ── */}
        <SectionLabel>Configurar perfil</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_SECTIONS.map((item, idx) => (
            <button
              key={item.section}
              onClick={() => onEdit(item.section)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: idx === 0 ? '14px 14px 4px 4px' : idx === NAV_SECTIONS.length - 1 ? '4px 4px 14px 14px' : '4px',
                padding: '14px 16px',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: FONT,
              } as CSSProperties}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: hexAlpha(item.color, 0.12),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900, color: item.color,
              }}>
                {item.label.charAt(0)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                  {item.sub}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>

        {/* ── Logout ── */}
        <button
          onClick={onLogout}
          style={{
            marginTop: 20, width: '100%', padding: '14px',
            border: '1px solid rgba(226,75,74,0.25)',
            borderRadius: 14, background: 'transparent',
            color: '#E24B4A', fontFamily: FONT, fontWeight: 700,
            fontSize: 14, cursor: 'pointer',
          }}
        >
          Terminar sessão
        </button>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 8 }}>
          {email}
        </div>

      </div>
    </div>
  )
}
