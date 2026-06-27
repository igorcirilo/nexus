import { describe, it, expect } from 'vitest'
import { buildMentorRead, type MentorReadCtx } from '@/lib/mentor-read'

function base(over: Partial<MentorReadCtx> = {}): MentorReadCtx {
  return {
    phase: 'manha',
    energy: 6,
    streak: 12,
    habitsLeft: 1,
    habitsTotal: 6,
    nextEvent: null,
    reminder: null,
    ...over,
  }
}

describe('lib/mentor-read · leitura do dia', () => {
  it('abre pela série quando está forte', () => {
    expect(buildMentorRead(base())).toContain('Série de 12 dias')
  })

  it('baixa o tom com energia baixa', () => {
    expect(buildMentorRead(base({ energy: 2 }))).toContain('Energia baixa')
  })

  it('inclui hábitos por fazer, evento e lembrete', () => {
    const t = buildMentorRead(base({
      habitsLeft: 2,
      nextEvent: { title: 'Treino', time: '18:00:00' },
      reminder: { title: 'Pagar renda' },
    }))
    expect(t).toContain('Faltam 2 hábitos')
    expect(t).toContain('Treino às 18:00')
    expect(t).toContain('pagar renda')
    expect(t).toContain('já te organizei o resto')
  })

  it('diz quando os hábitos estão todos feitos', () => {
    expect(buildMentorRead(base({ habitsLeft: 0 }))).toContain('todos feitos')
  })

  it('sem cláusulas extra, devolve só o opener', () => {
    const t = buildMentorRead(base({ habitsTotal: 0, habitsLeft: 0, streak: 0, energy: 6 }))
    expect(t).toBe('Novo dia para agir.')
  })
})
