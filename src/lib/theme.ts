// DEMO(라이트) ↔ memo(다크) 테마 전환을 한 군데서 처리 — <html>에 .dark를 붙였다 떼는 건
// 예전과 같지만, 탭을 오갈 때 색이 뚝 끊기지 않고 부드럽게 번지도록 전환 순간에만
// .theme-transition 클래스를 잠깐 얹는다(전역 색 트랜지션은 globals.css가 이 클래스에 걸어둠).
// 평소에도 계속 걸어두면 hover 같은 일반 색 변화까지 느려져서, 전환할 때만 켜고 끝나면 뗀다.
// 전환할 때 효과음도 같이 재생 — memo(다크) 진입은 night, DEMO(라이트) 복귀는 day.

const TRANSITION_MS = 4000;
let clearTimer: ReturnType<typeof setTimeout> | null = null;

// <audio> 대신 Audio 객체를 미리 만들어 캐시 — 매번 새로 만들면 첫 재생이 로딩 때문에 늦는다.
// 탭 클릭(사용자 제스처) 흐름에서 호출되므로 브라우저 자동재생 정책에 안 걸린다.
let dayAudio: HTMLAudioElement | null = null;
let nightAudio: HTMLAudioElement | null = null;

function playThemeSound(dark: boolean) {
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

export function applyTheme(dark: boolean, { animate = true }: { animate?: boolean } = {}) {
  const root = document.documentElement;

  // 이미 원하는 상태면 아무것도 안 함 — 불필요한 트랜지션 깜빡임/중복 효과음 방지.
  if (root.classList.contains("dark") === dark) return;

  if (animate) {
    beginThemeTransition();
    playThemeSound(dark);
  }

  root.classList.toggle("dark", dark);
}
