"use client";

// Demo 탭 = 라이트 테마, Complex 탭 = 다크 테마 자동 전환.
// <html>에 .dark 클래스를 붙였다 뗐다 하는 역할만 함(실제 색상은 globals.css/dark: 유틸리티가 담당).
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function ThemeSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isComplex = pathname === "/feed" && searchParams.get("feed") === "complex";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isComplex);
  }, [isComplex]);

  return null;
}
