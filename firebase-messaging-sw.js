// firebase-messaging-sw.js
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

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Gérer les notifications en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Notification reçue en arrière-plan:', payload);
  
  const notificationTitle = payload.notification?.title || 'Nouvelle notification';
  const notificationOptions = {
    body: payload.notification?.body || 'Vous avez une nouvelle notification',
    icon: 'icon-192x192.png',
    badge: 'icon-72x72.png',
    data: payload.data || {},
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Ouvrir'
      },
      {
        action: 'close',
        title: 'Fermer'
      }
    ]
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Gérer le clic sur la notification
self.addEventListener('notificationclick', (event) => {
  console.log('🔘 Notification cliquée:', event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data;
  
  if (event.action === 'open' || event.action === '') {
    // Ouvrir l'application
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          if (clientList.length > 0) {
            let client = clientList[0];
            for (let i = 0; i < clientList.length; i++) {
              if (clientList[i].focused) {
                client = clientList[i];
              }
            }
            return client.focus();
          }
          return clients.openWindow('/');
        })
        .then((client) => {
          if (client && data.page) {
            // Envoyer un message au client pour naviguer
            client.postMessage({
              type: 'NAVIGATE_TO_PAGE',
              page: data.page,
              data: data
            });
          }
        })
    );
  }
});

// Gérer les messages reçus
self.addEventListener('message', (event) => {
  console.log('📨 Message reçu dans SW:', event.data);
  
  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '2.1.0' });
  }
});
