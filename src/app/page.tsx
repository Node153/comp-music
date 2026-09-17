import { redirect } from "next/navigation";

// S1 랜딩 (spec 1.2) — 비로그인 방문자는 곧장 로그인 화면으로 보낸다. 로그인 화면의
// "아직 계정이 없으신가요? 가입하기" 링크로 가입 동선은 그대로 열려 있다.
export default function LandingPage() {
  redirect("/login");
}
