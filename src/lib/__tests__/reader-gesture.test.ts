import { describe, it, expect } from 'vitest'
import {
  decideSwipe,
  swipeThreshold,
  SWIPE_THRESHOLD_MIN,
  SWIPE_THRESHOLD_MAX,
  type TouchGesture,
  type TouchGestureEnd,
} from '@/lib/reader-gesture'

function start(over: Partial<TouchGesture> = {}): TouchGesture {
  return { x: 200, y: 300, time: 1_000, selection: '', valid: true, ...over }
}

function end(over: Partial<TouchGestureEnd> = {}): TouchGestureEnd {
  // 390px = iPhone típico; limiar = 390 * 0.18 ≈ 70px.
  return { x: 200, y: 300, time: 1_200, selection: '', viewportWidth: 390, ...over }
}

describe('decideSwipe', () => {
  it('vira para a frente num arrasto rápido para a esquerda', () => {
    expect(decideSwipe(start(), end({ x: 80 }))).toBe('next')
  })

  it('vira para trás num arrasto rápido para a direita', () => {
    expect(decideSwipe(start(), end({ x: 320 }))).toBe('prev')
  })

  it('ignora arrastos curtos', () => {
    expect(decideSwipe(start(), end({ x: 200 - 69 }))).toBeNull()
  })

  it('exige mais percurso num ecrã largo do que num estreito', () => {
    const dx = 100
    expect(decideSwipe(start(), end({ x: 200 - dx, viewportWidth: 390 }))).toBe('next')
    expect(decideSwipe(start(), end({ x: 200 - dx, viewportWidth: 820 }))).toBeNull()
  })

  it('ignora arrastos demasiado diagonais (scroll)', () => {
    expect(decideSwipe(start(), end({ x: 100, y: 380 }))).toBeNull()
  })

  it('ignora arrastos lentos (long-press a selecionar)', () => {
    expect(decideSwipe(start(), end({ x: 80, time: 1_700 }))).toBeNull()
  })

  it('ignora o gesto que criou uma seleção de texto', () => {
    expect(decideSwipe(start(), end({ x: 80, selection: 'trecho copiado' }))).toBeNull()
  })

  it('ignora o gesto que alterou uma seleção existente', () => {
    const s = start({ selection: 'trecho' })
    expect(decideSwipe(s, end({ x: 80, selection: 'trecho maior' }))).toBeNull()
  })

  it('vira a página quando a seleção já existia e não mudou', () => {
    const s = start({ selection: 'trecho' })
    expect(decideSwipe(s, end({ x: 80, selection: 'trecho' }))).toBe('next')
  })

  it('ignora gestos marcados como inválidos (multitoque ou controlos)', () => {
    expect(decideSwipe(start({ valid: false }), end({ x: 80 }))).toBeNull()
  })
})

describe('swipeThreshold', () => {
  it('escala com a largura do ecrã', () => {
    expect(swipeThreshold(390)).toBeCloseTo(70.2)
    expect(swipeThreshold(430)).toBeCloseTo(77.4)
  })

  it('não desce abaixo do mínimo em ecrãs estreitos', () => {
    expect(swipeThreshold(320)).toBe(SWIPE_THRESHOLD_MIN)
  })

  it('não sobe acima do máximo em ecrãs largos', () => {
    expect(swipeThreshold(1440)).toBe(SWIPE_THRESHOLD_MAX)
  })
})
