import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { notifyComment, notifyLike } from "@/lib/reactionNotify";
import { checkPeakProgress, notifyPlay, notifyPublished } from "@/lib/progressNotify";

// 좋아요/댓글을 저장한 클라이언트가 곧바로 부르는 알림 트리거(0074). 좋아요·댓글 저장 자체는
// 지금처럼 클라이언트→Supabase 직행이고, 여기서는 "방금 내가 한 반응"이 실제로 DB에 있는지
// 서버에서 다시 확인한 뒤에만 보낸다(남의 반응을 사칭하거나 없는 반응으로 알림을 쏠 수 없음).
// 같은 반응을 여러 번 불러도 reaction_notifications unique 인덱스 때문에 한 번만 나간다.
// 0076부터 반응 유도 알림도 같은 입구로 받는다 — play(처음 5초 들음 → 청취자 수·PEAK 진행),
// published(새 글 → Companion·운영자). 각각 post_milestones unique로 한 번씩만 나간다.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!(await checkRateLimit("notify_reaction", user.id, 60, 60))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    kind?: string;
    postId?: string;
    commentId?: string;
  };

  try {
    if (body.kind === "like" && body.postId) {
      await notifyLike(user.id, body.postId);
      await checkPeakProgress(body.postId);
    } else if (body.kind === "play" && body.postId) {
      await notifyPlay(user.id, body.postId);
    } else if (body.kind === "published" && body.postId) {
      await notifyPublished(user.id, body.postId);
    } else if (body.kind === "comment" && body.commentId) {
      await notifyComment(user.id, body.commentId);
    } else {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }
  } catch (err) {
    // 알림 실패가 반응 자체의 실패처럼 보이면 안 된다(이미 DB에 저장됨) — 로그만.
    console.error("[notify/reaction]", err);
  }
  return NextResponse.json({ ok: true });
}
