"use client";

// Complex "특정인 초대"(invite_only) 게시물의 노크(열람 요청) 흐름 — 0012_complex_access_and_chat로
// 실제 DB(post_access) 연동됨(이전엔 전부 로컬 state만 쓰는 mock이었음).
// - 초대 안 된 사람에게는 존재(헤더/캡션/태그)는 보이되 미디어+채팅은 락으로 가려지고, 노크 버튼만 노출.
//   이 "티저" 동작 때문에 posts 행 자체의 RLS는 visibility로 좁히지 않고, 실제 프라이버시 경계는
//   feed/page.tsx가 뷰어별로 미디어 signed URL을 조건부 발급하는 데서 생긴다 — canViewMedia prop이
//   그 결과다.
// - 비초대 방문자에게는 초대자 명단을 보여주지 않는다(초대 안 된 사람에게 초대 목록을 노출할 이유가
//   없음 — 예전 mock의 "대표자 외 N명" 장식 문구는 그래서 뺌).
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { PostVideo } from "@/components/PostVideo";
import { ComplexPostChat, type ChatMessage } from "@/components/ComplexPostChat";
import { tagColorClass } from "@/lib/feedConstants";
import type { MediaType } from "@/types/database";

type PendingRequest = { userId: string; name: string };

export function ComplexAccessGate({
  postId,
  authorName,
  isOwnPost,
  currentUserId,
  currentUserName,
  expiresAt,
  canViewMedia,
  videoSrc,
  posterSrc,
  mediaType,
  invitedNames,
  initialKnocked,
  initialPendingRequests,
  contentTypeLabel,
  tags,
  collabAvailable,
  collabRoleNeeded,
  initialChatMessages,
}: {
  postId: string;
  authorName: string;
  isOwnPost: boolean;
  currentUserId: string;
  currentUserName: string;
  expiresAt: string | null;
  canViewMedia: boolean;
  videoSrc: string | null;
  posterSrc: string | null;
  mediaType: MediaType;
  invitedNames: string[];
  initialKnocked: boolean;
  initialPendingRequests: PendingRequest[];
  contentTypeLabel: string | null;
  tags: string[];
  collabAvailable: boolean;
  collabRoleNeeded: string | null;
  initialChatMessages: ChatMessage[];
}) {
  const supabase = createClient();
  const [knocked, setKnocked] = useState(initialKnocked);
  const [knockPending, setKnockPending] = useState(false);
  const [pending, setPending] = useState<PendingRequest[]>(initialPendingRequests);
  const [requestsOpen, setRequestsOpen] = useState(false);

  async function knock() {
    if (knockPending || knocked) return;
    setKnockPending(true);
    setKnocked(true); // optimistic
    const { error } = await supabase
      .from("post_access")
      .insert({ post_id: postId, user_id: currentUserId, status: "pending" });
    if (error) setKnocked(false); // rollback
    setKnockPending(false);
  }

  async function accept(request: PendingRequest) {
    setPending((prev) => prev.filter((p) => p.userId !== request.userId)); // optimistic
    const { error } = await supabase
      .from("post_access")
      .update({ status: "accepted" })
      .eq("post_id", postId)
      .eq("user_id", request.userId);
    if (error) setPending((prev) => [...prev, request]); // rollback
  }

  async function reject(request: PendingRequest) {
    setPending((prev) => prev.filter((p) => p.userId !== request.userId)); // optimistic
    const { error } = await supabase
      .from("post_access")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", request.userId);
    if (error) setPending((prev) => [...prev, request]); // rollback
  }

  return (
    <>
      {canViewMedia && invitedNames.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
          <span>🔒 초대됨:</span>
          <span className="truncate">{invitedNames.join(", ")}</span>
        </div>
      )}
      {!canViewMedia && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
          <span>🔒 특정 인원에게만 공개된 게시물</span>
        </div>
      )}

      <div className="relative flex items-center justify-center bg-black">
        {expiresAt && (
          <div className="absolute left-3 top-3 z-10">
            <TimeLimitBadge expiresAt={expiresAt} />
          </div>
        )}

        {canViewMedia ? (
          mediaType === "image" && videoSrc ? (
            <img src={videoSrc} alt="" className="max-h-[780px] w-auto object-contain" />
          ) : mediaType === "audio" && videoSrc ? (
            <div className="flex w-full flex-col items-center gap-3 p-4">
              {posterSrc ? (
                <img src={posterSrc} alt="" className="max-h-[420px] w-auto rounded-xl object-contain" />
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-xl bg-gray-800 text-5xl">
                  🎵
                </div>
              )}
              <audio src={videoSrc} controls className="w-full max-w-md" />
            </div>
          ) : videoSrc ? (
            <PostVideo
              postId={postId}
              title={contentTypeLabel ?? "영상"}
              author={authorName}
              videoSrc={videoSrc}
              posterSrc={posterSrc}
            />
          ) : (
            <p className="py-24 text-sm text-gray-400">미디어를 불러올 수 없습니다</p>
          )
        ) : (
          <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center">
            <span className="text-4xl">🔒</span>
            <p className="max-w-xs text-sm text-gray-300">
              {authorName}님이 특정 인원에게만 공개한 게시물이에요. 노크하면 열람을 요청할 수 있어요.
            </p>
            <button
              type="button"
              onClick={knock}
              disabled={knocked || knockPending}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                knocked
                  ? "cursor-default bg-gray-700 text-gray-300"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {knocked ? "✅ 요청 보냄" : "🚪 노크해서 열람 요청"}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {contentTypeLabel && (
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            {contentTypeLabel}
          </span>
        )}
        {tags.map((tag) => (
          <span key={tag} className={`rounded-full px-2 py-1 text-xs font-medium ${tagColorClass(tag)}`}>
            #{tag}
          </span>
        ))}
        {collabAvailable && (
          <span className="rounded-full bg-black px-2 py-1 text-xs font-medium text-white dark:bg-white dark:text-black">
            🤝 협업 구함{collabRoleNeeded ? `: ${collabRoleNeeded}` : ""}
          </span>
        )}
      </div>

      {isOwnPost && pending.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setRequestsOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30"
          >
            <span>🚪 노크 요청 {pending.length}개</span>
            <span className="text-xs">{requestsOpen ? "▲" : "▼"}</span>
          </button>
          {requestsOpen && (
            <ul className="flex flex-col gap-1.5 px-4 pb-3">
              {pending.map((request) => (
                <li
                  key={request.userId}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/40"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-200">{request.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => accept(request)}
                      className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      수락
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(request)}
                      className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      거절
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canViewMedia ? (
        <ComplexPostChat
          postId={postId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          originalMediaType={mediaType}
          initialMessages={initialChatMessages}
          collabAvailable={collabAvailable}
        />
      ) : (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          🔒 초대된 인원만 채팅과 작업물을 볼 수 있어요
        </div>
      )}
    </>
  );
}
