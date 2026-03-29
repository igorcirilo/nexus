'use client'

import { getAvatarProgress, getAvatarStage } from '@/lib/evolution'

type EvolutionAvatarProps = {
  level?: number
  streak?: number
  xp?: number
  name?: string
}

const stageStyles = {
  seed: {
    glow: '0 0 0 1px rgba(120, 200, 120, 0.18), 0 18px 50px rgba(120, 200, 120, 0.10)',
    ring: 'rgba(120, 200, 120, 0.32)',
    bg: 'radial-gradient(circle at top, rgba(120,200,120,0.22), rgba(18,21,29,1) 62%)',
  },
  spark: {
    glow: '0 0 0 1px rgba(255, 215, 120, 0.18), 0 18px 50px rgba(255, 215, 120, 0.12)',
    ring: 'rgba(255, 215, 120, 0.32)',
    bg: 'radial-gradient(circle at top, rgba(255,215,120,0.22), rgba(18,21,29,1) 62%)',
  },
  builder: {
    glow: '0 0 0 1px rgba(140, 170, 255, 0.18), 0 18px 50px rgba(140, 170, 255, 0.12)',
    ring: 'rgba(140, 170, 255, 0.32)',
    bg: 'radial-gradient(circle at top, rgba(140,170,255,0.22), rgba(18,21,29,1) 62%)',
  },
  ascendant: {
    glow: '0 0 0 1px rgba(255, 140, 120, 0.18), 0 18px 50px rgba(255, 140, 120, 0.12)',
    ring: 'rgba(255, 140, 120, 0.32)',
    bg: 'radial-gradient(circle at top, rgba(255,140,120,0.22), rgba(18,21,29,1) 62%)',
  },
  master: {
    glow: '0 0 0 1px rgba(212,175,55,0.22), 0 18px 50px rgba(212,175,55,0.16)',
    ring: 'rgba(212,175,55,0.35)',
    bg: 'radial-gradient(circle at top, rgba(212,175,55,0.24), rgba(18,21,29,1) 62%)',
  },
} as const

export default function EvolutionAvatar({
  level = 1,
  streak = 0,
  xp = 0,
  name = 'Explorador',
}: EvolutionAvatarProps) {
  const stage = getAvatarStage(level, streak)
  const progress = getAvatarProgress(level, streak)
  const style = stageStyles[stage.key]

  return (
    <section
      className="rounded-[28px] p-5"
      style={{
        background: style.bg,
        boxShadow: style.glow,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-[34px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${style.ring}`,
            boxShadow: `inset 0 0 24px rgba(255,255,255,0.03), 0 0 30px ${style.ring}`,
          }}
        >
          {stage.emoji}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <div className="text-[12px] uppercase tracking-[0.18em] text-text-3">
            Avatar evolutivo
          </div>
          <h2 className="font-syne text-[22px] font-bold text-text-1">
            {name}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-text-2">
            <span>{stage.label}</span>
            <span>•</span>
            <span>Nível {level}</span>
            <span>•</span>
            <span>{streak} dias</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-left text-[14px] leading-relaxed text-text-2">
        {stage.subtitle}
      </p>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[12px] text-text-3">
          <span>{stage.progressLabel}</span>
          <span>{progress}%</span>
        </div>

        <div
          className="h-2.5 overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, rgba(212,175,55,0.95), rgba(255,255,255,0.92))',
            }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-[11px] text-text-3">XP total</div>
          <div className="mt-1 text-[18px] font-bold text-text-1">{xp}</div>
        </div>

        <div className="rounded-2xl p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-[11px] text-text-3">Streak</div>
          <div className="mt-1 text-[18px] font-bold text-text-1">{streak}</div>
        </div>

        <div className="rounded-2xl p-3 text-left" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="text-[11px] text-text-3">Estágio</div>
          <div className="mt-1 text-[18px] font-bold text-text-1">{stage.label}</div>
        </div>
      </div>
    </section>
  )
}
