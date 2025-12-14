// firebase-messaging-sw.js - Service Worker dédié aux notifications Firebase

// Import des scripts Firebase (version compat)
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Configuration Firebase
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
try {
  firebase.initializeApp(firebaseConfig);
  console.log('✅ Firebase initialisé dans Service Worker');
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error);
}

// Initialiser Firebase Messaging
const messaging = firebase.messaging();

// Configuration des notifications en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] 📨 Notification en arrière-plan:', payload);
  
  // Extraire les données de la notification
  const notificationTitle = payload.notification?.title || 'CS La Colombe';
  const notificationBody = payload.notification?.body || 'Nouvelle notification';
  const notificationData = payload.data || {};
  const notificationImage = payload.notification?.image || '/icon-192x192.png';
  
  console.log('📋 Données de notification:', {
    title: notificationTitle,
    body: notificationBody,
    data: notificationData,
    image: notificationImage
  });
  
  // Options de la notification
  const notificationOptions = {
    body: notificationBody,
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    image: notificationImage,
    data: notificationData,
    tag: notificationData.type || 'general',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    silent: false,
    timestamp: Date.now(),
    actions: [
      {
        action: 'open_app',
        title: '👁️ Voir'
      },
      {
        action: 'mark_read',
        title: '✅ Marquer comme lu'
      },
      {
        action: 'dismiss',
        title: '❌ Ignorer'
      }
    ]
  };
  
  // Afficher la notification
  return self.registration.showNotification(notificationTitle, notificationOptions)
    .then(() => {
      console.log('✅ Notification affichée avec succès');
      
      // Mettre à jour le badge
      updateBadge();
      
      // Envoyer un message aux clients ouverts
      notifyClients(payload);
    })
    .catch((error) => {
      console.error('❌ Erreur affichage notification:', error);
    });
});

// Mettre à jour le badge de notification
function updateBadge() {
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge().catch(error => {
      console.log('Badge API non supportée:', error);
    });
  }
}

// Notifier les clients ouverts
function notifyClients(payload) {
  self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'FIREBASE_BACKGROUND_MESSAGE',
        payload: payload
      });
    });
  })
  .catch((error) => {
    console.error('❌ Erreur notification clients:', error);
  });
}

// Gérer le clic sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] 🔘 Notification cliquée:', event.notification.data);
  
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  // Fermer la notification
  notification.close();
  
  // Gérer les différentes actions
  switch (action) {
    case 'open_app':
    case '':
      openApplication(data);
      break;
      
    case 'mark_read':
      markNotificationAsRead(data);
      break;
      
    case 'dismiss':
      console.log('Notification ignorée');
      break;
      
    default:
      openApplication(data);
  }
  
  event.waitUntil(Promise.resolve());
});

// Ouvrir l'application
function openApplication(data) {
  console.log('🌐 Ouverture de l\'application...', data);
  
  const urlToOpen = self.location.origin + '/';
  const page = data.page || 'dashboard';
  const childId = data.childId || '';
  
  self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  })
  .then((clientList) => {
    // Chercher un onglet déjà ouvert
    for (const client of clientList) {
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        console.log('✅ Client trouvé, focus et navigation...');
        
        // Focus sur le client
        client.focus();
        
        // Envoyer un message pour naviguer
        client.postMessage({
          type: 'NAVIGATE_TO_PAGE',
          page: page,
          childId: childId,
          data: data
        });
        
        return;
      }
    }
    
    // Si aucun client ouvert, ouvrir une nouvelle fenêtre
    console.log('Nouvel onglet...');
    return self.clients.openWindow(urlToOpen)
      .then((newClient) => {
        if (newClient) {
          // Attendre que la page se charge
          setTimeout(() => {
            newClient.postMessage({
              type: 'NAVIGATE_TO_PAGE',
              page: page,
              childId: childId,
              data: data
            });
          }, 1500);
        }
      });
  })
  .catch((error) => {
    console.error('❌ Erreur ouverture application:', error);
    // Fallback: ouvrir dans un nouvel onglet
    self.clients.openWindow(urlToOpen);
  });
}

// Marquer une notification comme lue
function markNotificationAsRead(data) {
  console.log('📝 Marquer comme lu:', data);
  
  // Ici, vous pourriez envoyer une requête à votre backend
  // Pour marquer la notification comme lue
  
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'NOTIFICATION_READ',
        data: data
      });
    });
  });
}

// Gérer les messages des clients
self.addEventListener('message', (event) => {
  console.log('[firebase-messaging-sw.js] 📩 Message du client:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'GET_FCM_TOKEN':
      // Récupérer le token FCM
      messaging.getToken({
        vapidKey: "BFc44CIL4VykUiY8_17s_HbUm5pRqhNhlFcy35H0XKuyFIq-2472MTfMZBfKMxW81DCHTkRB4xy_WaH-f3Ik2TM",
        serviceWorkerRegistration: self.registration
      })
      .then((token) => {
        event.source.postMessage({
          type: 'FCM_TOKEN',
          token: token
        });
      })
      .catch((error) => {
        console.error('❌ Erreur récupération token:', error);
        event.source.postMessage({
          type: 'FCM_TOKEN_ERROR',
          error: error.message
        });
      });
      break;
      
    case 'TEST_NOTIFICATION':
      // Tester les notifications
      self.registration.showNotification('Test Firebase', {
        body: 'Ceci est un test de notification Firebase',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'test',
        requireInteraction: true
      });
      break;
      
    case 'CHECK_PERMISSION':
      // Vérifier la permission
      const permission = Notification.permission;
      event.source.postMessage({
        type: 'PERMISSION_STATUS',
        permission: permission
      });
      break;
  }
});

// Installation
self.addEventListener('install', (event) => {
  console.log('[firebase-messaging-sw.js] 🛠️ Installation');
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('[firebase-messaging-sw.js] 🎯 Activation');
  event.waitUntil(self.clients.claim());
});

// Gérer les erreurs
self.addEventListener('error', (error) => {
  console.error('[firebase-messaging-sw.js] ❌ Erreur:', error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[firebase-messaging-sw.js] ❌ Promesse rejetée:', event.reason);
});
