import Link from "next/link";
import { pageTitle, mutedText, errorText } from "@/components/ui/styles";
import {
  type AdminStats,
  SHARE_METHOD_LABELS,
  deviceLabel,
  formatDuration,
  installResultLabel,
  pct,
  sourceLabel,
} from "@/lib/adminStats";
import { DailyColumns, Funnel, HBarList, Heatmap, RetentionTable, Section, StatTile, TileGrid } from "./charts";

// /admin/stats 화면 그리기 — 데이터 조회(page.tsx)와 분리해 둔 순수 표시 컴포넌트.

export const PERIODS = [7, 30, 90] as const;

export function StatsView({
  s,
  days,
  includeAdmins,
  errorMessage,
}: {
  s: AdminStats | null;
  days: number;
  includeAdmins: boolean;
  errorMessage?: string;
}) {
  const href = (d: number, a: boolean) => `/admin/stats?days=${d}${a ? "&admins=1" : ""}`;

  const header = (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className={pageTitle}>이용 통계</h1>
        <p className={mutedText}>한국 시간 기준 · {includeAdmins ? "운영자 활동 포함" : "운영자 활동 제외"}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {PERIODS.map((d) => (
          <Link
            key={d}
            href={href(d, includeAdmins)}
            className={`rounded-full border px-3 py-1.5 ${
              d === days ? "border-gray-900 bg-gray-900 font-medium text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            최근 {d}일
          </Link>
        ))}
        <Link
          href={href(days, !includeAdmins)}
          className="rounded-full border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50"
        >
          {includeAdmins ? "운영자 빼고 보기" : "운영자 포함해서 보기"}
        </Link>
      </div>
    </div>
  );

  if (!s) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className={errorText}>통계를 불러오지 못했어요: {errorMessage ?? "알 수 없는 오류"}</p>
      </div>
    );
  }

  const o = s.overview;
  const l = s.listening;
  const c = s.creators;
  const guests = Math.max(0, o.visitors - o.logged_in_anons);
  const avgMemberDaily = o.member_days ? o.member_active_s / o.member_days : 0;
  const collectStarted = s.range.collect_started_at
    ? new Date(s.range.collect_started_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
    : null;
  const networkTotal = s.network.members;

  return (
    <div className="flex flex-col gap-4">
      {header}

      <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        방문·체류·기기·노출·청취 기록은 {collectStarted ? `${collectStarted}부터` : "수집을 시작한 뒤부터"} 쌓이고 있어요. 그 전
        기간은 0으로 보여요. 업로드·반응·리텐션은 기존 기록으로 계산해서 이전 기간도 나와요.
      </p>

      <Section title="한눈에 보기" hint="DAU/WAU/MAU는 기간 선택과 관계없이 지금 기준(로그인한 회원 수)">
        <TileGrid>
          <StatTile label="오늘 방문 회원 (DAU)" value={s.actives.dau.toLocaleString()} />
          <StatTile label="7일 방문 회원 (WAU)" value={s.actives.wau.toLocaleString()} />
          <StatTile
            label="30일 방문 회원 (MAU)"
            value={s.actives.mau.toLocaleString()}
            sub={`고착도(DAU/MAU) ${pct(s.actives.dau, s.actives.mau)}`}
          />
          <StatTile
            label="승인 회원"
            value={s.members.approved.toLocaleString()}
            sub={`심사 대기 ${s.members.pending} · 기간 내 가입 ${s.members.signups_in_range}`}
          />
          <StatTile
            label="방문자(기기 기준)"
            value={o.visitors.toLocaleString()}
            sub={`회원 ${o.member_visitors} · 비로그인 ${guests}`}
          />
          <StatTile label="방문 횟수" value={o.sessions.toLocaleString()} sub="30분 넘게 쉬면 새 방문" />
          <StatTile
            label="회원 1명 하루 이용 시간"
            value={formatDuration(avgMemberDaily)}
            sub={`방문 1회 중앙값 ${formatDuration(o.median_session_active_s)}`}
          />
          <StatTile label="총 청취 시간" value={formatDuration(o.total_listen_s)} sub="화면이 꺼진 백그라운드 재생 포함" />
        </TileGrid>
      </Section>

      <Section title="일별 추이" hint="막대에 마우스를 올리면 날짜별 값">
        <div className="flex flex-col gap-6">
          <DailyColumns label="방문 회원 수" data={s.daily.map((x) => ({ d: x.d, v: x.members }))} />
          <div className="grid gap-6 md:grid-cols-2">
            <DailyColumns label="업로드(Drop)" data={s.daily.map((x) => ({ d: x.d, v: x.uploads }))} />
            <DailyColumns label="반응(좋아요·댓글·Kick)" data={s.daily.map((x) => ({ d: x.d, v: x.reactions }))} />
          </div>
        </div>
      </Section>

      <Section
        title="언제 들어오나 (요일 × 시간)"
        hint="그 시간에 방문을 시작한 사람 수. 알림·주간 리포트 발송 시각과 운영자 반응 시간을 정하는 데 쓰세요."
      >
        <Heatmap cells={s.heatmap} />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="기기" hint="방문자(브라우저) 기준">
          <div className="flex flex-col gap-5">
            <HBarList rows={s.devices.type.map((x) => ({ label: deviceLabel(x.k), value: x.n }))} unit="명" />
            <HBarList rows={s.devices.os.map((x) => ({ label: x.k, value: x.n }))} unit="명" />
            <p className="text-xs text-gray-500">
              홈 화면 앱으로 연 방문자 {s.devices.pwa_visitors}명 ({pct(s.devices.pwa_visitors, o.visitors)})
            </p>
          </div>
        </Section>
        <Section title="브라우저" hint="카카오톡·인스타그램은 그 앱 안에서 링크를 연 경우">
          <HBarList rows={s.devices.browser.map((x) => ({ label: x.k, value: x.n }))} unit="명" />
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="어디서 들어왔나" hint="방문의 첫 진입 경로">
          <HBarList rows={s.sources.map((x) => ({ label: sourceLabel(x.k), value: x.sessions }))} unit="회" />
        </Section>
        <Section title="알림·공유 링크로 들어온 횟수" hint="이미 앱을 쓰던 중 알림을 눌러 들어온 것도 포함">
          <HBarList
            rows={s.link_opens.map((x) => ({ label: sourceLabel(x.k), value: x.n }))}
            unit="회"
            emptyText="아직 알림·공유 링크로 들어온 방문이 없어요"
          />
        </Section>
      </div>

      <Section
        title="감상"
        hint="노출 = 게시물 카드가 화면에 절반 이상 1초 넘게 보임. 같은 사람이 같은 글을 여러 번 봐도 1번으로 셉니다."
      >
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
          <Funnel
            steps={[
              { label: "노출", value: l.impression_pairs },
              { label: "노출 후 재생", value: l.impression_to_play },
            ]}
          />
          <Funnel
            steps={[
              { label: "재생 끝남", value: l.play_ends, hint: "1초 이상 들은 재생" },
              { label: "30초 이상", value: l.listened_30s },
              { label: "끝까지(90%+)", value: l.completed },
            ]}
          />
        </div>
        <div className="mt-5">
          <TileGrid>
            <StatTile label="노출 → 재생" value={pct(l.impression_to_play, l.impression_pairs)} />
            <StatTile label="들은 시간 중앙값" value={formatDuration(l.median_listened_s)} sub={`곡 길이 대비 ${Math.round(l.median_pct)}%`} />
            <StatTile
              label="재생 → 반응"
              value={pct(l.member_play_reacted, l.member_play_pairs)}
              sub="들은 회원이 그 글에 좋아요·댓글·Kick"
            />
            <StatTile
              label="공유"
              value={l.shares.toLocaleString()}
              sub={
                Object.entries(l.share_methods)
                  .map(([k, n]) => `${SHARE_METHOD_LABELS[k] ?? k} ${n}`)
                  .join(" · ") || "아직 없음"
              }
            />
          </TileGrid>
        </div>
      </Section>

      <Section
        title="창작자"
        hint="기간 내 올라온 글 기준. 반응은 작성자 본인 것을 뺀 좋아요·댓글·Kick. 업로드 후 반응이 없으면 다시 올리지 않는 경우가 많아요."
      >
        <TileGrid>
          <StatTile
            label="업로드"
            value={c.posts.toLocaleString()}
            sub={`업로더 ${c.uploaders}명 · 2개 이상 ${c.repeat_uploaders}명`}
          />
          <StatTile label="업로더 비율" value={pct(c.uploaders, c.active_members)} sub={`방문 회원 ${c.active_members}명 중`} />
          <StatTile
            label="반응 0개인 글"
            value={pct(c.no_reaction_older_24h, c.older_24h)}
            sub={`올라온 지 24시간 지난 ${c.older_24h}개 중 ${c.no_reaction_older_24h}개`}
          />
          <StatTile
            label="첫 반응까지 (중앙값)"
            value={c.median_hours_to_first ? formatDuration(c.median_hours_to_first * 3600) : "–"}
            sub={`24시간 안에 반응 ${pct(c.reacted_within_24h, c.posts)}`}
          />
          <StatTile label="글당 평균 반응" value={c.avg_reactions.toFixed(1)} />
          <StatTile label="글당 평균 청취자" value={c.avg_listeners.toFixed(1)} sub="5초 이상 들은 다른 회원" />
          <StatTile
            label="기간 내 반응"
            value={((c.reaction_mix.like ?? 0) + (c.reaction_mix.comment ?? 0) + (c.reaction_mix.kick ?? 0)).toLocaleString()}
            sub={`좋아요 ${c.reaction_mix.like ?? 0} · 댓글 ${c.reaction_mix.comment ?? 0} · Kick ${c.reaction_mix.kick ?? 0}`}
          />
          <StatTile
            label="업로드 시도 → 성공"
            value={`${s.uploads.posts} / ${s.uploads.submits}`}
            sub={`막힘 ${s.uploads.errors}회`}
          />
        </TileGrid>
        {s.uploads.top_errors.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500">업로드가 막힌 이유</p>
            <HBarList rows={s.uploads.top_errors.map((x) => ({ label: x.k, value: x.n }))} unit="회" />
          </div>
        )}
      </Section>

      <Section
        title="가입 주차별 리텐션"
        hint="가입 k주 뒤 그 주에 한 번이라도 활동(방문·업로드·재생·반응)한 비율. 운영자·탈퇴자 제외."
      >
        <RetentionTable rows={s.retention} />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Companion 연결" hint={`승인 회원 ${networkTotal}명 기준 · 중앙값 ${s.network.median}명`}>
          <HBarList
            total={networkTotal}
            unit="명"
            rows={[
              { label: "0명 (고립)", value: s.network.b0 },
              { label: "1~2명", value: s.network.b1_2 },
              { label: "3~5명", value: s.network.b3_5 },
              { label: "6명 이상", value: s.network.b6 },
            ]}
          />
        </Section>
        <Section title="홈 화면 설치 안내">
          <p className="mb-3 text-sm text-gray-700">
            안내 표시 iPhone {s.installs.shown.ios ?? 0}회 · Android {s.installs.shown.android ?? 0}회 · 실제 설치 {s.installs.installed}회
          </p>
          <HBarList
            rows={s.installs.results.map((x) => ({
              label: `${x.platform === "ios" ? "iPhone" : "Android"} · ${installResultLabel(x.result)}`,
              value: x.n,
            }))}
            unit="회"
            emptyText="아직 안내에 응답한 기록이 없어요"
          />
        </Section>
      </div>

      <Section title="많이 노출된 게시물" hint="기간 내 노출 순 10개">
        {s.top_posts.length === 0 ? (
          <p className="text-sm text-gray-400">아직 데이터가 없어요</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th className="py-2 pr-3 font-medium">게시물</th>
                  <th className="py-2 pr-3 text-right font-medium">노출</th>
                  <th className="py-2 pr-3 text-right font-medium">재생</th>
                  <th className="py-2 pr-3 text-right font-medium">재생률</th>
                  <th className="py-2 pr-3 text-right font-medium">완주</th>
                  <th className="py-2 text-right font-medium">평균 청취</th>
                </tr>
              </thead>
              <tbody>
                {s.top_posts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="max-w-[16rem] py-2 pr-3">
                      <Link
                        href={`/feed?feed=${p.visibility === "public" ? "completion" : "complex"}#${p.id}`}
                        className="block truncate text-gray-900 hover:underline"
                        title={p.title}
                      >
                        {p.title}
                      </Link>
                      <span className="text-xs text-gray-500">{p.author}</span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.impressions}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.plays}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{pct(p.plays, p.impressions)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.completed}</td>
                    <td className="py-2 text-right tabular-nums">
                      {p.avg_listened_s !== null ? formatDuration(p.avg_listened_s) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
