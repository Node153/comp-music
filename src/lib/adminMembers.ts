import type { createClient } from "@/lib/supabase/server";
import type { UserStatus } from "@/types/database";

// 관리자 회원 관리 공용 — 목록 화면(admin/members/page.tsx)과 CSV 내보내기
// (api/admin/members/export)가 같은 검색/필터/정렬 조건으로 조회하도록 쿼리 조립을 한 곳에 둔다.

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

export type MemberSearchParams = {
  q?: string;
  status?: string;
  type?: string;
  role?: string;
  joined?: string;
  seen?: string;
  sort?: string;
  page?: string;
};

export const MEMBER_STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  suspended: "정지",
  withdrawn: "탈퇴",
};

export const USER_TYPE_LABEL: Record<string, string> = {
  student: "전공생",
  activist: "활동자",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

// PostgREST or() 필터 문자열에 사용자 입력을 그대로 붙이면 `,` `(` `)` 같은 예약 문자에서
// 필터가 깨진다. 값을 큰따옴표로 감싸면 예약 문자가 허용되므로, 따옴표/역슬래시만 제거하고 감싼다.
function quoteFilterValue(value: string): string {
  return `"${value.replace(/["\\]/g, "")}"`;
}

// 조립된 쿼리 빌더는 thenable이라 그대로 반환하면 await 시점에 실행돼 버린다 — 객체로 감싸서
// 호출부가 range/limit 등을 더 붙인 뒤 실행하게 한다.
export async function buildMembersQuery(supabase: ServerSupabase, sp: MemberSearchParams) {
  const q = sp.q?.trim() ?? "";
  const statusTab = sp.status ?? "";

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
  else if (statusTab in MEMBER_STATUS_LABEL) query = query.eq("status", statusTab as UserStatus);

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

  return { query };
}
