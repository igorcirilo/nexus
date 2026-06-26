'use client'

import Icon from '@/components/ui/Icon'
import type { CheckinPhase } from '@/types'

interface MentorInsightProps {
  phase: CheckinPhase
  mission: string | null
  missionProgress: number
  mentorBody: string
  primaryAction: string
  checkinPending: boolean
  dismissed: boolean
  onDismiss: () => void
  onMissionProgress: (pct: number) => void
}

const NO_MISSION_PLACEHOLDER = 'Definir a missão no check-in da manhã'

export default function MentorInsight({
  phase,
  mission,
  missionProgress,
  mentorBody,
  primaryAction,
  checkinPending,
  dismissed,
  onDismiss,
  onMissionProgress,
}: MentorInsightProps) {
  const hasMission = Boolean(mission && mission.length > 0 && mission !== NO_MISSION_PLACEHOLDER)

  // When dismissed: only keep the card if mission is set (compact read-only state).
  if (dismissed && !hasMission) return null

  const pct = Math.max(0, Math.min(100, missionProgress))
  const progressStep = Math.round(pct / 25)

  const ctaHref = checkinPending ? '/checkin' : null
  const ctaLabel = checkinPending
    ? phase === 'manha'
      ? 'Check-in da manhã'
      : phase === 'tarde'
      ? 'Check-in da tarde'
      : 'Check-in da noite'
    : null

  return (
    <section
      aria-label="Orientação do mentor"
      style={{
        margin: '14px 20px 0',
        borderRadius: 22,
        background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
        border: '0.5px solid rgba(var(--ink-rgb),.08)',
        borderLeft: '2px solid var(--gold)',
        boxShadow: '0 16px 46px rgba(0,0,0,.2)',
        overflow: 'hidden',
      }}
    >
      {/* Mission row — always shown when mission is set */}
      {hasMission && (
        <div
          style={{
            padding: '14px 18px',
            borderBottom: dismissed ? 'none' : '0.5px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                fontWeight: 700,
                marginBottom: 5,
              }}
            >
              Missão de hoje
            </div>
            <p
              style={{
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontWeight: 600,
                fontSize: 14,
                lineHeight: 1.4,
                color: 'var(--text1)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {mission}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
              flexShrink: 0,
              paddingTop: 2,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: progressStep >= 5 ? 'var(--teal)' : 'var(--text3)',
              }}
            >
              {progressStep}/5
            </span>
            <div style={{ display: 'flex', gap: 5 }}>
              {[1, 2, 3, 4, 5].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => onMissionProgress(step === 1 ? 0 : (step - 1) * 25)}
                  aria-label={`Definir progresso na etapa ${step}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: 'none',
                    padding: 0,
                    background: step <= progressStep ? 'var(--gold)' : 'var(--bg3)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mentor body + action — hidden after dismiss */}
      {!dismissed && (
        <div style={{ padding: '14px 18px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                background: 'rgba(232,168,56,.12)',
                color: 'var(--gold)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="zap" size={15} />
            </span>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text2)', marginTop: 3 }}>
              {mentorBody}
            </p>
          </div>

          {primaryAction && (
            <p
              style={{
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontWeight: 700,
                fontSize: 16,
                lineHeight: 1.25,
                color: 'var(--text1)',
              }}
            >
              {primaryAction}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {ctaHref && (
              <a
                href={ctaHref}
                style={{
                  flex: 1,
                  minHeight: 46,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  padding: '0 16px',
                  background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
                  color: 'var(--on-bright)',
                  textDecoration: 'none',
                  fontFamily: 'Syne, sans-serif',
                  fontSize: 14,
                  fontWeight: 800,
                  touchAction: 'manipulation',
                  boxShadow: '0 8px 20px rgba(232,168,56,.18)',
                }}
              >
                {ctaLabel}
              </a>
            )}
            <button
              type="button"
              onClick={onDismiss}
              style={{
                minHeight: 46,
                border: 'none',
                background: 'transparent',
                color: 'var(--text3)',
                padding: '0 8px',
                fontFamily: 'var(--font-dm), "DM Sans", sans-serif',
                fontSize: 14,
                cursor: 'pointer',
                touchAction: 'manipulation',
                flexShrink: 0,
              }}
            >
              Depois
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
