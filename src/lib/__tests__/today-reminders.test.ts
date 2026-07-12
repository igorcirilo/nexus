import { describe, it, expect } from 'vitest'
import { buildTodayReminderItems, isOverdue, isReminderDueOn, REMINDER_ACCENT } from '@/lib/today-reminders'

// 2026-07-06 é uma segunda-feira (getDay() = 1).
const MONDAY = new Date('2026-07-06T12:00:00')

function reminder(overrides: Partial<{ id: string; title: string; time: string | null; days: unknown; active: boolean; date: string | null; completed_at: string | null }> = {}) {
  return { id: 'r1', title: 'Beber água', time: '09:00', days: [1], active: true, date: null, completed_at: null, ...overrides }
}

function event(overrides: Partial<{ id: string; title: string; time: string | null; all_day: boolean; color: string }> = {}) {
  return { id: 'e1', title: 'Consulta', time: '10:30:00', all_day: false, color: '#E8A838', ...overrides }
}

describe('isReminderDueOn', () => {
  it('casa dias como números', () => {
    expect(isReminderDueOn([1, 3], MONDAY)).toBe(true)
  })

  it('casa dias como strings (coluna text[] na BD)', () => {
    expect(isReminderDueOn(['1', '3'], MONDAY)).toBe(true)
  })

  it('dia da semana não incluído → false', () => {
    expect(isReminderDueOn([2, 4], MONDAY)).toBe(false)
  })

  it('vazio/null/não-array = NUNCA devido (paridade com o push, ≠ hábitos)', () => {
    expect(isReminderDueOn([], MONDAY)).toBe(false)
    expect(isReminderDueOn(null, MONDAY)).toBe(false)
    expect(isReminderDueOn(undefined, MONDAY)).toBe(false)
    expect(isReminderDueOn('1', MONDAY)).toBe(false)
  })
})

describe('isOverdue', () => {
  const now = new Date('2026-07-06T14:30:00')

  it('hora anterior à atual → atrasado', () => {
    expect(isOverdue('09:00', now)).toBe(true)
    expect(isOverdue('14:29', now)).toBe(true)
  })

  it('hora futura ou igual → não atrasado', () => {
    expect(isOverdue('14:30', now)).toBe(false)
    expect(isOverdue('20:00', now)).toBe(false)
  })

  it('sem hora ou hora inválida → não atrasado', () => {
    expect(isOverdue(null, now)).toBe(false)
    expect(isOverdue('abc', now)).toBe(false)
  })
})

describe('buildTodayReminderItems', () => {
  it('lembrete avulso (date) aparece do seu dia em diante, ignorando days', () => {
    const items = buildTodayReminderItems({
      events: [],
      reminders: [
        reminder({ id: 'hoje', days: [], date: '2026-07-06' }),
        reminder({ id: 'amanha', days: [1], date: '2026-07-07' }),
      ],
      date: MONDAY,
      checks: {},
    })
    expect(items.map((i) => i.id)).toEqual(['hoje'])
    expect(items[0].carriedFromDate).toBeNull()
  })

  it('avulso de dia anterior sem conclusão carrega para hoje com carriedFromDate', () => {
    const items = buildTodayReminderItems({
      events: [],
      reminders: [reminder({ id: 'ontem', days: [], date: '2026-07-03' })],
      date: MONDAY,
      checks: {},
    })
    expect(items.map((i) => i.id)).toEqual(['ontem'])
    expect(items[0].carriedFromDate).toBe('2026-07-03')
    expect(items[0].done).toBe(false)
  })

  it('avulso concluído num dia anterior não aparece mais', () => {
    const items = buildTodayReminderItems({
      events: [],
      reminders: [reminder({ id: 'feito', days: [], date: '2026-07-03', completed_at: '2026-07-04T10:00:00Z' })],
      date: MONDAY,
      checks: {},
    })
    expect(items).toEqual([])
  })

  it('avulso concluído hoje continua visível como done (grupo Concluídos)', () => {
    const items = buildTodayReminderItems({
      events: [],
      reminders: [reminder({ id: 'hoje', days: [], date: '2026-07-06', completed_at: '2026-07-06T12:00:00Z' })],
      date: MONDAY,
      checks: { 'reminder:hoje': true },
    })
    expect(items.map((i) => i.id)).toEqual(['hoje'])
    expect(items[0].done).toBe(true)
  })

  it('recorrente não é afetado por completed_at nem carrega entre dias', () => {
    const items = buildTodayReminderItems({
      events: [],
      reminders: [
        reminder({ id: 'seg', days: [1], completed_at: '2026-07-01T08:00:00Z' }),
        reminder({ id: 'ter', days: [2] }),
      ],
      date: MONDAY,
      checks: {},
    })
    expect(items.map((i) => i.id)).toEqual(['seg'])
    expect(items[0].carriedFromDate).toBeNull()
  })

  it('exclui lembretes inativos e não devidos hoje', () => {
    const items = buildTodayReminderItems({
      events: [],
      reminders: [
        reminder({ id: 'a', active: false }),
        reminder({ id: 'b', days: [2] }),
        reminder({ id: 'c' }),
      ],
      date: MONDAY,
      checks: {},
    })
    expect(items.map((i) => i.id)).toEqual(['c'])
  })

  it('ordena por hora ascendente com itens sem hora/dia inteiro no fim', () => {
    const items = buildTodayReminderItems({
      events: [
        event({ id: 'allday', title: 'Feriado', all_day: true, time: null }),
        event({ id: 'late', title: 'Jantar', time: '20:00:00' }),
      ],
      reminders: [reminder({ id: 'early', title: 'Alongar', time: '07:30' })],
      date: MONDAY,
      checks: {},
    })
    expect(items.map((i) => i.id)).toEqual(['early', 'late', 'allday'])
  })

  it('normaliza hora Postgres para HH:MM', () => {
    const [item] = buildTodayReminderItems({ events: [event({ time: '10:30:00' })], reminders: [], date: MONDAY, checks: {} })
    expect(item.time).toBe('10:30')
  })

  it('evento de dia inteiro fica sem hora', () => {
    const [item] = buildTodayReminderItems({
      events: [event({ all_day: true, time: '10:30:00' })],
      reminders: [],
      date: MONDAY,
      checks: {},
    })
    expect(item.time).toBeNull()
    expect(item.allDay).toBe(true)
  })

  it('aplica done a partir do mapa de checks; chave ausente → false', () => {
    const items = buildTodayReminderItems({
      events: [event({ id: 'e1' })],
      reminders: [reminder({ id: 'r1' })],
      date: MONDAY,
      checks: { 'event:e1': true },
    })
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.done]))
    expect(byKey['event:e1']).toBe(true)
    expect(byKey['reminder:r1']).toBe(false)
  })

  it('gera chaves estáveis por tipo e usa a cor do evento / acento do lembrete', () => {
    const items = buildTodayReminderItems({
      events: [event({ id: 'e1', color: '#00C896' })],
      reminders: [reminder({ id: 'r1' })],
      date: MONDAY,
      checks: {},
    })
    const ev = items.find((i) => i.itemType === 'event')!
    const rem = items.find((i) => i.itemType === 'reminder')!
    expect(ev.key).toBe('event:e1')
    expect(ev.color).toBe('#00C896')
    expect(rem.key).toBe('reminder:r1')
    expect(rem.color).toBe(REMINDER_ACCENT)
  })

  it('desempata itens com a mesma hora por título', () => {
    const items = buildTodayReminderItems({
      events: [event({ id: 'b', title: 'Zumba', time: '09:00:00' })],
      reminders: [reminder({ id: 'a', title: 'Alongar', time: '09:00' })],
      date: MONDAY,
      checks: {},
    })
    expect(items.map((i) => i.title)).toEqual(['Alongar', 'Zumba'])
  })
})
