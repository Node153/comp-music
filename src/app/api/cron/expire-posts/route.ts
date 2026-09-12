import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteR2Object } from "@/lib/r2/storage";

// FEED-06: 노출시간 만료된 posts의 status를 published -> expired로 정리(soft-expire).
//
// 주의: 피드/PEAK 노출 자체는 이 크론이 아니라 조회 시점의 expires_at 비교로 즉시 차단된다
// (feed/page.tsx, RightSidebar.tsx의 `expires_at.gt.now` 필터 참고). 즉 6h 게시물은 크론
// 실행 여부와 무관하게 정확히 6h 뒤 피드에서 사라진다. 이 크론은 status 컬럼을 뒤늦게
// 맞춰주는 하우스키핑 용도이며, 프로필 그리드의 "만료됨" 배지도 이제 expires_at을 직접
// 비교하므로(profile 페이지 참고) 크론 주기(Hobby 플랜상 하루 1회)에 의존하지 않는다.
//
// 원래 expired 상태는 영구 보관이었지만(0001_init.sql 주석 참고), memo(비공개) 게시물이
// 계속 쌓이며 R2 스토리지 비용만 늘어서 만료 시점(expires_at) 기준 7일 뒤 하드 삭제하도록
// 변경했다(사용자 피드백). DEMO처럼 expires_at이 없는 영구노출 게시물은 대상에서 제외.
// 하드 삭제는 DeletePostButton/PostOptionsMenu의 사용자 직접 삭제와 동일하게 R2 미디어
// 파일을 먼저 지우고 posts row를 지운다(연관 likes/comments/post_access/post_chat_messages/
// post_views는 on delete cascade로 함께 정리됨).
//
// service-role로 RLS를 우회해 모든 사용자의 posts를 갱신해야 하므로 CRON_SECRET으로 보호.
const DELETE_AFTER_EXPIRY_DAYS = 7;

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

  const deleteCutoff = new Date(
    Date.now() - DELETE_AFTER_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: toDelete, error: selectError } = await supabase
    .from("posts")
    .select("id, video_url, image_url, audio_url")
    .not("expires_at", "is", null)
    .lt("expires_at", deleteCutoff);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (toDelete && toDelete.length > 0) {
    await Promise.all(
      toDelete.map((post) => {
        const mediaKey = post.video_url ?? post.image_url ?? post.audio_url;
        return mediaKey ? deleteR2Object(mediaKey) : undefined;
      }),
    );
    const { error: deleteError } = await supabase
      .from("posts")
      .delete()
      .in(
        "id",
        toDelete.map((post) => post.id),
      );

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ expired: data?.length ?? 0, deleted: toDelete?.length ?? 0 });
}
