'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import EmptyState from '@/components/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Icon, { type IconName } from '@/components/ui/Icon'
import { useToast } from '@/components/Toast'
import { getDietPlans, saveDietPlan } from '@/lib/supabase'
import { getDietMeals, upsertDietMeal, deleteDietPlan, DIET_PLAN_STORAGE_KEY } from '@/lib/body'
import { parseDietImport, normalizeDisplayText, type ParsedDietPlan } from '@/lib/body-plan'
import type { DietPlan, DietMeal, DietMealKey, FileImportResult } from '@/types'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const MEALS = [
  { key: 'pequeno_almoco', label: 'Café da manhã', icon: 'coffee' },
  { key: 'almoco', label: 'Almoço', icon: 'utensils' },
  { key: 'lanche', label: 'Lanche', icon: 'cup' },
  { key: 'jantar', label: 'Jantar', icon: 'moon' },
] as const

type MealNotesPayload = { freeText: string; items?: Record<string, boolean> }

type ParsedDietDisplayItem = {
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

function itemStateKey(planId: string, mealKey: DietMealKey) {
  return `${planId}:${mealKey}`
}

function itemCheckKey(item: string) {
  return item
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseMealNotes(raw: string | null | undefined): MealNotesPayload {
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

function parseDietDisplayItem(item: string): ParsedDietDisplayItem {
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
      .replace(/[\u0300-\u036f]/g, '')
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

function isVisibleDietItem(item: string) {
  const normalized = item
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  return normalized !== 'total' && normalized !== 'totais'
}

function parseGramsValue(value: string | null): number {
  if (!value) return 0
  const match = value.replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? parseFloat(match[1]) : 0
}

function statChipStyle(kind: 'quantity' | 'kcal' | 'empty', checked: boolean): CSSProperties {
  if (kind === 'quantity') {
    return {
      fontSize: 11,
      color: checked ? 'var(--text3)' : 'var(--text2)',
      background: 'var(--bg2)',
      border: '1px solid var(--border)',
      borderRadius: 999,
      padding: '3px 8px',
      opacity: checked ? 0.75 : 1,
    }
  }

  if (kind === 'kcal') {
    return {
      fontSize: 11,
      color: checked ? 'var(--text3)' : 'var(--gold)',
      background: 'rgba(232,168,56,.08)',
      border: '1px solid rgba(232,168,56,.2)',
      borderRadius: 999,
      padding: '3px 8px',
      opacity: checked ? 0.75 : 1,
    }
  }

  return {
    fontSize: 11,
    color: 'var(--text3)',
    background: 'transparent',
    border: '1px dashed var(--border)',
    borderRadius: 999,
    padding: '3px 8px',
    opacity: checked ? 0.45 : 0.65,
  }
}

function getParsed(plan: DietPlan | null): ParsedDietPlan | null {
  if (!plan) return null
  const raw = plan.raw_content as { parsedPlan?: ParsedDietPlan } | null
  return raw?.parsedPlan ?? null
}

interface Props {
  userId: string
  today: string
  initialPlans: DietPlan[]
}

export default function DietTracker({ userId, today, initialPlans }: Props) {
  const toast = useToast()

  const [plans, setPlans] = useState<DietPlan[]>(initialPlans)
  const [selectedId, setSelectedId] = useState<string | null>(initialPlans[0]?.id ?? null)
  const [meals, setMeals] = useState<DietMeal[]>([])
  const [mealState, setMealState] = useState<Record<string, MealNotesPayload>>({})
  const [showImport, setShowImport] = useState(false)
  const [importReview, setImportReview] = useState<{ result: FileImportResult; parsed: ParsedDietPlan } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Restaura a dieta selecionada (compartilhada com o Resumo via localStorage).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DIET_PLAN_STORAGE_KEY)
      if (stored && initialPlans.some((p) => p.id === stored)) setSelectedId(stored)
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persiste a seleção para o Resumo mostrar o mesmo plano.
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(DIET_PLAN_STORAGE_KEY, selectedId)
      else localStorage.removeItem(DIET_PLAN_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [selectedId])

  useEffect(() => {
    async function loadMeals() {
      const data = await getDietMeals(userId, today)
      const typedData = data as DietMeal[]
      setMeals(typedData)

      const nextState: Record<string, MealNotesPayload> = {}
      for (const meal of typedData) {
        nextState[itemStateKey(meal.diet_plan_id, meal.meal_key)] = parseMealNotes(meal.notes)
      }
      setMealState(nextState)
    }

    loadMeals()
  }, [today, userId])

  const selectedPlan = plans.find((p) => p.id === selectedId) ?? null
  const parsed = getParsed(selectedPlan)

  function getMealLog(key: DietMealKey): DietMeal | undefined {
    return meals.find((m) => m.diet_plan_id === selectedId && m.meal_key === key)
  }

  function getMealPayload(planId: string, key: DietMealKey, existing?: DietMeal): MealNotesPayload {
    return mealState[itemStateKey(planId, key)] ?? parseMealNotes(existing?.notes)
  }

  function setMealPayload(planId: string, key: DietMealKey, payload: MealNotesPayload) {
    setMealState((prev) => ({ ...prev, [itemStateKey(planId, key)]: payload }))
  }

  function syncMealRecord(updated: DietMeal, planId: string, key: DietMealKey, payload: MealNotesPayload) {
    setMealPayload(planId, key, payload)
    setMeals((prev) => {
      const idx = prev.findIndex((m) => m.diet_plan_id === planId && m.meal_key === key)
      if (idx >= 0) return prev.map((m, i) => (i === idx ? updated : m))
      return [...prev, updated]
    })
  }

  async function persistMeal(key: DietMealKey, payload: MealNotesPayload, completed: boolean) {
    if (!selectedId) return

    const { data } = await upsertDietMeal({
      user_id: userId,
      diet_plan_id: selectedId,
      date: today,
      meal_key: key,
      completed,
      notes: JSON.stringify(payload),
    })

    if (data) syncMealRecord(data as DietMeal, selectedId, key, payload)
  }

  async function toggleMeal(key: DietMealKey) {
    if (!selectedId) return
    const existing = getMealLog(key)
    const payload = getMealPayload(selectedId, key, existing)
    const newCompleted = !(existing?.completed ?? false)

    if (newCompleted && parsed) {
      const mealPlan = parsed.meals.find((m) => m.key === key)
      if (mealPlan) {
        payload.items = Object.fromEntries(mealPlan.items.map((item) => [itemCheckKey(item), true]))
      }
    } else {
      payload.items = {}
    }

    await persistMeal(key, payload, newCompleted)
  }

  function handleNoteChange(key: DietMealKey, text: string) {
    if (!selectedId) return

    const existing = getMealLog(key)
    const currentPayload = getMealPayload(selectedId, key, existing)
    const nextPayload: MealNotesPayload = {
      freeText: text,
      items: currentPayload.items ?? {},
    }

    setMealPayload(selectedId, key, nextPayload)

    const timerKey = itemStateKey(selectedId, key)
    if (noteTimers.current[timerKey]) clearTimeout(noteTimers.current[timerKey])
    noteTimers.current[timerKey] = setTimeout(async () => {
      const latest = getMealLog(key)
      await persistMeal(key, nextPayload, latest?.completed ?? false)
    }, 1000)
  }

  async function toggleMealItem(key: DietMealKey, item: string, mealItems: string[]) {
    if (!selectedId) return

    const existing = getMealLog(key)
    const currentPayload = getMealPayload(selectedId, key, existing)
    const currentChecks = currentPayload.items ?? {}
    const nextChecks = {
      ...currentChecks,
      [itemCheckKey(item)]: !currentChecks[itemCheckKey(item)],
    }
    const completed = mealItems.every((mealItem) => nextChecks[itemCheckKey(mealItem)])

    await persistMeal(
      key,
      {
        freeText: currentPayload.freeText ?? '',
        items: nextChecks,
      },
      completed
    )
  }

  async function handleImportConfirm(result: FileImportResult) {
    const dietParsed = parseDietImport(result)
    setImportReview({ result, parsed: dietParsed })
    setShowImport(false)
  }

  async function confirmImport(parsedPlan: ParsedDietPlan) {
    const fileName = importReview?.result.meta.fileName ?? 'dieta'
    const title = fileName.replace(/\.[^.]+$/, '') || parsedPlan.summary || 'dieta'

    const saved = await saveDietPlan({
      user_id: userId,
      title,
      source_type: importReview?.result.kind ?? 'pdf',
      source_file_name: fileName,
      summary: parsedPlan.summary ?? null,
      raw_content: { parsedPlan },
    })

    const updated = await getDietPlans(userId)
    const typedUpdated = (updated as DietPlan[]) ?? []
    setPlans(typedUpdated)

    const newPlanId = (saved as { id?: string } | null)?.id ?? typedUpdated[0]?.id ?? null
    setSelectedId(newPlanId)

    setImportReview(null)
    toast.success('Dieta importada!')
  }

  async function handleDelete(id: string) {
    await deleteDietPlan(id, userId)
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? null)
      return next
    })
  }

  const mealProgress = parsed
    ? parsed.meals.reduce(
        (acc, meal) => {
          const log = selectedId ? getMealLog(meal.key) : undefined
          const payload = selectedId ? getMealPayload(selectedId, meal.key, log) : { freeText: '' }
          const checkedCount = meal.items.filter((item) => payload.items?.[itemCheckKey(item)]).length
          const done = meal.items.length > 0 ? checkedCount === meal.items.length : (log?.completed ?? false)

          return {
            totalMeals: acc.totalMeals + 1,
            doneMeals: acc.doneMeals + (done ? 1 : 0),
            totalItems: acc.totalItems + meal.items.length,
            doneItems: acc.doneItems + checkedCount,
          }
        },
        { totalMeals: 0, doneMeals: 0, totalItems: 0, doneItems: 0 }
      )
    : { totalMeals: 0, doneMeals: 0, totalItems: 0, doneItems: 0 }

  const macroSelecionados = { carboidratos: 0, proteinas: 0, gorduras: 0 }
  const macroPlano = { carboidratos: 0, proteinas: 0, gorduras: 0 }
  let kcalSelecionadas = 0
  let kcalPlano = 0
  if (parsed) {
    for (const meal of parsed.meals) {
      const log = selectedId ? getMealLog(meal.key as DietMealKey) : undefined
      const payload = selectedId
        ? getMealPayload(selectedId, meal.key as DietMealKey, log)
        : { freeText: '' }
      for (const item of meal.items) {
        if (!isVisibleDietItem(item)) continue
        const parsedItem = parseDietDisplayItem(item)
        const c = parseGramsValue(parsedItem.macros.carboidratos)
        const p = parseGramsValue(parsedItem.macros.proteinas)
        const g = parseGramsValue(parsedItem.macros.gorduras)
        macroPlano.carboidratos += c
        macroPlano.proteinas += p
        macroPlano.gorduras += g
        kcalPlano += parseGramsValue(parsedItem.kcal)
        if (payload.items?.[itemCheckKey(item)]) {
          macroSelecionados.carboidratos += c
          macroSelecionados.proteinas += p
          macroSelecionados.gorduras += g
          kcalSelecionadas += parseGramsValue(parsedItem.kcal)
        }
      }
    }
  }

  const macroChartData = [
    { name: 'Carboidratos', key: 'carboidratos', value: Math.round(macroSelecionados.carboidratos), color: 'var(--gold)' },
    { name: 'Proteínas', key: 'proteinas', value: Math.round(macroSelecionados.proteinas), color: 'var(--teal)' },
    { name: 'Gorduras', key: 'gorduras', value: Math.round(macroSelecionados.gorduras), color: 'var(--accent)' },
  ]
  const totalMacrosSelecionados = macroChartData.reduce((acc, m) => acc + m.value, 0)
  const macroPieData = macroChartData.filter((m) => m.value > 0)
  const hasMacroData = macroPlano.carboidratos + macroPlano.proteinas + macroPlano.gorduras > 0

  // Renderiza as refeições a partir do plano importado (não da lista fixa):
  // refeições fora do molde padrão também aparecem, com ícone/rótulo genérico.
  const mealMetaByKey: Record<string, { label: string; icon: IconName }> = Object.fromEntries(
    MEALS.map((m) => [m.key, { label: m.label, icon: m.icon }])
  )
  const mealOrder = (key: string) => {
    const idx = MEALS.findIndex((m) => m.key === key)
    return idx === -1 ? MEALS.length : idx
  }
  const orderedMeals = parsed ? [...parsed.meals].sort((a, b) => mealOrder(a.key) - mealOrder(b.key)) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {plans.length > 1 && (
        <select
          value={selectedId ?? ''}
          onChange={(e) => setSelectedId(e.target.value || null)}
          style={{
            background: 'var(--bg1)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 12px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: 'var(--text1)',
            width: '100%',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {normalizeDisplayText(plan.title)}
            </option>
          ))}
        </select>
      )}

      {parsed ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(30,203,180,.12), rgba(127,119,221,.08))',
              border: '1px solid rgba(30,203,180,.18)',
              borderRadius: 16,
              padding: '16px 18px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 }}>
                  {normalizeDisplayText(selectedPlan?.title ?? 'Plano alimentar')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{normalizeDisplayText(parsed.summary)}</div>
              </div>
              <div style={{ display: 'flex', gap: 18 }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--teal)' }}>
                    {mealProgress.doneMeals}/{mealProgress.totalMeals}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>refeições</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--gold)' }}>
                    {mealProgress.doneItems}/{mealProgress.totalItems}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>itens</div>
                </div>
              </div>
            </div>
            <div style={{ width: '100%', height: 6, background: 'var(--bg3)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${mealProgress.totalItems > 0 ? Math.round((mealProgress.doneItems / mealProgress.totalItems) * 100) : 0}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--teal), var(--gold))',
                  borderRadius: 999,
                  transition: 'width .2s ease',
                }}
              />
            </div>
          </div>

          {hasMacroData && (
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>
                  Macronutrientes selecionados
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--gold)' }}>
                    {Math.round(kcalSelecionadas)}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {kcalPlano > 0 ? `/ ${Math.round(kcalPlano)} kcal` : 'kcal'}
                  </span>
                </div>
              </div>

              {totalMacrosSelecionados > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={macroPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        stroke="var(--bg1)"
                        strokeWidth={2}
                      >
                        {macroPieData.map((m) => (
                          <Cell key={m.key} fill={m.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text1)' }}
                        formatter={(value: number, name: string) => [`${value} g`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                    {macroChartData.map((m) => {
                      const pct = totalMacrosSelecionados > 0 ? Math.round((m.value / totalMacrosSelecionados) * 100) : 0
                      return (
                        <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: m.color }} />
                          {m.name}: <strong style={{ color: 'var(--text1)' }}>{m.value} g</strong>
                          <span style={{ color: 'var(--text3)' }}>({pct}%)</span>
                        </span>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                  Marque os itens das refeições para ver os macros somados.
                </div>
              )}
            </div>
          )}

          {orderedMeals.map((mealPlan) => {
            if (mealPlan.items.length === 0) return null
            const meta =
              mealMetaByKey[mealPlan.key] ?? { label: mealPlan.label || 'Refeição', icon: 'utensils' as IconName }

            const log = getMealLog(mealPlan.key as DietMealKey)
            const payload = selectedId ? getMealPayload(selectedId, mealPlan.key as DietMealKey, log) : { freeText: '' }
            const checkedCount = mealPlan.items.filter((item) => payload.items?.[itemCheckKey(item)]).length
            const done = mealPlan.items.length > 0 ? checkedCount === mealPlan.items.length : (log?.completed ?? false)
            const noteText = payload.freeText ?? ''

            return (
              <div
                key={mealPlan.key}
                style={{
                  background: 'var(--bg1)',
                  border: `1px solid ${done ? 'var(--teal)' : 'var(--border)'}`,
                  borderRadius: 14,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <button
                    onClick={() => toggleMeal(mealPlan.key as DietMealKey)}
                    aria-label={done ? 'Limpar refeição' : 'Marcar refeição completa'}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: done ? 'none' : '2px solid var(--border)',
                      background: done ? 'var(--teal)' : 'transparent',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--on-accent)',
                      fontSize: 13,
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    {done ? '✓' : ''}
                  </button>

                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      background: done ? 'rgba(30,203,180,.1)' : 'var(--bg2)',
                      color: done ? 'var(--teal)' : 'var(--text3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={meta.icon as IconName} size={16} />
                  </span>
                  <span
                    style={{
                      fontFamily: 'Syne, sans-serif',
                      fontSize: 15,
                      fontWeight: 700,
                      color: done ? 'var(--teal)' : 'var(--text1)',
                      flex: 1,
                      textDecoration: done ? 'line-through' : 'none',
                      opacity: done ? 0.8 : 1,
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {meta.label}
                  </span>

                  <div style={{ fontSize: 11, color: done ? 'var(--teal)' : 'var(--text3)', marginRight: 8 }}>
                    {checkedCount}/{mealPlan.items.length}
                  </div>

                  <button
                    onClick={() => toggleMeal(mealPlan.key as DietMealKey)}
                    style={{
                      border: '1px solid var(--border)',
                      background: done ? 'rgba(30,203,180,.12)' : 'var(--bg2)',
                      color: done ? 'var(--teal)' : 'var(--text2)',
                      borderRadius: 10,
                      padding: '7px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {done ? 'Limpar' : 'Marcar tudo'}
                  </button>
                </div>

                <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {mealPlan.items.filter(isVisibleDietItem).map((item, idx) => {
                    const checked = payload.items?.[itemCheckKey(item)] ?? false
                    const parsedItem = parseDietDisplayItem(item)

                    return (
                      <button
                        key={idx}
                        onClick={() => toggleMealItem(mealPlan.key as DietMealKey, item, mealPlan.items)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          background: 'none',
                          border: 'none',
                          borderRadius: 10,
                          padding: '6px 2px',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 5,
                            border: checked ? 'none' : '1.5px solid var(--border)',
                            background: checked ? 'var(--teal)' : 'transparent',
                            color: 'var(--on-accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {checked ? '✓' : ''}
                        </span>
                        <span
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'DM Sans, sans-serif',
                              fontSize: 14,
                              fontWeight: 500,
                              color: checked ? 'var(--text3)' : 'var(--text1)',
                              lineHeight: 1.35,
                              textDecoration: checked ? 'line-through' : 'none',
                              opacity: checked ? 0.75 : 1,
                            }}
                          >
                            {parsedItem.title}
                          </span>

                          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            <span style={statChipStyle(parsedItem.quantity ? 'quantity' : 'empty', checked)}>
                              {parsedItem.quantity ?? 'Quantidade'}
                            </span>
                            <span style={statChipStyle(parsedItem.kcal ? 'kcal' : 'empty', checked)}>
                              {parsedItem.kcal ?? 'kcal'}
                            </span>
                          </span>

                          <span
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 10,
                              fontSize: 11,
                              lineHeight: 1.45,
                              textDecoration: checked ? 'line-through' : 'none',
                              opacity: checked ? 0.7 : 0.95,
                            }}
                          >
                            <span style={{ color: 'var(--text3)', opacity: parsedItem.macros.proteinas ? 1 : 0.6 }}>
                              proteínas: {parsedItem.macros.proteinas ?? '--'}
                            </span>
                            <span style={{ color: 'var(--text3)', opacity: parsedItem.macros.carboidratos ? 1 : 0.6 }}>
                              carboidratos: {parsedItem.macros.carboidratos ?? '--'}
                            </span>
                            <span style={{ color: 'var(--text3)', opacity: parsedItem.macros.gorduras ? 1 : 0.6 }}>
                              gorduras: {parsedItem.macros.gorduras ?? '--'}
                            </span>
                          </span>

                          {parsedItem.extras.length > 0 && (
                            <span
                              style={{
                                fontSize: 11,
                                color: 'var(--text3)',
                                lineHeight: 1.45,
                                textDecoration: checked ? 'line-through' : 'none',
                                opacity: checked ? 0.65 : 0.9,
                              }}
                            >
                              {parsedItem.extras.join(' · ')}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div style={{ padding: '0 14px 12px' }}>
                  <textarea
                    value={noteText}
                    onChange={(e) => handleNoteChange(mealPlan.key as DietMealKey, e.target.value)}
                    placeholder="Notas (opcional)..."
                    rows={2}
                    style={{
                      width: '100%',
                      background: 'var(--bg2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontFamily: 'DM Sans, sans-serif',
                      fontSize: 12,
                      color: 'var(--text1)',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                      lineHeight: 1.5,
                    }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    Registre substituições, fome, saciedade ou observações da refeição.
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon="salad"
          title="Monte seu plano alimentar"
          body="Monte ou importe um plano para registrar suas refeições."
          action={{ label: 'Importar plano', onClick: () => setShowImport(true) }}
        />
      )}

      {plans.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 10,
              color: 'var(--text3)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 8px',
            }}
          >
            Dietas importadas
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  background: 'var(--bg1)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <button
                  onClick={() => setSelectedId(plan.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: 13,
                    color: plan.id === selectedId ? 'var(--teal)' : 'var(--text2)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: plan.id === selectedId ? 600 : 400,
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {normalizeDisplayText(plan.title)}
                </button>
                <button
                  onClick={() => setConfirmDeleteId(plan.id)}
                  aria-label="Remover dieta"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text3)',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 4,
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowImport(true)}
        style={{
          background: 'none',
          border: '1.5px dashed var(--border)',
          borderRadius: 12,
          minHeight: 44,
          padding: '12px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text2)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          width: '100%',
          touchAction: 'manipulation',
        }}
      >
        <Icon name="plus" size={18} color="var(--teal)" />
        Importar plano de dieta
      </button>

      <FileImportModal
        open={showImport}
        title="Importar plano de dieta"
        kind="mixed"
        domain="diet"
        onClose={() => setShowImport(false)}
        onConfirm={handleImportConfirm}
      />

      {importReview && (
        <PlanReviewModal
          mode="diet"
          plan={importReview.parsed}
          onConfirm={(p) => confirmImport(p as ParsedDietPlan)}
          onCancel={() => setImportReview(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Excluir plano de dieta?"
        body={`"${normalizeDisplayText(plans.find((p) => p.id === confirmDeleteId)?.title ?? 'Dieta')}" e os registros de refeições dele serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir dieta"
        onConfirm={() => {
          if (confirmDeleteId) handleDelete(confirmDeleteId)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
