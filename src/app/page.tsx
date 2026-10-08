import { redirect } from "next/navigation";

// S1 랜딩(2026-10-08, 사용자 요청) — 비로그인 방문자는 /feed 미리보기 대신 로그인 화면부터
// 보여준다. 로그인된 방문자는 proxy.ts가 이 화면에 오기 전에 /feed(또는 /status)로 보낸다.
export default function LandingPage() {
  redirect("/login");
}
