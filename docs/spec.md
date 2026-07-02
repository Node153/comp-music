# 음악 전공생 네트워킹 플랫폼 — MVP 개발 명세서

> 범위: Phase 1(MVP) 기준 작성. Phase 2/3는 5장 로드맵에서 별도 정리.
> 목적: 기획 문서가 아닌 **개발 착수 가능한 수준**의 요구사항/기능/화면/DB/일정 명세.

---

## 0. 정책 결정 사항 (확정)

원문 요구사항만으로는 결정할 수 없었던 항목들에 대해 논의를 거쳐 확정한 내용입니다.

| # | 항목 | 확정 내용 |
|---|---|---|
| 1 | 미승인(심사대기/보완요청/반려) 사용자의 피드 접근 | **완전 차단**. 블러 미리보기 없이 전체 비노출. 심사 상태 화면(S5)만 접근 가능 |
| 2 | 노출시간 만료 후 영상 처리 | **영구 보관**(soft-expire 후 자동삭제 없음). 메인피드 노출만 종료되고, 프로필 피드에는 계속 남음. 삭제는 작성자가 직접 선택할 때만 발생 |
| 3 | "공개범위"와 "필터"의 관계 | **공개범위**=게시자가 누구에게 보일지 정하는 권한 제어, **필터**=그 권한 내에서 탐색용 검색 조건. 필터는 공개범위를 절대 우회 못 함 |
| 4 | 인증 서류의 보관·파기 정책 | 승인/반려 확정 후 **원본 파일은 90일 후 자동 파기**, 심사 결과(메타데이터)만 영구 보관 |
| 5 | 인증 심사 담당 인력 | MVP는 **운영자 1인 수동 심사**, 평균 심사 기한 48시간 내 처리 목표로 화면/알림 설계 |
| 6 | 신고/차단 기능 | **MVP에서 제외**. Phase 2로 이전 (6장 리스크 참고 — 의도적으로 보류한 리스크임) |
| 7 | 피드와 프로필의 관계 | **별도의 "보관함" 엔티티 없음.** 인스타그램처럼 피드/스토리를 구분하지 않고, 게시물은 하나의 타입(스토리형 릴스)만 존재. 프로필 페이지는 본인이 올린 게시물(활성 + 만료 포함, 삭제되지 않은 모든 것)을 모아 보여주는 **별도 피드 뷰**이며, 노출은 게시물의 `visibility` 값을 그대로 따름 (아래 8번 참고) |
| 8 | 공개범위 단계 | 기존 4단계(전체공개/같은전공/같은학교/팔로워공개)에 **비공개(나만보기)**를 추가해 5단계로 확정. "공개/일부공개/비공개"로 단순화하면: 공개=전체공개, 일부공개=같은전공·같은학교·팔로워공개 중 선택, 비공개=나만보기 |
| 9 | 공개범위 변경 시점 | 업로드 시 1차 설정하되, **게시 이후(활성/만료 무관)에도 작성자가 언제든 변경 가능** (예: 처음엔 팔로워공개였다가 나중에 전체공개로 전환) |
| 10 | 로그인 방식 | 이메일+비밀번호 기본, 학교 이메일(.ac.kr 등) 보유 시 심사 보조 신호로만 활용(자동승인 아님) |
| 11 | 협업체인 포크 권한 | 별도 승인절차 없음. 1차 게시물의 visibility 조건을 만족하는(=볼 수 있는) 사용자라면 누구나 다운로드·포크 가능 |
| 12 | 협업체인 원본파일 타입 | 1차 버전은 wav/mp3/mp4만 지원, 추후(Phase3) 프로젝트 단위(DAW 파일) 업로드로 확장 |
| 13 | 협업체인 메인피드 노출 방식 | **(제 판단으로 확정, 이견 있으면 변경 가능)** 1차(원본)만 메인피드(S6)에 노출. 2차/3차는 스택 안에서만 열람 가능하되, 작성자 본인 프로필 피드(FEED-10)에는 정상 노출되어 기여 기록은 보존 |

---

## 1. 요구사항 정의

### 1.1 서비스 정의 (재확인)
- **형태**: 폐쇄형(승인제) 세로형 릴스·스토리 기반 네트워킹 플랫폼
- **대상**: 음악 전공 재학/졸업생, 음악 활동 증빙이 있는 활동자
- **핵심 가치**: ① 작업물/연주를 짧은 영상으로 노출 → ② 전공·악기·학교·지역·협업가능여부 기반 발견 → ③ DM/협업제안으로 실제 연결
- **명시적 제외**: 입시정보, 진로상담, 취업정보, 유학정보, 일반 게시판형 텍스트 커뮤니티

### 1.2 사용자 유형 및 권한 매트릭스

| 상태 | 피드 열람 | 좋아요/댓글/반응 | 영상 업로드 | DM | 협업제안 | 비고 |
|---|---|---|---|---|---|---|
| 비로그인 | 랜딩페이지만 | ✗ | ✗ | ✗ | ✗ | 가입 유도 화면 |
| 심사대기 | **접근 불가(전체 비노출)** | ✗ | ✗ | ✗ | ✗ | 심사 상태 화면만 접근 가능 |
| 보완요청 | **접근 불가(전체 비노출)** | ✗ | ✗ | ✗ | ✗ | 서류 재제출 화면만 접근 가능 |
| 반려 | **접근 불가(전체 비노출)** | ✗ | ✗ | ✗ | ✗ | 재심사 요청 화면만 접근 가능 |
| **승인** | 전체(공개범위 내) | ✓ | ✓ | ✓ | ✓ | 정상 사용자 |
| 관리자 | 전체 | ✓ | - | - | - | 심사 화면 접근 권한 추가 |

### 1.3 MVP(Phase 1) 범위 정의

| 기능 영역 | Phase 1 (MVP) | Phase 2 | Phase 3 |
|---|---|---|---|
| 인증 심사 | 수동 심사, 상태 5종 | 서류 OCR 보조, 학교 마스터DB 자동대조 | - |
| 영상 업로드/피드 | 업로드·예약·노출시간·만료, 공개범위, 필터 | 추천 알고리즘, 조회수 통계 | AI 자동 태깅 |
| 인터랙션 | 좋아요·댓글·이모지·관심표시 | 신고·차단, 신고 처리 어드민 | - |
| 메시지 | 1:1 DM | 그룹 DM, 푸시알림 | - |
| 협업제안 | 구조화 폼(역할/메시지) 발송·수락·거절 | 제안 매칭 추천 | 계약/정산 연동 |
| 프로필/팔로우 | 기본 프로필, **본인 게시물 피드(활성+만료 통합, 공개범위 기반)** | 포트폴리오 임베드(SoundCloud 등) | - |
| 검색 | **닉네임 + 전공 + 학교 기반 사용자 검색** | 게시물 통합검색(캡션·태그 등) | - |
| 알림 | 인앱 뱃지만 | 웹푸시/이메일 알림 | 모바일 네이티브 푸시 |

### 1.4 진짜 MVP (Phase 0) — 최소 출시 범위

Phase 1(MVP)도 이미 꽤 큽니다. 핵심 가설(①폐쇄형 인증 ②노출시간 있는 릴스 ③발견→연결)만 빠르게 검증하고 싶다면, 아래처럼 한 번 더 줄일 수 있습니다. **줄이는 기준은 "핵심 가설 검증에 꼭 필요한가"** 입니다.

> **우선순위 원칙**: 이 서비스는 매칭형(협업 성사가 목적)이 아니라 콘텐츠형(작업물을 보여주고 반응받는 게 목적) 서비스입니다. 매칭형은 성사되면 재방문 동기가 떨어지는 구조(틴더형)지만, 콘텐츠형은 반응(좋아요·댓글)을 받을수록 재방문 동기가 커지는 구조(인스타형)입니다. 그래서 **협업제안은 구조화하지 않고 가볍게(DM) 처리**하고, **반응(특히 댓글)은 좋아요만으론 부족해 Phase 0에도 포함**합니다 — "음악 작업물에 동료 피드백을 받는다"는 경험 자체가 이 서비스의 핵심 재방문 루프이기 때문입니다.

| 기능 | Phase 1(기존 MVP) | **Phase 0(진짜 MVP)** | 비고 |
|---|---|---|---|
| 회원가입/인증심사(AUTH) | 5단계 상태(대기/승인/반려/보완요청/재심사) | **3단계(대기/승인/반려)** | 보완요청·재심사 자동화 플로우 제외 — 반려 시 "문의는 이메일로" 안내, 운영자가 수동 대응(0-5 SLA는 동일 유지) |
| 공개범위(FEED-03) | 5단계(전체/전공/학교/팔로워/비공개) | **전체공개 1단계만** | 인증 게이트 자체가 1차 필터라서, 세분화된 공개범위 없이도 "폐쇄형" 가치는 유지됨. major/school 매칭 로직·UI 자체가 통째로 사라짐 |
| 게시 시점(FEED-04) | 즉시/예약 | **즉시 게시만** | 예약 게시는 검증 우선순위가 낮음 |
| 노출시간(FEED-05/06) | 6h/12h/24h/48h, 만료 후 영구보관 | **그대로 유지** | 서비스의 핵심 차별점이라 축소 안 함 |
| 협업가능 표시(FEED-07) | 체크+역할텍스트 → COLLAB 구조화 플로우 | **체크+역할텍스트만, 바로 DM 연결** | 협업제안 전용 테이블/화면(COLLAB-01~03, S14/S15) 통째로 제외. 매칭 성사 후 이탈 리스크를 피하려는 의도적 단순화 |
| **인터랙션** | 좋아요·댓글·이모지·북마크 | **좋아요 + 댓글** | 댓글은 핵심 재방문 루프라 유지(위 원칙 참고). 이모지반응·북마크는 댓글보다 부가적이라 계속 제외 |
| **알림** | 인앱뱃지 | **인앱뱃지(좋아요·댓글 수신 시)** | 반응을 받아도 사용자가 모르면 재방문 동기가 안 생김 — 작은 기능이지만 Phase 0에 필수로 포함 |
| 피드 필터(FEED-08) | 전공/악기/학교/지역/협업여부 | **제외(최신순 피드만)** | 초기 사용자 수가 적을 때는 필터 가치가 낮음 |
| 사용자 검색(SEARCH) | 닉네임+전공+학교 | **제외** | 초기 사용자 수가 적으면 검색 가치가 낮음 |
| 팔로우(PROFILE-02/03) | 포함 | **포함(유지)** | 구현 비용이 작고 "다시 찾아보기" 용도로 유용 — 더 줄이고 싶으면 가장 먼저 뺄 수 있는 여유 항목 |
| 관리자 서류뷰어(ADMIN-02) | 인라인 뷰어 | **새창에서 파일 열기** | 인라인 뷰어 구현비용 절감, 기능은 동일 |

**Phase 0 화면 수**: 14개 (S1~S5, S6, S8~S13, S16~S18) — 기존 Phase1의 19개에서 5개 감소 (S7 필터패널, S14/S15 협업제안, S19 검색 제외). 댓글은 별도 화면이 아니라 게시물 상세뷰 안의 패널로 들어가므로 화면 수에 영향 없음

**Phase 0 DB 테이블**: `users, profiles, verifications, posts, likes, comments, follows, conversations, messages` — 9개 (기존 12개에서 `reactions, bookmarks, collab_proposals` 3개 테이블만 제외). `posts.visibility` 컬럼은 남겨두고 기본값 `public`으로 고정 — 나중에 Phase1 기능을 켤 때 컬럼을 다시 안 만들어도 되도록

**Phase 0 → Phase 1 전환**: 컬럼/테이블을 빼는 게 아니라 "안 쓰는 채로 시작"하는 구조이므로, Phase 0 출시 후 사용자 반응을 보고 위 표의 항목들을 하나씩 다시 켜는 방식으로 갈 수 있습니다. 즉 Phase 0는 별도 코드베이스가 아니라 Phase 1 설계의 부분집합입니다.

### 1.5 비기능 요구사항

| 구분 | 요구사항 |
|---|---|
| 성능 | 세로형 피드 무한스크롤 시 초기 로딩 1.5초 이내(3G 기준 X, 일반 LTE/Wi-Fi 기준), 영상은 적응형 비트레이트로 저사양 환경 대응 |
| 보안 | 인증서류는 암호화 저장(at-rest), 서류 열람은 관리자 권한 + 접근 로그 기록 |
| 개인정보 | 한국 개인정보보호법 기준 민감정보(학생증 등) 처리 — 수집 목적 명시, 보관기간 명시, 파기 절차 자동화 (0-4 참고) |
| 모바일 대응 | 반응형 웹(모바일 우선) — 촬영 후 즉시 업로드를 고려해 모바일 브라우저 카메라/파일 접근 권한 처리 |
| 가용성 | MVP 단계 SLA 별도 목표 없음(개인/소규모 운영 기준), 단 예약게시·만료처리 cron은 5~10분 단위 정확도 필요 |
| 법적 | 업로드 영상의 저작권/2차사용 범위를 이용약관에 명시 (협업제안으로 이어질 때 분쟁 예방) |

---

## 2. 기능 명세 (Phase 1 / MVP)

### 2.1 인증·가입 (AUTH)

| ID | 기능 | 설명 | 처리 로직 / 예외 |
|---|---|---|---|
| AUTH-01 | 회원가입 | 이메일+비밀번호(또는 학교 이메일) 입력 | 이메일 중복 검사, 비밀번호 규칙(8자 이상) |
| AUTH-02 | 인증유형 선택 | "전공생" / "활동자" 중 선택 | 선택에 따라 AUTH-03 동적 폼 분기 |
| AUTH-03 | 인증서류 업로드 | 전공생: 재학증명서/학생증/졸업증명서/학교이메일; 활동자: 음반발매·음원링크·공연포스터·크레딧 등 | 파일당 10MB 제한(이미지/PDF), 최소 1종 이상 필수 |
| AUTH-04 | 심사 상태 관리 | 대기→승인/반려/보완요청→(보완요청 시)재제출→재심사 | 상태 변경 시 사용자에게 인앱 안내 + (Phase2)이메일 알림 |
| AUTH-05 | 재심사 요청 | 반려 후 사용자가 사유 확인 후 재신청 | 반려 사유는 관리자가 텍스트로 기록, 사용자에게 노출 |
| AUTH-06 | 관리자 심사 처리 | 서류 뷰어 + 승인/반려/보완요청 버튼 + 사유 입력 | 처리 즉시 사용자 status 갱신, 처리 로그(reviewer_id, 시각) 기록 |

### 2.2 릴스 업로드 & 피드 (FEED)

| ID | 기능 | 설명 | 처리 로직 / 예외 |
|---|---|---|---|
| FEED-01 | 영상 업로드 | 세로형 영상 선택/촬영, 최대 길이 60초 제안(요구사항에 명시 없어 임시값, 확정 필요) | 지원 포맷 mp4/mov, 업로드 후 서버에서 트랜스코딩 |
| FEED-02 | 캡션/태그 입력 | 캡션 텍스트, content_type(작곡/연주/연습/리허설/즉흥/합주), 악기 태그(복수) | content_type·악기태그는 필수, 최소 1개 |
| FEED-03 | 공개범위 설정 | 전체공개/같은전공/같은학교/팔로워공개/**비공개(나만보기)** — 5단계 | 작성자 profile의 major/school 값과 매칭해서 viewer 필터링. **게시 이후에도 작성자가 언제든 변경 가능**(0-9) |
| FEED-04 | 게시 시점 설정 | 즉시 게시 또는 예약 게시(날짜/시간) | 예약 시각은 작성자 타임존(KST 고정 가능) 기준 |
| FEED-05 | 노출시간 설정 | 6h/12h/24h/48h 중 선택 | **메인 피드(S6) 노출 기간만 의미**. published_at + 선택값 = expires_at 자동 계산 |
| FEED-06 | 만료 처리 | 노출시간 종료 시 자동 soft-expire | cron이 5~10분 주기로 expires_at 지난 게시물 status를 'expired'로 변경. **자동 하드삭제 없음(영구보관, 0-2)** — 메인피드에서만 사라지고 프로필 피드(FEED-10)에는 계속 노출 |
| FEED-07 | 협업가능 표시 | 게시물 단위로 "협업 구함" 여부 + 찾는 역할(보컬/세션/편곡 등 자유 텍스트) | 피드 필터의 "협업 가능 여부"와 연동 |
| FEED-08 | 피드 필터 | 전공/악기/학교/지역/협업가능여부 | 필터는 공개범위로 1차 필터링된 결과 안에서만 동작 (0-3) |
| FEED-09 | 세로형 피드 UI | 인스타 릴스/스토리 유사 풀스크린 스와이프 | 자동재생, 무음 시작(접근성/데이터 절약) |
| FEED-10 | 프로필 피드 (보관함 역할) | 별도 엔티티 없이, 본인이 올린 게시물(status='published' 또는 'expired', 'deleted' 제외)을 시간순으로 모아 보여주는 프로필 전용 그리드 뷰 | 노출 여부는 게시물별 visibility(FEED-03) 그대로 적용. 본인이 보면 전체(비공개 포함) 노출, 타인이 보면 visibility 조건 충족하는 것만 노출 |
| FEED-11 | 게시물 직접 삭제 | 작성자가 활성/만료 게시물을 본인 의사로 영구 삭제 | 삭제 시 video_url 등 실제 파일도 스토리지에서 제거(하드 삭제), 복구 불가 안내 후 확인 단계 필수 |

### 2.3 인터랙션 (INTERACT)

| ID | 기능 | 설명 |
|---|---|---|
| INTERACT-01 | 좋아요 | 게시물당 사용자 1회, 토글 가능 |
| INTERACT-02 | 댓글 | 텍스트 댓글, 대댓글(1단계만, 무한 depth 제외) |
| INTERACT-03 | 이모지 반응 | 사전 정의된 이모지 셋(예: 🔥👏🎵😍) 중 1개 선택, 변경 가능 |
| INTERACT-04 | 관심 표시(북마크) | 마이페이지 "관심목록"에서 모아보기 |

> 신고·차단 기능은 0-6 결정에 따라 MVP에서 제외했습니다. Phase 2 진입 전 운영 중 악용 사례가 누적되면 우선순위를 앞당기는 것을 권장합니다(6장 리스크 참고).

### 2.4 메시지 (DM)

| ID | 기능 | 설명 |
|---|---|---|
| DM-01 | 1:1 대화 시작 | 게시물 상세에서 "메시지 보내기" 또는 프로필에서 시작 |
| DM-02 | 대화 목록 | 최근 메시지순 정렬, 읽음/안읽음 표시 |
| DM-03 | 메시지 발신 출처 표시 | 특정 게시물에서 시작된 DM은 해당 게시물 썸네일을 대화 상단에 고정 노출 |

### 2.5 협업 제안 (COLLAB)

| ID | 기능 | 설명 |
|---|---|---|
| COLLAB-01 | 협업 제안 보내기 | 게시물에서 "협업 제안" 버튼 → 구조화 폼(찾는 역할, 메시지) 작성 |
| COLLAB-02 | 제안 목록(받은/보낸) | 상태별(대기/수락/거절) 탭 구분 |
| COLLAB-03 | 제안 수락/거절 | 수락 시 DM 스레드 자동 생성/연결 |

### 2.6 프로필 & 팔로우 (PROFILE)

| ID | 기능 | 설명 |
|---|---|---|
| PROFILE-01 | 프로필 조회/수정 | 학교, 전공, 악기(복수), 지역, 협업가능여부, 소개글, 외부 포트폴리오 링크 |
| PROFILE-02 | 팔로우/언팔로우 | 단방향 팔로우 |
| PROFILE-03 | 팔로워/팔로잉 목록 | 본인 및 타인 프로필에서 조회 가능 |
| PROFILE-04 | 내 게시물 관리 | 본인의 모든 게시물(활성/예약중/만료됨, FEED-10 프로필 피드 기준)을 한 화면에서 확인, 게시물별 공개범위 변경(FEED-03) 및 영구 삭제(FEED-11) 가능 |

### 2.7 사용자 검색 (SEARCH)

| ID | 기능 | 설명 | 처리 로직 / 예외 |
|---|---|---|---|
| SEARCH-01 | 사용자 검색 | 닉네임(이름) 텍스트 검색 + 전공/학교 조건(단독 또는 조합) | 닉네임은 부분일치(ILIKE), 전공·학교는 선택형(드롭다운 또는 자동완성) 권장. **승인된(approved) 사용자만 검색 결과에 노출** — 심사대기/반려 상태 사용자는 검색되지 않음 |
| SEARCH-02 | 검색 결과 리스트 | 프로필 카드(아바타, 이름, 학교·전공 뱃지, 팔로우 버튼) 노출 | 카드 탭 시 S9 프로필로 이동. 단, 검색은 "사람 존재 자체"를 찾는 기능이고 프로필 진입 후 보이는 게시물은 FEED-03 visibility 조건을 그대로 따름(검색 가능 ≠ 게시물 전체 공개) |

> 검색은 사람을 찾는 기능, FEED-08 필터는 게시물(피드)을 좁히는 기능으로 역할이 다릅니다. 검색 결과에 사람이 나와도 그 사람 게시물이 전부 보이는 건 아닙니다.

### 2.8 관리자 (ADMIN)

| ID | 기능 | 설명 |
|---|---|---|
| ADMIN-01 | 심사 대기열 | 제출일 오름차순 큐, SLA(48h) 임박 항목 강조 |
| ADMIN-02 | 서류 뷰어 | 이미지/PDF 인라인 뷰어 |

---

## 3. 화면 설계

### 3.1 화면 목록 (IA)

| # | 화면명 | 접근 권한 |
|---|---|---|
| S1 | 랜딩/온보딩 | 전체 |
| S2 | 회원가입 | 전체 |
| S3 | 인증유형 선택 | 가입 직후 |
| S4 | 인증서류 업로드 (전공생/활동자 동적 폼) | 가입 직후~보완요청 상태 |
| S5 | 심사 상태 안내 (대기/반려/보완요청 공용, 상태별 분기 표시) | 미승인 상태 |
| S6 | 메인 피드 (세로형 풀스크린, 활성 게시물만) | 승인 사용자만 접근 가능(미승인은 완전 차단) |
| S7 | 필터 패널 (바텀시트) | 승인 사용자 |
| S19 | 사용자 검색 (닉네임/전공/학교) | 승인 사용자 |
| S8 | 업로드 화면 (영상선택→메타정보→공개범위→노출시간→게시방식) | 승인 사용자 |
| S9 | 프로필 (본인/타인 분기, **활성+만료 게시물을 모은 그리드 = FEED-10**) | 전체(열람은 visibility 조건 적용), 수정은 본인만 |
| S10 | 프로필 수정 | 본인 |
| S11 | 팔로워/팔로잉 목록 | 전체 |
| S12 | DM 목록 | 승인 사용자 |
| S13 | DM 대화창 | 승인 사용자 |
| S14 | 협업제안 목록(받은/보낸) | 승인 사용자 |
| S15 | 협업제안 작성 폼 | 승인 사용자 |
| S16 | 마이 게시물 관리 (S9의 본인 전용 관리 모드 — 공개범위 변경/삭제 컨트롤 추가) | 승인 사용자 |
| S17 | 관리자 - 심사 대기열 | 관리자 |
| S18 | 관리자 - 심사 상세 | 관리자 |

### 3.2 핵심 사용자 플로우

**[플로우 A] 가입 → 인증 → 승인**
1. S2 가입 → 2. S3 유형 선택 → 3. S4 서류 업로드 → 4. S5 대기 화면 진입 (이 시점부터 승인 전까지 피드·프로필·DM 등 전체 기능 접근 불가)
2. (관리자가 S17→S18에서 처리)
3. 승인 시: S5 → S6 메인피드로 자동 전환 + 환영 안내
4. 보완요청 시: S5에 보완 사유 노출 → S4 재진입(추가서류만 업로드)
5. 반려 시: S5에 반려 사유 + "재심사 요청" 버튼 노출

**[플로우 B] 영상 업로드 → 게시 → 메인피드 만료 → 프로필 피드 보관**
1. S6에서 업로드 버튼 → S8 진입
2. 영상 선택 → 캡션/태그 입력 → 공개범위 선택(5단계 중) → 노출시간 선택 → 즉시/예약 선택 → 게시
3. (예약인 경우) cron이 scheduled_at 도달 시 자동 published 전환
4. cron이 expires_at 도달 시 자동 soft-expire → **S6 메인피드에서만 사라짐**. S9 프로필 피드(=S16 관리 모드)에는 visibility 조건에 따라 계속 노출(영구, 0-2)
5. 작성자는 S16에서 언제든 해당 게시물의 공개범위를 바꾸거나(0-9), 영구 삭제(FEED-11) 가능

**[플로우 C] 발견 → 협업 제안 → 연결**
1. S6 피드에서 필터(S7)로 탐색 → 관심있는 게시물 탭 (또는 S19 사용자 검색으로 특정 인물을 바로 찾아 S9 프로필로 진입하는 대체 경로도 가능)
2. 게시물 상세에서 "협업 제안" 버튼 → S15 작성 → 전송
3. 수신자는 S14에서 확인 → 수락 시 S13 DM 스레드 자동 생성 → 이후 대화 진행

### 3.3 메인 피드 화면 핵심 요소 (와이어프레임 설명)
- 풀스크린 세로 영상 (배경)
- 우측: 좋아요 / 댓글 / 이모지반응 / 관심표시 / 공유(메시지로 보내기) 버튼 세로 배치 (인스타 릴스 패턴)
- 좌하단: 작성자 프로필(아바타+이름+학교/전공 뱃지), 캡션, 악기 태그 칩
- 좌하단 또는 별도 CTA: "협업 제안" 버튼 (collab_available=true인 게시물만 강조 노출)
- 상단: 필터 진입 아이콘
- 미승인 사용자는 이 화면 자체에 진입 불가(S5로 리다이렉트)

> **UI 강조 우선순위**: 좋아요·댓글 버튼이 시각적으로 가장 눈에 잘 띄어야 합니다(아이콘 크기·위치 우선). "협업 제안" 버튼은 보조적으로 배치 — 1.4에서 정리한 원칙(반응 > 매칭)을 화면 위계에도 그대로 반영한 것입니다.

### 3.4 프로필 피드 화면 핵심 요소 (S9 / S16)
- 상단: 프로필 정보(아바타, 이름, 학교·전공·악기 뱃지, 소개글, 팔로워/팔로잉 수, 협업가능여부)
- 본문: 그리드형 썸네일 목록 — 활성 게시물과 만료 게시물이 시간순으로 함께 노출(둘을 구분하는 탭 없음, 0-7)
- 타인이 볼 때: 본인에게 visibility 조건이 허용된 게시물만 그리드에 노출(허용되지 않는 항목은 카운트에도 미포함)
- 본인이 볼 때(S16 관리 모드): 비공개 포함 전체 노출 + 각 썸네일 롱프레스/케밥메뉴로 "공개범위 변경", "삭제" 액션 제공

---

## 4. DB 설계

### 4.1 관계 개요
- `users` 1:1 `profiles`, 1:N `verifications`(재신청 시 여러 건 누적)
- `users` 1:N `posts`
- `posts` 1:N `likes`, `comments`, `reactions`, `bookmarks`, `collab_proposals`
- `users` N:M `follows` (self-referencing)
- `users` N:M `conversations` → 1:N `messages`

### 4.2 테이블 스키마 (DDL 수준)

```sql
-- 사용자 계정
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),              -- 소셜로그인 시 NULL 허용
  name          VARCHAR(100) NOT NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'pending',  -- pending/approved/rejected/supplement_requested
  role          VARCHAR(20) NOT NULL DEFAULT 'user',     -- user/admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 프로필
CREATE TABLE profiles (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  user_type         VARCHAR(20) NOT NULL,   -- student/activist
  school            VARCHAR(150),
  major             VARCHAR(100),
  instruments       TEXT[],                 -- 복수 악기
  region            VARCHAR(100),
  collab_available  BOOLEAN NOT NULL DEFAULT true,
  bio               TEXT,
  portfolio_links   JSONB,                  -- {"soundcloud": "...", "youtube": "..."}
  profile_image_url VARCHAR(500)
);
-- 검색(SEARCH-01)용 인덱스: 닉네임 부분일치는 MVP 규모에선 ILIKE로 충분, 사용자 수 늘면 pg_trgm 확장 고려
CREATE INDEX idx_users_name ON users(name);
CREATE INDEX idx_profiles_school ON profiles(school);
CREATE INDEX idx_profiles_major ON profiles(major);

-- 인증 심사
CREATE TABLE verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL,       -- student/activist
  status        VARCHAR(30) NOT NULL DEFAULT 'pending',
  documents     JSONB NOT NULL,             -- [{"doc_type":"transcript","file_url":"..."}]
  reject_reason TEXT,
  reviewer_id   UUID REFERENCES users(id),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);

-- 게시물(릴스)
CREATE TABLE posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url           VARCHAR(500) NOT NULL,
  thumbnail_url       VARCHAR(500),
  caption             TEXT,
  content_type        VARCHAR(30) NOT NULL,  -- composition/performance/practice/rehearsal/improv/ensemble
  instrument_tags     TEXT[],
  visibility          VARCHAR(20) NOT NULL DEFAULT 'public', -- public/major/school/followers/private(나만보기)
  collab_available    BOOLEAN NOT NULL DEFAULT false,
  collab_role_needed  VARCHAR(200),
  status              VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled/published/expired/deleted (expired도 영구보관, deleted만 하드삭제)
  scheduled_at        TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  expire_hours        INT NOT NULL,          -- 6/12/24/48
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_status_expires ON posts(status, expires_at);
CREATE INDEX idx_posts_status_scheduled ON posts(status, scheduled_at);

-- 좋아요
CREATE TABLE likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 댓글
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id),   -- 대댓글 1단계
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 이모지 반응
CREATE TABLE reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 관심표시(북마크)
CREATE TABLE bookmarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- 팔로우
CREATE TABLE follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, followee_id)
);

-- 대화방
CREATE TABLE conversations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id      UUID NOT NULL REFERENCES users(id),
  user_b_id      UUID NOT NULL REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_a_id, user_b_id)
);

-- 메시지
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  content         TEXT NOT NULL,
  source_post_id  UUID REFERENCES posts(id),  -- 영상에서 바로 보낸 DM 출처
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);

-- 협업 제안
CREATE TABLE collab_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  proposer_id  UUID NOT NULL REFERENCES users(id),
  receiver_id  UUID NOT NULL REFERENCES users(id),
  role_needed  VARCHAR(200),
  message      TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/accepted/declined
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 신고/차단 테이블은 MVP에서 제외(0-6). Phase 2 진입 시 reports(reporter_id, target_type, target_id, reason),
-- blocks(blocker_id, blocked_id) 형태로 추가 예정. 스키마 변경만으로 추가 가능하도록 posts/users는 이미 UUID PK 사용.
```

### 4.3 핵심 비즈니스 로직 — 게시물 상태 전이
```
scheduled --(scheduled_at 도달, cron)--> published
published --(expires_at 도달, cron)--> expired   [메인피드(S6) 노출만 종료, 프로필피드(S9)는 계속 노출]
expired   --(자동 전이 없음, 영구 보관, 0-2)-->  (그대로 유지)
* published/expired 어느 상태든 작성자가 직접 삭제 시 즉시 deleted (하드 삭제, 파일도 스토리지에서 제거)
* published/expired 어느 상태든 작성자가 visibility를 언제든 변경 가능 (0-9), status 전이와는 무관한 별도 동작
```

---

## 5. 개발 단계

### 5.1 추천 기술 스택

| 구분 | **추천안** | 대안 | 저비용안 |
|---|---|---|---|
| 프론트엔드 | Next.js (App Router) + TypeScript + Tailwind | React(Vite) SPA | Next.js + Tailwind (동일) |
| 백엔드 | Next.js API Routes (풀스택 단일 레포) | NestJS/Express 별도 서버 | Next.js API Routes |
| DB | PostgreSQL (Supabase) | PostgreSQL (AWS RDS) | PostgreSQL (Supabase 무료티어) |
| 인증 | Supabase Auth | NextAuth + 자체 DB | Supabase Auth |
| 파일/영상 저장 | Supabase Storage + Cloudflare Stream(트랜스코딩) | AWS S3 + Mux | Cloudflare R2(저장, egress 무료) + 서버리스 ffmpeg 직접 트랜스코딩 |
| 실시간(DM) | Supabase Realtime | Pusher/Ably | Supabase Realtime(동일, 무료티어 활용) |
| 배치/cron | Supabase Edge Functions(스케줄) | 자체 워커 서버 + node-cron | Vercel Cron(무료티어 한도 내) |
| 호스팅 | Vercel | AWS(EC2/ECS) 직접 구성 | Vercel 무료/Hobby 티어 |
| **장단점** | 솔로/소규모 개발에 가장 빠름. 통합 관리로 운영 부담 최소화 | 통제력·확장성은 높지만 인프라 직접 구성·운영 부담 큼 | 초기비용 거의 0이지만 트래픽 늘면 트랜스코딩 직접 관리 부담 발생 |

> **결론**: MVP는 **추천안(Next.js+Supabase+Vercel)** 으로 시작 — 의사결정/리스크 항목(0장)이 해소되는 대로 즉시 스캐폴딩 가능한 조합입니다. 사용자 수가 늘어 영상 트래픽이 커지면 그때 영상 저장/전송만 R2+자체 트랜스코딩(저비용안)으로 분리 이전하는 것을 권장합니다.

### 5.2 Phase 1(MVP) 개발 순서

| 스프린트 | 내용 | 비고 |
|---|---|---|
| S0. 인프라 셋업 | Next.js+Supabase 프로젝트 생성, DB 마이그레이션(4.2 스키마), 기본 인증 셋업 | 1주 |
| S1. 인증·가입 플로우 | AUTH-01~06, S2~S5 화면, 관리자 심사 화면(S17~18) | 가장 먼저 — 다른 모든 기능의 게이트이므로 우선순위 1위 |
| S2. 업로드·피드 | FEED-01~09, S6/S7/S8, cron(만료·예약 처리) | 영상 트랜스코딩 연동 포함, 가장 난이도 높은 구간 |
| S3. 인터랙션 | INTERACT-01~04 | 피드 위에 얹는 작업이라 S2 이후 진행 |
| S4. 프로필·팔로우·검색 | PROFILE-01~04, SEARCH-01~02, S9~S11, S19 | |
| S5. DM·협업제안 | DM-01~04, COLLAB-01~03, S12~S15 | |
| S6. 통합 QA + 베타 출시 | 전체 플로우 점검, 모바일 브라우저 테스트 | |

> 기간은 1인 개발 기준 러프 추정이며, 실제 개발 숙련도·작업 가능 시간에 따라 달라집니다. 정확한 일정이 필요하시면 주당 가용 작업시간을 알려주시면 스프린트별 기간을 다시 추정해 드릴 수 있습니다.

> **Phase 0(1.4 진짜 MVP)로 시작할 경우**: 위 스프린트 구조는 그대로지만 각 스프린트 작업량이 가벼워집니다 — S1에서 보완요청/재심사 플로우 제외, S2에서 공개범위 5단계·예약게시·필터 제외, S3는 좋아요+댓글만 구현(이모지반응/북마크 제외, 인앱뱃지 알림 포함), S5는 COLLAB 워크플로우 전체 제외(DM만 구현). S4(검색)는 스프린트 자체가 사라집니다.

### 5.3 Phase 2/3 로드맵 (확장 기능)

| 기능 | 설명 | Phase | 비고 |
|---|---|---|---|
| 추천 알고리즘 | 전공·악기·협업이력·인터랙션 데이터 기반 피드 추천 | 2 | |
| 협업 매칭 고도화 | 협업제안 패턴 학습 기반 매칭 추천(예: 비슷한 역할을 자주 찾는 사람과 매칭) | 2 | |
| 영상 자동 썸네일 생성 | 업로드 시 프레임 자동 추출(예: 1초 지점)로 썸네일 자동 지정, 수동 선택도 유지 | 2 | 구현 난이도 낮은 편 — 효과 대비 비용이 작아 MVP 막바지에 당겨올 수도 있음 |
| 영상 업로드 전 클라이언트 압축 | 업로드 전 브라우저/앱 단에서 1차 압축(데이터 사용량·업로드 시간 절감) | 2 | MVP의 서버측 트랜스코딩(5.1 참고)과는 별개 단계. 둘 다 있어야 완성형 |
| 인스타그램 연동 | 게시 시 인스타 스토리/릴스로 동시 크로스포스팅, 또는 프로필에 인스타 링크 연동 | 2 | 어떤 연동인지(크로스포스팅 vs 단순 링크) 구체화 필요. 크로스포스팅은 Meta Graph API 정책·심사 제약 있음 |
| 신고/차단 | MVP에서 의도적 제외(0-6) | 2 | 운영 부담 커지면 우선순위 상향 권장 |
| 학교 마스터DB / 서류 OCR | 인증 심사 자동화 보조 | 2 | |
| 웹푸시/이메일 알림 | | 2 | |
| *(추가 제안)* 조회수·인터랙션 통계 | 본인 콘텐츠 반응 데이터 확인(크리에이터 인사이트) | 2 | 사용자 리텐션에 직접적 효과 — 우선순위 상위권 추천 |
| *(추가 제안)* 협업 성사 쇼케이스 → **협업 체인(재창작가능 콘텐츠)** | 1차 게시물에 2차/3차가 스택으로 쌓이는 구조. 상세 설계는 5.4 참고 | 2 | "협업 연결"이 핵심가치라는 점과 가장 잘 맞는 확장. 설계는 미리 완료, MVP 포함 여부는 별도 결정 필요 |
| *(추가 제안)* 뱃지·활동 보상 | 활발한 협업·인터랙션에 뱃지 부여(게이미피케이션) | 2 | |
| 공연/녹음실/연습실 제휴 | 제휴사 리스트 노출 + 할인코드/예약 연계 | 3 | **순수 개발 작업이 아니라 실제 제휴 영업(BD)이 함께 필요** — 기능 자체는 단순해도 운영 리소스 비중이 큼 |
| 광고 배너 | | 3 | 아래 비교 참고 |
| *(추가 제안)* 라이브 스트리밍 | 실시간 합주·잼세션 방송 | 3 | 릴스 포맷의 자연스러운 확장 |
| *(추가 제안)* 멤버십/프리미엄 | 노출시간 연장, 프로필 강조 노출 등 유료 기능 | 3 | 광고 배너의 대안 수익모델로 같이 고려 |
| *(추가 제안)* 다국어 지원 | 해외 음악 전공생·유학생까지 확장 시 | 3 | |

**광고 배너 — 추천안 / 대안 / 저비용안**
- **추천안(보류 권장)**: 폐쇄형·신뢰 기반 네트워킹이 핵심 가치인 서비스에 일반 광고 배너를 넣으면 브랜드 톤·사용자 경험과 충돌할 가능성이 큼. 사용자 기반이 충분히 쌓이기 전까지는 보류
- **대안**: 멤버십/프리미엄 구독 모델(위 표 참고) — 광고 없이 직접 수익화
- **저비용안**: 공연/녹음실/연습실 제휴와 결합한 추천 수수료 — 광고처럼 보이지 않으면서 사용자에게 실제 유용한 정보로 수익화

### 5.4 협업 체인 상세 설계 (Phase 2 — "재창작가능" 콘텐츠)

> MVP에는 포함하지 않았지만, 설계 자체는 지금 확정해 둡니다. Phase 2 착수 시 바로 구현 가능한 수준입니다.

**개념**: 작곡(composition) 콘텐츠에서 "협업가능"을 체크하면, 다른 승인된 사용자가 원본파일을 다운받아 작업한 뒤 "2차 게시물"로 이어붙일 수 있습니다. 1차→2차→3차로 스택이 쌓이는 구조이며, 보는 사람 입장에선 하나의 폴더(스택)처럼 보입니다.

**적용 조건**: `content_type='composition'` **AND** `collab_available=true`인 게시물만 아래 동작이 적용됩니다. 연주/합주 등 다른 콘텐츠 타입의 "협업가능"은 기존 FEED-07/COLLAB-01~03(DM 제안) 방식 그대로 유지합니다.

| ID | 기능 | 설명 | 처리 로직 / 예외 |
|---|---|---|---|
| CHAIN-01 | 체인 활성화 시 노출시간 전환 | content_type=composition + collab_available=true 체크 시, 업로드 화면(S8)의 노출시간 옵션이 6h/12h/24h/48h → **1주/2주/3주/1개월**로 전환 | 짧은 옵션은 선택 불가하도록 UI에서 분기 |
| CHAIN-02 | 원본파일 업로드(필수) | wav/mp3/mp4 중 1개 업로드, 별도 파일 크기 제한(예: 100MB) | 추후 DAW 프로젝트파일 지원 시 청크 업로드 별도 설계 필요(Phase3) |
| CHAIN-03 | 원본파일 다운로드 | 1차 게시물의 visibility 조건을 만족하는 승인 사용자라면 누구나 다운로드 가능(0-11, 별도 승인 절차 없음) | 다운로드 버튼은 visibility 비충족자에겐 노출 안 됨 |
| CHAIN-04 | 이어가기(포크) | 다운로드한 사용자가 결과물을 "이어가기" 경로로 업로드하면 `parent_post_id` 자동 연결, `generation = parent.generation + 1` | visibility는 1차(root)의 값을 그대로 상속(작성자가 별도로 더 넓게 설정 불가) |
| CHAIN-05 | 스택형 피드 표시 | 메인피드(S6)에는 `parent_post_id IS NULL`인 1차만 카드로 노출, 자식이 있으면 스택 뱃지(레이어 아이콘 + "협업 N건") 표시 | 2차/3차는 메인피드 단독 노출 안 함(0-13). 탭하면 S21 스택뷰어로 진입 |
| CHAIN-06 | 프로필 피드 기여 보존 | 2차/3차 작성자의 프로필 피드(FEED-10)에는 본인이 만든 2차/3차가 정상적으로 노출 | 메인피드에만 안 보일 뿐, 본인 기록·크레딧은 보존 |

**DB 스키마 추가 (Phase 2 마이그레이션)**
```sql
ALTER TABLE posts ADD COLUMN parent_post_id   UUID REFERENCES posts(id); -- 직속 부모(NULL=1차/원본)
ALTER TABLE posts ADD COLUMN root_post_id     UUID REFERENCES posts(id); -- 체인 최상위 원본(본인이 1차면 자기 id)
ALTER TABLE posts ADD COLUMN generation       INT NOT NULL DEFAULT 1;    -- 1차=1, 2차=2, 3차=3...
ALTER TABLE posts ADD COLUMN source_file_url  VARCHAR(500);              -- 다운로드용 원본파일
ALTER TABLE posts ADD COLUMN source_file_type VARCHAR(10);               -- wav/mp3/mp4

CREATE INDEX idx_posts_root   ON posts(root_post_id, generation); -- 체인 전체 한번에 조회
CREATE INDEX idx_posts_parent ON posts(parent_post_id);
```

**화면 추가**
- S21 협업 체인 스택뷰어: 1차→2차→3차 순서로 스와이프, 각 단계마다 작성자 정보·다운로드 버튼·"이어가기" 버튼 노출
- S8 업로드 화면 분기: "이어가기"로 진입 시 `parent_post_id` 미리 채워진 상태로 시작, visibility 설정 UI는 숨김(1차 값 자동 상속)

**메인피드 카드 표기**: 일반 게시물과 동일하나, 자식이 있는 1차 게시물은 우측 상단에 레이어 아이콘 + 숫자("협업 2건") 오버레이

---

## 6. 핵심 리스크 체크리스트 (요약)
1. **영상 영구보관 확정(0-2)으로 스토리지 비용이 사용자 수와 함께 계속 누적됨** — 자동삭제가 없으므로 트래픽이 늘기 전에 저비용 스택(R2 등)으로 전환할 임계점을 미리 정해둘 것. 또한 사용자에게도 "삭제는 본인 책임"이라는 점을 업로드 화면에 명확히 안내 필요
2. 인증서류는 민감정보 — 파기 정책(0-4) 없이 무기한 보관하면 법적 리스크
3. 심사 인력이 1인일 경우 가입자 급증 시 SLA 붕괴 가능 — 대기열 알림(ADMIN-01) 우선 구현 필요
4. **신고/차단을 의도적으로 MVP에서 제외함(0-6)** — DM·협업제안이 열려 있는 상태로 악용 사례가 발생할 수 있다는 점을 인지한 상태의 트레이드오프. 초기 사용자 규모가 작을 때는 운영자가 수동으로 대응 가능하지만, 가입자가 늘면 Phase 2 우선순위를 앞당길 것
5. "노출시간 만료"와 "예약 게시"가 겹치는 엣지케이스(예: 노출 6시간인데 예약이 늦어 게시 직후 거의 바로 만료) — 업로드 화면에서 게시 예정 시각 기준으로 만료 안내 미리 보여줄 것
6. 게시물 영구 삭제(FEED-11)는 복구 불가 — DM·협업제안에서 참조 중인 source_post_id가 삭제되면 해당 메시지 스레드에 "삭제된 게시물입니다" 같은 깨진 참조 처리가 필요함
7. (Phase2 적용 시) 협업 체인은 승인절차 없이 누구나 포크 가능하게 설계됨 — 품질이 낮은 2차/3차가 계속 쌓여도 1차 작성자가 막을 방법이 없음. 운영 중 문제가 되면 "1차 작성자가 특정 2차를 숨기기" 정도의 최소 컨트롤은 추가 검토 권장
