import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 이용 통계 수집 창구(0079) — src/lib/analytics.ts가 30초마다/탭을 떠날 때 sendBeacon으로 보낸다.
// 로그인 여부는 쿠키로 여기서 판단한다(클라이언트가 보낸 user_id는 받지 않음). 저장은 service role로
// analytics_ingest()만 호출 — 테이블엔 insert 정책이 없다.
// 인증 없는 라우트(가입 전 방문도 재야 함)라 남용 방어는 바디 크기·이벤트 개수 상한, 이벤트 이름
// 화이트리스트, 봇 UA 무시로 한다. 통계는 부가 기능이라 실패해도 항상 204로 조용히 끝낸다.

const MAX_BODY = 64_000;
const MAX_EVENTS = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|vercel-screenshot|facebookexternalhit|kakaotalk-scrap/i;

const EVENT_NAMES = new Set([
  "page_view",
  "link_open",
  "post_impression",
  "play_start",
  "play_end",
  "share",
  "upload_submit",
  "upload_error",
  "install_prompt_shown",
  "install_prompt_result",
  "pwa_installed",
]);

const META_TEXT_KEYS = [
  "device_type",
  "os",
  "browser",
  "entry_path",
  "entry_src",
  "referrer_host",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

const noContent = () => new NextResponse(null, { status: 204 });

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 ? v.slice(0, max) : null;
}

function int(v: unknown, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(Math.round(v), max)) : 0;
}

// props는 평평한 원시값 객체만, 키 20개·값 200자까지.
function cleanProps(v: unknown): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v).slice(0, 20)) {
    const key = k.slice(0, 40);
    if (typeof val === "string") out[key] = val.slice(0, 200);
    else if (typeof val === "number" && Number.isFinite(val)) out[key] = val;
    else if (typeof val === "boolean" || val === null) out[key] = val;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (BOT_RE.test(ua)) return noContent();

  const raw = await request.text();
  if (raw.length > MAX_BODY) return noContent();

  let body: { sid?: unknown; aid?: unknown; meta?: unknown; a?: unknown; l?: unknown; e?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return noContent();
  }

  const sid = typeof body.sid === "string" && UUID_RE.test(body.sid) ? body.sid : null;
  const aid = typeof body.aid === "string" && UUID_RE.test(body.aid) ? body.aid : null;
  if (!sid || !aid) return noContent();

  const metaIn = (body.meta && typeof body.meta === "object" ? body.meta : {}) as Record<string, unknown>;
  const meta: Record<string, string | number | boolean | null> = {};
  for (const key of META_TEXT_KEYS) meta[key] = str(metaIn[key], key === "entry_path" ? 300 : 100);
  meta.is_pwa = metaIn.is_pwa === true;
  meta.screen_w = int(metaIn.screen_w, 10000);
  meta.screen_h = int(metaIn.screen_h, 10000);
  meta.user_agent = ua.slice(0, 400);

  const events = (Array.isArray(body.e) ? body.e : [])
    .slice(0, MAX_EVENTS)
    .flatMap((e: unknown) => {
      if (!e || typeof e !== "object") return [];
      const ev = e as Record<string, unknown>;
      if (typeof ev.n !== "string" || !EVENT_NAMES.has(ev.n)) return [];
      return [
        {
          n: ev.n,
          t: typeof ev.t === "number" && Number.isFinite(ev.t) ? Math.round(ev.t) : Date.now(),
          p: str(ev.p, 300),
          post: typeof ev.post === "string" && UUID_RE.test(ev.post) ? ev.post : null,
          x: cleanProps(ev.x),
        },
      ];
    });

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    userId = typeof sub === "string" && UUID_RE.test(sub) ? sub : null;
  } catch {
    userId = null;
  }

  const { error } = await createAdminClient().rpc("analytics_ingest", {
    p_session_id: sid,
    p_user_id: userId,
    p_anon_id: aid,
    p_meta: meta,
    p_active_s: int(body.a, 600),
    p_listen_s: int(body.l, 600),
    p_events: events,
  });
  if (error) console.error("[analytics] ingest failed", error.message);

  return noContent();
}
