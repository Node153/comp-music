import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PulseTrigger } from "@/lib/feedback";

// 지금 이 사용자에게 짧은 설문(FeedbackPulse)을 띄울지 판정(0065 feedback_pulses).
// 업로드 화면 등에 훅을 걸지 않고 상태로만 판정한다 — 트랙을 한 번이라도 올렸는데 "upload"
// 설문 기록이 없으면 upload, 가입 7일이 지났는데 "day7" 기록이 없으면 day7.
// 과하게 묻지 않도록: 가입 하루 안 됐으면(첫 방문 가이드와 겹침) 안 묻고, 최근 7일 안에
// 설문을 한 번이라도 답하거나 닫았으면 안 묻는다. 트리거마다 평생 한 번(unique).
const DAY_MS = 86_400_000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ trigger: null });

  const [{ data: me }, { data: pulses }, { count: postCount }] = await Promise.all([
    supabase.from("users").select("created_at, status").eq("id", user.id).single(),
    supabase.from("feedback_pulses").select("trigger, created_at").eq("user_id", user.id),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  if (!me || me.status !== "approved") return NextResponse.json({ trigger: null });

  const now = Date.now();
  const ageMs = now - new Date(me.created_at).getTime();
  if (ageMs < DAY_MS) return NextResponse.json({ trigger: null });
  if ((pulses ?? []).some((p) => now - new Date(p.created_at).getTime() < 7 * DAY_MS)) {
    return NextResponse.json({ trigger: null });
  }

  const done = new Set((pulses ?? []).map((p) => p.trigger));
  let trigger: PulseTrigger | null = null;
  if (!done.has("upload") && (postCount ?? 0) > 0) trigger = "upload";
  else if (!done.has("day7") && ageMs >= 7 * DAY_MS) trigger = "day7";

  return NextResponse.json({ trigger });
}
