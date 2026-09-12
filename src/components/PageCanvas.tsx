"use client";

// (app) 레이아웃의 배경 캔버스 — 피드(DEMO/memo, /feed)는 원래 캔버스(모바일 흰색·데스크톱
// #fafafa, 인스타그램 참고 — 캔버스는 거의 흰색이고 카드는 테두리로만 구분)를 그대로 쓰고,
// 그 외 상단 메뉴 아이콘(Drop/Chat/Alerts/Help/Me)을 눌러 이동하는 화면은 메인 그레이 컬러
// (#8B8B8C, main-gray)를 전체 배경으로 쓴다. 카드(pageCard) 자체는 흰색 그대로 둬서 텍스트
// 대비를 지키고, 카드 바깥/주변의 캔버스만 회색으로 바뀐다.
import { usePathname } from "next/navigation";

export function PageCanvas({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  return (
    <div
      className={
        isFeed
          ? "min-h-screen bg-white transition-colors duration-300 dark:bg-[#1c1c1e] md:bg-[#fafafa] md:dark:bg-[#1c1c1e]"
          : "min-h-screen bg-main-gray transition-colors duration-300"
      }
    >
      {children}
    </div>
  );
}
