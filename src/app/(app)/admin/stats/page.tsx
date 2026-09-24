import { createClient } from "@/lib/supabase/server";
import type { AdminStats } from "@/lib/adminStats";
import { PERIODS, StatsView } from "./StatsView";

// 관리자 - 이용 통계(2단계). 수집(0079)된 방문·행동 기록과 기존 활동 테이블을 admin_stats()(0080)가
// 한 번에 집계해 준다. 기간(7/30/90일)과 운영자 포함 여부만 주소로 바꾼다(?days=&admins=1).
// 시간은 전부 한국 시간. 운영자 활동은 기본 제외(파일럿 초기엔 운영자 비중이 커서 섞이면 왜곡됨).

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; admins?: string }>;
}) {
  const { days: daysParam, admins } = await searchParams;
  const days = PERIODS.includes(Number(daysParam) as (typeof PERIODS)[number]) ? Number(daysParam) : 30;
  const includeAdmins = admins === "1";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats", { p_days: days, p_include_admins: includeAdmins });

  return (
    <StatsView
      s={error || !data ? null : (data as AdminStats)}
      days={days}
      includeAdmins={includeAdmins}
      errorMessage={error?.message}
    />
  );
}
