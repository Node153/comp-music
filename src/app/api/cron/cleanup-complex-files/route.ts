import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteR2Object } from "@/lib/r2/storage";

// memo(Complex) 채팅에 쌓이는 파일(재창작물 음원 + 이미지)은 DEMO와 달리 영구 보관 대상이
// 아니다 — memo는 "그때그때 스케치" 공동창작 공간이라 계속 쌓이면 R2 저장 비용만 늘어난다.
// 게시물 자체의 최대 노출시간(48시간, upload/page.tsx EXPIRE_HOURS_OPTIONS)보다 여유를 둬서
// 업로드 후 3일 지난 파일을 정리한다. 텍스트 채팅(file_key 없음)은 용량을 안 차지하니 그대로 둔다.
// service-role로 RLS를 우회해야 하므로 CRON_SECRET으로 보호(expire-posts와 동일 패턴).
const RETENTION_DAYS = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldFiles, error: selectError } = await supabase
    .from("post_chat_messages")
    .select("id, file_key")
    .not("file_key", "is", null)
    .lt("created_at", cutoff);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }
  if (!oldFiles || oldFiles.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  await Promise.all(oldFiles.map((row) => deleteR2Object(row.file_key!)));
  const { error: deleteError } = await supabase
    .from("post_chat_messages")
    .delete()
    .in(
      "id",
      oldFiles.map((row) => row.id),
    );

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: oldFiles.length });
}
