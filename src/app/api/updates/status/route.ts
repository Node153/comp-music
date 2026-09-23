import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 피드백 메뉴 "새 소식" 점/홈 배너(0068) — 가장 최근 공지(업데이트 소식)가 내가 마지막으로 본
// 시각(users.updates_seen_at)보다 새로우면 unseen. 세션 createClient라 RLS가 그대로 적용된다.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ unseen: false, latest: null });

  const [{ data: me }, { data: latest }] = await Promise.all([
    supabase.from("users").select("updates_seen_at").eq("id", user.id).single(),
    supabase
      .from("announcements")
      .select("id, title, kind, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const unseen = !!latest && !!me && new Date(latest.created_at) > new Date(me.updates_seen_at);
  return NextResponse.json({ unseen, latest });
}
