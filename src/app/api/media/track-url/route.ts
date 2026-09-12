import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;

// 재생목록/최근들은에 담긴 트랙의 videoSrc는 R2 signed URL이라 시간이 지나면 만료된다.
// AddToPlaylistButton이 마운트될 때(그 게시물이 지금 피드에 보일 때) 슬쩍 갱신해주지만,
// 게시물이 최근 피드 목록 밖으로 밀려나면 그 수동 갱신을 못 받는다 — 그래서 재생목록에서
// 실제로 재생을 누르는 순간 여기서 한 번 더 최신 signed URL을 받아온다.
// 처음엔 DEMO(전체공개)만 대상이라 "public + published"만 확인했는데, memo(비공개) 게시물도
// "최근 들은"에 기록되면서(담기는 여전히 금지) 재생목록에서 재생이 안 되는 회귀가 생겼다 —
// memo 트랙은 여기서 항상 404라 fetchFreshTrack이 만료됐을 수도 있는 원래 URL로 폴백했기
// 때문. can_access_post_content(0017 companions 마이그레이션, feed/page.tsx의
// canViewMediaFor와 동일 판정)로 실제 열람 권한을 검사하도록 바꿔서 memo도 정상 동작하게.
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("posts")
    .select("video_url, image_url, audio_url, thumbnail_url, visibility, status")
    .eq("id", postId)
    .single();

  if (!post || post.status !== "published") {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  }

  if (post.visibility !== "public") {
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const { data: canAccess } = await supabase.rpc("can_access_post_content", {
      pid: postId,
      uid: user.id,
    });
    if (!canAccess) {
      return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
    }
  }

  const mediaPath = post.video_url ?? post.audio_url ?? post.image_url;
  if (!mediaPath) {
    return NextResponse.json({ error: "재생 가능한 미디어가 없습니다." }, { status: 404 });
  }

  const [videoSrc, posterSrc] = await Promise.all([
    getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS),
    post.thumbnail_url ? resolveMediaUrl(post.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS) : Promise.resolve(null),
  ]);

  return NextResponse.json({ videoSrc, posterSrc });
}
