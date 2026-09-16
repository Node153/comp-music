"use client";

// NavSidebar 검색 패널 — 메시지/알림 패널과 동일한 도킹 패턴으로 통일했다(2026-09-16, 사용자
// 요청 "검색창도 메시지탭과 동일하게 구성"). 모달로 화면 중앙에 뜨던 SearchOverlay 대신,
// 사이드바 오른쪽에 그림자 없이 이어붙는 패널로 바뀐다(MessagesMenu/NotificationsMenu와 같은
// left-[72px]/bottom-16 규칙 — 그쪽 주석 참고).
// 이어서 "장르 필터랑 합쳐서 구성" 요청에 따라, /feed 화면 왼쪽에 항상 떠 있던 LeftSidebar(장르
// 필터)를 이 패널 안으로 옮겨 하나로 합쳤다 — 사용자가 탭 전환 대신 "한 화면에 세로로 같이"를
// 선택해서, 사용자 검색(SearchPanel 재사용)이 위, 장르 필터가 아래로 이어지는 단일 스크롤
// 패널로 구성한다. LeftSidebar.tsx는 이 컴포넌트로 흡수되며 삭제됨(장르 필터가 이제 여기서만
// 보이므로 /feed 좌측 220px 컬럼도 같이 제거).
// 2026-09-17 수정(사용자 제보 — "장르 필터 지금 기능을 하고 있지 않음, 선택시 해당 게시물만
// 보여야 함"): 옮겨올 때 LeftSidebar의 toggleGenre(로컬 북마크 토글)만 그대로 가져와서 클릭해도
// 실제로 피드가 걸러지지 않았다. feed/page.tsx가 이미 `?tag=` 쿼리로 게시물을 거르는 로직을
// 갖고 있고(게시물 해시태그 클릭이 `/feed?feed=completion&tag=...`로 링크되는 것과 동일한
// 방식, feed/page.tsx의 tagParam 필터 참고) 장르 이름이 곧 그 해시태그(instrument_tags) 값이라
// 그대로 재사용 가능하다 — 장르 칩을 그 URL로 가는 Link로 바꿔 진짜 필터 역할을 하게 했다.
// "관심 장르"는 북마크 목록으로 남기되(클릭 시 자동으로 여기 추가돼 다음에 빠르게 다시 찾아볼
// 수 있음), 제거는 별도 X 버튼으로만(칩 전체를 누르면 필터가 걸려야 하니 제거와 분리해야 함 —
// 버튼 안에 버튼을 중첩할 수 없어 X를 형제 버튼으로 뺐다).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ALL_GENRES } from "@/lib/genres";
import { SearchIcon, HeadphonesIcon, XIcon } from "@/components/icons";
import { navRowClass, navLabelClass } from "@/components/ui/styles";
import { SearchPanel } from "@/components/SearchPanel";

const STORAGE_KEY = "music-network:interested-genres";

// 2026-09-17 수정(사용자 요청 "장르 필터 다 흑백으로 처리해줘") — 원래 LeftSidebar.tsx의 memo
// 시그니처 컬러(violet) 그라데이션을 그대로 옮겨왔었는데, 사이트 전체 디자인 시스템(ui/styles.ts
// 상단 주석 — "중성적인 톤(흑백 위주), 링크만 blue-600, 파괴적 액션만 red-600")과 안 맞아서
// violet/red를 전부 걷어내고 gray 그라데이션 + 선택 시 검정 반전으로 바꿨다.
const TIERS = [
  {
    label: "1티어",
    dot: "bg-gray-800",
    chip: "border-gray-400 bg-gray-200 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100",
  },
  {
    label: "2티어",
    dot: "bg-gray-600",
    chip: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300",
  },
  {
    label: "3티어",
    dot: "bg-gray-500",
    chip: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400",
  },
  {
    label: "4티어",
    dot: "bg-gray-400",
    chip: "border-gray-100 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500",
  },
  {
    label: "5티어",
    dot: "bg-gray-300",
    chip: "border-gray-100 bg-gray-50 text-gray-400 dark:border-gray-900 dark:bg-gray-950/60 dark:text-gray-500",
  },
] as const;

function tierIndexForRank(rank: number) {
  if (rank <= 10) return 0;
  if (rank <= 30) return 1;
  if (rank <= 60) return 2;
  if (rank <= 100) return 3;
  return 4;
}

export function SearchMenu({
  isFeed,
  expanded,
  onOpenChange,
}: {
  isFeed: boolean;
  expanded: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [genreQuery, setGenreQuery] = useState("");
  const [interested, setInterested] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setInterested(JSON.parse(saved));
    } catch {
      // localStorage 접근 불가 환경이면 그냥 빈 목록으로 둔다.
    }
  }, []);

  // "관심 장르" 칩의 X 버튼 전용 — 북마크 목록에서만 뺀다(피드 필터와는 무관).
  function removeInterested(genre: string) {
    setInterested((prev) => {
      const next = prev.filter((g) => g !== genre);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 화면 상태는 그대로 유지.
      }
      return next;
    });
  }

  // 장르 칩 클릭(필터 적용) 시 같이 호출 — 다음에 빠르게 다시 찾아볼 수 있게 "관심 장르"에도
  // 자동으로 남긴다. 실제 필터링 자체는 Link의 href(/feed?tag=...)가 담당하고, 이 함수는 북마크
  // 저장 + 패널 닫기만 한다.
  function bookmarkGenre(genre: string) {
    setInterested((prev) => {
      if (prev.includes(genre)) return prev;
      const next = [...prev, genre];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 화면 상태는 그대로 유지.
      }
      return next;
    });
    close();
  }

  const tiers = useMemo(() => {
    const q = genreQuery.trim().toLowerCase();
    const buckets: { genre: string; rank: number }[][] = [[], [], [], [], []];
    ALL_GENRES.forEach((genre, i) => {
      const rank = i + 1;
      if (q && !genre.toLowerCase().includes(q)) return;
      buckets[tierIndexForRank(rank)].push({ genre, rank });
    });
    return TIERS.map((tier, i) => ({ ...tier, items: buckets[i] })).filter((tier) => tier.items.length > 0);
  }, [genreQuery]);

  function close() {
    setOpen(false);
    onOpenChange?.(false);
  }

  function toggleOpen() {
    // onOpenChange(부모 NavSidebar의 setState)를 setOpen 업데이터 함수 안에서 부르면 "다른
    // 컴포넌트를 렌더링 중 업데이트" 경고가 뜬다 — 이벤트 핸들러 최상위에서 순서대로 호출
    // (MessagesMenu/NotificationsMenu와 동일한 이유).
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <div className="relative">
      <button onClick={toggleOpen} title="검색" aria-label="검색" className={navRowClass(open, isFeed, expanded)}>
        <SearchIcon className="h-6 w-6 shrink-0" />
        <span className={navLabelClass(expanded)}>검색</span>
      </button>

      {open && (
        <>
          <button aria-label="검색 닫기" onClick={close} className="fixed inset-0 z-40 cursor-default" />
          {/* MessagesMenu/NotificationsMenu와 완전히 동일한 위치/크기 규칙(md:left-[72px]/
              md:bottom-16/그림자 없음) — 사이드바 자체가 검색+장르 필터 화면으로 바뀐 것처럼
              이어붙는다. */}
          <div className="fixed inset-0 z-50 flex w-full flex-col bg-white md:inset-y-auto md:top-0 md:bottom-16 md:left-[72px] md:right-auto md:w-[420px] md:max-w-[calc(100vw-72px)] md:border-r md:border-gray-200 dark:bg-gray-950 md:dark:border-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">검색</span>
              <button
                onClick={close}
                aria-label="검색 패널 닫기"
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              <SearchPanel onNavigate={close} />

              <div className="my-4 border-t border-gray-100 dark:border-gray-800" />

              <div className="flex flex-col gap-2 pb-2">
                <div className="flex items-center gap-1.5">
                  <HeadphonesIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">장르 필터</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">관심 장르</span>
                  {interested.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {interested.map((genre) => (
                        <div
                          key={genre}
                          className="inline-flex items-center overflow-hidden rounded-full bg-black text-xs font-medium text-white dark:bg-white dark:text-black"
                        >
                          <Link
                            href={`/feed?feed=completion&tag=${encodeURIComponent(genre)}`}
                            onClick={close}
                            title={`#${genre} 게시물만 보기`}
                            className="py-1 pl-3 pr-1 hover:underline"
                          >
                            #{genre}
                          </Link>
                          <button
                            onClick={() => removeInterested(genre)}
                            title="관심 장르에서 제거"
                            aria-label={`관심 장르에서 ${genre} 제거`}
                            className="rounded-full p-1 pr-2 transition hover:bg-gray-700 dark:hover:bg-gray-200"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      아래 목록에서 장르를 누르면 여기에 모여요
                    </p>
                  )}
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">모든 장르</span>
                  <div className="relative">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={genreQuery}
                      onChange={(e) => setGenreQuery(e.target.value)}
                      placeholder="장르 검색"
                      className="w-32 rounded-full bg-gray-100 py-1 pl-7 pr-2.5 text-xs text-gray-600 placeholder:text-gray-400 focus:outline-none dark:bg-gray-900 dark:text-gray-300"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {tiers.length === 0 && (
                    <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">검색 결과가 없어요</p>
                  )}
                  {tiers.map((tier) => (
                    <div key={tier.label} className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 px-0.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
                        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                          {tier.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tier.items.map(({ genre, rank }) => {
                          const selected = interested.includes(genre);
                          return (
                            <Link
                              key={genre}
                              href={`/feed?feed=completion&tag=${encodeURIComponent(genre)}`}
                              onClick={() => bookmarkGenre(genre)}
                              title={`#${genre} 게시물만 보기`}
                              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition hover:opacity-75 ${
                                selected
                                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                                  : tier.chip
                              }`}
                            >
                              <span className="text-[10px] font-semibold opacity-60">{rank}</span>#{genre}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
