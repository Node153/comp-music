import { NextResponse, type NextRequest } from "next/server";

// SoundbarPlayer가 파형 분석(fetch + decodeAudioData)을 위해서만 쓰는 프록시.
// R2 signed URL을 브라우저에서 직접 fetch()하면 CORS 때문에 막히는 경우가 있는데
// (실제 재생용 <audio src>/<img src>는 태그라 CORS 영향을 안 받아서 문제없이 동작함),
// 서버 fetch는 CORS 적용 대상이 아니라서 여기서 대신 받아와 같은 출처로 흘려보낸다.
// url 파라미터 자체가 이미 30분짜리 접근 권한이 담긴 signed URL이라 별도 인가 검사는
// 필요 없고, 우리 R2 버킷 호스트가 맞는지만 확인해서 오픈 프록시가 되지 않게 막는다.
// getSignedUrl은 기본적으로 virtual-hosted-style URL(버킷명.계정ID.r2.cloudflarestorage.com)을
// 만든다 — path-style(계정ID.r2.cloudflarestorage.com/버킷명)이 아니라서 버킷명까지 포함해야 한다.
const R2_HOST = `${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("url");
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

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Cache-Control": "private, max-age=1800",
    },
  });
}
