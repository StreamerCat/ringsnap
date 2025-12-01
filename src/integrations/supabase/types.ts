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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_credits: {
        Row: {
          account_id: string | null
          amount_cents: number
          applied_to_invoice_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          source: string
          source_id: string | null
          status: string | null
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          applied_to_invoice_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          source: string
          source_id?: string | null
          status?: string | null
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          applied_to_invoice_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          source?: string
          source_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_members: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["account_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_status: string | null
          assistant_gender: string | null
          billing_cycle_start: string | null
          billing_state: string | null
          business_hours: Json | null
          call_recording_consent_accepted: boolean | null
          call_recording_consent_date: string | null
          call_recording_enabled: boolean | null
          call_recording_retention_days: number | null
          company_domain: string | null
          company_name: string
          company_website: string | null
          created_at: string | null
          custom_instructions: string | null
          daily_sms_quota: number | null
          daily_sms_sent: number | null
          device_fingerprint: string | null
          email_verified: boolean | null
          emergency_policy: string | null
          flagged_reason: string | null
          id: string
          is_flagged_for_review: boolean | null
          last_usage_warning_level: string | null
          last_usage_warning_sent_at: string | null
          monthly_minutes_limit: number | null
          monthly_minutes_used: number | null
          onboarding_completed: boolean | null
          overage_cap_percentage: number | null
          overage_minutes_used: number | null
          phone_number_area_code: string | null
          phone_number_held_until: string | null
          phone_number_status: string | null
          phone_verified: boolean | null
          plan_type: string | null
          provisioning_error: string | null
          provisioning_status: string | null
          sales_rep_name: string | null
          service_area: string | null
          service_specialties: string | null
          signup_ip: string | null
          sms_appointment_confirmations: boolean | null
          sms_enabled: boolean | null
          sms_reminders: boolean | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trade: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string | null
          vapi_assistant_id: string | null
          vapi_phone_number: string | null
          wants_advanced_voice: boolean | null
          zip_code: string | null
        }
        Insert: {
          account_status?: string | null
          assistant_gender?: string | null
          billing_cycle_start?: string | null
          billing_state?: string | null
          business_hours?: Json | null
          call_recording_consent_accepted?: boolean | null
          call_recording_consent_date?: string | null
          call_recording_enabled?: boolean | null
          call_recording_retention_days?: number | null
          company_domain?: string | null
          company_name: string
          company_website?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          daily_sms_quota?: number | null
          daily_sms_sent?: number | null
          device_fingerprint?: string | null
          email_verified?: boolean | null
          emergency_policy?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged_for_review?: boolean | null
          last_usage_warning_level?: string | null
          last_usage_warning_sent_at?: string | null
          monthly_minutes_limit?: number | null
          monthly_minutes_used?: number | null
          onboarding_completed?: boolean | null
          overage_cap_percentage?: number | null
          overage_minutes_used?: number | null
          phone_number_area_code?: string | null
          phone_number_held_until?: string | null
          phone_number_status?: string | null
          phone_verified?: boolean | null
          plan_type?: string | null
          provisioning_error?: string | null
          provisioning_status?: string | null
          sales_rep_name?: string | null
          service_area?: string | null
          service_specialties?: string | null
          signup_ip?: string | null
          sms_appointment_confirmations?: boolean | null
          sms_enabled?: boolean | null
          sms_reminders?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trade?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number?: string | null
          wants_advanced_voice?: boolean | null
          zip_code?: string | null
        }
        Update: {
          account_status?: string | null
          assistant_gender?: string | null
          billing_cycle_start?: string | null
          billing_state?: string | null
          business_hours?: Json | null
          call_recording_consent_accepted?: boolean | null
          call_recording_consent_date?: string | null
          call_recording_enabled?: boolean | null
          call_recording_retention_days?: number | null
          company_domain?: string | null
          company_name?: string
          company_website?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          daily_sms_quota?: number | null
          daily_sms_sent?: number | null
          device_fingerprint?: string | null
          email_verified?: boolean | null
          emergency_policy?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged_for_review?: boolean | null
          last_usage_warning_level?: string | null
          last_usage_warning_sent_at?: string | null
          monthly_minutes_limit?: number | null
          monthly_minutes_used?: number | null
          onboarding_completed?: boolean | null
          overage_cap_percentage?: number | null
          overage_minutes_used?: number | null
          phone_number_area_code?: string | null
          phone_number_held_until?: string | null
          phone_number_status?: string | null
          phone_verified?: boolean | null
          plan_type?: string | null
          provisioning_error?: string | null
          provisioning_status?: string | null
          sales_rep_name?: string | null
          service_area?: string | null
          service_specialties?: string | null
          signup_ip?: string | null
          sms_appointment_confirmations?: boolean | null
          sms_enabled?: boolean | null
          sms_reminders?: boolean | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          trade?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          vapi_phone_number?: string | null
          wants_advanced_voice?: boolean | null
          zip_code?: string | null
        }
        Relationships: []
      }
      assistants: {
        Row: {
          account_id: string | null
          created_at: string | null
          custom_instructions: string | null
          id: string
          is_primary: boolean | null
          language: string | null
          name: string
          phone_number_id: string | null
          status: string | null
          updated_at: string | null
          vapi_assistant_id: string | null
          voice_gender: string | null
          voice_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          is_primary?: boolean | null
          language?: string | null
          name: string
          phone_number_id?: string | null
          status?: string | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          voice_gender?: string | null
          voice_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          id?: string
          is_primary?: boolean | null
          language?: string | null
          name?: string
          phone_number_id?: string | null
          status?: string | null
          updated_at?: string | null
          vapi_assistant_id?: string | null
          voice_gender?: string | null
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistants_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_pattern_alerts: {
        Row: {
          account_id: string | null
          alert_details: Json | null
          alert_type: string
          auto_flagged: boolean | null
          created_at: string | null
          id: string
          reviewed: boolean | null
          severity: string | null
        }
        Insert: {
          account_id?: string | null
          alert_details?: Json | null
          alert_type: string
          auto_flagged?: boolean | null
          created_at?: string | null
          id?: string
          reviewed?: boolean | null
          severity?: string | null
        }
        Update: {
          account_id?: string | null
          alert_details?: Json | null
          alert_type?: string
          auto_flagged?: boolean | null
          created_at?: string | null
          id?: string
          reviewed?: boolean | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_pattern_alerts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          account_id: string | null
          area_code: string
          created_at: string | null
          held_until: string | null
          id: string
          is_primary: boolean | null
          label: string | null
          phone_number: string
          purpose: string | null
          status: string | null
          updated_at: string | null
          vapi_phone_id: string | null
        }
        Insert: {
          account_id?: string | null
          area_code: string
          created_at?: string | null
          held_until?: string | null
          id?: string
          is_primary?: boolean | null
          label?: string | null
          phone_number: string
          purpose?: string | null
          status?: string | null
          updated_at?: string | null
          vapi_phone_id?: string | null
        }
        Update: {
          account_id?: string | null
          area_code?: string
          created_at?: string | null
          held_until?: string | null
          id?: string
          is_primary?: boolean | null
          label?: string | null
          phone_number?: string
          purpose?: string | null
          status?: string | null
          updated_at?: string | null
          vapi_phone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_definitions: {
        Row: {
          call_recording_enabled: boolean | null
          max_assistants: number
          max_phone_numbers: number
          monthly_minutes_limit: number
          name: string
          overage_rate_cents: number
          plan_type: string
          price_cents: number
          sms_enabled: boolean | null
          stripe_price_id: string | null
        }
        Insert: {
          call_recording_enabled?: boolean | null
          max_assistants: number
          max_phone_numbers: number
          monthly_minutes_limit: number
          name: string
          overage_rate_cents: number
          plan_type: string
          price_cents: number
          sms_enabled?: boolean | null
          stripe_price_id?: string | null
        }
        Update: {
          call_recording_enabled?: boolean | null
          max_assistants?: number
          max_phone_numbers?: number
          monthly_minutes_limit?: number
          name?: string
          overage_rate_cents?: number
          plan_type?: string
          price_cents?: number
          sms_enabled?: boolean | null
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          name: string | null
          onboarding_status: string | null
          phone: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          id: string
          is_primary?: boolean | null
          name?: string | null
          onboarding_status?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string | null
          onboarding_status?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          account_id: string | null
          code: string
          created_at: string | null
          id: string
        }
        Insert: {
          account_id?: string | null
          code: string
          created_at?: string | null
          id?: string
        }
        Update: {
          account_id?: string | null
          code?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string | null
          flag_reason: string | null
          id: string
          is_flagged: boolean | null
          referee_account_id: string | null
          referee_credit_cents: number | null
          referee_email: string | null
          referee_phone: string | null
          referee_signup_ip: string | null
          referral_code: string | null
          referrer_account_id: string | null
          referrer_credit_cents: number | null
          status: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          referee_account_id?: string | null
          referee_credit_cents?: number | null
          referee_email?: string | null
          referee_phone?: string | null
          referee_signup_ip?: string | null
          referral_code?: string | null
          referrer_account_id?: string | null
          referrer_credit_cents?: number | null
          status?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          referee_account_id?: string | null
          referee_credit_cents?: number | null
          referee_email?: string | null
          referee_phone?: string | null
          referee_signup_ip?: string | null
          referral_code?: string | null
          referrer_account_id?: string | null
          referrer_credit_cents?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_account_id_fkey"
            columns: ["referee_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "referrals_referrer_account_id_fkey"
            columns: ["referrer_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_report_leads: {
        Row: {
          business: string
          created_at: string
          customer_calls: number | null
          email: string
          id: string
          lost_revenue: number | null
          name: string
          net_gain: number | null
          payback_days: number | null
          recovered_revenue: number | null
          roi: number | null
          trade: string | null
        }
        Insert: {
          business: string
          created_at?: string
          customer_calls?: number | null
          email: string
          id?: string
          lost_revenue?: number | null
          name: string
          net_gain?: number | null
          payback_days?: number | null
          recovered_revenue?: number | null
          roi?: number | null
          trade?: string | null
        }
        Update: {
          business?: string
          created_at?: string
          customer_calls?: number | null
          email?: string
          id?: string
          lost_revenue?: number | null
          name?: string
          net_gain?: number | null
          payback_days?: number | null
          recovered_revenue?: number | null
          roi?: number | null
          trade?: string | null
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          account_id: string | null
          change_type: string
          changed_by_user_id: string
          context: string | null
          created_at: string | null
          id: string
          new_role: string | null
          old_role: string | null
          target_user_id: string
        }
        Insert: {
          account_id?: string | null
          change_type: string
          changed_by_user_id: string
          context?: string | null
          created_at?: string | null
          id?: string
          new_role?: string | null
          old_role?: string | null
          target_user_id: string
        }
        Update: {
          account_id?: string | null
          change_type?: string
          changed_by_user_id?: string
          context?: string | null
          created_at?: string | null
          id?: string
          new_role?: string | null
          old_role?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          blocked_reason: string | null
          created_at: string | null
          device_fingerprint: string | null
          email: string
          id: string
          ip_address: string
          phone: string | null
          success: boolean | null
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          email: string
          id?: string
          ip_address: string
          phone?: string | null
          success?: boolean | null
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          email?: string
          id?: string
          ip_address?: string
          phone?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          account_id: string | null
          conversation_id: string | null
          created_at: string | null
          direction: string
          from_number: string
          id: string
          message_body: string
          phone_number_id: string | null
          status: string | null
          to_number: string
          vapi_message_id: string | null
        }
        Insert: {
          account_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction: string
          from_number: string
          id?: string
          message_body: string
          phone_number_id?: string | null
          status?: string | null
          to_number: string
          vapi_message_id?: string | null
        }
        Update: {
          account_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          direction?: string
          from_number?: string
          id?: string
          message_body?: string
          phone_number_id?: string | null
          status?: string | null
          to_number?: string
          vapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: []
      }
      state_recording_laws: {
        Row: {
          consent_type: string
          notification_text: string | null
          requires_notification: boolean | null
          state_code: string
          state_name: string
        }
        Insert: {
          consent_type: string
          notification_text?: string | null
          requires_notification?: boolean | null
          state_code: string
          state_name: string
        }
        Update: {
          consent_type?: string
          notification_text?: string | null
          requires_notification?: boolean | null
          state_code?: string
          state_name?: string
        }
        Relationships: []
      }
      trial_signups: {
        Row: {
          assistant_gender: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          referral_code: string | null
          source: string | null
          trade: string | null
          wants_advanced_voice: boolean | null
          zip_code: string | null
        }
        Insert: {
          assistant_gender?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          referral_code?: string | null
          source?: string | null
          trade?: string | null
          wants_advanced_voice?: boolean | null
          zip_code?: string | null
        }
        Update: {
          assistant_gender?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          referral_code?: string | null
          source?: string | null
          trade?: string | null
          wants_advanced_voice?: boolean | null
          zip_code?: string | null
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          account_id: string
          appointment_booked: boolean | null
          assistant_id: string | null
          call_cost_cents: number | null
          call_duration_seconds: number | null
          call_id: string | null
          call_type: string | null
          created_at: string | null
          customer_phone: string | null
          id: string
          is_overage: boolean | null
          metadata: Json | null
          phone_number_id: string | null
          recording_duration_seconds: number | null
          recording_expires_at: string | null
          recording_url: string | null
          was_emergency: boolean | null
          was_transferred: boolean | null
        }
        Insert: {
          account_id: string
          appointment_booked?: boolean | null
          assistant_id?: string | null
          call_cost_cents?: number | null
          call_duration_seconds?: number | null
          call_id?: string | null
          call_type?: string | null
          created_at?: string | null
          customer_phone?: string | null
          id?: string
          is_overage?: boolean | null
          metadata?: Json | null
          phone_number_id?: string | null
          recording_duration_seconds?: number | null
          recording_expires_at?: string | null
          recording_url?: string | null
          was_emergency?: boolean | null
          was_transferred?: boolean | null
        }
        Update: {
          account_id?: string
          appointment_booked?: boolean | null
          assistant_id?: string | null
          call_cost_cents?: number | null
          call_duration_seconds?: number | null
          call_id?: string | null
          call_type?: string | null
          created_at?: string | null
          customer_phone?: string | null
          id?: string
          is_overage?: boolean | null
          metadata?: Json | null
          phone_number_id?: string | null
          recording_duration_seconds?: number | null
          recording_expires_at?: string | null
          recording_url?: string | null
          was_emergency?: boolean | null
          was_transferred?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_library: {
        Row: {
          accent: string | null
          created_at: string | null
          gender: string | null
          id: string
          is_premium: boolean | null
          provider: string
          sample_url: string | null
          tone: string | null
          voice_id: string
          voice_name: string
        }
        Insert: {
          accent?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_premium?: boolean | null
          provider?: string
          sample_url?: string | null
          tone?: string | null
          voice_id: string
          voice_name: string
        }
        Update: {
          accent?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_premium?: boolean | null
          provider?: string
          sample_url?: string | null
          tone?: string | null
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      extract_email_domain: { Args: { email: string }; Returns: string }
      get_user_account_id: { Args: { _user_id: string }; Returns: string }
      has_account_role: {
        Args: {
          _account_id: string
          _role: Database["public"]["Enums"]["account_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["staff_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_generic_email_domain: { Args: { domain: string }; Returns: boolean }
    }
    Enums: {
      account_role: "owner" | "admin" | "user"
      staff_role:
        | "platform_owner"
        | "platform_admin"
        | "support"
        | "viewer"
        | "sales"
      subscription_status:
        | "trial"
        | "active"
        | "cancelled"
        | "expired"
        | "past_due"
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
    Enums: {
      account_role: ["owner", "admin", "user"],
      staff_role: [
        "platform_owner",
        "platform_admin",
        "support",
        "viewer",
        "sales",
      ],
      subscription_status: [
        "trial",
        "active",
        "cancelled",
        "expired",
        "past_due",
      ],
    },
  },
} as const
