import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/reactionNotify";
import { OFFICIAL_ACCOUNT_ID } from "@/lib/officialAccount";
import { type AdminStats, deviceLabel, formatDuration, pct, sourceLabel } from "@/lib/adminStats";

// 이용 통계 3단계(0083) — 월요일 주간 리포트 크론(weekly-report)이 끝에 부른다: 운영자(관리자)에게
// 최근 7일 핵심 지표를 메일로 요약. 숫자는 /admin/stats와 같은 admin_stats_core()에서 온다(운영자 활동
// 제외). 같은 주에 크론이 두 번 돌아도 한 번만 가게 site_settings에 보낸 주를 적어 둔다.

const APP_URL = "https://compmusic.kr";
const PLACEHOLDER_EMAIL_SUFFIX = "@no-email.comp.local";
const SENT_KEY = "admin_weekly_stats_week";
const DOW = ["", "월", "화", "수", "목", "금", "토", "일"];

type Admin = ReturnType<typeof createAdminClient>;

export async function sendAdminWeeklyStats(admin: Admin, weekKey: string) {
  const { data: sent } = await admin.from("site_settings").select("value").eq("key", SENT_KEY).maybeSingle();
  if (sent?.value === weekKey) return { skipped: "already_sent" };

  const { data: recipients } = await admin
    .from("users")
    .select("id, email")
    .eq("role", "admin")
    .eq("status", "approved")
    .neq("id", OFFICIAL_ACCOUNT_ID);
  const to = (recipients ?? []).filter((u) => u.email && !u.email.endsWith(PLACEHOLDER_EMAIL_SUFFIX));
  if (to.length === 0) return { skipped: "no_recipients" };

  const { data, error } = await admin.rpc("admin_stats_core", { p_days: 7, p_include_admins: false });
  if (error || !data) throw new Error(`admin_stats_core 실패: ${error?.message ?? "no data"}`);
  const s = data as AdminStats;

  const subject = `[Compmusic 운영 리포트] 최근 7일 방문 회원 ${s.actives.wau}명 · 업로드 ${s.creators.posts}개`;
  const html = adminWeeklyReportHtml(s);
  let emailed = 0;
  for (const u of to) {
    try {
      await sendEmail(u.email, subject, html);
      emailed += 1;
    } catch (err) {
      console.error("[admin-weekly-stats] 메일 실패", err);
    }
  }

  await admin
    .from("site_settings")
    .upsert({ key: SENT_KEY, value: weekKey, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return { emailed };
}

export function adminWeeklyReportHtml(s: AdminStats) {
  const o = s.overview;
  const l = s.listening;
  const c = s.creators;
  const perMemberDay = o.member_days ? o.member_active_s / o.member_days : 0;

  const cell = (label: string, value: string) =>
    `<td style="padding:10px 6px;text-align:center;vertical-align:top;"><div style="font-size:20px;font-weight:700;">${escapeHtml(value)}</div><div style="font-size:12px;color:#777;">${escapeHtml(label)}</div></td>`;
  const table = (cells: string[]) =>
    `<table style="width:100%;border-collapse:collapse;background:#f4f4f5;border-radius:12px;margin:8px 0 18px;"><tr>${cells.join("")}</tr></table>`;
  const h = (t: string) => `<p style="font-size:15px;font-weight:700;margin:18px 0 0;">${escapeHtml(t)}</p>`;
  const li = (items: string[]) =>
    items.length ? `<ul style="margin:6px 0 0;padding-left:18px;color:#333;">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "";

  const busiest = [...s.heatmap]
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 3)
    .filter((x) => x.visitors > 0)
    .map((x) => `${DOW[x.dow]}요일 ${x.h}시 — ${x.visitors}명`);
  const sources = s.sources.slice(0, 3).map((x) => `${sourceLabel(x.k)} — ${x.sessions}회`);
  const devices = s.devices.type.map((x) => `${deviceLabel(x.k)} ${pct(x.n, o.visitors)}`).join(" · ");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:520px;">
<p style="font-size:17px;font-weight:700;margin-bottom:0;">최근 7일 Compmusic 운영 리포트</p>
<p style="margin-top:2px;font-size:12px;color:#777;">한국 시간 기준 · 운영자 활동 제외</p>
${h("방문")}
${table([
  cell("방문 회원(7일)", `${s.actives.wau}명`),
  cell("방문자(기기)", `${o.visitors}명`),
  cell("방문 횟수", `${o.sessions}회`),
  cell("1인 하루 이용", formatDuration(perMemberDay)),
])}
${h("창작")}
${table([
  cell("업로드", `${c.posts}개`),
  cell("업로더", `${c.uploaders}명`),
  cell("반응 0개 글(24h+)", pct(c.no_reaction_older_24h, c.older_24h)),
  cell("첫 반응까지", c.median_hours_to_first ? formatDuration(c.median_hours_to_first * 3600) : "–"),
])}
${h("감상")}
${table([
  cell("노출→재생", pct(l.impression_to_play, l.impression_pairs)),
  cell("30초 이상", pct(l.listened_30s, l.play_ends)),
  cell("끝까지", pct(l.completed, l.play_ends)),
  cell("재생→반응", pct(l.member_play_reacted, l.member_play_pairs)),
])}
${busiest.length ? `${h("가장 붐빈 시간")}${li(busiest)}` : ""}
${sources.length ? `${h("들어온 경로")}${li(sources)}` : ""}
${devices ? `<p style="margin-top:12px;color:#333;">기기: ${escapeHtml(devices)}</p>` : ""}
<p style="margin:22px 0;"><a href="${APP_URL}/admin/stats?days=7" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:999px;text-decoration:none;font-weight:600;">대시보드에서 자세히 보기</a></p>
<p style="font-size:12px;color:#999;">관리자 계정에만 매주 월요일 오전 9시에 발송돼요.</p>
</div>`;
}
