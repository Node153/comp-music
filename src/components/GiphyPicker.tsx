"use client";

// DEMO 커버 이미지로 직접 사진 대신 GIF를 고를 수 있게(사진이 없는 유저를 위한 대안).
// GIPHY 공식 검색 API를 브라우저에서 직접 호출 — 그들의 공식 SDK도 같은 방식이라 API key가
// 클라이언트에 노출되는 게 전제(NEXT_PUBLIC_ 접두사). 크롤링이 아니라 정식 API라 저작권/약관
// 문제 없음 — 다만 이용약관상 "Powered By GIPHY" 표시가 필수라 항상 하단에 노출한다.
// 고른 GIF는 우리 R2에 다시 올리지 않고 GIPHY 자체 CDN URL을 그대로 저장한다(posts.thumbnail_url,
// resolveMediaUrl이 R2 key와 외부 URL을 구분해서 읽음).
import { useEffect, useState } from "react";
import { XIcon } from "@/components/icons";

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY;

type GiphyResult = {
  id: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
};

type GiphyApiImage = { url: string; width: string; height: string };
type GiphyApiGif = {
  id: string;
  title: string;
  images: { fixed_width: GiphyApiImage; fixed_width_small: GiphyApiImage };
};

async function searchGiphy(query: string): Promise<GiphyResult[]> {
  if (!GIPHY_API_KEY) return [];
  const endpoint = query.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query.trim())}&limit=24&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=pg-13`;
  const res = await fetch(endpoint);
  if (!res.ok) return [];
  const { data } = (await res.json()) as { data: GiphyApiGif[] };
  return data.map((g) => ({
    id: g.id,
    title: g.title,
    previewUrl: g.images.fixed_width_small.url,
    fullUrl: g.images.fixed_width.url,
    width: Number(g.images.fixed_width.width),
    height: Number(g.images.fixed_width.height),
  }));
}

export function GiphyPicker({
  onSelect,
  onClose,
}: {
  onSelect: (gif: { url: string; width: number; height: number }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GiphyResult[]>([]);
  const [loading, setLoading] = useState(true);

  // 검색어 바뀔 때마다 600ms 기다렸다가 요청(디바운스) — Beta API 키가 시간당 100회로
  // 제한이라 호출을 최대한 아낀다. 빈 검색어는 트렌딩, 한 글자만 입력했을 때는 검색어로서
  // 의미가 적어 호출 자체를 건너뛴다(직전 결과를 그대로 유지).
  useEffect(() => {
    if (query.trim().length === 1) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchGiphy(query).then((gifs) => {
        if (!cancelled) {
          setResults(gifs);
          setLoading(false);
        }
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 rounded-2xl bg-white p-4 dark:bg-gray-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="GIF 검색..."
            autoFocus
            className="flex-1 rounded-full border border-gray-300 px-3.5 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="-mt-1 text-xs text-gray-400 dark:text-gray-500">
          정사각형이나 세로형 GIF를 고르면 커버가 더 예쁘게 보여요.
        </p>

        <div className="grid flex-1 grid-cols-3 gap-1.5 overflow-y-auto">
          {loading ? (
            <p className="col-span-3 py-10 text-center text-sm text-gray-400">불러오는 중...</p>
          ) : !GIPHY_API_KEY ? (
            <p className="col-span-3 py-10 text-center text-sm text-gray-400">
              GIPHY API 키가 설정되지 않았어요.
            </p>
          ) : results.length === 0 ? (
            <p className="col-span-3 py-10 text-center text-sm text-gray-400">결과가 없어요.</p>
          ) : (
            results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                title={gif.title}
                onClick={() => onSelect({ url: gif.fullUrl, width: gif.width, height: gif.height })}
                className="aspect-square overflow-hidden rounded-lg bg-gray-100 transition hover:ring-2 hover:ring-black dark:bg-gray-900 dark:hover:ring-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gif.previewUrl} alt={gif.title} className="h-full w-full object-cover" />
              </button>
            ))
          )}
        </div>

        {/* GIPHY API 이용약관 필수 조건 — 항상 표시. */}
        <a
          href="https://giphy.com"
          target="_blank"
          rel="noreferrer"
          className="self-center text-xs font-semibold text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          Powered By GIPHY
        </a>
      </div>
    </div>
  );
}
