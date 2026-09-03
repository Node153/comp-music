import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText } from "@/components/ui/styles";
import { FeedHeroManager } from "./FeedHeroManager";

// 관리자 - DEMO 피드 상단 힐링 멘트 관리. role=admin만 접근(proxy.ts에서 가드).
// DEMO 피드에 들어올 때마다 '노출' 문구 중 하나가 랜덤으로 뜬다(자동 로테이션 없음).
export default async function AdminFeedHeroPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("feed_hero_messages")
    .select("id, question, answer, sort_order, active")
    .order("sort_order", { ascending: true });

  return (
    <main className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className={pageTitle}>피드 힐링 멘트 관리</h1>
        <p className={mutedText}>
          DEMO 피드를 열 때마다 &lsquo;노출&rsquo; 상태인 문구 중 하나가 랜덤으로 표시됩니다.
        </p>
      </div>

      <FeedHeroManager initial={rows ?? []} />
    </main>
  );
}
