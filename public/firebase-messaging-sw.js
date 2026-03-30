importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE SERVICE WORKER
// Receives background push notifications when the tab is closed or minimized.
// Note: In production, these config values should match your web app config.
// Here we inject placeholders to prevent crashes, but ideally, the backend 
// provides them or we inject dynamically.
// ─────────────────────────────────────────────────────────────────────────────

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/images/logo-icon.png', // Ensure this exists in your public folder
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
