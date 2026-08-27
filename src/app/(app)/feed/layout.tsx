import { createClient } from "@/lib/supabase/server";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";

// 좌(장르 필터)·우(온라인 Companion/금주 PEAK) 사이드바는 "피드를 구경할 때"만 의미 있는
// 보조 정보라 /feed 전용으로 옮김 — 예전엔 (app)/layout.tsx에 있어서 업로드/메시지/알림/
// 프로필/검색까지 전부 사이드바가 따라다녔다(인스타그램은 게시물 작성·DM·알림 화면에
// 피드 사이드바를 안 보여준다 — 그 화면 하나에만 집중하게). 비로그인 방문자는 원래도
// 사이드바가 없었으므로(GuestTopNav 분기) user가 없으면 children만 그대로 반환한다.
export default async function FeedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <>{children}</>;

  return (
    <div className="mx-auto md:grid md:max-w-[1600px] md:grid-cols-[220px_minmax(0,1fr)_220px] md:gap-4 md:px-4 md:pt-4">
      <LeftSidebar />
      <div>{children}</div>
      <RightSidebar currentUserId={user.id} />
    </div>
  );
}
