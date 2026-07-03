"use client";

// INTERACT-02: 텍스트 댓글, 대댓글(1단계만)
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  initialCount,
}: {
  postId: string;
  userId: string;
  initialCount: number;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [count, setCount] = useState(initialCount);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function openPanel() {
    setOpen(true);
    if (loaded) return;

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
    setCount((c) => c + 1);
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
      <button onClick={openPanel} className="flex flex-col items-center gap-1 text-white">
        <span className="text-2xl">💬</span>
        <span className="text-xs">{count}</span>
      </button>

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex max-h-[70vh] flex-col rounded-t-2xl bg-white text-black">
          <div className="flex items-center justify-between border-b p-3">
            <span className="font-medium">댓글 {count}</span>
            <button onClick={() => setOpen(false)}>닫기</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {topLevel.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">첫 댓글을 남겨보세요</p>
            )}
            {topLevel.map((c) => (
              <div key={c.id} className="mb-3">
                <p className="text-sm">
                  <span className="font-medium">{c.authorName}</span> {c.content}
                </p>
                <button
                  onClick={() => setReplyTo({ id: c.id, authorName: c.authorName })}
                  className="text-xs text-gray-400"
                >
                  답글
                </button>
                {(repliesByParent.get(c.id) ?? []).map((r) => (
                  <p key={r.id} className="ml-4 mt-1 text-sm text-gray-700">
                    <span className="font-medium">{r.authorName}</span> {r.content}
                  </p>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            {replyTo && (
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span>{replyTo.authorName}님에게 답글</span>
                <button onClick={() => setReplyTo(null)}>취소</button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="댓글 달기..."
                className="flex-1 rounded border px-3 py-2 text-sm"
              />
              <button
                onClick={submitComment}
                disabled={submitting}
                className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
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
