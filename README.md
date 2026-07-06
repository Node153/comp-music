# 음악 전공생 네트워킹 플랫폼 — Phase 0 MVP

전체 요구사항/DB/화면 설계는 [docs/spec.md](docs/spec.md) 참고 (원본: `music-network-mvp-spec.md`).

## 현재 스캐폴딩 범위 (Phase 0, spec 1.4)

- **인증심사**: 3단계(대기/승인/반려), 보완요청·재심사 자동화 없음
- **피드**: 공개범위 없음(전체공개 고정), 즉시 게시만, 노출시간(6/12/24/48h)은 유지
- **인터랙션**: 좋아요 + 댓글만 (이모지반응·북마크·신고/차단 제외)
- **협업**: 체크+역할텍스트만, 구조화된 제안 플로우(COLLAB) 없이 DM으로 직접 연결
- **제외**: 필터(S7), 사용자 검색(S19), 예약 게시

Phase 0 → Phase 1 전환은 코드베이스 교체가 아니라 "꺼져 있던 컬럼/화면을 켜는" 방식으로 설계되어 있음(spec 1.4).

## 스택

Next.js(App Router) + TypeScript + Tailwind + Supabase(Auth/DB/Storage/Realtime) — spec 5.1 추천안.

## 시작하기

1. Supabase 프로젝트 생성 후 `.env.local.example`을 `.env.local`로 복사하고 값 채우기
2. DB 마이그레이션 적용 (Supabase SQL Editor 또는 CLI로 `supabase/migrations/*.sql` 순서대로 실행)
   - `0001_init.sql`: Phase 0 테이블 9개 (users, profiles, verifications, posts, likes, comments, follows, conversations, messages)
   - `0002_rls.sql`: 미승인 사용자 전체 비노출(0-1)을 강제하는 baseline RLS 정책
   - `0003_auth_trigger.sql`: 회원가입 시 `auth.users` → `public.users` 자동 생성 트리거
   - `0004_admin_and_storage.sql`: 관리자 심사 처리용 RLS + 인증서류 private 스토리지 버킷(`verification-documents`)
   - `0005_posts_storage.sql`: 게시물 영상용 private 스토리지 버킷(`posts`)
   - `0006_notifications_and_guard.sql`: 인앱뱃지용 `notifications_seen_at` 컬럼 + `users_update_self` 정책의 권한 상승 취약점(자기 status/role을 직접 바꿀 수 있던 문제) 수정 트리거
   - `0007_messages_read_policy.sql`: DM 읽음처리·목록정렬에 필요한 messages/conversations update 정책 + messages 테이블 Realtime publication 등록
   - `0008_fix_admin_trigger_bootstrap.sql`: 0006의 자가승격 방지 트리거가 `auth.uid()`가 없는 SQL Editor/service-role 컨텍스트까지 막아버려 최초 관리자 부트스트랩이 불가능했던 문제 수정
3. 첫 관리자 계정 만들기: 가입 후 Supabase 대시보드 SQL Editor에서 아래 쿼리로 직접 변경 (Phase 0은 운영자 1인 수동 심사 — spec 0-5)
   ```sql
   update users set role = 'admin', status = 'approved' where email = '가입한 이메일';
   ```
4. 만료 처리 cron 연결: Vercel에 배포하면 `vercel.json`의 스케줄이 자동 등록됨. 로컬에서 테스트하려면 `.env.local`에 `CRON_SECRET`을 채우고 `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/expire-posts` 호출 (FEED-06)
5. 의존성 설치 및 개발 서버 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속.

## 폴더 구조

```
src/
  app/            화면별 라우트 (S1~S6, S8~S13, S16~S18 — spec 3.1)
  app/api/cron/    만료 처리(FEED-06) 등 cron 트리거용 route handler
  lib/supabase/    브라우저/서버/관리자(service-role) Supabase 클라이언트
  proxy.ts         승인 상태(1.2)·관리자 권한(2.8) 기반 라우트 가드
  types/database.ts  DB 스키마 대응 타입
supabase/migrations/  Phase 0 DDL + RLS + 스토리지 버킷
vercel.json           만료 처리 cron 스케줄(*/5분)
docs/spec.md           원본 개발 명세서
```

## 구현 상태

1. **인증·가입 플로우 (AUTH-01~06) — 완료.** 가입/로그인(Supabase Auth), 인증유형 선택 → 서류 업로드(Storage) → `verifications` 제출, 관리자 심사 대기열/상세/승인·반려, 승인 상태 기반 라우트 가드(`proxy.ts`)까지 연동됨.
2. **업로드·피드 (FEED-01~11) — 완료.** 영상 업로드(Storage, mp4/mov, 60초 소프트 경고), 캡션/콘텐츠유형/악기태그/노출시간/협업표시, 즉시 게시, 메인 피드(서명된 URL로 영상 재생, 최신 20개), 프로필 피드(FEED-10)·게시물 관리 화면(FEED-11 삭제), 만료 처리 cron endpoint(`/api/cron/expire-posts`). 영상 트랜스코딩/적응형 비트레이트(1.5 비기능 요구사항)는 미구현 — 업로드된 원본 파일을 그대로 재생.
3. **인터랙션 (INTERACT-01/02) — 완료.** 좋아요(토글, 낙관적 업데이트), 댓글(대댓글 1단계, 게시물 위 슬라이드업 패널). 인앱뱃지 알림(1.4)도 함께 구현 — 내 게시물에 달린 좋아요/댓글 중 마지막으로 프로필을 연 이후 발생한 건수를 "내 프로필" 링크에 뱃지로 표시(`users.notifications_seen_at` 컬럼 기준, 별도 알림 테이블 없이 Phase 0의 9-테이블 제약을 유지).
4. **프로필·팔로우 (PROFILE-02/03) — 완료.** 팔로우/언팔로우(낙관적 업데이트), 프로필의 팔로워·팔로잉 수, 팔로워/팔로잉 목록 화면(탭 전환).
5. **DM (DM-01~03) — 완료.** 프로필·피드에서 "메시지 보내기"로 1:1 대화 시작(중복 생성 방지), 대화 목록(안읽음 표시), 대화창(Supabase Realtime으로 새 메시지 즉시 반영, 게시물에서 시작된 대화는 해당 영상을 상단에 고정 노출).

Phase 0 화면(S1~S6, S8~S13, S16~S18) 전체가 실제로 동작하는 상태입니다. 남은 건 Phase 1 확장(공개범위 5단계, 예약게시, 필터, 검색, 협업제안 구조화, 영상 트랜스코딩 등)뿐입니다.

이 환경엔 Docker/Supabase CLI가 없어 실제 Supabase 프로젝트 없이는 런타임 검증(가입→심사→승인, 업로드→피드→좋아요/댓글→DM 등)을 끝까지 돌려보지 못했습니다. 빌드·린트·라우트 가드 리다이렉트만 확인된 상태이니, 실제 프로젝트를 연결한 뒤 전체 플로우를 한 번 직접 테스트해보는 걸 권장합니다.
