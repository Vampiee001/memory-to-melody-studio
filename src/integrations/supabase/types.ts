export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      playlist_items: {
        Row: {
          created_at: string
          id: string
          playlist_id: string
          position: number
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_id: string
          position?: number
          project_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_path: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portal_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      project_media: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          position: number
          project_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind: string
          mime_type: string
          position?: number
          project_id: string
          size_bytes?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          position?: number
          project_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          audio_error: string | null
          audio_path: string | null
          audio_status: string
          beat_error: string | null
          beat_file_name: string | null
          beat_mime: string | null
          beat_path: string | null
          beat_rights: Json
          beat_source: string
          beat_status: string
          concept: string | null
          consent: boolean
          consent_at: string | null
          context: string | null
          cover_art_path: string | null
          cover_error: string | null
          cover_path: string | null
          cover_source: string | null
          cover_status: string
          cover_text: Json
          created_at: string
          distribution_status: string
          experience_summary: string | null
          genre: string | null
          id: string
          language: string | null
          length_sec: number | null
          lyrics: string | null
          mastered_path: string | null
          mastering_engine: string | null
          mastering_error: string | null
          mastering_source: string | null
          mastering_status: string
          mood: string | null
          music_prompt: string | null
          package_exported_at: string | null
          release: Json
          rights_checklist: Json
          stage: string
          title: string
          updated_at: string
          user_id: string
          vocal: string | null
        }
        Insert: {
          audio_error?: string | null
          audio_path?: string | null
          audio_status?: string
          beat_error?: string | null
          beat_file_name?: string | null
          beat_mime?: string | null
          beat_path?: string | null
          beat_rights?: Json
          beat_source?: string
          beat_status?: string
          concept?: string | null
          consent?: boolean
          consent_at?: string | null
          context?: string | null
          cover_art_path?: string | null
          cover_error?: string | null
          cover_path?: string | null
          cover_source?: string | null
          cover_status?: string
          cover_text?: Json
          created_at?: string
          distribution_status?: string
          experience_summary?: string | null
          genre?: string | null
          id?: string
          language?: string | null
          length_sec?: number | null
          lyrics?: string | null
          mastered_path?: string | null
          mastering_engine?: string | null
          mastering_error?: string | null
          mastering_source?: string | null
          mastering_status?: string
          mood?: string | null
          music_prompt?: string | null
          package_exported_at?: string | null
          release?: Json
          rights_checklist?: Json
          stage?: string
          title?: string
          updated_at?: string
          user_id: string
          vocal?: string | null
        }
        Update: {
          audio_error?: string | null
          audio_path?: string | null
          audio_status?: string
          beat_error?: string | null
          beat_file_name?: string | null
          beat_mime?: string | null
          beat_path?: string | null
          beat_rights?: Json
          beat_source?: string
          beat_status?: string
          concept?: string | null
          consent?: boolean
          consent_at?: string | null
          context?: string | null
          cover_art_path?: string | null
          cover_error?: string | null
          cover_path?: string | null
          cover_source?: string | null
          cover_status?: string
          cover_text?: Json
          created_at?: string
          distribution_status?: string
          experience_summary?: string | null
          genre?: string | null
          id?: string
          language?: string | null
          length_sec?: number | null
          lyrics?: string | null
          mastered_path?: string | null
          mastering_engine?: string | null
          mastering_error?: string | null
          mastering_source?: string | null
          mastering_status?: string
          mood?: string | null
          music_prompt?: string | null
          package_exported_at?: string | null
          release?: Json
          rights_checklist?: Json
          stage?: string
          title?: string
          updated_at?: string
          user_id?: string
          vocal?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          permissions: string[]
          role: Database["public"]["Enums"]["portal_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          permissions?: string[]
          role: Database["public"]["Enums"]["portal_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["portal_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          default_artist_name: string | null
          distributor: string
          music_provider: string
          onboarded: boolean
          spotify_artist_url: string | null
          text_provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          default_artist_name?: string | null
          distributor?: string
          music_provider?: string
          onboarded?: boolean
          spotify_artist_url?: string | null
          text_provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          default_artist_name?: string | null
          distributor?: string
          music_provider?: string
          onboarded?: boolean
          spotify_artist_url?: string | null
          text_provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      portal_access: { Args: never; Returns: Json }
      portal_can: { Args: { task: string }; Returns: boolean }
      portal_metrics: { Args: never; Returns: Json }
      portal_set_admin: {
        Args: { revoke_access?: boolean; target_email: string; tasks: string[] }
        Returns: undefined
      }
      portal_team: { Args: never; Returns: Json }
      portal_users: { Args: { search_text?: string }; Returns: Json }
    }
    Enums: {
      portal_role: "owner" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      portal_role: ["owner", "admin"],
    },
  },
} as const
