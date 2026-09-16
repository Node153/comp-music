"use client";

// DEMO 조회수(0053) 표시 — PostEngagementContext의 viewCount를 읽는다. 서버가 내려준 값을
// 그대로 텍스트로 박아두면 재생해도 새로고침 전까지 화면이 안 바뀌어서(사용자 제보: "조회수
// 표시 안 되는 것 같다" — 실제로는 DB엔 잘 쌓이고 있었는데 화면이 안 갱신됐던 것), PostVideo/
// SoundbarPlayer가 재생 시작 시 이 컨텍스트의 setViewCount로 낙관적 갱신을 하고, 여기서는
// 그 값을 그대로 보여주기만 한다.
import { usePostEngagement } from "@/components/PostEngagementContext";
import { formatCompactCount } from "@/lib/feedConstants";
import { PlayIcon } from "@/components/icons";

export function PostViewCount({
  className = "inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500",
  iconClassName = "h-3 w-3",
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { viewCount } = usePostEngagement();
  if (viewCount <= 0) return null;

  return (
    <span className={className}>
      <PlayIcon className={iconClassName} /> {formatCompactCount(viewCount)}
    </span>
  );
}
