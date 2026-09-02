import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// FEED-06: 노출시간 만료된 posts의 status를 published -> expired로 정리(soft-expire).
//
// 주의: 피드/PEAK 노출 자체는 이 크론이 아니라 조회 시점의 expires_at 비교로 즉시 차단된다
// (feed/page.tsx, RightSidebar.tsx의 `expires_at.gt.now` 필터 참고). 즉 6h 게시물은 크론
// 실행 여부와 무관하게 정확히 6h 뒤 피드에서 사라진다. 이 크론은 status 컬럼을 뒤늦게
// 맞춰주는 하우스키핑 용도이며, 프로필 그리드의 "만료됨" 배지도 이제 expires_at을 직접
// 비교하므로(profile 페이지 참고) 크론 주기(Hobby 플랜상 하루 1회)에 의존하지 않는다.
//
// service-role로 RLS를 우회해 모든 사용자의 posts를 갱신해야 하므로 CRON_SECRET으로 보호.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error, data } = await supabase
    .from("posts")
    .update({ status: "expired" })
    .eq("status", "published")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
