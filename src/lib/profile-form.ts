// Normalização do formulário de perfil antes de gravar.
//
// Os inputs numéricos do perfil guardam '' quando vazios. Enviar '' para
// colunas numéricas falha ou grava lixo, por isso convertemos '' → null e
// strings numéricas → Number antes do update. (P2.7)

/** Campos numéricos do perfil que precisam de normalização. */
export const NUMERIC_PROFILE_FIELDS = new Set<string>([
  'age', 'weight_kg', 'height_cm', 'goal_weight', 'water_goal_ml',
  'workouts_per_week', 'sleep_goal_h', 'read_pages_day', 'fin_current_savings',
  'fin_monthly_save', 'fin_debt_goal', 'fin_reserve_goal', 'completion_pct_goal',
])

/**
 * Normaliza um formulário de perfil para envio à BD:
 * - campos numéricos com '' / null / undefined → null
 * - campos numéricos com string/numero válido → Number
 * - restantes campos passam inalterados
 */
export function normalizeProfileForm(
  form: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(form)) {
    if (NUMERIC_PROFILE_FIELDS.has(key)) {
      if (value === '' || value === null || value === undefined) {
        out[key] = null
      } else {
        const n = Number(value)
        out[key] = Number.isFinite(n) ? n : null
      }
    } else {
      out[key] = value
    }
  }
  return out
}
