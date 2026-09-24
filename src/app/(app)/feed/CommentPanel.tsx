"use client";

// INTERACT-02: 텍스트 댓글, 대댓글(1단계만) — 페이스북처럼 게시물 카드 안에서 인라인으로 펼침.
// 수정/삭제(0037_comments_update_self)는 본인 댓글에만 가능 — 답글이 달린 최상위 댓글을
// 지우려고 하면 parent_id 외래키 제약(on delete 지정 없음, 기본 NO ACTION)에 걸려 DB가
// 거부한다. 남의 답글을 대신 지우는 건 소유권 침해라 앱에서 대신 지워주지 않고, 그 경우
// 에러를 그대로 안내한다("답글이 있어서 삭제할 수 없어요").
// 0076 — 반응 문턱 낮추기: 댓글 쓰기가 부담스러운 사람을 위한 음악 특화 원탭 반응(QUICK_REACTIONS,
// 누르면 그 문구로 바로 댓글 등록 → 작성자 알림도 댓글과 똑같이 감)과, 지금 이 게시물을 듣는
// 중이면 재생 위치를 붙여 남기는 "0:42 여기 좋다" 댓글(comments.timestamp_sec). 댓글의 시간
// 칩을 누르면 그 위치로 이동한다(이 게시물이 재생 중일 때).
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { Avatar } from "@/components/Avatar";
import { CommentIcon, XIcon } from "@/components/icons";
import { notifyReaction } from "@/lib/notifyReaction";
import { useNowPlaying } from "@/components/NowPlayingContext";

const QUICK_REACTIONS = [
  "🔥 사운드 좋아요",
  "🎹 편곡 좋아요",
  "🎧 믹스 깔끔해요",
  "🎤 톤 좋아요",
  "🔁 계속 듣게 돼요",
  "🤝 같이 작업하고 싶어요",
];

function formatTimestamp(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

type CommentRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  timestamp_sec: number | null;
  authorName: string;
};

export function CommentPanel({
  postId,
  userId,
  buttonClassName = "",
  isDemo = false,
  isOwnPost = false,
}: {
  postId: string;
  userId: string;
  buttonClassName?: string;
  // 내 글엔 원탭 반응(칭찬 프리셋)을 안 보여준다.
  isOwnPost?: boolean;
  // demo(공개 피드)의 댓글은 누구나 보는 공간이라 작성자가 나와 Companion이어도 닉네임만
  // 보여준다(사용자 요청) — memo(기본값)는 그대로 user_display(0018)로 실명/닉네임을 가른다.
  isDemo?: boolean;
}) {
  const supabase = createClient();
  const { commentCount, setCommentCount } = usePostEngagement();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { track, videoRef, isPlaying } = useNowPlaying();
  const playingThis = track?.id === postId;
  const [attachTime, setAttachTime] = useState(false);
  const [nowSec, setNowSec] = useState(0);

  // 패널이 열려 있고 이 게시물이 재생 중일 때만 "지금 위치" 표시를 1초마다 갱신한다.
  useEffect(() => {
    if (!open || !playingThis) return;
    const tick = () => setNowSec(Math.floor(videoRef.current?.currentTime ?? 0));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, playingThis, videoRef]);

  function seekTo(sec: number) {
    const video = videoRef.current;
    if (!playingThis || !video) return;
    video.currentTime = sec;
    if (video.paused) video.play().catch(() => {});
  }

  async function togglePanel() {
    const next = !open;
    setOpen(next);
    if (!next || loaded) return;

    const { data: rows } = await supabase
      .from("comments")
      .select("id, user_id, parent_id, content, timestamp_sec")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    // 이름은 user_display 뷰(0018) — 내가 Companion인 작성자만 실명, 나머지는 닉네임.
    // demo는 예외 — public_post_authors(0024, 닉네임만)를 써서 Companion이어도 닉네임만 보여준다.
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: users } =
      userIds.length > 0
        ? await supabase
            .from(isDemo ? "public_post_authors" : "user_display")
            .select("id, display_name")
            .in("id", userIds)
        : { data: [] };
    const nameMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

    setComments(
      (rows ?? []).map((r) => ({ ...r, authorName: nameMap.get(r.user_id) ?? "알 수 없음" })),
    );
    setLoaded(true);
  }

  // preset이 있으면 원탭 반응 — 입력창 내용과 무관하게 그 문구로 바로 등록한다.
  async function submitComment(preset?: string) {
    const content = (preset ?? text).trim();
    if (!content || submitting) return;
    setSubmitting(true);
    const timestampSec =
      attachTime && playingThis ? Math.floor(videoRef.current?.currentTime ?? nowSec) : null;

    const { data: inserted, error: insertError } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: userId,
        parent_id: replyTo?.id ?? null,
        content,
        timestamp_sec: timestampSec,
      })
      .select("id, user_id, parent_id, content, timestamp_sec")
      .single();

    setSubmitting(false);
    if (insertError || !inserted) return;
    notifyReaction({ kind: "comment", commentId: inserted.id });

    setComments((prev) => [...prev, { ...inserted, authorName: "나" }]);
    setCommentCount((c) => c + 1);
    if (!preset) setText("");
    setReplyTo(null);
    setAttachTime(false);
  }

  function startEdit(c: CommentRow) {
    setError(null);
    setEditingId(c.id);
    setEditText(c.content);
  }

  async function saveEdit() {
    if (!editingId || !editText.trim()) return;
    const { error: updateError } = await supabase
      .from("comments")
      .update({ content: editText.trim() })
      .eq("id", editingId);
    if (updateError) {
      setError("수정에 실패했어요.");
      return;
    }
    setComments((prev) =>
      prev.map((c) => (c.id === editingId ? { ...c, content: editText.trim() } : c)),
    );
    setEditingId(null);
  }

  async function deleteComment(c: CommentRow) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    setError(null);
    const { error: deleteError } = await supabase.from("comments").delete().eq("id", c.id);
    if (deleteError) {
      setError("답글이 있어서 삭제할 수 없어요. 답글을 먼저 지워달라고 해주세요.");
      return;
    }
    setComments((prev) => prev.filter((x) => x.id !== c.id));
    setCommentCount((n) => Math.max(0, n - 1));
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const list = repliesByParent.get(c.parent_id) ?? [];
      list.push(c);
      repliesByParent.set(c.parent_id, list);
    }
  }

  function renderBubble(c: CommentRow) {
    const isMine = c.user_id === userId;
    if (editingId === c.id) {
      return (
        <div className="flex flex-col gap-1">
          <input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            autoFocus
            className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
          />
          <div className="flex gap-2 px-1 text-xs font-medium text-gray-500">
            <button onClick={saveEdit} className="hover:underline">
              저장
            </button>
            <button onClick={() => setEditingId(null)} className="hover:underline">
              취소
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="rounded-2xl bg-gray-100 px-3 py-2">
          <p className="text-xs font-semibold text-gray-900">{c.authorName}</p>
          <p className="text-sm text-gray-800">
            {c.timestamp_sec !== null && (
              <button
                type="button"
                onClick={() => seekTo(c.timestamp_sec!)}
                disabled={!playingThis}
                title={playingThis ? "이 위치로 이동" : "이 게시물을 재생하면 이 위치로 이동할 수 있어요"}
                className="mr-1.5 inline-flex items-center rounded-full bg-gray-900 px-1.5 py-0.5 align-middle text-[11px] font-semibold tabular-nums text-white transition enabled:hover:opacity-80 disabled:opacity-60"
              >
                {formatTimestamp(c.timestamp_sec)}
              </button>
            )}
            {c.content}
          </p>
        </div>
        <div className="flex gap-2 px-1 text-xs font-medium text-gray-500">
          {c.parent_id === null && (
            <button
              onClick={() => setReplyTo({ id: c.id, authorName: c.authorName })}
              className="hover:underline"
            >
              답글
            </button>
          )}
          {isMine && (
            <>
              <button onClick={() => startEdit(c)} className="hover:underline">
                수정
              </button>
              <button onClick={() => deleteComment(c)} className="hover:underline">
                삭제
              </button>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <button
        onClick={togglePanel}
        className={`inline-flex items-center gap-1 text-base font-semibold text-gray-600 transition hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 ${buttonClassName}`}
      >
        <CommentIcon className="h-5 w-5" />
        {commentCount > 0 ? commentCount : ""}
      </button>

      {/* 페이스북처럼 팝업으로 열어야 댓글이 많이 쌓여도 그 안에서만 스크롤된다(사용자 요청,
          배경 블러는 불필요 — 어둡게만). 인라인으로 카드 안에 펼치면 피드 전체가 밀려 내려가고
          한 화면 스냅 레이아웃과도 안 맞았다. */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl md:h-auto md:max-h-[80vh] md:rounded-2xl dark:bg-gray-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">댓글</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {topLevel.length === 0 && (
                <p className="py-3 text-center text-sm text-gray-400">
                  {isOwnPost ? "아직 댓글이 없어요" : "첫 반응을 남겨보세요 — 아래 버튼 한 번이면 돼요"}
                </p>
              )}
              <div className="flex flex-col gap-3">
                {topLevel.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar userId={c.user_id} name={c.authorName} className="h-8 w-8 text-xs" />
                    <div className="flex flex-col gap-1">
                      {renderBubble(c)}
                      {(repliesByParent.get(c.id) ?? []).map((r) => (
                        <div key={r.id} className="ml-4 flex gap-2">
                          <Avatar userId={r.user_id} name={r.authorName} className="h-7 w-7 text-xs" />
                          <div className="flex flex-col gap-1">{renderBubble(r)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800">
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              {!isOwnPost && !replyTo && (
                <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
                  {QUICK_REACTIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => submitComment(preset)}
                      disabled={submitting}
                      className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              )}
              {playingThis && (
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={attachTime}
                    onChange={(e) => setAttachTime(e.target.checked)}
                    className="h-3.5 w-3.5 accent-black"
                  />
                  지금 재생 위치 <span className="font-semibold tabular-nums">{formatTimestamp(nowSec)}</span>를 붙여서
                  남기기{!isPlaying && " (일시정지 중)"}
                </label>
              )}
              {replyTo && (
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>{replyTo.authorName}님에게 답글</span>
                  <button onClick={() => setReplyTo(null)} className="hover:underline">
                    취소
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="댓글 달기..."
                  className="flex-1 rounded-full border border-gray-300 px-3.5 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
                <button
                  onClick={() => submitComment()}
                  disabled={submitting}
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  게시
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
