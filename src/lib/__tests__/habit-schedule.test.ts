import { describe, it, expect } from 'vitest'
import {
  timeWindowSortKey, sortByTimeWindow, normalizeDays, isHabitDueOn, frequencyLabel,
} from '@/lib/habit-schedule'

describe('timeWindowSortKey', () => {
  it('extrai a hora de início de um intervalo', () => {
    expect(timeWindowSortKey('07:00-09:00')).toBe(7 * 60)
    expect(timeWindowSortKey('18:00-19:30')).toBe(18 * 60)
  })
  it('aceita hora solta', () => {
    expect(timeWindowSortKey('21:15')).toBe(21 * 60 + 15)
  })
  it('mapeia rótulos de período (manhã < noite)', () => {
    expect(timeWindowSortKey('Manhã')).toBeLessThan(timeWindowSortKey('Noite'))
    expect(timeWindowSortKey('Tarde')).toBeLessThan(timeWindowSortKey('Noite'))
  })
  it('põe "todo o dia" e desconhecidos no fim', () => {
    expect(timeWindowSortKey('Todo o dia')).toBeGreaterThan(timeWindowSortKey('23:00'))
    expect(timeWindowSortKey(null)).toBeGreaterThan(timeWindowSortKey('Todo o dia'))
  })
})

describe('sortByTimeWindow', () => {
  it('ordena de manhã para noite, com untimed no fim', () => {
    const input = [
      { name: 'Leitura', time_window: '21:00-22:00' },
      { name: 'Água', time_window: 'Todo o dia' },
      { name: 'Treino', time_window: '07:00-09:00' },
      { name: 'Almoço saudável', time_window: 'Almoço' },
    ]
    expect(sortByTimeWindow(input).map((h) => h.name)).toEqual([
      'Treino', 'Almoço saudável', 'Leitura', 'Água',
    ])
  })
})

describe('normalizeDays', () => {
  it('null/[] e 7 dias viram null (todos os dias)', () => {
    expect(normalizeDays(null)).toBeNull()
    expect(normalizeDays([])).toBeNull()
    expect(normalizeDays([0, 1, 2, 3, 4, 5, 6])).toBeNull()
  })
  it('remove duplicados, ordena e filtra inválidos', () => {
    expect(normalizeDays([3, 1, 1, 9, -1, 5])).toEqual([1, 3, 5])
  })
})

describe('isHabitDueOn', () => {
  const monday = new Date('2026-06-29T12:00:00') // segunda-feira
  const sunday = new Date('2026-06-28T12:00:00') // domingo
  it('sem days = todos os dias', () => {
    expect(isHabitDueOn(null, monday)).toBe(true)
    expect(isHabitDueOn([], sunday)).toBe(true)
  })
  it('respeita dias específicos', () => {
    expect(isHabitDueOn([1, 3, 5], monday)).toBe(true)  // seg
    expect(isHabitDueOn([1, 3, 5], sunday)).toBe(false) // dom
  })
})

describe('frequencyLabel', () => {
  it('rótulos legíveis', () => {
    expect(frequencyLabel(null)).toBe('Todos os dias')
    expect(frequencyLabel([1, 2, 3, 4, 5])).toBe('Dias úteis')
    expect(frequencyLabel([0, 6])).toBe('Fim de semana')
    expect(frequencyLabel([3])).toBe('Quarta')
    expect(frequencyLabel([1, 3, 5])).toBe('3x · Seg, Qua, Sex')
  })
})
