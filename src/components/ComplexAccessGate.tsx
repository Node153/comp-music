"use client";

// Complex "특정인 초대"(invite_only) 게시물의 노크(열람 요청) 흐름 — 0012_complex_access_and_chat로
// 실제 DB(post_access) 연동됨(이전엔 전부 로컬 state만 쓰는 mock이었음).
// - 이 컴포넌트가 렌더된다는 것 자체가 이미 뷰어=방장과 Companion(또는 본인)이라는 뜻이다
//   (feed/page.tsx가 그 조건을 만족하는 게시물만 애초에 피드에 포함시킴) — memo는
//   "팔로우한 사람 게시물만 보임"이 특정인 초대에도 그대로 적용되고, 초대 안 된 사람에게는
//   존재 자체를 보여주지 않는다. 노크는 그 안에서 "아직 이 게시물에 초대 안 된 Companion"이
//   미디어/채팅에 대한 접근을 요청하는 더 좁은 두 번째 게이트일 뿐이다.
// - 참여자 요약 문구(participantSummary, 0020)는 서버(feed/page.tsx)가 완성해서 내려준다 —
//   아직 참여자가 아니면(!canViewMedia) "내 Companion 이름 + 외 n명", 이미 참여자면
//   (canViewMedia) 참여자 전원(Companion=실명, 아니면 닉네임)으로 형태가 다르다. 이 조립을
//   서버에서 하는 이유는, 클라이언트 컴포넌트로 넘기는 props는 전부 페이로드에 실리기 때문에
//   "아직 참여 전엔 비Companion 닉네임 감춤" 규칙을 여기(클라이언트)서 흉내만 내면 실제로는
//   새어나간다 — 참여 여부에 맞는 최종 문자열만 받는다.
// - canKnock은 방장과 Companion인가를 그대로 넘겨받는 값 — 위 피드 필터 덕분에 이 컴포넌트가
//   렌더되는 시점엔 사실상 항상 true지만(본인 글 제외), RLS(post_access_insert_knock_self)와
//   같은 조건을 컴포넌트 계약으로도 명시해두는 방어적 prop이다.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PostVideo } from "@/components/PostVideo";
import { SoundbarPlayer } from "@/components/SoundbarPlayer";
import { ComplexPostChat, type ChatMessage } from "@/components/ComplexPostChat";
import type { MediaType } from "@/types/database";

type PendingRequest = { userId: string; name: string };

export function ComplexAccessGate({
  postId,
  authorName,
  isOwnPost,
  currentUserId,
  currentUserName,
  canViewMedia,
  videoSrc,
  posterSrc,
  mediaType,
  invitedNames,
  initialKnocked,
  canKnock,
  participantSummary,
  initialPendingRequests,
  contentTypeLabel,
  collabAvailable,
  collabRoleNeeded,
  initialChatMessages,
}: {
  postId: string;
  authorName: string;
  isOwnPost: boolean;
  currentUserId: string;
  currentUserName: string;
  canViewMedia: boolean;
  videoSrc: string | null;
  posterSrc: string | null;
  mediaType: MediaType;
  invitedNames: string[];
  initialKnocked: boolean;
  // 방장과 내가 Companion인가 — 노크 버튼 활성 조건(서버 RLS가 실제 경계).
  canKnock: boolean;
  // "OO, XX...에게 공개" — 서버에서 이미 완성해 내려주는 참여자 요약 문구(방장 본인에겐 null).
  participantSummary: string | null;
  initialPendingRequests: PendingRequest[];
  contentTypeLabel: string | null;
  collabAvailable: boolean;
  collabRoleNeeded: string | null;
  initialChatMessages: ChatMessage[];
}) {
  const supabase = createClient();
  // 열람 가능한 게시물은 미디어 박스를 안 쓰고 ComplexPostChat의 mediaSlot으로 넘겨서
  // 재창작물 스택 + 실시간 채팅과 나란히 보여준다(feed/page.tsx의 followers 공개 게시물과 동일한 패턴).
  const useInlineChatLayout = canViewMedia && !!videoSrc;
  const inlineMediaEl = useInlineChatLayout
    ? mediaType === "audio" ? (
        <SoundbarPlayer src={videoSrc} title={contentTypeLabel ?? "음원"} posterSrc={posterSrc} />
      ) : mediaType === "image" ? (
        <img src={videoSrc} alt="" className="max-h-[420px] w-auto max-w-full rounded-xl object-contain" />
      ) : (
        <PostVideo
          postId={postId}
          title={contentTypeLabel ?? "영상"}
          author={authorName}
          videoSrc={videoSrc}
          posterSrc={posterSrc}
        />
      )
    : null;
  const [knocked, setKnocked] = useState(initialKnocked);
  const [knockPending, setKnockPending] = useState(false);
  const [pending, setPending] = useState<PendingRequest[]>(initialPendingRequests);
  const [requestsOpen, setRequestsOpen] = useState(false);

  async function knock() {
    if (knockPending || knocked || !canKnock) return;
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
      {/* 방장 본인이 아닌 참여자에게는 위 "초대됨" 대신 참여자 전원 요약을 보여준다
          (서버에서 이미 "OO, XX...에게 공개" 형태로 완성해서 내려옴). */}
      {canViewMedia && !isOwnPost && participantSummary && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
          <span>👥</span>
          <span className="truncate">{participantSummary}</span>
        </div>
      )}
      {!canViewMedia && (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
          <span>🔒 특정 인원에게만 공개된 게시물</span>
        </div>
      )}

      {useInlineChatLayout ? null : (
        <div className="relative flex items-center justify-center bg-black">
          {canViewMedia ? (
            <p className="py-24 text-sm text-gray-400">미디어를 불러올 수 없습니다</p>
          ) : (
            <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center">
              <span className="text-4xl">🔒</span>
              <p className="max-w-xs text-sm text-gray-300">
                {authorName}님이 특정 인원에게만 공개한 게시물이에요.
                {canKnock
                  ? " 노크하면 열람을 요청할 수 있어요."
                  : ` ${authorName}님과 Companion이 되면 노크할 수 있어요.`}
              </p>
              {participantSummary && (
                <p className="max-w-xs text-xs text-gray-400">👥 {participantSummary}</p>
              )}
              {canKnock && (
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
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {contentTypeLabel && (
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-900 dark:text-gray-400">
            {contentTypeLabel}
          </span>
        )}
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
          isOwnPost={isOwnPost}
          initialMessages={initialChatMessages}
          collabAvailable={collabAvailable}
          mediaSlot={inlineMediaEl}
        />
      ) : (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          🔒 초대된 인원만 채팅과 작업물을 볼 수 있어요
        </div>
      )}
    </>
  );
}
