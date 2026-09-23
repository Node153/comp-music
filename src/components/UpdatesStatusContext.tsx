"use client";

// 업데이트 소식 "새 소식" 상태(0068) — 사이드바/모바일 상단 피드백 아이콘의 점, 홈 상단 배너가
// 공유한다. NotificationCountContext와 같은 패턴: 마운트 후 /api/updates/status를 한 번 불러
// 첫 페인트와 분리하고, markSeen은 "DB 갱신 + 점·배너 즉시 숨김"을 같이 처리한다.
// 피드백 페이지에 들어가면(MarkUpdatesSeen) 본 것으로 기록된다.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type LatestUpdate = { id: string; title: string; kind: "notice" | "update" | "feedback"; created_at: string };

type UpdatesStatusValue = {
  unseen: boolean;
  latest: LatestUpdate | null;
  markSeen: () => Promise<void>;
};

const UpdatesStatusContext = createContext<UpdatesStatusValue>({
  unseen: false,
  latest: null,
  markSeen: async () => {},
});

export function UpdatesStatusProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [unseen, setUnseen] = useState(false);
  const [latest, setLatest] = useState<LatestUpdate | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/updates/status")
      .then((res) => (res.ok ? res.json() : { unseen: false, latest: null }))
      .then((data: { unseen?: boolean; latest?: LatestUpdate | null }) => {
        if (cancelled) return;
        setUnseen(!!data.unseen);
        setLatest(data.latest ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback(async () => {
    setUnseen(false);
    await createClient().from("users").update({ updates_seen_at: new Date().toISOString() }).eq("id", userId);
  }, [userId]);

  return (
    <UpdatesStatusContext.Provider value={{ unseen, latest, markSeen }}>{children}</UpdatesStatusContext.Provider>
  );
}

export function useUpdatesStatus(): UpdatesStatusValue {
  return useContext(UpdatesStatusContext);
}

// 피드백 페이지에 두면 진입 시 "봤음"으로 기록.
export function MarkUpdatesSeen() {
  const { unseen, markSeen } = useUpdatesStatus();
  useEffect(() => {
    if (unseen) void markSeen();
  }, [unseen, markSeen]);
  return null;
}
