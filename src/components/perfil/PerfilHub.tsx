'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Profile, UserBadge } from '@/types'
import { getTheme, toggleTheme, darkCardInk } from '@/lib/theme'

const FONT = 'Inter, sans-serif'

type Section = 'corpo'

const ALL_BADGES = [
  { key: 'primeiro_checkin', name: 'Primeira Vez', icon: '🌅', color: '#F5C842' },
  { key: 'streak_7',         name: 'Uma Semana',   icon: '🔥', color: '#F5C842' },
  { key: 'streak_21',        name: 'Três Semanas', icon: '⚡', color: '#9D5CF5' },
  { key: 'streak_100',       name: 'Centenário',   icon: '💎', color: '#00D4C8' },
  { key: 'ritmo_80',         name: 'Em Chamas',    icon: '🚀', color: '#F5C842' },
  { key: 'consistencia_30',  name: 'Inabalável',   icon: '🏔️', color: '#9D5CF5' },
]

const NAV_SECTIONS: { section: Section; label: string; sub: string; icon: string; color: string }[] = [
  { section: 'corpo', label: 'Corpo & Físico', sub: 'Medidas, água e treinos', icon: '💪', color: '#00C896' },
]

interface Props {
  profile: Profile
  ritmo: number
  badges: UserBadge[]
  email: string
  onEdit: (section?: Section) => void
  onEditAll?: () => void
  onLogout: () => void
  onPhotoSelect?: (file: File) => void
  photoUploading?: boolean
  journeyData?: { trainingCount30d: number; readingPages30d: number }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'rgba(var(--ink-rgb),0.3)',
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

export default function PerfilHub({ profile, ritmo, badges, email, onEdit, onEditAll, onLogout, onPhotoSelect, photoUploading, journeyData }: Props) {
  const earnedKeys = new Set(badges.map(b => b.badge_key))
  const earnedBadges = ALL_BADGES.filter(b => earnedKeys.has(b.key))
  const lockedBadges = ALL_BADGES.filter(b => !earnedKeys.has(b.key))
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem('nexus-notif') === '1'
  })
  // Começa em 'dark' no servidor; sincroniza com o tema real após montar.
  const [isDark, setIsDark] = useState(true)
  useEffect(() => { setIsDark(getTheme() === 'dark') }, [])

  const initial = (profile.username ?? email ?? 'U').charAt(0).toUpperCase()
  const ritmoPct = Math.min(100, Math.max(0, ritmo))

  return (
    <div style={{ fontFamily: FONT, background: 'var(--surface-page)', minHeight: '100dvh', paddingBottom: 40 }}>

      {/* ── Hero Section ── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(127,119,221,0.20) 0%, var(--surface-page) 100%)',
        padding: '40px 22px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative',
      }}>
        {/* Edit button */}
        <button
          onClick={() => (onEditAll ? onEditAll() : onEdit())}
          style={{
            position: 'absolute', top: 20, right: 20,
            height: 34, borderRadius: 11, padding: '0 13px',
            background: 'rgba(245,200,66,0.14)', border: '1px solid rgba(245,200,66,0.4)',
            display: 'flex', alignItems: 'center', gap: 7,
            color: '#F5C842', cursor: 'pointer',
            fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
          }}
          aria-label="Editar perfil"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar
        </button>

        {/* Foto de perfil com anel cónico + input de foto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file && onPhotoSelect) onPhotoSelect(file)
            e.target.value = ''
          }}
        />
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <div style={{
            width: 92, height: 92, borderRadius: '50%',
            background: 'conic-gradient(#F5C842 0deg, #9D5CF5 120deg, #00D4C8 240deg, #F5C842 360deg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt="Foto de perfil"
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  objectFit: 'cover', display: 'block',
                  opacity: photoUploading ? 0.5 : 1,
                }}
              />
            ) : (
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, #F5C842 0%, #E07B2A 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 900, color: '#0A0800',
                opacity: photoUploading ? 0.5 : 1,
              }}>
                {initial}
              </div>
            )}
          </div>
          {onPhotoSelect && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              aria-label="Alterar foto de perfil"
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 30, height: 30, borderRadius: '50%',
                background: '#F5C842', border: '3px solid #0B0B1A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: photoUploading ? 'wait' : 'pointer', fontSize: 13, padding: 0,
              }}
            >
              📷
            </button>
          )}
        </div>

        {/* Username */}
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.3px' }}>
          {profile.username ?? 'Sem nome'}
        </div>

        {/* Level badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
        }}>
          {(profile.title) && (
            <div style={{ fontSize: 12, color: 'rgba(var(--ink-rgb),0.4)', fontWeight: 500 }}>
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

        {/* Ritmo bar */}
        <div style={{ width: '100%', maxWidth: 320, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.4)' }}>Ritmo {ritmo}</span>
            <span style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.4)' }}>Nível {profile.level} · {profile.title}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(var(--ink-rgb),0.07)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${ritmoPct}%`,
              background: 'linear-gradient(90deg, #9D5CF5, #00D4C8)', borderRadius: 6,
            }} />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 360 }}>
          {[
            { label: 'Ritmo',     value: ritmo,                    icon: '⚡', color: '#F5C842' },
            { label: 'Sequência', value: profile.streak_current,   icon: '🔥', color: '#FF6B6B' },
            { label: 'Recorde',   value: profile.streak_best,      icon: '🏆', color: '#00D4C8' },
            { label: 'Badges',    value: earnedBadges.length,      icon: '🎖️', color: '#9D5CF5' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: 'rgba(var(--ink-rgb),0.04)',
              border: '1px solid rgba(var(--ink-rgb),0.07)',
              borderRadius: 14, padding: '11px 6px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, lineHeight: 1, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(var(--ink-rgb),0.4)', fontWeight: 500, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>

        {/* ── Streak banner ── */}
        {profile.streak_current > 0 && (
          <div style={{
            ...darkCardInk,
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
              <div style={{ fontSize: 10, color: 'rgba(var(--ink-rgb),0.3)', marginBottom: 2 }}>Máximo</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(var(--ink-rgb),0.6)' }}>
                {profile.streak_best}d
              </div>
            </div>
          </div>
        )}

        {/* ── Sua jornada ── */}
        {journeyData && (
          <>
            <SectionLabel>Sua jornada (30d)</SectionLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                flex: 1, background: 'rgba(0,200,150,0.07)',
                border: '1px solid rgba(0,200,150,0.18)',
                borderRadius: 16, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(0,200,150,0.7)', marginBottom: 6 }}>
                  Treinos
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#00C896', lineHeight: 1 }}>
                  {journeyData.trainingCount30d}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.3)', marginTop: 4 }}>sessões</div>
              </div>
              <div style={{
                flex: 1, background: 'rgba(157,92,245,0.07)',
                border: '1px solid rgba(157,92,245,0.18)',
                borderRadius: 16, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(157,92,245,0.7)', marginBottom: 6 }}>
                  Páginas lidas
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#9D5CF5', lineHeight: 1 }}>
                  {journeyData.readingPages30d}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.3)', marginTop: 4 }}>páginas</div>
              </div>
            </div>
          </>
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
                  fontSize: 24,
                }}>
                  {b.icon}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: 'rgba(var(--ink-rgb),0.6)',
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
                  background: 'rgba(var(--ink-rgb),0.04)', border: '1px solid rgba(var(--ink-rgb),0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(var(--ink-rgb),0.6)', textAlign: 'center', lineHeight: 1.3 }}>
                  {b.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: 'rgba(var(--ink-rgb),0.03)', border: '1px dashed rgba(var(--ink-rgb),0.08)',
            borderRadius: 16, padding: '18px 16px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'rgba(var(--ink-rgb),0.3)' }}>Faz check-in diário para desbloquear conquistas</div>
          </div>
        )}

        {/* ── Áreas (movidas da navbar) ── */}
        <SectionLabel>Áreas</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { href: '/habitos',   label: 'Hábitos',   sub: 'Os teus hábitos diários',      icon: '✅', color: '#00C896' },
            { href: '/progresso', label: 'Progresso', sub: 'Evolução, estatísticas e ligas', icon: '📈', color: '#00D4C8' },
            { href: '/objetivos', label: 'Objetivos', sub: 'Metas e desafios de longo prazo', icon: '🎯', color: '#F5C842' },
          ].map((item, idx, arr) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(var(--ink-rgb),0.03)',
                border: '1px solid rgba(var(--ink-rgb),0.06)',
                borderRadius: idx === 0 ? '14px 14px 4px 4px' : idx === arr.length - 1 ? '4px 4px 14px 14px' : '4px',
                padding: '14px 16px', textDecoration: 'none', fontFamily: FONT,
              } as CSSProperties}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: hexAlpha(item.color, 0.12),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(var(--ink-rgb),0.9)', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.35)', fontWeight: 400 }}>{item.sub}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </a>
          ))}
        </div>

        {/* ── Configurar perfil ── */}
        <SectionLabel>Configurar perfil</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_SECTIONS.map((item, idx) => (
            <button
              key={item.section}
              onClick={() => onEdit(item.section)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: 'rgba(var(--ink-rgb),0.03)',
                border: '1px solid rgba(var(--ink-rgb),0.06)',
                borderRadius: NAV_SECTIONS.length === 1 ? 14 : idx === 0 ? '14px 14px 4px 4px' : idx === NAV_SECTIONS.length - 1 ? '4px 4px 14px 14px' : '4px',
                padding: '14px 16px',
                cursor: 'pointer', textAlign: 'left',
                fontFamily: FONT,
              } as CSSProperties}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: hexAlpha(item.color, 0.12),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(var(--ink-rgb),0.9)', marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.35)', fontWeight: 400 }}>
                  {item.sub}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--ink-rgb),0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>

        {/* ── Preferências ── */}
        <SectionLabel>Preferências</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Tema — alterna entre claro e escuro */}
          <button
            onClick={() => setIsDark(toggleTheme() === 'dark')}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid rgba(var(--ink-rgb),0.06)',
              borderRadius: '14px 14px 4px 4px', padding: '14px 16px', cursor: 'pointer',
              fontFamily: FONT,
            } as CSSProperties}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(245,200,66,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isDark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(var(--ink-rgb),0.9)', marginBottom: 2 }}>{isDark ? 'Modo escuro' : 'Modo claro'}</div>
              <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.35)' }}>Toca para alternar</div>
            </div>
            <div style={{
              width: 44, height: 26, borderRadius: 13,
              background: isDark ? '#F5C842' : 'rgba(var(--ink-rgb),0.15)',
              position: 'relative', flexShrink: 0, transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: isDark ? 'auto' : 3, right: isDark ? 3 : 'auto',
                width: 20, height: 20, borderRadius: '50%', background: isDark ? '#0A0800' : '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'all 0.2s',
              }} />
            </div>
          </button>

          {/* Notifications toggle */}
          <button
            onClick={() => {
              const next = !notifEnabled
              if (next && typeof Notification !== 'undefined') {
                Notification.requestPermission()
              }
              localStorage.setItem('nexus-notif', next ? '1' : '0')
              setNotifEnabled(next)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              background: 'rgba(var(--ink-rgb),0.03)', border: '1px solid rgba(var(--ink-rgb),0.06)',
              borderRadius: '4px 4px 14px 14px', padding: '14px 16px', cursor: 'pointer',
              fontFamily: FONT,
            } as CSSProperties}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: 'rgba(0,212,200,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4C8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(var(--ink-rgb),0.9)', marginBottom: 2 }}>Notificações</div>
              <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.35)' }}>{notifEnabled ? 'Ativas' : 'Desativadas'}</div>
            </div>
            <div style={{
              width: 44, height: 26, borderRadius: 13,
              background: notifEnabled ? '#00D4C8' : 'rgba(var(--ink-rgb),0.1)',
              position: 'relative', flexShrink: 0,
              transition: 'background 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 3,
                left: notifEnabled ? 'auto' : 3,
                right: notifEnabled ? 3 : 'auto',
                width: 20, height: 20, borderRadius: '50%',
                background: notifEnabled ? 'var(--surface-page)' : 'rgba(var(--ink-rgb),0.4)',
                transition: 'left 0.2s, right 0.2s',
              }} />
            </div>
          </button>
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

        <div style={{ fontSize: 11, color: 'rgba(var(--ink-rgb),0.2)', textAlign: 'center', marginTop: 8 }}>
          {email}
        </div>

      </div>
    </div>
  )
}
