import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";

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

    const { data: myPosts } = await supabase.from("posts").select("id").eq("user_id", user.id);
    const myPostIds = (myPosts ?? []).map((p) => p.id);

    if (myPostIds.length > 0) {
      const seenAt = me?.notifications_seen_at ?? new Date(0).toISOString();

      const { data: newLikes } = await supabase
        .from("likes")
        .select("id")
        .in("post_id", myPostIds)
        .neq("user_id", user.id)
        .gt("created_at", seenAt);
      const { data: newComments } = await supabase
        .from("comments")
        .select("id")
        .in("post_id", myPostIds)
        .neq("user_id", user.id)
        .gt("created_at", seenAt);

      unseenNotifications = (newLikes?.length ?? 0) + (newComments?.length ?? 0);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 md:bg-[#f0f2f5]">
      {user && <TopNav currentUserId={user.id} unseenNotifications={unseenNotifications} />}
      {user ? (
        <div className="mx-auto md:grid md:max-w-[1200px] md:grid-cols-[240px_minmax(0,1fr)_280px] md:gap-4 md:px-4 md:pt-4">
          <LeftSidebar userId={user.id} userName={userName} />
          <div>{children}</div>
          <RightSidebar />
        </div>
      ) : (
        children
      )}
      {user && <BottomNav currentUserId={user.id} unseenNotifications={unseenNotifications} />}
    </div>
  );
}
