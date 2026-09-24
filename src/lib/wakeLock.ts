// 화면 꺼짐 방지(Screen Wake Lock API, 2026-09-24) — 업로드 중 영상 다듬기(ffmpeg.wasm, 길면
// 수십 초)나 큰 파일 전송 도중 폰 화면이 꺼지면 브라우저가 탭을 멈춰 작업이 끊길 수 있어서,
// 작업하는 동안만 화면을 켜둔다. 지원 안 하는 브라우저·거부된 경우엔 아무것도 안 하는 해제 함수를
// 돌려준다(호출하는 쪽은 성공 여부와 무관하게 끝나면 항상 해제 함수를 부르면 된다).
export async function acquireWakeLock(): Promise<() => void> {
  try {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return () => {};
    const sentinel = await navigator.wakeLock.request("screen");
    return () => {
      sentinel.release().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
