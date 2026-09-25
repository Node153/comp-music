// 명반 차트(0087, Lab 실험 기능) 공용 — 규칙 숫자, 순위 계산, 커버 크기 변환, 듣기 링크,
// 앨범 검색(Apple iTunes 검색 API를 브라우저에서 직접 호출).
// 규칙 숫자는 recommend_album(0087)과 반드시 같이 바꿀 것.
import type { Database } from "@/types/database";

export const ALBUM_GENRE_LIMIT = 5; // 한 사람당 세부 장르마다 추천 가능한 앨범 수
export const ALBUM_CHART_MIN = 2; // 이 인원 이상 추천하면 차트 진입(미만은 "후보")
export const ALBUM_CERTIFY_AT = 10; // 명반 인증 — 한 번 붙으면 영구
export const ALBUM_CHART_SIZE = 10;
export const ALBUM_REASON_MAX = 100;

export type AlbumGenre = Pick<
  Database["public"]["Tables"]["album_genres"]["Row"],
  "slug" | "name" | "grp" | "grp_name" | "sort_order"
>;
export type ChartAlbum = Database["public"]["Functions"]["album_chart"]["Returns"][number];

// 검색 결과 한 줄 — 아직 우리 DB에 없을 수도 있는 앨범.
export type AlbumCandidate = {
  source: "itunes" | "musicbrainz";
  sourceId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  year: number | null;
};

// 추천 수 내림차순, 동점이면 그 수에 먼저 도달한 앨범이 위(일찍 알아본 사람이 유리하게).
export function rankAlbums(albums: ChartAlbum[]) {
  const sorted = [...albums].sort(
    (a, b) => b.rec_count - a.rec_count || Date.parse(a.reached_at) - Date.parse(b.reached_at),
  );
  const ranked = sorted.filter((a) => a.rec_count >= ALBUM_CHART_MIN);
  return {
    chart: ranked.slice(0, ALBUM_CHART_SIZE),
    rest: ranked.slice(ALBUM_CHART_SIZE),
    // 후보는 방금 올라온 게 위로 — 누가 새로 뭘 추천했는지 먼저 보이게.
    candidates: sorted
      .filter((a) => a.rec_count < ALBUM_CHART_MIN)
      .sort((a, b) => Date.parse(b.reached_at) - Date.parse(a.reached_at)),
  };
}

// 저장해 둔 커버 주소를 화면 크기에 맞게 바꾼다. Apple은 주소 끝의 "100x100bb"만 바꾸면 되고,
// Cover Art Archive는 250/500/1200 세 크기만 있다.
export function artworkAt(url: string | null, size: number) {
  if (!url) return null;
  if (url.includes("mzstatic.com")) return url.replace(/\/\d+x\d+bb\.(jpg|png|webp)$/, `/${size}x${size}bb.jpg`);
  if (url.includes("coverartarchive.org")) return url.replace(/-(250|500|1200)$/, size > 250 ? "-500" : "-250");
  return url;
}

// 멜론은 공개 API가 없어서 검색 결과 페이지로만 보낸다. Apple Music은 Apple 쪽 이용 조건상
// 가능하면 앨범 페이지로 바로(source_url).
export function listenLinks(album: Pick<ChartAlbum, "title" | "artist" | "source" | "source_url">) {
  const q = encodeURIComponent(`${album.artist} ${album.title}`);
  return [
    {
      label: "Apple Music",
      href: album.source === "itunes" && album.source_url ? album.source_url : `https://music.apple.com/us/search?term=${q}`,
    },
    { label: "멜론", href: `https://www.melon.com/search/total/index.htm?q=${q}` },
    { label: "YouTube Music", href: `https://music.youtube.com/search?q=${q}` },
    { label: "Spotify", href: `https://open.spotify.com/search/${q}` },
  ];
}

// ── Apple(iTunes) 검색 ──────────────────────────────────────────────────────────────
// 키가 필요 없고 CORS가 열려 있어서(access-control-allow-origin: *) 브라우저에서 바로 부른다 —
// 호출 제한(IP당 분당 약 20회)이 서버 IP 하나에 몰리지 않고 사용자별로 나뉜다.
// 한국 스토어(country=KR)는 검색 API가 늘 0건을 돌려줘서 미국 스토어를 쓴다(한국 앨범도 다 있고,
// 아티스트 이름만 "The Black Skirts"처럼 영문으로 나온다).
// 키워드 검색은 "아티스트 + 앨범명"을 잘 못 찾고(예: "Daniel Caesar Freudian" 0건) 싱글·노래방
// 버전이 위를 차지해서, 화면은 아티스트를 먼저 고르면 그 아티스트의 앨범 목록(lookup)을 보여준다.
const ITUNES = "https://itunes.apple.com";
const JUNK = /karaoke|originally performed|in the style of|tribute to|made famous by|lullaby renditions|piano dreamers|smooth jazz renditions/i;

type ItunesResult = {
  wrapperType?: string;
  artistId?: number;
  artistName?: string;
  primaryGenreName?: string;
  collectionId?: number;
  collectionName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
};

function toCandidate(r: ItunesResult): AlbumCandidate | null {
  if (r.wrapperType !== "collection" || !r.collectionId || !r.collectionName || !r.artistName) return null;
  if (/ - Single$/.test(r.collectionName) || JUNK.test(r.collectionName) || JUNK.test(r.artistName)) return null;
  const year = r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : NaN;
  return {
    source: "itunes",
    sourceId: String(r.collectionId),
    title: r.collectionName,
    artist: r.artistName,
    artworkUrl: r.artworkUrl100 ?? null,
    year: Number.isFinite(year) ? year : null,
  };
}

// 같은 앨범이 리마스터·보너스판 없이 똑같은 제목으로 두 번 나오는 경우가 있어 제목으로 한 번 거른다.
function dedupe(list: AlbumCandidate[]) {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${c.artist.toLowerCase()}|${c.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type ItunesArtist = { id: number; name: string; genre: string | null };

export async function searchItunes(q: string, signal?: AbortSignal) {
  const term = encodeURIComponent(q);
  const [artistRes, albumRes] = await Promise.all([
    fetch(`${ITUNES}/search?term=${term}&media=music&entity=musicArtist&country=US&limit=4`, { signal }),
    fetch(`${ITUNES}/search?term=${term}&media=music&entity=album&country=US&limit=25`, { signal }),
  ]);
  const artistJson: { results?: ItunesResult[] } = artistRes.ok ? await artistRes.json() : {};
  const albumJson: { results?: ItunesResult[] } = albumRes.ok ? await albumRes.json() : {};
  const artists: ItunesArtist[] = (artistJson.results ?? [])
    .filter((r) => r.wrapperType === "artist" && r.artistId && r.artistName && !JUNK.test(r.artistName))
    .map((r) => ({ id: r.artistId!, name: r.artistName!, genre: r.primaryGenreName ?? null }));
  const albums = dedupe(
    (albumJson.results ?? []).map(toCandidate).filter((c): c is AlbumCandidate => c !== null),
  ).slice(0, 12);
  return { artists, albums };
}

export async function itunesArtistAlbums(artistId: number, signal?: AbortSignal) {
  const res = await fetch(`${ITUNES}/lookup?id=${artistId}&entity=album&limit=200&country=US`, { signal });
  if (!res.ok) return [];
  const json: { results?: ItunesResult[] } = await res.json();
  const list = (json.results ?? [])
    // 피처링으로만 참여한 남의 앨범은 뺀다.
    .filter((r) => r.artistId === artistId)
    .map(toCandidate)
    .filter((c): c is AlbumCandidate => c !== null)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  return dedupe(list);
}
