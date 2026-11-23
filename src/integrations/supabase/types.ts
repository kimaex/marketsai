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
      agent_identity: {
        Row: {
          agent_address: string | null
          agent_id: string | null
          agent_uri: string | null
          id: number
          registered_at: string | null
          registry: string | null
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          agent_address?: string | null
          agent_id?: string | null
          agent_uri?: string | null
          id?: number
          registered_at?: string | null
          registry?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          agent_address?: string | null
          agent_id?: string | null
          agent_uri?: string | null
          id?: number
          registered_at?: string | null
          registry?: string | null
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          parts: Json
          role: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          owner_id: string
          parts?: Json
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          parts?: Json
          role?: string
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor: string
          created_at: string
          detail: string | null
          event: string
          id: string
          order_id: string
          tx_hash: string | null
        }
        Insert: {
          actor?: string
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          order_id: string
          tx_hash?: string | null
        }
        Update: {
          actor?: string
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          order_id?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approval_mode: string
          approved_at: string | null
          buyer_id: string
          buyer_note: string | null
          comparison: Json
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_days: number | null
          delivery_fee_ngn: number
          fx_rate_ngn_per_usd: number
          fx_source: string
          id: string
          order_number: string
          paid_at: string | null
          pay_token: string
          payment_error: string | null
          payment_status: string
          product_id: string | null
          product_name: string
          quantity: number
          savings_ngn: number
          shipped_at: string | null
          status: string
          supplier_id: string
          supplier_note: string | null
          total_ngn: number
          total_usd: number
          tx_hash: string | null
          unit: string
          unit_price_ngn: number
          updated_at: string
        }
        Insert: {
          approval_mode?: string
          approved_at?: string | null
          buyer_id: string
          buyer_note?: string | null
          comparison?: Json
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_days?: number | null
          delivery_fee_ngn?: number
          fx_rate_ngn_per_usd: number
          fx_source: string
          id?: string
          order_number?: string
          paid_at?: string | null
          pay_token?: string
          payment_error?: string | null
          payment_status?: string
          product_id?: string | null
          product_name: string
          quantity: number
          savings_ngn?: number
          shipped_at?: string | null
          status?: string
          supplier_id: string
          supplier_note?: string | null
          total_ngn: number
          total_usd: number
          tx_hash?: string | null
          unit: string
          unit_price_ngn: number
          updated_at?: string
        }
        Update: {
          approval_mode?: string
          approved_at?: string | null
          buyer_id?: string
          buyer_note?: string | null
          comparison?: Json
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_days?: number | null
          delivery_fee_ngn?: number
          fx_rate_ngn_per_usd?: number
          fx_source?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          pay_token?: string
          payment_error?: string | null
          payment_status?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          savings_ngn?: number
          shipped_at?: string | null
          status?: string
          supplier_id?: string
          supplier_note?: string | null
          total_ngn?: number
          total_usd?: number
          tx_hash?: string | null
          unit?: string
          unit_price_ngn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          category: string
          id: string
          product_id: string
          product_name: string
          recorded_at: string
          supplier_id: string
          unit: string
          unit_price_ngn: number
        }
        Insert: {
          category: string
          id?: string
          product_id: string
          product_name: string
          recorded_at?: string
          supplier_id: string
          unit: string
          unit_price_ngn: number
        }
        Update: {
          category?: string
          id?: string
          product_id?: string
          product_name?: string
          recorded_at?: string
          supplier_id?: string
          unit?: string
          unit_price_ngn?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string
          created_at: string
          delivers_to: string[]
          delivery_days: number
          delivery_fee_ngn: number
          delivery_fee_per_unit_ngn: number
          id: string
          min_order_qty: number
          name: string
          stock_qty: number
          supplier_id: string
          unit: string
          unit_price_ngn: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          delivers_to?: string[]
          delivery_days?: number
          delivery_fee_ngn?: number
          delivery_fee_per_unit_ngn?: number
          id?: string
          min_order_qty?: number
          name: string
          stock_qty?: number
          supplier_id: string
          unit?: string
          unit_price_ngn: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          delivers_to?: string[]
          delivery_days?: number
          delivery_fee_ngn?: number
          delivery_fee_per_unit_ngn?: number
          id?: string
          min_order_qty?: number
          name?: string
          stock_qty?: number
          supplier_id?: string
          unit?: string
          unit_price_ngn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          business_type: string | null
          city: string | null
          country: string
          created_at: string
          delivery_address: string | null
          full_name: string | null
          id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          delivery_address?: string | null
          full_name?: string | null
          id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          country?: string
          created_at?: string
          delivery_address?: string | null
          full_name?: string | null
          id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spending_policies: {
        Row: {
          approved_supplier_ids: string[]
          approved_tokens: string[]
          autonomous_enabled: boolean
          autonomous_max_usd: number
          daily_limit_usd: number
          max_per_tx_usd: number
          owner_id: string
          restrict_to_approved_suppliers: boolean
          updated_at: string
          x402_daily_limit_usd: number
          x402_enabled: boolean
          x402_max_per_call_usd: number
        }
        Insert: {
          approved_supplier_ids?: string[]
          approved_tokens?: string[]
          autonomous_enabled?: boolean
          autonomous_max_usd?: number
          daily_limit_usd?: number
          max_per_tx_usd?: number
          owner_id: string
          restrict_to_approved_suppliers?: boolean
          updated_at?: string
          x402_daily_limit_usd?: number
          x402_enabled?: boolean
          x402_max_per_call_usd?: number
        }
        Update: {
          approved_supplier_ids?: string[]
          approved_tokens?: string[]
          autonomous_enabled?: boolean
          autonomous_max_usd?: number
          daily_limit_usd?: number
          max_per_tx_usd?: number
          owner_id?: string
          restrict_to_approved_suppliers?: boolean
          updated_at?: string
          x402_daily_limit_usd?: number
          x402_enabled?: boolean
          x402_max_per_call_usd?: number
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          business_name: string
          cac_number: string | null
          city: string
          country: string
          created_at: string
          description: string | null
          email: string | null
          id: string
          owner_id: string
          payout_wallet: string | null
          phone: string | null
          state: string
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          cac_number?: string | null
          city: string
          country?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          owner_id: string
          payout_wallet?: string | null
          phone?: string | null
          state: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          cac_number?: string | null
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          owner_id?: string
          payout_wallet?: string | null
          phone?: string | null
          state?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          amount_usd: number
          created_at: string
          description: string | null
          error: string | null
          id: string
          kind: string
          order_id: string | null
          owner_id: string
          status: string
          to_address: string | null
          token: string
          tx_hash: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          amount_usd: number
          created_at?: string
          description?: string | null
          error?: string | null
          id?: string
          kind: string
          order_id?: string | null
          owner_id: string
          status?: string
          to_address?: string | null
          token: string
          tx_hash?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_usd?: number
          created_at?: string
          description?: string | null
          error?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          owner_id?: string
          status?: string
          to_address?: string | null
          token?: string
          tx_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_order: { Args: { _order_id: string }; Returns: boolean }
      claim_agent_wallet: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_supplier: { Args: { _supplier_id: string }; Returns: boolean }
      reserve_spend: {
        Args: {
          _amount: number
          _amount_usd: number
          _daily_limit_usd: number
          _description: string
          _kind: string
          _order: string
          _owner: string
          _to: string
          _token: string
        }
        Returns: string
      }
      wallet_owner_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "wallet_owner" | "admin"
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
      app_role: ["wallet_owner", "admin"],
    },
  },
} as const
