"use client";

// NotifyLandingBanner(서버)의 화면 — 닫기만 클라이언트 상태로 처리한다(주소의 from=notify는 그대로
// 둬도 새로고침 전까진 다시 안 뜸).
import { useState } from "react";
import Link from "next/link";
import { UploadIcon, XIcon } from "@/components/icons";

export function NotifyLandingBannerView({
  reactions,
  listeners,
  hasPosts,
}: {
  reactions: number;
  listeners: number;
  hasPosts: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const summary =
    reactions > 0 || listeners > 0
      ? `최근 7일 동안 반응 ${reactions}개${listeners > 0 ? ` · 청취자 ${listeners}명` : ""}을 받았어요.`
      : hasPosts
        ? "반응은 꾸준히 올리는 사람에게 쌓여요."
        : "첫 Drop을 올리면 반응 알림을 받을 수 있어요.";

  return (
    <div className="mx-3 mb-4 flex items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white md:mx-auto md:w-full md:max-w-[659px] dark:bg-gray-100 dark:text-gray-900">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">반응이 올 때가 다음 작업을 올리기 좋은 타이밍이에요</span>
        <span className="text-xs opacity-70">{summary}</span>
      </div>
      <Link
        href="/upload"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black transition hover:opacity-80 dark:bg-black dark:text-white"
      >
        <UploadIcon className="h-3.5 w-3.5" />새 Drop 올리기
      </Link>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="배너 닫기"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-60 transition hover:opacity-100"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
