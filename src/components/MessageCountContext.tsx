"use client";

// 메시지탭 안읽음 뱃지 숫자 — NotificationCountContext와 같은 패턴(마운트 후
// /api/messages/count를 한 번 불러 첫 페인트를 막지 않는다). 알림과 달리 "읽음 처리"가
// MarkMessagesRead(대화창 진입 시 RPC)로 대화별로 흩어져 있어서 단일 markSeen 대신
// refresh()를 노출 — 대화를 읽고 목록으로 돌아오거나 패널을 닫을 때 다시 불러온다.
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type MessageCountContextValue = {
  count: number;
  refresh: () => void;
};

const MessageCountContext = createContext<MessageCountContextValue>({
  count: 0,
  refresh: () => {},
});

export function MessageCountProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    fetch("/api/messages/count")
      .then((res) => (res.ok ? res.json() : { count: 0 }))
      .then((data: { count?: number }) => setCount(data.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <MessageCountContext.Provider value={{ count, refresh }}>{children}</MessageCountContext.Provider>;
}

export function useMessageCount(): number {
  return useContext(MessageCountContext).count;
}

export function useRefreshMessageCount(): () => void {
  return useContext(MessageCountContext).refresh;
}
