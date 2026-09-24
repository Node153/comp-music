import type { MetadataRoute } from "next";

// PWA 매니페스트(0074 웹 푸시) — 앱 출시 전이라 "홈 화면에 추가"가 곧 앱 설치다. 특히 iPhone은
// iOS 16.4+에서 홈 화면에 추가된 웹앱만 푸시를 받을 수 있어서 이 파일이 있어야 한다.
// 아이콘(public/pwa-icon-*.png)은 임시 로고(brand-cat.png) 기반 — 정식 로고가 나오면 같이 교체.
// (알림 상태바용 흰 단색 음표 public/notification-badge.png는 로고와 무관하게 유지해도 됨.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Compmusic",
    short_name: "Compmusic",
    description: "전문 음악인만 참여할 수 있는 커뮤니티에서 습작을 공유하고 함께할 사람을 찾아보세요.",
    id: "/",
    start_url: "/feed",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ko",
    categories: ["music", "social"],
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // 홈 화면 아이콘 길게 누르기 메뉴(Android·데스크톱 설치 앱, iOS는 미지원).
    shortcuts: [
      { name: "새 Drop 올리기", short_name: "올리기", url: "/upload", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }] },
      { name: "DEMO 피드", short_name: "피드", url: "/feed", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }] },
      { name: "알림 설정", short_name: "알림", url: "/notifications/settings", icons: [{ src: "/pwa-icon-192.png", sizes: "192x192" }] },
    ],
    // 다른 앱의 "공유" 목록에 Compmusic이 뜨게 — 음원·영상을 보내면 바로 업로드 화면으로(Android 설치 앱).
    // 실제 파일 처리는 sw.js(fetch) → src/lib/shareTarget.ts → 업로드 화면.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        files: [{ name: "media", accept: ["audio/*", "video/*", ".mp3", ".wav", ".m4a", ".aac", ".flac", ".mp4", ".mov"] }],
      },
    },
  };
}
