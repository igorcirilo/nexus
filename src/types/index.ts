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
  streak_freeze_used_week?: string | null
  mission_today: string | null
  energy_today: number
  onboarded: boolean
  created_at: string

  age?: number | null
  sex?: string | null
  weight_kg?: number | null
  height_cm?: number | null
  goal_weight?: number | null
  water_goal_ml?: number | null
  workouts_per_week?: number | null
  sleep_goal_h?: number | null
  read_pages_day?: number | null

  goal_90_personal?: string | null
  goal_90_career?: string | null
  goal_90_health?: string | null
  xp_weekly_goal?: number | null
  completion_pct_goal?: number | null

  fin_current_savings?: number | null
  fin_monthly_save?: number | null
  fin_debt_goal?: number | null
  fin_reserve_goal?: number | null
}

export type HabitArea =
  | 'corpo'
  | 'produtividade'
  | 'idiomas'
  | 'carreira'
  | 'financas'
  | 'emocoes'
  | 'relacionamentos'

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

export type FinancialImportCandidateType = 'entrada' | 'saida'
export type FinancialImportCandidateConfidence = 'high' | 'medium' | 'low'

export interface FinancialImportCandidate {
  id: string
  date: string | null
  description: string
  amount: number | null
  type: FinancialImportCandidateType | null
  category: string
  confidence: FinancialImportCandidateConfidence
  raw: string
  selected: boolean
}

// ── CORRIGIDO: alinhado com o que parseStatementPdf realmente retorna ──
export interface FinancialImportPreview {
  source: 'pdf' | 'spreadsheet'
  fileName: string
  rawText: string
  candidates: FinancialImportCandidate[]
  skippedLines: string[]
  warnings: string[]
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

export interface TrainingEntry {
  id: string
  user_id: string
  training_plan_id: string
  date: string
  completed: boolean
  notes: string | null
  completed_at: string | null
  created_at: string
}

export type DietMealKey = 'pequeno_almoco' | 'almoco' | 'jantar' | 'lanche'

export interface DietMeal {
  id: string
  user_id: string
  diet_plan_id: string
  date: string
  meal_key: DietMealKey
  completed: boolean
  notes: string | null
  completed_at: string | null
  created_at: string
}


export type ReaderTheme = 'claro' | 'sepia' | 'noturno'
export type ReaderMode = 'scroll' | 'paginado'

export interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  source_file_name: string | null
  cover_label: string | null
  raw_content: {
    pageCount: number
    extractedText: string
    pages: Array<{ pageNumber: number; text: string }>
    toc?: Array<{ label: string; page: number }>
  } | null
  created_at: string
}

export interface BookProgress {
  id: string
  user_id: string
  book_id: string
  current_page: number
  progress_pct: number
  updated_at: string
}

export interface BookHighlight {
  id: string
  user_id: string
  book_id: string
  page: number
  color: string
  excerpt: string
  created_at: string
}

export interface BookNote {
  id: string
  user_id: string
  book_id: string
  page: number
  note: string
  excerpt: string | null
  created_at: string
}

export interface BookBookmark {
  id: string
  user_id: string
  book_id: string
  page: number
  label: string | null
  created_at: string
}

export interface ReadingPreference {
  id: string
  user_id: string
  theme: ReaderTheme
  reading_mode: ReaderMode
  font_scale: number
  line_height: number
  margin_px: number
  updated_at: string
}

export function xpForLevel(level: number): number {
  return Math.round((500 * level * (level + 1)) / 2)
}

export function levelFromXP(xp: number): number {
  return Math.max(1, Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 500)) / 2) + 1)
}

export const AREA_META: Record<HabitArea, { label: string; icon: string; color: string }> = {
  corpo: { label: 'Corpo & Saúde', icon: '💪', color: '#1ECBB4' },
  produtividade: { label: 'Produtividade', icon: '🎯', color: '#7F77DD' },
  idiomas: { label: 'Idiomas', icon: '🗣️', color: '#E24B4A' },
  carreira: { label: 'Carreira', icon: '📚', color: '#E8A838' },
  financas: { label: 'Finanças', icon: '💰', color: '#1D9E75' },
  emocoes: { label: 'Emoções', icon: '🧘', color: '#D4537E' },
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

// ── Sprint 1: Assessment, Score, Programa ──────────────────

export type UserAssessment = {
  id: string
  user_id: string
  version: number
  responses: Record<string, unknown>
  completed_at: string | null
  created_at: string
}

export type LifeAreaScore = {
  id: string
  user_id: string
  assessment_id: string
  area: HabitArea
  score: number        // 0–100
  snapshot_at: string
}

export type AreaScores = Record<HabitArea, number> & { global: number }

export type Program = {
  id: string
  user_id: string
  assessment_id: string
  status: 'active' | 'paused' | 'completed'
  started_at: string
  ends_at: string
  created_at: string
}

export type ProgramWeek = {
  id: string
  program_id: string
  week_number: number
  theme: string
  starts_on: string
  created_at: string
}

export type ProgramDay = {
  id: string
  program_id: string
  week_id: string
  day_number: number
  date: string
  created_at: string
}

export type ProgramTask = {
  id: string
  program_id: string
  day_id: string
  user_id: string
  template_id: string | null
  title: string
  description: string | null
  area: HabitArea
  difficulty: 1 | 2 | 3
  xp_reward: number
  status: 'pending' | 'completed' | 'skipped'
  source: 'generated' | 'manual'
  completed_at: string | null
  created_at: string
}

export type TaskTemplate = {
  id: string
  area: HabitArea
  title: string
  description: string | null
  difficulty: 1 | 2 | 3
  frequency_per_week: number
  xp_reward: number
  tags: string[]
  active: boolean
  created_at: string
}

// ── Onboarding Engine ──────────────────────────────────────

export type QuestionType = 'scale' | 'single' | 'multiple' | 'ranking'

export type QuestionOption = {
  id: string
  label: string
  score_value: number   // 0.0–1.0
}

export type Question = {
  id: string
  block: number
  text: string
  type: QuestionType
  area?: HabitArea | HabitArea[]
  weight: number                  // 0 = não contribui para score
  options?: QuestionOption[]
  min?: number                    // para scale
  max?: number                    // para scale
  invert?: boolean                // escala/multiple: valor alto = score menor
}

export type Answers = Record<string, number | string | string[]>
