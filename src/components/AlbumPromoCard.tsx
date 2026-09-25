"use client";

// 명반 차트 유입 배너(2026-09-26, 사용자 요청) — DEMO에서 "작업물 없어도 괜찮으니 명반 한 장
// 추천하고 가라"고 memo 탭(명반 차트)으로 보낸다. 데스크톱은 오른쪽 사이드바(RightSidebar), 모바일은
// 사이드바가 없어서 DEMO 피드 중간(feed/page.tsx, 5번째 글 다음)에 같은 카드를 끼운다.
// 문구 한 줄은 실제 차트(album_chart)로 매번 바뀐다: 한 표만 더 있으면 차트에 오르는 후보 앨범 →
// 없으면 지금 1위 → 아직 아무것도 없으면 첫 추천 유도. 버튼은 추천 창을 바로 연다(recommend=1).
// 클릭 수는 ?src=album_promo_*로 기존 유입 통계(link_open, /admin/stats)에 잡힌다.
// 닫으면 7일 숨김(사이드바·피드 카드 공통).
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ALBUM_CHART_MIN, artworkAt, rankAlbums, type ChartAlbum } from "@/lib/albumChart";
import { beginThemeTransitionWithSound } from "@/lib/theme";
import { DiscIcon, XIcon } from "@/components/icons";

const HIDE_KEY = "comp:album-promo-hidden-until:v1";
const HIDE_DAYS = 7;

function readHidden() {
  try {
    return Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
const noopSubscribe = () => () => {};

type Pitch = { covers: (string | null)[]; line: string };

function pickPitch(albums: ChartAlbum[], userId: string): Pitch {
  const { chart, candidates } = rankAlbums(albums);
  // 내가 이미 추천한 후보는 "한 표만 더"를 내가 채울 수 없으니 뺀다.
  const candidate = candidates.find((a) => !a.recs.some((r) => r.user_id === userId));
  if (candidate) {
    const need = ALBUM_CHART_MIN - candidate.rec_count;
    return {
      covers: [candidate.artwork_url],
      line: `「${candidate.title}」, ${need === 1 ? "한 표만" : `${need}표만`} 더 있으면 차트에 올라가요`,
    };
  }
  if (chart.length > 0) {
    return {
      covers: chart.slice(0, 3).map((a) => a.artwork_url),
      line: `지금 1위는 「${chart[0].title}」 — 회원들이 고른 명반 Top 10`,
    };
  }
  return { covers: [], line: "아직 차트가 비어 있어요. 첫 명반의 주인공이 되어보세요" };
}

export function AlbumPromoCard({ userId, placement }: { userId: string; placement: "sidebar" | "feed" }) {
  const hiddenAtLoad = useSyncExternalStore(noopSubscribe, readHidden, () => true);
  const [dismissed, setDismissed] = useState(false);
  const [pitch, setPitch] = useState<Pitch | null>(null);

  useEffect(() => {
    if (hiddenAtLoad) return;
    let cancelled = false;
    createClient()
      .rpc("album_chart")
      .then(({ data }) => {
        if (!cancelled) setPitch(pickPitch(data ?? [], userId));
      });
    return () => {
      cancelled = true;
    };
  }, [hiddenAtLoad, userId]);

  if (hiddenAtLoad || dismissed || !pitch) return null;

  function dismiss() {
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      // 이번 화면에서만 닫힘.
    }
    setDismissed(true);
  }

  const href = `/feed?feed=complex&recommend=1&src=album_promo_${placement}`;

  return (
    <section
      aria-label="명반 추천하기"
      className={`relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 dark:border-violet-500/30 dark:from-violet-500/10 dark:to-transparent ${
        placement === "feed" ? "mx-3 md:mx-auto md:w-full md:max-w-[659px]" : ""
      }`}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="배너 닫기"
        className="absolute right-2 top-2 rounded-full p-1 text-gray-400 transition hover:bg-violet-100 hover:text-gray-700 dark:hover:bg-violet-500/20 dark:hover:text-gray-200"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>

      <p className="pr-5 text-[11px] font-semibold text-violet-600 dark:text-violet-300">memo · 명반 차트</p>
      <p className="mt-1 text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">작업물 없어도 괜찮아요</p>
      <p className="text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">명반 한 장만 추천하고 가세요</p>

      <div className="mt-3 flex items-center gap-2.5">
        {pitch.covers.length > 0 ? (
          <div className="flex shrink-0 -space-x-3">
            {pitch.covers.map((url, i) => {
              const src = artworkAt(url, 100);
              return src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-10 w-10 rounded-md object-cover ring-2 ring-white dark:ring-[#1c1c1e]"
                />
              ) : (
                <span
                  key={i}
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-200 text-gray-400 ring-2 ring-white dark:bg-gray-800 dark:ring-[#1c1c1e]"
                >
                  <DiscIcon className="h-5 w-5" />
                </span>
              );
            })}
          </div>
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-500 dark:bg-violet-500/20">
            <DiscIcon className="h-5 w-5" />
          </span>
        )}
        <p className="min-w-0 text-xs leading-snug text-gray-600 dark:text-gray-300">{pitch.line}</p>
      </div>

      <Link
        href={href}
        onClick={() => beginThemeTransitionWithSound(true)}
        className="mt-3 flex w-full items-center justify-center rounded-full bg-violet-600 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
      >
        명반 추천하기
      </Link>
    </section>
  );
}
