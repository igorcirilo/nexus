'use client'
// src/components/MentorCard.tsx
interface Props { body: string; action: string }

export default function MentorCard({ body, action }: Props) {
  return (
    <div style={{
      margin: '10px 20px 0',
      padding: '10px 14px',
      borderRadius: 12,
      background: 'var(--bg1)',
      border: '0.5px solid var(--border)',
      display: 'flex',
      gap: 10,
      alignItems: 'center',
    }}>
      <div style={{
        width: 30, height: 30, minWidth: 30,
        borderRadius: 9,
        background: 'rgba(30,203,180,.08)',
        border: '0.5px solid rgba(30,203,180,.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
      }}>🧠</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 4px 0' }}>
          {body}
        </p>
        <p style={{ fontSize: 11, color: 'var(--teal)', margin: 0, fontWeight: 600 }}>
          {action}
        </p>
      </div>
    </div>
  )
}
