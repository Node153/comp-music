// Phase 0 DB 스키마에 대응하는 타입 정의.
// 출처: music-network-mvp-spec.md 4.2 (supabase/migrations/0001_init.sql과 1:1 대응)
// 스키마가 바뀌면 이 파일도 함께 갱신해야 한다. (추후 `supabase gen types typescript`로 자동생성 전환 권장)

// Phase 0: 회원가입 상태 3단계만 사용 (spec 1.4) — supplement_requested는 Phase 1에서 추가됨
export type UserStatus = "pending" | "approved" | "rejected";
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
          status: UserStatus;
          role: UserRole;
          notifications_seen_at: string;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          user_type: UserType;
          school: string | null;
          major: string | null;
          instruments: string[] | null;
          region: string | null;
          collab_available: boolean;
          bio: string | null;
          portfolio_links: Record<string, string> | null;
          profile_image_url: string | null;
        };
        Insert: {
          user_id: string;
          user_type: UserType;
          school?: string | null;
          major?: string | null;
          instruments?: string[] | null;
          region?: string | null;
          collab_available?: boolean;
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
    };
    Functions: {
      // 0017_companions: invite_only 게시물 노크 UI용 — 참여자 중 내 Companion 이름 + 그 외 인원수.
      knock_context: {
        Args: { pid: string };
        Returns: { companion_names: string[]; other_count: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
