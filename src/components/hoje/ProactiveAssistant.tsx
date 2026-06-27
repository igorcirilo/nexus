'use client'

import type { CSSProperties } from 'react'
import type { Pendencia, PendenciaSeverity } from '@/lib/pendencias'

/**
 * Card do assistente proativo no topo do Hoje (v2): mensagem do mentor,
 * "Foco agora" (top prioridade do plano) e as pendências detetadas.
 * Presentacional — recebe tudo já calculado por day-planner + pendencias.
 */

const FONT = 'Inter, sans-serif'

const SEV_COLOR: Record<PendenciaSeverity, string> = {
  risk: '#E24B4A',
  warn: '#E8A838',
  info: '#85B7EB',
}
const SEV_ICON: Record<PendenciaSeverity, string> = { risk: '🔴', warn: '⚠️', info: 'ℹ️' }

interface Props {
  message: string
  /** Frase de foco (ex.: "Começa por: Treino completo."). */
  focusPhrase: string | null
  planCount: number
  pendencias: Pendencia[]
  onFocusClick?: () => void
  /** Missão do dia (definida no check-in da manhã). */
  mission?: string | null
  missionPct?: number
  onMissionProgress?: (pct: number) => void
}

export default function ProactiveAssistant({ message, focusPhrase, planCount, pendencias, onFocusClick, mission, missionPct = 0, onMissionProgress }: Props) {
  const top = pendencias.slice(0, 3)
  const hasMission = Boolean(mission && mission.trim())

  return (
    <section style={{ padding: '14px 20px 0', fontFamily: FONT }}>
      <div style={wrap}>
        <div style={glow} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={orb}>✦</span>
          <b style={{ fontSize: 12.5, fontWeight: 800, color: '#D7D4FF', letterSpacing: '0.04em' }}>O TEU ASSISTENTE</b>
          {planCount > 0 && (
            <span style={tag}>Plano de hoje · {planCount} {planCount === 1 ? 'item' : 'itens'}</span>
          )}
        </div>

        <p style={msgStyle}>{message}</p>

        {/* Missão do dia (movida do antigo card "Missão"). */}
        <div style={missionBox}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8E93B5', fontWeight: 800 }}>Missão do dia</span>
            {hasMission && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: '#1ECBB4' }}>{missionPct}%</span>}
          </div>
          {hasMission ? (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 700, margin: '6px 0 10px', lineHeight: 1.3 }}>{mission}</p>
              <input
                type="range" min={0} max={100} step={5} value={missionPct}
                onChange={(e) => onMissionProgress?.(Number(e.target.value))}
                aria-label="Progresso da missão"
                style={{ width: '100%', accentColor: '#1ECBB4', cursor: 'pointer' }}
              />
            </>
          ) : (
            <a href="/checkin" style={{ display: 'inline-block', marginTop: 6, fontSize: 13, color: '#F5C842', fontWeight: 700, textDecoration: 'none' }}>
              Definir missão no check-in ›
            </a>
          )}
        </div>

        {focusPhrase && (
          <button onClick={onFocusClick} style={focusBox}>
            <span style={play}>▶</span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8E93B5', fontWeight: 800 }}>Foco agora</span>
              <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{focusPhrase}</span>
            </span>
            <span style={{ fontSize: 18, color: 'var(--text2)', flexShrink: 0 }}>›</span>
          </button>
        )}

        {top.length > 0 && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
            {top.map((p) => {
              const color = SEV_COLOR[p.severity]
              const inner = (
                <>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{SEV_ICON[p.severity]}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.35 }}>{p.message}</span>
                  {p.ctaHref && <span style={{ fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>{p.ctaLabel ?? 'Abrir'} ›</span>}
                </>
              )
              const style: CSSProperties = {
                display: 'flex', alignItems: 'center', gap: 9,
                background: `${color}14`, border: `1px solid ${color}2e`,
                borderRadius: 12, padding: '9px 11px', textDecoration: 'none',
              }
              return p.ctaHref ? (
                <a key={p.id} href={p.ctaHref} style={style}>{inner}</a>
              ) : (
                <div key={p.id} style={style}>{inner}</div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

const wrap: CSSProperties = {
  position: 'relative',
  borderRadius: 22,
  padding: 18,
  background: 'linear-gradient(135deg, rgba(127,119,221,0.20), rgba(30,203,180,0.10))',
  border: '1px solid rgba(127,119,221,0.35)',
  overflow: 'hidden',
}
const glow: CSSProperties = {
  position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(127,119,221,0.45), transparent 70%)',
}
const orb: CSSProperties = {
  width: 38, height: 38, borderRadius: 12, flexShrink: 0,
  background: 'linear-gradient(135deg, #9C94EC, #1ECBB4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
  boxShadow: '0 0 18px rgba(127,119,221,0.6)', color: '#fff',
}
const tag: CSSProperties = {
  marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: 'var(--text2)',
  background: 'rgba(var(--ink-rgb),0.08)', padding: '4px 9px', borderRadius: 20, whiteSpace: 'nowrap',
}
const msgStyle: CSSProperties = {
  position: 'relative', marginTop: 13, fontSize: 15, lineHeight: 1.45, color: 'var(--ink)', fontWeight: 600,
}
const missionBox: CSSProperties = {
  position: 'relative', marginTop: 14, background: 'rgba(0,0,0,0.18)',
  border: '1px solid rgba(var(--ink-rgb),0.10)', borderRadius: 14, padding: '12px 13px',
}
const focusBox: CSSProperties = {
  position: 'relative', marginTop: 14, width: '100%', display: 'flex', alignItems: 'center', gap: 11,
  background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(var(--ink-rgb),0.10)',
  borderRadius: 14, padding: '12px 13px', cursor: 'pointer', fontFamily: FONT,
}
const play: CSSProperties = {
  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
  background: 'rgba(30,203,180,0.18)', color: '#1ECBB4',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
}
