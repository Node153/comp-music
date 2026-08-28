import { createClient } from "@/lib/supabase/server";
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
import { peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";

// 승인된 사용자 전용 화면(S6 피드, S8 업로드, S9 프로필, S12/S13 DM) 공통 레이아웃.
// 좌우 사이드바(장르 필터 / 온라인·PEAK)는 피드 전용 보조 정보라 여기 없음 —
// feed/layout.tsx에서만 붙인다(인스타그램이 작성·DM·알림 화면엔 피드 사이드바를
// 안 보여주는 것과 같은 원칙 — 화면마다 그 화면의 할 일에만 집중하게).
// 각 화면 콘텐츠는 모바일에서 하단 탭바(56px, h-14) 높이만큼 자체적으로 여백을 확보해야 한다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userName = "";
  let unseenNotifications = 0;
  if (user) {
    const { data: me } = await supabase
      .from("users")
      .select("name, notifications_seen_at")
      .eq("id", user.id)
      .single();
    userName = me?.name ?? "";
    const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();

    const [{ data: myPosts }, { data: newCompanionRequests }] = await Promise.all([
      supabase.from("posts").select("id").eq("user_id", user.id),
      supabase
        .from("companions")
        .select("id")
        .eq("addressee_id", user.id)
        .eq("status", "pending")
        .gt("created_at", seenAt),
    ]);
    const myPostIds = (myPosts ?? []).map((p) => p.id);

    let newEngagementCount = 0;
    let newPeakCount = 0;
    if (myPostIds.length > 0) {
      const [{ data: newLikes }, { data: newComments }, { data: weekLikes }, { count: approvedMemberCount }] =
        await Promise.all([
          supabase.from("likes").select("id").in("post_id", myPostIds).neq("user_id", user.id).gt("created_at", seenAt),
          supabase.from("comments").select("id").in("post_id", myPostIds).neq("user_id", user.id).gt("created_at", seenAt),
          // PEAK 판정용 — /notifications 페이지와 동일하게 이번 주(캘린더) 좋아요 수만 쓴다.
          supabase.from("likes").select("post_id, created_at").in("post_id", myPostIds).gte("created_at", currentWeekStartISO()),
          supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "approved"),
        ]);
      newEngagementCount = (newLikes?.length ?? 0) + (newComments?.length ?? 0);

      const peakThreshold = peakThresholdFromMemberCount(approvedMemberCount ?? 0);
      const weeklyLikesByPost = new Map<string, { count: number; lastLikedAt: string }>();
      for (const row of weekLikes ?? []) {
        const prev = weeklyLikesByPost.get(row.post_id);
        const isNewer = !prev || new Date(row.created_at) > new Date(prev.lastLikedAt);
        weeklyLikesByPost.set(row.post_id, {
          count: (prev?.count ?? 0) + 1,
          lastLikedAt: isNewer ? row.created_at : prev.lastLikedAt,
        });
      }
      newPeakCount = [...weeklyLikesByPost.values()].filter(
        (v) => v.count >= peakThreshold && new Date(v.lastLikedAt) > new Date(seenAt),
      ).length;
    }

    unseenNotifications = newEngagementCount + newPeakCount + (newCompanionRequests?.length ?? 0);
  }

  return (
    <NowPlayingProvider>
      <ThemeSync />
      {/* 캔버스는 인스타그램 참고 — 예전엔 페이스북처럼 그레이 캔버스+그림자 카드였는데,
          인스타는 캔버스가 거의 흰색이고 카드는 그림자 없이 테두리로만 구분한다(/goal 논의). */}
      <div className="min-h-screen bg-white transition-colors duration-300 dark:bg-[#1c1c1e] md:bg-[#fafafa] md:dark:bg-[#1c1c1e]">
        {user ? (
          <SearchOverlayProvider>
            <PresenceHeartbeat userId={user.id} />
            <TopNav
              currentUserId={user.id}
              userName={userName}
              unseenNotifications={unseenNotifications}
            />
            <MobileTopBar unseenNotifications={unseenNotifications} />
            {children}
            <BottomNav currentUserId={user.id} unseenNotifications={unseenNotifications} />
            <GlobalPlayerBar />
            <SearchOverlay />
          </SearchOverlayProvider>
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
