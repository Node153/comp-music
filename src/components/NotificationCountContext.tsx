"use client";

// 안읽음 알림 뱃지 숫자를 클라이언트에서 관리 — TopNav/MobileTopBar/BottomNav가 공유한다.
// 예전엔 (app)/layout.tsx가 서버에서 계산해 prop으로 내려줬고, 그 계산(쿼리 7개)이
// 모든 페이지 첫 페인트를 막았다. 이제 마운트 후 /api/notifications/count를 한 번 불러
// 페인트와 분리한다. Provider 밖에서 훅을 쓰면(비로그인 등) 그냥 0.
import { createContext, useContext, useEffect, useState } from "react";

const NotificationCountContext = createContext<number>(0);

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

  return (
    <NotificationCountContext.Provider value={count}>{children}</NotificationCountContext.Provider>
  );
}

export function useNotificationCount(): number {
  return useContext(NotificationCountContext);
}
