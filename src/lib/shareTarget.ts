// Android 공유 시트 → Compmusic 업로드(Web Share Target, 2026-09-24). 설치한 Compmusic 앱은
// 다른 앱(파일·DAW·녹음 앱 등)의 "공유" 목록에 뜨고(manifest.ts share_target), 거기서 음원·영상을
// 보내면 서비스 워커(public/sw.js)가 파일을 Cache Storage에 잠깐 넣어두고 /upload?shared=1로
// 보낸다. 업로드 화면이 여기서 한 번 꺼내 쓰고 바로 지운다. 키 값은 sw.js와 반드시 같아야 한다.
export const SHARE_CACHE_NAME = "comp-share-target-v1";
export const SHARE_CACHE_KEY = "/__shared-upload";

export async function takeSharedUploadFile(): Promise<File | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(SHARE_CACHE_NAME);
    const res = await cache.match(SHARE_CACHE_KEY);
    if (!res) return null;
    await cache.delete(SHARE_CACHE_KEY);
    const blob = await res.blob();
    const name = decodeURIComponent(res.headers.get("x-file-name") ?? "shared-file");
    return new File([blob], name, { type: blob.type || res.headers.get("content-type") || "" });
  } catch {
    return null;
  }
}
