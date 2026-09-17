import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
