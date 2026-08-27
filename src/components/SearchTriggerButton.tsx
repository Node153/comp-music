"use client";

// 서버 컴포넌트(messages/page.tsx 등)에서 검색 오버레이를 열기만 하면 되는 자리에
// 쓰는 작은 클라이언트 버튼 — <Link href="/search">를 대체한다(SearchOverlay 주석 참고).
import { useSearchOverlay } from "@/components/SearchOverlayContext";

export function SearchTriggerButton({
  className,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  className?: string;
  title?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const { open } = useSearchOverlay();
  return (
    <button type="button" onClick={open} title={title} aria-label={ariaLabel} className={className}>
      {children}
    </button>
  );
}
