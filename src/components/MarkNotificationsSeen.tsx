"use client";

// 1.4 인앱뱃지: 본인 프로필을 실제로 열람했을 때만 "확인함"으로 표시.
// 서버 컴포넌트 렌더(=prefetch 포함) 중에 갱신하면 안 열어봐도 읽음 처리될 수 있어 useEffect로 마운트 시점에만 실행.
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function MarkNotificationsSeen({ userId }: { userId: string }) {
  const supabase = createClient();

  useEffect(() => {
    async function markSeen() {
      await supabase
        .from("users")
        .update({ notifications_seen_at: new Date().toISOString() })
        .eq("id", userId);
    }
    void markSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return null;
}
