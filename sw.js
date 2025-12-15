// sw.js - Service Worker optimisé pour PWA et Notifications
const CACHE_NAME = 'cs-lacolombe-v2.2.0';
const urlsToCache = [
  '/',
  '/parent.html',
  '/manifest.json',
  '/icon-72x72.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// === INSTALLATION ===
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Installation v2.2.0');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Mise en cache des fichiers critiques');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// === ACTIVATION ===
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker: Activation');
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`🗑️ Suppression ancien cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Prendre le contrôle immédiatement
      self.clients.claim()
    ])
  );
});

// === STRATÉGIE DE CACHE ===
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes Firebase et Cloudinary
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('cloudinary') ||
      event.request.url.includes('fcm.googleapis.com')) {
    return;
  }
  
  // Pour les pages HTML : Network First
  if (event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Mettre à jour le cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback au cache
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Fallback à la page parent
              return caches.match('/parent.html');
            });
        })
    );
    return;
  }
  
  // Pour les autres ressources : Cache First
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then((response) => {
            // Ne pas mettre en cache les requêtes non GET
            if (event.request.method !== 'GET') return response;
            
            // Mettre en cache les ressources statiques
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            return response;
          });
      })
  );
});

// === GESTION DES NOTIFICATIONS PUSH ===
self.addEventListener('push', (event) => {
  console.log('📨 Push reçu:', event);
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'CS La Colombe',
      body: 'Nouvelle notification',
      icon: '/icon-192x192.png'
    };
  }
  
  const title = data.title || 'CS La Colombe';
  const body = data.body || 'Nouvelle notification disponible';
  const icon = '/icon-192x192.png';
  const badge = '/icon-72x72.png';
  const dataPayload = data.data || {};
  
  const options = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200],
    data: dataPayload,
    requireInteraction: true,
    tag: dataPayload.type || 'general',
    renotify: true,
    actions: [
      { action: 'view', title: '👁️ Voir' },
      { action: 'dismiss', title: '❌ Fermer' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// === CLIC SUR NOTIFICATION ===
self.addEventListener('notificationclick', (event) => {
  console.log('🔘 Notification cliquée:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  if (action === 'dismiss') {
    console.log('Notification fermée');
    return;
  }
  
  // Par défaut : ouvrir l'application
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Chercher un client ouvert
      for (const client of clientList) {
        if (client.url.includes('/parent.html') && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data,
            page: data.page || 'dashboard'
          });
          return;
        }
      }
      
      // Ouvrir une nouvelle fenêtre
      return self.clients.openWindow('/parent.html')
        .then((newClient) => {
          if (newClient) {
            // Envoyer les données après chargement
            setTimeout(() => {
              newClient.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: data,
                page: data.page || 'dashboard'
              });
            }, 1000);
          }
        });
    })
  );
});

// === SYNCHRONISATION EN ARRIÈRE-PLAN ===
self.addEventListener('sync', (event) => {
  console.log('🔄 Sync event:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  console.log('🔄 Synchronisation des notifications en arrière-plan...');
  
  // Récupérer les dernières données
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'BACKGROUND_SYNC',
      timestamp: Date.now()
    });
  });
  
  // Mettre à jour le badge
  updateBadge(1);
}

// === MISE À JOUR DU BADGE ===
function updateBadge(count) {
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(count).catch(err => {
      console.log('Badge non supporté:', err);
    });
  }
}

// === MESSAGES DES CLIENTS ===
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'UPDATE_BADGE':
      updateBadge(data.count || 0);
      break;
      
    case 'CLEAR_BADGE':
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge();
      }
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

// === GESTION DES ERREURS ===
self.addEventListener('error', (error) => {
  console.error('❌ Service Worker erreur:', error);
});
