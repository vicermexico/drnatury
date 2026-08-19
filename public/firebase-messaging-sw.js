importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAx3_Gzu4l0AZB56QD9XjvuhpGkKT4NNNo",
  authDomain: "DrNatury-61eb5.firebaseapp.com",
  projectId: "DrNatury-61eb5",
  messagingSenderId: "221457294005",
  appId: "1:221457294005:web:44e1556c224694afad14fc",
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