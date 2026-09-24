"use client";

// 안읽음 알림 뱃지 숫자를 클라이언트에서 관리 — TopNav/MobileTopBar/BottomNav가 공유한다.
// 예전엔 (app)/layout.tsx가 서버에서 계산해 prop으로 내려줬고, 그 계산(쿼리 7개)이
// 모든 페이지 첫 페인트를 막았다. 이제 마운트 후 /api/notifications/count를 한 번 불러
// 페인트와 분리한다. Provider 밖에서 훅을 쓰면(비로그인 등) 그냥 0.
// markSeen도 여기서 같이 관리 — MarkNotificationsSeen(전체 알림 페이지)과 NotificationsMenu
// (TopNav 드롭다운)가 "읽음 처리 DB 업데이트 + 뱃지 즉시 0으로" 로직을 공유한다. 이전엔
// MarkNotificationsSeen이 DB만 갱신하고 이미 마운트된 Provider의 count는 그대로라
// 뱃지가 다음 새로고침 전까진 안 사라졌다.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NotificationCountContextValue = {
  count: number;
  markSeen: (userId: string) => Promise<void>;
};

const NotificationCountContext = createContext<NotificationCountContextValue>({
  count: 0,
  markSeen: async () => {},
});

// 홈 화면 앱 아이콘 숫자(Badging API, 2026-09-24) — iOS 16.4+ 홈 화면 앱·데스크톱 설치 앱에서 보이고,
// 미지원 환경(일반 브라우저 탭 등)에선 조용히 무시된다. 푸시가 올 때는 sw.js가 같은 숫자로 올린다.
function syncAppBadge(count: number) {
  try {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    if (count > 0) navigator.setAppBadge(count).catch(() => {});
    else navigator.clearAppBadge().catch(() => {});
  } catch {
    // 권한·정책으로 막혀도 뱃지 숫자(화면 안)는 그대로 동작.
  }
}

export function NotificationCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  // 처음 한 번 + 앱을 다시 앞으로 가져올 때마다(백그라운드에 있는 동안 푸시로 새 알림이 왔을 수 있음).
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/notifications/count")
        .then((res) => (res.ok ? res.json() : { count: 0 }))
        .then((data: { count?: number }) => {
          if (!cancelled) setCount(data.count ?? 0);
        })
        .catch(() => {});
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    syncAppBadge(count);
  }, [count]);

  const markSeen = useCallback(async (userId: string) => {
    const supabase = createClient();
    await supabase.from("users").update({ notifications_seen_at: new Date().toISOString() }).eq("id", userId);
    setCount(0);
  }, []);

  return (
    <NotificationCountContext.Provider value={{ count, markSeen }}>{children}</NotificationCountContext.Provider>
  );
}

export function useNotificationCount(): number {
  return useContext(NotificationCountContext).count;
}

export function useMarkNotificationsSeen(): (userId: string) => Promise<void> {
  return useContext(NotificationCountContext).markSeen;
}
