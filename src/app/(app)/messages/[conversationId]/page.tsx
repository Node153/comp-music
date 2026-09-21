import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { presenceStatus } from "@/lib/presence";
import { Avatar } from "@/components/Avatar";
import { MarkMessagesRead } from "./MarkMessagesRead";
import { ConversationView } from "./ConversationView";

// S13 DM 대화창 (DM-01, DM-03)
// 게시물에서 시작된 DM은 첫 메시지의 source_post_id를 대화 상단에 고정 노출
const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;
// 대화가 쌓일수록 열 때마다 전체 이력을 매번 다시 읽어오던 걸 막기 위해 최근 메시지만 가져온다
// (오래된 메시지를 스크롤로 더 불러오는 기능은 아직 없음 — 우선 무제한 조회부터 막는 범위).
const MESSAGE_PAGE_SIZE = 100;

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversationId: string }>;
  searchParams: Promise<{ sourcePostId?: string }>;
}) {
  const { conversationId } = await params;
  const { sourcePostId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (!currentUser) redirect("/login");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, user_a_id, user_b_id")
    .eq("id", conversationId)
    .single();
  if (!conversation) notFound();

  const otherUserId =
    conversation.user_a_id === currentUser.id ? conversation.user_b_id : conversation.user_a_id;
  // 이름은 user_display 뷰(0018) — Companion이면 실명, 아니면 닉네임.
  // 온라인 상태(last_seen_at)는 실명 공개 정책과 무관해서 users에서 따로 조회(RightSidebar와 동일).
  const [{ data: otherUserRow }, { data: presenceRow }] = await Promise.all([
    supabase.from("user_display").select("display_name").eq("id", otherUserId).single(),
    supabase.from("users").select("last_seen_at").eq("id", otherUserId).maybeSingle(),
  ]);
  const otherUser = otherUserRow ? { name: otherUserRow.display_name } : null;
  const otherUserStatus = presenceStatus(presenceRow?.last_seen_at ?? null);

  // 핀 배너는 "게시물에서 시작된 대화"의 첫 메시지 하나만 있으면 되므로, 표시할 메시지
  // 목록(최근 것만)과 별도로 가볍게 따로 조회한다 — 그래야 최근 메시지만 가져와도 오래된
  // 대화의 핀 배너가 사라지지 않는다.
  const [{ data: recentMessages }, { data: pinnedSourceRow }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, content, created_at, read_at, source_post_id")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE),
    supabase
      .from("messages")
      .select("source_post_id")
      .eq("conversation_id", conversationId)
      .not("source_post_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const messages = (recentMessages ?? []).slice().reverse();
  const pinnedPostId = pinnedSourceRow?.source_post_id ?? null;
  let pinnedPost: {
    videoSrc: string | null;
    caption: string | null;
    isImage: boolean;
    isAudio: boolean;
  } | null = null;
  if (pinnedPostId) {
    const { data: post } = await supabase
      .from("posts")
      .select("video_url, image_url, audio_url, media_type, caption")
      .eq("id", pinnedPostId)
      .maybeSingle();
    if (post) {
      const mediaPath = post.video_url ?? post.image_url ?? post.audio_url ?? "";
      const videoSrc = mediaPath ? await getR2SignedUrl(mediaPath, SIGNED_URL_EXPIRY_SECONDS) : null;
      pinnedPost = {
        videoSrc,
        caption: post.caption,
        isImage: post.media_type === "image",
        isAudio: post.media_type === "audio",
      };
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[600px] flex-col bg-main-gray p-6 md:my-6 md:h-[70vh] md:rounded-lg">
      <MarkMessagesRead conversationId={conversationId} />
      <div className="flex items-center gap-3 pb-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <Avatar userId={otherUserId} name={otherUser?.name ?? "?"} className="h-9 w-9 text-sm" />
          {otherUserStatus !== "offline" && (
            <span
              className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-box-gray ${
                otherUserStatus === "online" ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          )}
        </span>
        <div className="flex flex-col">
          <h1 className="text-base font-semibold text-black">{otherUser?.name ?? "알 수 없음"}</h1>
          {otherUserStatus !== "offline" && (
            <span className="text-xs text-active-gray">
              {otherUserStatus === "online" ? "온라인" : "자리 비움"}
            </span>
          )}
        </div>
      </div>

      {pinnedPost?.videoSrc && (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-box-gray p-2">
          {pinnedPost.isImage ? (
            <img src={pinnedPost.videoSrc} alt="" className="h-14 w-8 rounded-lg object-cover" />
          ) : pinnedPost.isAudio ? (
            <div className="flex h-14 w-8 shrink-0 items-center justify-center rounded-lg bg-main-gray text-sm">
              🎵
            </div>
          ) : (
            <video src={pinnedPost.videoSrc} muted className="h-14 w-8 rounded-lg object-cover" />
          )}
          <span className="truncate text-xs text-active-gray">
            {pinnedPost.caption ?? "게시물에서 시작된 대화"}
          </span>
        </div>
      )}

      <ConversationView
        conversationId={conversationId}
        currentUserId={currentUser.id}
        otherUserId={otherUserId}
        otherUserName={otherUser?.name ?? "알 수 없음"}
        initialMessages={messages ?? []}
        initialSourcePostId={sourcePostId ?? null}
      />
    </main>
  );
}
