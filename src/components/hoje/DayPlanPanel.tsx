'use client'

import { useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'
import { AREA_META } from '@/types'
import { repairMojibake } from '@/lib/text'
import type { DayPlan, PlanItem, PlanItemKind } from '@/lib/day-planner'

interface DayPlanPanelProps {
  plan: DayPlan
  habitProgress: { done: number; total: number }
  onToggleHabit: (habitId: string, done: boolean) => Promise<void> | void
  onAddHabit: () => void
}

// Linhas contextuais (não-hábito): ícone do tipo + destino de navegação.
const CONTEXT_ICON: Record<Exclude<PlanItemKind, 'habit'>, IconName> = {
  task: 'clipboard',
  event: 'calendar',
  milestone: 'target',
}

const CONTEXT_HREF: Record<Exclude<PlanItemKind, 'habit'>, string> = {
  task: '/programa',
  event: '/calendario',
  milestone: '/objetivos',
}

const CONTEXT_LABEL: Record<Exclude<PlanItemKind, 'habit'>, string> = {
  task: 'Tarefa',
  event: 'Evento',
  milestone: 'Objetivo',
}

export default function DayPlanPanel({ plan, habitProgress, onToggleHabit, onAddHabit }: DayPlanPanelProps) {
  const [savingId, setSavingId] = useState<string | null>(null)

  async function toggle(item: PlanItem) {
    if (savingId) return
    setSavingId(item.sourceId)
    try {
      await onToggleHabit(item.sourceId, !item.done)
    } finally {
      setSavingId(null)
    }
  }

  // Sem nada para mostrar: o HojeClient trata o caso legado (backfill).
  if (plan.items.length === 0) {
    return (
      <section id="habitos-hoje" aria-label="O teu dia" style={{ padding: '18px 20px 0', scrollMarginTop: 16 }}>
        <div style={cardStyle}>
          <Header progress={habitProgress} />
          <div style={{ padding: 18, borderRadius: 16, background: 'rgba(13,15,20,.2)', border: '0.5px solid var(--border)', color: 'var(--text3)', fontSize: 13, textAlign: 'center' }}>
            Nenhum hábito para hoje.
            <button type="button" onClick={onAddHabit} style={addBtnStyle}>
              Criar hábito
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="habitos-hoje" aria-label="O teu dia" style={{ padding: '18px 20px 0', scrollMarginTop: 16 }}>
      <div style={cardStyle}>
        <Header progress={habitProgress} />

        {plan.capacityHint && (
          <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>{plan.capacityHint}</p>
        )}

        {plan.focusSuggestion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'rgba(232,168,56,.1)', border: '0.5px solid rgba(232,168,56,.24)' }}>
            <Icon name="zap" size={16} color="var(--gold)" />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{plan.focusSuggestion}</p>
          </div>
        )}

        {plan.items.map((item) =>
          item.kind === 'habit' ? (
            <HabitRow
              key={item.id}
              item={item}
              saving={savingId === item.sourceId}
              busy={savingId !== null}
              onToggle={() => toggle(item)}
            />
          ) : (
            <ContextRow key={item.id} item={item} />
          ),
        )}
      </div>
    </section>
  )
}

function Header({ progress }: { progress: { done: number; total: number } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, lineHeight: 1.2, color: 'var(--text1)' }}>
          O teu dia
        </h2>
        {progress.total > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
            {progress.done}/{progress.total} hábitos
          </span>
        )}
      </div>
      <a
        href="/habitos"
        style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', color: 'var(--teal)', textDecoration: 'none', fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', touchAction: 'manipulation' }}
      >
        Ver todos
      </a>
    </div>
  )
}

function HabitRow({ item, saving, busy, onToggle }: { item: PlanItem; saving: boolean; busy: boolean; onToggle: () => void }) {
  const color = item.area ? AREA_META[item.area]?.color ?? 'var(--teal)' : 'var(--teal)'
  const areaLabel = item.area ? AREA_META[item.area]?.label ?? item.area : ''
  const label = repairMojibake(item.label)
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={item.done}
      aria-busy={saving}
      aria-label={`${item.done ? 'Desmarcar' : 'Concluir'} hábito ${label}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 10px',
        borderRadius: 15,
        background: 'rgba(13,15,20,.2)',
        border: `0.5px solid ${item.done ? 'rgba(30,203,180,.3)' : 'var(--border)'}`,
        borderLeft: `3px solid ${color}`,
        opacity: item.done ? 0.62 : busy && !saving ? 0.5 : 1,
        cursor: busy ? 'not-allowed' : 'pointer',
        minHeight: 44,
        touchAction: 'manipulation',
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: '50%', border: item.done ? 'none' : '2px solid var(--text3)', color: 'var(--teal)', background: item.done ? 'rgba(30,203,180,.12)' : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {item.done && <Icon name="check" size={16} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 16, lineHeight: 1.22, color: item.done ? 'var(--text3)' : 'var(--text1)', textDecoration: item.done ? 'line-through' : 'none', marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>
          {label}
        </h3>
        <div style={{ display: 'flex', gap: 7, fontSize: 13, minWidth: 0, alignItems: 'center' }}>
          {areaLabel && <span style={{ color, fontWeight: 600, flexShrink: 0 }}>{areaLabel}</span>}
          {item.timeWindow && <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>}
          {item.timeWindow && <span style={{ color: 'var(--text3)' }}>{item.timeWindow}</span>}
        </div>
      </div>
      {item.isPriority && !item.done && <PriorityTag />}
    </button>
  )
}

function ContextRow({ item }: { item: PlanItem }) {
  const kind = item.kind as Exclude<PlanItemKind, 'habit'>
  const accent = item.area ? AREA_META[item.area]?.color ?? 'var(--teal)' : 'var(--teal)'
  const label = repairMojibake(item.label)
  return (
    <a
      href={CONTEXT_HREF[kind]}
      aria-label={`Abrir ${CONTEXT_LABEL[kind]}: ${label}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 12,
        textDecoration: 'none',
        padding: '12px 10px',
        borderRadius: 15,
        background: 'rgba(13,15,20,.12)',
        border: '0.5px solid var(--border)',
        opacity: item.done ? 0.62 : 1,
        minHeight: 44,
        touchAction: 'manipulation',
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 12, background: `${accent}1f`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={CONTEXT_ICON[kind]} size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontWeight: 700, fontSize: 15, lineHeight: 1.22, color: item.done ? 'var(--text3)' : 'var(--text1)', textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
          {CONTEXT_LABEL[kind]}
          {item.scheduledAt ? ` · ${item.scheduledAt}` : ''}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {item.isPriority && !item.done && <PriorityTag />}
        <Icon name="chevron-right" size={16} color="var(--text3)" />
      </div>
    </a>
  )
}

function PriorityTag() {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gold)', background: 'rgba(232,168,56,.12)', border: '0.5px solid rgba(232,168,56,.28)', borderRadius: 8, padding: '3px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
      Prioritário
    </span>
  )
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 20,
  background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
  border: '0.5px solid var(--border)',
  boxShadow: '0 14px 40px rgba(0,0,0,.14)',
}

const addBtnStyle: React.CSSProperties = {
  minHeight: 44,
  marginTop: 12,
  width: '100%',
  border: 'none',
  borderRadius: 14,
  background: 'linear-gradient(180deg, #F4C85A, var(--gold))',
  color: 'var(--on-bright)',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  touchAction: 'manipulation',
}
