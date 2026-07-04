// supabase/functions/send-reminders/index.ts
//
// Disparada pelo pg_cron a cada minuto (ver supabase/notifications_push_v1.sql).
// Para cada utilizador, calcula a hora actual no fuso do seu dispositivo
// (push_subscriptions.timezone) e envia Web Push de:
//   • lembretes recorrentes (reminders) que batem hora/dia agora;
//   • eventos da agenda (agenda_events) que batem data/hora agora;
//   • hábitos ativos (habits) cuja hora extraída de time_window bate agora
//     e que ainda não foram concluídos hoje.
// Sem fuso global hardcoded — cada um recebe na sua hora local.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// Injetados: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// REMINDER_TZ é apenas fallback para subscrições antigas sem fuso.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@nexus.app'
const FALLBACK_TZ = Deno.env.get('REMINDER_TZ') ?? 'UTC'

// Hora local a que os eventos de dia inteiro são notificados.
const ALLDAY_NOTIFY_HHMM = Deno.env.get('ALLDAY_NOTIFY_HHMM') ?? '09:00'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function nowParts(tz: string): { hhmm: string; dow: number; date: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return {
    hhmm: `${parts.hour}:${parts.minute}`,
    dow: DOW[parts.weekday as string] ?? 0,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  }
}

function defaultBody(type: string): string {
  switch (type) {
    case 'checkin_manha': return 'Hora do check-in da manhã ☀️'
    case 'checkin_tarde': return 'Pausa para o check-in da tarde 🌤️'
    case 'checkin_noite': return 'Fecha o dia com o check-in da noite 🌙'
    case 'habito': return 'Não te esqueças do teu hábito de hoje ✅'
    case 'financas': return 'Regista os gastos de hoje — 30 segundos 💸'
    default: return 'Tens um lembrete no NEXUS 🔔'
  }
}

function urlForType(type: string): string {
  if (type?.startsWith('checkin')) return '/checkin'
  if (type === 'habito') return '/habitos'
  if (type === 'financas') return '/financas'
  return '/hoje'
}

// time_window é texto livre. Extrai a 1ª hora HH:MM que encontrar (ex.
// '07:00-09:00' → '07:00'); rótulos sem hora ('Manhã', 'Todo o dia') → null.
function parseHabitTime(tw: string | null): string | null {
  if (!tw) return null
  const m = tw.match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

interface Reminder {
  id: string
  user_id: string
  title: string
  description: string | null
  time: string | null
  days: string[] | null
  type: string
  last_sent_at: string | null
}

interface AgendaEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  date: string
  time: string | null
  all_day: boolean
  notified_at: string | null
}

interface Habit {
  id: string
  user_id: string
  name: string
  time_window: string | null
  days: number[] | null
  last_notified_at: string | null
}

interface Sub {
  endpoint: string
  p256dh: string
  auth: string
  timezone: string | null
  created_at: string
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response('VAPID keys not configured', { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Início do minuto actual — barreira contra reenvios duplicados.
  const minuteStart = new Date()
  minuteStart.setSeconds(0, 0)

  // Janela de datas em redor de "agora" (UTC) para apanhar eventos seja qual for
  // o fuso de cada utilizador. O filtro fino por data local é feito por utilizador.
  const dayMs = 24 * 60 * 60 * 1000
  const dateWindow = [
    new Date(minuteStart.getTime() - dayMs),
    minuteStart,
    new Date(minuteStart.getTime() + dayMs),
  ].map((d) => d.toISOString().slice(0, 10))

  const [remindersRes, eventsRes, habitsRes] = await Promise.all([
    supabase
      .from('reminders')
      .select('id, user_id, title, description, time, days, type, last_sent_at')
      .eq('active', true),
    supabase
      .from('agenda_events')
      .select('id, user_id, title, description, date, time, all_day, notified_at')
      .is('notified_at', null)
      .in('date', dateWindow),
    supabase
      .from('habits')
      .select('id, user_id, name, time_window, days, last_notified_at')
      .eq('active', true),
  ])

  if (remindersRes.error) {
    return new Response(JSON.stringify({ error: remindersRes.error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Agrupa lembretes e eventos por utilizador (cada um tem o seu fuso).
  const reminderByUser = new Map<string, Reminder[]>()
  for (const r of (remindersRes.data ?? []) as Reminder[]) {
    const arr = reminderByUser.get(r.user_id) ?? []
    arr.push(r)
    reminderByUser.set(r.user_id, arr)
  }

  const eventByUser = new Map<string, AgendaEvent[]>()
  for (const e of (eventsRes.data ?? []) as AgendaEvent[]) {
    const arr = eventByUser.get(e.user_id) ?? []
    arr.push(e)
    eventByUser.set(e.user_id, arr)
  }

  const habitByUser = new Map<string, Habit[]>()
  for (const h of (habitsRes.data ?? []) as Habit[]) {
    const arr = habitByUser.get(h.user_id) ?? []
    arr.push(h)
    habitByUser.set(h.user_id, arr)
  }

  const userIds = new Set<string>([
    ...reminderByUser.keys(),
    ...eventByUser.keys(),
    ...habitByUser.keys(),
  ])

  let due = 0
  let sent = 0

  for (const userId of userIds) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, timezone, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!subs || subs.length === 0) continue

    // Fuso do dispositivo mais recente; fallback para subscrições antigas.
    const tz = (subs as Sub[]).find((s) => s.timezone)?.timezone || FALLBACK_TZ
    const { hhmm, dow, date } = nowParts(tz)

    const deliver = async (payload: string) => {
      due++
      for (const s of subs as Sub[]) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          )
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          }
        }
      }
    }

    // ── Lembretes recorrentes ──────────────────────────────────────────────
    for (const r of reminderByUser.get(userId) ?? []) {
      const days = (r.days ?? []).map(String)
      if (!days.includes(String(dow))) continue
      if (!r.time || String(r.time).slice(0, 5) !== hhmm) continue
      if (r.last_sent_at && new Date(r.last_sent_at) >= minuteStart) continue

      await deliver(JSON.stringify({
        title: r.title || 'NEXUS',
        body: r.description || defaultBody(r.type),
        url: urlForType(r.type),
        tag: `reminder-${r.id}`,
      }))

      await supabase.from('reminders').update({ last_sent_at: new Date().toISOString() }).eq('id', r.id)
    }

    // ── Eventos da agenda ──────────────────────────────────────────────────
    for (const e of eventByUser.get(userId) ?? []) {
      if (e.notified_at) continue
      if (e.date !== date) continue
      const targetHhmm = e.all_day ? ALLDAY_NOTIFY_HHMM : (e.time ? String(e.time).slice(0, 5) : null)
      if (!targetHhmm || targetHhmm !== hhmm) continue

      await deliver(JSON.stringify({
        title: e.title || 'Evento na agenda',
        body: e.description || (e.all_day ? 'Tens um evento hoje 📅' : 'Tens um evento agora 📅'),
        url: '/calendario',
        tag: `event-${e.id}`,
      }))

      await supabase.from('agenda_events').update({ notified_at: new Date().toISOString() }).eq('id', e.id)
    }

    // ── Hábitos ────────────────────────────────────────────────────────────
    const dueHabits = (habitByUser.get(userId) ?? []).filter((h) => {
      if (h.last_notified_at && new Date(h.last_notified_at) >= minuteStart) return false
      // Respeita a frequência por dia da semana (days null/[] = todos os dias).
      if (h.days && h.days.length > 0 && !h.days.includes(dow)) return false
      return parseHabitTime(h.time_window) === hhmm
    })

    if (dueHabits.length > 0) {
      // Não chatear com hábitos já concluídos hoje (na data local do utilizador).
      const { data: logs } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', userId)
        .eq('date', date)
        .eq('completed', true)
      const done = new Set((logs ?? []).map((l) => l.habit_id as string))

      for (const h of dueHabits) {
        if (done.has(h.id)) continue

        await deliver(JSON.stringify({
          title: h.name || 'Hábito',
          body: 'Está na hora deste hábito ✅',
          url: '/habitos',
          tag: `habit-${h.id}`,
        }))

        await supabase.from('habits').update({ last_notified_at: new Date().toISOString() }).eq('id', h.id)
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, due, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
