'use client'

import type { CSSProperties, ReactNode } from 'react'

const FONT = 'Inter, sans-serif'

type FinTab = 'transacoes' | 'orcamento' | 'metas'

export interface FinHubCategory {
  name: string
  value: number
  color: string
  pct: number // % do total de saídas
}
export interface FinHubGoal {
  name: string
  current: number
  goal: number
  gradient: string // ex: '#F5C842, #E07B2A'
}
export interface FinHubFlow {
  label: string
  entradas: number
  saidas: number
  current?: boolean
}

interface Props {
  monthLabel: string
  balance: number
  totalIn: number
  totalOut: number
  flow: FinHubFlow[]
  categories: FinHubCategory[]
  goals: FinHubGoal[]
  onNavigate: (tab: FinTab) => void
  onAdd: () => void
}

function eur(v: number) {
  return `€ ${Math.round(v).toLocaleString('pt-BR')}`
}

export default function FinancasHub({
  monthLabel,
  balance,
  totalIn,
  totalOut,
  flow,
  categories,
  goals,
  onNavigate,
  onAdd,
}: Props) {
  const positive = balance >= 0
  const flowMax = Math.max(1, ...flow.map((f) => Math.max(f.entradas, f.saidas)))

  return (
    <div style={{ fontFamily: FONT, background: '#07070F', minHeight: '100vh', padding: '0 22px 28px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 14px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Finanças</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{monthLabel}</div>
        </div>
        <button
          onClick={onAdd}
          aria-label="Registar transação"
          style={iconBtn}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Balance hero */}
      <div
        onClick={() => onNavigate('transacoes')}
        style={{
          background: positive
            ? 'linear-gradient(135deg, #0A1A08 0%, #0D2010 100%)'
            : 'linear-gradient(135deg, #1A0A0A 0%, #200D0D 100%)',
          border: `1px solid ${positive ? 'rgba(0,200,150,0.2)' : 'rgba(226,75,74,0.25)'}`,
          borderRadius: 24,
          padding: '24px 22px',
          marginBottom: 14,
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -30,
            width: 160,
            height: 160,
            background: `radial-gradient(circle, ${positive ? 'rgba(0,200,150,0.12)' : 'rgba(226,75,74,0.12)'} 0%, transparent 70%)`,
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: positive ? 'rgba(0,200,150,0.6)' : 'rgba(226,75,74,0.7)', marginBottom: 6 }}>
            Saldo do mês
          </div>
          <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-2px', lineHeight: 1, marginBottom: 4 }}>
            {eur(balance)}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 18 }}>Atualizado agora</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <BalCard label="Receitas" dot="#00C896" value={eur(totalIn)} />
            <BalCard label="Despesas" dot="#FF6B6B" value={eur(totalOut)} />
          </div>
        </div>
      </div>

      {/* Flow chart */}
      <div
        onClick={() => onNavigate('transacoes')}
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '18px 20px', marginBottom: 14, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Fluxo de caixa</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Últimos 6 meses</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 56, padding: '0 2px' }}>
          {flow.map((f, i) => {
            const cur = f.current
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 40, width: '100%', justifyContent: 'center' }}>
                  <div style={{ width: '42%', height: `${Math.max(4, (f.entradas / flowMax) * 100)}%`, borderRadius: '4px 4px 0 0', background: cur ? '#00C896' : 'rgba(0,200,150,0.3)' }} />
                  <div style={{ width: '42%', height: `${Math.max(4, (f.saidas / flowMax) * 100)}%`, borderRadius: '4px 4px 0 0', background: cur ? 'rgba(255,80,80,0.6)' : 'rgba(255,80,80,0.25)' }} />
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: cur ? '#00C896' : 'rgba(255,255,255,0.3)' }}>{f.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Categorias */}
      <SectionLabel>Categorias do mês</SectionLabel>
      {categories.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => onNavigate('orcamento')}>
          {categories.map((c) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: hexA(c.color, 0.14), color: c.color, fontWeight: 800, fontSize: 15 }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, c.pct)}%`, background: c.color }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{eur(c.value)}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontWeight: 500 }}>{Math.round(c.pct)}%</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyHint text="Sem saídas registadas este mês" onClick={() => onNavigate('transacoes')} />
      )}

      {/* Metas */}
      <SectionLabel style={{ marginTop: 18 }}>Metas financeiras</SectionLabel>
      {goals.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onClick={() => onNavigate('metas')}>
          {goals.map((g) => {
            const pct = g.goal > 0 ? Math.min(100, Math.round((g.current / g.goal) * 100)) : 0
            return (
              <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{g.name}</div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 5, overflow: 'hidden', marginBottom: 5 }}>
                    <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: `linear-gradient(90deg, ${g.gradient})` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{eur(g.current)}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{eur(g.goal)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyHint text="Defina suas metas financeiras" onClick={() => onNavigate('metas')} />
      )}

    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────
const iconBtn: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
}

function BalCard({ label, dot, value }: { label: string; dot: string; value: string }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{value}</div>
    </div>
  )
}

function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10, marginTop: 18, ...style }}>
      {children}
    </div>
  )
}

function EmptyHint({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
    >
      {text}
    </div>
  )
}

function hexA(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
