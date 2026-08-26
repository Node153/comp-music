// PEAK 게시물 = 이번 주(캘린더 기준, 월요일 0시 KST~) 좋아요 수가 승인 회원 수의 1/3 이상인 게시물.
// 절대값 고정 대신 회원 수 비례로 둬서, 회원이 늘어날수록 기준도 같이 올라가게 한다(요구사항).
// 서버(feed/page.tsx, notifications/page.tsx, layout.tsx)와 클라이언트(EngagementMeter.tsx)가
// 같은 기준을 써야 해서 공용 함수로 뺌 — 회원 수 자체는 각 서버 컴포넌트가 직접 조회해서 넘긴다.
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
