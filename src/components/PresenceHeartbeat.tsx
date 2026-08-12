"use client";

// 우측 사이드바 "온라인" 목록(RightSidebar)이 쓰는 users.last_seen_at(0025)을 주기적으로
// 갱신하는 역할만 하는 마운트 전용 컴포넌트 — ThemeSync와 같은 패턴(로그인 레이아웃에 하나만
// 심어두고 화면엔 아무것도 안 그림). 탭을 열어둔 동안엔 항상 "최근 접속"으로 보이게, 포커스가
// 없어도 계속 갱신한다(온라인 여부를 굳이 "활성 탭"까지 따질 필요는 없다고 판단 — 백그라운드
// 탭이어도 로그인 세션이 떠 있으면 온라인으로 본다).
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function PresenceHeartbeat({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();

    function ping() {
      supabase.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", userId).then();
    }

    ping();
    const timer = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId]);

  return null;
}
