// Compmusic 서비스 워커.
//   - 웹 푸시(0074) 수신: 알림 표시 + 앱 아이콘 숫자 뱃지 갱신 + 알림 버튼(Android) 처리
//   - 공유 받기(Web Share Target, 2026-09-24): 다른 앱에서 Compmusic으로 공유한 음원·영상을
//     잠깐 캐시에 넣고 업로드 화면으로 넘긴다(src/lib/shareTarget.ts가 꺼내 씀).
// 그 외 요청은 전혀 가로채지 않는다(오프라인 캐시 없음) — 캐시가 끼면 배포 직후 옛 화면이 남는
// 등 문제만 생긴다. fetch 핸들러는 공유 받기 경로 하나만 처리하고 나머지는 그대로 네트워크로 보낸다.

// src/lib/shareTarget.ts와 반드시 같은 값.
const SHARE_CACHE_NAME = "comp-share-target-v1";
const SHARE_CACHE_KEY = "/__shared-upload";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 홈 화면 아이콘 숫자(Badging API — iOS 16.4+ 홈 화면 앱, 데스크톱 크롬·엣지 설치 앱. Android는
// 런처가 알림 유무로 점만 찍는다). 서버의 안읽음 수(/api/notifications/count, 로그인 쿠키 포함)를 그대로
// 쓴다 — 서비스 워커가 직접 세면 앱에서 읽음 처리한 것과 어긋나기 때문.
async function refreshAppBadge() {
  if (!("setAppBadge" in self.navigator)) return;
  try {
    const res = await fetch("/api/notifications/count", { credentials: "include" });
    if (!res.ok) return;
    const { count } = await res.json();
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // 뱃지는 부가 기능 — 실패해도 알림은 이미 떴다.
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Compmusic", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Compmusic";
  const actions = Array.isArray(data.actions) ? data.actions.slice(0, 2) : [];
  const actionUrls = {};
  for (const a of actions) actionUrls[a.action] = a.url;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/pwa-icon-192.png",
        // Android 상단 상태바 아이콘 — 실루엣으로만 그려지므로 흰색 단색 음표(투명 배경).
        badge: "/notification-badge.png",
        // Android: 펼치면 게시물 커버가 크게 보이고, 짧게 두 번 진동. iOS는 둘 다 무시.
        image: data.image || undefined,
        vibrate: [80, 40, 80],
        actions: actions.map((a) => ({ action: a.action, title: a.title })),
        tag: data.tag,
        renotify: Boolean(data.tag),
        timestamp: Date.now(),
        data: { url: data.url || "/feed", actionUrls },
      }),
      refreshAppBadge(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // 알림 버튼(Android)을 눌렀으면 그 버튼의 주소, 본문을 눌렀으면 기본 주소.
  const path = (event.action && data.actionUrls && data.actionUrls[event.action]) || data.url || "/feed";
  const target = new URL(path, self.location.origin);
  // 이용 통계(0079) 유입 태그 — 푸시로 들어온 방문을 센다(버튼이면 어떤 버튼인지도). 앱이 도착 즉시
  // 주소창에서 지운다(AnalyticsTracker).
  target.searchParams.set("src", event.action ? `push_${event.action}` : "push");
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

// 공유 받기 — manifest.ts share_target(action=/share-target, POST multipart, 파일 필드 "media").
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin || url.pathname !== "/share-target") return;
  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const file = form.getAll("media").find((f) => f && typeof f === "object" && "size" in f && f.size > 0);
        if (!file) return Response.redirect("/upload?shared=missing&reason=nofile", 303);
        const cache = await caches.open(SHARE_CACHE_NAME);
        await cache.put(
          SHARE_CACHE_KEY,
          new Response(file, {
            headers: {
              "content-type": file.type || "application/octet-stream",
              "x-file-name": encodeURIComponent(file.name || "shared-file"),
            },
          }),
        );
        return Response.redirect("/upload?shared=1", 303);
      } catch (err) {
        // 이유를 주소에 남겨 둔다(업로드 화면 동작엔 영향 없음) — 기기별 문제 추적용.
        return Response.redirect(`/upload?shared=missing&reason=${encodeURIComponent(String((err && err.name) || "error"))}`, 303);
      }
    })(),
  );
});
