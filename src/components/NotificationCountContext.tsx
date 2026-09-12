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

export function NotificationCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/count")
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data: { count?: number }) => {
        if (!cancelled) setCount(data.count ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
