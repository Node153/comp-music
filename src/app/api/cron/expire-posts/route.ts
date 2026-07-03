import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// FEED-06: 노출시간 만료 시 soft-expire. 5~10분 주기 cron이 호출 (vercel.json 참고).
// service-role로 RLS를 우회해 모든 사용자의 posts를 갱신해야 하므로 CRON_SECRET으로 보호.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error, data } = await supabase
    .from("posts")
    .update({ status: "expired" })
    .eq("status", "published")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
