"use client";

// 검색 오버레이 열림 상태 — TopNav/BottomNav/메시지 작성 버튼 등 여러 곳에서
// 이 훅으로 트리거만 하고, 실제 렌더는 SearchOverlay 컴포넌트 하나가 (app)/layout.tsx
// 최상단에서 담당한다(GuestSignupPrompt와 같은 패턴).
import { createContext, useContext, useState } from "react";

const SearchOverlayContext = createContext<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
} | null>(null);

export function SearchOverlayProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <SearchOverlayContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </SearchOverlayContext.Provider>
  );
}

export function useSearchOverlay() {
  const ctx = useContext(SearchOverlayContext);
  if (!ctx) throw new Error("useSearchOverlay는 SearchOverlayProvider 안에서만 쓸 수 있어요.");
  return ctx;
}
