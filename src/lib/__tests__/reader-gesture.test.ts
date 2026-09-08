import { describe, it, expect } from 'vitest'
import { decideSwipe, type TouchGesture, type TouchGestureEnd } from '@/lib/reader-gesture'

function start(over: Partial<TouchGesture> = {}): TouchGesture {
  return { x: 200, y: 300, time: 1_000, selection: '', valid: true, ...over }
}

function end(over: Partial<TouchGestureEnd> = {}): TouchGestureEnd {
  return { x: 200, y: 300, time: 1_200, selection: '', ...over }
}

describe('decideSwipe', () => {
  it('vira para a frente num arrasto rápido para a esquerda', () => {
    expect(decideSwipe(start(), end({ x: 80 }))).toBe('next')
  })

  it('vira para trás num arrasto rápido para a direita', () => {
    expect(decideSwipe(start(), end({ x: 320 }))).toBe('prev')
  })

  it('ignora arrastos curtos', () => {
    expect(decideSwipe(start(), end({ x: 200 - 71 }))).toBeNull()
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
