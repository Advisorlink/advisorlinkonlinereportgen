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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          details: Json | null
          email: string | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          email?: string | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          email?: string | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_caller_call_logs: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          cost: number | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          recording_url: string | null
          started_at: string | null
          status: string
          transcript: string | null
          vapi_call_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          recording_url?: string | null
          started_at?: string | null
          status?: string
          transcript?: string | null
          vapi_call_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          cost?: number | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          recording_url?: string | null
          started_at?: string | null
          status?: string
          transcript?: string | null
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_caller_call_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_caller_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_caller_call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "ai_caller_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_caller_campaigns: {
        Row: {
          calls_answered: number
          calls_completed: number
          completed_at: string | null
          created_at: string
          id: string
          leads_generated: number
          name: string
          phone_number_id: string | null
          scheduled_at: string | null
          script_id: string
          started_at: string | null
          status: string
          total_contacts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calls_answered?: number
          calls_completed?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          leads_generated?: number
          name: string
          phone_number_id?: string | null
          scheduled_at?: string | null
          script_id: string
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calls_answered?: number
          calls_completed?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          leads_generated?: number
          name?: string
          phone_number_id?: string | null
          scheduled_at?: string | null
          script_id?: string
          started_at?: string | null
          status?: string
          total_contacts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_caller_campaigns_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "ai_caller_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_caller_contacts: {
        Row: {
          call_attempts: number
          call_status: string
          campaign_id: string
          created_at: string
          email: string | null
          id: string
          last_called_at: string | null
          name: string
          phone: string
          vapi_call_id: string | null
        }
        Insert: {
          call_attempts?: number
          call_status?: string
          campaign_id: string
          created_at?: string
          email?: string | null
          id?: string
          last_called_at?: string | null
          name: string
          phone: string
          vapi_call_id?: string | null
        }
        Update: {
          call_attempts?: number
          call_status?: string
          campaign_id?: string
          created_at?: string
          email?: string | null
          id?: string
          last_called_at?: string | null
          name?: string
          phone?: string
          vapi_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_caller_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_caller_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_caller_leads: {
        Row: {
          call_duration_seconds: number | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          email: string | null
          extracted_fields: Json
          full_transcript: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          qualification_score: number | null
          status: string
          transcript_summary: string | null
          updated_at: string
        }
        Insert: {
          call_duration_seconds?: number | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          extracted_fields?: Json
          full_transcript?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          qualification_score?: number | null
          status?: string
          transcript_summary?: string | null
          updated_at?: string
        }
        Update: {
          call_duration_seconds?: number | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          email?: string | null
          extracted_fields?: Json
          full_transcript?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          qualification_score?: number | null
          status?: string
          transcript_summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_caller_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_caller_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_caller_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "ai_caller_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_caller_scripts: {
        Row: {
          background_sound: string | null
          background_sound_enabled: boolean
          created_at: string
          description: string | null
          first_message: string
          id: string
          max_duration_seconds: number
          model: string
          name: string
          questions: Json
          system_prompt: string
          updated_at: string
          user_id: string
          voice_id: string
          voice_provider: string
        }
        Insert: {
          background_sound?: string | null
          background_sound_enabled?: boolean
          created_at?: string
          description?: string | null
          first_message?: string
          id?: string
          max_duration_seconds?: number
          model?: string
          name: string
          questions?: Json
          system_prompt?: string
          updated_at?: string
          user_id: string
          voice_id?: string
          voice_provider?: string
        }
        Update: {
          background_sound?: string | null
          background_sound_enabled?: boolean
          created_at?: string
          description?: string | null
          first_message?: string
          id?: string
          max_duration_seconds?: number
          model?: string
          name?: string
          questions?: Json
          system_prompt?: string
          updated_at?: string
          user_id?: string
          voice_id?: string
          voice_provider?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          id: number
          owner_claimed_at: string | null
          owner_user_id: string | null
        }
        Insert: {
          id?: number
          owner_claimed_at?: string | null
          owner_user_id?: string | null
        }
        Update: {
          id?: number
          owner_claimed_at?: string | null
          owner_user_id?: string | null
        }
        Relationships: []
      }
      esign_documents: {
        Row: {
          client_address: string | null
          client_data: Json | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          completed_at: string | null
          created_at: string
          document_name: string
          host_user_id: string
          id: string
          original_pdf_path: string | null
          report_id: string | null
          resend_email: string | null
          sent_at: string | null
          signed_at: string | null
          signed_pdf_path: string | null
          signing_token: string
          status: string
          updated_at: string
        }
        Insert: {
          client_address?: string | null
          client_data?: Json | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          completed_at?: string | null
          created_at?: string
          document_name: string
          host_user_id: string
          id?: string
          original_pdf_path?: string | null
          report_id?: string | null
          resend_email?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          signing_token?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_address?: string | null
          client_data?: Json | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          completed_at?: string | null
          created_at?: string
          document_name?: string
          host_user_id?: string
          id?: string
          original_pdf_path?: string | null
          report_id?: string | null
          resend_email?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_pdf_path?: string | null
          signing_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      esign_signatures: {
        Row: {
          created_at: string
          document_id: string
          field_index: number
          id: string
          ip_address: string | null
          signature_data: string
          signed_at: string
          signer_email: string | null
          signer_name: string
        }
        Insert: {
          created_at?: string
          document_id: string
          field_index?: number
          id?: string
          ip_address?: string | null
          signature_data: string
          signed_at?: string
          signer_email?: string | null
          signer_name: string
        }
        Update: {
          created_at?: string
          document_id?: string
          field_index?: number
          id?: string
          ip_address?: string | null
          signature_data?: string
          signed_at?: string
          signer_email?: string | null
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "esign_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "esign_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      esign_templates: {
        Row: {
          created_at: string
          description: string | null
          fields: Json
          id: string
          name: string
          pdf_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          name: string
          pdf_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          pdf_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          client_email: string | null
          client_name: string
          created_at: string
          ended_at: string | null
          host_user_id: string
          id: string
          meeting_id: string
          report_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          client_email?: string | null
          client_name: string
          created_at?: string
          ended_at?: string | null
          host_user_id: string
          id?: string
          meeting_id?: string
          report_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string
          created_at?: string
          ended_at?: string | null
          host_user_id?: string
          id?: string
          meeting_id?: string
          report_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_blocked: boolean
          is_owner: boolean
          last_login_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_blocked?: boolean
          is_owner?: boolean
          last_login_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_blocked?: boolean
          is_owner?: boolean
          last_login_at?: string | null
        }
        Relationships: []
      }
      referral_leads: {
        Row: {
          created_at: string
          email_sent: boolean
          id: string
          lead_email: string
          lead_name: string
          lead_phone: string
          referrer_email: string
          referrer_name: string
          status: string
          submission_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean
          id?: string
          lead_email: string
          lead_name: string
          lead_phone: string
          referrer_email: string
          referrer_name: string
          status?: string
          submission_id?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean
          id?: string
          lead_email?: string
          lead_name?: string
          lead_phone?: string
          referrer_email?: string
          referrer_name?: string
          status?: string
          submission_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_leads_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "referral_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_responses: {
        Row: {
          age: string | null
          created_at: string
          email: string
          had_review_before: boolean | null
          id: string
          lead_id: string
          name: string
          phone: string
          state: string | null
          super_balance: string | null
          super_fund_name: string | null
        }
        Insert: {
          age?: string | null
          created_at?: string
          email: string
          had_review_before?: boolean | null
          id?: string
          lead_id: string
          name: string
          phone: string
          state?: string | null
          super_balance?: string | null
          super_fund_name?: string | null
        }
        Update: {
          age?: string | null
          created_at?: string
          email?: string
          had_review_before?: boolean | null
          id?: string
          lead_id?: string
          name?: string
          phone?: string
          state?: string | null
          super_balance?: string | null
          super_fund_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "referral_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_submissions: {
        Row: {
          client_email: string
          client_name: string
          created_at: string
          id: string
          referrals: Json
        }
        Insert: {
          client_email: string
          client_name: string
          created_at?: string
          id?: string
          referrals?: Json
        }
        Update: {
          client_email?: string
          client_name?: string
          created_at?: string
          id?: string
          referrals?: Json
        }
        Relationships: []
      }
      reports: {
        Row: {
          client_name: string
          created_at: string
          email: string | null
          id: string
          inputs: Json
          pdf_path: string | null
          summary: Json | null
          user_id: string
        }
        Insert: {
          client_name: string
          created_at?: string
          email?: string | null
          id?: string
          inputs: Json
          pdf_path?: string | null
          summary?: Json | null
          user_id: string
        }
        Update: {
          client_name?: string
          created_at?: string
          email?: string | null
          id?: string
          inputs?: Json
          pdf_path?: string | null
          summary?: Json | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_signing: {
        Args: { _signed_pdf_path: string; _token: string }
        Returns: undefined
      }
      is_blocked: { Args: { _uid: string }; Returns: boolean }
      is_owner: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
