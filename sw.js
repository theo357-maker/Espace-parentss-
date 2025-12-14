// sw.js - Service Worker Principal pour PWA et Notifications

const CACHE_NAME = 'cs-lacolombe-v2.1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/parent.html',
  '/manifest.json',
  '/icon-72x72.png',
  '/icon-96x96.png',
  '/icon-128x128.png',
  '/icon-144x144.png',
  '/icon-152x152.png',
  '/icon-192x192.png',
  '/icon-384x384.png',
  '/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Installation');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Mise en cache des fichiers');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Cache installé avec succès');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Erreur installation cache:', error);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', (event) => {
  console.log('🎯 Service Worker: Activation');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Suppression ancien cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Nouveau Service Worker activé');
      return self.clients.claim();
    })
  );
});

// Stratégie de cache: Network First avec fallback
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes Firebase et Cloudinary
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('cloudinary') ||
      event.request.url.includes('fcm.googleapis.com')) {
    return;
  }
  
  // Pour les pages HTML, toujours aller au réseau d'abord
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
              // Fallback à la page d'accueil
              return caches.match('/');
            });
        })
    );
    return;
  }
  
  // Pour les autres ressources, cache d'abord
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then((response) => {
            // Ne pas mettre en cache les requêtes non GET
            if (event.request.method !== 'GET') {
              return response;
            }
            
            // Mettre en cache les ressources statiques
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
            
            return response;
          })
          .catch((error) => {
            console.error('Fetch échoué:', error);
            // Pour les images, retourner une image de fallback
            if (event.request.destination === 'image') {
              return caches.match('/icon-192x192.png');
            }
          });
      })
  );
});

// Gérer les messages push
self.addEventListener('push', (event) => {
  console.log('📨 Service Worker: Push reçu', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Nouvelle notification',
        body: event.data.text() || 'Vous avez une nouvelle notification'
      };
    }
  }
  
  const title = data.notification?.title || data.title || 'CS La Colombe';
  const body = data.notification?.body || data.body || 'Nouvelle notification';
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
    actions: [
      {
        action: 'open',
        title: '👁️ Voir'
      },
      {
        action: 'close',
        title: '❌ Fermer'
      }
    ],
    tag: dataPayload.type || 'general',
    renotify: true
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('✅ Notification affichée');
        
        // Envoyer un message à tous les clients
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'NEW_NOTIFICATION',
              data: data
            });
          });
        });
      })
      .catch((error) => {
        console.error('❌ Erreur affichage notification:', error);
      })
  );
});

// Gérer le clic sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('🔘 Service Worker: Notification cliquée', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  if (action === 'close') {
    console.log('Notification fermée');
    return;
  }
  
  // Par défaut, ouvrir l'application
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Chercher un client ouvert
      for (const client of clientList) {
        if (client.url === self.location.origin && 'focus' in client) {
          console.log('✅ Client trouvé, focus...');
          client.focus();
          
          // Envoyer les données de notification
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: data,
            page: data.page || 'dashboard',
            childId: data.childId || ''
          });
          
          return;
        }
      }
      
      // Si aucun client ouvert, ouvrir une nouvelle fenêtre
      console.log('🌐 Ouverture nouvelle fenêtre...');
      return self.clients.openWindow('/')
        .then((newClient) => {
          if (newClient) {
            // Attendre que la page soit chargée
            setTimeout(() => {
              newClient.postMessage({
                type: 'NOTIFICATION_CLICKED',
                data: data,
                page: data.page || 'dashboard',
                childId: data.childId || ''
              });
            }, 1000);
          }
        });
    })
    .catch((error) => {
      console.error('❌ Erreur gestion notification:', error);
    })
  );
});

// Gérer les messages des clients
self.addEventListener('message', (event) => {
  console.log('📩 Service Worker: Message reçu', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: '2.1.0' });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => {
          event.source.postMessage({ type: 'CACHE_CLEARED' });
        });
      break;
      
    case 'UPDATE_AVAILABLE':
      // Gérer les mises à jour
      self.registration.update();
      break;
  }
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Sync', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  console.log('🔄 Synchronisation des notifications...');
  
  // Ici, vous pouvez synchroniser les données en arrière-plan
  // Par exemple, vérifier les nouvelles notes, devoirs, etc.
  
  return Promise.resolve();
}

// Gérer les notifications périodiques
self.addEventListener('periodicsync', (event) => {
  console.log('⏰ Service Worker: Periodic Sync', event.tag);
  
  if (event.tag === 'check-updates') {
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  console.log('🔍 Vérification des mises à jour...');
  
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    const data = await response.json();
    
    // Comparer avec la version actuelle
    const currentVersion = '2.1.0';
    if (data.version !== currentVersion) {
      console.log(`🔄 Nouvelle version disponible: ${data.version}`);
      
      // Envoyer une notification de mise à jour
      self.registration.showNotification('Mise à jour disponible', {
        body: `Version ${data.version} disponible. Cliquez pour mettre à jour.`,
        icon: '/icon-192x192.png',
        tag: 'update',
        requireInteraction: true,
        actions: [
          { action: 'update', title: '🔄 Mettre à jour' }
        ]
      });
    }
  } catch (error) {
    console.error('❌ Erreur vérification mises à jour:', error);
  }
}

// Gérer les erreurs
self.addEventListener('error', (error) => {
  console.error('❌ Service Worker erreur:', error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker promesse rejetée:', event.reason);
});
