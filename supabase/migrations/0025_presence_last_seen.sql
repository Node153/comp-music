-- 우측 사이드바 "온라인" 목록을 실제 접속 여부로 바꾸기 위한 첫 단계.
-- 웹소켓 기반 실시간 presence(Supabase Realtime) 대신, 클라이언트가 주기적으로 이 컬럼만
-- 갱신하는 "마지막 활동 시각" 방식을 쓴다 — 몇 분 오차는 있지만 별도 인프라 없이 기존
-- 쿼리 기반 스택 그대로 구현 가능. 온라인/자리비움/오프라인 판정은 코드(RightSidebar)가
-- 이 값과 현재 시각의 차이로 계산한다(예: 2분 이내=온라인, 15분 이내=자리비움, 그 외=오프라인).
alter table users add column last_seen_at timestamptz;

-- 기존 회원은 null로 두면 바로 "오프라인" 취급되어 자연스럽다(실제로 접속해야 값이 채워짐).
-- users_update_self 정책(0002_rls.sql, id = auth.uid())이 이미 있어 별도 RLS 추가 불필요 —
-- 본인 행의 아무 컬럼이나 갱신 가능한 정책이라 last_seen_at도 그대로 커버된다.
