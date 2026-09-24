import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pageTitle, mutedText, link } from "@/components/ui/styles";

// 관리자 - 활동 로그(admin_actions, 0064). 회원 상태·권한 변경을 누가/언제/왜 했는지 시간순으로.
// ?target=<userId>면 그 회원 한 명의 이력만(회원 관리 표의 "이력" 링크).

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  suspended: "정지",
  withdrawn: "탈퇴",
};

const ROLE_LABEL: Record<string, string> = { admin: "관리자", user: "일반" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUntil(value: unknown): string {
  return typeof value === "string" ? `${formatDateTime(value)}까지` : "영구";
}

function describe(action: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const b = before ?? {};
  const a = after ?? {};
  if (action === "role_change") {
    return `권한 ${ROLE_LABEL[String(b.role)] ?? b.role} → ${ROLE_LABEL[String(a.role)] ?? a.role}`;
  }
  if (action === "name_change") {
    return `이름 ${b.name} → ${a.name}`;
  }
  if (action === "suspension_expired") {
    return "정지 기간 만료로 자동 해제";
  }
  const from = STATUS_LABEL[String(b.status)] ?? b.status;
  const to = STATUS_LABEL[String(a.status)] ?? a.status;
  return a.status === "suspended" ? `${from} → 정지 (${formatUntil(a.suspended_until)})` : `${from} → ${to}`;
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; page?: string }>;
}) {
  const { target, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();

  let query = supabase
    .from("admin_actions")
    .select("id, admin_id, target_user_id, action, before, after, reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (target) query = query.eq("target_user_id", target);
  const { data: rows, count } = await query;

  const ids = [
    ...new Set((rows ?? []).flatMap((r) => [r.admin_id, r.target_user_id]).filter((v): v is string => !!v)),
  ];
  if (target && !ids.includes(target)) ids.push(target);
  const { data: people } =
    ids.length > 0
      ? await supabase.from("users").select("id, name, nickname, nickname_tag").in("id", ids)
      : { data: [] };
  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const targetPerson = target ? personById.get(target) : null;

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => `?${new URLSearchParams({ ...(target ? { target } : {}), page: String(p) })}`;

  return (
    <main className="flex flex-col gap-5">
      <h1 className={pageTitle}>활동 로그</h1>
      {target ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-700">
            <strong>{targetPerson?.name ?? "알 수 없는 회원"}</strong>
            {targetPerson && (
              <span className="text-gray-400">
                {" "}
                {targetPerson.nickname} #{targetPerson.nickname_tag}
              </span>
            )}
            의 이력
          </span>
          <Link href="/admin/activity" className={link}>
            전체 보기
          </Link>
        </div>
      ) : (
        <p className={mutedText}>회원 상태·권한 변경 기록이에요. 기록은 수정하거나 지울 수 없어요.</p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-400">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">시각</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">처리자</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">대상</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">내용</th>
              <th className="px-4 py-3 font-medium">사유</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(rows ?? []).map((r) => {
              const admin = r.admin_id ? personById.get(r.admin_id) : null;
              const person = r.target_user_id ? personById.get(r.target_user_id) : null;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-500">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {r.admin_id ? (admin?.name ?? "삭제된 관리자") : <span className="text-gray-400">시스템</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {person ? (
                      <Link href={`?target=${r.target_user_id}`} className="text-gray-900 hover:underline">
                        {person.name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {describe(r.action, r.before, r.after)}
                  </td>
                  <td className="min-w-48 px-4 py-3 text-gray-600">{r.reason ?? <span className="text-gray-300">-</span>}</td>
                </tr>
              );
            })}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  아직 기록이 없어요
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">
              이전
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">이전</span>
          )}
          <span className="tabular-nums text-gray-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">
              다음
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">다음</span>
          )}
        </div>
      )}
    </main>
  );
}
