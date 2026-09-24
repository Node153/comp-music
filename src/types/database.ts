// Phase 0 DB 스키마에 대응하는 타입 정의.
// 출처: music-network-mvp-spec.md 4.2 (supabase/migrations/0001_init.sql과 1:1 대응)
// 스키마가 바뀌면 이 파일도 함께 갱신해야 한다. (추후 `supabase gen types typescript`로 자동생성 전환 권장)

// Phase 0: 회원가입 상태 3단계만 사용 (spec 1.4) — supplement_requested는 Phase 1에서 추가됨
// withdrawn(0046) — 회원 탈퇴. 삭제가 아니라 비활성화+개인정보 파기라 행은 남고 상태만 바뀐다.
// suspended(0064) — 관리자 정지. approved가 아니므로 미승인 회원과 똑같이 차단된다.
export type UserStatus = "pending" | "approved" | "rejected" | "withdrawn" | "suspended";
export type UserRole = "user" | "admin";
export type UserType = "student" | "activist";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type ContentType =
  | "composition"
  | "performance"
  | "practice"
  | "rehearsal"
  | "improv"
  | "ensemble";
// demo는 'public' 고정. Complex(0012_complex_access_and_chat)가 'followers'/'invite_only'를 실제로
// 씀 — 'invite_only'는 Complex의 특정인초대 공개범위 전용 값이고, 'major'/'school'/'private'은
// 여전히 Phase 1 대비로만 남겨둠(0012의 posts_visibility_check 제약과 값 목록을 맞출 것).
export type PostVisibility = "public" | "major" | "school" | "followers" | "invite_only" | "private";
export type PostStatus = "scheduled" | "published" | "expired" | "deleted";
// 6/12/24/48은 memo 단독 게시물(시간 단위), 24/72/120/168은 협업 게시물(1/3/5/7일,
// 사용자 요청 — "협업게시물은 시간제한 말고 기간제한") — 24는 두 세트에 공통.
export type ExpireHours = 6 | 12 | 24 | 48 | 72 | 120 | 168;
// 0010_posts_media_type + 0011_posts_audio_media_type: 업로드 화면에서 영상/이미지/음원 중
// 하나를 고르며, 고른 쪽 컬럼(video_url/image_url/audio_url)만 채워진다.
export type MediaType = "video" | "image" | "audio";
// 0012_complex_access_and_chat: post_access.status — invited(작성자가 초대) / pending(노크,
// 열람 요청) / accepted(노크 수락됨). 거절은 행 삭제로 처리해서 별도 rejected 값은 없다.
export type PostAccessStatus = "invited" | "pending" | "accepted";
// post_chat_messages.type — Complex 채팅 + 재창작물 스택 공용. text만 content를 쓰고
// 나머지는 file_key(R2 오브젝트 키)를 쓴다(0012의 content_matches_type 체크와 대응).
export type ChatMessageType = "text" | "image" | "video" | "audio";
// 0017_companions: companions.status — pending(신청 대기) / accepted(맞팔 성립).
// 거절·취소·해제는 전부 행 삭제로 처리해서 별도 값이 없다(post_access와 같은 원칙).
export type CompanionStatus = "pending" | "accepted";
// 0023_agreements: 가입 시 필수 동의 3종(docs/copyright_agreement_draft.md).
export type AgreementType =
  | "content_rights"
  | "collab_disclaimer"
  | "license_grant"
  | "terms_of_service"
  | "privacy_policy"
  | "community_guidelines"
  | "age_over_14"
  | "beta_notice";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string | null;
          name: string;
          nickname: string;
          // 전체 회원 기준 절대 유일(0038) — 가입 시 트리거가 자동 배정, 아무도 못 바꿈.
          // nickname(문구)은 이제 중복 허용이라 화면에 보이는 값이 겹칠 수 있고, 이 태그로만
          // 실제로 구분된다. 가입 화면에서는 여전히 입력받지 않지만(자동 배정), 검색/프로필
          // 등 동명이인을 구분해야 하는 곳에서는 "닉네임#태그" 형태로 표시한다(SearchPanel 참고).
          nickname_tag: string;
          status: UserStatus;
          role: UserRole;
          notifications_seen_at: string;
          // 0068 — 피드백 메뉴 "새 소식" 점/홈 배너 판정(마지막으로 업데이트 소식을 본 시각).
          updates_seen_at: string;
          // 0069 — 기여 랭킹 목록에서 내 이름 숨기기(점수는 계속 쌓임).
          hide_from_ranking: boolean;
          // 우측 사이드바 온라인/자리비움/오프라인 판정용(0025) — 클라이언트가 주기적으로 갱신,
          // 한 번도 접속 안 했으면 null(오프라인 취급).
          last_seen_at: string | null;
          // 소셜로그인(0027) — OAuth로 처음 가입하면 true, /onboarding에서 실명/닉네임 확정 +
          // 동의 체크박스를 받은 뒤 false로 바뀐다. 이메일 가입은 처음부터 false.
          needs_onboarding: boolean;
          // 동명이인 판별 보조용(0031) — 기존 회원은 null, 새 가입자부터 앱에서 필수로 받음.
          birth_date: string | null;
          // 이메일 알림 설정(0033) — 모바일 앱이 없어서 이메일이 사실상 유일한 알림 채널이라
          // 종류별로 켜고 끌 수 있게 했다. "답해야 하는" 것(노크/신청/메시지)은 기본 켜짐,
          // "참고용"인 것(좋아요/댓글/PEAK)은 기본 꺼짐 — 단 좋아요/댓글은 0074에서 켜짐으로 바뀜.
          email_notify_like: boolean;
          email_notify_comment: boolean;
          email_notify_knock: boolean;
          email_notify_companion_request: boolean;
          email_notify_message: boolean;
          email_notify_peak: boolean;
          // 0071 — Kick 받으면 즉시 메일(기본 켜짐, 다이제스트 아님).
          email_notify_kick: boolean;
          // 0074 — 좋아요/댓글 메일도 즉시 발송으로 바뀌고 기본 켜짐. 웹 푸시는 종류별로 따로
          // 켜고 끈다(기본 켜짐 — 실제 발송은 push_subscriptions에 구독이 있을 때만).
          push_notify_like: boolean;
          push_notify_comment: boolean;
          push_notify_kick: boolean;
          // 0076 — Companion 새 글, 재생 수·PEAK 진행 소식. 푸시는 즉시, 이메일은 다이제스트 한 줄.
          push_notify_companion_post: boolean;
          push_notify_progress: boolean;
          email_notify_companion_post: boolean;
          email_notify_progress: boolean;
          // 0077 — 월요일 주간 리포트(지난주 반응·청취자 + Kick 충전 + 새 Drop 유도).
          email_notify_weekly: boolean;
          push_notify_weekly: boolean;
          // 마지막으로 주간 리포트를 보낸 주의 월요일(KST, 'YYYY-MM-DD') — 같은 주 중복 발송 방지.
          weekly_report_week: string | null;
          // 이메일 다이제스트 발송 커서(0035) — 크론이 "이 시각 이후로 새로 생긴 것"만 골라
          // 보내고 나면 여기를 now()로 갱신한다.
          last_notification_emailed_at: string;
          // 회원 탈퇴 시각(0046) — 탈퇴 전에는 null.
          withdrawn_at: string | null;
          // 신규 가입 심사 요청 Discord 알림을 보낸 시각(0048) — 보내기 전에는 null.
          // /api/admin/notify-signup이 null일 때만 채우고 웹훅을 쏜다(중복 발송 방지).
          admin_notified_at: string | null;
          // 정지 만료 시각(0064) — null이면 영구 정지(정지 상태가 아니면 항상 null).
          suspended_until: string | null;
          // 반려/정지 사유(0064) — 본인 /status 화면에 표시.
          status_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash?: string | null;
          name: string;
          nickname: string;
          status?: UserStatus;
          role?: UserRole;
          notifications_seen_at?: string;
          updates_seen_at?: string;
          hide_from_ranking?: boolean;
          last_seen_at?: string | null;
          needs_onboarding?: boolean;
          birth_date?: string | null;
          email_notify_like?: boolean;
          email_notify_comment?: boolean;
          email_notify_knock?: boolean;
          email_notify_companion_request?: boolean;
          email_notify_message?: boolean;
          email_notify_kick?: boolean;
          email_notify_peak?: boolean;
          push_notify_like?: boolean;
          push_notify_comment?: boolean;
          push_notify_kick?: boolean;
          push_notify_companion_post?: boolean;
          push_notify_progress?: boolean;
          email_notify_companion_post?: boolean;
          email_notify_progress?: boolean;
          email_notify_weekly?: boolean;
          push_notify_weekly?: boolean;
          weekly_report_week?: string | null;
          last_notification_emailed_at?: string;
          withdrawn_at?: string | null;
          admin_notified_at?: string | null;
          suspended_until?: string | null;
          status_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      agreements: {
        Row: {
          id: string;
          user_id: string;
          type: AgreementType;
          version: string;
          agreed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: AgreementType;
          version: string;
          agreed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agreements"]["Insert"]>;
        Relationships: [];
      };
      // 0026_site_settings: 전역 key-value 설정 — 지금은 로그인 화면 배경음악(login_bgm_key,
      // value에 R2 key 또는 외부 URL) 하나뿐이라 필요할 때마다 행을 추가하는 식으로 쓴다.
      site_settings: {
        Row: {
          key: string;
          value: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          // 온보딩을 안 거친 유저(SQL 승인 등)는 profiles 행만 있고 user_type은 미설정(null).
          user_type: UserType | null;
          user_type_public: boolean;
          school: string | null;
          school_public: boolean;
          major: string | null;
          instruments: string[] | null;
          // 좋아하는 장르(정확히 3개, 0028) — instruments(포지션)와 대칭되는 스타일 축.
          favorite_genres: string[] | null;
          region: string | null;
          region_public: boolean;
          bio: string | null;
          portfolio_links: Record<string, string> | null;
          profile_image_url: string | null;
          // 프로필 커버 사진 R2 key(0075) — /api/cover/[userId]가 표시.
          cover_image_url: string | null;
        };
        Insert: {
          user_id: string;
          user_type?: UserType | null;
          user_type_public?: boolean;
          school?: string | null;
          school_public?: boolean;
          major?: string | null;
          instruments?: string[] | null;
          favorite_genres?: string[] | null;
          region?: string | null;
          region_public?: boolean;
          bio?: string | null;
          portfolio_links?: Record<string, string> | null;
          profile_image_url?: string | null;
          cover_image_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      verifications: {
        Row: {
          id: string;
          user_id: string;
          type: UserType;
          status: VerificationStatus;
          documents: { doc_type: string; file_url: string }[];
          reject_reason: string | null;
          reviewer_id: string | null;
          submitted_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: UserType;
          status?: VerificationStatus;
          documents: { doc_type: string; file_url: string }[];
          reject_reason?: string | null;
          reviewer_id?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["verifications"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          video_url: string | null;
          image_url: string | null;
          audio_url: string | null;
          media_type: MediaType;
          thumbnail_url: string | null;
          // 작품 제목 — caption(부가 설명, 선택)과 분리된 필드(0052, 2026-09-15).
          title: string | null;
          caption: string | null;
          content_type: ContentType | null;
          instrument_tags: string[] | null;
          visibility: PostVisibility;
          collab_available: boolean;
          collab_role_needed: string | null;
          status: PostStatus;
          scheduled_at: string | null;
          published_at: string | null;
          expire_hours: ExpireHours;
          expires_at: string | null;
          // DEMO(visibility='public') 조회수(0052) — increment_post_view() 함수로만 증가.
          view_count: number;
          // PEAK 진입 시각(0056) — check_and_set_post_peak()이 조회수+좋아요*10>=1000을
          // 처음 넘긴 순간 한 번만 찍고 이후 영구 고정(좋아요 취소해도 안 지워짐).
          peaked_at: string | null;
          // 작성자가 자기 프로필 맨 위에 고정한 시각(0075, 최대 3개) — 보는 사람 모두에게 동일.
          profile_pinned_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_url?: string | null;
          image_url?: string | null;
          audio_url?: string | null;
          media_type?: MediaType;
          thumbnail_url?: string | null;
          title?: string | null;
          caption?: string | null;
          content_type?: ContentType | null;
          instrument_tags?: string[] | null;
          visibility?: PostVisibility;
          collab_available?: boolean;
          collab_role_needed?: string | null;
          status?: PostStatus;
          scheduled_at?: string | null;
          published_at?: string | null;
          expire_hours: ExpireHours;
          expires_at?: string | null;
          view_count?: number;
          peaked_at?: string | null;
          profile_pinned_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["likes"]["Insert"]>;
        Relationships: [];
      };
      // Kick(0071) — 좋아요의 상위 반응. 주 1회(week_start = KST 월요일), 번복 불가.
      // 쓰기는 give_kick RPC만(INSERT/DELETE 정책 없음).
      kicks: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          week_start: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          week_start: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["kicks"]["Insert"]>;
        Relationships: [];
      };
      // 게시물 조회자 기록(0051) — memo 공동창작 미체크 게시물의 "본 사람" 목록용.
      // 목록은 작성자 본인만 볼 수 있다(RLS post_views_select_owner).
      post_views: {
        Row: {
          post_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_views"]["Insert"]>;
        Relationships: [];
      };
      // 유저별 "5초 이상 재생함" 기록(0072) — 피드 정렬(안 들은 글 먼저)용. 본인 것만 조회.
      post_plays: {
        Row: {
          post_id: string;
          user_id: string;
          played_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          played_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_plays"]["Insert"]>;
        Relationships: [];
      };
      // memo 합작 게시물 상단 고정 오버라이드(0054/0055) — 본인만 보는 개인화 표시.
      // 행이 없으면 자동 규칙(본인 글·초대받은 글)을 따르고, 있으면 pinned 값이 덮어쓴다.
      post_pins: {
        Row: {
          post_id: string;
          user_id: string;
          pinned: boolean;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          pinned?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_pins"]["Insert"]>;
        Relationships: [];
      };
      // 프로필 게시물 탭의 사용자 정의 폴더(0057) — 기존 게시물을 담기만 하는 묶음.
      post_folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_folders"]["Insert"]>;
        Relationships: [];
      };
      post_folder_items: {
        Row: {
          folder_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          folder_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_folder_items"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_id: string | null;
          content: string;
          // 0076 — 재생 위치를 붙인 댓글("0:42 여기 좋다"), 초 단위. 일반 댓글은 null.
          timestamp_sec: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          parent_id?: string | null;
          content: string;
          timestamp_sec?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      // 0074 — 웹 푸시 구독(브라우저/기기마다 한 행, endpoint unique). 서버(service_role) 전용.
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent: string | null;
          created_at: string;
          last_success_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          user_agent?: string | null;
          created_at?: string;
          last_success_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
        Relationships: [];
      };
      // 0076 — 게시물 마일스톤(청취자 수·PEAK 진행률·Companion 새 글 알림 발송) 1회 기록.
      post_milestones: {
        Row: {
          id: string;
          post_id: string;
          kind: "plays" | "peak_progress" | "published";
          value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          kind: "plays" | "peak_progress" | "published";
          value: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_milestones"]["Insert"]>;
        Relationships: [];
      };
      // 0074 — 반응(좋아요/댓글/답글) 알림 발송 기록. 중복 방지 + 이메일 묶음/하루 상한 판정용.
      reaction_notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string;
          post_id: string;
          kind: "like" | "comment" | "reply";
          comment_id: string | null;
          emailed_at: string | null;
          pushed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id: string;
          post_id: string;
          kind: "like" | "comment" | "reply";
          comment_id?: string | null;
          emailed_at?: string | null;
          pushed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reaction_notifications"]["Insert"]>;
        Relationships: [];
      };
      // 0017_companions — 팔로우를 대체하는 맞팔 전용 관계. 쌍당 행 하나, pending → accepted.
      companions: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: CompanionStatus;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: CompanionStatus;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["companions"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_a_id: string;
          user_b_id: string;
          last_message_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_a_id: string;
          user_b_id: string;
          last_message_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          source_post_id: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
          source_post_id?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      post_access: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          status: PostAccessStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          status: PostAccessStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_access"]["Insert"]>;
        Relationships: [];
      };
      post_chat_messages: {
        Row: {
          id: string;
          post_id: string;
          sender_id: string;
          type: ChatMessageType;
          content: string | null;
          file_key: string | null;
          is_work: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          sender_id: string;
          type: ChatMessageType;
          content?: string | null;
          file_key?: string | null;
          is_work?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["post_chat_messages"]["Insert"]>;
        Relationships: [];
      };
      // 0021_announcements_and_feedback — Help 메뉴(구 Away)의 공지사항. 관리자만 작성.
      // 관리자 조치 감사 로그(0064) — admin_set_member_status/role 등 security definer 함수만
      // 기록한다(클라이언트 insert 경로 없음). admin_id null = 시스템(정지 기간 만료 해제).
      admin_actions: {
        Row: {
          id: number;
          admin_id: string | null;
          target_user_id: string | null;
          action: "status_change" | "role_change" | "name_change" | "suspension_expired";
          before: Record<string, unknown> | null;
          after: Record<string, unknown> | null;
          reason: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // 관리자 내부 메모(0066) — 회원 상세 패널. 관리자만 조회/작성, 삭제는 본인 메모만.
      admin_notes: {
        Row: {
          id: number;
          target_user_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          target_user_id: string;
          author_id: string;
          body: string;
        };
        Update: never;
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: string;
          // 0067 — 공지 종류/고정/피드백 반영 카드용 필드. counts는 작성 시점 스냅샷.
          kind: "notice" | "update" | "feedback";
          pinned: boolean;
          request_summary: string | null;
          link_url: string | null;
          requester_count: number;
          like_count: number;
          // 0070 — draft는 관리자만 보임(일일 릴리즈 노트 자동 초안). release_date = 요약한 커밋 날짜(KST).
          status: "published" | "draft";
          release_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          content: string;
          kind?: "notice" | "update" | "feedback";
          pinned?: boolean;
          request_summary?: string | null;
          link_url?: string | null;
          requester_count?: number;
          like_count?: number;
          status?: "published" | "draft";
          release_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
        Relationships: [];
      };
      // 0069 — 기여 점수 적립 기록(트리거만 씀, 본인·관리자만 조회).
      contribution_events: {
        Row: {
          id: number;
          user_id: string;
          kind: "feedback_reviewing" | "feedback_done" | "like_received" | "liked_done" | "pulse_comment";
          points: number;
          feedback_id: string | null;
          source_key: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // 0069 — 이번 달 3위 안/1위 달성 기록(순위 알림용, 본인만 조회).
      contribution_milestones: {
        Row: {
          user_id: string;
          month: string;
          milestone: "top3" | "first";
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // 0067 — 피드백 반영 공지 ↔ 반영된 피드백(여러 건 → 공지 하나).
      announcement_feedback: {
        Row: {
          announcement_id: string;
          feedback_id: string;
        };
        Insert: {
          announcement_id: string;
          feedback_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcement_feedback"]["Insert"]>;
        Relationships: [];
      };
      // DEMO 피드 상단 힐링 멘트. 읽기는 전체 공개, 쓰기는 관리자만(/admin/feed-hero).
      feed_hero_messages: {
        Row: {
          id: string;
          question: string;
          answer: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feed_hero_messages"]["Insert"]>;
        Relationships: [];
      };
      // 업로드(게시하기) 버튼에 랜덤 노출되는 문구. 읽기 전체 공개, 쓰기는 관리자만(/admin/submit-phrases).
      submit_phrases: {
        Row: {
          id: string;
          phrase: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phrase: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["submit_phrases"]["Insert"]>;
        Relationships: [];
      };
      // 가입/온보딩/프로필수정 화면의 닉네임 추천 문구. 읽기 전체 공개, 쓰기는 관리자만(/admin/nickname-phrases).
      nickname_phrases: {
        Row: {
          id: string;
          phrase: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phrase: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["nickname_phrases"]["Insert"]>;
        Relationships: [];
      };
      // 0021_announcements_and_feedback — Help 메뉴에서 보내는 피드백. 본인+관리자만 열람.
      feedback: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback"]["Insert"]>;
        Relationships: [];
      };
      // 0047_feedback_group_chat — 승인 회원 전원이 함께 보는 실시간 단체 채팅. 표시는 항상 닉네임.
      feedback_messages: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          // 0062 — true면 작성자 본인 + 관리자만 열람(RLS). category null = 일반 대화.
          is_private: boolean;
          category: "bug" | "inconvenience" | "idea" | "praise" | null;
          // 0063 — 관리자 처리 상태/답변. admin_updated_at = 마지막 상태·답변 변경(알림 기준).
          status: "received" | "reviewing" | "done" | "on_hold";
          admin_reply: string | null;
          admin_updated_at: string | null;
          // 0065 — feedback-images 버킷 경로(`${user_id}/...`). 이미지만 보낼 땐 content가 빈 문자열.
          image_path: string | null;
          // 0068 — 있으면 반영 공지를 채팅에 자동으로 올린 운영자 메시지(공지 카드로 렌더링).
          announcement_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          is_private?: boolean;
          category?: "bug" | "inconvenience" | "idea" | "praise" | null;
          status?: "received" | "reviewing" | "done" | "on_hold";
          admin_reply?: string | null;
          admin_updated_at?: string | null;
          image_path?: string | null;
          announcement_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback_messages"]["Insert"]>;
        Relationships: [];
      };
      // 0065 — 공개 피드백 "나도 👍". (feedback_id, user_id) PK.
      feedback_reactions: {
        Row: {
          feedback_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          feedback_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback_reactions"]["Insert"]>;
        Relationships: [];
      };
      // 0065 — 상황별 짧은 설문. score null = "다음에"로 닫음. (user_id, trigger) 유니크.
      feedback_pulses: {
        Row: {
          id: string;
          user_id: string;
          trigger: "upload" | "day7";
          score: number | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trigger: "upload" | "day7";
          score?: number | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback_pulses"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      // 0018 — 뷰어 기준 표시 이름: 본인/Companion이면 실명(users.name), 아니면 닉네임.
      // 이름을 화면에 표시할 때는 users 대신 반드시 이 뷰를 조회한다.
      user_display: {
        Row: {
          id: string;
          display_name: string;
          shows_real_name: boolean;
        };
        Relationships: [];
      };
      // 0024 — 로그인 전 DEMO 미리보기 전용. 비로그인 방문자는 누구의 Companion도 될 수
      // 없으므로 무조건 닉네임만 내려주고, 지금 공개 게시물이 있는 사용자로만 범위를 좁힌다.
      public_post_authors: {
        Row: {
          id: string;
          display_name: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      // 0069 — 이번 달 시작 시각(Asia/Seoul) — 기여 점수 "이번 달" 경계.
      contribution_month_start: {
        Args: Record<string, never>;
        Returns: string;
      };
      // 0069 — 기여 랭킹(이번 달 'month' / 누적 'all'). 관리자·랭킹 숨김 회원 제외.
      contribution_leaderboard: {
        Args: { p_period?: string; p_limit?: number };
        Returns: { user_id: string; nickname: string; points: number; rank: number }[];
      };
      // 0069 — 내 기여도(이번 달/누적 점수·순위, 위 순위까지 남은 점수).
      my_contribution: {
        Args: Record<string, never>;
        Returns: {
          month_points: number;
          month_rank: number | null;
          month_gap: number | null;
          month_leader_gap: number | null;
          month_participants: number;
          total_points: number;
          total_rank: number | null;
          hide_from_ranking: boolean;
        }[];
      };
      // 0071 — Kick 주기(주 1회, 번복 불가). 실패 사유는 예외 메시지 코드로.
      give_kick: {
        Args: { pid: string };
        Returns: undefined;
      };
      // 0071 — 게시물별 Kick한 사람(닉네임만, 승인 회원만).
      post_kickers: {
        Args: { pids: string[] };
        Returns: { post_id: string; user_id: string; nickname: string; created_at: string }[];
      };
      // 0068 — 피드백 처리 현황 집계(숫자만, security definer). 승인 회원만.
      feedback_stats: {
        Args: Record<string, never>;
        Returns: {
          received: number;
          reviewing: number;
          done: number;
          done_this_month: number;
          avg_response_hours: number | null;
        }[];
      };
      // 회원 관리(0064) — 상태/권한 변경은 전부 이 함수들로(감사 로그 기록). 관리자 전용.
      admin_set_member_status: {
        Args: { p_target: string; p_status: string; p_reason?: string | null; p_until?: string | null };
        Returns: void;
      };
      admin_set_member_role: {
        Args: { p_target: string; p_role: string; p_reason: string };
        Returns: void;
      };
      // admin_set_member_name(0073) — 관리자 회원 실명 수정(admin_actions에 name_change 기록).
      admin_set_member_name: {
        Args: { p_target: string; p_name: string; p_reason?: string | null };
        Returns: void;
      };
      // lift_my_expired_suspension(0064) — 기간 만료된 본인 정지 해제. proxy.ts가 호출.
      lift_my_expired_suspension: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      // 0020_knock_context_is_companion: invite_only 게시물 참여자 요약용 — 참여자 한 명당
      // 표시 이름(뷰어와 Companion이면 실명, 아니면 닉네임) + Companion 여부. 서버(feed/page.tsx)가
      // 뷰어의 참여 여부(canViewMedia)를 보고 "Companion 이름 + 외 n명" 또는 "전원 이름"으로 조립.
      knock_context: {
        Args: { pid: string };
        Returns: { display_name: string; is_companion: boolean }[];
      };
      // knock_context_batch(0059) — knock_context와 동일 로직을 post_id 배열로 한 번에 받는
      // 배치 버전. feed/page.tsx가 invite_only 게시물마다 개별 호출하던 N+1을 없애려고 추가.
      knock_context_batch: {
        Args: { pids: string[] };
        Returns: { post_id: string; display_name: string; is_companion: boolean }[];
      };
      // public_taken_nicknames(0032)는 닉네임 겹침 방지 기능 자체를 되돌리면서(2026-08-20,
      // 익명성 강화 목적으로 숫자 접미사 재도입) 호출부가 없어짐 — DB 함수는 그대로 남아있지만
      // (재사용 가능성 있어 별도 마이그레이션으로 안 지움) 여기 타입 선언은 정리.
      // check_duplicate_identity(0044) — 소셜로그인 중복가입 사전 차단용. 이름+생년월일이
      // 일치하는 다른 계정이 있는지만 boolean으로 알려준다(다른 사람 정보는 노출 안 함).
      // users_select_self_or_approved_peers RLS 때문에 클라이언트에서 직접 users를 조회해서는
      // 이 판별이 안 된다 — security definer 함수로 우회.
      check_duplicate_identity: {
        Args: { p_name: string; p_birth_date: string; p_exclude_id?: string | null };
        Returns: boolean;
      };
      // withdraw_own_account(0046) — 회원 탈퇴. 매개변수 없이 항상 auth.uid() 본인에게만
      // 작용한다(security definer로 RLS 우회, 대상은 호출자로 고정돼 있어 안전).
      withdraw_own_account: {
        Args: Record<string, never>;
        Returns: void;
      };
      // can_access_post_content(0012, 0017에서 companions로 갱신) — memo(비공개) 게시물의
      // 미디어/채팅 열람 권한 판정. feed/page.tsx의 canViewMediaFor와 동일 로직을 DB 함수로
      // 감싼 것 — /api/media/track-url이 재생목록 재생 시 signed URL을 새로 내주기 전에 이걸로
      // 인가를 확인한다(security definer).
      can_access_post_content: {
        Args: { pid: string; uid: string };
        Returns: boolean;
      };
      // mark_post_played(0072) — 5초 재생 시 내 post_plays 행 추가(중복 무시). 0076부터 이번
      // 호출로 처음 기록됐으면 true(재생 수 알림 트리거 판단용).
      mark_post_played: {
        Args: { pid: string };
        Returns: boolean;
      };
      // awaiting_first_reactions(0076) — 피드 상단 "첫 반응을 기다리는 Drop" 후보.
      awaiting_first_reactions: {
        Args: { p_limit?: number };
        Returns: { post: Database["public"]["Tables"]["posts"]["Row"]; reaction_count: number }[];
      };
      // feed_candidates(0072) — 피드 한 페이지분 후보(키셋 커서, 재생 여부·scope 필터).
      feed_candidates: {
        Args: {
          p_scope: "demo" | "memo";
          p_tag?: string | null;
          p_played?: boolean;
          p_before_ts?: string | null;
          p_before_id?: string | null;
          p_limit?: number;
          p_ids?: string[] | null;
        };
        Returns: Database["public"]["Tables"]["posts"]["Row"][];
      };
      // increment_post_view(0052) — DEMO 조회수 증가. 비로그인 방문자도 호출 가능(anon 권한).
      increment_post_view: {
        Args: { pid: string };
        Returns: void;
      };
      // mark_messages_read(0057) — DM 읽음 처리. messages_update_participant 정책이
      // with check 없이 열려 있어 대화 참여자가 상대 메시지의 content/sender_id까지 고칠 수
      // 있던 문제를 막기 위해, 테이블 직접 UPDATE 대신 read_at만 갱신하는 함수로 대체했다.
      mark_messages_read: {
        Args: { p_conversation_id: string };
        Returns: void;
      };
      // touch_conversation_last_message(0057) — 메시지 전송 시 목록 정렬용 last_message_at
      // 갱신. conversations_update_participant도 같은 이유(with check 없음, user_a_id/
      // user_b_id까지 바꿔치기 가능)로 막고 이 함수로 대체.
      touch_conversation_last_message: {
        Args: { p_conversation_id: string };
        Returns: void;
      };
      // check_rate_limit(0058) — 고정 윈도 요청 횟수 제한. service_role(admin client, src/lib/
      // rateLimit.ts)에서만 호출하고 클라이언트에는 노출하지 않는다.
      check_rate_limit: {
        Args: { p_bucket: string; p_key_hash: string; p_window_seconds: number; p_max: number };
        Returns: boolean;
      };
      // latest_messages_for_conversations(0060) — conversationList.ts가 대화당 마지막 메시지
      // 1개만 필요한데 전체 메시지를 긁어오던 걸 막기 위한 DISTINCT ON 배치 조회.
      latest_messages_for_conversations: {
        Args: { conversation_ids: string[] };
        Returns: { conversation_id: string; content: string; created_at: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
