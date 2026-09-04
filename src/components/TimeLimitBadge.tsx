"use client";

// FEED-05/06 노출시간을 타임세일 배너처럼 보여주는 카운트다운 뱃지. 게시물 좌상단에 오버레이.
// 서버 렌더 시점과 클라이언트 hydration 시점의 Date.now()가 달라 값이 어긋날 수 있으므로,
// 초기값은 항상 placeholder로 고정하고 마운트 이후에만 실제 카운트다운을 시작한다.
import { useEffect, useState } from "react";
import { ClockIcon } from "@/components/icons";

const DAY_SECONDS = 24 * 60 * 60;

// 협업 게시물이 1~7일 단위로 노출되면서(0052) 남은 시간을 계속 "167:59:51"처럼 시간으로만
// 보여주면 숫자가 너무 커져서 안 읽힌다(사용자 피드백) — 24시간 이상 남았을 땐 "D-7"처럼
// 날짜로, 24시간 미만으로 들어오면 그때부터 기존 HH:MM:SS 초단위 카운트다운으로 바뀐다.
function formatRemaining(ms: number): string {
  if (ms <= 0) return "마감";
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds >= DAY_SECONDS) {
    return `D-${Math.ceil(totalSeconds / DAY_SECONDS)}`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function TimeLimitBadge({ expiresAt }: { expiresAt: string }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    function tick() {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const isUrgent = remainingMs !== null && remainingMs > 0 && remainingMs < 60 * 60 * 1000;
  const isExpired = remainingMs !== null && remainingMs <= 0;

  return (
    <span
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-lg ${
        isExpired ? "bg-gray-500" : isUrgent ? "animate-pulse bg-red-600" : "bg-violet-500"
      }`}
      title="노출 시간이 지나면 메인 피드에서 사라져요 (프로필에는 계속 남아요)"
    >
      <ClockIcon className="h-3 w-3" /> {remainingMs === null ? "···" : formatRemaining(remainingMs)}
    </span>
  );
}
