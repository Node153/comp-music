import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { PEAK_VIEW_THRESHOLD, peakScore } from "@/lib/feedConstants";
import { escapeHtml, postHref, postLabel, reactionEmailHtml } from "@/lib/reactionNotify";

// "반응 자체가 생기게" 하는 알림들(0076) — 좋아요·댓글(reactionNotify.ts)보다 한 단계 가벼운
// 신호로 작성자와 Companion을 다시 불러온다.
//   - 청취자 수 마일스톤: 누군가 5초 이상 들으면(post_plays) 1·3·5·10·25…명째에 작성자에게 푸시
//   - PEAK 진행률: PEAK 점수가 기준의 50%·80%를 넘으면 작성자에게 푸시+메일(공유 유도)
//   - Companion 새 글: 글을 올리면 Companion에게 푸시(첫 반응 유도) + 운영자 Discord
// 전부 post_milestones unique로 게시물당 한 번씩만 나간다.

const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";
const PLAY_MILESTONES = [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000];
const PEAK_PROGRESS_STEPS = [50, 80];
const APP_URL = "https://compmusic.kr";

type Admin = ReturnType<typeof createAdminClient>;

async function claimMilestone(admin: Admin, postId: string, kind: "plays" | "peak_progress" | "published", value: number) {
  const { error } = await admin.from("post_milestones").insert({ post_id: postId, kind, value });
  if (error && error.code !== "23505") console.error("[progress-notify] 마일스톤 기록 실패", error);
  return !error;
}

async function loadPost(admin: Admin, postId: string) {
  const { data } = await admin
    .from("posts")
    .select("id, user_id, title, caption, visibility, status, view_count, peaked_at")
    .eq("id", postId)
    .maybeSingle();
  return data;
}

async function loadAuthorPrefs(admin: Admin, userId: string) {
  const { data } = await admin
    .from("users")
    .select("id, email, status, push_notify_progress, email_notify_progress")
    .eq("id", userId)
    .single();
  return data && data.status === "approved" ? data : null;
}

// 누군가 처음으로 5초 이상 들었을 때(mark_post_played가 true를 돌려준 뒤) 부른다.
export async function notifyPlay(listenerId: string, postId: string) {
  const admin = createAdminClient();
  const [post, { data: play }] = await Promise.all([
    loadPost(admin, postId),
    admin.from("post_plays").select("post_id").eq("post_id", postId).eq("user_id", listenerId).maybeSingle(),
  ]);
  if (!post || !play || post.user_id === listenerId) return;

  const { count } = await admin
    .from("post_plays")
    .select("post_id", { count: "exact", head: true })
    .eq("post_id", postId)
    .neq("user_id", post.user_id);
  const listeners = count ?? 0;
  // 정확히 마일스톤 숫자에 닿았을 때만 — 동시에 여러 명이 들어 숫자를 건너뛰어도 그 구간의
  // 가장 큰 마일스톤 하나는 잡히도록 "넘은 것 중 최대"로 기록한다(이미 기록된 건 unique로 무시).
  const reached = PLAY_MILESTONES.filter((m) => m <= listeners).at(-1);
  if (reached && (await claimMilestone(admin, postId, "plays", reached))) {
    const author = await loadAuthorPrefs(admin, post.user_id);
    if (author?.push_notify_progress) {
      const label = postLabel(post);
      await sendPushToUser(author.id, {
        title: reached === 1 ? "첫 청취자가 생겼어요 🎧" : `${reached}명이 들었어요 🎧`,
        body:
          reached === 1
            ? `누군가 「${label}」을 처음으로 들었어요`
            : `「${label}」을 지금까지 ${reached}명이 들었어요`,
        url: postHref(post),
        tag: `plays:${postId}`,
      });
    }
  }

  await checkPeakProgress(postId);
}

// PEAK 점수(조회수 + 좋아요×10 + Kick×100)가 기준의 50%/80%를 넘었는지 — 좋아요·Kick·재생
// 알림 경로에서 부른다(조회수는 30초 재생 시 클라이언트 RPC로 올라가 따로 훅이 없어서, 재생
// 알림 때 같이 확인한다). DEMO만, 이미 PEAK이면 안 보낸다.
export async function checkPeakProgress(postId: string) {
  const admin = createAdminClient();
  const post = await loadPost(admin, postId);
  if (!post || post.visibility !== "public" || post.peaked_at) return;

  const [{ count: likeCount }, { count: kickCount }] = await Promise.all([
    admin.from("likes").select("id", { count: "exact", head: true }).eq("post_id", postId),
    admin.from("kicks").select("id", { count: "exact", head: true }).eq("post_id", postId),
  ]);
  const percent = Math.floor((peakScore(post.view_count ?? 0, likeCount ?? 0, kickCount ?? 0) / PEAK_VIEW_THRESHOLD) * 100);
  const step = PEAK_PROGRESS_STEPS.filter((s) => s <= percent).at(-1);
  if (!step || percent >= 100) return;
  if (!(await claimMilestone(admin, postId, "peak_progress", step))) return;

  const author = await loadAuthorPrefs(admin, post.user_id);
  if (!author) return;
  const label = postLabel(post);
  const href = postHref(post);
  const headline = `「${label}」이 PEAK까지 ${step}% 왔어요`;

  if (author.push_notify_progress) {
    await sendPushToUser(author.id, {
      title: `PEAK까지 ${step}% 🔥`,
      body: `${headline} — 친구에게 들려주면 더 빨리 닿아요`,
      url: href,
      tag: `peak:${postId}`,
    });
  }
  if (author.email_notify_progress && !author.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) {
    try {
      await sendEmail(
        author.email,
        headline,
        reactionEmailHtml(
          `「${escapeHtml(label)}」이 PEAK까지 <b>${step}%</b> 왔어요. 링크를 친구에게 공유하면 PEAK에 더 빨리 닿을 수 있어요.`,
          href,
        ),
      );
    } catch (err) {
      console.error("[progress-notify] PEAK 진행 메일 실패", err);
    }
  }
}

// 새 글이 올라왔을 때(업로드 화면이 insert 직후 부름) — Companion에게 첫 반응을 부탁하는 푸시.
// invite_only(특정인 초대 memo)는 Companion 전체가 아니라 초대받은 사람에게만.
// Companion은 서로 실명을 보는 사이라(0018) 이름은 users.name을 쓴다.
export async function notifyPublished(authorId: string, postId: string) {
  const admin = createAdminClient();
  const post = await loadPost(admin, postId);
  if (!post || post.user_id !== authorId || post.status !== "published") return;
  if (!(await claimMilestone(admin, postId, "published", 0))) return;

  const { data: author } = await admin.from("users").select("name, nickname").eq("id", authorId).single();
  const authorName = author?.name || author?.nickname || "Companion";
  const label = postLabel(post);
  // 받는 사람(Companion)에겐 남의 글이라 업로드 유도 배너 없이.
  const href = postHref(post, false);
  const isDemo = post.visibility === "public";

  let recipientIds: string[];
  if (post.visibility === "invite_only") {
    const { data: invited } = await admin.from("post_access").select("user_id").eq("post_id", postId);
    recipientIds = (invited ?? []).map((r) => r.user_id);
  } else {
    const { data: rows } = await admin
      .from("companions")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${authorId},addressee_id.eq.${authorId}`);
    recipientIds = (rows ?? []).map((r) => (r.requester_id === authorId ? r.addressee_id : r.requester_id));
  }
  recipientIds = [...new Set(recipientIds)].filter((id) => id !== authorId);

  if (recipientIds.length > 0) {
    const { data: recipients } = await admin
      .from("users")
      .select("id, status, push_notify_companion_post")
      .in("id", recipientIds);
    await Promise.all(
      (recipients ?? [])
        .filter((r) => r.status === "approved" && r.push_notify_companion_post)
        .map((r) =>
          sendPushToUser(r.id, {
            title: isDemo ? `${authorName}님의 새 Drop 🎵` : `${authorName}님의 새 memo`,
            body: `「${label}」 — 첫 반응을 남겨주세요`,
            url: href,
            tag: `post:${postId}`,
          }),
        ),
    );
  }

  if (isDemo) await alertAdminsNewDrop(author?.nickname ?? "회원", label, post.id);
}

// 운영자 첫 반응 보장(파일럿) — 새 DEMO가 올라오면 운영진 Discord로 알려서 2시간 안에 첫 반응을
// 남기게 한다. 전용 웹훅이 없으면 가입 알림용(→ 에러 알림용) 웹훅을 같이 쓴다. 실패해도 무시.
async function alertAdminsNewDrop(nickname: string, label: string, postId: string) {
  const url =
    process.env.DISCORD_NEW_POST_WEBHOOK_URL ||
    process.env.DISCORD_SIGNUP_WEBHOOK_URL ||
    process.env.DISCORD_ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "🎵 새 Drop — 2시간 안에 첫 반응 부탁해요",
            description: `**${nickname}** · 「${label}」\n[게시물 보기](${APP_URL}${postHref({ id: postId, visibility: "public" }, false)}) · [반응 대기 목록](${APP_URL}/admin/awaiting-reactions)`,
            color: 0xf59e0b,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // 알림기는 절대 본 흐름을 깨지 않는다.
  }
}
