"use client";

// 게시물 본문 — 1줄 넘으면 "더보기"로 펼치고(사용자 요청), 영어처럼
// 공백 없는 긴 글자열도 break-words로 줄바꿈되게 한다.
import { useRef, useState, useLayoutEffect } from "react";

export function PostCaption({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className={`whitespace-pre-wrap break-words ${expanded ? "" : "line-clamp-1"}`}
      >
        {text}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {expanded ? "접기" : "더보기"}
        </button>
      )}
    </div>
  );
}
