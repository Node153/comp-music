"use client";

// Demo 탭 = 라이트 테마, Complex 탭 = 다크 테마 자동 전환.
// <html>에 .dark 클래스를 붙였다 뗐다 하는 역할만 함(실제 색상은 globals.css/dark: 유틸리티가 담당).
// 색 전환 자체(뚝 끊김 방지, 4s 그라데이션)는 lib/theme.ts의 applyTheme이 담당한다.
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { applyTheme } from "@/lib/theme";

export function ThemeSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isComplex = pathname === "/feed" && searchParams.get("feed") === "complex";
  const mounted = useRef(false);

  useEffect(() => {
    // 첫 마운트(새로고침·첫 진입)에는 페이드 없이 즉시 맞춘다 — 로드하자마자 색이 번지면 어색.
    // 효과음/페이드는 /feed 안에서 실제로 탭을 전환할 때만 — 다크(memo)에서 업로드 등 다른
    // 화면(+ 버튼 등)으로 "나갈" 때는 화면이 원래 항상 라이트라 조용히 즉시 전환한다.
    applyTheme(isComplex, { animate: mounted.current && pathname === "/feed" });
    mounted.current = true;
  }, [isComplex, pathname]);

  return null;
}
