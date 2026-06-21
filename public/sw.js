/// <reference lib="webworker" />

/**
 * Last Island — Service Worker
 * Handles web push notifications so raid alarms reach members even when the app is closed.
 *
 * The service worker stays registered in the browser background. When the server sends a
 * push notification, the browser wakes up this service worker and fires the 'push' event —
 * even if the app tab is closed. We then display a system notification.
 */

const CACHE_NAME = 'last-island-v1'
const APP_SHELL = ['/', '/island-logo.png', '/manifest.json']

// ---------- Install: cache the app shell ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

// ---------- Activate: clean up old caches ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ---------- Push: display a system notification ----------
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    try {
      payload = { title: 'Last Island', body: event.data ? event.data.text() : '' }
    } catch {
      payload = { title: 'Last Island', body: 'You have a new alert' }
    }
  }

  const title = payload.title || '🚨 Last Island Alert'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/island-logo.png',
    badge: payload.badge || '/island-logo.png',
    tag: payload.tag || 'last-island-notification',
    requireInteraction: payload.requireInteraction !== undefined ? payload.requireInteraction : true,
    vibrate: [400, 200, 400, 200, 400],
    data: {
      url: (payload.data && payload.data.url) || '/',
      ...(payload.data || {}),
    },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ---------- Notification click: open/focus the app ----------
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Default action + 'open' action → focus or open the app
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if one is open
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {})
          return client.focus()
        }
      }
      // Otherwise open a new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return null
    })
  )
})

// ---------- Message: allow the page to trigger skipWaiting ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
