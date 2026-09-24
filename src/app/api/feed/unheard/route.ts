import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl, resolveMediaUrl } from "@/lib/r2/storage";

// DEMO 첫 화면 "안 들은 Drop 이어듣기"(2026-09-25) — 내가 아직 재생 안 한(post_plays 없는)
// 남의 DEMO 음원·영상을 최신순으로 돌려준다. 버튼이 이걸 담기 큐에 넣고 첫 곡부터 연속 재생한다.
// signed URL은 30분짜리지만 큐에서 실제로 틀 때마다 PlaylistContext가 track-url로 다시 받는다.
const LIMIT = 30;
const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tracks: [] }, { status: 401 });

  const [{ data: plays }, { data: posts }] = await Promise.all([
    supabase.from("post_plays").select("post_id").eq("user_id", user.id),
    supabase
      .from("posts")
      .select("id, user_id, title, caption, media_type, video_url, audio_url, thumbnail_url, published_at")
      .eq("visibility", "public")
      .eq("status", "published")
      .neq("user_id", user.id)
      .in("media_type", ["audio", "video"])
      .order("published_at", { ascending: false })
      .limit(200),
  ]);

  const played = new Set((plays ?? []).map((p) => p.post_id));
  const unheard = (posts ?? []).filter((p) => !played.has(p.id) && (p.video_url || p.audio_url)).slice(0, LIMIT);
  if (unheard.length === 0) return NextResponse.json({ tracks: [] });

  const { data: authors } = await supabase
    .from("public_post_authors")
    .select("id, display_name")
    .in("id", [...new Set(unheard.map((p) => p.user_id))]);
  const nameOf = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  const tracks = await Promise.all(
    unheard.map(async (p) => {
      const [videoSrc, posterSrc] = await Promise.all([
        getR2SignedUrl((p.video_url ?? p.audio_url)!, SIGNED_URL_EXPIRY_SECONDS),
        p.thumbnail_url ? resolveMediaUrl(p.thumbnail_url, SIGNED_URL_EXPIRY_SECONDS) : Promise.resolve(null),
      ]);
      return {
        id: p.id,
        title: p.title || p.caption || "음원",
        author: nameOf.get(p.user_id) ?? "알 수 없음",
        authorId: p.user_id,
        videoSrc,
        posterSrc,
        mediaType: p.media_type as "audio" | "video",
      };
    }),
  );

  return NextResponse.json({ tracks });
}
