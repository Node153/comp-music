import type { MetadataRoute } from "next";

// PWA 매니페스트(0074 웹 푸시) — 앱 출시 전이라 "홈 화면에 추가"가 곧 앱 설치다. 특히 iPhone은
// iOS 16.4+에서 홈 화면에 추가된 웹앱만 푸시를 받을 수 있어서 이 파일이 있어야 한다.
// 아이콘(public/pwa-icon-*.png)은 임시 로고(brand-cat.png) 기반 — 정식 로고가 나오면 같이 교체.
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
    icons: [
      { src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
