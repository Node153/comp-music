import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getR2ObjectStream } from "@/lib/r2/storage";
import { ALLOWED_UPLOAD_CONTENT_TYPES } from "@/lib/r2/allowedContentTypes";

export const dynamic = "force-dynamic";

// 프로필 커버 사진(0075) — /api/avatar/[userId]와 똑같은 방식(리다이렉트 없이 바이트를 직접
// 실어보내고, max-age+SWR 캐시). 이유는 그 라우트 주석 참고. 커버가 없으면 404 —
// CoverPhoto는 서버에서 커버 유무를 미리 받아서, 없으면 아예 <img>를 안 그린다.
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("cover_image_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.cover_image_url) {
    return NextResponse.json({ error: "no cover" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const { body, contentType } = await getR2ObjectStream(data.cover_image_url);
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  };
  if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) {
    headers["Content-Disposition"] = "attachment";
  }
  return new NextResponse(body, { headers });
}
