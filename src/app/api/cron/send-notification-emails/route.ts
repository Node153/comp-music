import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { peakThresholdFromMemberCount, currentWeekStartISO } from "@/lib/feedConstants";

// 이메일 알림(하루 1회 다이제스트) — Vercel Hobby 플랜 크론이 하루 1회로만 제한돼서(모바일
// 앱이 없어 이메일이 유일한 알림 채널인데도) 실시간 발송 대신 이 방식으로 간다. 사용자별
// last_notification_emailed_at(0035) 이후로 생긴 것만 종류별 설정(email_notify_*)에 맞춰
// 세어서 한 통으로 모아 보낸다. Kakao 무이메일 가입자(handle_new_user, 0034)의 자리표시자
// 이메일(@no-email.comp.local)은 실제 메일함이 아니라서 건너뛴다.
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";
const APP_URL = "https://comp-music.vercel.app";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select(
      "id, email, email_notify_like, email_notify_comment, email_notify_knock, email_notify_companion_request, email_notify_message, email_notify_peak, last_notification_emailed_at",
    )
    .eq("status", "approved");

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const { count: approvedMemberCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  const peakThreshold = peakThresholdFromMemberCount(approvedMemberCount ?? 0);
  const weekStartISO = currentWeekStartISO();

  let sent = 0;

  for (const user of users ?? []) {
    const cursor = user.last_notification_emailed_at;
    const sections: string[] = [];

    if (!user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
      const { data: myPosts } = await supabase.from("posts").select("id, visibility").eq("user_id", user.id);
      const myPostIds = (myPosts ?? []).map((p) => p.id);
      const myInviteOnlyPostIds = (myPosts ?? []).filter((p) => p.visibility === "invite_only").map((p) => p.id);

      if (user.email_notify_like && myPostIds.length > 0) {
        const { count } = await supabase
          .from("likes")
          .select("id", { count: "exact", head: true })
          .in("post_id", myPostIds)
          .neq("user_id", user.id)
          .gt("created_at", cursor);
        if (count) sections.push(`좋아요 ${count}개`);
      }

      if (user.email_notify_comment && myPostIds.length > 0) {
        const { count } = await supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .in("post_id", myPostIds)
          .neq("user_id", user.id)
          .gt("created_at", cursor);
        if (count) sections.push(`댓글 ${count}개`);
      }

      if (user.email_notify_knock && myInviteOnlyPostIds.length > 0) {
        const { count } = await supabase
          .from("post_access")
          .select("id", { count: "exact", head: true })
          .in("post_id", myInviteOnlyPostIds)
          .eq("status", "pending")
          .gt("created_at", cursor);
        if (count) sections.push(`노크 ${count}건`);
      }

      if (user.email_notify_companion_request) {
        const { count } = await supabase
          .from("companions")
          .select("id", { count: "exact", head: true })
          .eq("addressee_id", user.id)
          .eq("status", "pending")
          .gt("created_at", cursor);
        if (count) sections.push(`Companion 신청 ${count}건`);
      }

      if (user.email_notify_message) {
        const { data: conversations } = await supabase
          .from("conversations")
          .select("id")
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);
        const conversationIds = (conversations ?? []).map((c) => c.id);
        if (conversationIds.length > 0) {
          const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .in("conversation_id", conversationIds)
            .neq("sender_id", user.id)
            .gt("created_at", cursor);
          if (count) sections.push(`새 메시지 ${count}개`);
        }
      }

      if (user.email_notify_peak && myPostIds.length > 0) {
        const { data: weekLikes } = await supabase
          .from("likes")
          .select("post_id, created_at")
          .in("post_id", myPostIds)
          .gte("created_at", weekStartISO);
        const weeklyByPost = new Map<string, { count: number; lastAt: string }>();
        for (const row of weekLikes ?? []) {
          const prev = weeklyByPost.get(row.post_id);
          const lastAt = !prev || row.created_at > prev.lastAt ? row.created_at : prev.lastAt;
          weeklyByPost.set(row.post_id, { count: (prev?.count ?? 0) + 1, lastAt });
        }
        const newlyPeaked = [...weeklyByPost.values()].filter((v) => v.count >= peakThreshold && v.lastAt > cursor);
        if (newlyPeaked.length > 0) sections.push(`PEAK 도달 게시물 ${newlyPeaked.length}개`);
      }

      if (sections.length > 0) {
        await sendEmail(
          user.email,
          "Comp에 새 알림이 있어요",
          `<p>${sections.join(", ")}이 와있어요.</p><p><a href="${APP_URL}/notifications">지금 확인하기</a></p>`,
        );
        sent += 1;
      }
    }

    await supabase.from("users").update({ last_notification_emailed_at: now }).eq("id", user.id);
  }

  return NextResponse.json({ checked: users?.length ?? 0, sent });
}
