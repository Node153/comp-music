import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION = "전문 음악인만 참여할 수 있는 커뮤니티에서 습작을 공유하고 함께할 사람을 찾아보세요.";

export const metadata: Metadata = {
  title: "Compmusic",
  description: SITE_DESCRIPTION,
  openGraph: {
    title: "Compmusic",
    description: SITE_DESCRIPTION,
    url: "https://compmusic.kr",
    siteName: "Compmusic",
    locale: "ko_KR",
    type: "website",
  },
  // iPhone "홈 화면에 추가" 시 사파리 주소창 없이 앱처럼 열리게(웹 푸시는 이 상태에서만 됨, 0074).
  appleWebApp: {
    capable: true,
    title: "Compmusic",
    statusBarStyle: "default",
  },
};

// viewportFit "cover"가 없으면 iOS(특히 홈 화면에 추가한 웹앱)에서 env(safe-area-inset-*)가 항상
// 0이라, BottomNav 등의 홈 인디케이터 여백이 적용되지 않는다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* 이용 통계 수집(0079) — 로그인 전 랜딩·가입 화면부터 재야 해서 루트에 둔다. useSearchParams를
            쓰므로 Suspense로 감싸야 나머지 페이지가 정적 렌더를 유지한다. */}
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
      </body>
    </html>
  );
}
