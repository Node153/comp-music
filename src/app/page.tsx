import { redirect } from "next/navigation";

// S1 랜딩(2026-09-23 재변경, 사용자 요청) — 비로그인 방문자를 곧장 로그인 화면으로 보내던 걸
// /feed로 바꾼다. /feed는 비로그인 방문자도 DEMO 탭은 그대로 볼 수 있게 이미 만들어져 있다
// (GuestTopNav/GuestSignupPrompt/GuestEngagementRow, 0024) — 스레드처럼 콘텐츠를 먼저 보여주고
// 좋아요/댓글 등 행동을 시도할 때(또는 35초 뒤 한 번) 가입을 부드럽게 유도하는 방식. 우리는
// 가입 후 심사까지 거쳐야 해서, 뭔지도 모른 채 로그인 화면부터 만나면 그 절차를 감수할
// 이유가 없다 — 실제 게시물을 먼저 보여주는 쪽이 낫다고 판단(정태인님이 9/17에 로그인 강제
// 리다이렉트로 바꿨던 걸 다시 되돌리는 결정). 로그인된 방문자도 /feed가 그대로 홈이라 분기
// 없이 동일하게 보낸다.
export default function LandingPage() {
  redirect("/feed");
}
