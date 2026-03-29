'use client'
// src/components/MentorCard.tsx
interface Props { body: string; action: string }

export default function MentorCard({ body, action }: Props) {
  return (
    <div className="mx-5 mt-3 p-4 rounded-2xl flex gap-3"
         style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base mt-0.5"
           style={{ background: 'rgba(30,203,180,.1)', border: '0.5px solid rgba(30,203,180,.22)' }}>
        🧠
      </div>
      <div className="flex-1">
        <p className="text-[13px] leading-relaxed mb-2" style={{ color: 'var(--text2)' }}>
          {body}
        </p>
        <p className="text-[12px] leading-snug pt-2"
           style={{ color: 'var(--teal)', borderTop: '0.5px solid rgba(30,203,180,.13)' }}>
          {action}
        </p>
      </div>
    </div>
  )
}
