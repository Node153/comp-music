import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { postHref } from "@/lib/reactionNotify";
import { checkPeakProgress } from "@/lib/progressNotify";

const APP_URL = "https://compmusic.kr";
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";

// give_kick(0071)이 던지는 예외 코드 → 화면 문구. 규칙 검사는 전부 DB 함수가 한다
// (주 1회·번복 불가·본인 글 불가·DEMO 전용) — 여기는 호출과 알림 메일만 맡는다.
const KICK_ERROR_MESSAGE: Record<string, string> = {
  not_allowed: "Kick은 승인된 회원만 줄 수 있어요",
  post_not_kickable: "Kick은 DEMO 게시물에만 줄 수 있어요",
  own_post: "내 게시물에는 Kick할 수 없어요",
  already_kicked: "이미 Kick한 게시물이에요",
  weekly_used: "이번 주 Kick은 이미 사용했어요",
};

// Kick 주기 — 클라이언트에서 RPC를 바로 부르지 않고 이 라우트를 거치는 건, Kick을 받은
// 작성자에게 즉시 메일을 보내야 해서다(RESEND_API_KEY는 서버 전용, 좋아요처럼 하루 1회
// 다이제스트로 모으기엔 드물고 의미가 큰 알림).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요", code: "not_allowed" }, { status: 401 });
  }

  const { postId } = (await request.json().catch(() => ({}))) as { postId?: string };
  if (!postId) {
    return NextResponse.json({ error: "postId required" }, { status: 400 });
  }

  const { error } = await supabase.rpc("give_kick", { pid: postId });
  if (error) {
    const code = Object.keys(KICK_ERROR_MESSAGE).find((key) => error.message.includes(key));
    return NextResponse.json(
      { error: code ? KICK_ERROR_MESSAGE[code] : "Kick을 주지 못했어요. 잠시 후 다시 시도해주세요", code: code ?? null },
      { status: code ? 409 : 500 },
    );
  }

  // 메일 실패가 Kick 자체를 실패로 만들면 안 된다(이미 DB에 기록됨) — 로그만 남긴다.
  try {
    const admin = createAdminClient();
    const { data: post } = await admin
      .from("posts")
      .select("id, user_id, title, caption, visibility")
      .eq("id", postId)
      .single();
    if (post) {
      const [{ data: author }, { data: kicker }] = await Promise.all([
        admin.from("users").select("email, email_notify_kick, push_notify_kick, status").eq("id", post.user_id).single(),
        admin.from("users").select("nickname").eq("id", user.id).single(),
      ]);
      // 웹 푸시(0074) — 메일과 별개로 켜고 끈다.
      if (author && author.status === "approved" && author.push_notify_kick) {
        await sendPushToUser(post.user_id, {
          title: "이번 주 Kick을 받았어요 🥁",
          body: `${kicker?.nickname ?? "누군가"}님이 「${post.title || post.caption || "회원님의 게시물"}」에 Kick을 줬어요`,
          url: postHref(post),
          tag: `kick:${postId}`,
        });
      }
      if (
        author &&
        author.status === "approved" &&
        author.email_notify_kick &&
        !author.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX)
      ) {
        const postTitle = post.title || post.caption || "회원님의 게시물";
        await sendEmail(
          author.email,
          `${kicker?.nickname ?? "누군가"}님이 이번 주 Kick을 회원님 게시물에 줬어요`,
          `<p><b>${escapeHtml(kicker?.nickname ?? "누군가")}</b>님이 일주일에 한 번뿐인 Kick을 「${escapeHtml(postTitle)}」에 줬어요.</p><p><a href="${APP_URL}/feed?feed=completion#${postId}">게시물 보러 가기</a></p>`,
        );
      }
    }
  } catch (err) {
    console.error("[kicks] 알림 메일 발송 실패", err);
  }
  // Kick 1개 = PEAK 점수 100 — PEAK 50%/80% 진행 알림 확인(0076).
  await checkPeakProgress(postId).catch((err) => console.error("[kicks] PEAK 진행 확인 실패", err));

  return NextResponse.json({ ok: true });
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
