'use client'

type Phase = 'manha' | 'tarde' | 'noite'

type NightSummaryProps = {
  open: boolean
  onClose: () => void
  xpEarned: number
  streakCurrent: number
  completedPhases: Phase[]
  bestStreak?: number
}

const PHASE_LABELS: Record<Phase, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

function getNightMessage(doneCount: number, streak: number, bestStreak: number) {
  if (doneCount === 3 && streak >= 7) {
    return 'Fechaste o dia com força. Estás a consolidar identidade.'
  }
  if (doneCount === 3) {
    return 'Dia completo. Mantém o ritmo amanhã.'
  }
  if (doneCount === 2 && bestStreak > 0 && streak === 0) {
    return 'Não foi perfeito, mas ainda estás no jogo. Amanhã recuperas.'
  }
  if (doneCount === 2) {
    return 'Bom dia. Mais um pequeno ajuste e ficas sólido.'
  }
  return 'Mesmo um dia imperfeito ainda conta. Recomeça amanhã sem drama.'
}

export default function NightSummary({
  open,
  onClose,
  xpEarned,
  streakCurrent,
  completedPhases,
  bestStreak = 0,
}: NightSummaryProps) {
  if (!open) return null

  const doneCount = completedPhases.length
  const message = getNightMessage(doneCount, streakCurrent, bestStreak)

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-4 pb-6 pt-16 sm:items-center">
      <div
        className="w-full max-w-md rounded-[28px] p-6 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(27,31,42,1) 0%, rgba(18,21,29,1) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 text-[12px] uppercase tracking-[0.18em] text-text-3">
              Fecho do dia
            </div>
            <h2 className="font-syne text-[24px] font-bold text-text-1">
              Resumo noturno
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[12px]"
            style={{ background: 'var(--bg3)', color: 'var(--text2)' }}
          >
            Fechar
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 text-left" style={{ background: 'var(--bg3)' }}>
            <div className="text-[11px] text-text-3">XP ganho</div>
            <div className="mt-1 text-[22px] font-bold text-text-1">+{xpEarned}</div>
          </div>

          <div className="rounded-2xl p-4 text-left" style={{ background: 'var(--bg3)' }}>
            <div className="text-[11px] text-text-3">Streak</div>
            <div className="mt-1 text-[22px] font-bold text-text-1">{streakCurrent}</div>
          </div>

          <div className="rounded-2xl p-4 text-left" style={{ background: 'var(--bg3)' }}>
            <div className="text-[11px] text-text-3">Fases</div>
            <div className="mt-1 text-[22px] font-bold text-text-1">{doneCount}/3</div>
          </div>
        </div>

        <div
          className="mb-5 rounded-2xl p-4 text-left"
          style={{
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.18)',
          }}
        >
          <div className="mb-2 text-[12px] font-semibold" style={{ color: 'var(--gold)' }}>
            Mensagem do dia
          </div>
          <p className="text-[14px] leading-relaxed text-text-2">{message}</p>
        </div>

        <div className="mb-6 text-left">
          <div className="mb-2 text-[12px] text-text-3">Fases concluídas</div>
          <div className="flex flex-wrap gap-2">
            {(['manha', 'tarde', 'noite'] as Phase[]).map(phase => {
              const done = completedPhases.includes(phase)
              return (
                <div
                  key={phase}
                  className="rounded-full px-3 py-2 text-[12px]"
                  style={{
                    background: done ? 'rgba(120, 200, 120, 0.12)' : 'var(--bg3)',
                    border: done
                      ? '1px solid rgba(120, 200, 120, 0.25)'
                      : '1px solid rgba(255,255,255,0.06)',
                    color: done ? '#a8e6a3' : 'var(--text3)',
                  }}
                >
                  {done ? '✓ ' : ''}
                  {PHASE_LABELS[phase]}
                </div>
              )
            })}
          </div>
        </div>

        <button onClick={onClose} className="btn-primary w-full">
          Fechar dia →
        </button>
      </div>
    </div>
  )
}