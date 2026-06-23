// supabase/functions/send-reminders/index.ts
//
// Disparada pelo pg_cron a cada minuto (ver supabase/notifications_push_v1.sql).
// Lê os lembretes activos cuja hora/dia batem com o instante actual (no fuso
// REMINDER_TZ) e envia Web Push para todas as subscrições do utilizador.
//
// Tudo dentro do free tier do Supabase: Edge Functions (500k invocações/mês) +
// pg_cron a cada minuto. Não usa o cron do Vercel (limitado a 1×/dia no Hobby).
//
// Secrets necessários (Supabase → Edge Functions → Manage secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET
// Injetados automaticamente: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@nexus.app'
const TZ = Deno.env.get('REMINDER_TZ') ?? 'America/Sao_Paulo'

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
    default: return 'Tens um lembrete no NEXUS 🔔'
  }
}

function urlForType(type: string): string {
  if (type?.startsWith('checkin')) return '/checkin'
  if (type === 'habito') return '/habitos'
  return '/hoje'
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('forbidden', { status: 403 })
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response('VAPID keys not configured', { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { hhmm, dow } = nowParts(TZ)

  // Início do minuto actual — barreira contra reenvios duplicados.
  const minuteStart = new Date()
  minuteStart.setSeconds(0, 0)

  // Lembretes activos agendados para hoje (dia da semana actual).
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('id, user_id, title, description, time, days, type, last_sent_at')
    .eq('active', true)
    .contains('days', [String(dow)])

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const due = (reminders ?? []).filter((r) => {
    if (!r.time || String(r.time).slice(0, 5) !== hhmm) return false
    if (r.last_sent_at && new Date(r.last_sent_at) >= minuteStart) return false
    return true
  })

  let sent = 0
  for (const r of due) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', r.user_id)

    const payload = JSON.stringify({
      title: r.title || 'NEXUS',
      body: r.description || defaultBody(r.type),
      url: urlForType(r.type),
      tag: `reminder-${r.id}`,
    })

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        )
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // 404/410 = subscrição morta (browser desinstalado / permissão revogada).
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }

    // Marca como enviado para não repetir no próximo tick do mesmo minuto.
    await supabase.from('reminders').update({ last_sent_at: new Date().toISOString() }).eq('id', r.id)
  }

  return new Response(JSON.stringify({ ok: true, time: hhmm, dow, due: due.length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
