// Phase 0 DB 스키마에 대응하는 타입 정의.
// 출처: music-network-mvp-spec.md 4.2 (supabase/migrations/0001_init.sql과 1:1 대응)
// 스키마가 바뀌면 이 파일도 함께 갱신해야 한다. (추후 `supabase gen types typescript`로 자동생성 전환 권장)

// Phase 0: 회원가입 상태 3단계만 사용 (spec 1.4) — supplement_requested는 Phase 1에서 추가됨
// withdrawn(0046) — 회원 탈퇴. 삭제가 아니라 비활성화+개인정보 파기라 행은 남고 상태만 바뀐다.
export type UserStatus = "pending" | "approved" | "rejected" | "withdrawn";
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
export type ExpireHours = 6 | 12 | 24 | 48;
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
          // "참고용"인 것(좋아요/댓글/PEAK)은 기본 꺼짐.
          email_notify_like: boolean;
          email_notify_comment: boolean;
          email_notify_knock: boolean;
          email_notify_companion_request: boolean;
          email_notify_message: boolean;
          email_notify_peak: boolean;
          // 이메일 다이제스트 발송 커서(0035) — 크론이 "이 시각 이후로 새로 생긴 것"만 골라
          // 보내고 나면 여기를 now()로 갱신한다.
          last_notification_emailed_at: string;
          // 회원 탈퇴 시각(0046) — 탈퇴 전에는 null.
          withdrawn_at: string | null;
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
          last_seen_at?: string | null;
          needs_onboarding?: boolean;
          birth_date?: string | null;
          email_notify_like?: boolean;
          email_notify_comment?: boolean;
          email_notify_knock?: boolean;
          email_notify_companion_request?: boolean;
          email_notify_message?: boolean;
          email_notify_peak?: boolean;
          last_notification_emailed_at?: string;
          withdrawn_at?: string | null;
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
          user_type: UserType;
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
        };
        Insert: {
          user_id: string;
          user_type: UserType;
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
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          parent_id: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          parent_id?: string | null;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
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
      announcements: {
        Row: {
          id: string;
          author_id: string;
          title: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          title: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback_messages"]["Insert"]>;
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
      // 0020_knock_context_is_companion: invite_only 게시물 참여자 요약용 — 참여자 한 명당
      // 표시 이름(뷰어와 Companion이면 실명, 아니면 닉네임) + Companion 여부. 서버(feed/page.tsx)가
      // 뷰어의 참여 여부(canViewMedia)를 보고 "Companion 이름 + 외 n명" 또는 "전원 이름"으로 조립.
      knock_context: {
        Args: { pid: string };
        Returns: { display_name: string; is_companion: boolean }[];
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
