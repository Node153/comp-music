import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getR2UsageBytes } from "@/lib/r2/storage";
import { pageTitle, mutedText, badge, field } from "@/components/ui/styles";

// 관리자 - 회원 관리(조회/검색/게시물수/스토리지 사용량). role=admin만 접근(proxy.ts에서 가드).
// 관리 목적 내부 화면이라 user_display(닉네임) 대신 users에서 실명을 바로 조회한다.

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("users")
    .select("id, name, nickname, email, status, role, created_at")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: members } = await query;

  const userIds = (members ?? []).map((m) => m.id);
  const { data: profileRows } =
    userIds.length > 0
      ? await supabase.from("profiles").select("user_id, user_type").in("user_id", userIds)
      : { data: [] };
  const userTypeMap = new Map((profileRows ?? []).map((p) => [p.user_id, p.user_type]));

  const { data: postRows } =
    userIds.length > 0 ? await supabase.from("posts").select("user_id").in("user_id", userIds) : { data: [] };
  const postCountMap = new Map<string, number>();
  for (const p of postRows ?? []) {
    postCountMap.set(p.user_id, (postCountMap.get(p.user_id) ?? 0) + 1);
  }

  const usageByUserId = new Map(
    await Promise.all(
      userIds.map(async (id) => [id, await getR2UsageBytes(`${id}/`)] as const),
    ),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className={pageTitle}>회원 관리</h1>
        <Link href="/admin/verifications" className="text-sm font-medium text-blue-600 hover:underline">
          심사 대기열 →
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="이름, 닉네임, 이메일로 검색"
          className={field}
        />
      </form>

      <div className={mutedText}>총 {(members ?? []).length}명</div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 font-medium">이름 / 닉네임</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">이메일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">유형</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">상태</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">권한</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">가입일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">게시물</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">스토리지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(members ?? []).map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{m.name}</div>
                  <div className={mutedText}>{m.nickname}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{m.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {userTypeMap.get(m.id) === "student" ? "전공생" : "활동자"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={badge}>{STATUS_LABEL[m.status] ?? m.status}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={badge}>{m.role === "admin" ? "관리자" : "일반"}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {new Date(m.created_at).toLocaleDateString("ko-KR")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{postCountMap.get(m.id) ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {formatBytes(usageByUserId.get(m.id) ?? 0)}
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  검색 결과가 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
