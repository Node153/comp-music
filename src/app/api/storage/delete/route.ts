import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteR2Object } from "@/lib/r2/storage";

// R2는 클라이언트에서 직접 삭제할 수 없어서(자격증명을 브라우저에 노출하지 않기 위해)
// 서버를 거친다. key가 본인 소유 경로(`${user.id}/...`)인지만 확인 — 기존
// posts_bucket_delete_own RLS 정책과 동일한 소유권 검증.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { key } = (await request.json()) as { key?: string };
  if (!key || !key.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "본인 파일만 삭제할 수 있습니다." }, { status: 403 });
  }

  await deleteR2Object(key);
  return NextResponse.json({ success: true });
}
