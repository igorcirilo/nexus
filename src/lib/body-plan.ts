import type { DietMeal, DietMealKey, FileImportResult } from '@/types'

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
  /(dia\s+\d+|day\s+\d+|segunda|terca|quarta|quinta|sexta|sabado|domingo|upper|lower|push|pull|legs|peito|costas|pernas|ombro|ombros|treino\s+[a-z0-9]+)/i

const TRAINING_NOISE_PATTERNS = [
  /^exerc/i,
  /^series?$/i,
  /^repet/i,
  /^descanso/i,
  /^rpe$/i,
  /^tempo$/i,
  /^tecnicas?$/i,
  /^sigla/i,
  /^significado$/i,
  /^observa/i,
  /^carga$/i,
  /^check$/i,
  /^ok$/i,
  /^pendente$/i,
  /^sets?$/i,
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
  /^execucao$/i,
  /^orientacao$/i,
  /^instrucoes?$/i,
  /^descricao$/i,
  /^planilha(\s+de\s+treino)?/i,
  /^objetivos?$/i,
  /^objectivos?$/i,
  /^divisao\b/i,
  /^frequencia(\s+sugerida)?$/i,
  /^aquecimento$/i,
  /^progressao$/i,
  /^agenda(\s+semanal)?(\s+sugerida)?$/i,
  /^registro(\s+da\s+sessao)?$/i,
  /^registo(\s+da\s+sessao)?$/i,
  /^sessao$/i,
  /^sumario$/i,
  /^introducao$/i,
  /^dicas?$/i,
  /^recomenda/i,
  /^principios?$/i,
  /^estrutura$/i,
  /^metodologia$/i,
  /^volume(\s+total)?(\s*\(.+\))?$/i,
  /^intensidade$/i,
  /^periodizacao$/i,
  /^\d+[\s.]+$/,
  /^[-–—]+$/,
  /^[A-Z]{1,4}$/,
  /^\d+%$/,
  /^(seg|ter|qua|qui|sex|sab|dom)\.?$/i,
  /^\d+\s*[x×]\s*\d+\s*(reps?|rep)?$/i,
  /^\d+\s*-\s*\d+\s*reps?$/i,
]

const TRAINING_DETAIL_HINT =
  /(\d+\s*x\s*\d+|\d+\s*-\s*\d+|\d+\s*kg|\d+\s*s|\d+\s*min|rpe|amrap|descanso|rest pause|cadencia|tempo)/i

const MEAL_KEYWORDS: Array<{ key: DietMealKey; label: string; pattern: RegExp }> = [
  { key: 'pequeno_almoco', label: 'Pequeno-almoço', pattern: /(pequeno[\s-]*almoco|pequeno[\s-]*almoço|cafe\s+da\s+manha|café\s+da\s+manhã|desjejum|breakfast)/i },
  { key: 'almoco', label: 'Almoço', pattern: /(\balmoco\b|\balmoço\b|lunch|refeicao\s+principal\s+1|refeição\s+principal\s+1)/i },
  { key: 'lanche', label: 'Lanche', pattern: /(lanche|snack|colacao|colação|ceia|pre\s*treino|pré\s*treino|pos\s*treino|pós\s*treino|merenda)/i },
  { key: 'jantar', label: 'Jantar', pattern: /(jantar|dinner|refeicao\s+principal\s+2|refeição\s+principal\s+2)/i },
]

const DIET_NOISE_PATTERNS = [
  /^plano(\s+alimentar|\s+nutricional)?$/i,
  /^dieta$/i,
  /^refeicoes?$/i,
  /^refei[cç][aã]o$/i,
  /^meal$/i,
  /^horario$/i,
  /^hor[aá]rio$/i,
  /^hora$/i,
  /^alimentos?$/i,
  /^itens?$/i,
  /^op[cç][aã]o$/i,
  /^op[cç][oõ]es$/i,
  /^substitui[cç][oõ]es$/i,
  /^observa[cç][oõ]es$/i,
  /^notas?$/i,
  /^kcal$/i,
  /^calorias?$/i,
  /^prote[ií]nas?$/i,
  /^carboidratos?$/i,
  /^hidratos?$/i,
  /^gorduras?$/i,
  /^macros?$/i,
  /^totais?$/i,
  /^dia\s+\d+$/i,
  /^segunda|terca|quarta|quinta|sexta|sabado|domingo$/i,
]

const DIET_ITEM_SPLIT = /\s*(?:•|\u2022|;|\/{2,}|\|)\s*/

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

function isDietNoise(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return true
  if (normalized.length < 2) return true
  if (DIET_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  if (/^\d+\s*(kcal|cal)$/.test(normalized)) return true
  return false
}

function splitDietItems(value: string) {
  const cleaned = compactSpaces(value.replace(/\s{2,}/g, ' '))

  return cleaned
    .split(DIET_ITEM_SPLIT)
    .map((item) => compactSpaces(item))
    .filter(Boolean)
    .filter((item) => !isDietNoise(item))
}

function looksLikeMealHeaderOnly(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return false
  return Boolean(mealForText(normalized)) && normalized.length <= 28
}

function cleanDietInlineValue(value: string, mealLabel?: string) {
  let next = compactSpaces(value)
  if (mealLabel) {
    const escaped = mealLabel
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s*')
    next = next.replace(new RegExp(`^${escaped}\\s*[:\\-–—]?\\s*`, 'i'), '')
  }
  return compactSpaces(next)
}

function extractInlineMealContent(value: string) {
  const colonIndex = value.indexOf(':')
  if (colonIndex >= 0) return compactSpaces(value.slice(colonIndex + 1))

  const spacedDash = value.match(/\s[–—-]\s(.+)$/)
  return spacedDash ? compactSpaces(spacedDash[1]) : ''
}

function isTimedMealHeader(value: string) {
  return /^\d{1,2}(?::\d{2})?\s*[–—-]\s*/.test(compactSpaces(value))
}

function extractDietQuantity(value: string) {
  const patterns = [
    /(.*\D)\s(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l)\s*\+\s*\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l))$/i,
    /(.*\D)\s(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|unidades?|un|m[eé]dia|fatias?|colheres?)(?:\s+\w+)?)$/i,
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match) {
      return {
        title: compactSpaces(match[1]),
        quantity: compactSpaces(match[2]),
      }
    }
  }

  return {
    title: compactSpaces(value),
    quantity: '',
  }
}

function formatPdfNutritionLine(line: string) {
  const match = line.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)$/)
  if (!match) return line

  const prefix = compactSpaces(match[1])
  const kcal = compactSpaces(match[2])
  const protein = compactSpaces(match[3])
  const carbs = compactSpaces(match[4])
  const fats = compactSpaces(match[5])
  const parsed = extractDietQuantity(prefix)

  if (!parsed.title) return line

  return [
    parsed.title,
    parsed.quantity,
    `${kcal} kcal`,
    `proteínas: ${protein} g`,
    `carboidratos: ${carbs} g`,
    `gorduras: ${fats} g`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function isQuantityLikeHeader(header: string) {
  const normalized = normalizeText(header)
  return /\b(qtd|quantidade|gramas|grama|g|ml|dose|porcao|porção|medida)\b/.test(normalized)
}

function isObservationLikeHeader(header: string) {
  const normalized = normalizeText(header)
  return /\b(obs|observacao|observação|notas?)\b/.test(normalized)
}

function isCaloriesLikeHeader(header: string) {
  const normalized = normalizeText(header)
  return /\bkcal\b/.test(normalized) || /calorias?/.test(normalized)
}

function valueWithHeaderUnit(header: string, value: string) {
  const normalizedHeader = normalizeText(header)
  const normalizedValue = normalizeText(value)

  if ((/\bkcal\b/.test(normalizedHeader) || /calorias?/.test(normalizedHeader)) && /^\d+(?:[.,]\d+)?$/.test(normalizedValue)) {
    return `${compactSpaces(value)} kcal`
  }

  return compactSpaces(value)
}

function nutritionLabelForHeader(header: string) {
  const normalized = normalizeText(header)
  if (/\bkcal\b/.test(normalized) || /calorias?/.test(normalized)) return 'kcal'
  if (/proteinas?/.test(normalized)) return 'proteínas'
  if (/carboidratos?/.test(normalized) || /hidratos?/.test(normalized)) return 'carboidratos'
  if (/gorduras?/.test(normalized)) return 'gorduras'
  return null
}

function isNutritionLikeHeader(header: string) {
  return Boolean(nutritionLabelForHeader(header))
}

function formatNutritionValue(header: string, value: string) {
  const label = nutritionLabelForHeader(header)
  const clean = compactSpaces(value)
  if (!label || !clean) return ''

  if (label === 'kcal') {
    return /\bkcal\b/i.test(clean) ? clean : `${clean} kcal`
  }

  return /\bg\b/i.test(clean) ? `${label}: ${clean}` : `${label}: ${clean} g`
}

function extractNutritionParts(row: Record<string, string | number | boolean | null>) {
  return Object.entries(row)
    .map(([header, value]) => formatNutritionValue(header, asString(value)))
    .filter(Boolean)
}

function extractWideDietRowEntries(row: Record<string, string | number | boolean | null>) {
  const entries = Object.entries(row)
  const usedIndexes = new Set<number>()
  const collected: Array<{ meal: NonNullable<ReturnType<typeof mealForText>>; content: string }> = []

  entries.forEach(([header, value], index) => {
    if (usedIndexes.has(index)) return

    const meal = mealForText(header)
    const text = asString(value)
    if (!meal || !text) return

    const baseText = cleanDietInlineValue(text, meal.label)
    const detailParts = [baseText]

    for (let offset = 1; offset <= 2; offset += 1) {
      const nextIndex = index + offset
      const nextEntry = entries[nextIndex]
      if (!nextEntry) continue

      const [nextHeader, nextValue] = nextEntry
      const nextText = isNutritionLikeHeader(nextHeader)
        ? formatNutritionValue(nextHeader, asString(nextValue))
        : valueWithHeaderUnit(nextHeader, asString(nextValue))
      if (!nextText) continue
      const nextHeaderMeal = mealForText(nextHeader)
      const sameMealHeader = nextHeaderMeal?.key === meal.key || normalizeText(nextHeader).includes(normalizeText(meal.label))
      if (nextHeaderMeal && !sameMealHeader) break

      if (sameMealHeader || isQuantityLikeHeader(nextHeader) || isObservationLikeHeader(nextHeader) || isCaloriesLikeHeader(nextHeader)) {
        detailParts.push(nextText)
        usedIndexes.add(nextIndex)
      }
    }

    usedIndexes.add(index)
    const content = [
      detailParts[0],
      detailParts.slice(1).map(compactSpaces).filter(Boolean).join(' · '),
    ]
      .map(compactSpaces)
      .filter(Boolean)
      .join(' · ')
    if (content) collected.push({ meal, content })
  })

  return collected
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
    const text = valueWithHeaderUnit(key, asString(value))
    if (text) normalized.set(keyOf(key), text)
  })

  for (const alias of aliases) {
    const found = normalized.get(alias)
    if (found) return found
  }

  return ''
}

function nonEmptyValues(row: Record<string, string | number | boolean | null>) {
  return Object.entries(row)
    .map(([key, value]) => valueWithHeaderUnit(key, asString(value)))
    .filter(Boolean)
}

function isTrainingNoise(line: string) {
  const normalized = normalizeText(line)
  if (!normalized) return true
  if (normalized.length < 3) return true
  if (TRAINING_NOISE_PATTERNS.some((pattern) => pattern.test(normalized))) return true
  if (normalized.endsWith('.') && normalized.length > 35) return true
  if (/\b(antes de|para evitar|nas primeiras|em reserva|de forma a|certific)\b/.test(normalized)) return true
  return false
}

function isLikelySection(line: string): boolean {
  const normalized = normalizeText(line)
  if (!normalized || normalized.length < 2) return false
  if (isTrainingNoise(normalized)) return false

  let score = 0
  if (TRAINING_SECTION_MARKERS.test(normalized)) score += 3
  if (normalized.length <= 28) score += 1
  if (normalized.split(' ').length <= 4) score += 1
  if (!/\d+\s*x\s*\d+/.test(normalized)) score += 1
  if (/^[a-z\s]+$/.test(normalized)) score += 1
  if (TRAINING_DETAIL_HINT.test(normalized)) score -= 3

  return score >= 3
}

function cleanExerciseName(name: string) {
  return compactSpaces(
    name
      .replace(/^[-–—]\s*/, '')
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

  const parts = cleaned.split(/\s{2,}| - | — /).map(compactSpaces).filter(Boolean)
  if (parts.length > 1) {
    return {
      name: cleanExerciseName(parts[0]),
      detail: compactSpaces(parts.slice(1).join(' | ')),
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
  if (/^[0-9x\s.\-]+$/.test(normalized)) return false
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
    const lineOnly = asString((row as Record<string, unknown>).__line__)
    if (lineOnly) {
      if (!isTrainingNoise(lineOnly) && isLikelySection(lineOnly)) {
        fallbackSection = lineOnly
      }
      return
    }

    const explicitName = valueFromAliases(row, [
      'exercise',
      'exercicio',
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
    const explicitReps = valueFromAliases(row, ['reps', 'repsalvo', 'repeticoes', 'repeticao'])
    const explicitRest = valueFromAliases(row, ['descanso', 'rest'])
    const explicitRpe = valueFromAliases(row, ['rpe'])
    const explicitTechnique = valueFromAliases(row, ['tecnica', 'tempo', 'cadencia'])

    const filled = nonEmptyValues(row)
    const positionalValues = Object.entries(row)
      .filter(([header, value]) => {
        const text = asString(value)
        if (!text) return false
        if (mealForText(header)) return false
        if (isNutritionLikeHeader(header)) return false
        return true
      })
      .map(([header, value]) => valueWithHeaderUnit(header, asString(value)))
      .filter(Boolean)
    if (filled.length === 0) return

    if (!explicitName && filled.length === 1 && !isTrainingNoise(filled[0]) && isLikelySection(filled[0])) {
      fallbackSection = filled[0]
      return
    }

    const nameCandidate = explicitName || filled[0] || ''
    if (!isValidExerciseName(nameCandidate)) return

    const detailParts = [explicitSeries, explicitReps, explicitRest, explicitRpe, explicitTechnique]
      .map(compactSpaces)
      .filter(Boolean)

    if (
      !explicitSection &&
      isLikelySection(nameCandidate) &&
      detailParts.length === 0 &&
      !TRAINING_DETAIL_HINT.test(nameCandidate)
    ) {
      fallbackSection = nameCandidate
      return
    }

    const detail = detailParts.length > 0 ? detailParts.join(' | ') : undefined
    const sectionTitle =
      (explicitSection && !isTrainingNoise(explicitSection) ? explicitSection : '') ||
      fallbackSection ||
      'Treino'
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
        ? `${parsedSections.length} blocos | ${parsedSections.reduce((sum, section) => sum + section.exercises.length, 0)} exercicios`
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
        ? `${cleaned.length} blocos | ${cleaned.reduce((sum, section) => sum + section.exercises.length, 0)} exercicios`
        : `PDF com ${result.pageCount} pagina(s)`,
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
    const lineOnly = asString((row as Record<string, unknown>).__line__)
    if (lineOnly) {
      const lineMeal = mealForText(lineOnly)
      if (lineMeal && looksLikeMealHeaderOnly(lineOnly)) {
        fallbackMeal = mealMap.get(lineMeal.key) ?? {
          key: lineMeal.key,
          label: lineMeal.label,
          items: [],
        }
        mealMap.set(lineMeal.key, fallbackMeal)
        return
      }

      if (fallbackMeal && !isDietNoise(lineOnly)) {
        splitDietItems(lineOnly).forEach((item) => fallbackMeal?.items.push(item))
      }
      return
    }

    const mealText = valueFromAliases(row, ['meal', 'refeicao', 'periodo', 'horario'])
    const itemText = valueFromAliases(row, ['item', 'alimento', 'nome', 'name', 'refeicaoitem'])
    const quantity = valueFromAliases(row, ['quantidade', 'qty', 'gramas', 'porcao', 'porção'])
    const obs = valueFromAliases(row, ['observacao', 'obs', 'notas'])
    const nutritionParts = extractNutritionParts(row)
    const filled = nonEmptyValues(row)
    const positionalValues = Object.entries(row)
      .filter(([header, value]) => {
        const text = asString(value)
        if (!text) return false
        if (mealForText(header)) return false
        if (isNutritionLikeHeader(header)) return false
        return true
      })
      .map(([header, value]) => valueWithHeaderUnit(header, asString(value)))
      .filter(Boolean)

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

    if (!explicitMeal) {
      const wideMealEntries = extractWideDietRowEntries(row)

      if (wideMealEntries.length > 0) {
        wideMealEntries.forEach(({ meal, content }) => {
          const current = mealMap.get(meal.key) ?? { key: meal.key, label: meal.label, items: [] }
          splitDietItems(content).forEach((item) => current.items.push(item))
          mealMap.set(meal.key, current)
          fallbackMeal = current
        })
        return
      }
    }

    const nonMealValues = positionalValues.filter((value) => !mealForText(value))
    const positionalItem = nonMealValues[0] ?? ''
    const positionalQuantity = nonMealValues[1] ?? ''
    const positionalObs = nonMealValues[2] ?? ''

    const meal = explicitMeal ?? fallbackMeal ?? mealForText(itemText)
    const baseItem = itemText || positionalItem
    const resolvedQuantity = quantity || positionalQuantity
    const resolvedObs = obs || positionalObs
    if (!meal || !baseItem) return

    if (looksLikeMealHeaderOnly(baseItem) && !resolvedQuantity && !resolvedObs) {
      fallbackMeal = mealMap.get(meal.key) ?? { key: meal.key, label: meal.label, items: [] }
      mealMap.set(meal.key, fallbackMeal)
      return
    }

    const content = [cleanDietInlineValue(baseItem, meal.label), resolvedQuantity, resolvedObs, ...nutritionParts]
      .map(compactSpaces)
      .filter(Boolean)
      .join(' · ')

    if (!content || isDietNoise(content)) return

    const current = mealMap.get(meal.key) ?? { key: meal.key, label: meal.label, items: [] }
    splitDietItems(content).forEach((item) => current.items.push(item))
    mealMap.set(meal.key, current)
    fallbackMeal = current
  })

  const meals = Array.from(mealMap.values()).map((meal) => ({
    ...meal,
    items: uniqueItems(meal.items).slice(0, 20),
  }))

  return {
    summary: meals.length > 0 ? `${meals.length} refeição(ões) tratadas` : 'Planilha de dieta importada',
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
      const inlineContent = extractInlineMealContent(line) || cleanDietInlineValue(line, meal.label)
      if (
        inlineContent &&
        inlineContent !== line &&
        !isDietNoise(inlineContent) &&
        !looksLikeMealHeaderOnly(inlineContent)
      ) {
        splitDietItems(inlineContent).forEach((item) => currentMeal?.items.push(item))
      }
      return
    }

    if (!currentMeal) return
    if (line.length < 3) return
    if (isTimedMealHeader(line)) return
    if (isLikelySection(line)) return
    if (isDietNoise(line)) return
    splitDietItems(formatPdfNutritionLine(line)).forEach((item) => currentMeal?.items.push(item))
  })

  const meals = Array.from(mealMap.values()).map((meal) => ({
    ...meal,
    items: uniqueItems(meal.items).slice(0, 20),
  }))

  return {
    summary: meals.length > 0 ? `${meals.length} refeição(ões) tratadas` : `PDF com ${result.pageCount} página(s)`,
    meals,
  }
}

export function parseDietImport(result: FileImportResult): ParsedDietPlan {
  return result.kind === 'spreadsheet' ? parseDietSpreadsheet(result) : parseDietPdf(result)
}

// ── Diet display parsing + day summary (single source of truth) ──────────────
// These pure helpers are shared by DietTracker (rendering) and BodyHub (resumo).

export type MealNotesPayload = { freeText: string; items?: Record<string, boolean> }

export type ParsedDietDisplayItem = {
  title: string
  quantity: string | null
  kcal: string | null
  macros: {
    proteinas: string | null
    carboidratos: string | null
    gorduras: string | null
  }
  extras: string[]
}

export function itemCheckKey(item: string) {
  return item
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function normalizeDisplayText(value: string) {
  return value
    .replace(/Â·/g, '·')
    .replace(/â€¦/g, '...')
    .replace(/âœ“/g, '✓')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã£/g, 'ã')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã©/g, 'é')
    .replace(/Ãª/g, 'ê')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ã´/g, 'ô')
    .replace(/Ãº/g, 'ú')
    .replace(/Ãµ/g, 'õ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseMealNotes(raw: string | null | undefined): MealNotesPayload {
  if (!raw) return { freeText: '' }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'freeText' in parsed) {
      return parsed as MealNotesPayload
    }
    return { freeText: raw }
  } catch {
    return { freeText: raw }
  }
}

export function isVisibleDietItem(item: string) {
  const normalized = item
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

  return normalized !== 'total' && normalized !== 'totais'
}

export function parseGramsValue(value: string | null): number {
  if (!value) return 0
  const match = value.replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : 0
}

export function parseDietDisplayItem(item: string): ParsedDietDisplayItem {
  const compactItem = normalizeDisplayText(item)
  const pdfCompactMatch = compactItem.match(
    /^(.*?)(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|unidades?|un|m[eé]dia|fatias?|colheres?(?:\s+de\s+\w+)?))(?:\s+(\d+(?:[.,]\d+)?))?(?:\s+(\d+(?:[.,]\d+)?))?(?:\s+(\d+(?:[.,]\d+)?))?(?:\s+(\d+(?:[.,]\d+)?))?$/i
  )

  if (pdfCompactMatch && !compactItem.includes('·')) {
    const rawTitle = normalizeDisplayText(pdfCompactMatch[1])
      .replace(/^(manha|manhã|tarde|noite|ceia)\s+/i, '')
      .trim()

    return {
      title: rawTitle || compactItem,
      quantity: pdfCompactMatch[2]?.trim() ?? null,
      kcal: pdfCompactMatch[3] ? `${pdfCompactMatch[3].trim()} kcal` : null,
      macros: {
        proteinas: pdfCompactMatch[4] ? `${pdfCompactMatch[4].trim()} g` : null,
        carboidratos: pdfCompactMatch[5] ? `${pdfCompactMatch[5].trim()} g` : null,
        gorduras: pdfCompactMatch[6] ? `${pdfCompactMatch[6].trim()} g` : null,
      },
      extras: [],
    }
  }

  const parts = compactItem
    .split('·')
    .map((part) => normalizeDisplayText(part))
    .filter(Boolean)

  const [titleRaw, ...rest] = parts
  let title = titleRaw || compactItem
  let quantity: string | null = null
  let kcal: string | null = null
  const macros = {
    proteinas: null as string | null,
    carboidratos: null as string | null,
    gorduras: null as string | null,
  }
  const extras: string[] = []

  const leadingQuantityMatch = title.match(
    /^(\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|unidades?|un|m[eé]dia|fatias?|colheres?))\s+de\s+(.+)$/i
  )
  const leadingCountMatch = title.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/)
  if (leadingQuantityMatch) {
    quantity = leadingQuantityMatch[1]
    title = leadingQuantityMatch[2]
  } else if (leadingCountMatch && !/kcal/i.test(title)) {
    quantity = leadingCountMatch[1]
    title = leadingCountMatch[2]
  }

  rest.forEach((part) => {
    const normalized = part
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()

    if (!kcal && /\bkcal\b/.test(normalized)) {
      kcal = part
      return
    }

    if (/^proteinas?\s*:/.test(normalized)) {
      macros.proteinas = part.replace(/^(proteinas?\s*:)+\s*/i, '').trim()
      return
    }

    if (/^carboidratos?\s*:/.test(normalized)) {
      macros.carboidratos = part.replace(/^(carboidratos?\s*:)+\s*/i, '').trim()
      return
    }

    if (/^gorduras?\s*:/.test(normalized)) {
      macros.gorduras = part.replace(/^(gorduras?\s*:)+\s*/i, '').trim()
      return
    }

    if (
      !quantity &&
      /(\bml\b|\bg\b|\bkg\b|\bun\b|\bmedia\b|\bmédia\b|\bfatias?\b|\bunidades?\b|\bcozido\b)/.test(normalized)
    ) {
      quantity = part
      return
    }

    extras.push(part)
  })

  return {
    title: normalizeDisplayText(title),
    quantity: quantity ? normalizeDisplayText(quantity) : null,
    kcal: kcal ? normalizeDisplayText(kcal) : null,
    macros: {
      proteinas: macros.proteinas
        ? normalizeDisplayText(macros.proteinas).replace(/^proteínas:\s*/i, '')
        : null,
      carboidratos: macros.carboidratos
        ? normalizeDisplayText(macros.carboidratos).replace(/^carboidratos:\s*/i, '')
        : null,
      gorduras: macros.gorduras
        ? normalizeDisplayText(macros.gorduras).replace(/^gorduras:\s*/i, '')
        : null,
    },
    extras: extras.map(normalizeDisplayText),
  }
}

export type DietDaySummary = {
  kcalSelected: number
  kcalPlan: number
  macrosSelected: { carboidratos: number; proteinas: number; gorduras: number }
  macrosPlan: { carboidratos: number; proteinas: number; gorduras: number }
  hasMacroData: boolean
  doneMeals: number
  totalMeals: number
  doneItems: number
  totalItems: number
}

/**
 * Soma kcal/macros e progresso do dia, contando APENAS itens marcados.
 * Mesma lógica do DietTracker, para o resumo (BodyHub) ficar 100% consistente.
 */
export function summarizeDietDay(
  parsed: ParsedDietPlan | null,
  meals: DietMeal[],
  planId: string | null
): DietDaySummary {
  const macrosSelected = { carboidratos: 0, proteinas: 0, gorduras: 0 }
  const macrosPlan = { carboidratos: 0, proteinas: 0, gorduras: 0 }
  let kcalSelected = 0
  let kcalPlan = 0
  let doneMeals = 0
  let totalMeals = 0
  let doneItems = 0
  let totalItems = 0

  if (parsed) {
    for (const meal of parsed.meals) {
      const log = planId
        ? meals.find((m) => m.diet_plan_id === planId && m.meal_key === meal.key)
        : undefined
      const payload = parseMealNotes(log?.notes)
      const visibleItems = meal.items.filter(isVisibleDietItem)

      totalMeals += 1
      let checkedCount = 0

      for (const item of visibleItems) {
        const parsedItem = parseDietDisplayItem(item)
        const c = parseGramsValue(parsedItem.macros.carboidratos)
        const p = parseGramsValue(parsedItem.macros.proteinas)
        const g = parseGramsValue(parsedItem.macros.gorduras)
        const kcal = parseGramsValue(parsedItem.kcal)
        macrosPlan.carboidratos += c
        macrosPlan.proteinas += p
        macrosPlan.gorduras += g
        kcalPlan += kcal
        totalItems += 1
        if (payload.items?.[itemCheckKey(item)]) {
          checkedCount += 1
          doneItems += 1
          macrosSelected.carboidratos += c
          macrosSelected.proteinas += p
          macrosSelected.gorduras += g
          kcalSelected += kcal
        }
      }

      const done = visibleItems.length > 0 ? checkedCount === visibleItems.length : (log?.completed ?? false)
      if (done) doneMeals += 1
    }
  }

  const macroPlanoTotal = macrosPlan.carboidratos + macrosPlan.proteinas + macrosPlan.gorduras

  return {
    kcalSelected: Math.round(kcalSelected),
    kcalPlan: Math.round(kcalPlan),
    macrosSelected: {
      carboidratos: Math.round(macrosSelected.carboidratos),
      proteinas: Math.round(macrosSelected.proteinas),
      gorduras: Math.round(macrosSelected.gorduras),
    },
    macrosPlan: {
      carboidratos: Math.round(macrosPlan.carboidratos),
      proteinas: Math.round(macrosPlan.proteinas),
      gorduras: Math.round(macrosPlan.gorduras),
    },
    hasMacroData: macroPlanoTotal > 0,
    doneMeals,
    totalMeals,
    doneItems,
    totalItems,
  }
}
