'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import FileImportModal from '@/components/FileImportModal'
import PlanReviewModal from '@/components/PlanReviewModal'
import { useToast } from '@/components/Toast'
import { getDietPlans, saveDietPlan } from '@/lib/supabase'
import { getDietMeals, upsertDietMeal, deleteDietPlan } from '@/lib/body'
import { parseDietImport, type ParsedDietPlan } from '@/lib/body-plan'
import type { DietPlan, DietMeal, DietMealKey, FileImportResult } from '@/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MEALS = [
  { key: 'pequeno_almoco', label: 'Pequeno-almoço', icon: '🍳' },
  { key: 'almoco', label: 'Almoço', icon: '🍽️' },
  { key: 'lanche', label: 'Lanche', icon: '🥤' },
  { key: 'jantar', label: 'Jantar', icon: '🌙' },
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

function normalizeDisplayText(value: string) {
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

function parseKcalValue(kcal: string | null): number {
  if (!kcal) return 0
  const match = kcal.replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? Math.round(parseFloat(match[1])) : 0
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
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

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

  const kcalByMeal = parsed
    ? MEALS.map((meal) => {
        const mealPlan = parsed.meals.find((m) => m.key === meal.key)
        if (!mealPlan) return { label: meal.label, selecionadas: 0, total: 0 }
        const log = selectedId ? getMealLog(meal.key as DietMealKey) : undefined
        const payload = selectedId
          ? getMealPayload(selectedId, meal.key as DietMealKey, log)
          : { freeText: '' }
        let selecionadas = 0
        let total = 0
        for (const item of mealPlan.items) {
          if (!isVisibleDietItem(item)) continue
          const kcal = parseKcalValue(parseDietDisplayItem(item).kcal)
          if (kcal <= 0) continue
          total += kcal
          if (payload.items?.[itemCheckKey(item)]) selecionadas += kcal
        }
        return { label: meal.label, selecionadas, total }
      })
    : []

  const totalKcalSelecionadas = kcalByMeal.reduce((acc, m) => acc + m.selecionadas, 0)
  const totalKcalPlano = kcalByMeal.reduce((acc, m) => acc + m.total, 0)
  const kcalChartData = kcalByMeal.filter((m) => m.total > 0)
  const hasKcalData = totalKcalPlano > 0

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

          {hasKcalData && (
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>
                  Calorias selecionadas
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--gold)' }}>
                    {totalKcalSelecionadas}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>/ {totalKcalPlano} kcal</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={kcalChartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--bg2)' }}
                    contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text1)' }}
                    formatter={(value: number) => `${value} kcal`}
                    labelStyle={{ color: 'var(--text3)', fontSize: 11 }}
                  />
                  <Bar dataKey="total" name="Total do plano" fill="var(--bg3)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="selecionadas" name="Selecionadas" fill="var(--teal)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--teal)' }} />
                  Selecionadas
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bg3)' }} />
                  Total do plano
                </span>
              </div>
            </div>
          )}

          {MEALS.map((meal) => {
            const mealPlan = parsed.meals.find((m) => m.key === meal.key)
            if (!mealPlan || mealPlan.items.length === 0) return null

            const log = getMealLog(meal.key as DietMealKey)
            const payload = selectedId ? getMealPayload(selectedId, meal.key as DietMealKey, log) : { freeText: '' }
            const checkedCount = mealPlan.items.filter((item) => payload.items?.[itemCheckKey(item)]).length
            const done = mealPlan.items.length > 0 ? checkedCount === mealPlan.items.length : (log?.completed ?? false)
            const noteText = payload.freeText ?? ''

            return (
              <div
                key={meal.key}
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
                    onClick={() => toggleMeal(meal.key as DietMealKey)}
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
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      padding: 0,
                    }}
                  >
                    {done ? '✓' : ''}
                  </button>

                  <span style={{ fontSize: 18, lineHeight: 1 }}>{meal.icon}</span>
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
                    {meal.label}
                  </span>

                  <div style={{ fontSize: 11, color: done ? 'var(--teal)' : 'var(--text3)', marginRight: 8 }}>
                    {checkedCount}/{mealPlan.items.length}
                  </div>

                  <button
                    onClick={() => toggleMeal(meal.key as DietMealKey)}
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
                        onClick={() => toggleMealItem(meal.key as DietMealKey, item, mealPlan.items)}
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
                            color: '#fff',
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
                    onChange={(e) => handleNoteChange(meal.key as DietMealKey, e.target.value)}
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
                    Regista substituições, fome, saciedade ou observações da refeição.
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '48px 24px',
          }}
        >
          <span style={{ fontSize: 48 }}>🥗</span>
          <p
            style={{
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 15,
              color: 'var(--text2)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Nenhuma dieta importada.
          </p>
        </div>
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
                  onClick={() => handleDelete(plan.id)}
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
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text2)',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 14,
          width: '100%',
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--teal)',
          }}
        >
          +
        </span>
        Importar plano de dieta
      </button>

      <FileImportModal
        open={showImport}
        title="Importar plano de dieta"
        kind="mixed"
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
    </div>
  )
}
