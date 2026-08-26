"use client";

// 데스크톱 좌측 사이드바(페이스북 참고). 관심 장르 / 모든 장르 두 섹션만 노출.
// 기본은 접힌 상태(아이콘만)로 두고, 아이콘을 누르면 펼쳐짐.
// 그리드 트랙 자체는 우측 사이드바와 항상 동일한 고정 폭(220px)이라 접힘/펼침 상태와 무관하게
// 좌우 여백이 대칭으로 유지된다(접힘 때 폭이 줄어들면 피드가 한쪽으로 쏠려 보이는 문제가 있었음).
//
// 관심 장르: "모든 장르"에서 클릭해 고른 장르가 여기 모인다. 지금은 계정이 아니라
// 브라우저(localStorage)에 저장 — 기기/브라우저를 바꾸면 유지되지 않는다. 나중에 계정별로
// 서버에 저장하려면 Supabase 테이블을 추가해 이 훅을 그쪽으로 바꿔치기하면 됨.
// 모든 장르: op.gg 챔피언 티어 리스트 참고 — 인기 순위(목업 기준, genres.ts 정렬 순서)를
// 1~5티어로 묶어서 색으로 구분. 실제 인기도 집계 로직은 Phase 1 예정.
import { useEffect, useMemo, useState } from "react";
import { ALL_GENRES } from "@/lib/genres";
import { HeadphonesIcon, XIcon } from "@/components/icons";

const STORAGE_KEY = "music-network:interested-genres";

const TIERS = [
  {
    label: "1티어",
    dot: "bg-amber-500",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400",
  },
  {
    label: "2티어",
    dot: "bg-violet-500",
    chip: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-400",
  },
  {
    label: "3티어",
    dot: "bg-sky-500",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-400",
  },
  {
    label: "4티어",
    dot: "bg-emerald-500",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  {
    label: "5티어",
    dot: "bg-slate-400",
    chip: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400",
  },
] as const;

// 순위(1-base)를 티어 인덱스로. 위 티어일수록 인원을 적게(op.gg S티어처럼 상위를 좁게) 배정.
function tierIndexForRank(rank: number) {
  if (rank <= 10) return 0;
  if (rank <= 30) return 1;
  if (rank <= 60) return 2;
  if (rank <= 100) return 3;
  return 4;
}

export function LeftSidebar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [interested, setInterested] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInterested(JSON.parse(saved));
    } catch {
      // localStorage 접근 불가 환경이면 그냥 빈 목록으로 둔다.
    }
  }, []);

  function toggleGenre(genre: string) {
    setInterested((prev) => {
      const next = prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 화면 상태는 그대로 유지.
      }
      return next;
    });
  }

  const tiers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const buckets: { genre: string; rank: number }[][] = [[], [], [], [], []];
    ALL_GENRES.forEach((genre, i) => {
      const rank = i + 1;
      if (q && !genre.toLowerCase().includes(q)) return;
      buckets[tierIndexForRank(rank)].push({ genre, rank });
    });
    return TIERS.map((tier, i) => ({ ...tier, items: buckets[i] })).filter((tier) => tier.items.length > 0);
  }, [query]);

  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-1 overflow-hidden md:flex">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "장르 사이드바 접기" : "장르 사이드바 펼치기"}
        title={open ? "접기" : "장르 필터 보기"}
        className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-500 shadow-sm transition hover:bg-gray-200/60 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 ${
          open ? "px-2.5" : "w-9 justify-center"
        }`}
      >
        <HeadphonesIcon className="h-4 w-4" />
        {open && "장르 필터"}
      </button>

      {open && (
        <>
          <div className="flex flex-col gap-1 px-2">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">관심 장르</span>
            {interested.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {interested.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    title="클릭하면 관심 장르에서 제거돼요"
                    className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
                  >
                    #{genre} <XIcon className="h-3 w-3" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                아래 목록에서 장르를 누르면 여기에 모여요
              </p>
            )}
          </div>

          <div className="my-2 border-t border-gray-200 dark:border-gray-800" />

          <div className="flex flex-col gap-2 px-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">모든 장르</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="검색"
                  className="w-20 rounded-full bg-gray-100 py-1 pl-6 pr-2 text-xs text-gray-600 placeholder:text-gray-400 dark:bg-gray-900 dark:text-gray-300"
                />
              </div>
            </div>

            <div className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-0.5">
              {tiers.length === 0 && (
                <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">검색 결과가 없어요</p>
              )}
              {tiers.map((tier) => (
                <div key={tier.label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 px-0.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                    <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">{tier.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tier.items.map(({ genre, rank }) => {
                      const selected = interested.includes(genre);
                      return (
                        <button
                          key={genre}
                          onClick={() => toggleGenre(genre)}
                          title={selected ? "관심 장르에서 제거" : "관심 장르에 추가"}
                          className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition hover:opacity-75 ${
                            selected
                              ? "border-red-300 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
                              : tier.chip
                          }`}
                        >
                          <span className="text-[10px] font-semibold opacity-60">{rank}</span>#{genre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
