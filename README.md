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
3. 첫 관리자 계정 만들기: 가입 후 Supabase 대시보드에서 해당 사용자의 `public.users.role`을 `admin`으로 직접 변경 (Phase 0은 운영자 1인 수동 심사 — spec 0-5)
4. 의존성 설치 및 개발 서버 실행

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 접속.

## 폴더 구조

```
src/
  app/            화면별 라우트 (S1~S6, S8~S13, S16~S18 — spec 3.1)
  lib/supabase/    브라우저/서버 Supabase 클라이언트
  proxy.ts         승인 상태(1.2)·관리자 권한(2.8) 기반 라우트 가드
  types/database.ts  DB 스키마 대응 타입
supabase/migrations/  Phase 0 DDL + RLS
docs/spec.md          원본 개발 명세서
```

## 구현 상태

1. **인증·가입 플로우 (AUTH-01~06) — 완료.** 가입/로그인(Supabase Auth), 인증유형 선택 → 서류 업로드(Storage) → `verifications` 제출, 관리자 심사 대기열/상세/승인·반려, 승인 상태 기반 라우트 가드(`proxy.ts`)까지 연동됨. `docker`/`supabase` CLI가 없는 이 환경에서는 실제 Supabase 프로젝트 없이 런타임 검증을 하지 못했으므로, 실제 프로젝트 연결 후 가입→심사→승인 전체 플로우를 한 번 직접 테스트해볼 것을 권장.
2. 업로드·피드 (FEED-01~11) — 아직 스텁. 영상 업로드/트랜스코딩, 만료 처리 cron 필요
3. 인터랙션 (좋아요/댓글) — 아직 스텁
4. 프로필·팔로우 — 아직 스텁
5. DM — 아직 스텁

각 미구현 페이지는 화면 구조와 spec ID를 주석으로 남긴 스텁 상태입니다.
