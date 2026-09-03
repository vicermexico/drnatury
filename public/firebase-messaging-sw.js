importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC71OI05hC363BTCY7ah3plZqfjXwiGzmM",
  authDomain: "drnatury-5db90.firebaseapp.com",
  projectId: "drnatury-5db90",
  storageBucket: "drnatury-5db90.firebasestorage.app",
  messagingSenderId: "837505418362",
  appId: "1:837505418362:web:4de20ffdb1854ba4a6e7c3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "DrNatury", {
    body: body ?? "",
    icon: "/icons/icon-192x192.png",
    data: { url: "/paciente/citas" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/paciente/citas";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});