// 운영자 표시 뱃지. 회원(Companion)에게 "이 사람이 운영자(comper)"임을 알린다.
// 이름 바로 옆에 붙는 작은 pill.
export function ComperBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-gray-900 px-1.5 py-px text-[10px] font-bold leading-tight tracking-wide text-white dark:bg-white dark:text-black ${className}`}
      title="운영자"
    >
      comper
    </span>
  );
}
