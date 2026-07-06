import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";

// 승인된 사용자 전용 화면(S6 피드, S8 업로드, S9 프로필, S12/S13 DM) 공통 레이아웃.
// 각 화면 콘텐츠는 하단 탭바(56px, h-14) 높이만큼 자체적으로 여백을 확보해야 한다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let unseenNotifications = 0;
  if (user) {
    const { data: myPosts } = await supabase.from("posts").select("id").eq("user_id", user.id);
    const myPostIds = (myPosts ?? []).map((p) => p.id);

    if (myPostIds.length > 0) {
      const { data: me } = await supabase
        .from("users")
        .select("notifications_seen_at")
        .eq("id", user.id)
        .single();
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
    <>
      {children}
      {user && <BottomNav currentUserId={user.id} unseenNotifications={unseenNotifications} />}
    </>
  );
}
