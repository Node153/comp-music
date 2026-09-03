"use client";

// DEMO 피드 상단 힐링 멘트 편집기 — feed_hero_messages 테이블 CRUD.
// RLS(feed_hero_messages_*_admin)에서 관리자만 쓸 수 있음이 강제되고, 이 화면 자체는
// middleware(proxy.ts)의 /admin 경로 role=admin 가드로만 보호한다.
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { field, label, errorText, mutedText } from "@/components/ui/styles";

type Row = {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  active: boolean;
};

export function FeedHeroManager({ initial }: { initial: Row[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>(initial);
  const [drafts, setDrafts] = useState<Record<string, Row>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 새 문구 입력
  const [newQ, setNewQ] = useState("");
  const [newA, setNewA] = useState("");
  const [adding, setAdding] = useState(false);

  function draftOf(row: Row): Row {
    return drafts[row.id] ?? row;
  }
  function edit(row: Row, patch: Partial<Row>) {
    setDrafts((d) => ({ ...d, [row.id]: { ...(d[row.id] ?? row), ...patch } }));
  }
  function isDirty(row: Row): boolean {
    const d = drafts[row.id];
    if (!d) return false;
    return (
      d.question !== row.question ||
      d.answer !== row.answer ||
      d.sort_order !== row.sort_order ||
      d.active !== row.active
    );
  }

  async function save(row: Row) {
    const d = draftOf(row);
    if (!d.question.trim() || !d.answer.trim()) {
      setError("질문과 답변을 모두 입력하세요.");
      return;
    }
    setBusyId(row.id);
    setError(null);
    const { error: e } = await supabase
      .from("feed_hero_messages")
      .update({
        question: d.question.trim(),
        answer: d.answer.trim(),
        sort_order: d.sort_order,
        active: d.active,
      })
      .eq("id", row.id);
    setBusyId(null);
    if (e) {
      setError(`저장 실패: ${e.message}`);
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...d } : r)).sort((a, b) => a.sort_order - b.sort_order));
    setDrafts((dd) => {
      const rest = { ...dd };
      delete rest[row.id];
      return rest;
    });
  }

  async function remove(row: Row) {
    if (!confirm(`"${row.question}" 문구를 삭제할까요?`)) return;
    setBusyId(row.id);
    setError(null);
    const { error: e } = await supabase.from("feed_hero_messages").delete().eq("id", row.id);
    setBusyId(null);
    if (e) {
      setError(`삭제 실패: ${e.message}`);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newQ.trim() || !newA.trim() || adding) return;
    setAdding(true);
    setError(null);
    const nextOrder = rows.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;
    const { data, error: err } = await supabase
      .from("feed_hero_messages")
      .insert({ question: newQ.trim(), answer: newA.trim(), sort_order: nextOrder })
      .select("id, question, answer, sort_order, active")
      .single();
    setAdding(false);
    if (err || !data) {
      setError(`추가 실패: ${err?.message ?? "알 수 없는 오류"}`);
      return;
    }
    setRows((rs) => [...rs, data as Row].sort((a, b) => a.sort_order - b.sort_order));
    setNewQ("");
    setNewA("");
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className={errorText}>{error}</p>}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const d = draftOf(row);
          const dirty = isDirty(row);
          const busy = busyId === row.id;
          return (
            <div
              key={row.id}
              className={`flex flex-col gap-2 rounded-xl border p-4 ${
                d.active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-70"
              }`}
            >
              <input
                type="text"
                value={d.question}
                onChange={(e) => edit(row, { question: e.target.value })}
                placeholder="질문 (예: 당신은 어떤 사람인가요?)"
                className={`${field} font-semibold`}
              />
              <textarea
                value={d.answer}
                onChange={(e) => edit(row, { answer: e.target.value })}
                placeholder="답변 (힐링 멘트)"
                rows={2}
                className={field}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className={`${mutedText} flex items-center gap-1.5`}>
                  순서
                  <input
                    type="number"
                    value={d.sort_order}
                    onChange={(e) => edit(row, { sort_order: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className={`${mutedText} flex items-center gap-1.5`}>
                  <input
                    type="checkbox"
                    checked={d.active}
                    onChange={(e) => edit(row, { active: e.target.checked })}
                  />
                  노출
                </label>
                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    disabled={busy}
                    className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                  >
                    삭제
                  </button>
                  <Button
                    type="button"
                    onClick={() => save(row)}
                    disabled={busy || !dirty}
                    className="px-4 py-1.5 text-sm"
                  >
                    {busy ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">등록된 문구가 없습니다</p>
        )}
      </div>

      <form onSubmit={add} className="flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 p-4">
        <span className={label}>새 문구 추가</span>
        <input
          type="text"
          value={newQ}
          onChange={(e) => setNewQ(e.target.value)}
          placeholder="질문"
          className={`${field} font-semibold`}
        />
        <textarea
          value={newA}
          onChange={(e) => setNewA(e.target.value)}
          placeholder="답변 (힐링 멘트)"
          rows={2}
          className={field}
        />
        <Button
          type="submit"
          disabled={adding || !newQ.trim() || !newA.trim()}
          className="self-end px-5"
        >
          {adding ? "추가 중..." : "추가"}
        </Button>
      </form>
    </div>
  );
}
