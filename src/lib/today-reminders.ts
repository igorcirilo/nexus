// Lógica pura da secção "Lembretes de hoje" (página Hoje): junta os eventos
// da agenda do dia com os lembretes recorrentes devidos hoje, aplica o estado
// de conclusão (day_item_checks) e ordena por hora.

export type DayItemType = 'reminder' | 'event'

export interface TodayReminderItem {
  /** Chave estável `${itemType}:${id}` — key de React e do mapa de checks. */
  key: string
  itemType: DayItemType
  id: string
  title: string
  /** 'HH:MM' ou null (sem hora / dia inteiro). */
  time: string | null
  allDay: boolean
  color: string
  done: boolean
}

export interface TodayReminderInput {
  /** Eventos da agenda JÁ filtrados para a data de hoje. */
  events: { id: string; title: string; time: string | null; all_day: boolean; color: string }[]
  /** date preenchida = lembrete avulso desse dia; null = recorrente (days). */
  reminders: { id: string; title: string; time: string | null; days: unknown; active: boolean; date?: string | null }[]
  date: Date
  /** Mapa `${itemType}:${id}` → completed. */
  checks: Record<string, boolean>
}

/** Cor de destaque dos lembretes recorrentes na lista (eventos trazem a sua). */
export const REMINDER_ACCENT = '#7F77DD'

/**
 * O lembrete recorrente é devido nesta data?
 *
 * Semântica DIFERENTE dos hábitos: days vazio/null = NUNCA devido — é assim
 * que a edge function de push trata (send-reminders), e o formulário de
 * /lembretes exige escolher dias. A coluna é text[] na BD, por isso os
 * valores podem chegar como strings: coagimos com Number().
 */
export function isReminderDueOn(days: unknown, date: Date): boolean {
  if (!Array.isArray(days) || days.length === 0) return false
  const dow = date.getDay()
  return days.some((d) => Number(d) === dow)
}

/** A hora do item já passou hoje? (pinta o horário de vermelho, à la iOS) */
export function isOverdue(time: string | null, now: Date): boolean {
  if (!time) return false
  const [h, m] = time.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m
}

/** Normaliza hora Postgres ('09:00:00') para exibição ('09:00'). */
function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null
  return time.slice(0, 5)
}

/** Data local em yyyy-MM-dd (sem UTC — igual ao todayISO da app). */
function toLocalISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Chave de ordenação: itens com hora primeiro (ascendente), depois os sem hora. */
function sortKey(item: TodayReminderItem): string {
  return item.time ?? '99:99'
}

export function buildTodayReminderItems(input: TodayReminderInput): TodayReminderItem[] {
  const { events, reminders, date, checks } = input

  const eventItems: TodayReminderItem[] = events.map((e) => {
    const key = `event:${e.id}`
    return {
      key,
      itemType: 'event',
      id: e.id,
      title: e.title,
      time: e.all_day ? null : normalizeTime(e.time),
      allDay: e.all_day,
      color: e.color,
      done: checks[key] ?? false,
    }
  })

  const todayStr = toLocalISO(date)
  const reminderItems: TodayReminderItem[] = reminders
    // Avulso (date preenchida): só no próprio dia. Recorrente: dias da semana.
    .filter((r) => r.active && (r.date ? r.date === todayStr : isReminderDueOn(r.days, date)))
    .map((r) => {
      const key = `reminder:${r.id}`
      return {
        key,
        itemType: 'reminder' as const,
        id: r.id,
        title: r.title,
        time: normalizeTime(r.time),
        allDay: false,
        color: REMINDER_ACCENT,
        done: checks[key] ?? false,
      }
    })

  return [...eventItems, ...reminderItems].sort(
    (a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title, 'pt'),
  )
}
