'use client'

interface SectionHeaderProps {
  title: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 10 }}>
      <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text1)' }}>
        {title}
      </h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            minHeight: 44,
            border: 'none',
            background: 'transparent',
            color: 'var(--accent)',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
