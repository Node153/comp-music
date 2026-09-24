import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 웹 푸시 구독 저장/삭제(0074). push_subscriptions는 서버 전용 테이블(RLS 정책 없음)이라
// 로그인 확인 후 service_role로 쓴다. endpoint가 구독의 신원 — 같은 브라우저에서 다른 계정으로
// 다시 구독하면 upsert로 소유자만 옮긴다(이전 계정 알림이 이 기기로 새지 않게).
type Body = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://") || endpoint.length > 2000) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.endpoint) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
