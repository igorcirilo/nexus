// src/types/index.ts

export interface Profile {
  id: string
  username: string | null
  xp_total: number
  level: number
  title: string
  streak_current: number
  streak_best: number
  streak_last_date: string | null
  mission_today: string | null
  energy_today: number
  onboarded: boolean
  created_at: string

  // Perfil expandido
  age?: number | null
  sex?: string | null
  weight_kg?: number | null
  height_cm?: number | null
  goal_weight?: number | null
  water_goal_ml?: number | null
  workouts_per_week?: number | null
  sleep_goal_h?: number | null
  read_pages_day?: number | null

  // Objetivos
  goal_90_personal?: string | null
  goal_90_career?: string | null
  goal_90_health?: string | null
  xp_weekly_goal?: number | null
  completion_pct_goal?: number | null

  // Financeiro
  fin_current_savings?: number | null
  fin_monthly_save?: number | null
  fin_debt_goal?: number | null
  fin_reserve_goal?: number | null
}

export interface Habit {
  id: string
  user_id: string
  name: string
  area: HabitArea
  xp_reward: number
  time_window: string | null
  active: boolean
  created_at: string
}

export type HabitArea =
  | 'corpo'
  | 'produtividade'
  | 'idiomas'
  | 'carreira'
  | 'financas'
  | 'emocoes'
  | 'relacionamentos'

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  date: string
  completed: boolean
  completed_at: string | null
}

export type CheckinPhase = 'manha' | 'tarde' | 'noite'

export interface Checkin {
  id: string
  user_id: string
  date: string
  phase: CheckinPhase
  sleep_hours?: number | null
  energy?: number | null
  mood?: number | null
  mission?: string | null
  will_train?: boolean | null
  progress_pct?: number | null
  focus_level?: string | null
  next_action?: string | null
  mission_done?: string | null
  win_of_day?: string | null
  reflection?: string | null
  xp_earned: number
  completed_at: string
}

export interface Goal90 {
  id: string
  user_id: string
  title: string
  area: HabitArea
  start_date: string
  end_date: string
  progress: number
  status: 'active' | 'done' | 'paused'
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  date: string
  type: 'entrada' | 'saida'
  category: string
  description: string | null
  amount: number
  created_at: string
}

export interface FocusSession {
  id: string
  user_id: string
  date: string
  duration: number
  task: string | null
  xp_earned: number
  created_at: string
}

export interface Badge {
  key: string
  name: string
  description: string | null
  icon: string | null
  xp_reward: number
}

export interface UserBadge {
  user_id: string
  badge_key: string
  earned_at: string
  badge?: Badge
}

export interface WeeklyLeagueStanding {
  user_id: string
  week_start: string
  week_end: string
  xp: number
  rank: number
  tier: 'Bronze' | 'Prata' | 'Ouro' | 'Lenda'
  username: string
  level: number
  title: string
  updated_at?: string
}

export interface WeeklyLeagueOverview {
  week_start: string
  week_end: string
  total_players: number
  top: WeeklyLeagueStanding[]
  me: WeeklyLeagueStanding | null
  previous_rank: number | null
  previous_xp: number | null
  history: Array<{
    week_start: string
    week_end: string
    xp: number
    rank: number | null
    tier: 'Bronze' | 'Prata' | 'Ouro' | 'Lenda'
  }>
}

export function xpForLevel(level: number): number {
  return Math.round(500 * level * (level + 1) / 2)
}

export function levelFromXP(xp: number): number {
  return Math.max(1, Math.floor((-1 + Math.sqrt(1 + 8 * xp / 500)) / 2) + 1)
}

export const AREA_META: Record<HabitArea, { label: string; icon: string; color: string }> = {
  corpo:           { label: 'Corpo & Saúde',   icon: '💪', color: '#1ECBB4' },
  produtividade:   { label: 'Produtividade',   icon: '🎯', color: '#7F77DD' },
  idiomas:         { label: 'Idiomas',         icon: '🗣️', color: '#E24B4A' },
  carreira:        { label: 'Carreira',        icon: '📚', color: '#E8A838' },
  financas:        { label: 'Finanças',        icon: '💰', color: '#1D9E75' },
  emocoes:         { label: 'Emoções',         icon: '🧘', color: '#D4537E' },
  relacionamentos: { label: 'Relacionamentos', icon: '🤝', color: '#85B7EB' },
}

export const TITLES: Record<string, string> = {
  Recruta: 'Estás a começar. Cada ação conta.',
  Consistente: 'A consistência está a ganhar forma.',
  Focado: 'O foco é o teu superpoder.',
  Estrategista: 'Pensas antes de agir. Isso é raro.',
  Imparável: 'Nada te pára por muito tempo.',
  Antifrágil: 'Cresces com a pressão. Lendário.',
}


export type ImportSourceKind = 'pdf' | 'spreadsheet'
export type FileImportStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ImportPreviewMeta {
  fileName: string
  fileType: string
  fileSize: number
}

export interface PdfPagePreview {
  pageNumber: number
  text: string
}

export interface PdfImportResult {
  kind: 'pdf'
  meta: ImportPreviewMeta
  pageCount: number
  extractedText: string
  pages: PdfPagePreview[]
  hasUsefulText: boolean
  warnings: string[]
}

export interface SpreadsheetSheetPreview {
  name: string
  headers: string[]
  rows: Array<Record<string, string | number | boolean | null>>
  rowCount: number
}

export interface SpreadsheetImportResult {
  kind: 'spreadsheet'
  meta: ImportPreviewMeta
  sheets: SpreadsheetSheetPreview[]
  warnings: string[]
}

export type FileImportResult = PdfImportResult | SpreadsheetImportResult

export interface TrainingPlan {
  id: string
  user_id: string
  title: string
  source_type: ImportSourceKind
  source_file_name: string | null
  summary: string | null
  raw_content: Record<string, unknown> | null
  created_at: string
}

export interface DietPlan {
  id: string
  user_id: string
  title: string
  source_type: ImportSourceKind
  source_file_name: string | null
  summary: string | null
  raw_content: Record<string, unknown> | null
  created_at: string
}
