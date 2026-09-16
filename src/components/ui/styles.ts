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

// (app) 라우트 그룹 화면(피드 제외) 공통 래퍼 — 모바일은 여백만 있는 전체폭, md 이상은 그레이
// 캔버스(PageCanvas) 위 카드(페이스북 참고). 그레이는 배경 4단계(box-gray/main-gray/canvas-gray
// + 활성화 박스 전용 demo-bg) 전부 DEMO 탭 배경(#fafafa) 기준 살짝 어두운 밝은 톤으로 통일돼
// 있다(2026-09-16, globals.css 참고) — 채색된(배경 있는) 박스는 테두리를 따로 안 그리고,
// 검정은 글씨 전용으로만 남긴다.
// 하단 여백은 화면 맨 아래 고정된 GlobalPlayerBar(로그인 시 전 페이지 상주, h-16=64px) 기준으로
// 잡는다(2026-09-15, 사용자 요청 — "화면 기준을 사운드바 위 기준으로 잡아야 함") — 재생 중인
// 트랙·대기열이 없어도 바 자체는 항상 떠 있어서, 안 잡으면 폼 맨 아래 버튼 등이 바에 가려진다.
// 처음엔 pb(패딩)로 줬는데, 그러면 카드 자체(bg-main-gray)가 그만큼 더 길어져서 버튼 아래에
// 카드 배경색 그대로인 빈 공간이 위 여백과 안 맞게 훅 늘어나 보였다(사용자 지적) — margin으로
// 바꿔서 그 여유 공간이 카드 "밖"(PageCanvas의 더 짙은 배경)에 생기게 해, 카드 안쪽 상하 패딩은
// p-6로 대칭 유지하면서 카드 자체는 짧게, 카드와 바 사이만 벌어지게 했다.
//   · 모바일: 바가 BottomNav(h-14=56px) 바로 위(bottom-14)에 뜨므로 56+64=120px 필요 → mb-32(128px).
//   · md 이상: BottomNav 없이 바가 바로 바닥(bottom-0)에 붙으므로 64px만 필요 → md:mb-24(96px, 여유
//     32px 포함, GlobalPlayerBar.tsx:209 h-16/md:bottom-0 참고). md:mt-6로 상단 여백은 그대로.
// 폭은 피드 DEMO 카드(feed/page.tsx에서 확정된 659px 고정폭)와 동일하게 맞춤(2026-09-15,
// 사용자 요청) — 예전 600px에서 살짝 넓어짐.
export const pageCard =
  "mx-auto max-w-[659px] bg-main-gray p-6 mb-32 md:mt-6 md:mb-24 md:rounded-lg";

// 상단바(TopNav/MobileTopBar) 아이콘 버튼 색 — 피드(흰 상단바)는 기존 gray-100/200 톤 그대로,
// 그 외 화면(main-gray 상단바 위)은 근처가 거의 흰색이라 붕 떠 보였던 걸 그레이 컬러 시스템의
// 옅은 톤(box-gray)·활성화 박스 톤(demo-bg)으로 맞춘다(2026-09-16, 사용자 요청).
export function topBarIconClass(active: boolean, isFeed: boolean) {
  if (isFeed) {
    return active
      ? "bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800";
  }
  return active ? "bg-demo-bg text-black" : "bg-box-gray text-black hover:opacity-80";
}

// NavSidebar 항목(아이콘+라벨 한 줄) 공통 스타일 — 위 topBarIconClass의 색 규칙을 그대로 쓰되
// 사이드바 행 레이아웃(전체 폭·좌측 정렬)에 맞춘다(2026-09-16, 인스타그램 참고 — 메뉴들을
// 상단바에서 좌측 사이드바로 이동).
// expanded는 CSS group-hover가 아니라 NavSidebar가 JS로 계산해 내려주는 값이다(2026-09-16
// 추가 요청) — 메시지/알림 패널이 열려 있는 동안은 마우스를 올려도 사이드바가 넓어지면
// 안 된다(인스타그램은 알림을 누르면 사이드바가 접힌 채로 고정되고 그 옆에 알림 목록이
// 바로 이어지는데, 순수 CSS hover면 패널이 열려도 여전히 마우스가 사이드바 위에 있어서
// 넓어진 사이드바 라벨과 알림 패널이 동시에 겹쳐 보였다). 그래서 hover는 NavSidebar가
// onMouseEnter/Leave로 자체 상태를 갖고, 패널이 열려있으면 그 상태를 무시하고 강제로 접는다.
export function navRowClass(active: boolean, isFeed: boolean, expanded: boolean) {
  // 접혔을 때(gap-0)는 라벨이 max-w-0이라도 gap이 있으면 그만큼 빈 공간이 남아 아이콘이
  // 정중앙에서 살짝 벗어나 보인다 — 펼쳐질 때만(gap-4) 라벨과의 간격을 준다.
  const layout = expanded ? "justify-start gap-4" : "justify-center gap-0";
  return `flex w-full items-center ${layout} rounded-xl px-3 py-2.5 text-[15px] font-medium transition ${topBarIconClass(active, isFeed)}`;
}

// NavSidebar 행의 라벨 텍스트 — 접힌 상태에선 안 보이다가 expanded=true일 때 페이드인된다.
// max-width로 접고 펴는 이유: opacity만으로는 접혔을 때도 텍스트가 자리(레이아웃 너비)를
// 차지해서 아이콘이 가운데로 안 온다 — max-w-0→[160px] 트랜지션으로 너비 자체를 접는다.
export function navLabelClass(expanded: boolean) {
  const state = expanded ? "opacity-100 max-w-[160px]" : "opacity-0 max-w-0";
  return `flex-1 overflow-hidden whitespace-nowrap text-left transition-all duration-200 ${state}`;
}
