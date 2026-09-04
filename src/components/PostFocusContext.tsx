"use client";

// PostFocusToggle의 "집중 모드" on/off를 자식(ComplexPostChat)에게 전달하는 용도.
// children은 서버 컴포넌트(feed/page.tsx)가 만든 JSX라 렌더 prop을 못 쓰고(RSC 직렬화
// 제약, PostFocusToggle.tsx 주석 참고) 이미 고정된 엘리먼트 트리다 — 그 안에서 focused
// 값을 읽게 하려면 트리를 새로 짜지 않고도 구독 가능한 Context가 유일한 방법이다.
// 기본값 false(집중 모드 아님) — Provider 밖에서 쓰이면(있을 수 없지만) 안전하게 폴백.
import { createContext, useContext } from "react";

const PostFocusContext = createContext(false);

export function PostFocusProvider({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return <PostFocusContext.Provider value={focused}>{children}</PostFocusContext.Provider>;
}

export function usePostFocused(): boolean {
  return useContext(PostFocusContext);
}
