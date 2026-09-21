// R2에 업로드/서빙되는 파일의 Content-Type 화이트리스트. upload-url이 발급을 이 목록으로
// 제한하고, avatar/waveform-proxy는 응답 Content-Type이 이 목록 밖이면 Content-Disposition을
// attachment로 강제한다 — text/html, image/svg+xml처럼 브라우저가 직접 렌더링하거나 스크립트를
// 실행할 수 있는 타입이 업로드되거나(신규) 이미 R2에 남아있어도(기존 오브젝트) 새 탭에서 바로
// 열려서 실행되는 저장형 XSS 경로를 막기 위함.
export const ALLOWED_UPLOAD_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "video/mp4",
  "video/quicktime",
]);
