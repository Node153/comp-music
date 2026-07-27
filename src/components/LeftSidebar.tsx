"use client";

// 데스크톱 좌측 사이드바(페이스북 참고). 관심 장르 / 모든 장르 두 섹션만 노출.
// 기본은 접힌 상태(아이콘만)로 두고, 아이콘을 누르면 펼쳐짐.
// 그리드 트랙 자체는 우측 사이드바와 항상 동일한 고정 폭(220px)이라 접힘/펼침 상태와 무관하게
// 좌우 여백이 대칭으로 유지된다(접힘 때 폭이 줄어들면 피드가 한쪽으로 쏠려 보이는 문제가 있었음).
// 실제 필터링 기능은 Phase 1 예정이라 지금은 태그 나열만 하는 자리표시 UI.
import { useState } from "react";
import { ALL_GENRES } from "@/lib/genres";

const INTERESTED_GENRES = ["재즈", "클래식", "밴드"];

export function LeftSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <aside className="sticky top-[4.5rem] hidden h-fit w-full flex-col gap-1 overflow-hidden md:flex">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "장르 사이드바 접기" : "장르 사이드바 펼치기"}
        title={open ? "접기" : "장르 필터 보기"}
        className={`flex h-9 shrink-0 items-center gap-2 rounded-lg text-sm font-semibold text-gray-500 transition hover:bg-gray-200/60 dark:text-gray-400 dark:hover:bg-gray-900 ${
          open ? "px-2.5" : "w-9 justify-center"
        }`}
      >
        <span className="text-lg">❤️</span>
        {open && "장르 필터"}
      </button>

      {open && (
        <>
          <div className="flex flex-col gap-1 px-2">
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">관심 장르</span>
            <div className="flex flex-wrap gap-1.5" title="관심 장르 기능은 준비 중이에요">
              {INTERESTED_GENRES.map((genre) => (
                <span
                  key={genre}
                  className="cursor-default rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  #{genre}
                </span>
              ))}
            </div>
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
                  placeholder="검색"
                  disabled
                  title="장르 검색 기능은 준비 중이에요"
                  className="w-20 rounded-full bg-gray-100 py-1 pl-6 pr-2 text-xs text-gray-600 placeholder:text-gray-400 disabled:cursor-not-allowed dark:bg-gray-900 dark:text-gray-300"
                />
              </div>
            </div>
            <div
              className="flex max-h-72 flex-col gap-0.5 overflow-y-auto"
              title="장르 필터 기능은 준비 중이에요"
            >
              {ALL_GENRES.map((genre, i) => (
                <span
                  key={genre}
                  className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400"
                >
                  <span className="w-4 shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-500">
                    {i + 1}
                  </span>
                  #{genre}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
