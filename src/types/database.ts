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
// Phase 0: visibility는 'public' 고정 (FEED-03 5단계 UI 없음). 컬럼/타입은 Phase 1 대비 유지.
export type PostVisibility = "public" | "major" | "school" | "followers" | "private";
export type PostStatus = "scheduled" | "published" | "expired" | "deleted";
export type ExpireHours = 6 | 12 | 24 | 48;

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string | null;
          name: string;
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
          video_url: string;
          thumbnail_url: string | null;
          caption: string | null;
          content_type: ContentType;
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
          video_url: string;
          thumbnail_url?: string | null;
          caption?: string | null;
          content_type: ContentType;
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
      follows: {
        Row: {
          id: string;
          follower_id: string;
          followee_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          followee_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["follows"]["Insert"]>;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
