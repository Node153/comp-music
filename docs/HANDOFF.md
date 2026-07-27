# Comp 개발 인수인계 (2026-07-22 기준)

동료 개발자가 이 프로젝트에 합류할 때 필요한 정보를 정리한 문서입니다. Phase 0 스캐폴딩 관점의 원본 설명은 [README.md](../README.md), 전체 요구사항/DB/화면 설계는 [spec.md](spec.md) 참고.

## 0. 지금 당장 알아야 할 것 3가지

1. **GitHub 저장소가 아직 없습니다.** 로컬 git 저장소(`main` 브랜치, 커밋 14개)만 있고 `git remote`가 비어 있습니다. 협업하려면 먼저 GitHub repo를 만들고 `git remote add origin <url>`로 연결해야 합니다.
2. **최근 작업분(아래 "구현 상태" 4~6번)이 전부 미커밋 상태입니다.** `git status`에 수정 12개 + 신규 파일 13개가 워킹트리에만 있습니다. 저장소를 연결하기 전에 먼저 이 변경사항을 커밋할지 정리하세요(작업자 본인 확인 필요 — 실수로 되돌리지 마세요).
3. **배포는 Vercel CLI로 수동으로 하고 있습니다.** GitHub 연동이 안 되어 있어서 push해도 자동 배포되지 않습니다. 아래 "배포" 섹션 참고.

## 1. 프로젝트 개요

**Comp**(구 "음악넷") — 음악 전공생 네트워킹 플랫폼. 이름은 컴프레서(오디오 이펙트) + 재즈 컴핑(comping) + Companion 세 의미를 혼합.

**핵심 컨셉 — Completion / Complex**: 게시물을 두 종류로 나눕니다. 관련 기능을 만들 때 항상 이 구분을 기준으로 판단하세요.

- **Completion**(전체공개, `♾️`): 노출시간 영구, "완성작"을 대외적으로 보여주는 게시물. PEAK(인기) 반응 미터는 오직 Completion에만 적용.
- **Complex**(프라이빗, `🌀`, "나의 콤플렉스 공유"라는 언어유희): 초대된 특정 인원만 볼 수 있고 노출시간 설정 필수. 좋아요/댓글이 없고 전부 실시간 채팅(`ComplexPostChat.tsx`)으로 대체됨. 채팅에서 영상/이미지/오디오/텍스트 무엇이든 "작업물"로 올릴 수 있고, 올릴 때마다 원본(1차)을 이어받은 재창작물(2차, 3차...)로 스택처럼 쌓여 표시됨.
- 상단 탭 `/feed?feed=completion|complex`로 전환(기본값 completion). `feed=complex`일 때 자동으로 다크 테마로 전환.
- **Complex는 현재 100% mock 데이터**입니다(`COMPLEX_MOCK_SAMPLES`, `src/app/(app)/feed/page.tsx`). 초대 범위/채팅 메시지/작업물 스택 모두 로컬 state이며 새로고침하면 사라집니다. DB에 비공개 범위 필드·초대 테이블·채팅 테이블이 없어서 `feed=complex`일 땐 실제 DB 쿼리 자체를 스킵합니다. Phase 1에서 실제 연동 예정.

## 2. 로컬 개발 시작하기

```bash
npm install
cp .env.local.example .env.local   # 아래 값 채우기
npm run dev
```

필요한 환경변수 (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Supabase 프로젝트 자체(URL/키)는 별도로 전달받아야 합니다 — 이 저장소에는 포함돼 있지 않습니다. 신규 Supabase 키는 `sb_publishable_...` / `sb_secret_...` 형식입니다.

### DB 마이그레이션 (Supabase SQL Editor 또는 CLI로 순서대로 실행)

| 파일 | 내용 |
|---|---|
| `0001_init.sql` | Phase 0 테이블 9개 (users, profiles, verifications, posts, likes, comments, follows, conversations, messages) |
| `0002_rls.sql` | 미승인 사용자 전체 비노출 RLS baseline |
| `0003_auth_trigger.sql` | 회원가입 시 `auth.users` → `public.users` 자동 생성 트리거 |
| `0004_admin_and_storage.sql` | 관리자 심사 RLS + 인증서류 private 스토리지 버킷 |
| `0005_posts_storage.sql` | 게시물 영상용 private 스토리지 버킷 |
| `0006_notifications_and_guard.sql` | 인앱뱃지용 컬럼 + 자기 status/role 상승 취약점 방지 트리거 |
| `0007_messages_read_policy.sql` | DM 읽음처리/정렬 정책 + messages Realtime publication |
| `0008_fix_admin_trigger_bootstrap.sql` | 0006 트리거가 service-role 컨텍스트(SQL Editor)까지 막던 문제 수정 |
| `0009_posts_content_type_optional.sql` | `posts.content_type` nullable화 |

⚠️ **0009가 실제 DB에 적용됐는지 미확인 상태입니다.** 업로드 시 `content_type` not-null 에러가 나면 이것부터 의심하세요. 실행 링크: https://supabase.com/dashboard/project/ohpbypsemgovpijxoame/sql/new (계정 접근 권한 필요)

### 첫 관리자 계정 만들기

가입 후 Supabase 대시보드 SQL Editor에서:

```sql
update users set role = 'admin', status = 'approved' where email = '가입한 이메일';
```

### 만료 처리 cron

Vercel에 배포하면 `vercel.json`의 스케줄이 자동 등록됩니다. 로컬 테스트:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/expire-posts
```

## 3. 배포

- 주소: https://comp-music.vercel.app
- Vercel 계정 `hoolala0723`, 팀 `comp808`, 프로젝트명 `comp-music`
- **GitHub 연동이 안 돼 있어 push 자동배포가 안 됩니다.** 코드 수정 후 수동 배포:
  ```bash
  cd ~/Desktop/프로젝트/music-network-mvp
  vercel deploy --prod
  ```
- Vercel Hobby(무료) 플랜은 cron이 하루 1회로 제한됩니다.
- `*.vercel.app` 도메인은 프로젝트 생성 시점 이름 1개만 Deployment Protection 면제가 붙습니다. `vercel alias`로는 못 바꾸고, 원하는 이름으로 새 프로젝트를 만들어야 합니다(`vercel link --project <이름>`).

## 4. 구현 상태

Phase 0 화면(S1~S6, S8~S13, S16~S18)은 전부 동작합니다:

1. **인증·가입 (AUTH-01~06)** — 가입/로그인, 인증유형 선택 → 서류 업로드 → 심사 제출, 관리자 심사 대기열/승인·반려, 승인 상태 기반 라우트 가드(`proxy.ts`)
2. **업로드·피드 (FEED-01~11)** — 영상 업로드, 캡션/콘텐츠유형/악기태그/노출시간/협업표시, 즉시 게시, 메인 피드, 프로필 피드, 게시물 삭제, 만료 처리 cron. 영상 트랜스코딩은 미구현(원본 그대로 재생)
3. **인터랙션 (INTERACT-01/02)** — 좋아요, 댓글(대댓글 1단계), 인앱뱃지 알림
4. **프로필·팔로우 (PROFILE-02/03)** — 팔로우/언팔로우, 팔로워/팔로잉 목록
5. **DM (DM-01~03)** — 1:1 대화, Realtime 갱신, 게시물에서 시작된 대화 고정 노출
6. **Comp 리브랜딩 + Completion/Complex 분리 (미커밋)** — 위 1번 참고. 실시간 반응 미터(PEAK), 페이지 이동해도 안 끊기는 하단 오디오 플레이어(`GlobalPlayerBar`), 라이트/다크 테마 전환, Discord풍 톤 개편, Complex 채팅+작업물 스택

Phase 1 확장(공개범위 5단계, 예약게시, 필터, 검색, 협업제안 구조화 등)은 **명시적 요청 전까지 구현하지 않습니다** — spec 1.4 참고.

## 5. 작업 방식 (합의된 원칙)

- **"UI 먼저 완벽하게, 데이터는 나중"**: 새 화면/기능은 mock 데이터로 UI부터 완성하고, 확인 후 실제 DB 연동 단계로 넘어갑니다.
- **레퍼런스는 Discord/Facebook이 아님**: 메인 콘텐츠(미디어)가 화면을 지배하고, 사이드 패널은 얇고 낮은 위계(아바타+이름 한 줄 등)로. 좌우 사이드바 폭은 고정(220px), 접힘/펼침은 내부 콘텐츠만 토글(트랙 폭을 바꾸면 좌우 비대칭 버그 재발).
- **보조 패널은 삭제보다 "기본 접힘 + 아이콘 펼치기"** 우선.
- **반응 유도 버튼(좋아요/댓글/메시지)은 위계를 낮추지 말 것** — 다른 UI는 톤다운해도 이 버튼들은 크고 굵게 유지.
- **좌측 "모든 장르" 리스트는 색상 아이콘 없이 깔끔한 정렬만** (단, 피드 카드 악기 태그는 색상 매핑 있음 — `TAG_COLOR_CLASSES`, `src/app/(app)/feed/page.tsx`).
- **DB 스키마 변경은 SQL 파일만 작성 + Supabase 대시보드에서 직접 실행** — service-role 키로 프로덕션 DB를 코드에서 직접 조작하지 않습니다.

## 6. 재사용 가능한 기술 패턴

- **페이지 이동해도 안 끊기는 상태(재생 등)**: `/feed`, `/upload`, `/messages`, `/profile/*`가 전부 같은 `(app)` 라우트그룹 layout을 공유해서 Next.js가 리마운트하지 않습니다. 실제 엘리먼트(`<video>` 등)를 `{children}` 밖, 공유 `layout.tsx`에 마운트하면 페이지를 넘나들어도 상태가 유지됩니다. (`NowPlayingContext.tsx` + `GlobalPlayerBar.tsx` + `PostVideo.tsx`)
- **hydration mismatch 없는 실시간 시계 컴포넌트**: 마운트 전엔 placeholder만 렌더링하고 마운트 후 실제 값 표시 (`TimeLimitBadge.tsx` 패턴). 서버/클라이언트 `Date.now()` 차이로 값이 어긋나는 걸 방지.
- **원격 브라우저 도구로 `<input type=file>` 테스트**: 네이티브 OS 파일 선택창을 못 열므로, JS로 `DataTransfer`에 `File` 객체를 넣고 change 이벤트를 dispatch하는 방식 사용.
- **RLS는 컬럼 단위 제어가 안 됨** → 민감 컬럼(status/role 등) 보호는 BEFORE UPDATE 트리거로 처리 (`0006_notifications_and_guard.sql` 패턴).
- **가입 테스트 시 `example.com`류 이메일은 Supabase가 거부** — gmail +alias(`user+test1@gmail.com`) 사용. 이메일 컨펌 기본 켜짐.
- **로컬 dev 서버 재시작 시**: 서버가 살아있는 채로 `.next`를 지우면 Turbopack 캐시가 깨집니다. 서버를 완전히 종료한 뒤 지우세요.

## 7. 다음으로 이어갈 만한 것

- ~~미커밋 변경사항 정리 및 커밋~~ — 완료 (2026-07-23, 기능 단위로 나눠 커밋)
- ~~GitHub 저장소 생성 → `git remote add origin` → push → Vercel Git 연동 전환~~ — 완료 (2026-07-24, `Node153/comp-music` repo, Vercel `comp808/comp-music`와 Git 연동 완료. 처음엔 private로 만들었으나, Vercel Hobby 팀은 소유자 외 커밋의 배포를 차단해서(팀 멤버 초대는 유료) public으로 전환해서 해결함 — `.env.local`은 애초에 커밋된 적 없어서 노출 리스크는 없음)
- 0009 마이그레이션 적용 여부 확인
- Complex 기능(초대 범위/채팅/작업물 스택)의 실제 Supabase 연동 — 현재 전부 mock
- 2026-07-15로 잡았던 "메인탭 완성" 마감은 지난 상태 — 다음 목표/우선순위 재설정 필요
