// 서비스 주소 — apex(compmusic.kr)는 Vercel 도메인 설정에서 www.compmusic.kr로 308 된다.
export const APP_URL = "https://compmusic.kr";

// Vercel 프로젝트를 만들 때 붙은 기본 주소. 운영 배포를 그대로 가리켜서 이 주소로도 사이트가 열리고,
// 운영 Supabase의 Site URL도 아직 이 주소다(2026-10-08) — proxy.ts의 "옛 주소로 돌아온 인증" 처리 참고.
export const LEGACY_HOST = "comp-music.vercel.app";

// 밖으로 나가는 링크(공유, "다른 브라우저에서 열기")에 쓰는 origin. 옛 주소로 접속해 있어도 대표
// 도메인으로 내보낸다 — 받는 사람까지 vercel 주소로 들어오지 않게. 로컬·미리보기 배포는 자기 주소 그대로.
export function outboundOrigin(): string {
  return window.location.hostname === LEGACY_HOST ? APP_URL : window.location.origin;
}
