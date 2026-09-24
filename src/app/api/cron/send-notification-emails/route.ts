import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { runWithConcurrency } from "@/lib/concurrency";

// 이메일 알림(하루 1회 다이제스트) — Kick·좋아요·댓글은 즉시 메일이 따로 나가고(0071/0074),
// 여기선 나머지(노크/신청/메시지/PEAK)와 즉시 메일의 묶음·상한에 걸린 좋아요·댓글만 모은다.
// 원래 설명: Vercel Hobby 플랜 크론이 하루 1회로만 제한돼서(모바일
// 앱이 없어 이메일이 유일한 알림 채널인데도) 실시간 발송 대신 이 방식으로 간다. 사용자별
// last_notification_emailed_at(0035) 이후로 생긴 것만 종류별 설정(email_notify_*)에 맞춰
// 세어서 한 통으로 모아 보낸다. Kakao 무이메일 가입자(handle_new_user, 0034)의 자리표시자
// 이메일(@no-email.comp.local)은 실제 메일함이 아니라서 건너뛴다.
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";
const APP_URL = "https://compmusic.kr";

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
      "id, email, email_notify_like, email_notify_comment, email_notify_knock, email_notify_companion_request, email_notify_message, email_notify_peak, email_notify_progress, email_notify_companion_post, last_notification_emailed_at",
    )
    .eq("status", "approved");

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  let sent = 0;

  // 유저마다 최대 7개 쿼리를 하나씩 순차 await 하면(예전 for-loop) 유저 수가 늘수록 함수
  // 실행 시간이 그대로 비례해서 늘어나 타임아웃으로 뒤쪽 유저만 못 받는 사고가 날 수 있다 —
  // 유저 단위로는 병렬 처리하되, 동시성은 제한해서 DB 커넥션이 한 번에 몰리지 않게 한다.
  await runWithConcurrency(users ?? [], 8, async (user) => {
    const cursor = user.last_notification_emailed_at;
    const sections: string[] = [];

    if (!user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
      const { data: myPosts } = await supabase.from("posts").select("id, visibility, peaked_at").eq("user_id", user.id);
      const myInviteOnlyPostIds = (myPosts ?? []).filter((p) => p.visibility === "invite_only").map((p) => p.id);

      // 좋아요·댓글은 0074부터 반응이 생기는 즉시 따로 보낸다(lib/reactionNotify.ts). 여기서는
      // 그때 묶음(같은 게시물 1시간/10분)·하루 상한에 걸려 메일로 못 나간 것만 모아서 보낸다.
      if (user.email_notify_like) {
        const { count } = await supabase
          .from("reaction_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("kind", "like")
          .is("emailed_at", null)
          .gt("created_at", cursor);
        if (count) sections.push(`좋아요 ${count}개`);
      }

      if (user.email_notify_comment) {
        const { count } = await supabase
          .from("reaction_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .in("kind", ["comment", "reply"])
          .is("emailed_at", null)
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

      if (user.email_notify_peak) {
        // PEAK 판정은 posts.peaked_at(0056 — 조회수+좋아요*10>=PEAK_VIEW_THRESHOLD에서 한 번
        // 영구 고정, EngagementMeter/RightSidebar·notificationList.ts와 동일 기준)을 그대로 쓴다.
        const newlyPeakedCount = (myPosts ?? []).filter((p) => p.peaked_at && p.peaked_at > cursor).length;
        if (newlyPeakedCount > 0) sections.push(`PEAK 도달 게시물 ${newlyPeakedCount}개`);
      }

      // 0076 — 새로 들은 사람(post_plays, 5초 이상 재생) 수. 본인 재생은 뺀다.
      const myPostIds = (myPosts ?? []).map((p) => p.id);
      if (user.email_notify_progress && myPostIds.length > 0) {
        const { count } = await supabase
          .from("post_plays")
          .select("post_id", { count: "exact", head: true })
          .in("post_id", myPostIds)
          .neq("user_id", user.id)
          .gt("played_at", cursor);
        if (count) sections.push(`새로 들은 사람 ${count}명`);
      }

      // 0076 — Companion 새 글(invite_only 제외 — 알림 목록 getCompanionPosts와 같은 기준).
      if (user.email_notify_companion_post) {
        const { data: companionRows } = await supabase
          .from("companions")
          .select("requester_id, addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
        const companionIds = (companionRows ?? []).map((r) =>
          r.requester_id === user.id ? r.addressee_id : r.requester_id,
        );
        if (companionIds.length > 0) {
          const { count } = await supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .in("user_id", companionIds)
            .eq("status", "published")
            .in("visibility", ["public", "followers"])
            .gt("published_at", cursor);
          if (count) sections.push(`Companion 새 글 ${count}개`);
        }
      }

      if (sections.length > 0) {
        await sendEmail(
          user.email,
          "Compmusic에 새 알림이 있어요",
          `<p>${sections.join(", ")}이 와있어요.</p><p><a href="${APP_URL}/feed?from=notify">지금 확인하기</a></p>`,
        );
        sent += 1;
      }
    }

    await supabase.from("users").update({ last_notification_emailed_at: now }).eq("id", user.id);
  });

  return NextResponse.json({ checked: users?.length ?? 0, sent });
}
