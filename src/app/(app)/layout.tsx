import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { NavSidebar } from "@/components/NavSidebar";
import { MobileTopBar } from "@/components/MobileTopBar";
import { PageCanvas } from "@/components/PageCanvas";
import { GuestTopNav } from "@/components/GuestTopNav";
import { GuestBottomBar } from "@/components/GuestBottomBar";
import { GuestSignupPromptProvider } from "@/components/GuestSignupPrompt";
import { NowPlayingProvider } from "@/components/NowPlayingContext";
import { PlaylistProvider } from "@/components/PlaylistContext";
import { GlobalPlayerBar } from "@/components/GlobalPlayerBar";
import { QueuePanel } from "@/components/QueuePanel";
import { SearchOverlayProvider } from "@/components/SearchOverlayContext";
import { SearchOverlay } from "@/components/SearchOverlay";
import { ThemeSync } from "@/components/ThemeSync";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { PushSubscriptionSync } from "@/components/PushSubscriptionSync";
import { IosInstallPrompt } from "@/components/IosInstallGuide";
import { AndroidInstallPrompt } from "@/components/AndroidInstallGuide";
import { FeatureGuideModal } from "@/components/FeatureGuideModal";
import { FeedbackPulse } from "@/components/FeedbackPulse";
import { NotificationCountProvider } from "@/components/NotificationCountContext";
import { MessageCountProvider } from "@/components/MessageCountContext";
import { UpdatesStatusProvider } from "@/components/UpdatesStatusContext";
import { getCurrentUser, getMyUserRow } from "@/lib/auth";

// 승인된 사용자 전용 화면(S6 피드, S8 업로드, S9 프로필, S12/S13 DM) 공통 레이아웃.
// 좌우 사이드바(장르 필터 / 온라인·PEAK)는 피드 전용 보조 정보라 여기 없음 —
// feed/layout.tsx에서만 붙인다(인스타그램이 작성·DM·알림 화면엔 피드 사이드바를
// 안 보여주는 것과 같은 원칙 — 화면마다 그 화면의 할 일에만 집중하게). NavSidebar(전역 내비게이션,
// 로고/검색/업로드/채팅/알림/Help/프로필)는 이것과 별개 — 항상 화면 왼쪽에 고정(2026-09-16).
// 각 화면 콘텐츠는 모바일에서 하단 탭바(56px, h-14) 높이만큼 자체적으로 여백을 확보해야 한다.
// 안읽음 알림 뱃지 숫자는 여기서 계산하지 않는다 — NotificationCountProvider가 마운트 후
// /api/notifications/count로 비동기로 가져와서 첫 페인트를 막지 않는다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const me = user ? await getMyUserRow() : null;
  const userName = me?.name ?? "";
  const isAdmin = me?.role === "admin";

  return (
    <NowPlayingProvider>
      <ThemeSync />
      {user ? (
        // 캔버스는 인스타그램 참고 — 예전엔 페이스북처럼 그레이 캔버스+그림자 카드였는데,
        // 인스타는 캔버스가 거의 흰색이고 카드는 그림자 없이 테두리로만 구분한다(/goal 논의).
        // 이제 피드(DEMO/memo) 이외 화면은 PageCanvas가 메인 그레이 컬러 캔버스로 바꿔준다.
        <PageCanvas>
          <PlaylistProvider>
            <NotificationCountProvider>
              <MessageCountProvider>
                {/* 피드백 메뉴 "새 소식" 점·홈 배너 상태(0068) */}
                <UpdatesStatusProvider userId={user.id}>
                <SearchOverlayProvider>
                  <PresenceHeartbeat userId={user.id} />
                  {/* 웹 푸시(0074) — 서비스 워커 등록 + 이 기기 구독을 현재 계정에 연결. */}
                  <PushSubscriptionSync />
                  {/* iPhone Safari 사용자에게 홈 화면 추가(웹 앱) 안내 팝업 — 푸시는 웹 앱에서만 된다. */}
                  <IosInstallPrompt userId={user.id} />
                  {/* Android: 앱 설치(beforeinstallprompt) 또는 브라우저 메뉴 안내 + 푸시 켜기. */}
                  <AndroidInstallPrompt userId={user.id} />
                  {/* 신규 유저 첫 방문 가이드(DEMO/memo/PEAK/노크) — 로그인 화면 어디든 공통으로
                      한 번만 뜨면 되는 오버레이라 fixed 모달로 여기 둔다(2026-09-23). */}
                  <FeatureGuideModal userId={user.id} />
                  {/* 상황별 짧은 설문(트랙 올린 뒤/가입 7일째) — 띄울지는 스스로 판정(0065). */}
                  <FeedbackPulse userId={user.id} />
                  <NavSidebar currentUserId={user.id} userName={userName} isAdmin={isAdmin} />
                  {/* md 이상에서는 NavSidebar(접힌 기본폭 w-[72px], fixed, 호버 시 w-60으로만
                      넓어짐)가 왼쪽을 차지하므로 나머지 화면을 접힌 폭만큼 밀어낸다 — 호버 확장은
                      콘텐츠를 안 밀고 그 위에 겹쳐 뜨는 오버레이라 오프셋은 항상 접힌 폭 기준.
                      GlobalPlayerBar/QueuePanel은 fixed라 이 패딩 영향을 안 받아서 각자 파일에서
                      md:left-[72px]로 따로 맞춘다. */}
                  <div className="md:pl-[72px]">
                    <TopNav />
                    <MobileTopBar currentUserId={user.id} />
                    {children}
                    <BottomNav currentUserId={user.id} />
                  </div>
                  <GlobalPlayerBar />
                  <QueuePanel />
                  <SearchOverlay />
                </SearchOverlayProvider>
                </UpdatesStatusProvider>
              </MessageCountProvider>
            </NotificationCountProvider>
          </PlaylistProvider>
        </PageCanvas>
      ) : (
        // GuestTopNav와 children(익명 미리보기 피드)이 같은 GuestSignupPromptProvider
        // 안에 있어야 좋아요/댓글 클릭 시 뜨는 가입 유도 모달 상태를 공유한다.
        <div className="min-h-screen bg-white transition-colors duration-300 dark:bg-[#1c1c1e] md:bg-[#fafafa] md:dark:bg-[#1c1c1e]">
          <GuestSignupPromptProvider>
            <GuestTopNav />
            {children}
            <GuestBottomBar />
            {/* 비로그인도 설치 안내 QR·링크(?installGuide=)로 들어오면 팝업이 떠야 한다(자동 표시는 로그인 후만). */}
            <IosInstallPrompt userId={null} />
            <AndroidInstallPrompt userId={null} />
          </GuestSignupPromptProvider>
        </div>
      )}
    </NowPlayingProvider>
  );
}
