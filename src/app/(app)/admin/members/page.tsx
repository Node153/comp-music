import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2UsageBytes } from "@/lib/r2/storage";
import { buildMembersQuery, daysAgoIso, type MemberSearchParams } from "@/lib/adminMembers";
import { MemberFilters } from "./MemberFilters";
import { MembersTable, type MemberRow } from "./MembersTable";

// 관리자 - 회원 관리. role=admin만 접근(proxy.ts에서 가드).
// 관리 목적 내부 화면이라 user_display(닉네임) 대신 users에서 실명을 바로 조회한다.
// 목록 조건(탭/검색/필터/정렬/페이지)은 전부 URL 쿼리에 둔다(MemberFilters.tsx) — 조회 조립은
// CSV 내보내기와 공용(lib/adminMembers.ts). 이 파일은 데이터만 모으고, 표·선택·일괄 작업·
// 상세 패널은 클라이언트 컴포넌트(MembersTable.tsx)가 그린다.

const PAGE_SIZE = 30;

// 상태 탭 — 기본(active)은 탈퇴자를 뺀 전체. 탈퇴자는 익명화된 행이라 평소 목록에서는 숨긴다.
const STATUS_TABS = [
  { key: "", label: "활성" },
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
  { key: "suspended", label: "정지" },
  { key: "withdrawn", label: "탈퇴" },
  { key: "all", label: "전체" },
] as const;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<MemberSearchParams>;
}) {
  const sp = await searchParams;
  const statusTab = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const me = await getCurrentUser();

  function hrefWith(overrides: Partial<MemberSearchParams>): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...overrides })) {
      if (v) next.set(k, v);
    }
    const s = next.toString();
    return s ? `?${s}` : "?";
  }

  const from = (page - 1) * PAGE_SIZE;
  const query = (await buildMembersQuery(supabase, sp)).query.range(from, from + PAGE_SIZE - 1);

  const countUsers = () => supabase.from("users").select("id", { count: "exact", head: true });

  // 상단 요약 지표와 탭별 개수 — 전부 head count라 행을 가져오지 않는다.
  const [
    { data: members, count: totalCount },
    { count: activeCount },
    { count: pendingCount },
    { count: approvedCount },
    { count: rejectedCount },
    { count: suspendedCount },
    { count: withdrawnCount },
    { count: joined7Count },
    { count: seen7Count },
    { data: allUsers },
  ] = await Promise.all([
    query,
    countUsers().neq("status", "withdrawn"),
    countUsers().eq("status", "pending"),
    countUsers().eq("status", "approved"),
    countUsers().eq("status", "rejected"),
    countUsers().eq("status", "suspended"),
    countUsers().eq("status", "withdrawn"),
    countUsers().neq("status", "withdrawn").gte("created_at", daysAgoIso(7)),
    countUsers().neq("status", "withdrawn").gte("last_seen_at", daysAgoIso(7)),
    // 동명이인(중복 계정 의심) 경고용 — 검색 필터와 무관하게 전체 회원 기준으로 판단해야 하므로
    // 별도 쿼리. 소셜로그인(Google/Kakao/Spotify)마다 이메일이 다르게 잡혀서 같은 사람이 여러
    // 계정을 만들 수 있는데, 이메일이 다르면 시스템이 자동으로는 구분 못 해서 실명 일치 여부를
    // 관리자에게 참고 정보로만 보여준다(최종 판단은 관리자 몫 — 오탐 가능성 있음, 동명이인이
    // 실제로 다른 사람일 수도 있어서 자동 차단은 안 함). 생년월일(0031)도 같이 대조해서 일치하면
    // "동일인 가능성 높음"으로 더 강하게 표시 — 기존 회원은 생년월일이 없어서(null) 비교 불가.
    // 탈퇴자는 이름이 전부 "탈퇴한 사용자"로 익명화돼 서로 오탐이 나므로 비교 대상에서 뺀다.
    supabase.from("users").select("id, name, email, status, birth_date").neq("status", "withdrawn"),
  ]);

  const tabCounts: Record<string, number | null> = {
    "": activeCount,
    pending: pendingCount,
    approved: approvedCount,
    rejected: rejectedCount,
    suspended: suspendedCount,
    withdrawn: withdrawnCount,
    all: (activeCount ?? 0) + (withdrawnCount ?? 0),
  };

  const usersByName = new Map<string, NonNullable<typeof allUsers>>();
  for (const u of allUsers ?? []) {
    const key = u.name.trim();
    if (!usersByName.has(key)) usersByName.set(key, []);
    usersByName.get(key)!.push(u);
  }

  // 게시물 수·유형·스토리지는 현재 페이지에 보이는 회원(최대 PAGE_SIZE명)만 조회한다 —
  // 특히 스토리지는 회원마다 R2 목록 조회가 필요해서 전체 회원에 대해 돌리면 느려진다.
  const userIds = (members ?? []).map((m) => m.id);
  const [{ data: profileRows }, { data: postRows }, usageEntries] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("user_id, user_type").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; user_type: string | null }[] }),
    userIds.length > 0
      ? supabase.from("posts").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    Promise.all(userIds.map(async (id) => [id, await getR2UsageBytes(`${id}/`)] as const)),
  ]);
  const userTypeMap = new Map((profileRows ?? []).map((p) => [p.user_id, p.user_type]));
  const postCountMap = new Map<string, number>();
  for (const p of postRows ?? []) {
    postCountMap.set(p.user_id, (postCountMap.get(p.user_id) ?? 0) + 1);
  }
  const usageByUserId = new Map(usageEntries);

  const rows: MemberRow[] = (members ?? []).map((m) => ({
    ...m,
    userType: userTypeMap.get(m.id) ?? null,
    postCount: postCountMap.get(m.id) ?? 0,
    storageBytes: usageByUserId.get(m.id) ?? 0,
    duplicates:
      m.status === "withdrawn"
        ? []
        : (usersByName.get(m.name.trim()) ?? [])
            .filter((u) => u.id !== m.id)
            .map((u) => ({
              id: u.id,
              email: u.email,
              status: u.status,
              birthDate: u.birth_date,
              sameBirthDate: Boolean(m.birth_date && u.birth_date && m.birth_date === u.birth_date),
            })),
  }));

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = [
    { label: "활성 회원", value: activeCount, href: hrefWith({ status: "", seen: "", joined: "", page: "" }) },
    { label: "승인 대기", value: pendingCount, href: hrefWith({ status: "pending", page: "" }), alert: (pendingCount ?? 0) > 0 },
    { label: "7일 신규", value: joined7Count, href: hrefWith({ status: "", joined: "7", page: "" }) },
    { label: "7일 활동", value: seen7Count, href: hrefWith({ status: "", seen: "7", page: "" }) },
    { label: "정지", value: suspendedCount, href: hrefWith({ status: "suspended", page: "" }), alert: (suspendedCount ?? 0) > 0 },
  ];

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v && k !== "page") exportParams.set(k, v);

  return (
    <main className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-gray-900">회원 관리</h1>
        <a
          href={`/api/admin/members/export?${exportParams}`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        >
          CSV 내보내기 ({total})
        </a>
      </div>

      <div className="grid grid-cols-5 divide-x divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {summary.map((s) => (
          <Link key={s.label} href={s.href} className="px-3 py-2 transition hover:bg-gray-50">
            <div className="truncate text-[11px] text-gray-500">{s.label}</div>
            <div className={`text-lg font-semibold leading-tight tabular-nums ${s.alert ? "text-amber-600" : "text-gray-900"}`}>
              {s.value ?? 0}
            </div>
          </Link>
        ))}
      </div>

      <nav className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          return (
            <Link
              key={t.key || "active"}
              href={hrefWith({ status: t.key, page: "" })}
              className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 text-[13px] transition ${
                active ? "border-black font-semibold text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label}
              <span className="ml-1 text-[11px] tabular-nums text-gray-400">{tabCounts[t.key] ?? 0}</span>
            </Link>
          );
        })}
      </nav>

      <Suspense>
        <MemberFilters />
      </Suspense>

      <MembersTable rows={rows} meId={me?.id ?? null} />

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="tabular-nums">
          {total}명 중 {total > 0 ? `${from + 1}–${Math.min(from + PAGE_SIZE, total)}` : 0}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {page > 1 ? (
              <Link href={hrefWith({ page: String(page - 1) })} className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50">
                ‹
              </Link>
            ) : (
              <span className="rounded-md border border-gray-100 px-2 py-1 text-gray-300">‹</span>
            )}
            <span className="px-1.5 tabular-nums">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={hrefWith({ page: String(page + 1) })} className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-50">
                ›
              </Link>
            ) : (
              <span className="rounded-md border border-gray-100 px-2 py-1 text-gray-300">›</span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
