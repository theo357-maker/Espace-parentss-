// fallback-sw.js - Service Worker de secours
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Notification', {
      body: data.body || 'Nouveau message',
      icon: 'icon-192x192.png',
      vibrate: [200, 100, 200],
      data: data
    })
  );
});