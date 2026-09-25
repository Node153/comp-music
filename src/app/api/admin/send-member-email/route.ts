import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// 회원 관리에서 관리자가 회원에게 직접 메일 발송 — MemberEmailComposer(상세 패널/일괄 작업 바)가
// 호출한다. 본문은 관리자가 쓴 일반 텍스트라 HTML 이스케이프 후 줄바꿈만 <br>로 바꾸고,
// {이름}은 받는 사람 실명으로 치환한다. 보낸 기록은 해당 회원의 관리자 메모(admin_notes)로 남긴다.
const MAX_RECIPIENTS = 50;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toHtml(body: string): string {
  return body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user: admin },
  } = await supabase.auth.getUser();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: me } = await supabase.from("users").select("role").eq("id", admin.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { userIds, subject, body } = (await request.json().catch(() => ({}))) as {
    userIds?: string[];
    subject?: string;
    body?: string;
  };
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [])];
  const subj = subject?.trim() ?? "";
  const text = body?.trim() ?? "";
  if (ids.length === 0 || ids.length > MAX_RECIPIENTS || !subj || !text) {
    return NextResponse.json({ error: "받는 사람·제목·본문을 확인해주세요" }, { status: 400 });
  }

  const { data: targets, error: targetsError } = await supabase
    .from("users")
    .select("id, email, name, status")
    .in("id", ids);
  if (targetsError) {
    return NextResponse.json({ error: targetsError.message }, { status: 500 });
  }

  const sent: string[] = [];
  const failed: string[] = [];
  for (const t of targets ?? []) {
    if (t.status === "withdrawn" || !t.email) {
      failed.push(t.name);
      continue;
    }
    try {
      await sendEmail(t.email, subj, toHtml(text.replaceAll("{이름}", t.name)));
      sent.push(t.id);
    } catch (err) {
      console.error("[send-member-email] 발송 실패", t.id, err);
      failed.push(t.name);
    }
  }

  if (sent.length > 0) {
    await supabase
      .from("admin_notes")
      .insert(sent.map((id) => ({ target_user_id: id, author_id: admin.id, body: `📧 메일 발송: ${subj}` })));
  }

  return NextResponse.json({ sent: sent.length, failed });
}
