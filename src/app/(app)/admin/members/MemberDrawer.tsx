"use client";

// 회원 상세 패널(오른쪽 드로어) — 기본 정보·중복 의심·조치(MemberStatusActions)·관리자 메모
// (admin_notes, 0066)·최근 조치 이력(admin_actions, 0064). 메모와 이력은 패널을 열 때 브라우저
// 클라이언트로 가져온다(둘 다 관리자만 select 가능한 RLS). Esc 또는 바깥 클릭으로 닫힘.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { USER_TYPE_LABEL, MEMBER_STATUS_LABEL } from "@/lib/adminMembers";
import { MemberStatusActions } from "@/components/admin/MemberStatusActions";
import { StatusPill, type MemberRow } from "./MembersTable";
import { formatBytes, formatDateTime, formatRelative } from "./format";

type Note = { id: number; author_id: string | null; body: string; created_at: string; authorName: string | null };
type Action = {
  id: number;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

function describeAction(a: Action): string {
  const b = a.before ?? {};
  const af = a.after ?? {};
  if (a.action === "role_change") return `권한 → ${af.role === "admin" ? "관리자" : "일반"}`;
  if (a.action === "name_change") return `이름 ${b.name} → ${af.name}`;
  if (a.action === "suspension_expired") return "정지 기간 만료 해제";
  const to = MEMBER_STATUS_LABEL[String(af.status)] ?? af.status;
  const from = MEMBER_STATUS_LABEL[String(b.status)] ?? b.status;
  return `${from} → ${to}`;
}

export function MemberDrawer({
  member: m,
  meId,
  onClose,
}: {
  member: MemberRow;
  meId: string | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [actions, setActions] = useState<Action[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(m.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: noteRows }, { data: actionRows }] = await Promise.all([
      supabase
        .from("admin_notes")
        .select("id, author_id, body, created_at")
        .eq("target_user_id", m.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("admin_actions")
        .select("id, action, before, after, reason, created_at")
        .eq("target_user_id", m.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    const authorIds = [...new Set((noteRows ?? []).map((n) => n.author_id).filter((v): v is string => !!v))];
    const { data: authors } =
      authorIds.length > 0 ? await supabase.from("users").select("id, name").in("id", authorIds) : { data: [] };
    const nameById = new Map((authors ?? []).map((a) => [a.id, a.name]));
    setNotes((noteRows ?? []).map((n) => ({ ...n, authorName: n.author_id ? (nameById.get(n.author_id) ?? null) : null })));
    setActions(actionRows ?? []);
  }, [m.id]);

  // 상태·권한이 바뀌면(조치 후 router.refresh) 이력을 다시 불러온다. 다른 회원으로 바뀔 때의
  // 초기화는 MembersTable이 key={id}로 패널을 새로 마운트해서 처리한다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부(DB) 데이터 동기화
    load();
  }, [load, m.status, m.role, m.name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      // 이름 편집 중이면 Esc는 편집만 취소(입력창 onKeyDown이 처리)하고 패널은 닫지 않는다.
      if (e.target instanceof HTMLElement && e.target.dataset.nameEdit) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function saveName() {
    const next = nameDraft.trim().replace(/\s+/g, " ");
    if (!next) {
      setNameError("이름을 입력해주세요");
      return;
    }
    if (next === m.name) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    setNameError(null);
    const { error: rpcError } = await createClient().rpc("admin_set_member_name", { p_target: m.id, p_name: next });
    setNameSaving(false);
    if (rpcError) {
      setNameError(rpcError.message);
      return;
    }
    setEditingName(false);
    router.refresh();
  }

  function cancelNameEdit() {
    setEditingName(false);
    setNameDraft(m.name);
    setNameError(null);
  }

  async function addNote() {
    const body = draft.trim();
    if (!body || !meId) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await createClient()
      .from("admin_notes")
      .insert({ target_user_id: m.id, author_id: meId, body });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft("");
    load();
  }

  async function deleteNote(id: number) {
    if (!confirm("이 메모를 삭제할까요?")) return;
    const { error: deleteError } = await createClient().from("admin_notes").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else load();
  }

  const withdrawn = m.status === "withdrawn";
  const info: [string, React.ReactNode][] = [
    ["이메일", withdrawn ? "—" : <span className="break-all">{m.email}</span>],
    ["생년월일", m.birth_date ?? "—"],
    ["유형", m.userType ? (USER_TYPE_LABEL[m.userType] ?? m.userType) : "—"],
    ["가입", formatDateTime(m.created_at)],
    ["최근 활동", m.last_seen_at ? `${formatRelative(m.last_seen_at)} · ${formatDateTime(m.last_seen_at)}` : "기록 없음"],
    ["게시물", `${m.postCount}개`],
    ["용량", m.storageBytes ? formatBytes(m.storageBytes) : "0"],
  ];

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-[400px] flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-label={`${m.name} 상세`}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3">
          <div className="min-w-0">
            {editingName ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
              >
                <input
                  autoFocus
                  data-name-edit="1"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelNameEdit();
                  }}
                  maxLength={100}
                  aria-label="이름"
                  className="w-36 rounded-md border border-gray-300 px-2 py-0.5 text-sm font-semibold text-gray-900 focus:border-gray-900 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={nameSaving}
                  className="rounded-md bg-gray-900 px-2 py-0.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
                >
                  {nameSaving ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={cancelNameEdit}
                  className="rounded-md px-1.5 py-0.5 text-xs text-gray-500 transition hover:bg-gray-100"
                >
                  취소
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-base font-semibold text-gray-900">{m.name}</h2>
                {!withdrawn && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(m.name);
                      setEditingName(true);
                    }}
                    aria-label="이름 수정"
                    title="이름 수정"
                    className="rounded p-0.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
                <StatusPill status={m.status} />
                {m.role === "admin" && (
                  <span className="rounded bg-gray-900 px-1 text-[10px] font-medium leading-4 text-white">관리자</span>
                )}
              </div>
            )}
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            <p className="truncate text-xs text-gray-500">
              {m.nickname} #{m.nickname_tag}
              {!withdrawn && (
                <>
                  {" · "}
                  <Link href={`/profile/${m.id}`} className="text-blue-600 hover:underline">
                    프로필
                  </Link>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1 rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex flex-col gap-4 px-4 py-3 pb-24 text-[13px]">
          {m.status === "suspended" && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <strong>{m.suspended_until ? `${formatDateTime(m.suspended_until)}까지 정지` : "영구 정지"}</strong>
              {m.status_reason && <p className="mt-0.5">사유: {m.status_reason}</p>}
            </div>
          )}
          {m.status === "rejected" && m.status_reason && (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">반려 사유: {m.status_reason}</div>
          )}

          {m.duplicates.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="font-medium">같은 실명의 다른 계정</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {m.duplicates.map((d) => (
                  <li key={d.id} className={d.sameBirthDate ? "font-semibold text-red-700" : undefined}>
                    {d.sameBirthDate && "생년월일 일치 · "}
                    {d.email} ({MEMBER_STATUS_LABEL[d.status] ?? d.status}
                    {d.birthDate ? `, ${d.birthDate}` : ""})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5">
            {info.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-400">{k}</dt>
                <dd className="min-w-0 text-gray-800" suppressHydrationWarning>
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          {!withdrawn && m.id !== meId && (
            <section className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
              <span className="text-xs text-gray-500">상태·권한 변경</span>
              <MemberStatusActions userId={m.id} name={m.name} status={m.status} role={m.role} isSelf={false} />
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-gray-500">관리자 메모</h3>
            <div className="flex flex-col gap-1.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
                }}
                rows={2}
                maxLength={2000}
                placeholder="관리자끼리만 보여요 (⌘+Enter로 저장)"
                className="w-full resize-none rounded-lg border border-gray-200 px-2.5 py-1.5 text-[13px] focus:border-gray-900 focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={addNote}
                  className="rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
                >
                  {saving ? "저장 중..." : "메모 추가"}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {notes === null ? (
              <p className="text-xs text-gray-400">불러오는 중...</p>
            ) : notes.length === 0 ? (
              <p className="text-xs text-gray-300">아직 메모가 없어요</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {notes.map((n) => (
                  <li key={n.id} className="group rounded-lg bg-gray-50 px-2.5 py-1.5">
                    <p className="whitespace-pre-wrap break-words text-gray-800">{n.body}</p>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-gray-400">
                      <span title={formatDateTime(n.created_at)}>
                        {n.authorName ?? "알 수 없음"} · {formatRelative(n.created_at)}
                      </span>
                      {n.author_id === meId && (
                        <button
                          type="button"
                          onClick={() => deleteNote(n.id)}
                          className="opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500">최근 조치</h3>
              <Link href={`/admin/activity?target=${m.id}`} className="text-[11px] text-gray-400 hover:text-gray-700 hover:underline">
                전체 이력
              </Link>
            </div>
            {actions === null ? (
              <p className="text-xs text-gray-400">불러오는 중...</p>
            ) : actions.length === 0 ? (
              <p className="text-xs text-gray-300">조치 기록이 없어요</p>
            ) : (
              <ol className="flex flex-col gap-1.5 border-l border-gray-100 pl-3">
                {actions.map((a) => (
                  <li key={a.id} className="text-xs">
                    <span className="text-gray-800">{describeAction(a)}</span>
                    <span className="ml-1.5 text-gray-400" title={formatDateTime(a.created_at)}>
                      {formatRelative(a.created_at)}
                    </span>
                    {a.reason && <p className="text-gray-500">{a.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
