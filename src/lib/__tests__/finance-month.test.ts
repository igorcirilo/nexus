import { describe, it, expect } from 'vitest'
import { monthsBack, isFutureMonth, monthProgress, historyMonthsFor } from '@/lib/finance-month'

// 17 de março de 2026, um mês de 31 dias.
const now = new Date(2026, 2, 17)
const m = (year: number, month: number) => new Date(year, month, 1)

describe('monthsBack', () => {
  it('conta zero no mês corrente', () => {
    expect(monthsBack(m(2026, 2), now)).toBe(0)
  })

  it('conta meses para trás, atravessando o ano', () => {
    expect(monthsBack(m(2026, 1), now)).toBe(1)
    expect(monthsBack(m(2025, 11), now)).toBe(3)
    expect(monthsBack(m(2025, 2), now)).toBe(12)
  })

  it('fica negativo num mês futuro', () => {
    expect(monthsBack(m(2026, 3), now)).toBe(-1)
  })
})

describe('isFutureMonth', () => {
  it('o mês corrente não é futuro', () => {
    expect(isFutureMonth(m(2026, 2), now)).toBe(false)
  })

  it('reconhece o mês seguinte', () => {
    expect(isFutureMonth(m(2026, 3), now)).toBe(true)
  })

  it('não se deixa enganar por um dia mais avançado do mesmo mês', () => {
    expect(isFutureMonth(new Date(2026, 2, 31), now)).toBe(false)
  })
})

describe('monthProgress', () => {
  it('no mês corrente conta os dias até hoje', () => {
    expect(monthProgress(m(2026, 2), now)).toEqual({
      elapsedDays: 17, daysInMonth: 31, daysLeft: 14, isCurrent: true, isPast: false,
    })
  })

  it('num mês passado o mês inteiro já decorreu', () => {
    expect(monthProgress(m(2026, 1), now)).toEqual({
      elapsedDays: 28, daysInMonth: 28, daysLeft: 0, isCurrent: false, isPast: true,
    })
  })

  it('acerta em fevereiro de ano bissexto', () => {
    const p = monthProgress(m(2024, 1), new Date(2024, 5, 10))
    expect(p.daysInMonth).toBe(29)
    expect(p.elapsedDays).toBe(29)
  })

  it('não sobram dias no último dia do mês corrente', () => {
    const p = monthProgress(m(2026, 2), new Date(2026, 2, 31))
    expect(p.daysLeft).toBe(0)
    expect(p.isCurrent).toBe(true)
  })
})

describe('historyMonthsFor', () => {
  it('mantém a janela base no mês corrente', () => {
    expect(historyMonthsFor(m(2026, 2), now)).toBe(6)
  })

  it('alarga a janela na medida do recuo', () => {
    expect(historyMonthsFor(m(2026, 1), now)).toBe(7)
    expect(historyMonthsFor(m(2025, 8), now)).toBe(12)
  })

  it('nunca encolhe a janela num mês futuro', () => {
    expect(historyMonthsFor(m(2026, 5), now)).toBe(6)
  })
})
