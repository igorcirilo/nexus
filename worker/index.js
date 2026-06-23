// worker/index.js
// Código de service worker injetado no SW gerado pelo next-pwa (via importScripts).
// Trata a entrega de Web Push dos lembretes do NEXUS e o clique na notificação.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'NEXUS', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'NEXUS'
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || '/hoje' },
    vibrate: [80, 40, 80],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/hoje'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow(url)
      })
  )
})
