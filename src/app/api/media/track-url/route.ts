import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";

const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;

// 재생목록/최근들은에 담긴 트랙의 videoSrc는 R2 signed URL이라 시간이 지나면 만료된다.
// AddToPlaylistButton이 마운트될 때(그 게시물이 지금 피드에 보일 때) 슬쩍 갱신해주지만,
// 게시물이 최근 피드 목록 밖으로 밀려나면 그 수동 갱신을 못 받는다 — 그래서 재생목록에서
// 실제로 재생을 누르는 순간 여기서 한 번 더 최신 signed URL을 받아온다. DEMO(전체공개)
// 게시물만 대상이라(AddToPlaylistButton도 !isComplex 게시물에만 붙음) 별도 인가 검사는
// "public + published"인지만 확인하면 된다.
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("video_url, image_url, audio_url, thumbnail_url, visibility, status")
    .eq("id", postId)
    .single();

  if (!post || post.status !== "published" || post.visibility !== "public") {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
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
