'use client'
// src/components/MentorCard.tsx
interface Props { body: string; action: string }

export default function MentorCard({ body, action }: Props) {
  return (
    <div style={{
      margin: '12px 20px 0',
      padding: '14px 16px',
      borderRadius: 16,
      background: 'var(--bg1)',
      border: '0.5px solid var(--border)',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      {/* Avatar — tamanho fixo em px para o emoji não crescer */}
      <div style={{
        width: 36,
        height: 36,
        minWidth: 36,
        borderRadius: 10,
        background: 'rgba(30,203,180,.10)',
        border: '0.5px solid rgba(30,203,180,.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        lineHeight: 1,
        flexShrink: 0,
      }}>
        🧠
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13,
          color: 'var(--text2)',
          lineHeight: 1.6,
          margin: '0 0 10px 0',
        }}>
          {body}
        </p>
        <p style={{
          fontSize: 12,
          color: 'var(--teal)',
          lineHeight: 1.5,
          margin: 0,
          paddingTop: 8,
          borderTop: '0.5px solid rgba(30,203,180,.13)',
        }}>
          {action}
        </p>
      </div>
    </div>
  )
}
