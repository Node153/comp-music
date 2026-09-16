"use client";

// (app) 레이아웃의 배경 캔버스 — 피드(DEMO/memo, /feed)는 원래 캔버스(모바일 흰색·데스크톱
// #fafafa, 인스타그램 참고 — 캔버스는 거의 흰색이고 카드는 테두리로만 구분)를 그대로 쓰고,
// 그 외 상단 메뉴 아이콘(Drop/Chat/Alerts/Help/Me)을 눌러 이동하는 화면은 그레이 컬러 시스템의
// 가장 짙은 배경 톤(canvas-gray, #c6c6c7)을 전체 배경으로 쓴다. 원래 active-gray(#545455,
// 짙은 톤)를 그대로 썼는데 "너무 어둡다"는 피드백을 받아, DEMO 탭 배경(#fafafa) 기준 살짝
// 어두운 톤인 canvas-gray로 분리했다(2026-09-16) — active-gray는 텍스트/보더 전용으로 계속 쓰임
// (globals.css 참고).
import { usePathname } from "next/navigation";

export function PageCanvas({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFeed = pathname === "/feed" || pathname?.startsWith("/feed/");

  return (
    <div
      className={
        isFeed
          ? "min-h-screen bg-white transition-colors duration-300 dark:bg-[#1c1c1e] md:bg-[#fafafa] md:dark:bg-[#1c1c1e]"
          : "min-h-screen bg-canvas-gray transition-colors duration-300"
      }
    >
      {children}
    </div>
  );
}
