// ==================== SERVICE WORKER CS LA COLOMBE ====================
// Version: 2.2.0 (Mise à jour notifications et badges)
// Description: Gère les mises à jour, le cache, les notifications en arrière-plan

let APP_VERSION = '2.2.0';
let CACHE_NAME = 'colombe-cache-v2.2.0';
const MANIFEST_URL = './version-manifest.json';
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // Vérifier toutes les 5 minutes

// Fichiers essentiels à mettre en cache pour le fonctionnement offline
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './parent.html',
  './manifest.json',
  './version-manifest.json',
  './icon-72x72.png',
  './icon-192x192.png',
  './icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css'
];

// ==================== INITIALISATION FIREBASE ====================
// 🔥 IMPORTANT : Configuration Firebase pour le Service Worker
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyBn7VIddclO7KtrXb5sibCr9SjVLjOy-qI",
  authDomain: "theo1d.firebaseapp.com",
  projectId: "theo1d",
  storageBucket: "theo1d.firebasestorage.app",
  messagingSenderId: "269629842962",
  appId: "1:269629842962:web:a80a12b04448fe1e595acb",
  measurementId: "G-TNSG1XFMDZ"
};

// Initialiser Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

console.log('[SW] ✅ Firebase initialisé dans le Service Worker');

// ==================== INITIALISATION APPLICATION ====================
async function initialize() {
  try {
    // Charger la version depuis le manifest
    const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
    const manifest = await response.json();
    APP_VERSION = manifest.currentVersion || '2.2.0';
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

// ==================== GESTION DES NOTIFICATIONS PUSH ====================
// 📨 Gestion des messages push EN ARRIÈRE-PLAN (quand l'app est fermée)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] 📨 Message reçu en arrière-plan:', payload);
  
  // Extraire les données de la notification
  const notificationTitle = payload.notification?.title || 'CS La Colombe';
  const notificationBody = payload.notification?.body || 'Nouvelle notification';
  const notificationData = payload.data || {};
  
  // Déterminer l'icône en fonction du type de notification
  let notificationIcon = './icon-192x192.png';
  let notificationBadge = './icon-72x72.png';
  
  if (notificationData.type) {
    switch(notificationData.type) {
      case 'grades':
        notificationIcon = './icon-192x192.png?type=grades';
        break;
      case 'homework':
        notificationIcon = './icon-192x192.png?type=homework';
        break;
      case 'incidents':
        notificationIcon = './icon-192x192.png?type=incidents';
        break;
      case 'presence':
        notificationIcon = './icon-192x192.png?type=presence';
        break;
      case 'communique':
        notificationIcon = './icon-192x192.png?type=communique';
        break;
    }
  }
  
  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationBadge,
    data: notificationData, // Transmettre toutes les données
    tag: notificationData.type || 'general',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: './icon-72x72.png'
      },
      {
        action: 'dismiss',
        title: 'Fermer',
        icon: './icon-72x72.png'
      }
    ],
    timestamp: Date.now()
  };
  
  console.log(`[SW] 📢 Préparation notification: ${notificationTitle}`);
  
  // Afficher la notification système
  self.registration.showNotification(notificationTitle, notificationOptions)
    .then(() => {
      console.log('[SW] ✅ Notification affichée depuis SW');
      
      // Mettre à jour le badge de l'app
      updateBadgeFromBackground();
      
      // Informer les clients ouverts (si l'app est ouverte en arrière-plan)
      notifyOpenClients(payload);
    })
    .catch(err => {
      console.error('[SW] ❌ Erreur affichage notification:', err);
    });
});

// 🏷️ Fonction pour mettre à jour le badge depuis le Service Worker
function updateBadgeFromBackground() {
  // Vérifier si l'API Badging est supportée
  if (typeof navigator !== 'undefined' && navigator.setAppBadge) {
    console.log('[SW] 🔔 Mise à jour badge depuis background');
    
    // Récupérer le compteur actuel depuis IndexedDB ou localStorage
    getBadgeCount().then(count => {
      const newCount = count + 1;
      
      // Mettre à jour le badge
      navigator.setAppBadge(newCount).then(() => {
        console.log(`[SW] ✅ Badge mis à jour: ${newCount}`);
        saveBadgeCount(newCount);
      }).catch(error => {
        console.error('[SW] ❌ Erreur mise à jour badge:', error);
      });
    }).catch(err => {
      console.error('[SW] ❌ Erreur récupération badge count:', err);
      // Utiliser 1 comme valeur par défaut
      navigator.setAppBadge(1).catch(() => {});
    });
  } else {
    console.log('[SW] ⚠️ API Badge non supportée dans ce navigateur');
  }
}

// 💾 Sauvegarder le compteur de badge
function saveBadgeCount(count) {
  // Essayer IndexedDB d'abord
  const request = indexedDB.open('NotificationDB', 1);
  
  request.onupgradeneeded = function(event) {
    const db = event.target.result;
    if (!db.objectStoreNames.contains('badge')) {
      db.createObjectStore('badge', { keyPath: 'id' });
    }
  };
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['badge'], 'readwrite');
    const store = transaction.objectStore('badge');
    
    store.put({ id: 'badge_count', count: count });
  };
}

// 📊 Récupérer le compteur de badge
function getBadgeCount() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NotificationDB', 1);
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction(['badge'], 'readonly');
      const store = transaction.objectStore('badge');
      const getRequest = store.get('badge_count');
      
      getRequest.onsuccess = function() {
        if (getRequest.result) {
          resolve(getRequest.result.count || 0);
        } else {
          resolve(0);
        }
      };
      
      getRequest.onerror = function() {
        reject('Erreur récupération badge');
      };
    };
    
    request.onerror = function() {
      // Fallback: essayer localStorage
      try {
        const count = parseInt(localStorage.getItem('badge_count') || '0');
        resolve(count);
      } catch (e) {
        resolve(0);
      }
    };
  });
}

// 🔄 Informer les clients ouverts (si l'app est en arrière-plan)
function notifyOpenClients(payload) {
  self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clients => {
    if (clients && clients.length > 0) {
      console.log(`[SW] 📡 ${clients.length} client(s) ouvert(s), envoi notification...`);
      
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_NOTIFICATION',
          data: payload
        });
      });
    }
  });
}

// 🖱️ Gestion du clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 🖱️ Notification cliquée:', event.notification.data);
  
  event.notification.close();
  
  // Si l'utilisateur a cliqué sur "Fermer"
  if (event.action === 'dismiss') {
    console.log('[SW] ❌ Notification fermée par l\'utilisateur');
    return;
  }
  
  const data = event.notification.data;
  let urlToOpen = './parent.html';
  
  // Déterminer la page cible en fonction du type de notification
  if (data.page) {
    urlToOpen = `./parent.html#${data.page}`;
  }
  
  // Ajouter des paramètres de navigation si disponibles
  const params = new URLSearchParams();
  if (data.childId) params.append('child', data.childId);
  if (data.type) params.append('type', data.type);
  if (data.id) params.append('id', data.id);
  
  if (params.toString()) {
    urlToOpen += '?' + params.toString();
  }
  
  console.log(`[SW] 🧭 Navigation vers: ${urlToOpen}`);
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Essayer de focus sur un client existant
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('[SW] 🔍 Client existant trouvé, focus et navigation...');
          
          // Navigation programmatique
          return client.focus().then(() => {
            // Envoyer les données pour navigation interne
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data: data,
              url: urlToOpen
            });
            
            // Effacer le badge si l'utilisateur ouvre l'app
            if (navigator.clearAppBadge) {
              navigator.clearAppBadge().then(() => {
                console.log('[SW] ✅ Badge effacé après ouverture');
                saveBadgeCount(0);
              });
            }
          });
        }
      }
      
      // Ouvrir une nouvelle fenêtre si aucun client existant
      console.log('[SW] 🪟 Aucun client trouvé, ouverture nouvelle fenêtre');
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen).then(newClient => {
          if (newClient) {
            // Effacer le badge
            if (navigator.clearAppBadge) {
              navigator.clearAppBadge().then(() => {
                saveBadgeCount(0);
              });
            }
          }
          return newClient;
        });
      }
    })
  );
});

// ==================== INSTALLATION ====================
self.addEventListener('install', (event) => {
  console.log('[SW] 🚀 Installation en cours...');
  
  event.waitUntil(
    initialize().then(() => {
      return caches.open(CACHE_NAME)
        .then(cache => {
          console.log(`[SW] 📦 Mise en cache: ${CACHE_NAME}`);
          console.log(`[SW] Fichiers à cacher: ${STATIC_CACHE_URLS.length}`);
          return cache.addAll(STATIC_CACHE_URLS);
        })
        .then(() => {
          console.log('[SW] ✅ Installation terminée');
          return self.skipWaiting(); // Prendre contrôle immédiatement
        })
        .catch(err => {
          console.error('[SW] ❌ Erreur installation cache:', err);
          // Continuer même si le cache échoue
          return self.skipWaiting();
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
              console.log(`[SW] 🗑️ Suppression cache obsolète: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Prendre contrôle de tous les clients
      self.clients.claim(),
      
      // Initialiser la base de données pour les badges
      initializeBadgeDB(),
      
      // Vérifier les mises à jour immédiatement
      checkForUpdates(),
      
      // Programmer des vérifications périodiques
      scheduleUpdateChecks()
    ]).then(() => {
      console.log('[SW] ✅ Activation complète');
      
      // Notifier tous les clients que le SW est actif
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SERVICE_WORKER_ACTIVE',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// 🗃️ Initialiser la base de données pour les badges
function initializeBadgeDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('NotificationDB', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('badge')) {
        const store = db.createObjectStore('badge', { keyPath: 'id' });
        store.put({ id: 'badge_count', count: 0 });
        console.log('[SW] 🗃️ IndexedDB initialisé pour badges');
      }
    };
    
    request.onsuccess = function() {
      console.log('[SW] ✅ Base de données badges prête');
      resolve();
    };
    
    request.onerror = function() {
      console.warn('[SW] ⚠️ IndexedDB non disponible, utilisation localStorage');
      // Fallback à localStorage
      if (!localStorage.getItem('badge_count')) {
        localStorage.setItem('badge_count', '0');
      }
      resolve();
    };
  });
}

// 🔄 Programmer les vérifications de mises à jour
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
  
  // Pour Firebase, laisser passer
  if (url.href.includes('firebase') || url.href.includes('googleapis')) {
    return;
  }
  
  // Pour le manifest, toujours récupérer depuis le réseau
  if (url.pathname.endsWith('version-manifest.json')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // Pour les pages HTML, stratégie "Network First, Cache Fallback"
  if (event.request.destination === 'document' || 
      event.request.headers.get('Accept')?.includes('text/html')) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Vérifier si la réponse est valide
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Mettre à jour le cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // Fallback au cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Fallback à la page d'accueil
              return caches.match('./parent.html');
            });
        })
    );
    
    return;
  }
  
  // Pour les assets statiques, stratégie "Cache First, Network Fallback"
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Retourner depuis le cache si disponible
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Sinon, récupérer depuis le réseau
        return fetch(event.request)
          .then(networkResponse => {
            // Vérifier si la réponse est valide
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Mettre en cache pour plus tard (uniquement les assets locaux)
            if (event.request.url.startsWith(self.location.origin)) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
            }
            
            return networkResponse;
          })
          .catch(() => {
            // Fallback générique pour les images/icons
            if (event.request.destination === 'image') {
              return caches.match('./icon-192x192.png');
            }
            
            return new Response('Ressource non disponible hors ligne', {
              status: 503,
              statusText: 'Service Unavailable',
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
        event.ports?.[0]?.postMessage({ 
          hasUpdate,
          currentVersion: APP_VERSION 
        });
      });
      break;
      
    case 'GET_VERSION':
      event.ports?.[0]?.postMessage({ 
        version: APP_VERSION,
        cacheName: CACHE_NAME,
        timestamp: Date.now()
      });
      break;
      
    case 'FORCE_UPDATE':
      self.skipWaiting();
      self.clients.claim().then(() => {
        event.ports?.[0]?.postMessage({ 
          success: true,
          message: 'Service Worker mis à jour',
          newVersion: APP_VERSION
        });
      });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports?.[0]?.postMessage({ 
          success: true,
          message: 'Cache nettoyé'
        });
      });
      break;
      
    case 'CLEAR_BADGE':
      if (navigator.clearAppBadge) {
        navigator.clearAppBadge().then(() => {
          saveBadgeCount(0);
          event.ports?.[0]?.postMessage({ 
            success: true,
            message: 'Badge effacé'
          });
        });
      }
      break;
      
    case 'GET_BADGE_COUNT':
      getBadgeCount().then(count => {
        event.ports?.[0]?.postMessage({ 
          count,
          success: true
        });
      });
      break;
      
    case 'SET_BADGE_COUNT':
      if (data && typeof data.count === 'number') {
        if (navigator.setAppBadge) {
          navigator.setAppBadge(data.count).then(() => {
            saveBadgeCount(data.count);
            event.ports?.[0]?.postMessage({ 
              success: true,
              message: `Badge mis à jour: ${data.count}`
            });
          });
        }
      }
      break;
      
    case 'PING':
      event.ports?.[0]?.postMessage({ 
        pong: true,
        version: APP_VERSION,
        timestamp: Date.now(),
        badgeCount: getBadgeCount().then(count => count).catch(() => 0)
      });
      break;
      
    case 'SAVE_PARENT_DATA':
      // Sauvegarder les données parent pour notifications hors ligne
      if (data) {
        saveParentData(data);
        event.ports?.[0]?.postMessage({ 
          success: true,
          message: 'Données parent sauvegardées'
        });
      }
      break;
      
    case 'CHECK_NOW':
      checkForUpdates().then(hasUpdate => {
        if (hasUpdate) {
          event.ports?.[0]?.postMessage({ 
            hasUpdate: true,
            message: 'Mise à jour détectée'
          });
        }
      });
      break;
  }
});

// 💾 Sauvegarder les données parent pour notifications contextuelles
function saveParentData(parentData) {
  const request = indexedDB.open('NotificationDB', 1);
  
  request.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction(['badge'], 'readwrite');
    const store = transaction.objectStore('badge');
    
    store.put({ 
      id: 'parent_data', 
      data: parentData,
      timestamp: Date.now()
    });
    
    console.log('[SW] 💾 Données parent sauvegardées');
  };
}

// ==================== SYNCHRONISATION EN ARRIÈRE-PLAN ====================
// Synchroniser les notifications manquées quand la connexion revient
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    console.log('[SW] 🔄 Synchronisation notifications en cours...');
    event.waitUntil(syncMissedNotifications());
  }
});

async function syncMissedNotifications() {
  // Récupérer les notifications manquées depuis IndexedDB
  // et les synchroniser avec le serveur
  console.log('[SW] 📡 Synchronisation terminée');
}

// ==================== ÉVÉNEMENTS DE PÉRIODE D'ACTIVITÉ ====================
// Utiliser l'API Periodic Background Sync si disponible
if ('periodicSync' in self.registration) {
  try {
    const status = await self.registration.periodicSync.getTags();
    if (!status.includes('update-check')) {
      await self.registration.periodicSync.register('update-check', {
        minInterval: 24 * 60 * 60 * 1000 // Tous les jours
      });
      console.log('[SW] 📅 Synchronisation périodique activée');
    }
  } catch (error) {
    console.log('[SW] ⚠️ Periodic Sync non disponible:', error);
  }
}

self.addEventListener('install', (event) => {
    console.log('Service Worker installé');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activé');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('Push reçu:', event);
    
    const data = event.data?.json() || {};
    const title = data.notification?.title || 'Nouvelle notification';
    const options = {
        body: data.notification?.body || 'Vous avez une nouvelle notification',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        data: data.data || {},
        vibrate: [200, 100, 200],
        actions: [
            { action: 'open', title: 'Ouvrir' },
            { action: 'close', title: 'Fermer' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('Notification cliquée:', event.notification.data);
    
    event.notification.close();
    
    const data = event.notification.data;
    
    if (event.action === 'open' || event.action === '') {
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    for (const client of clientList) {
                        if (client.url === self.location.origin && 'focus' in client) {
                            return client.focus();
                        }
                    }
                    return clients.openWindow('/');
                })
                .then((client) => {
                    if (client && data.page) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            page: data.page,
                            data: data
                        });
                    }
                })
        );
    }
});

self.addEventListener('message', (event) => {
    console.log('Message reçu dans SW:', event.data);
});

// ==================== JOURNAL DE DÉBOGAGE ====================
// Enregistrer tous les événements pour débogage
self.addEventListener('error', (event) => {
  console.error('[SW] ⚠️ Erreur globale:', event.error);
});

console.log('[SW] 🚀 Service Worker CS La Colombe chargé');
console.log(`[SW] 📍 Version: ${APP_VERSION}`);
console.log('[SW] 📡 Prêt pour les notifications en temps réel');
