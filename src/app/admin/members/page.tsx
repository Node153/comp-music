import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getR2UsageBytes } from "@/lib/r2/storage";
import { pageTitle, mutedText, badge, field } from "@/components/ui/styles";
import { MemberStatusActions } from "@/components/admin/MemberStatusActions";

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
    .select("id, name, nickname, nickname_tag, email, status, role, birth_date, created_at")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,nickname.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data: members } = await query;

  // 동명이인(중복 계정 의심) 경고용 — 검색 필터와 무관하게 전체 회원 기준으로 판단해야 하므로
  // 별도 쿼리. 소셜로그인(Google/Kakao/Spotify)마다 이메일이 다르게 잡혀서 같은 사람이 여러
  // 계정을 만들 수 있는데, 이메일이 다르면 시스템이 자동으로는 구분 못 해서 실명 일치 여부를
  // 관리자에게 참고 정보로만 보여준다(최종 판단은 관리자 몫 — 오탐 가능성 있음, 동명이인이
  // 실제로 다른 사람일 수도 있어서 자동 차단은 안 함). 생년월일(0031)도 같이 대조해서 일치하면
  // "동일인 가능성 높음"으로 더 강하게 표시 — 기존 회원은 생년월일이 없어서(null) 비교 불가.
  const { data: allUsers } = await supabase
    .from("users")
    .select("id, name, email, status, birth_date");
  const usersByName = new Map<
    string,
    { id: string; email: string; status: string; birthDate: string | null }[]
  >();
  for (const u of allUsers ?? []) {
    const key = u.name.trim();
    if (!usersByName.has(key)) usersByName.set(key, []);
    usersByName.get(key)!.push({ id: u.id, email: u.email, status: u.status, birthDate: u.birth_date });
  }

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
        <div className="flex items-center gap-3">
          <Link href="/admin/login-screen" className="text-sm font-medium text-blue-600 hover:underline">
            로그인 화면 →
          </Link>
          <Link href="/admin/verifications" className="text-sm font-medium text-blue-600 hover:underline">
            심사 대기열 →
          </Link>
        </div>
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
              <th className="whitespace-nowrap px-4 py-3 font-medium">생년월일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">유형</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">상태</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">권한</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">가입일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">게시물</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">스토리지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(members ?? []).map((m) => {
              const duplicates = (usersByName.get(m.name.trim()) ?? []).filter((u) => u.id !== m.id);
              const userType = userTypeMap.get(m.id);
              return (
              <tr key={m.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{m.name}</div>
                  <div className={mutedText}>
                    {m.nickname} <span className="text-gray-400">#{m.nickname_tag}</span>
                  </div>
                  {duplicates.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {duplicates.map((d) => {
                        const sameBirthDate = Boolean(
                          m.birth_date && d.birthDate && m.birth_date === d.birthDate,
                        );
                        return (
                          <span
                            key={d.id}
                            className={`text-xs font-medium ${sameBirthDate ? "text-red-600" : "text-amber-600"}`}
                          >
                            {sameBirthDate ? "🚨 동일인 가능성 높음" : "⚠️ 동명이인 있음"}: {d.email} (
                            {STATUS_LABEL[d.status] ?? d.status}
                            {d.birthDate ? `, ${d.birthDate}` : ""})
                          </span>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{m.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{m.birth_date ?? "-"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {userType === "student" ? "전공생" : userType === "activist" ? "활동자" : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <span className={badge}>{STATUS_LABEL[m.status] ?? m.status}</span>
                    <MemberStatusActions userId={m.id} status={m.status} />
                  </div>
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
              );
            })}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
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
