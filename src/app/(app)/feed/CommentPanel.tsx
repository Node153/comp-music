"use client";

// INTERACT-02: 텍스트 댓글, 대댓글(1단계만) — 페이스북처럼 게시물 카드 안에서 인라인으로 펼침
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostEngagement } from "@/components/PostEngagementContext";

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

  async function togglePanel() {
    const next = !open;
    setOpen(next);
    if (!next || loaded) return;

    const { data: rows } = await supabase
      .from("comments")
      .select("id, user_id, parent_id, content")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: users } =
      userIds.length > 0
        ? await supabase.from("users").select("id, name").in("id", userIds)
        : { data: [] };
    const nameMap = new Map((users ?? []).map((u) => [u.id, u.name]));

    setComments(
      (rows ?? []).map((r) => ({ ...r, authorName: nameMap.get(r.user_id) ?? "알 수 없음" })),
    );
    setLoaded(true);
  }

  async function submitComment() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);

    const { data: inserted, error } = await supabase
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
    if (error || !inserted) return;

    setComments((prev) => [...prev, { ...inserted, authorName: "나" }]);
    setCommentCount((c) => c + 1);
    setText("");
    setReplyTo(null);
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

  return (
    <>
      <button
        onClick={togglePanel}
        className={`flex items-center justify-center gap-2 py-3.5 text-base font-semibold text-gray-600 transition hover:bg-gray-50 ${buttonClassName}`}
      >
        <span className="text-lg">💬</span>
        댓글{commentCount > 0 ? ` ${commentCount}` : ""}
      </button>

      {open && (
        <div className="basis-full border-t border-gray-100 p-3">
          {topLevel.length === 0 && (
            <p className="py-3 text-center text-sm text-gray-400">첫 댓글을 남겨보세요</p>
          )}
          <div className="flex flex-col gap-3">
            {topLevel.map((c) => (
              <div key={c.id} className="flex gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                  {c.authorName.slice(0, 1)}
                </span>
                <div className="flex flex-col gap-1">
                  <div className="rounded-2xl bg-gray-100 px-3 py-2">
                    <p className="text-xs font-semibold text-gray-900">{c.authorName}</p>
                    <p className="text-sm text-gray-800">{c.content}</p>
                  </div>
                  <button
                    onClick={() => setReplyTo({ id: c.id, authorName: c.authorName })}
                    className="w-fit px-3 text-xs font-medium text-gray-500 hover:underline"
                  >
                    답글
                  </button>
                  {(repliesByParent.get(c.id) ?? []).map((r) => (
                    <div key={r.id} className="ml-4 flex gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                        {r.authorName.slice(0, 1)}
                      </span>
                      <div className="rounded-2xl bg-gray-100 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-900">{r.authorName}</p>
                        <p className="text-sm text-gray-800">{r.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

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
