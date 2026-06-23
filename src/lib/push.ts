// src/lib/push.ts
// Helpers de Web Push no cliente: subscrever o browser, guardar a subscrição no
// Supabase e cancelar. A entrega em si é feita pela Edge Function `send-reminders`
// (agendada por pg_cron). Ver docs/SETUP_NOTIFICATIONS.md.
import { supabase } from '@/lib/supabase'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  // Aloca um ArrayBuffer concreto (não ArrayBufferLike) para satisfazer o tipo
  // BufferSource exigido por pushManager.subscribe nas libs recentes do TS.
  const buffer = new ArrayBuffer(raw.length)
  const arr = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// No iOS o Web Push só existe quando a app está instalada no ecrã inicial
// (modo standalone). Em separador do Safari fica "preso"/indisponível.
function isIosNotInstalled(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '')
  const standalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  return isIos && !standalone
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

// Regista o SW de push (idempotente). Exportado para correr no arranque da app.
// Usamos um SW mínimo dedicado (/push-worker.js) em vez do SW pesado do next-pwa,
// que não instalava de forma fiável no iOS.
export async function registerServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/push-worker.js')
  } catch (e) {
    console.error('[push] registo do service worker falhou:', e)
  }
}

// `navigator.serviceWorker.ready` fica pendente PARA SEMPRE se nenhum SW activar
// — daí o toggle ficar "a processar". Aqui garantimos o registo do SW mínimo,
// limitamos a espera com timeout e devolvemos o motivo da falha (diagnóstico).
async function ensureRegistration(): Promise<{ reg: ServiceWorkerRegistration | null; err?: string }> {
  if (!('serviceWorker' in navigator)) return { reg: null, err: 'sem suporte a service worker' }

  let err: string | undefined
  try {
    await navigator.serviceWorker.register('/push-worker.js')
  } catch (e) {
    err = (e as Error)?.message || 'registo falhou'
  }

  const ready = await withTimeout(navigator.serviceWorker.ready, 12000)
  const reg = ready ?? (await navigator.serviceWorker.getRegistration()) ?? null
  return { reg, err: reg ? undefined : err ?? 'timeout (12s)' }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  const { reg } = await ensureRegistration()
  return reg
}

// Reflete o estado real (existe subscrição activa neste dispositivo?).
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await getRegistration()
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

type EnableResult = {
  ok: boolean
  error?: 'unsupported' | 'missing-vapid' | 'denied' | 'no-sw' | 'ios-install' | string
  detail?: string
}

export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, error: 'unsupported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'missing-vapid' }
  if (isIosNotInstalled()) return { ok: false, error: 'ios-install' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'denied' }

  const { reg, err } = await ensureRegistration()
  if (!reg) return { ok: false, error: 'no-sw', detail: err }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    } catch (e) {
      return { ok: false, error: (e as Error)?.message || 'subscribe-failed' }
    }
  }

  const json = sub.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: 'no-sw' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh, auth, timezone: deviceTimezone() },
    { onConflict: 'endpoint' }
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Fuso horário do dispositivo (ex.: "Europe/Lisbon"). Guardado na subscrição
// para a Edge Function disparar os lembretes na hora local de cada utilizador.
function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

// Mantém o fuso da subscrição alinhado com o telemóvel. Chamado no arranque do
// Perfil para que subscrições antigas (sem fuso) passem a usar o fuso real.
export async function syncTimezone(userId: string): Promise<void> {
  if (!pushSupported()) return
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    await supabase
      .from('push_subscriptions')
      .update({ timezone: deviceTimezone() })
      .eq('endpoint', sub.endpoint)
      .eq('user_id', userId)
  } catch {
    // silencioso — é só sincronização best-effort
  }
}

export async function disablePush(userId: string): Promise<void> {
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return

  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => {})
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', userId)
}
