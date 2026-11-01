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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      bot_button_locks: {
        Row: {
          choice: string | null
          context_id: string
          created_at: string
          phone: string | null
        }
        Insert: {
          choice?: string | null
          context_id: string
          created_at?: string
          phone?: string | null
        }
        Update: {
          choice?: string | null
          context_id?: string
          created_at?: string
          phone?: string | null
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          active: boolean
          auto_rules: Json
          category: string
          category_title: string | null
          key: string
          kind: string
          label: string | null
          name: string
          pdf_url: string | null
          price: number | null
          sort: number
          specs: Json
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_rules?: Json
          category?: string
          category_title?: string | null
          key: string
          kind?: string
          label?: string | null
          name: string
          pdf_url?: string | null
          price?: number | null
          sort?: number
          specs?: Json
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_rules?: Json
          category?: string
          category_title?: string | null
          key?: string
          kind?: string
          label?: string | null
          name?: string
          pdf_url?: string | null
          price?: number | null
          sort?: number
          specs?: Json
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          bot_paused: boolean
          city: string | null
          created_at: string
          id: string
          last_at: string
          last_message: string | null
          name: string | null
          notes: string | null
          phone: string
          stage: string
          system: string | null
          unread: number
        }
        Insert: {
          bot_paused?: boolean
          city?: string | null
          created_at?: string
          id?: string
          last_at?: string
          last_message?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          stage?: string
          system?: string | null
          unread?: number
        }
        Update: {
          bot_paused?: boolean
          city?: string | null
          created_at?: string
          id?: string
          last_at?: string
          last_message?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          stage?: string
          system?: string | null
          unread?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          customer_id: string
          direction: string
          file_name: string | null
          id: string
          kind: string
          media_id: string | null
          media_url: string | null
          mime: string | null
          text: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          direction?: string
          file_name?: string | null
          id?: string
          kind?: string
          media_id?: string | null
          media_url?: string | null
          mime?: string | null
          text?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          direction?: string
          file_name?: string | null
          id?: string
          kind?: string
          media_id?: string | null
          media_url?: string | null
          mime?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          decided_at: string | null
          details: string | null
          id: string
          invoice_no: string | null
          method: string | null
          name: string | null
          phone: string
          status: string
        }
        Insert: {
          amount?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          decided_at?: string | null
          details?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          name?: string | null
          phone: string
          status?: string
        }
        Update: {
          amount?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          decided_at?: string | null
          details?: string | null
          id?: string
          invoice_no?: string | null
          method?: string | null
          name?: string | null
          phone?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_reports: {
        Row: {
          file_name: string
          kind: string
          path: string
          preset_title: string
          updated_at: string
        }
        Insert: {
          file_name: string
          kind: string
          path: string
          preset_title: string
          updated_at?: string
        }
        Update: {
          file_name?: string
          kind?: string
          path?: string
          preset_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          city: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          items: Json
          notes: string | null
          phone: string | null
          quote_no: string
          total: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          phone?: string | null
          quote_no?: string
          total?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          phone?: string | null
          quote_no?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      report_requests: {
        Row: {
          azimuth: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          lat: number | null
          lon: number | null
          name: string | null
          phone: string
          sent_at: string | null
          status: string
          system_label: string | null
          tilt: number | null
        }
        Insert: {
          azimuth?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          phone: string
          sent_at?: string | null
          status?: string
          system_label?: string | null
          tilt?: number | null
        }
        Update: {
          azimuth?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          phone?: string
          sent_at?: string | null
          status?: string
          system_label?: string | null
          tilt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "report_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          city: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          device: string | null
          id: string
          issue_type: string | null
          media_id: string | null
          media_type: string | null
          name: string | null
          phone: string
          resolved_at: string | null
          status: string
          ticket_no: string
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          device?: string | null
          id?: string
          issue_type?: string | null
          media_id?: string | null
          media_type?: string | null
          name?: string | null
          phone: string
          resolved_at?: string | null
          status?: string
          ticket_no?: string
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          device?: string | null
          id?: string
          issue_type?: string | null
          media_id?: string | null
          media_type?: string | null
          name?: string | null
          phone?: string
          resolved_at?: string | null
          status?: string
          ticket_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
