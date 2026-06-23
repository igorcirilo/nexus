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

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // O next-pwa regista o SW; esperamos que esteja pronto antes de subscrever.
  return navigator.serviceWorker.ready
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

type EnableResult = { ok: boolean; error?: 'unsupported' | 'missing-vapid' | 'denied' | 'no-sw' | string }

export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, error: 'unsupported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'missing-vapid' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'denied' }

  const reg = await getRegistration()
  if (!reg) return { ok: false, error: 'no-sw' }

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: 'no-sw' }
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint, p256dh, auth },
    { onConflict: 'endpoint' }
  )

  if (error) return { ok: false, error: error.message }
  return { ok: true }
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
