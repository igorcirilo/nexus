'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import type { HojeMetrics } from '@/lib/hoje-metrics'

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
          icon="💪"
          trend={corpo?.deltaKg != null ? `${corpo.deltaKg <= 0 ? '▼' : '▲'} ${Math.abs(corpo.deltaKg)}kg` : undefined}
          value={corpo ? fmtNum(corpo.weightKg) : '—'}
          unit={corpo ? 'kg' : undefined}
          label="Corpo · peso"
          sub={corpo ? 'Último registo' : 'Sem registos'}
        />
        {/* Finanças */}
        <MetricCard
          href="/financas"
          color="#1D9E75"
          icon="💰"
          value={financas ? `${financas.netMonth >= 0 ? '+' : ''}${fmtNum(financas.netMonth)}` : '—'}
          unit={financas ? '€' : undefined}
          label="Finanças · saldo"
          sub="Este mês"
        />
        {/* Leitura */}
        <MetricCard
          href="/leitura"
          color="#E8A838"
          icon="📖"
          trend={leitura ? `${leitura.pct}%` : undefined}
          value={leitura ? fmtNum(leitura.currentPage) : '—'}
          label="Leitura · página"
          sub={leitura ? leitura.title : 'Sem leitura ativa'}
        />
        {/* Agenda */}
        <MetricCard
          href="/calendario"
          color="#85B7EB"
          icon="📅"
          value={agenda ? agenda.time : '—'}
          label="Agenda · próximo"
          sub={agenda ? agenda.title : 'Nada agendado hoje'}
        />
        {/* Ritmo / sequência */}
        <MetricCard
          href="/progresso"
          color="#E8A838"
          icon="🔥"
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
          icon="🎯"
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
  href, color, icon, trend, value, unit, label, sub,
}: {
  href: string
  color: string
  icon: string
  trend?: string
  value: string
  unit?: string
  label: string
  sub: string
}) {
  return (
    <Link href={href} style={{ ...cardStyle, background: `linear-gradient(135deg, ${color}22, ${color}08)`, borderColor: `${color}26` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, background: `${color}26` }}>{icon}</span>
        {trend && (
          <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: `${color}26`, color }}>{trend}</span>
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
