"use client";

// /goal 논의 — 검색은 "잠깐 들렀다 가는" 가벼운 동작이라(입력→결과 클릭 한 번으로 끝),
// 페이지 전체 이동보다 지금 보던 화면(DEMO 피드 등) 위에 뜨는 오버레이가 더 매끄럽다고
// 판단해서 페이지 이동 대신 이 오버레이를 기본 진입점으로 삼았다. 데스크톱은 화면 위쪽에
// 뜨는 작은 패널(인스타그램 데스크톱 웹의 플라이아웃 참고), 모바일은 화면을 다 채운다
// (모바일은 어차피 좁아서 오버레이든 페이지든 체감 차이가 없음). /search 페이지는
// 직접 링크로 들어왔을 때를 대비해 그대로 남겨둔다(같은 SearchPanel을 재사용).
import { useEffect } from "react";
import { useSearchOverlay } from "@/components/SearchOverlayContext";
import { SearchPanel } from "@/components/SearchPanel";
import { XIcon } from "@/components/icons";

export function SearchOverlay() {
  const { isOpen, close } = useSearchOverlay();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 md:flex md:items-start md:justify-center md:pt-20"
      onClick={close}
    >
      <div
        className="flex h-full w-full flex-col bg-white p-4 dark:bg-gray-950 md:h-auto md:max-h-[70vh] md:max-w-md md:rounded-2xl md:p-4 md:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">검색</h2>
          <button
            onClick={close}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <SearchPanel onNavigate={close} />
      </div>
    </div>
  );
}
