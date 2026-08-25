"use client";

// INTERACT-02: 텍스트 댓글, 대댓글(1단계만) — 페이스북처럼 게시물 카드 안에서 인라인으로 펼침.
// 수정/삭제(0037_comments_update_self)는 본인 댓글에만 가능 — 답글이 달린 최상위 댓글을
// 지우려고 하면 parent_id 외래키 제약(on delete 지정 없음, 기본 NO ACTION)에 걸려 DB가
// 거부한다. 남의 답글을 대신 지우는 건 소유권 침해라 앱에서 대신 지워주지 않고, 그 경우
// 에러를 그대로 안내한다("답글이 있어서 삭제할 수 없어요").
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";
import { Avatar } from "@/components/Avatar";

type CommentRow = {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  authorName: string;
};

export function CommentPanel({
  postId,
  userId,
  buttonClassName = "",
}: {
  postId: string;
  userId: string;
  buttonClassName?: string;
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

  async function togglePanel() {
    const next = !open;
    setOpen(next);
    if (!next || loaded) return;

    const { data: rows } = await supabase
      .from("comments")
      .select("id, user_id, parent_id, content")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    // 이름은 user_display 뷰(0018) — 내가 Companion인 작성자만 실명, 나머지는 닉네임.
    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: users } =
      userIds.length > 0
        ? await supabase.from("user_display").select("id, display_name").in("id", userIds)
        : { data: [] };
    const nameMap = new Map((users ?? []).map((u) => [u.id, u.display_name]));

    setComments(
      (rows ?? []).map((r) => ({ ...r, authorName: nameMap.get(r.user_id) ?? "알 수 없음" })),
    );
    setLoaded(true);
  }

  async function submitComment() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    const { data: inserted, error: insertError } = await supabase
      .from("comments")
      .insert({
        post_id: postId,
        user_id: userId,
        parent_id: replyTo?.id ?? null,
        content: text.trim(),
      })
      .select("id, user_id, parent_id, content")
      .single();

    setSubmitting(false);
    if (insertError || !inserted) return;

    setComments((prev) => [...prev, { ...inserted, authorName: "나" }]);
    setCommentCount((c) => c + 1);
    setText("");
    setReplyTo(null);
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
            className="rounded-full border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
          <p className="text-sm text-gray-800">{c.content}</p>
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
        className={`flex items-center justify-center gap-2 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50 ${buttonClassName}`}
      >
        <span className="text-lg">💬</span>
        {commentCount > 0 ? commentCount : ""}
      </button>

      {open && (
        <div className="basis-full border-t border-gray-100 p-3">
          {topLevel.length === 0 && (
            <p className="py-3 text-center text-sm text-gray-400">첫 댓글을 남겨보세요</p>
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

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-3">
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
                className="flex-1 rounded-full border border-gray-300 px-3.5 py-2 text-sm placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                onClick={submitComment}
                disabled={submitting}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                게시
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
