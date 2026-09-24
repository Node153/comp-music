// 이용 통계(0079) 유입 태그 — 메일·알림 링크에 ?src=를 붙여 "어떤 알림을 보고 들어왔는지" 센다.
// 도착하면 AnalyticsTracker가 link_open으로 기록하고 주소창에서 지운다. #게시물 앵커 앞에 넣는다.
export function withSrc(href: string, src: string): string {
  const hashAt = href.indexOf("#");
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  return `${base}${base.includes("?") ? "&" : "?"}src=${encodeURIComponent(src)}${hash}`;
}
