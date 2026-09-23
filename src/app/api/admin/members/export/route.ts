import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildMembersQuery,
  MEMBER_STATUS_LABEL,
  USER_TYPE_LABEL,
  type MemberSearchParams,
} from "@/lib/adminMembers";

// 회원 목록 CSV 내보내기 — 목록 화면과 같은 검색/필터/정렬 조건(쿼리스트링 그대로)으로 페이지
// 구분 없이 전부. /api는 proxy.ts 가드 밖이라 여기서 직접 관리자 확인. 스토리지 용량은 회원마다
// R2 조회가 필요해 느려서 제외. 엑셀에서 한글이 안 깨지도록 UTF-8 BOM을 붙인다.

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function kst(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams) as MemberSearchParams;
  const ids = url.searchParams.get("ids");

  let { query } = await buildMembersQuery(supabase, sp);
  // 선택한 회원만 내보내기
  if (ids) query = query.in("id", ids.split(",").filter(Boolean));
  const { data: members, error } = await query.limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = (members ?? []).map((m) => m.id);
  const [{ data: profileRows }, { data: postRows }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("user_id, user_type").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; user_type: string | null }[] }),
    userIds.length > 0
      ? supabase.from("posts").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);
  const typeMap = new Map((profileRows ?? []).map((p) => [p.user_id, p.user_type]));
  const postCount = new Map<string, number>();
  for (const p of postRows ?? []) postCount.set(p.user_id, (postCount.get(p.user_id) ?? 0) + 1);

  const header = ["이름", "닉네임", "태그", "이메일", "생년월일", "유형", "상태", "권한", "가입일", "최근 활동", "게시물", "정지 종료", "상태 사유"];
  const lines = [header.join(",")];
  for (const m of members ?? []) {
    const type = typeMap.get(m.id);
    lines.push(
      [
        m.name,
        m.nickname,
        m.nickname_tag,
        m.status === "withdrawn" ? "" : m.email,
        m.birth_date,
        type ? (USER_TYPE_LABEL[type] ?? type) : "",
        MEMBER_STATUS_LABEL[m.status] ?? m.status,
        m.role === "admin" ? "관리자" : "일반",
        kst(m.created_at),
        kst(m.last_seen_at),
        postCount.get(m.id) ?? 0,
        m.status === "suspended" ? (m.suspended_until ? kst(m.suspended_until) : "영구") : "",
        m.status_reason,
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="compmusic-members-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
