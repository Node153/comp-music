// Compmusic 서비스 워커 — 웹 푸시(0074) 수신 전용.
// fetch 핸들러(오프라인 캐시)는 일부러 없다: 캐시가 끼면 배포 직후 옛 화면이 남는 등 문제만
// 생기고, 지금 필요한 건 "앱을 안 열어도 반응 알림이 뜨는 것"뿐이다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Compmusic", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Compmusic";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/feed" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/feed", self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // 이미 열린 Compmusic 탭이 있으면 새 탭을 늘리지 않고 그 탭을 해당 게시물로 옮긴다.
      for (const client of windows) {
        if (new URL(client.url).origin === target.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(target.href);
          return;
        }
      }
      return self.clients.openWindow(target.href);
    })(),
  );
});
