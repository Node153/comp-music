// 짧은 진동 피드백(Vibration API, 2026-09-24) — Android 크롬·삼성 인터넷·설치 앱에서만 실제로
// 울리고, iPhone(Safari는 미지원)·데스크톱에선 조용히 아무것도 안 한다. 브라우저 정책상 사용자가
// 화면을 한 번이라도 누른 뒤에만 동작하므로 버튼 클릭 핸들러 안에서 부른다.
export const HAPTIC = {
  // 가벼운 탭 — 원탭 반응·댓글 등록
  tap: 12,
  // 좋아요 — 톡톡
  like: [12, 40, 18],
  // Kick — 주 1회짜리 큰 반응이라 킥드럼처럼 묵직하게
  kick: [40, 60, 40, 60, 120],
  // 업로드 완료
  success: [20, 80, 40],
} as const;

export function haptic(pattern: number | readonly number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(typeof pattern === "number" ? pattern : [...pattern]);
    }
  } catch {
    // 권한·정책으로 막혀도 기능엔 영향 없음.
  }
}
