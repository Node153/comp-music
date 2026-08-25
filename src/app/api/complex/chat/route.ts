import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getR2SignedUrl } from "@/lib/r2/storage";

// ComplexPostChat의 "새로고침" 버튼용 — file_key(R2 오브젝트 키) → signed GET URL 변환이
// getR2SignedUrl(server-only)이라 클라이언트 컴포넌트에서 직접 못 하기 때문에 이 라우트가 필요.
// 세션 기반 createClient(server)를 써서 post_chat_messages_select_participant RLS가 그대로
// 적용됨 — 이 라우트 자체는 별도 권한 검사를 추가하지 않고 RLS에 위임한다.
const SIGNED_URL_EXPIRY_SECONDS = 60 * 30;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
  }

  const { data: rows, error } = await supabase
    .from("post_chat_messages")
    .select("id, sender_id, type, content, file_key, is_work, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 이름은 user_display 뷰(0018) — 요청자가 Companion이면 실명, 아니면 닉네임.
  const senderIds = [...new Set((rows ?? []).map((row) => row.sender_id))];
  const { data: senders } =
    senderIds.length > 0
      ? await supabase.from("user_display").select("id, display_name").in("id", senderIds)
      : { data: [] };
  const senderNameMap = new Map((senders ?? []).map((s) => [s.id, s.display_name]));

  const messages = await Promise.all(
    (rows ?? []).map(async (row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: senderNameMap.get(row.sender_id) ?? "알 수 없음",
      type: row.type,
      content: row.content,
      fileUrl: row.file_key ? await getR2SignedUrl(row.file_key, SIGNED_URL_EXPIRY_SECONDS) : null,
      fileName: row.file_key ? (row.file_key.split("/").pop() ?? null) : null,
      fileKey: row.file_key,
      isWork: row.is_work,
      createdAt: row.created_at,
    })),
  );

  return NextResponse.json({ messages });
}
