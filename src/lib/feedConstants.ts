// 비로그인 게스트 음원 미리듣기 상한(2026-09-23, 사용자 요청) — 미공개·미등록 저작물이라
// 전체를 다 들려주는 게 부담스럽다는 우려로 도입. 스포티파이/사운드클라우드의 30초 미리듣기
// 관례를 따랐다. 단, R2 signed URL을 <audio src>에 그대로 꽂아 재생하는 구조상 개발자도구로
// URL 자체를 복사하면 이 제한은 우회된다 — 이건 어디까지나 캐주얼한 억제용이지 실제 보안
// 조치는 아니다(진짜 방지하려면 서버 스트리밍+토큰 같은 별도 인프라가 필요, 지금 단계엔 과함).
export const GUEST_PREVIEW_SECONDS = 30;

// PEAK 게시물(카드 배지·레벨 막대·우측 사이드바 노출) = 조회수(view_count)가 이 값 이상인
// 게시물(2026-09-17 변경, 사용자 요청) — 우선 PEAK 게시물 자체를 많이 쌓는 게 먼저라 절대값
// 하나로 고정. 알림 패널/뱃지/이메일 다이제스트도 이제 이 기준으로 영구 고정된
// posts.peaked_at(0056 마이그레이션)을 그대로 쓴다 — 이 값만 바꾸면 노출 기준이
// 전체적으로 다시 조정된다.
export const PEAK_VIEW_THRESHOLD = 1000;

// 좋아요 1개 = 조회수 10으로 환산해서 PEAK 점수에 반영(2026-09-17, 사용자 요청) — 좋아요가
// 그냥 보는 것보다 무거운 행동이라 가중치를 준다. 카드 레벨 막대(EngagementMeter)와 우측
// 사이드바 PEAK 목록(RightSidebar)이 이 점수를 똑같이 써야 두 곳의 PEAK 판정이 어긋나지 않는다.
export const PEAK_LIKE_WEIGHT = 10;

// Kick 1개 = 조회수 100(좋아요 10개 몫, 2026-09-24 사용자 결정) — 주 1회만 줄 수 있는 반응이라
// 훨씬 무겁게 친다. DB의 check_and_set_post_peak(0071)과 반드시 같은 값이어야 한다.
export const PEAK_KICK_WEIGHT = 100;

export function peakScore(viewCount: number, likeCount: number, kickCount = 0): number {
  return viewCount + likeCount * PEAK_LIKE_WEIGHT + kickCount * PEAK_KICK_WEIGHT;
}

// (app)/feed/page.tsx가 PostEngagementProvider에 내려주는 peakThreshold/weeklyLikeCount
// 계산에만 남아있는 옛 회원수 비례 기준 — EngagementMeter는 더 이상 이 값을 안 쓴다
// (PEAK_VIEW_THRESHOLD+peakScore로 대체됨). 알림/이메일 로직은 posts.peaked_at을 쓴다.
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

// Kick 주차 키(0071 kicks.week_start, 'YYYY-MM-DD') — currentWeekStartISO와 같은 경계(KST 월요일).
export function currentKickWeekStart(now = new Date()): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  return new Date(new Date(currentWeekStartISO(now)).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

// 다음 Kick 충전(다음 주 월요일 0시 KST)까지 남은 일수 — 1~7.
export function daysUntilNextKick(now = new Date()): number {
  const nextWeekStart = new Date(currentWeekStartISO(now)).getTime() + 7 * 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((nextWeekStart - now.getTime()) / (24 * 60 * 60 * 1000)));
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
