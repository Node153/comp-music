import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2UsageBytes } from "@/lib/r2/storage";
import { presenceStatus } from "@/lib/presence";
import { pageTitle, mutedText, badge, badgeDark } from "@/components/ui/styles";
import { MemberStatusActions } from "@/components/admin/MemberStatusActions";
import { MemberFilters } from "./MemberFilters";
import type { UserStatus } from "@/types/database";

// 관리자 - 회원 관리(조회/검색/필터/정렬/게시물수/스토리지 사용량). role=admin만 접근(proxy.ts에서 가드).
// 관리 목적 내부 화면이라 user_display(닉네임) 대신 users에서 실명을 바로 조회한다.
// 목록 조건(탭/검색/필터/정렬/페이지)은 전부 URL 쿼리에 둔다(MemberFilters.tsx).

const PAGE_SIZE = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  suspended: "정지",
  withdrawn: "탈퇴",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700",
  approved: "rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700",
  rejected: "rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-600",
  suspended: "rounded-full bg-red-600 px-2.5 py-1 text-xs text-white",
  withdrawn: "rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-400",
};

// 상태 탭 — 기본(active)은 탈퇴자를 뺀 전체. 탈퇴자는 익명화된 행이라 평소 목록에서는 숨긴다.
const STATUS_TABS = [
  { key: "", label: "활성 회원" },
  { key: "pending", label: "승인 대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
  { key: "suspended", label: "정지" },
  { key: "withdrawn", label: "탈퇴" },
  { key: "all", label: "전체" },
] as const;

type SearchParams = {
  q?: string;
  status?: string;
  type?: string;
  role?: string;
  joined?: string;
  seen?: string;
  sort?: string;
  page?: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

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

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

// PostgREST or() 필터 문자열에 사용자 입력을 그대로 붙이면 `,` `(` `)` 같은 예약 문자에서
// 필터가 깨진다. 값을 큰따옴표로 감싸면 예약 문자가 허용되므로, 따옴표/역슬래시만 제거하고 감싼다.
function quoteFilterValue(value: string): string {
  return `"${value.replace(/["\\]/g, "")}"`;
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusTab = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const me = await getCurrentUser();

  function hrefWith(overrides: Partial<SearchParams>): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...overrides })) {
      if (v) next.set(k, v);
    }
    const s = next.toString();
    return s ? `?${s}` : "?";
  }

  // 유형(profiles.user_type) 필터 — profiles에서 해당 유형의 user_id를 먼저 뽑아 users 조회에
  // in/not in으로 건다. "미설정"은 유형이 지정된 사람을 제외하는 방식(프로필 행이 없는 회원 포함).
  let typeIds: string[] | null = null;
  if (sp.type === "student" || sp.type === "activist" || sp.type === "none") {
    const typeQuery = supabase.from("profiles").select("user_id");
    const { data } =
      sp.type === "none"
        ? await typeQuery.not("user_type", "is", null)
        : await typeQuery.eq("user_type", sp.type);
    typeIds = (data ?? []).map((r) => r.user_id);
  }

  let query = supabase
    .from("users")
    .select(
      "id, name, nickname, nickname_tag, email, status, role, birth_date, created_at, last_seen_at, suspended_until, status_reason",
      { count: "exact" },
    );

  if (statusTab === "") query = query.neq("status", "withdrawn");
  else if (statusTab in STATUS_LABEL) query = query.eq("status", statusTab as UserStatus);

  if (q) {
    if (q.startsWith("#")) {
      query = query.ilike("nickname_tag", `%${q.slice(1)}%`);
    } else {
      const v = quoteFilterValue(`%${q}%`);
      query = query.or(`name.ilike.${v},nickname.ilike.${v},email.ilike.${v}`);
    }
  }

  if (typeIds !== null) {
    if (sp.type === "none") {
      if (typeIds.length > 0) query = query.not("id", "in", `(${typeIds.join(",")})`);
    } else {
      // 해당 유형이 한 명도 없으면 빈 결과가 나와야 하므로 존재할 수 없는 id로 막는다.
      query = query.in("id", typeIds.length > 0 ? typeIds : ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  if (sp.role === "admin") query = query.eq("role", "admin");
  else if (sp.role === "user") query = query.neq("role", "admin");

  if (sp.joined === "7" || sp.joined === "30") {
    query = query.gte("created_at", daysAgoIso(Number(sp.joined)));
  }

  if (sp.seen === "7" || sp.seen === "30") {
    query = query.gte("last_seen_at", daysAgoIso(Number(sp.seen)));
  } else if (sp.seen === "dormant") {
    query = query.or(`last_seen_at.is.null,last_seen_at.lt.${daysAgoIso(30)}`);
  }

  if (sp.sort === "joined_asc") query = query.order("created_at", { ascending: true });
  else if (sp.sort === "seen") query = query.order("last_seen_at", { ascending: false, nullsFirst: false });
  else if (sp.sort === "name") query = query.order("name", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

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

  const usersByName = new Map<
    string,
    { id: string; email: string; status: string; birthDate: string | null }[]
  >();
  for (const u of allUsers ?? []) {
    const key = u.name.trim();
    if (!usersByName.has(key)) usersByName.set(key, []);
    usersByName.get(key)!.push({ id: u.id, email: u.email, status: u.status, birthDate: u.birth_date });
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

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = [
    { label: "활성 회원", value: activeCount, href: hrefWith({ status: "", seen: "", joined: "", page: "" }) },
    { label: "승인 대기", value: pendingCount, href: hrefWith({ status: "pending", page: "" }), alert: (pendingCount ?? 0) > 0 },
    { label: "최근 7일 가입", value: joined7Count, href: hrefWith({ status: "", joined: "7", page: "" }) },
    { label: "최근 7일 활동", value: seen7Count, href: hrefWith({ status: "", seen: "7", page: "" }) },
  ];

  return (
    <main className="flex flex-col gap-5">
      <h1 className={pageTitle}>회원 관리</h1>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {summary.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-400"
          >
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold tabular-nums ${s.alert ? "text-amber-600" : "text-gray-900"}`}>
              {s.value ?? 0}
            </div>
          </Link>
        ))}
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          return (
            <Link
              key={t.key || "active"}
              href={hrefWith({ status: t.key, page: "" })}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                active ? "border-black font-semibold text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t.label} <span className="tabular-nums text-gray-400">{tabCounts[t.key] ?? 0}</span>
            </Link>
          );
        })}
      </nav>

      <Suspense>
        <MemberFilters />
      </Suspense>

      <div className={mutedText}>
        검색 결과 {total}명
        {total > 0 && ` · ${from + 1}–${Math.min(from + PAGE_SIZE, total)}`}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="sticky left-0 z-10 whitespace-nowrap border-r border-gray-200 bg-gray-50 px-4 py-3 font-medium">
                이름 / 닉네임
              </th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">이메일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">생년월일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">유형</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">상태</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">권한</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">가입일</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">마지막 활동</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">게시물</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium">스토리지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(members ?? []).map((m) => {
              const withdrawn = m.status === "withdrawn";
              const duplicates = withdrawn
                ? []
                : (usersByName.get(m.name.trim()) ?? []).filter((u) => u.id !== m.id);
              const userType = userTypeMap.get(m.id);
              const presence = presenceStatus(m.last_seen_at);
              return (
              <tr key={m.id} className={withdrawn ? "text-gray-400" : undefined}>
                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white px-4 py-3">
                  <div className={`font-medium ${withdrawn ? "text-gray-400" : "text-gray-900"}`}>{m.name}</div>
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
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{withdrawn ? "-" : m.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{m.birth_date ?? "-"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                  {userType === "student" ? "전공생" : userType === "activist" ? "활동자" : "-"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <span className={STATUS_BADGE[m.status] ?? badge}>{STATUS_LABEL[m.status] ?? m.status}</span>
                    {m.status === "suspended" && (
                      <span className="max-w-40 whitespace-normal text-xs text-red-600" title={m.status_reason ?? undefined}>
                        {m.suspended_until ? `${formatDateTime(m.suspended_until)}까지` : "영구 정지"}
                      </span>
                    )}
                    <MemberStatusActions
                      userId={m.id}
                      name={m.name}
                      status={m.status}
                      role={m.role}
                      isSelf={m.id === me?.id}
                    />
                    <Link href={`/admin/activity?target=${m.id}`} className="text-xs text-gray-400 hover:text-gray-700 hover:underline">
                      이력
                    </Link>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={m.role === "admin" ? badgeDark : badge}>
                    {m.role === "admin" ? "관리자" : "일반"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600" title={formatDateTime(m.created_at)}>
                  {formatRelative(m.created_at)}
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3 text-gray-600"
                  title={m.last_seen_at ? formatDateTime(m.last_seen_at) : undefined}
                >
                  {withdrawn ? (
                    "-"
                  ) : presence === "online" ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      접속 중
                    </span>
                  ) : m.last_seen_at ? (
                    formatRelative(m.last_seen_at)
                  ) : (
                    <span className="text-gray-400">기록 없음</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600">{postCountMap.get(m.id) ?? 0}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-gray-600">
                  {formatBytes(usageByUserId.get(m.id) ?? 0)}
                </td>
              </tr>
              );
            })}
            {(members ?? []).length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                  조건에 맞는 회원이 없습니다
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link href={hrefWith({ page: String(page - 1) })} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">
              이전
            </Link>
          ) : (
            <span className="rounded-lg border border-gray-100 px-3 py-1.5 text-gray-300">이전</span>
          )}
          <span className="tabular-nums text-gray-500">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={hrefWith({ page: String(page + 1) })} className="rounded-lg border border-gray-200 px-3 py-1.5 hover:bg-gray-50">
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
