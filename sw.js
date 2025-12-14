// Service Worker pour PWA - Mise à jour en temps réel
let APP_VERSION = '2.1.0';
let CACHE_NAME = 'colombe-cache';
const MANIFEST_URL = './version-manifest.json';
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // Vérifier toutes les 5 minutes

// Fichiers à mettre en cache
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './version-manifest.json',
  './icon-72x72.png',
  './icon-192x192.png',
  './icon-512x512.png'
];

// ==================== INITIALISATION ====================
async function initialize() {
  try {
    // Charger la version depuis le manifest
    const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
    const manifest = await response.json();
    APP_VERSION = manifest.currentVersion || '2.1.0';
    CACHE_NAME = `colombe-cache-v${APP_VERSION}`;
    
    console.log(`[SW] ✅ Initialisé - Version: ${APP_VERSION}`);
    console.log(`[SW] Cache: ${CACHE_NAME}`);
    
    return manifest;
  } catch (error) {
    console.error('[SW] ❌ Erreur initialisation:', error);
    CACHE_NAME = `colombe-cache-v${APP_VERSION}`;
    return { currentVersion: APP_VERSION };
  }
}

// ==================== VÉRIFICATION MISES À JOUR ====================
async function checkForUpdates() {
  console.log('[SW] 🔍 Vérification mises à jour...');
  
  try {
    const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (!response.ok) {
      console.warn('[SW] Manifest non disponible');
      return false;
    }
    
    const manifest = await response.json();
    const latestVersion = manifest.currentVersion;
    
    if (compareVersions(latestVersion, APP_VERSION) > 0) {
      console.log(`[SW] 🎉 NOUVELLE VERSION: ${latestVersion} (actuelle: ${APP_VERSION})`);
      
      // Notifier toutes les pages ouvertes
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      
      clients.forEach(client => {
        console.log(`[SW] Notification à: ${client.url}`);
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          data: {
            currentVersion: APP_VERSION,
            newVersion: latestVersion,
            changelog: manifest.changelog || '',
            mandatory: manifest.mandatory || false,
            releaseDate: manifest.releaseDate,
            timestamp: Date.now()
          }
        });
      });
      
      // Si mise à jour obligatoire, forcer la mise à jour
      if (manifest.mandatory) {
        console.log('[SW] ⚠️ Mise à jour OBLIGATOIRE détectée');
        
        setTimeout(() => {
          clients.forEach(client => {
            client.postMessage({
              type: 'MANDATORY_UPDATE',
              data: {
                currentVersion: APP_VERSION,
                newVersion: latestVersion,
                message: 'Mise à jour critique requise'
              }
            });
          });
        }, 2000);
        
        // Forcer la mise à jour du Service Worker
        self.skipWaiting();
      }
      
      return true;
    }
    
    console.log('[SW] ✅ Application à jour');
    return false;
    
  } catch (error) {
    console.error('[SW] ❌ Erreur vérification:', error);
    return false;
  }
}

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// ==================== INSTALLATION ====================
self.addEventListener('install', (event) => {
  console.log('[SW] 🚀 Installation en cours...');
  
  event.waitUntil(
    initialize().then(() => {
      return caches.open(CACHE_NAME)
        .then(cache => {
          console.log(`[SW] 📦 Mise en cache: ${CACHE_NAME}`);
          return cache.addAll(STATIC_CACHE_URLS);
        })
        .then(() => {
          console.log('[SW] ✅ Installation terminée');
          return self.skipWaiting(); // Prendre contrôle immédiatement
        });
    })
  );
});

// ==================== ACTIVATION ====================
self.addEventListener('activate', (event) => {
  console.log('[SW] 🔥 Activation...');
  
  event.waitUntil(
    Promise.all([
      // Nettoyer les anciens caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log(`[SW] 🗑️ Suppression cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prendre contrôle de tous les clients
      self.clients.claim(),
      
      // Vérifier les mises à jour immédiatement
      checkForUpdates(),
      
      // Programmer des vérifications périodiques
      scheduleUpdateChecks()
    ]).then(() => {
      console.log('[SW] ✅ Activation complète');
    })
  );
});

function scheduleUpdateChecks() {
  // Vérifier immédiatement
  setTimeout(checkForUpdates, 10000);
  
  // Vérifier périodiquement
  setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL);
  
  console.log(`[SW] 🔄 Vérifications programmées toutes les ${UPDATE_CHECK_INTERVAL/60000} minutes`);
}

// ==================== GESTION DES REQUÊTES ====================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;
  
  // Pour le manifest, toujours récupérer depuis le réseau
  if (url.pathname.endsWith('version-manifest.json')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // Stratégie: Cache First pour les assets statiques
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retourner depuis le cache si disponible
        if (response) {
          return response;
        }
        
        // Sinon, récupérer depuis le réseau
        return fetch(event.request)
          .then(networkResponse => {
            // Mettre en cache pour plus tard (sauf pour les données dynamiques)
            if (event.request.url.startsWith(self.location.origin) && 
                !event.request.url.includes('firebase') &&
                !event.request.url.includes('/api/')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            
            return networkResponse;
          })
          .catch(() => {
            // Fallback pour les pages
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
            return new Response('Ressource non disponible hors ligne', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// ==================== GESTION DES MESSAGES ====================
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  
  console.log('[SW] 📨 Message reçu:', type);
  
  switch (type) {
    case 'CHECK_FOR_UPDATES':
      checkForUpdates().then(hasUpdate => {
        event.ports[0].postMessage({ 
          hasUpdate,
          currentVersion: APP_VERSION 
        });
      });
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ 
        version: APP_VERSION,
        cacheName: CACHE_NAME 
      });
      break;
      
    case 'FORCE_UPDATE':
      self.skipWaiting();
      self.clients.claim().then(() => {
        event.ports[0].postMessage({ 
          success: true,
          message: 'Service Worker mis à jour' 
        });
      });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'PING':
      event.ports[0].postMessage({ 
        pong: true,
        version: APP_VERSION,
        timestamp: Date.now()
      });
      break;
  }
});

// ==================== GESTION DES NOTIFICATIONS PUSH ====================
self.addEventListener('push', (event) => {
  let data = {};
  
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {
      title: 'CS La Colombe',
      body: event.data ? event.data.text() : 'Nouvelle notification'
    };
  }
  
  const options = {
    body: data.body || 'Nouvelle notification',
    icon: './icon-192x192.png',
    badge: './icon-72x72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    tag: data.tag || 'general',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: './icon-72x72.png'
      },
      {
        action: 'dismiss',
        title: 'Ignorer',
        icon: './icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'CS La Colombe',
      options
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Focus sur un client existant ou ouvrir une nouvelle fenêtre
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

console.log('[SW] 📡 Service Worker chargé - Prêt pour les mises à jour en temps réel');