// === CRÉER LE FICHIER firebase-messaging-sw.js ===

// Créez un fichier séparé nommé "firebase-messaging-sw.js" à la racine de votre application :

/*
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
    console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload);
    
    const notificationTitle = payload.notification?.title || 'Nouvelle notification';
    const notificationOptions = {
        body: payload.notification?.body || 'Vous avez une nouvelle notification',
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        data: payload.data || {},
        requireInteraction: true,
        vibrate: [200, 100, 200],
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
    console.log('[firebase-messaging-sw.js] Notification cliquée:', event.notification.data);
    
    event.notification.close();
    
    const data = event.notification.data;
    
    if (event.action === 'open' || event.action === '') {
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
