import { describe, it, expect } from 'vitest'
import { todayISO, parseLocalDate, formatLocalDate } from '@/lib/date'

describe('lib/date', () => {
  it('todayISO devolve a data local no formato yyyy-MM-dd', () => {
    const result = todayISO()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('parseLocalDate ancora ao meio-dia local, evitando off-by-one por timezone', () => {
    const d = parseLocalDate('2026-06-15')
    // Em qualquer fuso, o dia local tem de continuar a ser 15 (não 14 nem 16).
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // Junho (0-indexado)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(12)
  })

  it('formatLocalDate formata uma string de data sem deslocar o dia', () => {
    expect(formatLocalDate('2026-01-01', 'yyyy-MM-dd')).toBe('2026-01-01')
    expect(formatLocalDate('2026-12-31', 'yyyy-MM-dd')).toBe('2026-12-31')
  })
})
