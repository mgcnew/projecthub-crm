
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "clients": {
                  Row: {
                    "archived_at": string | null,"company_name": string | null,"created_at": string,"email": string | null,"id": string,"name": string,"notes": string | null,"organization_id": string,"phone": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"company_name"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name": string,"notes"?: string | null,"organization_id": string,"phone"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"company_name"?: string | null,"created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"notes"?: string | null,"organization_id"?: string,"phone"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organization_members": {
                  Row: {
                    "joined_at": string,"organization_id": string,"role": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"organization_id": string,"role"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"organization_id"?: string,"role"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organization_members_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_logs": {
                  Row: {
                    "author_id": string,"content": string,"created_at": string,"id": string,"organization_id": string,"project_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"content"?: string,"created_at"?: string,"id"?: string,"organization_id": string,"project_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"content"?: string,"created_at"?: string,"id"?: string,"organization_id"?: string,"project_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_logs_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "archived_at": string | null,"client_id": string | null,"created_at": string,"description": string | null,"id": string,"name": string,"organization_id": string,"priority": string,"started_on": string | null,"status": string,"target_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"client_id"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"organization_id": string,"priority"?: string,"started_on"?: string | null,"status"?: string,"target_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"client_id"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"organization_id"?: string,"priority"?: string,"started_on"?: string | null,"status"?: string,"target_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_organization_id_client_id_fkey"
      columns: ["organization_id","client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "projects_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
