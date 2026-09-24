import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";

// 반응(좋아요·댓글·답글) 즉시 알림(0074) — 이메일 + 웹 푸시.
//
// 원래 좋아요·댓글은 하루 1회 다이제스트(기본 꺼짐)라 반응을 받아도 모르는 게 보통이었다.
// "반응 → 알림 → 재방문 → 다음 업로드" 루프를 살리려고 반응이 생기는 즉시 보낸다.
// - 푸시: 반응 하나마다 바로(같은 게시물 알림은 tag로 기기에서 하나로 교체됨).
// - 메일: 메일함이 시끄러워지지 않게 묶는다 — 같은 게시물 좋아요는 1시간에 한 통, 댓글은
//   10분에 한 통, 받는 사람당 24시간 최대 10통. 묶음/상한에 걸려 안 나간 건 emailed_at이
//   null로 남고, 하루 1회 다이제스트(api/cron/send-notification-emails)가 모아서 보낸다.
// 중복 방지는 reaction_notifications의 unique 인덱스가 한다(좋아요는 같은 사람·같은 게시물
// 평생 1번 — 좋아요를 껐다 켰다 해도 알림은 한 번).

const APP_URL = "https://compmusic.kr";
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";
const LIKE_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const COMMENT_EMAIL_WINDOW_MS = 10 * 60 * 1000;
const DAILY_EMAIL_CAP = 10;

type Admin = ReturnType<typeof createAdminClient>;
type Kind = "like" | "comment" | "reply";

export type PostInfo = { id: string; user_id: string; title: string | null; caption: string | null; visibility: string };

export function postHref(post: Pick<PostInfo, "id" | "visibility">) {
  return `/feed?feed=${post.visibility === "public" ? "completion" : "complex"}#${post.id}`;
}

export function postLabel(post: PostInfo) {
  const raw = (post.title || post.caption || "회원님의 게시물").trim();
  return raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// 알림 메일 공통 틀 — 게시물로 바로 가는 버튼 + 다음 업로드(Drop) 유도 링크를 항상 같이 넣는다.
export function reactionEmailHtml(message: string, href: string, quote?: string) {
  const quoteBlock = quote
    ? `<p style="margin:12px 0;padding:10px 14px;background:#f4f4f5;border-radius:10px;color:#333;">${escapeHtml(quote)}</p>`
    : "";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:480px;">
<p>${message}</p>${quoteBlock}
<p style="margin:20px 0;"><a href="${APP_URL}${href}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">게시물 보러 가기</a></p>
<p style="color:#555;">반응이 올 때가 다음 작업을 올리기 좋은 타이밍이에요. <a href="${APP_URL}/upload" style="color:#111;">새 Drop 올리기 →</a></p>
<p style="margin-top:28px;font-size:12px;color:#999;">알림은 <a href="${APP_URL}/notifications/settings" style="color:#999;">알림 설정</a>에서 종류별로 끌 수 있어요.</p>
</div>`;
}

async function recentEmailCount(admin: Admin, recipientId: string) {
  // 묶음 메일은 여러 행에 같은 emailed_at을 찍으므로, 행 수가 아니라 서로 다른 발송 시각 수로 센다.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("reaction_notifications")
    .select("emailed_at")
    .eq("recipient_id", recipientId)
    .gt("emailed_at", since)
    .limit(500);
  return new Set((data ?? []).map((r) => r.emailed_at)).size;
}

async function lastEmailedAt(admin: Admin, recipientId: string, postId: string, kinds: Kind[]) {
  const { data } = await admin
    .from("reaction_notifications")
    .select("emailed_at")
    .eq("recipient_id", recipientId)
    .eq("post_id", postId)
    .in("kind", kinds)
    .not("emailed_at", "is", null)
    .order("emailed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.emailed_at ? new Date(data.emailed_at).getTime() : 0;
}

type Recipient = {
  id: string;
  email: string;
  status: string;
  email_notify_like: boolean;
  email_notify_comment: boolean;
  push_notify_like: boolean;
  push_notify_comment: boolean;
};

async function loadRecipient(admin: Admin, userId: string): Promise<Recipient | null> {
  const { data } = await admin
    .from("users")
    .select("id, email, status, email_notify_like, email_notify_comment, push_notify_like, push_notify_comment")
    .eq("id", userId)
    .single();
  return data && data.status === "approved" ? data : null;
}

// 기록 행을 먼저 넣는다 — unique 위반(23505)이면 이미 알린 반응이라 아무것도 안 보낸다.
async function claim(
  admin: Admin,
  row: { recipient_id: string; actor_id: string; post_id: string; kind: Kind; comment_id?: string },
): Promise<string | null> {
  const { data, error } = await admin.from("reaction_notifications").insert(row).select("id").single();
  if (error) {
    if (error.code !== "23505") console.error("[reaction-notify] 기록 실패", error);
    return null;
  }
  return data.id;
}

export async function notifyLike(actorId: string, postId: string) {
  const admin = createAdminClient();
  const [{ data: like }, { data: kick }, { data: post }] = await Promise.all([
    admin.from("likes").select("id").eq("post_id", postId).eq("user_id", actorId).maybeSingle(),
    // Kick하면 좋아요도 자동으로 들어간다(give_kick) — Kick 알림은 /api/kicks가 따로 보낸다.
    admin.from("kicks").select("id").eq("post_id", postId).eq("user_id", actorId).maybeSingle(),
    admin.from("posts").select("id, user_id, title, caption, visibility").eq("id", postId).maybeSingle(),
  ]);
  if (!like || kick || !post || post.user_id === actorId) return;

  const recipient = await loadRecipient(admin, post.user_id);
  if (!recipient) return;
  const rowId = await claim(admin, { recipient_id: recipient.id, actor_id: actorId, post_id: postId, kind: "like" });
  if (!rowId) return;

  const { data: actor } = await admin.from("users").select("nickname").eq("id", actorId).single();
  const actorName = actor?.nickname ?? "누군가";
  const label = postLabel(post);
  const href = postHref(post);

  const { count: totalLikeNotices } = await admin
    .from("reaction_notifications")
    .select("id", { count: "exact", head: true })
    .eq("post_id", postId)
    .eq("kind", "like");
  const isFirst = (totalLikeNotices ?? 0) <= 1;

  const now = new Date().toISOString();
  if (recipient.push_notify_like) {
    const pushed = await sendPushToUser(recipient.id, {
      title: isFirst ? "첫 좋아요가 왔어요 ♥" : "새 좋아요 ♥",
      body: `${actorName}님이 「${label}」을 좋아해요`,
      url: href,
      tag: `like:${postId}`,
    });
    if (pushed) await admin.from("reaction_notifications").update({ pushed_at: now }).eq("id", rowId);
  }

  if (!recipient.email_notify_like || recipient.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return;
  if (Date.now() - (await lastEmailedAt(admin, recipient.id, postId, ["like"])) < LIKE_EMAIL_WINDOW_MS) return;
  if ((await recentEmailCount(admin, recipient.id)) >= DAILY_EMAIL_CAP) return;

  // 아직 메일로 안 알린 이 게시물 좋아요(묶음에 걸려 쌓인 것 포함)를 한 통에 담는다.
  const { data: pending } = await admin
    .from("reaction_notifications")
    .select("id")
    .eq("recipient_id", recipient.id)
    .eq("post_id", postId)
    .eq("kind", "like")
    .is("emailed_at", null);
  const pendingIds = (pending ?? []).map((r) => r.id);
  const others = pendingIds.length - 1;

  const safeName = `<b>${escapeHtml(actorName)}</b>`;
  const subject = isFirst
    ? `「${label}」에 첫 좋아요가 달렸어요`
    : others > 0
      ? `${actorName}님 외 ${others}명이 「${label}」을 좋아해요`
      : `${actorName}님이 「${label}」을 좋아해요`;
  const message = isFirst
    ? `${safeName}님이 「${escapeHtml(label)}」에 첫 좋아요를 눌렀어요.`
    : others > 0
      ? `${safeName}님 외 ${others}명이 「${escapeHtml(label)}」을 좋아해요.`
      : `${safeName}님이 「${escapeHtml(label)}」을 좋아해요.`;

  try {
    await sendEmail(recipient.email, subject, reactionEmailHtml(message, href));
    await admin.from("reaction_notifications").update({ emailed_at: now }).in("id", pendingIds);
  } catch (err) {
    console.error("[reaction-notify] 좋아요 메일 실패", err);
  }
}

export async function notifyComment(actorId: string, commentId: string) {
  const admin = createAdminClient();
  const { data: comment } = await admin
    .from("comments")
    .select("id, post_id, user_id, parent_id, content")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.user_id !== actorId) return;
  const { data: post } = await admin
    .from("posts")
    .select("id, user_id, title, caption, visibility")
    .eq("id", comment.post_id)
    .maybeSingle();
  if (!post) return;

  // 답글이면 원댓글 작성자에게 "답글", 게시물 작성자에게는(원댓글 작성자와 다를 때만) "댓글".
  const targets: { userId: string; kind: Kind }[] = [];
  if (comment.parent_id) {
    const { data: parent } = await admin.from("comments").select("user_id").eq("id", comment.parent_id).maybeSingle();
    if (parent && parent.user_id !== actorId) targets.push({ userId: parent.user_id, kind: "reply" });
  }
  if (post.user_id !== actorId && !targets.some((t) => t.userId === post.user_id)) {
    targets.push({ userId: post.user_id, kind: "comment" });
  }
  if (targets.length === 0) return;

  const { data: actor } = await admin.from("users").select("nickname").eq("id", actorId).single();
  const actorName = actor?.nickname ?? "누군가";
  const label = postLabel(post);
  const href = postHref(post);
  const preview = comment.content.length > 120 ? `${comment.content.slice(0, 120)}…` : comment.content;

  await Promise.all(
    targets.map(async ({ userId, kind }) => {
      const recipient = await loadRecipient(admin, userId);
      if (!recipient) return;
      const rowId = await claim(admin, {
        recipient_id: recipient.id,
        actor_id: actorId,
        post_id: post.id,
        kind,
        comment_id: comment.id,
      });
      if (!rowId) return;

      const headline =
        kind === "reply"
          ? `${actorName}님이 회원님 댓글에 답글을 달았어요`
          : `${actorName}님이 「${label}」에 댓글을 남겼어요`;
      const now = new Date().toISOString();

      if (recipient.push_notify_comment) {
        const pushed = await sendPushToUser(recipient.id, {
          title: headline,
          body: preview,
          url: href,
          tag: `comment:${post.id}`,
        });
        if (pushed) await admin.from("reaction_notifications").update({ pushed_at: now }).eq("id", rowId);
      }

      if (!recipient.email_notify_comment || recipient.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return;
      const last = await lastEmailedAt(admin, recipient.id, post.id, ["comment", "reply"]);
      if (Date.now() - last < COMMENT_EMAIL_WINDOW_MS) return;
      if ((await recentEmailCount(admin, recipient.id)) >= DAILY_EMAIL_CAP) return;

      const { data: pending } = await admin
        .from("reaction_notifications")
        .select("id")
        .eq("recipient_id", recipient.id)
        .eq("post_id", post.id)
        .in("kind", ["comment", "reply"])
        .is("emailed_at", null);
      const pendingIds = (pending ?? []).map((r) => r.id);
      const others = pendingIds.length - 1;
      const safeHeadline =
        kind === "reply"
          ? `<b>${escapeHtml(actorName)}</b>님이 「${escapeHtml(label)}」의 회원님 댓글에 답글을 달았어요.`
          : `<b>${escapeHtml(actorName)}</b>님이 「${escapeHtml(label)}」에 댓글을 남겼어요.`;
      const message = others > 0 ? `${safeHeadline} (그 사이 댓글 ${others}개가 더 달렸어요)` : safeHeadline;

      try {
        await sendEmail(recipient.email, headline, reactionEmailHtml(message, href, preview));
        await admin.from("reaction_notifications").update({ emailed_at: now }).in("id", pendingIds);
      } catch (err) {
        console.error("[reaction-notify] 댓글 메일 실패", err);
      }
    }),
  );
}
