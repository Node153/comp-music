import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2UploadUrl } from "@/lib/r2/storage";
import { ALLOWED_UPLOAD_CONTENT_TYPES } from "@/lib/r2/allowedContentTypes";
import { checkRateLimit } from "@/lib/rateLimit";

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

  // rate limit이 전무해서 승인된 유저 한 명이 이 라우트를 반복 호출해 R2 저장/이그레스
  // 비용을 통제 없이 늘릴 수 있었다 — 유저 단위로 짧은 창 안에서 발급 횟수를 제한한다.
  const uploadAllowed = await checkRateLimit("upload_url", user.id, 600, 60);
  if (!uploadAllowed) {
    return NextResponse.json({ error: "너무 많이 요청했어요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { filename, contentType } = (await request.json()) as {
    filename?: string;
    contentType?: string;
  };
  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename과 contentType이 필요합니다." }, { status: 400 });
  }

  // 클라이언트가 보낸 contentType을 검증 없이 그대로 R2 presigned URL에 실어주면, text/html
  // 등으로 업로드한 뒤 그 파일을 자기 프로필 사진 등으로 등록해 저장형 XSS를 만들 수 있다 —
  // 앱이 실제로 올리는 이미지/오디오/비디오 포맷만 화이트리스트로 허용한다.
  if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json({ error: "허용되지 않는 파일 형식입니다." }, { status: 400 });
  }

  // path prefix를 서버가 직접 만들어서 사용자가 남의 경로에 쓰지 못하게 강제
  // (기존 storage.foldername(name))[1] = auth.uid() RLS와 동일한 효과).
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${user.id}/${Date.now()}-${safeName}`;
  const url = await getR2UploadUrl(key, contentType);

  return NextResponse.json({ key, url });
}
