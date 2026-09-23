"use client";

// 피드백 페이지 "내 기여도 + 랭킹"(0069). 단계/뱃지 없이 점수와 순위만 — 약간의 경쟁으로
// 참여를 끌어낸다. 문구는 좋은 소식 위주(1위: "지금 가장 많이 기여하고 있어요", 그 외엔 "한 계단
// 위까지 N점"). 점수를 가진 사람이 3명 미만이면 순위표는 숨긴다(1~2명짜리 랭킹은 썰렁함).
// 랭킹 숨기기를 켜면 목록에서만 빠지고 점수는 계속 쌓인다.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CrownIcon, TrophyIcon } from "@/components/icons";

export type MyContribution = {
  month_points: number;
  month_rank: number | null;
  month_gap: number | null;
  month_leader_gap: number | null;
  month_participants: number;
  total_points: number;
  total_rank: number | null;
  hide_from_ranking: boolean;
};

export type BoardRow = { user_id: string; nickname: string; points: number; rank: number };

const MIN_PARTICIPANTS = 3;
const TOP_N = 5;

const SCORE_RULES = [
  ["내 의견이 반영됨", "+10 (버그 +15)"],
  ["내 의견이 검토 중으로 채택", "+3"],
  ["내 공개 의견이 공감을 받음", "공감 1개당 +1"],
  ["내가 공감한 의견이 반영됨", "+1"],
  ["짧은 설문에 한 줄 남기기", "+1"],
];

function headline(mine: MyContribution): string {
  if (mine.month_points === 0) return "의견 하나가 반영되면 +10점, 바로 랭킹에 올라가요";
  if (mine.month_participants < MIN_PARTICIPANTS || mine.month_rank === null) return "이번 달 랭킹에 올라왔어요!";
  if (mine.month_rank === 1) return "지금 가장 많이 기여하고 있어요";
  if (mine.month_rank <= 3) return `이번 달 기여 ${mine.month_rank}위예요 · 1위까지 ${mine.month_leader_gap}점`;
  return `이번 달 ${mine.month_rank}위 · 한 계단 위까지 ${mine.month_gap}점`;
}

export function ContributionPanel({
  userId,
  mine,
  monthBoard,
  allBoard,
}: {
  userId: string;
  mine: MyContribution;
  monthBoard: BoardRow[];
  allBoard: BoardRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"month" | "all">("month");
  const [hidden, setHidden] = useState(mine.hide_from_ranking);
  const [saving, setSaving] = useState(false);

  const board = tab === "month" ? monthBoard : allBoard;
  const showBoard = board.length >= MIN_PARTICIPANTS;
  const top = board.slice(0, TOP_N);
  const myRow = board.find((r) => r.user_id === userId);
  const myRank = tab === "month" ? mine.month_rank : mine.total_rank;
  const myPoints = tab === "month" ? mine.month_points : mine.total_points;

  async function toggleHidden() {
    if (saving) return;
    setSaving(true);
    const next = !hidden;
    setHidden(next);
    const { error } = await createClient().from("users").update({ hide_from_ranking: next }).eq("id", userId);
    setSaving(false);
    if (error) setHidden(!next);
    else router.refresh();
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-xl bg-box-gray p-4">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-active-gray">
          <TrophyIcon className="h-3.5 w-3.5" /> 내 기여도
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-black">{mine.month_points}</span>
          <span className="text-sm text-active-gray">점 · 이번 달</span>
          <span className="ml-auto text-xs text-active-gray">누적 {mine.total_points}점</span>
        </div>
        <p className="text-sm font-semibold text-black">{headline(mine)}</p>
        <details className="mt-auto text-xs text-active-gray">
          <summary className="cursor-pointer select-none">점수 얻는 법</summary>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {SCORE_RULES.map(([what, pts]) => (
              <li key={what} className="flex justify-between gap-2">
                <span>{what}</span>
                <span className="font-medium tabular-nums text-black">{pts}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-box-gray p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-active-gray">
            <CrownIcon className="h-3.5 w-3.5" /> 기여 랭킹
          </span>
          <div className="flex gap-1">
            {(["month", "all"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                  tab === t ? "bg-black text-white" : "bg-main-gray text-black hover:bg-demo-bg"
                }`}
              >
                {t === "month" ? "이번 달" : "전체"}
              </button>
            ))}
          </div>
        </div>

        {showBoard ? (
          <ol className="flex flex-col gap-1">
            {top.map((r) => {
              const isMe = r.user_id === userId;
              return (
                <li
                  key={r.user_id}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ${
                    isMe ? "bg-black text-white" : "bg-main-gray text-black"
                  }`}
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums">
                    {r.rank === 1 ? <CrownIcon className="mx-auto h-3.5 w-3.5" /> : r.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{isMe ? `${r.nickname} (나)` : r.nickname}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">{r.points}점</span>
                </li>
              );
            })}
            {!myRow?.rank || myRow.rank > TOP_N ? (
              myRank && myPoints > 0 && !hidden ? (
                <li className="flex items-center gap-2.5 rounded-lg bg-black px-2.5 py-1.5 text-sm text-white">
                  <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums">{myRank}</span>
                  <span className="min-w-0 flex-1 truncate">나</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums">{myPoints}점</span>
                </li>
              ) : null
            ) : null}
          </ol>
        ) : (
          <p className="py-4 text-center text-xs text-active-gray">
            참여한 회원이 {MIN_PARTICIPANTS}명 이상 모이면 랭킹이 열려요
          </p>
        )}

        <label className="mt-auto flex items-center gap-1.5 self-end text-[11px] text-active-gray">
          <input type="checkbox" checked={hidden} onChange={toggleHidden} disabled={saving} />
          랭킹에서 내 이름 숨기기
        </label>
      </div>
    </section>
  );
}
