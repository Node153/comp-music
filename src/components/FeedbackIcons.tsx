// 피드백 유형·처리 상태별 선 아이콘(2026-09-24) — 라벨(lib/feedback.ts)은 글자만 두고, 화면에서
// 아이콘을 따로 붙인다. 이모지 대신 SVG라 어느 브라우저에서도 같은 흑백 모양으로 보인다.
import type { FeedbackCategory, FeedbackStatus } from "@/lib/feedback";
import {
  BugIcon,
  CheckCircleIcon,
  FrownIcon,
  HeartIcon,
  InboxIcon,
  LightbulbIcon,
  PauseCircleIcon,
  SearchIcon,
} from "@/components/icons";

export function FeedbackCategoryIcon({ category, className }: { category: FeedbackCategory; className?: string }) {
  if (category === "bug") return <BugIcon className={className} />;
  if (category === "inconvenience") return <FrownIcon className={className} />;
  if (category === "idea") return <LightbulbIcon className={className} />;
  return <HeartIcon className={className} />;
}

export function FeedbackStatusIcon({ status, className }: { status: FeedbackStatus; className?: string }) {
  if (status === "received") return <InboxIcon className={className} />;
  if (status === "reviewing") return <SearchIcon className={className} />;
  if (status === "done") return <CheckCircleIcon className={className} />;
  return <PauseCircleIcon className={className} />;
}
