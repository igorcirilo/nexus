'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { HojeMetrics } from '@/lib/hoje-metrics'
import Icon, { type IconName } from '@/components/ui/Icon'
import { inkFor } from '@/lib/theme'

/**
 * Grelha 2x3 de métricas-resumo das páginas principais (Hoje v2).
 * Cada card é um atalho para a respetiva página.
 */

const FONT = 'Inter, sans-serif'

interface Props {
  metrics: HojeMetrics
}

function fmtNum(n: number): string {
  return n.toLocaleString('pt-PT')
}

export default function MetricsGrid({ metrics }: Props) {
  const { corpo, financas, leitura, agenda, ritmo, objetivo } = metrics

  return (
    <section style={{ padding: '6px 20px 0', fontFamily: FONT }}>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text1)', margin: '8px 4px 12px' }}>
        Os teus números
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
        {/* Corpo */}
        <MetricCard
          href="/corpo"
          color="#1ECBB4"
          icon="dumbbell"
          trend={corpo?.deltaKg != null ? `${Math.abs(corpo.deltaKg)}kg` : undefined}
          trendIcon={corpo?.deltaKg != null ? (corpo.deltaKg <= 0 ? 'arrow-down' : 'arrow-up') : undefined}
          value={corpo ? fmtNum(corpo.weightKg) : '—'}
          unit={corpo ? 'kg' : undefined}
          label="Corpo · peso"
          sub={corpo ? 'Último registo' : 'Sem registos'}
        />
        {/* Finanças */}
        <MetricCard
          href="/financas"
          color="#1D9E75"
          icon="wallet"
          value={financas ? `${financas.netMonth >= 0 ? '+' : ''}${fmtNum(financas.netMonth)}` : '—'}
          unit={financas ? '€' : undefined}
          label="Finanças · balanço"
          sub="Este mês"
        />
        {/* Leitura */}
        <MetricCard
          href="/leitura"
          color="#E8A838"
          icon="book-open"
          trend={leitura ? `${leitura.pct}%` : undefined}
          value={leitura ? fmtNum(leitura.currentPage) : '—'}
          label="Leitura · página"
          sub={leitura ? leitura.title : 'Sem leitura ativa'}
        />
        {/* Agenda */}
        <MetricCard
          href="/calendario"
          color="#85B7EB"
          icon="calendar"
          value={agenda ? agenda.time : '—'}
          label="Agenda · próximo"
          sub={agenda ? agenda.title : 'Nada agendado hoje'}
        />
        {/* Ritmo / sequência */}
        <MetricCard
          href="/estatisticas"
          color="#E8A838"
          icon="flame"
          trend={ritmo.best > 0 ? `recorde ${ritmo.best}` : undefined}
          value={fmtNum(ritmo.streak)}
          unit="dias"
          label="Ritmo · sequência"
          sub={ritmo.successPct != null ? `${ritmo.successPct}% taxa de sucesso` : 'Começa hoje'}
        />
        {/* Objetivo em foco */}
        <MetricCard
          href="/objetivos"
          color="#7F77DD"
          icon="target"
          trend={objetivo ? `${objetivo.progress}%` : undefined}
          value={objetivo ? `${objetivo.progress}%` : '—'}
          label="Objetivo em foco"
          sub={objetivo ? objetivo.title : 'Sem objetivos ativos'}
        />
      </div>
    </section>
  )
}

function MetricCard({
  href, color, icon, trend, trendIcon, value, unit, label, sub,
}: {
  href: string
  color: string
  icon: IconName
  trend?: string
  trendIcon?: IconName
  value: string
  unit?: string
  label: string
  sub: string
}) {
  return (
    <Link href={href} style={{ ...cardStyle, background: `linear-gradient(135deg, ${color}22, ${color}08)`, borderColor: `${color}26` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: inkFor(color), background: `${color}26` }}><Icon name={icon} size={19} /></span>
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: `${color}26`, color: inkFor(color), display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            {trendIcon && <Icon name={trendIcon} size={11} style={{ strokeWidth: 2.4 }} />}
            {trend}
          </span>
        )}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 28, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}{unit && <small style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}> {unit}</small>}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
    </Link>
  )
}

const cardStyle: CSSProperties = {
  aspectRatio: '1 / 1',
  borderRadius: 20,
  padding: 15,
  border: '1px solid rgba(var(--ink-rgb),0.08)',
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  overflow: 'hidden',
  fontFamily: FONT,
}
