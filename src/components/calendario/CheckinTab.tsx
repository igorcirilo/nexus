'use client'

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import Icon from '@/components/ui/Icon'
import { PHASE_ICONS, PHASE_LABELS, type Checkin } from '@/components/calendario/types'

interface CheckinTabProps {
  todayCI: Checkin[]
}

export default function CheckinTab({ todayCI }: CheckinTabProps) {
  return (
    <div style={{ padding: '14px 20px 0' }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
        {format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })}
      </div>
      {(['manha', 'tarde', 'noite'] as const).map(phase => {
        const checkin = todayCI.find(item => item.phase === phase)
        return (
          <div
            key={phase}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 14,
              marginBottom: 8,
              background: checkin ? 'rgba(30,203,180,.05)' : 'var(--bg2)',
              border: checkin ? '0.5px solid rgba(30,203,180,.22)' : '0.5px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: checkin ? 'rgba(30,203,180,.1)' : 'var(--bg3)',
                color: checkin ? 'var(--teal)' : 'var(--text3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name={PHASE_ICONS[phase]} size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: checkin ? 'var(--text1)' : 'var(--text3)', marginBottom: checkin ? 4 : 0 }}>
                Check-in da {PHASE_LABELS[phase]}
              </div>
              {checkin ? (
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {checkin.energy && `Energia ${checkin.energy}/10`}{checkin.sleep_hours && ` · Sono ${checkin.sleep_hours}h`}
                  {checkin.mission && phase === 'manha' && <div style={{ fontStyle: 'italic', color: 'var(--text3)' }}>&ldquo;{checkin.mission}&rdquo;</div>}
                  {checkin.win_of_day && (
                    <div style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Icon name="trophy" size={13} />
                      {checkin.win_of_day}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Por fazer</div>
              )}
            </div>
            {checkin ? (
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 5 }}>
                +{checkin.xp_earned} XP
                <Icon name="check" size={14} />
              </div>
            ) : (
              <a
                href="/checkin"
                style={{
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 14px',
                  borderRadius: 10,
                  background: 'var(--gold)',
                  color: 'var(--bg0)',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontFamily: 'Syne, sans-serif',
                  fontWeight: 700,
                  flexShrink: 0,
                  touchAction: 'manipulation',
                }}
              >
                Fazer
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
