import { NextResponse, type NextRequest } from "next/server";

// 음원 다운로드 전용 프록시 — waveform-proxy(재생용 fetch)와 같은 이유로 서버에서 R2를
// 대신 받아와 같은 출처로 흘려보내되, 여기서는 Content-Disposition: attachment를 얹어서
// 내려준다. <a href download>만으로는 cross-origin(R2 signed URL) 링크를 Safari/맥이
// 다운로드 대신 그냥 열어버리는 경우가 있어서(사용자 보고) — Content-Disposition은
// download 속성과 달리 origin에 상관없이 모든 브라우저가 그대로 따른다.
const R2_HOST = `${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

function contentDisposition(rawName: string, fallbackExt: string) {
  const hasExt = /\.[a-zA-Z0-9]{2,4}$/.test(rawName);
  const fileName = (hasExt ? rawName : `${rawName}${fallbackExt}`).replace(/["\r\n]/g, "");
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_") || "download";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
  const name = request.nextUrl.searchParams.get("name") ?? "download";
  if (!target) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "잘못된 url입니다." }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== R2_HOST) {
    return NextResponse.json({ error: "허용되지 않은 호스트입니다." }, { status: 400 });
  }

  const res = await fetch(parsed.toString());
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "원본 파일을 가져오지 못했습니다." }, { status: 502 });
  }

  const sourceExt = parsed.pathname.includes(".") ? parsed.pathname.slice(parsed.pathname.lastIndexOf(".")) : "";

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": contentDisposition(name, sourceExt),
      "Cache-Control": "private, max-age=1800",
    },
  });
}
