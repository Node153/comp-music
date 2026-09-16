// PEAK 게시물(카드 배지·레벨 막대·우측 사이드바 노출) = 조회수(view_count)가 이 값 이상인
// 게시물(2026-09-17 변경, 사용자 요청) — 우선 PEAK 게시물 자체를 많이 쌓는 게 먼저라 절대값
// 하나로 고정. 회원 수 비례였던 예전 기준(peakThresholdFromMemberCount)은 알림/이메일
// 크론(주간 좋아요 기준)에서는 그대로 쓰고 있어 남겨둔다 — 이 값만 바꾸면 노출 기준이
// 전체적으로 다시 조정된다.
export const PEAK_VIEW_THRESHOLD = 1000;

// 알림/이메일 크론(주간 좋아요 PEAK) 전용 — 게시물 카드/사이드바의 PEAK 기준은 위
// PEAK_VIEW_THRESHOLD(조회수)로 바뀌었고, 이 함수는 아직 조회수 기준으로 안 옮긴 알림
// 로직에서만 쓰인다.
export function peakThresholdFromMemberCount(approvedMemberCount: number): number {
  return Math.max(1, Math.ceil(approvedMemberCount / 3));
}

// 이번 주 시작(월요일 0시, KST 고정 — 서비스가 한국 기준이라 DST 없음)의 ISO 문자열.
// likes.created_at이 이 값 이상인 것만 PEAK 집계에 포함한다.
export function currentWeekStartISO(now = new Date()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const day = kstNow.getUTCDay(); // 0(일)~6(토) — KST로 시프트한 시각의 UTC getter라 KST 기준 요일과 같다.
  const diffToMonday = (day + 6) % 7;
  const kstMondayLabel = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() - diffToMonday);
  return new Date(kstMondayLabel - KST_OFFSET_MS).toISOString();
}

// 태그마다 다른 색을 주면(예전 버전) 태그 종류가 늘어날수록 알록달록해져서 UI가 조잡해
// 보인다 — 인스타그램처럼 태그는 전부 같은 톤 하나로 통일. 시그니처 컬러가 정해지면
// 이 한 줄만 바꾸면 전체 태그 색이 한 번에 바뀐다.
const TAG_COLOR_CLASS = "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400";
export function tagColorClass(_tag: string) {
  return TAG_COLOR_CLASS;
}

// 조회수 등 큰 숫자를 사운드클라우드처럼 축약 표기(106K, 66.1K)한다 — 한국어 로케일로 하면
// "10.6만"이 되어버려서 명시적으로 "en"을 쓴다(사용자가 참고 이미지로 보여준 표기와 동일).
const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export function formatCompactCount(n: number): string {
  return compactNumberFormatter.format(n);
}
