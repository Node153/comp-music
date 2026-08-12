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

// 악기/장르 태그 색상 매핑 — 스캔성 향상 + Discord 느낌의 키치한 톤. 목록에 없는 태그는 회색 기본값.
// 서버(feed/page.tsx)와 클라이언트(ComplexAccessGate.tsx)가 같은 태그 색을 써야 해서 공용으로 뺌.
export const TAG_COLOR_CLASSES: Record<string, string> = {
  보컬: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  기타: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  베이스: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  드럼: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  "피아노/건반": "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  피아노: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  작곡: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  발라드: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  밴드: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  클래식: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  라이브: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  챌린지: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  필름스코어: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
const DEFAULT_TAG_COLOR_CLASS = "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-400";
export function tagColorClass(tag: string) {
  return TAG_COLOR_CLASSES[tag] ?? DEFAULT_TAG_COLOR_CLASS;
}
