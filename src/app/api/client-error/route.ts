import { NextResponse, type NextRequest } from "next/server";
import { reportErrorToDiscord } from "@/lib/discordError";

// 브라우저에서 잡힌 에러(global-error.tsx, window.onerror, unhandledrejection)를
// Discord로 흘려보내는 창구 (0035_error_monitoring). 웹훅 URL은 서버 전용 비밀이라
// 클라이언트가 직접 못 부르고 이 라우트를 거친다.
//
// 인증 없는 라우트(에러는 로그인 전에도 남) — 남용 방어는 (1) 바디 크기 상한,
// (2) discordError.ts 안의 창(window) 상한/쿨다운에 의존. 파일럿 규모라 이 정도로 둔다.

const MAX_BODY = 8_000; // 바이트

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "too large" }, { status: 413 });
  }

  let body: { message?: unknown; stack?: unknown; url?: unknown; kind?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const kind = str(body.kind);

  await reportErrorToDiscord({
    kind: kind === "global" || kind === "window" || kind === "promise" ? `client:${kind}` : "client",
    message: str(body.message) ?? "(클라이언트 에러, 메시지 없음)",
    stack: str(body.stack) ?? null,
    url: str(body.url) ?? request.headers.get("referer"),
  });

  return NextResponse.json({ ok: true });
}
