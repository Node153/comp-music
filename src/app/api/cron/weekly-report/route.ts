import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { runWithConcurrency } from "@/lib/concurrency";
import { currentKickWeekStart, currentWeekStartISO } from "@/lib/feedConstants";
import { escapeHtml } from "@/lib/reactionNotify";

// 월요일 주간 리포트(0077) — "반응 → 다음 업로드" 루프의 주간 리듬. Kick이 충전되는 월요일
// (0시 KST) 아침(vercel.json: 월 00:00 UTC = 09:00 KST)에 지난주(월~일, KST) 내 게시물이 받은
// 좋아요·댓글·Kick·새 청취자 수와 가장 반응 많았던 글, 이번 주 Kick 충전, 새 Drop 올리기를 보낸다.
// 반응이 하나도 없었던 사람에게도 보낸다 — 그 사람이야말로 "이번 주엔 하나 올려볼까요"가 필요하다.
// users.weekly_report_week로 같은 주에 두 번 안 나가게 한다(크론 재시도 대비).
const APP_URL = "https://compmusic.kr";
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";

type Stats = { likes: number; comments: number; kicks: number; listeners: number; posted: number };

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const weekKey = currentKickWeekStart();
  const thisWeekStart = currentWeekStartISO();
  const lastWeekStart = new Date(new Date(thisWeekStart).getTime() - 7 * 24 * 3_600_000).toISOString();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, email_notify_weekly, push_notify_weekly, weekly_report_week")
    .eq("status", "approved");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 커뮤니티 전체 지난주 새 DEMO 수 — "다들 이만큼 올렸어요" 한 줄(모두에게 같은 값).
  const { count: communityDrops } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("published_at", lastWeekStart)
    .lt("published_at", thisWeekStart);

  let emailed = 0;
  let pushed = 0;

  await runWithConcurrency(users ?? [], 8, async (user) => {
    if (user.weekly_report_week === weekKey) return;
    if (!user.email_notify_weekly && !user.push_notify_weekly) return;

    const { data: myPosts } = await supabase.from("posts").select("id, title, caption, published_at").eq("user_id", user.id);
    const ids = (myPosts ?? []).map((p) => p.id);
    const stats: Stats = {
      likes: 0,
      comments: 0,
      kicks: 0,
      listeners: 0,
      posted: (myPosts ?? []).filter((p) => p.published_at && p.published_at >= lastWeekStart && p.published_at < thisWeekStart).length,
    };
    let top: { title: string; reactions: number } | null = null;

    if (ids.length > 0) {
      const [{ data: likes }, { data: comments }, { data: kicks }, { data: plays }] = await Promise.all([
        supabase
          .from("likes")
          .select("post_id")
          .in("post_id", ids)
          .neq("user_id", user.id)
          .gte("created_at", lastWeekStart)
          .lt("created_at", thisWeekStart),
        supabase
          .from("comments")
          .select("post_id")
          .in("post_id", ids)
          .neq("user_id", user.id)
          .gte("created_at", lastWeekStart)
          .lt("created_at", thisWeekStart),
        supabase
          .from("kicks")
          .select("post_id")
          .in("post_id", ids)
          .gte("created_at", lastWeekStart)
          .lt("created_at", thisWeekStart),
        supabase
          .from("post_plays")
          .select("post_id")
          .in("post_id", ids)
          .neq("user_id", user.id)
          .gte("played_at", lastWeekStart)
          .lt("played_at", thisWeekStart),
      ]);
      stats.likes = likes?.length ?? 0;
      stats.comments = comments?.length ?? 0;
      stats.kicks = kicks?.length ?? 0;
      stats.listeners = plays?.length ?? 0;

      const perPost = new Map<string, number>();
      for (const r of [...(likes ?? []), ...(comments ?? []), ...(kicks ?? [])]) {
        perPost.set(r.post_id, (perPost.get(r.post_id) ?? 0) + 1);
      }
      const best = [...perPost.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) {
        const post = myPosts!.find((p) => p.id === best[0]);
        top = { title: post?.title || post?.caption || "회원님의 게시물", reactions: best[1] };
      }
    }

    const reactions = stats.likes + stats.comments + stats.kicks;
    const headline =
      reactions > 0
        ? `지난주 반응 ${reactions}개를 받았어요`
        : stats.listeners > 0
          ? `지난주 ${stats.listeners}명이 회원님 Drop을 들었어요`
          : "이번 주 Kick이 충전됐어요";

    if (user.push_notify_weekly) {
      const ok = await sendPushToUser(user.id, {
        title: `${headline} 🥁`,
        body:
          stats.posted > 0 || reactions > 0
            ? "이번 주 Kick이 충전됐어요 · 반응이 식기 전에 다음 Drop을 올려보세요"
            : "이번 주 Kick이 충전됐어요 · 이번 주엔 습작 하나 올려볼까요?",
        url: "/upload",
        tag: "weekly-report",
        actions: [
          { action: "upload", title: "새 Drop 올리기", url: "/upload" },
          { action: "feed", title: "피드 보기", url: "/feed?from=notify" },
        ],
      });
      if (ok) pushed += 1;
    }

    if (user.email_notify_weekly && !user.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
      try {
        await sendEmail(user.email, `[Compmusic 주간 리포트] ${headline}`, weeklyEmailHtml(stats, top, communityDrops ?? 0));
        emailed += 1;
      } catch (err) {
        console.error("[weekly-report] 메일 실패", err);
      }
    }

    await supabase.from("users").update({ weekly_report_week: weekKey }).eq("id", user.id);
  });

  return NextResponse.json({ checked: users?.length ?? 0, emailed, pushed, week: weekKey });
}

function weeklyEmailHtml(stats: Stats, top: { title: string; reactions: number } | null, communityDrops: number) {
  const reactions = stats.likes + stats.comments + stats.kicks;
  const cell = (label: string, value: number) =>
    `<td style="padding:10px 6px;text-align:center;"><div style="font-size:22px;font-weight:700;">${value}</div><div style="font-size:12px;color:#777;">${label}</div></td>`;
  const statsTable = `<table style="width:100%;border-collapse:collapse;background:#f4f4f5;border-radius:12px;margin:16px 0;"><tr>${cell("좋아요", stats.likes)}${cell("댓글", stats.comments)}${cell("Kick", stats.kicks)}${cell("새 청취자", stats.listeners)}</tr></table>`;
  const topLine = top
    ? `<p>가장 반응이 많았던 글은 「${escapeHtml(top.title)}」(반응 ${top.reactions}개)이에요.</p>`
    : "";
  const nudge =
    reactions > 0
      ? "반응이 이어질 때 다음 작업을 올리면 같은 사람들이 다시 들으러 와요."
      : stats.posted > 0
        ? "아직 반응이 적어도 괜찮아요 — 꾸준히 올리는 사람에게 청취자가 쌓여요."
        : `지난주 커뮤니티에 새 Drop ${communityDrops}개가 올라왔어요. 완성본이 아니어도 괜찮아요, 습작 하나 올려볼까요?`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:480px;">
<p style="font-size:17px;font-weight:700;margin-bottom:4px;">지난주 회원님의 Drop</p>
${statsTable}${topLine}
<p>🥁 <b>이번 주 Kick 1개가 충전됐어요.</b> 마음에 드는 Drop에 주면 PEAK에 크게 가까워져요.</p>
<p style="color:#444;">${nudge}</p>
<p style="margin:20px 0;"><a href="${APP_URL}/upload" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">새 Drop 올리기</a>
&nbsp;<a href="${APP_URL}/feed?from=notify" style="color:#111;">피드 둘러보기 →</a></p>
<p style="margin-top:28px;font-size:12px;color:#999;">주간 리포트는 <a href="${APP_URL}/notifications/settings" style="color:#999;">알림 설정</a>에서 끌 수 있어요.</p>
</div>`;
}
