// DEMO(라이트) ↔ memo(다크) 테마 전환을 한 군데서 처리 — <html>에 .dark를 붙였다 떼는 건
// 예전과 같지만, 탭을 오갈 때 색이 뚝 끊기지 않고 부드럽게 번지도록 전환 순간에만
// .theme-transition 클래스를 잠깐 얹는다(전역 색 트랜지션은 globals.css가 이 클래스에 걸어둠).
// 평소에도 계속 걸어두면 hover 같은 일반 색 변화까지 느려져서, 전환할 때만 켜고 끝나면 뗀다.
// 전환할 때 효과음도 같이 재생 — memo(다크) 진입은 night, DEMO(라이트) 복귀는 day.

const TRANSITION_MS = 4000;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

// <audio> 대신 Audio 객체를 미리 만들어 캐시 — 매번 새로 만들면 첫 재생이 로딩 때문에 늦는다.
// 반드시 탭 <Link>의 onClick 핸들러 안에서 "동기적으로" 호출해야 브라우저 자동재생 정책에
// 안 걸린다 — /feed는 searchParams를 읽는 동적 서버 컴포넌트라 탭 클릭이 실제 네비게이션
// (RSC 왕복)을 일으키고, ThemeSync의 useEffect(=applyTheme)는 그 응답이 온 "뒤"에야 실행된다.
// 예전엔 사운드 재생을 그 이펙트 쪽(applyTheme)에서 했는데, 클릭 시점과 재생 시점 사이에
// 네트워크 왕복만큼의 비동기 지연이 끼면서 브라우저의 user-activation이 만료돼 play()가
// 조용히(.catch로 삼켜짐) 실패하는 경우가 있었다(사용자 제보 — "가끔씩 탭 누를 때 소리가
// 안 남", 느린 네트워크/콜드 스타트일수록 재현). 그래서 사운드는 이제 탭 onClick에서
// beginThemeTransitionWithSound로 동기 호출하고, applyTheme/ThemeSync는 시각적 전환(다크
// 클래스 토글 + 그라데이션)만 담당한다.
let dayAudio: HTMLAudioElement | null = null;
let nightAudio: HTMLAudioElement | null = null;

export function playThemeSound(dark: boolean) {
  if (typeof Audio === "undefined") return;
  if (!dayAudio) {
    dayAudio = new Audio("/theme-day.wav");
    dayAudio.volume = 0.5;
  }
  if (!nightAudio) {
    nightAudio = new Audio("/theme-night.wav");
    nightAudio.volume = 0.5;
  }
  const audio = dark ? nightAudio : dayAudio;
  // 연타 대비 — 재생 중이면 처음으로 되감아 다시 재생.
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// 전역 색 트랜지션(globals.css의 .theme-transition)을 TRANSITION_MS 동안 켠다.
// ThemeSync의 applyTheme은 네비게이션 "후" 이펙트에서 불리는데, 그 전에 이미 탭
// className이 새 색으로 커밋돼버려서(예: memo→DEMO에서 탭 글자색이 4s 트랜지션을
// 못 타고 150ms 유틸리티로 뚝 바뀜) 방향에 따라 그라데이션이 되고 안 되고가 갈렸다.
// 그래서 탭 <Link>의 onClick에서도 이걸 먼저 호출해, 네비게이션 리렌더가 색을 바꾸는
// 시점에 이미 .theme-transition이 걸려 있게 한다. 중복 호출은 타이머만 다시 잡을 뿐 무해.
export function beginThemeTransition() {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    root.classList.remove("theme-transition");
    clearTimer = null;
  }, TRANSITION_MS);
}

// DEMO/memo 탭 <Link>의 onClick에서 쓰는 진입점 — 그라데이션 예약과 효과음 재생을 클릭
// 시점에 동기적으로 함께 처리한다(위 playThemeSound 설명 참고). dark는 그 탭을 눌렀을 때
// 향할 목표 테마 — 이미 그 테마라면(같은 탭 재클릭) 조용히 무시한다.
export function beginThemeTransitionWithSound(dark: boolean) {
  if (document.documentElement.classList.contains("dark") === dark) return;
  beginThemeTransition();
  playThemeSound(dark);
}

export function applyTheme(dark: boolean, { animate = true }: { animate?: boolean } = {}) {
  const root = document.documentElement;

  // 이미 원하는 상태면 아무것도 안 함 — 불필요한 트랜지션 깜빡임 방지.
  if (root.classList.contains("dark") === dark) return;

  // 효과음은 탭 onClick의 beginThemeTransitionWithSound가 이미 재생했다 — 여기서 또
  // 재생하면 중복 재생된다. 여기(네비게이션 후 이펙트)는 .dark 클래스 토글 + 그라데이션
  // 트랜지션 시작만 담당한다.
  if (animate) {
    beginThemeTransition();
  }

  root.classList.toggle("dark", dark);
}
