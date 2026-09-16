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
// 2026-09-17 추가 수정(사용자 요청 4건):
//   1) "장르 필터 티어 삭제" — LeftSidebar에서 그대로 가져온 1~5티어 그룹(ALL_GENRES 순서 기반
//      mock 인기순, HeadphonesIcon 주석 참고) 제거. 실사용 데이터 기반으로 바뀌면서 그 순서
//      자체가 의미 없어졌다.
//   2) "실제 게시물에 해시태그 되어 있는 것만 추가 나머지 삭제" — 고정 목록 ALL_GENRES(약 90개)
//      대신, 실제 published+public 게시물의 instrument_tags를 집계해 진짜 쓰인 태그만 보여준다
//      (사용 빈도 내림차순). 아무도 안 쓴 장르를 눌러봐야 항상 "게시물이 없어요"만 나오는
//      죽은 칩이었다.
//   3) "관심장르 -> 선택 장르" — 로컬 저장 키(STORAGE_KEY)는 호환을 위해 그대로 두고 화면
//      라벨/문구만 변경.
//   4) "사이드바에서 선택된 장르 해제 하면 자동으로 피드에도 풀려야함" — 지금 보고 있는 피드의
//      활성 태그(useSearchParams의 tag)와 제거하려는 장르가 같으면, 북마크 제거와 함께
//      /feed?feed=completion(태그 없이)으로 이동해 필터도 같이 풀어준다.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SearchIcon, HeadphonesIcon, XIcon } from "@/components/icons";
import { navRowClass, navLabelClass } from "@/components/ui/styles";
import { SearchPanel } from "@/components/SearchPanel";

const STORAGE_KEY = "music-network:interested-genres";

export function SearchMenu({
  isFeed,
  expanded,
  onOpenChange,
}: {
  isFeed: boolean;
  expanded: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  const [open, setOpen] = useState(false);
  const [genreQuery, setGenreQuery] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  // null = 아직 못 받아옴(로딩 중). 실제 게시물에 쓰인 태그만 사용 빈도 내림차순으로 담는다.
  const [usedGenres, setUsedGenres] = useState<{ genre: string; count: number }[] | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedGenres(JSON.parse(saved));
    } catch {
      // localStorage 접근 불가 환경이면 그냥 빈 목록으로 둔다.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("posts")
      .select("instrument_tags")
      .eq("status", "published")
      .eq("visibility", "public")
      .then(({ data }) => {
        if (cancelled) return;
        const counts = new Map<string, number>();
        for (const row of data ?? []) {
          for (const tag of row.instrument_tags ?? []) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
        setUsedGenres([...counts.entries()].sort((a, b) => b[1] - a[1]).map(([genre, count]) => ({ genre, count })));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // "선택 장르" 칩의 X 버튼 전용 — 북마크 목록에서 뺀다. 지금 보고 있는 피드가 이 장르로
  // 걸러진 상태였다면(활성 태그와 일치) 필터도 같이 풀어서 피드로 돌아간다.
  function removeSelected(genre: string) {
    setSelectedGenres((prev) => {
      const next = prev.filter((g) => g !== genre);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 화면 상태는 그대로 유지.
      }
      return next;
    });
    if (activeTag === genre) {
      router.push("/feed?feed=completion");
    }
  }

  // 장르 칩 클릭(필터 적용) 시 같이 호출 — 다음에 빠르게 다시 찾아볼 수 있게 "선택 장르"에도
  // 자동으로 남긴다. 실제 필터링 자체는 Link의 href(/feed?tag=...)가 담당하고, 이 함수는 북마크
  // 저장 + 패널 닫기만 한다.
  function bookmarkGenre(genre: string) {
    setSelectedGenres((prev) => {
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

  const filteredGenres = useMemo(() => {
    if (!usedGenres) return usedGenres;
    const q = genreQuery.trim().toLowerCase();
    if (!q) return usedGenres;
    return usedGenres.filter(({ genre }) => genre.toLowerCase().includes(q));
  }, [usedGenres, genreQuery]);

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
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">선택 장르</span>
                  {selectedGenres.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedGenres.map((genre) => (
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
                            onClick={() => removeSelected(genre)}
                            title="선택 장르에서 제거"
                            aria-label={`선택 장르에서 ${genre} 제거`}
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

                <div className="flex flex-wrap gap-1.5">
                  {filteredGenres === null && (
                    <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">불러오는 중…</p>
                  )}
                  {filteredGenres?.length === 0 &&
                    (genreQuery.trim() ? (
                      <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">검색 결과가 없어요</p>
                    ) : (
                      <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">
                        아직 태그가 달린 게시물이 없어요
                      </p>
                    ))}
                  {filteredGenres?.map(({ genre }) => {
                    const selected = selectedGenres.includes(genre);
                    return (
                      <Link
                        key={genre}
                        href={`/feed?feed=completion&tag=${encodeURIComponent(genre)}`}
                        onClick={() => bookmarkGenre(genre)}
                        title={`#${genre} 게시물만 보기`}
                        className={`rounded-full border px-2.5 py-1 text-xs transition hover:opacity-75 ${
                          selected
                            ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                            : "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                        }`}
                      >
                        #{genre}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
