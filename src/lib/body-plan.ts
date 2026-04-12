import type { DietMealKey, FileImportResult } from '@/types'

export type TrainingExercisePlan = {
  id: string
  name: string
  detail?: string
}

export type TrainingSectionPlan = {
  id: string
  title: string
  exercises: TrainingExercisePlan[]
}

export type DietMealPlan = {
  key: DietMealKey
  label: string
  items: string[]
}

type ParsedBodyPlan = {
  summary: string
}

export type ParsedTrainingPlan = ParsedBodyPlan & {
  sections: TrainingSectionPlan[]
}

export type ParsedDietPlan = ParsedBodyPlan & {
  meals: DietMealPlan[]
}

const TRAINING_SECTION_MARKERS =
  /(dia\s+\d+|day\s+\d+|segunda|terca|terÃ§a|quarta|quinta|sexta|sabado|sÃ¡bado|domingo|upper|lower|push|pull|legs|peito|costas|pernas|ombro|ombros|treino\s+[a-z0-9]+)/i

const TRAINING_NOISE_PATTERNS = [
  // Cabeçalhos de colunas de planilha
  /^exerc/i,
  /^series?$/i,
  /^repet/i,
  /^descanso/i,
  /^rpe$/i,
  /^tempo$/i,
  /^t[eé]cnicas?$/i,
  /^sigla/i,
  /^significado$/i,
  /^observa/i,
  /^carga$/i,
  /^check$/i,
  /^ok$/i,
  /^pendente$/i,
  /^s[eé]t?s?$/i,
  /^reps?$/i,
  /^rest$/i,
  /^peso$/i,
  /^notas?$/i,
  /^comments?$/i,
  /^info$/i,
  /^data$/i,
  /^date$/i,
  /^dia$/i,
  /^semanas?$/i,
  /^bloco$/i,
  /^grupo$/i,
  /^muscular$/i,
  /^execu[cç][aã]o$/i,
  /^orienta[cç][aã]o$/i,
  /^instru[cç][oõ]es?$/i,
  /^descri[cç][aã]o$/i,
  // Metadados de plano de treino
  /^objetivos?$/i,
  /^objectivos?$/i,
  /^divis[aã]o$/i,
  /^frequ[eê]ncia(\s+sugerida)?$/i,
  /^aquecimento$/i,
  /^progress[aã]o$/i,
  /^agenda(\s+semanal)?(\s+sugerida)?$/i,
  /^registro(\s+da\s+sess[aã]o)?$/i,
  /^registo(\s+da\s+sess[aã]o)?$/i,
  /^sess[aã]o$/i,
  /^sum[aá]rio$/i,
  /^introdu[cç][aã]o$/i,
  /^dicas?$/i,
  /^recomenda/i,
  /^princ[ií]pios?$/i,
  /^estrutura$/i,
  /^metodologia$/i,
  /^volume$/i,
  /^intensidade$/i,
  /^periodiza[cç][aã]o$/i,
  // Formatos numéricos puros
  /^\d+[\s\.]+$/,
  /^[-–—]+$/,
  /^[A-Z]{1,4}$/,
  /^\d+%$/,
  /^(seg|ter|qua|qui|sex|sab|dom)\.?$/i,
  /^\d+\s*[x×]\s*\d+\s*(reps?|rep)?$/i,
  /^\d+\s*-\s*\d+\s*reps?$/i,
]

const TRAINING_DETAIL_HINT =
  /(\d+\s*x\s*\d+|\d+\s*-\s*\d+|\d+\s*kg|\d+\s*s|\d+\s*min|rpe|amrap|descanso|rest pause|cadencia|cadÃªncia|tempo)/i

const MEAL_KEYWORDS: Array<{ key: DietMealKey; label: string; pattern: RegExp }> = [
  { key: 'pequeno_almoco', label: 'Pequeno-almoÃ§o', pattern: /(pequeno|cafe\s+da\s+manha|cafÃ©\s+da\s+manhÃ£|breakfast)/i },
  { key: 'almoco', label: 'AlmoÃ§o', pattern: /(almoco|almoÃ§o|lunch)/i },
  { key: 'lanche', label: 'Lanche', pattern: /(lanche|snack|pre\s*treino|prÃ©\s*treino|ceia)/i },
  { key: 'jantar', label: 'Jantar', pattern: /(jantar|dinner)/i },
]

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeLine(line: string) {
  return line
    .replace(/\u2022/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\-\*\u2023\u25E6]+\s*/, '')
    .trim()
}

function compactSpaces(value: string) {
  return value.replace(/\s{2,}/g, ' ').trim()
}

function linesFromPdf(result: Extract<FileImportResult, { kind: 'pdf' }>) {
  return result.extractedText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
}

function rowsFromSpreadsheet(result: Extract<FileImportResult, { kind: 'spreadsheet' }>) {
  return result.sheets.flatMap((sheet) => sheet.rows)
}

function makeId(prefix: string, value: string, index: number) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item'}-${index}`
}

function asString(value: unknown) {
  if (value === null || value === undefined) return ''
  return compactSpaces(String(value))
}

function keyOf(header: string) {
  return normalizeText(header).replace(/[^a-z0-9]+/g, '')
}

function valueFromAliases(
  row: Record<string, string | number | boolean | null>,
  aliases: string[]
) {
  const normalized = new Map<string, string>()

  Object.entries(row).forEach(([key, value]) => {
    const text = asString(value)
    if (text) normalized.set(keyOf(key), text)
  })

  for (const alias of aliases) {
    const found = normalized.get(alias)
    if (found) return found
  }

  return ''
}

function nonEmptyValues(row: Record<string, string | number | boolean | null>) {
  return Object.values(row).map(asString).filter(Boolean)
}

function isTrainingNoise(line: string) {
  const normalized = normalizeText(line)
  if (!normalized) return true
  if (normalized.length < 3) return true
  if (TRAINING_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  // Frases descritivas: terminam em ponto e têm mais de 35 chars
  // (observações, orientações, instruções longas)
  if (normalized.endsWith('.') && normalized.length > 35) return true
  // Frases com conectores típicos de instrução
  if (/\b(antes de|para evitar|nas primeiras|em reserva|de forma a|certific)\b/.test(normalized)) return true
  return false
}

function isLikelySection(line: string): boolean {
  const normalized = normalizeText(line)
  if (!normalized || normalized.length < 2) return false

  let score = 0

  // Marcador explÃ­cito de dia/grupo muscular
  if (TRAINING_SECTION_MARKERS.test(normalized)) score += 3

  // Linha curta e sem detalhes mÃ©tricos
  if (normalized.length <= 28) score += 1
  if (normalized.split(' ').length <= 4) score += 1

  // Sem nÃºmeros de sÃ©ries/reps (indÃ­cio de que Ã© secÃ§Ã£o, nÃ£o exercÃ­cio)
  if (!/\d+\s*x\s*\d+/.test(normalized)) score += 1

  // SÃ³ letras e espaÃ§os (sem siglas numÃ©ricas)
  if (/^[a-z\s]+$/.test(normalized)) score += 1

  // Penalizar se parece detalhe de exercÃ­cio
  if (TRAINING_DETAIL_HINT.test(normalized)) score -= 3

  return score >= 3
}

function cleanExerciseName(name: string) {
  return compactSpaces(
    name
      .replace(/^[-â€“â€”]\s*/, '')
      .replace(/\b(check|ok|pendente)\b/gi, '')
      .trim()
  )
}

function splitExerciseLine(line: string) {
  const cleaned = compactSpaces(line)
  const metricsMatch = cleaned.match(
    /^(.*?)(\s+\d+\s*x\s*\d+.*|\s+\d+\s+\d+(?:\.\d+)?\s+\d+(?:s|min)?.*|\s+rpe\s*\d+.*|\s+amrap.*)$/i
  )

  if (metricsMatch) {
    return {
      name: cleanExerciseName(metricsMatch[1]),
      detail: compactSpaces(metricsMatch[2]),
    }
  }

  const parts = cleaned.split(/\s{2,}| - | â€” /).map(compactSpaces).filter(Boolean)
  if (parts.length > 1) {
    return {
      name: cleanExerciseName(parts[0]),
      detail: compactSpaces(parts.slice(1).join(' Â· ')),
    }
  }

  return {
    name: cleanExerciseName(cleaned),
    detail: undefined,
  }
}

function isValidExerciseName(name: string) {
  const normalized = normalizeText(name)
  if (!normalized) return false
  if (isTrainingNoise(normalized)) return false
  if (/^[0-9x\s\.\-]+$/.test(normalized)) return false
  if (/^(abc|abcabc|abcde|pushpull|legs)/i.test(normalized) && normalized.length < 10) return false
  return /[a-z]/i.test(normalized)
}

function dedupeExercises(exercises: TrainingExercisePlan[]) {
  const seen = new Set<string>()
  return exercises.filter((exercise) => {
    const key = normalizeText(`${exercise.name}|${exercise.detail ?? ''}`)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseTrainingSpreadsheet(result: Extract<FileImportResult, { kind: 'spreadsheet' }>): ParsedTrainingPlan {
  const rows = rowsFromSpreadsheet(result)
  const sections = new Map<string, TrainingExercisePlan[]>()
  let fallbackSection = 'Treino'

  rows.forEach((row, index) => {
    const explicitName = valueFromAliases(row, [
      'exercise',
      'exercicio',
      'exercicio1',
      'nome',
      'name',
      'movimento',
    ])

    const explicitSection = valueFromAliases(row, [
      'day',
      'dia',
      'section',
      'secao',
      'grupo',
      'treino',
      'bloco',
      'split',
    ])

    const explicitSeries = valueFromAliases(row, ['series', 'serie', 'set', 'sets'])
    const explicitReps = valueFromAliases(row, ['reps', 'repeticoes', 'repeticao'])
    const explicitRest = valueFromAliases(row, ['descanso', 'rest'])
    const explicitRpe = valueFromAliases(row, ['rpe'])
    const explicitTechnique = valueFromAliases(row, ['tecnica', 'tecnica1', 'tempo', 'cadencia'])

    const filled = nonEmptyValues(row)
    if (filled.length === 0) return

    if (!explicitName && filled.length === 1 && isLikelySection(filled[0])) {
      fallbackSection = filled[0]
      return
    }

    const nameCandidate = explicitName || filled[0] || ''
    if (!isValidExerciseName(nameCandidate)) return

    const detailParts = [explicitSeries, explicitReps, explicitRest, explicitRpe, explicitTechnique]
      .map(compactSpaces)
      .filter(Boolean)

    const detail = detailParts.length > 0 ? detailParts.join(' Â· ') : undefined
    const sectionTitle = explicitSection || fallbackSection || 'Treino'
    const current = sections.get(sectionTitle) ?? []

    current.push({
      id: makeId('exercise', nameCandidate, index),
      name: cleanExerciseName(nameCandidate),
      detail,
    })

    sections.set(sectionTitle, current)
  })

  const parsedSections = Array.from(sections.entries())
    .map(([title, exercises], index) => ({
      id: makeId('section', title, index),
      title,
      exercises: dedupeExercises(exercises).slice(0, 32),
    }))
    .filter((section) => section.exercises.length > 0)

  return {
    summary:
      parsedSections.length > 0
        ? `${parsedSections.length} bloco(s) Â· ${parsedSections.reduce((sum, section) => sum + section.exercises.length, 0)} exercÃ­cio(s)`
        : 'Planilha de treino importada',
    sections: parsedSections.length > 0 ? parsedSections : [{ id: 'section-treino', title: 'Treino', exercises: [] }],
  }
}

function parseTrainingPdf(result: Extract<FileImportResult, { kind: 'pdf' }>): ParsedTrainingPlan {
  const lines = linesFromPdf(result)
  const sections: TrainingSectionPlan[] = []
  let currentSection: TrainingSectionPlan = { id: 'section-treino', title: 'Treino', exercises: [] }

  lines.forEach((line, index) => {
    if (isTrainingNoise(line)) return

    if (isLikelySection(line) && !TRAINING_DETAIL_HINT.test(line)) {
      if (currentSection.exercises.length > 0) sections.push(currentSection)
      currentSection = { id: makeId('section', line, index), title: line, exercises: [] }
      return
    }

    const { name, detail } = splitExerciseLine(line)
    if (!isValidExerciseName(name)) return

    currentSection.exercises.push({
      id: makeId('exercise', name, index),
      name,
      detail: detail && detail !== name ? detail : undefined,
    })
  })

  if (currentSection.exercises.length > 0) sections.push(currentSection)

  const cleaned = sections
    .map((section, index) => ({
      ...section,
      id: section.id || `section-${index}`,
      exercises: dedupeExercises(section.exercises).slice(0, 32),
    }))
    .filter((section) => section.exercises.length > 0)

  return {
    summary:
      cleaned.length > 0
        ? `${cleaned.length} bloco(s) Â· ${cleaned.reduce((sum, section) => sum + section.exercises.length, 0)} exercÃ­cio(s)`
        : `PDF com ${result.pageCount} pÃ¡gina(s)`,
    sections: cleaned.length > 0 ? cleaned : [{ id: 'section-treino', title: 'Treino', exercises: [] }],
  }
}

export function parseTrainingImport(result: FileImportResult): ParsedTrainingPlan {
  return result.kind === 'spreadsheet' ? parseTrainingSpreadsheet(result) : parseTrainingPdf(result)
}

function mealForText(text: string) {
  return MEAL_KEYWORDS.find((meal) => meal.pattern.test(text)) ?? null
}

function uniqueItems(items: string[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalizeText(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseDietSpreadsheet(result: Extract<FileImportResult, { kind: 'spreadsheet' }>): ParsedDietPlan {
  const rows = rowsFromSpreadsheet(result)
  const mealMap = new Map<DietMealKey, DietMealPlan>()
  let fallbackMeal: DietMealPlan | null = null

  rows.forEach((row) => {
    const mealText = valueFromAliases(row, ['meal', 'refeicao', 'periodo', 'horario'])
    const itemText = valueFromAliases(row, ['item', 'alimento', 'nome', 'name', 'refeicaoitem'])
    const quantity = valueFromAliases(row, ['quantidade', 'qty', 'gramas', 'porcao', 'porcao'])
    const obs = valueFromAliases(row, ['observacao', 'obs', 'notas'])
    const filled = nonEmptyValues(row)

    if (filled.length === 0) return

    const explicitMeal = mealForText(mealText || filled[0] || '')
    if (explicitMeal && !itemText && filled.length === 1) {
      fallbackMeal = mealMap.get(explicitMeal.key) ?? {
        key: explicitMeal.key,
        label: explicitMeal.label,
        items: [],
      }
      mealMap.set(explicitMeal.key, fallbackMeal)
      return
    }

    const meal = explicitMeal ?? fallbackMeal ?? mealForText(itemText)
    const baseItem = itemText || (filled.length > 1 ? filled[0] : '')
    if (!meal || !baseItem) return

    const parts = [baseItem, quantity, obs].map(compactSpaces).filter(Boolean)
    const current = mealMap.get(meal.key) ?? { key: meal.key, label: meal.label, items: [] }
    current.items.push(parts.join(' Â· '))
    mealMap.set(meal.key, current)
  })

  const meals = Array.from(mealMap.values()).map((meal) => ({
    ...meal,
    items: uniqueItems(meal.items).slice(0, 20),
  }))

  return {
    summary: meals.length > 0 ? `${meals.length} refeiÃ§Ã£o(Ãµes) tratadas` : 'Planilha de dieta importada',
    meals,
  }
}

function parseDietPdf(result: Extract<FileImportResult, { kind: 'pdf' }>): ParsedDietPlan {
  const lines = linesFromPdf(result)
  const mealMap = new Map<DietMealKey, DietMealPlan>()
  let currentMeal: DietMealPlan | null = null

  lines.forEach((line) => {
    const meal = mealForText(line)
    if (meal) {
      currentMeal = mealMap.get(meal.key) ?? { key: meal.key, label: meal.label, items: [] }
      mealMap.set(meal.key, currentMeal)
      return
    }

    if (!currentMeal) return
    if (line.length < 3) return
    if (isLikelySection(line)) return
    currentMeal.items.push(line)
  })

  const meals = Array.from(mealMap.values()).map((meal) => ({
    ...meal,
    items: uniqueItems(meal.items).slice(0, 20),
  }))

  return {
    summary: meals.length > 0 ? `${meals.length} refeiÃ§Ã£o(Ãµes) tratadas` : `PDF com ${result.pageCount} pÃ¡gina(s)`,
    meals,
  }
}

export function parseDietImport(result: FileImportResult): ParsedDietPlan {
  return result.kind === 'spreadsheet' ? parseDietSpreadsheet(result) : parseDietPdf(result)
}
