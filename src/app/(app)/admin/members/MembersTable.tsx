"use client";

// 회원 관리 표(컴팩트) — 행 클릭 시 오른쪽 상세 패널(MemberDrawer), 체크박스 선택 시 하단
// 일괄 작업 바(일괄 승인 / 선택 CSV). 데이터는 서버(page.tsx)가 모아서 넘겨주고, 조치 후에는
// router.refresh()로 서버에서 다시 받아 표와 열려있는 패널이 같이 갱신된다(selectedId로만 기억).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { USER_TYPE_LABEL } from "@/lib/adminMembers";
import { MemberDrawer } from "./MemberDrawer";
import { MemberEmailComposer } from "./MemberEmailComposer";
import { STATUS_PILL, formatBytes, formatDateTime, formatRelative, formatShortDate, isOnline } from "./format";

export type MemberRow = {
  id: string;
  name: string;
  nickname: string;
  nickname_tag: string;
  email: string;
  status: string;
  role: string;
  birth_date: string | null;
  created_at: string;
  last_seen_at: string | null;
  suspended_until: string | null;
  status_reason: string | null;
  userType: string | null;
  postCount: number;
  storageBytes: number;
  duplicates: { id: string; email: string; status: string; birthDate: string | null; sameBirthDate: boolean }[];
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? { label: status, className: "bg-gray-100 text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-medium ${s.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function MembersTable({ rows, meId }: { rows: MemberRow[]; meId: string | null }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const checkedRows = rows.filter((r) => checked.has(r.id));
  const approvable = checkedRows.filter((r) => (r.status === "pending" || r.status === "rejected") && r.id !== meId);
  const mailable = checkedRows.filter((r) => r.status !== "withdrawn");
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkApprove() {
    if (approvable.length === 0) return;
    if (!confirm(`${approvable.length}명을 승인할까요? 승인 안내 메일이 발송돼요.`)) return;
    setBulkBusy(true);
    setBulkMessage(null);
    const supabase = createClient();
    let ok = 0;
    const failed: string[] = [];
    for (const r of approvable) {
      const { error } = await supabase.rpc("admin_set_member_status", {
        p_target: r.id,
        p_status: "approved",
        p_reason: "일괄 승인",
      });
      if (error) {
        failed.push(r.name);
        continue;
      }
      ok++;
      await fetch("/api/admin/notify-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: r.id }),
      }).catch(() => null);
    }
    setBulkBusy(false);
    setBulkMessage(failed.length ? `${ok}명 승인, 실패: ${failed.join(", ")}` : `${ok}명 승인 완료`);
    setChecked(new Set());
    router.refresh();
  }

  function exportChecked() {
    const ids = [...checked].join(",");
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    params.set("ids", ids);
    window.location.href = `/api/admin/members/export?${params}`;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-gray-100 text-[11px] text-gray-400">
            <tr>
              <th className="w-9 py-2 pl-3">
                <input
                  type="checkbox"
                  aria-label="전체 선택"
                  checked={allChecked}
                  onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-3.5 w-3.5 accent-black"
                />
              </th>
              <th className="py-2 pr-3 font-medium">회원</th>
              <th className="py-2 pr-3 font-medium">유형</th>
              <th className="py-2 pr-3 font-medium">상태</th>
              <th className="py-2 pr-3 font-medium">가입</th>
              <th className="py-2 pr-3 font-medium">최근 활동</th>
              <th className="py-2 pr-3 text-right font-medium">게시물</th>
              <th className="py-2 pr-3 text-right font-medium">용량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((m) => {
              const withdrawn = m.status === "withdrawn";
              const online = isOnline(m.last_seen_at);
              const dupStrong = m.duplicates.some((d) => d.sameBirthDate);
              return (
                <tr
                  key={m.id}
                  onClick={() => setSelectedId(m.id)}
                  className={`cursor-pointer transition ${
                    selectedId === m.id ? "bg-gray-100" : checked.has(m.id) ? "bg-gray-50" : "hover:bg-gray-50"
                  } ${withdrawn ? "text-gray-400" : "text-gray-700"}`}
                >
                  <td className="py-1.5 pl-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`${m.name} 선택`}
                      checked={checked.has(m.id)}
                      onChange={() => toggle(m.id)}
                      className="h-3.5 w-3.5 accent-black"
                    />
                  </td>
                  <td className="max-w-[260px] py-1.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate font-medium ${withdrawn ? "" : "text-gray-900"}`}>{m.name}</span>
                      <span className="shrink-0 truncate text-[11px] text-gray-400">
                        {m.nickname} #{m.nickname_tag}
                      </span>
                      {m.role === "admin" && (
                        <span className="shrink-0 rounded bg-gray-900 px-1 text-[10px] font-medium leading-4 text-white">관리자</span>
                      )}
                      {m.duplicates.length > 0 && (
                        <span
                          title={m.duplicates.map((d) => `${d.email}${d.birthDate ? ` (${d.birthDate})` : ""}`).join("\n")}
                          className={`shrink-0 rounded px-1 text-[10px] font-medium leading-4 ${
                            dupStrong ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {dupStrong ? "동일인?" : "동명이인"}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-gray-400">{withdrawn ? "—" : m.email}</div>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-gray-500">
                    {m.userType ? (USER_TYPE_LABEL[m.userType] ?? m.userType) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <StatusPill status={m.status} />
                    {m.status === "suspended" && (
                      <div className="text-[10px] text-red-600">
                        {m.suspended_until ? `~${formatShortDate(m.suspended_until)}` : "영구"}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums text-gray-500" title={formatDateTime(m.created_at)}>
                    {formatShortDate(m.created_at)}
                  </td>
                  <td
                    className="whitespace-nowrap py-1.5 pr-3 text-gray-500"
                    title={m.last_seen_at ? formatDateTime(m.last_seen_at) : undefined}
                    suppressHydrationWarning
                  >
                    {withdrawn ? (
                      <span className="text-gray-300">—</span>
                    ) : online ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        접속 중
                      </span>
                    ) : m.last_seen_at ? (
                      formatRelative(m.last_seen_at)
                    ) : (
                      <span className="text-gray-300">기록 없음</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">
                    {m.postCount || <span className="text-gray-300">0</span>}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-right tabular-nums">
                    {m.storageBytes ? formatBytes(m.storageBytes) : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-gray-400">
                  조건에 맞는 회원이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {bulkMessage && checked.size === 0 && <p className="text-xs text-gray-500">{bulkMessage}</p>}

      {/* 선택 시 하단 일괄 작업 바 — GlobalPlayerBar(데스크톱 64px, 모바일 100px) 바로 위에 띄운다. */}
      {checked.size > 0 && (
        <div className="fixed inset-x-0 bottom-[6.75rem] z-50 flex justify-center px-4 md:bottom-20 md:left-[72px]">
          <div className="flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
            <span className="px-1 font-medium tabular-nums">{checked.size}명 선택</span>
            <span className="h-4 w-px bg-white/20" />
            <button
              type="button"
              disabled={bulkBusy || approvable.length === 0}
              onClick={bulkApprove}
              className="rounded-md px-2 py-1 transition hover:bg-white/10 disabled:opacity-40"
              title={approvable.length === 0 ? "대기/반려 상태인 회원만 일괄 승인할 수 있어요" : undefined}
            >
              {bulkBusy ? "처리 중..." : `일괄 승인${approvable.length ? ` (${approvable.length})` : ""}`}
            </button>
            <button
              type="button"
              disabled={mailable.length === 0}
              onClick={() => setComposing(true)}
              className="rounded-md px-2 py-1 transition hover:bg-white/10 disabled:opacity-40"
            >
              메일{mailable.length ? ` (${mailable.length})` : ""}
            </button>
            <button type="button" onClick={exportChecked} className="rounded-md px-2 py-1 transition hover:bg-white/10">
              CSV
            </button>
            <button
              type="button"
              onClick={() => setChecked(new Set())}
              className="rounded-md px-2 py-1 text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              해제
            </button>
          </div>
        </div>
      )}

      {composing && (
        <MemberEmailComposer
          recipients={mailable.map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setComposing(false)}
          onSent={(msg) => {
            setBulkMessage(msg);
            setChecked(new Set());
          }}
        />
      )}

      {selected && <MemberDrawer key={selected.id} member={selected} meId={meId} onClose={() => setSelectedId(null)} />}
    </>
  );
}
