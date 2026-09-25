// 업로드 "피드백 받기"(0089) — 작성자가 봐줬으면 하는 부분(복수 선택). posts.feedback_focus에
// 라벨 문자열 그대로 저장한다(null = 피드백 요청 안 함). 순서는 업로드 화면 칩 순서.
export const FEEDBACK_FOCUS_OPTIONS = [
  "믹싱",
  "편곡",
  "화성 및 송폼",
  "사운드디자인 및 연출",
  "보컬 및 탑라인",
  "가사",
  "전체 느낌",
] as const;

export const FEEDBACK_NOTE_MAX = 120;

// 피드 카드 칩·댓글 안내 문구용 — 분야를 안 골랐으면 "전체적으로".
export function feedbackFocusText(focus: string[] | null | undefined) {
  if (!focus) return null;
  return focus.length > 0 ? focus.join(" · ") : "전체적으로";
}
