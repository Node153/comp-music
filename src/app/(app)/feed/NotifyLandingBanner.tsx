import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotifyLandingBannerView } from "./NotifyLandingBannerView";

// 알림을 타고 들어온 화면(0077, "반응 → 다음 업로드") — 내 게시물 알림(푸시·메일·알림 패널)의
// 링크엔 from=notify가 붙고(reactionNotify.ts postHref), 피드가 그걸 보면 맨 위에 "최근 7일 받은
// 반응·청취자 + 새 Drop 올리기" 배너를 띄운다. 반응을 확인하는 순간이 다음 업로드로 넘어가기
// 가장 좋은 타이밍이라서. post_plays는 본인 기록만 읽히는 RLS라 집계는 service_role로 한다
// (조회 대상은 항상 로그인한 본인 게시물로 한정).
const WINDOW_DAYS = 7;

function windowStartISO() {
  return new Date(Date.now() - WINDOW_DAYS * 24 * 3_600_000).toISOString();
}

export async function NotifyLandingBanner({ userId }: { userId: string }) {
  const admin = createAdminClient();
  const since = windowStartISO();
  const { data: myPosts } = await admin.from("posts").select("id").eq("user_id", userId).eq("status", "published");
  const ids = (myPosts ?? []).map((p) => p.id);

  let reactions = 0;
  let listeners = 0;
  if (ids.length > 0) {
    const [likes, comments, kicks, plays] = await Promise.all([
      admin.from("likes").select("id", { count: "exact", head: true }).in("post_id", ids).neq("user_id", userId).gt("created_at", since),
      admin.from("comments").select("id", { count: "exact", head: true }).in("post_id", ids).neq("user_id", userId).gt("created_at", since),
      admin.from("kicks").select("id", { count: "exact", head: true }).in("post_id", ids).gt("created_at", since),
      admin.from("post_plays").select("post_id", { count: "exact", head: true }).in("post_id", ids).neq("user_id", userId).gt("played_at", since),
    ]);
    reactions = (likes.count ?? 0) + (comments.count ?? 0) + (kicks.count ?? 0);
    listeners = plays.count ?? 0;
  }

  return <NotifyLandingBannerView reactions={reactions} listeners={listeners} hasPosts={ids.length > 0} />;
}
