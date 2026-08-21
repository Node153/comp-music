-- 이메일 알림 설정(PROFILE-03) — 웹만 있고 모바일 앱이 없어서 실시간 푸시가 불가능하니,
-- 이메일이 사실상 유일한 알림 채널이 된다. 다만 이메일 알림은 스팸처럼 느껴지기 쉬워서
-- 종류별로 따로 켜고 끌 수 있게 한다. "내가 답해야 하는" 성격이 강한 것(노크/Companion
-- 신청/메시지)은 기본값 켜짐, "그냥 참고용"인 것(좋아요/PEAK)은 기본값 꺼짐으로 시작해서
-- 처음부터 메일함이 시끄러워지는 걸 막는다. 댓글은 참고용에 가깝지만 대화가 이어질 수
-- 있어서 좋아요보다는 무겁게 보고 일단 꺼짐으로 시작(필요하면 나중에 조정).
-- 실제 발송 로직(Resend 등 이메일 서비스 연동)은 별도 작업 — 이 마이그레이션은 설정
-- 저장용 컬럼만 추가한다.
alter table users
  add column email_notify_like boolean not null default false,
  add column email_notify_comment boolean not null default false,
  add column email_notify_knock boolean not null default true,
  add column email_notify_companion_request boolean not null default true,
  add column email_notify_message boolean not null default true,
  add column email_notify_peak boolean not null default false;
