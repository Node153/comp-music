import { NextResponse } from "next/server";

// 공유 받기(Web Share Target) 대비 — 평소엔 서비스 워커(public/sw.js)가 이 POST를 가로채 파일을
// 캐시에 넣고 업로드 화면으로 보낸다. 서비스 워커가 아직 설치 전이라 서버까지 온 경우엔 파일을
// 이어받을 방법이 없어서, 업로드 화면으로 보내 다시 골라달라고 안내한다(shared=missing).
export async function POST(request: Request) {
  return NextResponse.redirect(new URL("/upload?shared=missing", request.url), 303);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/upload", request.url), 303);
}
