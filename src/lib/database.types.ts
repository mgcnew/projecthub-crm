
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
            "activity_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": NonNullable<Json>,"created_at": string,"entity_id": string,"entity_type": string,"id": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id": string,"entity_type": string,"id"?: string,"organization_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity_id"?: string,"entity_type"?: string,"id"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_logs_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"calendar_events": {
                  Row: {
                    "client_id": string | null,"created_at": string,"description": string | null,"ends_at": string,"event_type": string,"id": string,"organization_id": string,"project_id": string | null,"recurrence_rule_id": string | null,"starts_at": string,"status": string,"task_id": string | null,"timezone": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at": string,"event_type"?: string,"id"?: string,"organization_id": string,"project_id"?: string | null,"recurrence_rule_id"?: string | null,"starts_at": string,"status"?: string,"task_id"?: string | null,"timezone": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"description"?: string | null,"ends_at"?: string,"event_type"?: string,"id"?: string,"organization_id"?: string,"project_id"?: string | null,"recurrence_rule_id"?: string | null,"starts_at"?: string,"status"?: string,"task_id"?: string | null,"timezone"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_events_organization_id_client_id_fkey"
      columns: ["organization_id","client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "calendar_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "calendar_events_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "calendar_events_organization_id_recurrence_rule_id_fkey"
      columns: ["organization_id","recurrence_rule_id"]
isOneToOne: false
      referencedRelation: "recurrence_rules"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "calendar_events_organization_id_task_id_fkey"
      columns: ["organization_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"checklist_items": {
                  Row: {
                    "completed_at": string | null,"id": string,"is_completed": boolean,"organization_id": string,"sort_order": number,"task_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"id"?: string,"is_completed"?: boolean,"organization_id": string,"sort_order"?: number,"task_id": string,"title": string
                  }
                  Update: {
                    "completed_at"?: string | null,"id"?: string,"is_completed"?: boolean,"organization_id"?: string,"sort_order"?: number,"task_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_items_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklist_items_organization_id_task_id_fkey"
      columns: ["organization_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"checklist_template_items": {
                  Row: {
                    "id": string,"organization_id": string,"sort_order": number,"template_id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"organization_id": string,"sort_order"?: number,"template_id": string,"title": string
                  }
                  Update: {
                    "id"?: string,"organization_id"?: string,"sort_order"?: number,"template_id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_template_items_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "checklist_template_items_organization_id_template_id_fkey"
      columns: ["organization_id","template_id"]
isOneToOne: false
      referencedRelation: "checklist_templates"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"checklist_templates": {
                  Row: {
                    "category": string | null,"created_at": string,"description": string | null,"id": string,"name": string,"organization_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string,"organization_id": string
                  }
                  Update: {
                    "category"?: string | null,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string,"organization_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "checklist_templates_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
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
                },"meetings": {
                  Row: {
                    "agenda": string | null,"calendar_event_id": string,"created_at": string,"decisions": string | null,"id": string,"notes": string | null,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agenda"?: string | null,"calendar_event_id": string,"created_at"?: string,"decisions"?: string | null,"id"?: string,"notes"?: string | null,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "agenda"?: string | null,"calendar_event_id"?: string,"created_at"?: string,"decisions"?: string | null,"id"?: string,"notes"?: string | null,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meetings_organization_id_calendar_event_id_fkey"
      columns: ["organization_id","calendar_event_id"]
isOneToOne: false
      referencedRelation: "calendar_events"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "meetings_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_deliveries": {
                  Row: {
                    "attempt_count": number,"channel": string,"created_at": string,"id": string,"last_error": string | null,"notification_id": string,"organization_id": string,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_count"?: number,"channel": string,"created_at"?: string,"id"?: string,"last_error"?: string | null,"notification_id": string,"organization_id": string,"sent_at"?: string | null,"status": string
                  }
                  Update: {
                    "attempt_count"?: number,"channel"?: string,"created_at"?: string,"id"?: string,"last_error"?: string | null,"notification_id"?: string,"organization_id"?: string,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_deliveries_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notification_deliveries_organization_id_notification_id_fkey"
      columns: ["organization_id","notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"event_id": string | null,"id": string,"occurrence_at": string,"organization_id": string,"read_at": string | null,"reminder_id": string | null,"task_id": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: string,"occurrence_at": string,"organization_id": string,"read_at"?: string | null,"reminder_id"?: string | null,"task_id"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: string,"occurrence_at"?: string,"organization_id"?: string,"read_at"?: string | null,"reminder_id"?: string | null,"task_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_organization_id_event_id_fkey"
      columns: ["organization_id","event_id"]
isOneToOne: false
      referencedRelation: "calendar_events"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notifications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_organization_id_reminder_id_fkey"
      columns: ["organization_id","reminder_id"]
isOneToOne: false
      referencedRelation: "reminders"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notifications_organization_id_task_id_fkey"
      columns: ["organization_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "notifications_organization_id_user_id_fkey"
      columns: ["organization_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
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
                },"recurrence_rules": {
                  Row: {
                    "by_weekday": (number)[],"created_at": string,"ends_on": string | null,"frequency": string,"id": string,"interval_value": number,"is_active": boolean,"occurrence_limit": number | null,"organization_id": string,"starts_on": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "by_weekday"?: (number)[],"created_at"?: string,"ends_on"?: string | null,"frequency": string,"id"?: string,"interval_value"?: number,"is_active"?: boolean,"occurrence_limit"?: number | null,"organization_id": string,"starts_on": string,"timezone": string
                  }
                  Update: {
                    "by_weekday"?: (number)[],"created_at"?: string,"ends_on"?: string | null,"frequency"?: string,"id"?: string,"interval_value"?: number,"is_active"?: boolean,"occurrence_limit"?: number | null,"organization_id"?: string,"starts_on"?: string,"timezone"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurrence_rules_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "created_at": string,"event_id": string | null,"id": string,"offset_minutes": number | null,"organization_id": string,"remind_at": string | null,"status": string,"task_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"offset_minutes"?: number | null,"organization_id": string,"remind_at"?: string | null,"status"?: string,"task_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"offset_minutes"?: number | null,"organization_id"?: string,"remind_at"?: string | null,"status"?: string,"task_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_organization_id_event_id_fkey"
      columns: ["organization_id","event_id"]
isOneToOne: false
      referencedRelation: "calendar_events"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "reminders_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_organization_id_task_id_fkey"
      columns: ["organization_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "reminders_organization_id_user_id_fkey"
      columns: ["organization_id","user_id"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
    }
                  ]
                },"task_plans": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"planned_date": string,"sort_order": number,"status": string,"task_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"planned_date": string,"sort_order"?: number,"status"?: string,"task_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"planned_date"?: string,"sort_order"?: number,"status"?: string,"task_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_plans_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_plans_organization_id_task_id_fkey"
      columns: ["organization_id","task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assigned_to": string | null,"client_id": string | null,"completed_at": string | null,"created_at": string,"description": string | null,"due_at": string | null,"due_date": string | null,"estimated_minutes": number | null,"id": string,"meeting_id": string | null,"organization_id": string,"parent_task_id": string | null,"priority": string,"project_id": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_at"?: string | null,"due_date"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"meeting_id"?: string | null,"organization_id": string,"parent_task_id"?: string | null,"priority"?: string,"project_id"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assigned_to"?: string | null,"client_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"description"?: string | null,"due_at"?: string | null,"due_date"?: string | null,"estimated_minutes"?: number | null,"id"?: string,"meeting_id"?: string | null,"organization_id"?: string,"parent_task_id"?: string | null,"priority"?: string,"project_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_organization_id_assigned_to_fkey"
      columns: ["organization_id","assigned_to"]
isOneToOne: false
      referencedRelation: "organization_members"
      referencedColumns: ["organization_id","user_id"]
    },{
      foreignKeyName: "tasks_organization_id_client_id_fkey"
      columns: ["organization_id","client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_organization_id_meeting_id_fkey"
      columns: ["organization_id","meeting_id"]
isOneToOne: false
      referencedRelation: "meetings"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_parent_task_id_fkey"
      columns: ["organization_id","parent_task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "tasks_organization_id_project_id_fkey"
      columns: ["organization_id","project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "timezone": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "timezone": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "timezone"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "list_calendar_occurrences":
{ Args: { "p_from": string,"p_to": string }; Returns: {
              "client_id": string,"event_id": string,"event_type": string,"is_recurring": boolean,"occurrence_date": string,"occurrence_end": string,"occurrence_start": string,"project_id": string,"status": string,"task_id": string,"timezone": string,"title": string
            }[]
                           }
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
