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

// `navigator.serviceWorker.ready` fica pendente PARA SEMPRE se nenhum SW activar
// — daí o toggle ficar "a processar". Aqui garantimos o registo e limitamos a
// espera com timeout, devolvendo null em vez de bloquear.
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null

  // 1) Já há um SW activo? Usa-o de imediato.
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing

  // 2) Garante o registo (o next-pwa fá-lo, mas pode ainda não ter corrido).
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    // ignora — `ready` ainda pode resolver de um registo em curso
  }

  // 3) Espera a activação, mas nunca além de 12s.
  const reg = await withTimeout(navigator.serviceWorker.ready, 12000)
  return reg ?? (await navigator.serviceWorker.getRegistration()) ?? null
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
}

export async function enablePush(userId: string): Promise<EnableResult> {
  if (!pushSupported()) return { ok: false, error: 'unsupported' }
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'missing-vapid' }
  if (isIosNotInstalled()) return { ok: false, error: 'ios-install' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'denied' }

  const reg = await getRegistration()
  if (!reg) return { ok: false, error: 'no-sw' }

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
