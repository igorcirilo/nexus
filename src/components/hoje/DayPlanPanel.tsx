'use client'

import { useMemo, useState } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'
import { AREA_META } from '@/types'
import type { DayPlan, PlanItem, PlanItemKind } from '@/lib/day-planner'

interface DayPlanPanelProps {
  plan: DayPlan
}

const KIND_ICON: Record<PlanItemKind, IconName> = {
  task: 'clipboard',
  habit: 'check',
  event: 'calendar',
  milestone: 'target',
}

const KIND_LABEL: Record<PlanItemKind, string> = {
  task: 'Tarefa',
  habit: 'Hábito',
  event: 'Evento',
  milestone: 'Objetivo',
}

export default function DayPlanPanel({ plan }: DayPlanPanelProps) {
  // "Ajustar": mostra/oculta os itens já concluídos (estado local, sem persistência).
  const [showDone, setShowDone] = useState(false)

  const pending = useMemo(() => plan.items.filter((i) => !i.done), [plan.items])
  const done = useMemo(() => plan.items.filter((i) => i.done), [plan.items])

  // Não renderiza nada se não houver plano (a página decide o fallback).
  if (plan.items.length === 0) return null

  const visible = showDone ? plan.items : pending

  return (
    <section
      aria-label="O teu dia"
      style={{
        margin: '16px 20px 0',
        padding: '20px',
        borderRadius: 24,
        background: 'linear-gradient(135deg, rgba(var(--card-rgb),.98), rgba(var(--card-rgb),.98))',
        border: '0.5px solid rgba(var(--ink-rgb),.08)',
        borderLeft: '2px solid var(--teal)',
        boxShadow: '0 20px 54px rgba(0,0,0,.24)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: 14, background: 'rgba(30,203,180,.12)', color: 'var(--teal)', border: '0.5px solid rgba(30,203,180,.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="list" size={20} />
          </span>
          <span style={{ fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 12, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800 }}>
            O teu dia
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {pending.length} {pending.length === 1 ? 'pendente' : 'pendentes'}
        </span>
      </div>

      {plan.capacityHint && (
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text2)', marginBottom: 14 }}>
          {plan.capacityHint}
        </p>
      )}

      {plan.focusSuggestion && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 14, borderRadius: 14, background: 'rgba(232,168,56,.1)', border: '0.5px solid rgba(232,168,56,.24)' }}>
          <Icon name="zap" size={16} color="var(--gold)" />
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{plan.focusSuggestion}</p>
        </div>
      )}

      <ul style={{ listStyle: 'none', display: 'grid', gap: 8, margin: 0, padding: 0 }}>
        {visible.map((item) => (
          <PlanRow key={item.id} item={item} />
        ))}
      </ul>

      {done.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          style={{ marginTop: 12, border: 'none', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font-dm), "DM Sans", sans-serif', fontSize: 13, cursor: 'pointer', padding: '6px 0', touchAction: 'manipulation' }}
        >
          {showDone ? 'Ocultar concluídos' : `Ver ${done.length} concluído${done.length === 1 ? '' : 's'}`}
        </button>
      )}
    </section>
  )
}

function PlanRow({ item }: { item: PlanItem }) {
  const accent = item.area ? AREA_META[item.area]?.color ?? 'var(--teal)' : 'var(--teal)'
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        background: item.done ? 'rgba(var(--ink-rgb),.03)' : 'rgba(var(--ink-rgb),.05)',
        border: '0.5px solid var(--border)',
        opacity: item.done ? 0.6 : 1,
      }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 10, background: `${accent}1f`, color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={KIND_ICON[item.kind]} size={15} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
          {KIND_LABEL[item.kind]}
          {item.scheduledAt ? ` · ${item.scheduledAt}` : ''}
        </p>
      </div>
      {item.isPriority && !item.done && (
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gold)', background: 'rgba(232,168,56,.12)', border: '0.5px solid rgba(232,168,56,.28)', borderRadius: 8, padding: '3px 7px', flexShrink: 0 }}>
          Prioritário
        </span>
      )}
    </li>
  )
}
