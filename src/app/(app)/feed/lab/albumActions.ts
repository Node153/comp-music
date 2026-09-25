"use server";

// 명반 차트(0087) 쓰기 — 추천하기·취소, 그리고 Apple 검색에 없을 때 쓰는 MusicBrainz 보조 검색.
// 앨범 정보(제목·아티스트·커버)는 클라이언트가 보낸 걸 믿지 않고 여기서 Apple/MusicBrainz에
// 다시 조회해서 service role로 넣는다(albums에는 INSERT 정책이 없음). 추천 자체는 로그인한
// 사용자 세션으로 recommend_album RPC를 불러서 장르당 5장·이유 필수 같은 규칙을 DB가 판단한다.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyUserRow } from "@/lib/auth";
import { ALBUM_GENRE_LIMIT, ALBUM_REASON_MAX, type AlbumCandidate, type AlbumGenre } from "@/lib/albumChart";
import type { Database } from "@/types/database";

// MusicBrainz는 누가 부르는지 알 수 있는 User-Agent를 요구한다(없으면 차단될 수 있음).
const MB_UA = "Compmusic/1.0 ( https://www.compmusic.kr )";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERROR_TEXT: Record<string, string> = {
  not_allowed: "승인된 회원만 추천할 수 있어요.",
  reason_required: "처음 추천하는 앨범은 한 줄 이유를 남겨주세요.",
  reason_too_long: `이유는 ${ALBUM_REASON_MAX}자까지 쓸 수 있어요.`,
  bad_genre: "장르를 다시 골라주세요.",
  genre_limit: `이 장르는 이미 ${ALBUM_GENRE_LIMIT}장을 추천했어요. 기존 추천을 취소하면 새로 추천할 수 있어요.`,
  already_recommended: "이미 추천한 앨범이에요.",
  album_not_found: "앨범 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
};

type AlbumInsert = Database["public"]["Tables"]["albums"]["Insert"];

function parseYear(date: string | undefined | null) {
  const y = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 1800 ? y : null;
}

async function fetchAlbumMeta(
  source: "itunes" | "musicbrainz",
  sourceId: string,
): Promise<Omit<AlbumInsert, "genre" | "added_by"> | null> {
  try {
    if (source === "itunes") {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${sourceId}&entity=album&country=US`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json: {
        results?: {
          wrapperType?: string;
          collectionName?: string;
          artistName?: string;
          artworkUrl100?: string;
          releaseDate?: string;
          collectionViewUrl?: string;
        }[];
      } = await res.json();
      const r = json.results?.find((x) => x.wrapperType === "collection");
      if (!r?.collectionName || !r.artistName) return null;
      return {
        source,
        source_id: sourceId,
        title: r.collectionName,
        artist: r.artistName,
        artwork_url: r.artworkUrl100 ?? null,
        release_year: parseYear(r.releaseDate),
        source_url: r.collectionViewUrl?.replace(/\?.*$/, "") ?? null,
      };
    }
    const res = await fetch(`https://musicbrainz.org/ws/2/release-group/${sourceId}?inc=artist-credits&fmt=json`, {
      headers: { "User-Agent": MB_UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rg: {
      title?: string;
      "first-release-date"?: string;
      "artist-credit"?: { name: string; joinphrase?: string }[];
    } = await res.json();
    const artist = (rg["artist-credit"] ?? []).map((a) => a.name + (a.joinphrase ?? "")).join("");
    if (!rg.title || !artist) return null;
    return {
      source,
      source_id: sourceId,
      title: rg.title,
      artist,
      // 커버가 없는 앨범도 있다 — 화면에서 이미지 로드 실패 시 기본 아이콘으로 대체.
      artwork_url: `https://coverartarchive.org/release-group/${sourceId}/front-250`,
      release_year: parseYear(rg["first-release-date"]),
      source_url: `https://musicbrainz.org/release-group/${sourceId}`,
    };
  } catch {
    return null;
  }
}

export async function recommendAlbum(input: {
  source: "itunes" | "musicbrainz";
  sourceId: string;
  genre: string;
  reason: string;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const me = await getMyUserRow();
  if (!me) return { ok: false, error: "로그인하면 추천할 수 있어요." };
  if (me.status !== "approved") return { ok: false, error: ERROR_TEXT.not_allowed };

  const { source, sourceId, genre } = input;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const validId =
    (source === "itunes" && /^\d{1,15}$/.test(sourceId)) || (source === "musicbrainz" && UUID.test(sourceId));
  if (!validId || typeof genre !== "string" || !/^[a-z0-9-]{1,40}$/.test(genre)) {
    return { ok: false, error: ERROR_TEXT.album_not_found };
  }
  if (reason.length > ALBUM_REASON_MAX) return { ok: false, error: ERROR_TEXT.reason_too_long };

  const supabase = await createClient();
  const findAlbum = () =>
    supabase.from("albums").select("id").eq("source", source).eq("source_id", sourceId).maybeSingle();

  let { data: album } = await findAlbum();
  if (!album) {
    const meta = await fetchAlbumMeta(source, sourceId);
    if (!meta) return { ok: false, error: ERROR_TEXT.album_not_found };
    const { error: insertError } = await createAdminClient()
      .from("albums")
      .upsert({ ...meta, genre, added_by: me.id }, { onConflict: "source,source_id", ignoreDuplicates: true });
    if (insertError) {
      // 장르 slug가 album_genres에 없으면 FK 위반.
      return { ok: false, error: insertError.code === "23503" ? ERROR_TEXT.bad_genre : ERROR_TEXT.album_not_found };
    }
    ({ data: album } = await findAlbum());
    if (!album) return { ok: false, error: ERROR_TEXT.album_not_found };
  }

  const { data: count, error } = await supabase.rpc("recommend_album", {
    p_album_id: album.id,
    p_genre: genre,
    p_reason: reason || null,
  });
  if (error) {
    const code = Object.keys(ERROR_TEXT).find((k) => error.message.includes(k));
    return { ok: false, error: code ? ERROR_TEXT[code] : "추천하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
  return { ok: true, count: count ?? 1 };
}

export async function cancelAlbumRec(albumId: string): Promise<{ ok: boolean }> {
  const me = await getMyUserRow();
  if (!me || !UUID.test(albumId)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("album_recs").delete().eq("album_id", albumId).eq("user_id", me.id);
  return { ok: !error };
}

const GENRE_ERROR_TEXT: Record<string, string> = {
  not_allowed: "승인된 회원만 장르를 추가할 수 있어요.",
  bad_name: "장르 이름은 2~30자로 써주세요.",
  bad_group: "상위 분류를 다시 골라주세요.",
  daily_limit: "장르는 하루에 3개까지 추가할 수 있어요.",
};

// 명반 차트 장르 추가(0088) — 추천 창에서 원하는 세부 장르가 없을 때. 비슷한 이름(대소문자·공백·
// 기호 무시)이 이미 있으면 DB가 새로 만들지 않고 그 장르를 돌려준다(existed).
export async function addAlbumGenre(
  grp: string,
  name: string,
): Promise<{ ok: true; genre: AlbumGenre; existed: boolean } | { ok: false; error: string }> {
  const me = await getMyUserRow();
  if (!me) return { ok: false, error: "로그인하면 장르를 추가할 수 있어요." };
  if (typeof grp !== "string" || typeof name !== "string" || !/^[a-z0-9-]{1,40}$/.test(grp)) {
    return { ok: false, error: GENRE_ERROR_TEXT.bad_group };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_album_genre", { p_grp: grp, p_name: name.slice(0, 60) });
  const row = data?.[0];
  if (error || !row) {
    const code = error ? Object.keys(GENRE_ERROR_TEXT).find((k) => error.message.includes(k)) : undefined;
    return { ok: false, error: code ? GENRE_ERROR_TEXT[code] : "장르를 추가하지 못했어요. 잠시 후 다시 시도해주세요." };
  }
  const { existed, ...genre } = row;
  return { ok: true, genre, existed };
}

// Apple 검색에 없거나 "아티스트 + 앨범명"처럼 섞어 쓴 검색어일 때의 보조 검색. MusicBrainz는
// 초당 1회 제한이라 브라우저 입력마다 부르지 않고, Apple 결과가 0건이거나 사용자가 직접 눌렀을 때만.
export async function searchMusicBrainz(q: string): Promise<AlbumCandidate[]> {
  const query = typeof q === "string" ? q.trim() : "";
  if (query.length < 2 || query.length > 100) return [];
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json&limit=15`,
      { headers: { "User-Agent": MB_UA, Accept: "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return [];
    const json: {
      "release-groups"?: {
        id: string;
        title: string;
        score?: number;
        "primary-type"?: string;
        "first-release-date"?: string;
        "artist-credit"?: { name: string; joinphrase?: string }[];
      }[];
    } = await res.json();
    return (json["release-groups"] ?? [])
      .filter((rg) => (rg["primary-type"] === "Album" || rg["primary-type"] === "EP") && (rg.score ?? 0) >= 50)
      .slice(0, 10)
      .map((rg) => ({
        source: "musicbrainz" as const,
        sourceId: rg.id,
        title: rg.title,
        artist: (rg["artist-credit"] ?? []).map((a) => a.name + (a.joinphrase ?? "")).join(""),
        artworkUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
        year: parseYear(rg["first-release-date"]),
      }));
  } catch {
    return [];
  }
}
