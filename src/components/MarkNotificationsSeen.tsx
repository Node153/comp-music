"use client";

// 1.4 인앱뱃지: 본인 프로필을 실제로 열람했을 때만 "확인함"으로 표시.
// 서버 컴포넌트 렌더(=prefetch 포함) 중에 갱신하면 안 열어봐도 읽음 처리될 수 있어 useEffect로 마운트 시점에만 실행.
// 실제 DB 업데이트 + 뱃지 즉시 반영은 NotificationCountContext의 markSeen(TopNav 알림
// 드롭다운과 공유)에 맡긴다.
import { useEffect } from "react";
import { useMarkNotificationsSeen } from "@/components/NotificationCountContext";

export function MarkNotificationsSeen({ userId }: { userId: string }) {
  const markSeen = useMarkNotificationsSeen();

  useEffect(() => {
    void markSeen(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
