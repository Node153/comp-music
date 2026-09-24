// 좋아요/댓글 저장 직후 작성자에게 즉시 알림(메일·웹 푸시)을 보내 달라고 서버에 알린다(0074).
// 결과를 기다리지 않는 fire-and-forget — 알림이 늦거나 실패해도 반응 UI에는 영향이 없어야 한다.
// keepalive: 좋아요 누르고 바로 페이지를 떠나도 요청이 끊기지 않게.
// 0076: play(처음 5초 재생 — 청취자 수/PEAK 진행 알림), published(새 글 — Companion 알림)도 같은 입구.
export function notifyReaction(
  payload:
    | { kind: "like" | "play" | "published"; postId: string }
    | { kind: "comment"; commentId: string },
) {
  fetch("/api/notify/reaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
