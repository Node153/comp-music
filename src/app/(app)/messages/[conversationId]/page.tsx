import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";
import { MarkMessagesRead } from "./MarkMessagesRead";
import { ConversationView } from "./ConversationView";

// S13 DM 대화창 (DM-01, DM-03)
// 게시물에서 시작된 DM은 첫 메시지의 source_post_id를 대화 상단에 고정 노출
const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

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
  const { data: otherUserRow } = await supabase
    .from("user_display")
    .select("display_name")
    .eq("id", otherUserId)
    .single();
  const otherUser = otherUserRow ? { name: otherUserRow.display_name } : null;

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at, source_post_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const pinnedPostId = (messages ?? []).find((m) => m.source_post_id)?.source_post_id ?? null;
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
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-[600px] flex-col bg-white p-6 md:my-6 md:h-[70vh] md:rounded-lg md:border md:border-gray-200 md:shadow-sm">
      <MarkMessagesRead conversationId={conversationId} currentUserId={currentUser.id} />
      <div className="flex items-center gap-3 pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-500">
          {(otherUser?.name ?? "?").slice(0, 1)}
        </span>
        <h1 className="text-base font-semibold text-gray-900">{otherUser?.name ?? "알 수 없음"}</h1>
      </div>

      {pinnedPost?.videoSrc && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-gray-200 p-2">
          {pinnedPost.isImage ? (
            <img src={pinnedPost.videoSrc} alt="" className="h-14 w-8 rounded-lg object-cover" />
          ) : pinnedPost.isAudio ? (
            <div className="flex h-14 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-800 text-sm">
              🎵
            </div>
          ) : (
            <video src={pinnedPost.videoSrc} muted className="h-14 w-8 rounded-lg object-cover" />
          )}
          <span className="truncate text-xs text-gray-500">
            {pinnedPost.caption ?? "게시물에서 시작된 대화"}
          </span>
        </div>
      )}

      <ConversationView
        conversationId={conversationId}
        currentUserId={currentUser.id}
        initialMessages={messages ?? []}
        initialSourcePostId={sourcePostId ?? null}
      />
    </main>
  );
}
