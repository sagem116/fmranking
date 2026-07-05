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
      apps: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_favorite: boolean
          last_accessed_at: string | null
          name: string
          password: string | null
          position: number
          updated_at: string
          url: string
          username: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_favorite?: boolean
          last_accessed_at?: string | null
          name: string
          password?: string | null
          position?: number
          updated_at?: string
          url: string
          username?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_favorite?: boolean
          last_accessed_at?: string | null
          name?: string
          password?: string | null
          position?: number
          updated_at?: string
          url?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apps_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      club_reputation_season: {
        Row: {
          avg_attendance: number | null
          club_id: string | null
          club_name: string
          created_at: string
          id: string
          reputation: number | null
          season_id: string
          season_ticket_holders: number | null
          season_year: number
          updated_at: string
        }
        Insert: {
          avg_attendance?: number | null
          club_id?: string | null
          club_name: string
          created_at?: string
          id?: string
          reputation?: number | null
          season_id: string
          season_ticket_holders?: number | null
          season_year: number
          updated_at?: string
        }
        Update: {
          avg_attendance?: number | null
          club_id?: string | null
          club_name?: string
          created_at?: string
          id?: string
          reputation?: number | null
          season_id?: string
          season_ticket_holders?: number | null
          season_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_reputation_season_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_reputation_season_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          continent: string | null
          country_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          continent?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          continent?: string | null
          country_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_assignments: {
        Row: {
          ca: number | null
          club_id: string | null
          club_name: string | null
          club_role: string | null
          coach_id: string
          coach_name: string
          country_name: string | null
          cp: number | null
          created_at: string
          id: string
          info: string | null
          intl_role: string | null
          intl_salary: number | null
          module: Database["public"]["Enums"]["module_type"]
          rc: number | null
          rm: number | null
          salary: number | null
          season_id: string
        }
        Insert: {
          ca?: number | null
          club_id?: string | null
          club_name?: string | null
          club_role?: string | null
          coach_id: string
          coach_name: string
          country_name?: string | null
          cp?: number | null
          created_at?: string
          id?: string
          info?: string | null
          intl_role?: string | null
          intl_salary?: number | null
          module: Database["public"]["Enums"]["module_type"]
          rc?: number | null
          rm?: number | null
          salary?: number | null
          season_id: string
        }
        Update: {
          ca?: number | null
          club_id?: string | null
          club_name?: string | null
          club_role?: string | null
          coach_id?: string
          coach_name?: string
          country_name?: string | null
          cp?: number | null
          created_at?: string
          id?: string
          info?: string | null
          intl_role?: string | null
          intl_salary?: number | null
          module?: Database["public"]["Enums"]["module_type"]
          rc?: number | null
          rm?: number | null
          salary?: number | null
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          age: number | null
          attacking_formation: string | null
          ca: number | null
          cp: number | null
          created_at: string
          defensive_formation: string | null
          id: string
          idu: string | null
          is_national_team: boolean | null
          marking_type: string | null
          mentality: string | null
          name: string
          national_team: string | null
          nationality: string | null
          personality: string | null
          play_style: string | null
          preferred_formation: string | null
          press_relationship: string | null
          pressing_type: string | null
          rc: number | null
          rm: number | null
          secondary_formation: string | null
          tactical_style: string | null
          training_type: string | null
        }
        Insert: {
          age?: number | null
          attacking_formation?: string | null
          ca?: number | null
          cp?: number | null
          created_at?: string
          defensive_formation?: string | null
          id?: string
          idu?: string | null
          is_national_team?: boolean | null
          marking_type?: string | null
          mentality?: string | null
          name: string
          national_team?: string | null
          nationality?: string | null
          personality?: string | null
          play_style?: string | null
          preferred_formation?: string | null
          press_relationship?: string | null
          pressing_type?: string | null
          rc?: number | null
          rm?: number | null
          secondary_formation?: string | null
          tactical_style?: string | null
          training_type?: string | null
        }
        Update: {
          age?: number | null
          attacking_formation?: string | null
          ca?: number | null
          cp?: number | null
          created_at?: string
          defensive_formation?: string | null
          id?: string
          idu?: string | null
          is_national_team?: boolean | null
          marking_type?: string | null
          mentality?: string | null
          name?: string
          national_team?: string | null
          nationality?: string | null
          personality?: string | null
          play_style?: string | null
          preferred_formation?: string | null
          press_relationship?: string | null
          pressing_type?: string | null
          rc?: number | null
          rm?: number | null
          secondary_formation?: string | null
          tactical_style?: string | null
          training_type?: string | null
        }
        Relationships: []
      }
      competition_reputation: {
        Row: {
          competition: string
          id: string
          reputation: number
          season_year: number | null
          updated_at: string
        }
        Insert: {
          competition: string
          id?: string
          reputation: number
          season_year?: number | null
          updated_at?: string
        }
        Update: {
          competition?: string
          id?: string
          reputation?: number
          season_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      competition_stats: {
        Row: {
          age_avg: number | null
          avg_rating_avg: number | null
          ca_avg: number | null
          comp_type: string
          competition: string
          continent: string | null
          country: string | null
          cp_avg: number | null
          created_at: string
          fouls_per90_avg: number | null
          id: string
          n_players: number | null
          pass_pct_avg: number | null
          ra_avg: number | null
          rc_avg: number | null
          reds_avg: number | null
          rm_avg: number | null
          salary_avg: number | null
          season_year: number
          shot_pct_avg: number | null
          tackles_per90_avg: number | null
          vp_avg: number | null
          xg_avg: number | null
          yellows_avg: number | null
        }
        Insert: {
          age_avg?: number | null
          avg_rating_avg?: number | null
          ca_avg?: number | null
          comp_type: string
          competition: string
          continent?: string | null
          country?: string | null
          cp_avg?: number | null
          created_at?: string
          fouls_per90_avg?: number | null
          id?: string
          n_players?: number | null
          pass_pct_avg?: number | null
          ra_avg?: number | null
          rc_avg?: number | null
          reds_avg?: number | null
          rm_avg?: number | null
          salary_avg?: number | null
          season_year: number
          shot_pct_avg?: number | null
          tackles_per90_avg?: number | null
          vp_avg?: number | null
          xg_avg?: number | null
          yellows_avg?: number | null
        }
        Update: {
          age_avg?: number | null
          avg_rating_avg?: number | null
          ca_avg?: number | null
          comp_type?: string
          competition?: string
          continent?: string | null
          country?: string | null
          cp_avg?: number | null
          created_at?: string
          fouls_per90_avg?: number | null
          id?: string
          n_players?: number | null
          pass_pct_avg?: number | null
          ra_avg?: number | null
          rc_avg?: number | null
          reds_avg?: number | null
          rm_avg?: number | null
          salary_avg?: number | null
          season_year?: number
          shot_pct_avg?: number | null
          tackles_per90_avg?: number | null
          vp_avg?: number | null
          xg_avg?: number | null
          yellows_avg?: number | null
        }
        Relationships: []
      }
      config_weights: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          profile_id: string
          value: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          profile_id: string
          value?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          profile_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "config_weights_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "weight_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      continental_results: {
        Row: {
          club1_id: string | null
          club2_id: string | null
          competition: string
          created_at: string
          id: string
          qf1: string | null
          qf2: string | null
          qf3: string | null
          qf4: string | null
          result: string | null
          season_id: string
          sf1: string | null
          sf2: string | null
          team1: string | null
          team2: string | null
          winner_club_id: string | null
        }
        Insert: {
          club1_id?: string | null
          club2_id?: string | null
          competition: string
          created_at?: string
          id?: string
          qf1?: string | null
          qf2?: string | null
          qf3?: string | null
          qf4?: string | null
          result?: string | null
          season_id: string
          sf1?: string | null
          sf2?: string | null
          team1?: string | null
          team2?: string | null
          winner_club_id?: string | null
        }
        Update: {
          club1_id?: string | null
          club2_id?: string | null
          competition?: string
          created_at?: string
          id?: string
          qf1?: string | null
          qf2?: string | null
          qf3?: string | null
          qf4?: string | null
          result?: string | null
          season_id?: string
          sf1?: string | null
          sf2?: string | null
          team1?: string | null
          team2?: string | null
          winner_club_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continental_results_club1_id_fkey"
            columns: ["club1_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continental_results_club2_id_fkey"
            columns: ["club2_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continental_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continental_results_winner_club_id_fkey"
            columns: ["winner_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          created_at: string
          filename: string | null
          id: string
          module: Database["public"]["Enums"]["module_type"]
          season_id: string
          status: string
          warnings: Json
        }
        Insert: {
          created_at?: string
          filename?: string | null
          id?: string
          module: Database["public"]["Enums"]["module_type"]
          season_id: string
          status?: string
          warnings?: Json
        }
        Update: {
          created_at?: string
          filename?: string | null
          id?: string
          module?: Database["public"]["Enums"]["module_type"]
          season_id?: string
          status?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "imports_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      international_results: {
        Row: {
          coach1: string | null
          coach2: string | null
          competition: string
          created_at: string
          id: string
          qf1: string | null
          qf1_coach: string | null
          qf2: string | null
          qf2_coach: string | null
          qf3: string | null
          qf3_coach: string | null
          qf4: string | null
          qf4_coach: string | null
          result: string | null
          season_id: string
          sf1: string | null
          sf1_coach: string | null
          sf2: string | null
          sf2_coach: string | null
          team1: string | null
          team2: string | null
          winner: string | null
        }
        Insert: {
          coach1?: string | null
          coach2?: string | null
          competition: string
          created_at?: string
          id?: string
          qf1?: string | null
          qf1_coach?: string | null
          qf2?: string | null
          qf2_coach?: string | null
          qf3?: string | null
          qf3_coach?: string | null
          qf4?: string | null
          qf4_coach?: string | null
          result?: string | null
          season_id: string
          sf1?: string | null
          sf1_coach?: string | null
          sf2?: string | null
          sf2_coach?: string | null
          team1?: string | null
          team2?: string | null
          winner?: string | null
        }
        Update: {
          coach1?: string | null
          coach2?: string | null
          competition?: string
          created_at?: string
          id?: string
          qf1?: string | null
          qf1_coach?: string | null
          qf2?: string | null
          qf2_coach?: string | null
          qf3?: string | null
          qf3_coach?: string | null
          qf4?: string | null
          qf4_coach?: string | null
          result?: string | null
          season_id?: string
          sf1?: string | null
          sf1_coach?: string | null
          sf2?: string | null
          sf2_coach?: string | null
          team1?: string | null
          team2?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "international_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          age: number | null
          ast: number | null
          avg_rating: number | null
          ca: number | null
          club: string | null
          comp_type: string
          competition: string
          continent: string | null
          country: string | null
          cp: number | null
          created_at: string
          fouls_per90: number | null
          games: number | null
          gls: number | null
          hdj: number | null
          id: string
          idu: string | null
          nationality: string | null
          pass_pct: number | null
          player_name: string
          ra: number | null
          rc: number | null
          reds: number | null
          rm: number | null
          salary: number | null
          season_year: number
          shot_pct: number | null
          tackles_per90: number | null
          vp: number | null
          xg: number | null
          yellows: number | null
        }
        Insert: {
          age?: number | null
          ast?: number | null
          avg_rating?: number | null
          ca?: number | null
          club?: string | null
          comp_type: string
          competition: string
          continent?: string | null
          country?: string | null
          cp?: number | null
          created_at?: string
          fouls_per90?: number | null
          games?: number | null
          gls?: number | null
          hdj?: number | null
          id?: string
          idu?: string | null
          nationality?: string | null
          pass_pct?: number | null
          player_name: string
          ra?: number | null
          rc?: number | null
          reds?: number | null
          rm?: number | null
          salary?: number | null
          season_year: number
          shot_pct?: number | null
          tackles_per90?: number | null
          vp?: number | null
          xg?: number | null
          yellows?: number | null
        }
        Update: {
          age?: number | null
          ast?: number | null
          avg_rating?: number | null
          ca?: number | null
          club?: string | null
          comp_type?: string
          competition?: string
          continent?: string | null
          country?: string | null
          cp?: number | null
          created_at?: string
          fouls_per90?: number | null
          games?: number | null
          gls?: number | null
          hdj?: number | null
          id?: string
          idu?: string | null
          nationality?: string | null
          pass_pct?: number | null
          player_name?: string
          ra?: number | null
          rc?: number | null
          reds?: number | null
          rm?: number | null
          salary?: number | null
          season_year?: number
          shot_pct?: number | null
          tackles_per90?: number | null
          vp?: number | null
          xg?: number | null
          yellows?: number | null
        }
        Relationships: []
      }
      players: {
        Row: {
          age: number | null
          ast: number
          ca: number
          club_id: string | null
          club_name: string | null
          cp: number
          created_at: string
          gls: number
          id: string
          idu: string | null
          info: string | null
          league: string | null
          module: string
          name: string
          ra: number
          rec: string | null
          rm: number
          salary: number
          season_id: string
          vp: number
        }
        Insert: {
          age?: number | null
          ast?: number
          ca?: number
          club_id?: string | null
          club_name?: string | null
          cp?: number
          created_at?: string
          gls?: number
          id?: string
          idu?: string | null
          info?: string | null
          league?: string | null
          module?: string
          name: string
          ra?: number
          rec?: string | null
          rm?: number
          salary?: number
          season_id: string
          vp?: number
        }
        Update: {
          age?: number | null
          ast?: number
          ca?: number
          club_id?: string | null
          club_name?: string | null
          cp?: number
          created_at?: string
          gls?: number
          id?: string
          idu?: string | null
          info?: string | null
          league?: string | null
          module?: string
          name?: string
          ra?: number
          rec?: string | null
          rm?: number
          salary?: number
          season_id?: string
          vp?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          label: string | null
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          year?: number
        }
        Relationships: []
      }
      standings: {
        Row: {
          club_id: string | null
          club_name: string
          competition: string | null
          created_at: string
          division_label: string | null
          division_num: number | null
          draws: number | null
          ga: number | null
          gd: number | null
          gf: number | null
          id: string
          info: string | null
          is_champion: boolean
          losses: number | null
          module: Database["public"]["Enums"]["module_type"]
          played: number | null
          points: number | null
          position: number | null
          season_id: string
          wins: number | null
        }
        Insert: {
          club_id?: string | null
          club_name: string
          competition?: string | null
          created_at?: string
          division_label?: string | null
          division_num?: number | null
          draws?: number | null
          ga?: number | null
          gd?: number | null
          gf?: number | null
          id?: string
          info?: string | null
          is_champion?: boolean
          losses?: number | null
          module: Database["public"]["Enums"]["module_type"]
          played?: number | null
          points?: number | null
          position?: number | null
          season_id: string
          wins?: number | null
        }
        Update: {
          club_id?: string | null
          club_name?: string
          competition?: string | null
          created_at?: string
          division_label?: string | null
          division_num?: number | null
          draws?: number | null
          ga?: number | null
          gd?: number | null
          gf?: number | null
          id?: string
          info?: string | null
          is_champion?: boolean
          losses?: number | null
          module?: Database["public"]["Enums"]["module_type"]
          played?: number | null
          points?: number | null
          position?: number | null
          season_id?: string
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "standings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      module_type:
        | "superleague"
        | "national"
        | "continental"
        | "player_stats"
        | "competitions"
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
      module_type: [
        "superleague",
        "national",
        "continental",
        "player_stats",
        "competitions",
      ],
    },
  },
} as const
