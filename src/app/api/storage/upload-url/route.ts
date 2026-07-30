import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2UploadUrl } from "@/lib/r2/storage";

// R2는 Supabase Storage처럼 버킷 자체에 RLS를 걸 수 없어서, presigned PUT URL을 발급하기 전에
// 여기서 로그인·승인 여부를 직접 확인한다 — 0005 마이그레이션의
// posts_bucket_insert_own/is_approved 정책과 같은 의도를 애플리케이션 레이어에서 재현.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("users").select("status").eq("id", user.id).single();
  if (profile?.status !== "approved") {
    return NextResponse.json({ error: "승인된 사용자만 업로드할 수 있습니다." }, { status: 403 });
  }

  const { filename, contentType } = (await request.json()) as {
    filename?: string;
    contentType?: string;
  };
  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename과 contentType이 필요합니다." }, { status: 400 });
  }

  // path prefix를 서버가 직접 만들어서 사용자가 남의 경로에 쓰지 못하게 강제
  // (기존 storage.foldername(name))[1] = auth.uid() RLS와 동일한 효과).
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${user.id}/${Date.now()}-${safeName}`;
  const url = await getR2UploadUrl(key, contentType);

  return NextResponse.json({ key, url });
}
