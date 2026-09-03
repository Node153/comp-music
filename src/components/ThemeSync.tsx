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
    applyTheme(isComplex, { animate: mounted.current });
    mounted.current = true;
  }, [isComplex]);

  return null;
}
