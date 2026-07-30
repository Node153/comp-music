"use client";

// Complex "특정인 초대" 게시물의 노크(열람 요청) 흐름.
// - 초대 안 된 사람에게는 존재(헤더/캡션/태그)는 보이되 미디어+채팅은 락으로 가려지고, 노크 버튼만 노출.
// - 노크하면 "요청 보냄" 상태로 바뀌고(연타 방지), 게시물 카드 안의 "노크 요청 N개" 펼치기에 반영된다.
// - "노크 요청" 펼치기(수락/거절)는 isOwnPost(작성자 본인)일 때만 보임. 현재 mock 게시물 3개는
//   user_id가 가짜 문자열이라 실제 로그인 계정과 절대 일치하지 않으므로, 어떤 계정으로 로그인해도
//   이 mock 게시물들에서는 이 섹션이 보이지 않는다 — 의도된 동작. 작성자 시점 수락/거절 데모는
//   실제 로그인 사용자를 작성자로 다루는 mock 시나리오가 생기면 별도로 다룬다.
// 전부 로컬 state — 새로고침하면 초기화되고 실제 DB 연동은 없음.
import { useState } from "react";
import { TimeLimitBadge } from "@/components/TimeLimitBadge";
import { ComplexPostChat } from "@/components/ComplexPostChat";
import { tagColorClass } from "@/lib/feedConstants";

// 이 데모에서 "나"를 가리키는 이름 — ComplexPostChat의 isMe 패턴과 동일한 방식.
const ME = "나";

export function ComplexAccessGate({
  postId,
  authorName,
  isOwnPost,
  expiresAt,
  initialInvitedNames,
  initialPendingNames,
  gradient,
  emoji,
  contentTypeLabel,
  tags,
  collabAvailable,
  collabRoleNeeded,
}: {
  postId: string;
  authorName: string;
  isOwnPost: boolean;
  expiresAt: string | null;
  initialInvitedNames: string[];
  initialPendingNames: string[];
  gradient: string;
  emoji: string;
  contentTypeLabel: string | null;
  tags: string[];
  collabAvailable: boolean;
  collabRoleNeeded: string | null;
}) {
  const [invited, setInvited] = useState<string[]>(initialInvitedNames);
  const [pending, setPending] = useState<string[]>(initialPendingNames);
  const [knocked, setKnocked] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);

  // 작성자는 초대 목록 소속 여부와 무관하게 항상 자기 게시물을 볼 수 있어야 한다 — isOwnPost로 우회.
  const iAmInvited = invited.includes(ME) || isOwnPost;

  // 락 걸린 상태(미초대)에서 보여줄 대표자+인원수 표기. 대표자는 invitedNames의 첫 번째 사람으로
  // 고정 — 보는 사람이 누구든 항상 같은 사람이 대표로 뜬다. "내가 팔로우하는 사람을 대표로 보여주기"
  // 같은 동적 매칭은 실제 팔로우 데이터 연동 단계(Phase 1)에서 다룰 예정.
  const [representative, ...otherInvited] = invited;
  const inviteSummary = representative
    ? otherInvited.length > 0
      ? `${representative} 외 ${otherInvited.length}명에게만 공개된 게시물`
      : `${representative}에게만 공개된 게시물`
    : "특정 인원에게만 공개된 게시물";

  function knock() {
    if (knocked || iAmInvited) return;
    setKnocked(true);
    setPending((prev) => [...prev, ME]);
  }

  function accept(name: string) {
    setPending((prev) => prev.filter((n) => n !== name));
    setInvited((prev) => [...prev, name]);
    if (name === ME) setKnocked(false);
  }

  function reject(name: string) {
    setPending((prev) => prev.filter((n) => n !== name));
    if (name === ME) setKnocked(false); // 거절당하면 다시 노크할 수 있도록 초기화
  }

  return (
    <>
      {iAmInvited ? (
        invited.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
            <span>🔒 초대됨:</span>
            <span className="truncate">{invited.join(", ")}</span>
          </div>
        )
      ) : (
        <div className="flex items-center gap-1.5 px-3 pb-2 text-xs text-violet-500 dark:text-violet-300">
          <span>🔒 {inviteSummary}</span>
        </div>
      )}

      <div className="relative flex items-center justify-center bg-black">
        {expiresAt && (
          <div className="absolute left-3 top-3 z-10">
            <TimeLimitBadge expiresAt={expiresAt} />
          </div>
        )}

        {iAmInvited ? (
          <div
            className={`relative flex h-[420px] w-full items-center justify-center bg-gradient-to-br text-6xl ${gradient}`}
          >
            {emoji}
          </div>
        ) : (
          <div className="flex h-[420px] w-full flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center">
            <span className="text-4xl">🔒</span>
            <p className="max-w-xs text-sm text-gray-300">
              {authorName}님이 특정 인원에게만 공개한 게시물이에요. 노크하면 열람을 요청할 수 있어요.
            </p>
            <button
              type="button"
              onClick={knock}
              disabled={knocked}
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
              {pending.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/40"
                >
                  <span className="font-medium text-gray-700 dark:text-gray-200">{name}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => accept(name)}
                      className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                      수락
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(name)}
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

      {iAmInvited ? (
        <ComplexPostChat
          postId={postId}
          authorName={authorName}
          participants={invited.filter((n) => n !== ME)}
          originalGradient={gradient}
          originalEmoji={emoji}
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
