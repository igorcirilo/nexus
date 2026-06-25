// supabase/functions/send-reminders/index.ts
//
// Disparada pelo pg_cron a cada minuto (ver supabase/notifications_push_v1.sql).
// Para cada utilizador, calcula a hora actual no fuso do seu dispositivo
// (push_subscriptions.timezone) e envia Web Push dos lembretes que batem
// hora/dia agora. Sem fuso global hardcoded — cada um recebe na sua hora local.
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

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function nowParts(tz: string): { hhmm: string; dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]))
  return { hhmm: `${parts.hour}:${parts.minute}`, dow: DOW[parts.weekday as string] ?? 0 }
}

function defaultBody(type: string): string {
  switch (type) {
    case 'checkin_manha': return 'Hora do check-in da manhã ☀️'
    case 'checkin_tarde': return 'Pausa para o check-in da tarde 🌤️'
    case 'checkin_noite': return 'Fecha o dia com o check-in da noite 🌙'
    case 'habito': return 'Não te esqueças do teu hábito de hoje ✅'
    case 'resumo_manha': return 'Bom dia — o teu plano de hoje está pronto ☀️'
    case 'resumo_noite': return 'Vê como correu o dia e prepara amanhã 🌙'
    default: return 'Tens um lembrete no NEXUS 🔔'
  }
}

function urlForType(type: string): string {
  if (type?.startsWith('checkin')) return '/checkin'
  if (type === 'habito') return '/habitos'
  return '/hoje'
}

// Chave de data 'yyyy-MM-dd' no fuso do utilizador, com deslocamento de dias.
function dateKeyInTz(tz: string, offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  // en-CA formata como yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// deno-lint-ignore no-explicit-any
async function countTodayTasks(supabase: any, userId: string, today: string): Promise<number> {
  const { data: prog } = await supabase
    .from('programs').select('id').eq('user_id', userId).eq('status', 'active').maybeSingle()
  if (!prog) return 0
  const { data: day } = await supabase
    .from('program_days').select('id').eq('program_id', prog.id).eq('date', today).maybeSingle()
  if (!day) return 0
  const { count } = await supabase
    .from('program_tasks').select('id', { count: 'exact', head: true })
    .eq('day_id', day.id).eq('status', 'pending')
  return count ?? 0
}

/**
 * Corpo dinâmico dos resumos diários (template, sem IA). Manhã = plano de hoje;
 * noite = fecho + agenda de amanhã. Espelha a lógica de day-planner/pendencias.
 */
// deno-lint-ignore no-explicit-any
async function buildSummaryBody(supabase: any, userId: string, type: string, tz: string): Promise<string> {
  const today = dateKeyInTz(tz, 0)

  if (type === 'resumo_manha') {
    const [{ data: habits }, nTasks, { data: events }] = await Promise.all([
      supabase.from('habits').select('id').eq('user_id', userId).eq('active', true),
      countTodayTasks(supabase, userId, today),
      supabase.from('agenda_events').select('title, time').eq('user_id', userId).eq('date', today).order('time'),
    ])
    const nHabits = (habits ?? []).length
    const ev = (events ?? [])[0]
    const evTxt = ev ? ` Primeiro evento: ${ev.title}${ev.time ? ' às ' + String(ev.time).slice(0, 5) : ''}.` : ''
    return `Bom dia. Hoje: ${nTasks} ${nTasks === 1 ? 'tarefa' : 'tarefas'} e ${nHabits} ${nHabits === 1 ? 'hábito' : 'hábitos'}.${evTxt}`
  }

  // resumo_noite
  const [{ data: habits }, { data: logs }] = await Promise.all([
    supabase.from('habits').select('id').eq('user_id', userId).eq('active', true),
    supabase.from('habit_logs').select('habit_id').eq('user_id', userId).eq('date', today).eq('completed', true),
  ])
  const total = (habits ?? []).length
  const done = (logs ?? []).length
  const tomorrow = dateKeyInTz(tz, 1)
  const { count: nTomorrow } = await supabase
    .from('agenda_events').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('date', tomorrow)
  const tmTxt = (nTomorrow ?? 0) > 0 ? ` Amanhã: ${nTomorrow} ${nTomorrow === 1 ? 'evento' : 'eventos'}.` : ''
  return `Fecho do dia: ${done}/${total} hábitos cumpridos.${tmTxt}`
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

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id, user_id, title, description, time, days, type, last_sent_at')
    .eq('active', true)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Agrupa por utilizador (cada um tem o seu fuso).
  const byUser = new Map<string, Reminder[]>()
  for (const r of (reminders ?? []) as Reminder[]) {
    const arr = byUser.get(r.user_id) ?? []
    arr.push(r)
    byUser.set(r.user_id, arr)
  }

  let due = 0
  let sent = 0

  for (const [userId, list] of byUser) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, timezone, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!subs || subs.length === 0) continue

    // Fuso do dispositivo mais recente; fallback para subscrições antigas.
    const tz = subs.find((s) => s.timezone)?.timezone || FALLBACK_TZ
    const { hhmm, dow } = nowParts(tz)

    for (const r of list) {
      const days = (r.days ?? []).map(String)
      if (!days.includes(String(dow))) continue
      if (!r.time || String(r.time).slice(0, 5) !== hhmm) continue
      if (r.last_sent_at && new Date(r.last_sent_at) >= minuteStart) continue

      due++
      // Resumos diários: corpo gerado a partir dos dados reais do utilizador.
      // Outros lembretes: descrição própria ou texto por defeito do tipo.
      let body = r.description || defaultBody(r.type)
      if (r.type === 'resumo_manha' || r.type === 'resumo_noite') {
        try {
          body = await buildSummaryBody(supabase, userId, r.type, tz)
        } catch (_e) {
          body = defaultBody(r.type) // fallback seguro se a query falhar
        }
      }
      const payload = JSON.stringify({
        title: r.title || 'NEXUS',
        body,
        url: urlForType(r.type),
        tag: `reminder-${r.id}`,
      })

      for (const s of subs) {
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

      await supabase.from('reminders').update({ last_sent_at: new Date().toISOString() }).eq('id', r.id)
    }
  }

  return new Response(JSON.stringify({ ok: true, due, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
