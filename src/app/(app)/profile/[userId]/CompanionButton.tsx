"use client";

// Companion(맞팔 전용, 0017_companions) 신청/수락/해제 버튼 — FollowButton(단방향 팔로우)을 대체.
// 상태 4단계: none(관계 없음) → outgoing(내가 신청, 취소 가능) / incoming(상대가 신청, 수락·거절)
// → companions(성립, 해제 가능). 거절·취소·해제는 전부 행 삭제(상태값 없음 — RLS와 대응).
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CompanionRelation = "none" | "outgoing" | "incoming" | "companions";

export function CompanionButton({
  currentUserId,
  targetUserId,
  initialRelation,
}: {
  currentUserId: string;
  targetUserId: string;
  initialRelation: CompanionRelation;
}) {
  const supabase = createClient();
  const [relation, setRelation] = useState<CompanionRelation>(initialRelation);
  const [pending, setPending] = useState(false);

  // 쌍당 행 하나(무방향 유니크)라 pair 조건으로 지우면 방향과 무관하게 그 관계 행이 지워진다.
  function deletePairRow() {
    return supabase
      .from("companions")
      .delete()
      .or(
        `and(requester_id.eq.${currentUserId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${currentUserId})`,
      );
  }

  async function run(next: CompanionRelation, action: () => PromiseLike<{ error: unknown }>) {
    if (pending) return;
    setPending(true);
    const prev = relation;
    setRelation(next); // optimistic
    const { error } = await action();
    if (error) setRelation(prev); // rollback
    setPending(false);
  }

  const request = () =>
    run("outgoing", () =>
      supabase
        .from("companions")
        .insert({ requester_id: currentUserId, addressee_id: targetUserId, status: "pending" }),
    );
  const cancel = () => run("none", deletePairRow);
  const accept = () =>
    run("companions", () =>
      supabase
        .from("companions")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("requester_id", targetUserId)
        .eq("addressee_id", currentUserId)
        .eq("status", "pending"),
    );
  const decline = () => run("none", deletePairRow);
  const disconnect = () => run("none", deletePairRow);

  const primaryClass =
    "flex-1 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50";
  const secondaryClass =
    "flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 disabled:opacity-50";

  if (relation === "incoming") {
    return (
      <>
        <button onClick={accept} disabled={pending} className={primaryClass}>
          Companion 수락
        </button>
        <button onClick={decline} disabled={pending} className={secondaryClass}>
          거절
        </button>
      </>
    );
  }

  if (relation === "outgoing") {
    return (
      <button onClick={cancel} disabled={pending} className={secondaryClass}>
        신청됨 · 취소
      </button>
    );
  }

  if (relation === "companions") {
    return (
      <button onClick={disconnect} disabled={pending} className={secondaryClass}>
        ✓ Companion · 해제
      </button>
    );
  }

  return (
    <button onClick={request} disabled={pending} className={primaryClass}>
      Companion 신청
    </button>
  );
}
