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
      accounts: {
        Row: {
          business_hours: Json | null
          company_domain: string | null
          company_name: string
          created_at: string | null
          emergency_policy: string | null
          id: string
          onboarding_completed: boolean | null
          plan_type: string | null
          provisioning_error: string | null
          provisioning_status: string | null
          sales_rep_name: string | null
          service_area: string | null
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
        }
        Insert: {
          business_hours?: Json | null
          company_domain?: string | null
          company_name: string
          created_at?: string | null
          emergency_policy?: string | null
          id?: string
          onboarding_completed?: boolean | null
          plan_type?: string | null
          provisioning_error?: string | null
          provisioning_status?: string | null
          sales_rep_name?: string | null
          service_area?: string | null
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
        }
        Update: {
          business_hours?: Json | null
          company_domain?: string | null
          company_name?: string
          created_at?: string | null
          emergency_policy?: string | null
          id?: string
          onboarding_completed?: boolean | null
          plan_type?: string | null
          provisioning_error?: string | null
          provisioning_status?: string | null
          sales_rep_name?: string | null
          service_area?: string | null
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
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          created_at?: string | null
          id: string
          is_primary?: boolean | null
          name: string
          phone: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string
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
      trial_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          source: string | null
          trade: string | null
          wants_advanced_voice: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone: string
          source?: string | null
          trade?: string | null
          wants_advanced_voice?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          source?: string | null
          trade?: string | null
          wants_advanced_voice?: boolean | null
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          account_id: string
          call_cost_cents: number | null
          call_duration_seconds: number | null
          call_id: string | null
          call_type: string | null
          created_at: string | null
          customer_phone: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          account_id: string
          call_cost_cents?: number | null
          call_duration_seconds?: number | null
          call_id?: string | null
          call_type?: string | null
          created_at?: string | null
          customer_phone?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          account_id?: string
          call_cost_cents?: number | null
          call_duration_seconds?: number | null
          call_id?: string | null
          call_type?: string | null
          created_at?: string | null
          customer_phone?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_generic_email_domain: { Args: { domain: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
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
      app_role: ["owner", "admin", "user"],
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
