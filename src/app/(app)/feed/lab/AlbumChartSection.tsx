// 명반 차트 데이터 로드(서버) — 장르 목록 + album_chart(추천 1개 이상인 앨범 전부). 비로그인
// 방문자도 볼 수 있다(0087 — anon에게 select·album_chart 실행 허용).
import { createClient } from "@/lib/supabase/server";
import { AlbumChart } from "./AlbumChart";

export async function AlbumChartSection({ currentUserId }: { currentUserId: string | null }) {
  const supabase = await createClient();
  const [{ data: genres }, { data: albums }] = await Promise.all([
    supabase
      .from("album_genres")
      .select("slug, name, grp, grp_name, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    supabase.rpc("album_chart"),
  ]);
  return <AlbumChart genres={genres ?? []} albums={albums ?? []} currentUserId={currentUserId} />;
}
