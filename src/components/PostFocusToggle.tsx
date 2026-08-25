"use client";

// memo(complex) 게시물 전용 "집중 모드" — 상단 네비게이션(h-14)만 남기고 화면 나머지를
// 이 게시물 하나로 채운다. 확대 버튼이 헤더 안(작성자 정보 옆)에 있어야 하는데, 그 버튼은
// 이 컴포넌트의 focused 상태를 토글해야 하므로 헤더 자체를 여기서 그린다 — 서버 컴포넌트가
// 계산한 값(초성/이름/메타 텍스트 등 직렬화 가능한 값)만 prop으로 받고, 본문(caption 이하)은
// children으로 그대로 넘겨받는다. 함수를 children으로 넘기면 서버→클라이언트 경계를 못
// 건너기 때문에(RSC 직렬화 제약) 렌더 prop 패턴 대신 이 구조를 쓴다.
import { useState } from "react";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { Avatar } from "@/components/Avatar";

export function PostFocusToggle({
  authorId,
  authorName,
  metaLine,
  expiresAt,
  isComplex,
  children,
}: {
  authorId: string;
  authorName: string;
  metaLine: string;
  expiresAt: string | null;
  isComplex: boolean;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={
        focused
          ? "fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto bg-white dark:bg-black"
          : "contents"
      }
    >
      <div className="flex items-center gap-2 p-3">
        <Avatar userId={authorId} name={authorName} className="h-8 w-8 text-xs" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{authorName}</span>
          <span className="truncate text-xs text-gray-400 dark:text-gray-500">{metaLine}</span>
        </div>
        {expiresAt && <TimeLimitBadge expiresAt={expiresAt} />}
        <span
          className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            isComplex
              ? "border-violet-500 bg-black text-violet-300"
              : "border-yellow-400 bg-white text-yellow-600"
          }`}
        >
          {isComplex ? "☾ memo" : "☀ DEMO"}
        </span>
        {isComplex && (
          <button
            type="button"
            onClick={() => setFocused((v) => !v)}
            title={focused ? "집중 모드 닫기" : "집중 모드로 크게 보기"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            {focused ? "✕" : "⛶"}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
