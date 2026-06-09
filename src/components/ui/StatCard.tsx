'use client'

import Icon, { type IconName } from '@/components/ui/Icon'

interface StatCardProps {
  icon: IconName
  label: string
  value: string | number
  suffix?: string
  color: string
}

function tintFor(color: string) {
  if (color === 'var(--teal)') return 'rgba(30,203,180,.12)'
  if (color === 'var(--accent)') return 'rgba(127,119,221,.12)'
  if (color === 'var(--gold)') return 'rgba(232,168,56,.12)'
  return 'var(--bg3)'
}

export default function StatCard({ icon, label, value, suffix = '', color }: StatCardProps) {
  return (
    <div
      style={{
        minHeight: 78,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 7,
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 'var(--radius-sm)',
          background: tintFor(color),
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text3)', marginBottom: 3, whiteSpace: 'nowrap' }}>
          {label}
        </div>
        <div style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 500, fontSize: 19, color, lineHeight: 1.05, letterSpacing: 0, whiteSpace: 'nowrap' }}>
          {value}
          {suffix && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text3)' }}>{suffix}</span>}
        </div>
      </div>
    </div>
  )
}
