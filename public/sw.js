self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', function(e) {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'TagGuard', {
      body: data.body || 'Someone found your item',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' }
    })
  )
})

self.addEventListener('notificationclick', function(e) {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data.url))
})
