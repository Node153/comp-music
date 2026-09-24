"use client";

// 업로더용 "들은 기록"(0084) — 내 DEMO 글 카드 아래에 "N명이 들었어요 · M명은 끝까지" 한 줄.
// 좋아요가 1개여도 실제로 몇 명이 들었는지 보이면 체감이 달라서(반응 적어 업로드를 망설이는
// 문제, 2026-09-25). my_post_listen_stats가 본인 글만 돌려주므로 남의 글엔 애초에 안 붙인다.
// 들은 사람이 0명이면 아무것도 안 그린다(빈 숫자는 오히려 기운 빠지게 함). avg_pct는 play_end
// 기록이 있는 일부 청취자만의 평균이라(통계 수집은 2026-09-25부터) 화면에는 아직 안 쓴다.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HeadphonesIcon } from "@/components/icons";

type Stats = { listeners: number; finished: number };

export function ListenInsight({ postId, className = "" }: { postId: string; className?: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createClient()
      .rpc("my_post_listen_stats", { p_post_ids: [postId] })
      .then(({ data }) => {
        const row = data?.[0];
        if (cancelled || !row) return;
        setStats({ listeners: row.listeners, finished: row.finished });
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (!stats || stats.listeners === 0) return null;

  return (
    <p className={`flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      <HeadphonesIcon className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-semibold text-gray-700 dark:text-gray-200">{stats.listeners}명</span>이 들었어요
        {stats.finished > 0 && (
          <>
            {" · "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">{stats.finished}명</span>은 끝까지
          </>
        )}
      </span>
      <span className="text-gray-400 dark:text-gray-500">(나만 보여요)</span>
    </p>
  );
}
