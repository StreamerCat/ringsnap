export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          account_id: string;
          owner_name: string | null;
          owner_email: string | null;
          owner_phone: string | null;
          industry: string | null;
          plan_status: string | null;
          trial_start_at: string | null;
          trial_end_at: string | null;
          trial_minutes_used: number | null;
          onboarding_step: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          vapi_assistant_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          account_id?: string;
          owner_name?: string | null;
          owner_email?: string | null;
          owner_phone?: string | null;
          industry?: string | null;
          plan_status?: string | null;
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          trial_minutes_used?: number | null;
          onboarding_step?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          vapi_assistant_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          account_id?: string;
          owner_name?: string | null;
          owner_email?: string | null;
          owner_phone?: string | null;
          industry?: string | null;
          plan_status?: string | null;
          trial_start_at?: string | null;
          trial_end_at?: string | null;
          trial_minutes_used?: number | null;
          onboarding_step?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          vapi_assistant_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          account_id: string | null;
          name: string | null;
          email: string | null;
          phone: string | null;
          role: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string | null;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          role?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["account_id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
