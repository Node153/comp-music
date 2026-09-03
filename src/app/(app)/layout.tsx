import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { MobileTopBar } from "@/components/MobileTopBar";
import { GuestTopNav } from "@/components/GuestTopNav";
import { GuestSignupPromptProvider } from "@/components/GuestSignupPrompt";
import { NowPlayingProvider } from "@/components/NowPlayingContext";
import { GlobalPlayerBar } from "@/components/GlobalPlayerBar";
import { SearchOverlayProvider } from "@/components/SearchOverlayContext";
import { SearchOverlay } from "@/components/SearchOverlay";
import { ThemeSync } from "@/components/ThemeSync";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { NotificationCountProvider } from "@/components/NotificationCountContext";
import { getCurrentUser, getMyUserRow } from "@/lib/auth";

// 승인된 사용자 전용 화면(S6 피드, S8 업로드, S9 프로필, S12/S13 DM) 공통 레이아웃.
// 좌우 사이드바(장르 필터 / 온라인·PEAK)는 피드 전용 보조 정보라 여기 없음 —
// feed/layout.tsx에서만 붙인다(인스타그램이 작성·DM·알림 화면엔 피드 사이드바를
// 안 보여주는 것과 같은 원칙 — 화면마다 그 화면의 할 일에만 집중하게).
// 각 화면 콘텐츠는 모바일에서 하단 탭바(56px, h-14) 높이만큼 자체적으로 여백을 확보해야 한다.
// 안읽음 알림 뱃지 숫자는 여기서 계산하지 않는다 — NotificationCountProvider가 마운트 후
// /api/notifications/count로 비동기로 가져와서 첫 페인트를 막지 않는다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const me = user ? await getMyUserRow() : null;
  const userName = me?.name ?? "";

  return (
    <NowPlayingProvider>
      <ThemeSync />
      {/* 캔버스는 인스타그램 참고 — 예전엔 페이스북처럼 그레이 캔버스+그림자 카드였는데,
          인스타는 캔버스가 거의 흰색이고 카드는 그림자 없이 테두리로만 구분한다(/goal 논의). */}
      <div className="min-h-screen bg-white transition-colors duration-300 dark:bg-[#1c1c1e] md:bg-[#fafafa] md:dark:bg-[#1c1c1e]">
        {user ? (
          <NotificationCountProvider>
            <SearchOverlayProvider>
              <PresenceHeartbeat userId={user.id} />
              <TopNav currentUserId={user.id} userName={userName} />
              <MobileTopBar />
              {children}
              <BottomNav currentUserId={user.id} />
              <GlobalPlayerBar />
              <SearchOverlay />
            </SearchOverlayProvider>
          </NotificationCountProvider>
        ) : (
          // GuestTopNav와 children(익명 미리보기 피드)이 같은 GuestSignupPromptProvider
          // 안에 있어야 좋아요/댓글 클릭 시 뜨는 가입 유도 모달 상태를 공유한다.
          <GuestSignupPromptProvider>
            <GuestTopNav />
            {children}
          </GuestSignupPromptProvider>
        )}
      </div>
    </NowPlayingProvider>
  );
}
