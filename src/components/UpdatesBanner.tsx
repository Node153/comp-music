"use client";

// 홈(피드) 상단 한 줄 배너(0068) — 아직 안 본 업데이트 소식이 있을 때만. 누르면 피드백 페이지로
// (거기서 본 것으로 기록), X로 닫으면 바로 본 것으로 기록해 점도 같이 사라진다.
import Link from "next/link";
import { useUpdatesStatus } from "@/components/UpdatesStatusContext";
import { ANNOUNCEMENT_KIND_LABEL } from "@/lib/announcements";
import { ArrowRightIcon, SparkleIcon, XIcon } from "@/components/icons";

export function UpdatesBanner() {
  const { unseen, latest, markSeen } = useUpdatesStatus();
  if (!unseen || !latest) return null;

  return (
    <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-[#1c1c1e] dark:text-gray-100 md:mx-0 md:mt-0 md:mb-3">
      <SparkleIcon className="h-4 w-4 shrink-0" />
      <Link href="/help" className="flex min-w-0 flex-1 items-center gap-1.5 hover:underline">
        <span className="shrink-0 font-semibold">새 {ANNOUNCEMENT_KIND_LABEL[latest.kind]}</span>
        <span className="truncate">{latest.title}</span>
        <ArrowRightIcon className="h-3.5 w-3.5 shrink-0" />
      </Link>
      <button
        type="button"
        onClick={() => void markSeen()}
        aria-label="배너 닫기"
        className="shrink-0 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
