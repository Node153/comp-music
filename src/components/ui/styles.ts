// 라이트 테마 디자인 시스템 — 중성적인 톤(흑백 위주), 링크만 blue-600 포인트, 파괴적 액션은 red-600.
// 여러 화면에서 반복되는 Tailwind 클래스 조합을 한 곳에 모아 시각적 일관성을 유지한다.

export const field =
  "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black";

export const badge = "rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700";

export const badgeDark = "rounded-full bg-black px-2.5 py-1 text-xs text-white";

export const pageTitle = "text-2xl font-bold tracking-tight text-gray-900";

export const sectionTitle = "text-base font-semibold text-gray-900";

export const label = "text-sm font-medium text-gray-700";

export const errorText = "text-sm text-red-600";

export const mutedText = "text-sm text-gray-500";

export const link = "text-sm font-medium text-blue-600 hover:underline";

export const card = "rounded-2xl border border-gray-200 bg-white p-4";

// (app) 라우트 그룹 화면(피드 제외) 공통 래퍼 — 모바일은 여백만 있는 전체폭, md 이상은 짙은 그레이
// 캔버스(PageCanvas) 위 중간톤 카드(페이스북 참고). 그레이는 옅은/중간/짙은 + 활성화 박스 전용
// demo-bg 4가지만 쓴다(globals.css 참고) — 채색된(배경 있는) 박스는 테두리를 따로 안 그리고,
// 검정은 글씨 전용으로만 남긴다.
// 하단 여백은 화면 맨 아래 고정된 GlobalPlayerBar(로그인 시 전 페이지 상주, h-16=64px) 기준으로
// 잡는다(2026-09-15, 사용자 요청 — "화면 기준을 사운드바 위 기준으로 잡아야 함") — 재생 중인
// 트랙·대기열이 없어도 바 자체는 항상 떠 있어서, 안 잡으면 폼 맨 아래 버튼 등이 바에 가려진다.
//   · 모바일: 바가 BottomNav(h-14=56px) 바로 위(bottom-14)에 뜨므로 56+64=120px 필요 → pb-32(128px).
//   · md 이상: BottomNav 없이 바가 바로 바닥(bottom-0)에 붙으므로 64px만 필요 → md:pb-24(96px, 여유
//     32px 포함, GlobalPlayerBar.tsx:209 h-16/md:bottom-0 참고).
export const pageCard =
  "mx-auto max-w-[600px] bg-main-gray p-6 pb-32 md:my-6 md:rounded-lg md:pb-24";
