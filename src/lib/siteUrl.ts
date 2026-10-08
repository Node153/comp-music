// 서비스 주소 — apex(compmusic.kr)는 Vercel 도메인 설정에서 www.compmusic.kr로 308 된다.
export const APP_URL = "https://compmusic.kr";

// Vercel 프로젝트를 만들 때 붙은 기본 주소. 운영 배포를 그대로 가리키지만, 2026-10-08부터 이 주소로 온
// 화면 요청은 proxy.ts가 www.compmusic.kr로 보낸다("옛 주소 강제 이동").
export const LEGACY_HOST = "comp-music.vercel.app";

// 밖으로 나가는 링크(공유, "다른 브라우저에서 열기")에 쓰는 origin. 옛 주소에서 화면이 열려도 대표
// 도메인으로 내보낸다 — 강제 이동 뒤로는 거의 탈 일이 없는 안전장치. 로컬·미리보기 배포는 자기 주소 그대로.
export function outboundOrigin(): string {
  return window.location.hostname === LEGACY_HOST ? APP_URL : window.location.origin;
}
