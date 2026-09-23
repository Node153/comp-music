// 피드백(feedback_messages) 유형·처리 상태 라벨 — Help 채팅(FeedbackChat), 관리자 피드백
// 페이지, 알림 패널이 같이 쓴다(0062 category, 0063 status).
export type FeedbackCategory = "bug" | "inconvenience" | "idea" | "praise";
export type FeedbackStatus = "received" | "reviewing" | "done" | "on_hold";

export const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string; placeholder: string }[] = [
  { value: "bug", label: "🐞 버그", placeholder: "어디서 무엇을 했더니 어떻게 됐나요?" },
  { value: "inconvenience", label: "😣 불편", placeholder: "어떤 점이 불편했나요? 어떻게 되면 좋을까요?" },
  { value: "idea", label: "💡 아이디어", placeholder: "있었으면 하는 기능이나 바뀌었으면 하는 점을 알려주세요" },
  { value: "praise", label: "❤️ 좋아요", placeholder: "마음에 들었던 점을 알려주세요" },
];

export const FEEDBACK_CATEGORY_LABEL = Object.fromEntries(
  FEEDBACK_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<FeedbackCategory, string>;

export const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: "received", label: "📥 접수됨" },
  { value: "reviewing", label: "🔍 검토 중" },
  { value: "done", label: "✅ 반영됨" },
  { value: "on_hold", label: "⏸ 보류" },
];

export const FEEDBACK_STATUS_LABEL = Object.fromEntries(
  FEEDBACK_STATUSES.map((s) => [s.value, s.label]),
) as Record<FeedbackStatus, string>;
