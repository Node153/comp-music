import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { GuestTopNav } from "@/components/GuestTopNav";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { NowPlayingProvider } from "@/components/NowPlayingContext";
import { GlobalPlayerBar } from "@/components/GlobalPlayerBar";
import { ThemeSync } from "@/components/ThemeSync";
import { PEAK_THRESHOLD } from "@/lib/feedConstants";

// 승인된 사용자 전용 화면(S6 피드, S8 업로드, S9 프로필, S12/S13 DM) 공통 레이아웃.
// 웹(md 이상)은 상단 네비 + 좌우 사이드바(페이스북 3단 레이아웃 참고)가 기본,
// 모바일은 하단 탭바(BottomNav)만 노출하고 사이드바는 숨김.
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
      const [{ data: newLikes }, { data: newComments }, { data: allLikes }, { data: allComments }] =
        await Promise.all([
          supabase.from("likes").select("id").in("post_id", myPostIds).neq("user_id", user.id).gt("created_at", seenAt),
          supabase.from("comments").select("id").in("post_id", myPostIds).neq("user_id", user.id).gt("created_at", seenAt),
          // PEAK 판정용 — /notifications 페이지와 동일하게 본인 반응도 포함한 전체 합계를 쓴다.
          supabase.from("likes").select("post_id, created_at").in("post_id", myPostIds),
          supabase.from("comments").select("post_id, created_at").in("post_id", myPostIds),
        ]);
      newEngagementCount = (newLikes?.length ?? 0) + (newComments?.length ?? 0);

      const engagementByPost = new Map<string, { count: number; lastActivityAt: string }>();
      for (const row of [...(allLikes ?? []), ...(allComments ?? [])]) {
        const prev = engagementByPost.get(row.post_id);
        const isNewer = !prev || new Date(row.created_at) > new Date(prev.lastActivityAt);
        engagementByPost.set(row.post_id, {
          count: (prev?.count ?? 0) + 1,
          lastActivityAt: isNewer ? row.created_at : prev.lastActivityAt,
        });
      }
      newPeakCount = [...engagementByPost.values()].filter(
        (v) => v.count >= PEAK_THRESHOLD && new Date(v.lastActivityAt) > new Date(seenAt),
      ).length;
    }

    unseenNotifications = newEngagementCount + newPeakCount + (newCompanionRequests?.length ?? 0);
  }

  return (
    <NowPlayingProvider>
      <ThemeSync />
      <div className="min-h-screen bg-gray-100 transition-colors duration-300 dark:bg-black md:bg-[#f0f2f5] md:dark:bg-black">
        {user ? (
          <TopNav
            currentUserId={user.id}
            userName={userName}
            unseenNotifications={unseenNotifications}
          />
        ) : (
          <GuestTopNav />
        )}
        {user ? (
          <div className="mx-auto md:grid md:max-w-[1600px] md:grid-cols-[220px_minmax(0,1fr)_220px] md:gap-4 md:px-4 md:pt-4">
            <LeftSidebar />
            <div>{children}</div>
            <RightSidebar currentUserId={user.id} />
          </div>
        ) : (
          children
        )}
        {user && <BottomNav currentUserId={user.id} unseenNotifications={unseenNotifications} />}
        {user && <GlobalPlayerBar />}
      </div>
    </NowPlayingProvider>
  );
}
