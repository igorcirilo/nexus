'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, getDay, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import CalendarioLoading from '@/components/calendario/CalendarioLoading'
import ErrorState from '@/components/ui/ErrorState'
import { useCalendarioController } from '@/components/calendario/useCalendarioController'
import { DAYS_MIN, DAYS_SHORT, EVENT_COLORS, PHASE_LABELS, getStreakSide, streakBarStyle, type DayStatus } from '@/components/calendario/types'
import { parseLocalDate } from '@/lib/date'
import { AREA_META } from '@/types'
import type { HabitArea } from '@/types'

const FONT = 'Inter, sans-serif'
const PHASE_EMOJI: Record<string, string> = { manha: '🌅', tarde: '☀️', noite: '🌙' }

const sheetLabel: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)', display: 'block', margin: '16px 0 8px', fontFamily: FONT,
}
const sheetInp: CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 13, padding: '12px 14px', color: '#fff',
  fontFamily: FONT, fontSize: 14, fontWeight: 600, outline: 'none',
}

// Heatmap no design do hub (verde por intensidade de hábitos concluídos)
function hubHeat(status: DayStatus | undefined): string {
  if (!status || status.habits === 0) return 'transparent'
  if (status.complete) return 'rgba(0,200,150,0.85)'
  const intensity = Math.min(status.habits, 5) / 5
  if (intensity >= 0.6) return 'rgba(0,200,150,0.40)'
  if (intensity >= 0.3) return 'rgba(0,200,150,0.22)'
  return 'rgba(0,200,150,0.10)'
}

function Sheet({ icon, title, sub, onClose, children, footer, tall }: {
  icon?: string; title: string; sub?: string; onClose: () => void
  children: React.ReactNode; footer?: React.ReactNode; tall?: boolean
}) {
  // Fechar com Esc — acessibilidade de teclado em diálogos modais.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 448, margin: '0 auto', background: '#11131C',
        borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', flexDirection: 'column',
        maxHeight: tall ? '92dvh' : 'min(86dvh, 720px)',
        fontFamily: FONT, boxShadow: '0 -20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)', margin: '10px auto 0', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-0.3px' }}>{title}</div>
            {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{sub}</div>}
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', fontSize: 15, color: 'rgba(255,255,255,0.6)', flexShrink: 0, touchAction: 'manipulation' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px 16px' }}>{children}</div>
        {footer && (
          <div style={{ padding: '12px 20px calc(20px + env(safe-area-inset-bottom))', background: '#11131C', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CalendarioPage() {
  const c = useCalendarioController()
  const [createOpen, setCreateOpen] = useState<'evento' | 'alerta' | null>(null)
  const [alertsOpen, setAlertsOpen] = useState(false)

  if (c.loading) return <CalendarioLoading />

  if (c.loadError) {
    return (
      <ErrorState
        title="O calendário não carregou"
        body="Tivemos um problema a carregar a tua agenda. Verifica a ligação e tenta de novo."
        onRetry={c.retryLoad}
      />
    )
  }

  const todayDow = getDay(new Date())
  const todayEvents = c.events.filter(e => e.date === c.today).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const todayReminders = c.reminders.filter(r => r.active && r.days.includes(todayDow)).sort((a, b) => a.time.localeCompare(b.time))

  // ── células da grelha (mês ou semana) ──
  const gridDays = c.viewMode === 'month'
    ? eachDayOfInterval({
        start: startOfWeek(startOfMonth(c.current), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(c.current), { weekStartsOn: 0 }),
      })
    : (() => {
        // weekStart do controller é segunda-feira; alinhar com o cabeçalho D S T Q Q S S
        const start = startOfWeek(c.weekStart, { weekStartsOn: 0 })
        return eachDayOfInterval({ start, end: addDays(start, 6) })
      })()

  const monthLabel = (() => {
    const base = c.viewMode === 'month' ? c.current : c.weekStart
    const s = format(base, 'MMMM yyyy', { locale: pt })
    return s.charAt(0).toUpperCase() + s.slice(1)
  })()

  const selStatus = c.selected ? c.dayMap[c.selected] : undefined
  const selCheckinCount = c.selCheckins.length
  const canEditSel = !!c.selected && c.selected <= c.today

  async function handleCreate() {
    if (createOpen === 'evento') {
      if (!c.evTitle.trim()) return
      await c.saveEv()
    } else {
      if (!c.rmTitle.trim()) return
      await c.saveRm()
    }
    setCreateOpen(null)
  }

  return (
    <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: '#07070F', fontFamily: FONT }}>
      {c.toast && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: '#161825', border: '1px solid rgba(0,200,150,.38)', borderRadius: 12, padding: '10px 18px', fontSize: 13, color: '#00C896', zIndex: 10000, whiteSpace: 'nowrap' }}>
          ✓ {c.toast}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 6px' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>Calendário</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 2 }}>
            {c.currentStreak > 0 ? `🔥 ${c.currentStreak} dias de sequência` : 'Marca hábitos para criar sequência'}
          </div>
        </div>
        <button
          onClick={() => { c.setEvDate(c.today); setCreateOpen('evento') }}
          aria-label="Novo evento ou alerta"
          style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(245,200,66,0.14)', border: '1px solid rgba(245,200,66,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5C842', cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>

      {/* ── Navegação de mês/semana + toggle ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 0' }}>
        <button onClick={() => (c.viewMode === 'month' ? c.changeMonth(-1) : c.changeWeek(-1))} aria-label="Anterior" style={navArrow}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14.5, fontWeight: 800, color: '#fff' }}>{monthLabel}</div>
        <button onClick={() => (c.viewMode === 'month' ? c.changeMonth(1) : c.changeWeek(1))} aria-label="Seguinte" style={navArrow}>›</button>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: 3, gap: 3 }}>
          {(['month', 'week'] as const).map(m => (
            <button key={m} onClick={() => c.setViewMode(m)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: c.viewMode === m ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: c.viewMode === m ? '#F5C842' : 'rgba(255,255,255,0.3)', fontFamily: FONT,
            }}>{m === 'month' ? 'Mês' : 'Semana'}</button>
          ))}
        </div>
      </div>

      {/* ── Grelha ── */}
      <div role="grid" aria-label={`Calendário de ${monthLabel}`} style={{ margin: '10px 20px 0', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '12px 10px 10px' }}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
          {DAYS_MIN.map((d, i) => (
            <span key={i} role="columnheader" style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '.06em' }}>{d}</span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {gridDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const status = c.dayMap[dateStr]
            const inMonth = c.viewMode === 'week' || isSameMonth(day, c.current)
            const isTd = isToday(day)
            const isSel = c.selected === dateStr
            const dayEvents = c.events.filter(e => e.date === dateStr)
            const side = getStreakSide(dateStr, c.dayMap)
            return (
              <button
                key={dateStr}
                onClick={() => c.selectDay(dateStr)}
                aria-pressed={isSel}
                aria-label={[
                  `Dia ${format(day, 'd')}`,
                  isTd ? 'hoje' : null,
                  status?.complete ? 'dia completo' : status ? 'parcial' : null,
                  dayEvents.length ? `${dayEvents.length} evento${dayEvents.length === 1 ? '' : 's'}` : null,
                ].filter(Boolean).join(', ')}
                style={{
                  position: 'relative', height: c.viewMode === 'week' ? 56 : 46, borderRadius: 10, touchAction: 'manipulation',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  fontSize: 13, fontWeight: status?.complete ? 800 : 600, fontFamily: FONT,
                  background: hubHeat(status), border: 'none', cursor: 'pointer', padding: 0,
                  color: status?.complete ? '#04140E' : isTd ? '#F5C842' : inMonth ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)',
                  boxShadow: isSel ? 'inset 0 0 0 1.5px rgba(157,92,245,0.85)' : isTd ? 'inset 0 0 0 1.5px #F5C842' : 'none',
                }}
              >
                <span>{format(day, 'd')}</span>
                {dayEvents.length > 0 && (
                  <span style={{ display: 'flex', gap: 2.5 }}>
                    {dayEvents.slice(0, 3).map(e => (
                      <span key={e.id} style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: status?.complete ? '#04140E' : e.color, display: 'block' }} />
                    ))}
                  </span>
                )}
                {side && <span style={streakBarStyle(side)} />}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10, fontSize: 9.5, color: 'rgba(255,255,255,0.3)' }}>
          <span><i style={{ ...legendSwatch, background: 'rgba(0,200,150,0.85)' }} />completo</span>
          <span><i style={{ ...legendSwatch, background: 'rgba(0,200,150,0.30)' }} />parcial</span>
          <span><i style={{ ...legendSwatch, background: 'transparent', border: '1.5px solid #F5C842' }} />hoje</span>
          <span><i style={{ ...legendSwatch, background: '#9D5CF5', borderRadius: '50%' }} />evento</span>
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* ── Check-ins de hoje ── */}
        <div style={secLabel}>Check-ins de hoje</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['manha', 'tarde', 'noite'] as const).map(phase => {
            const done = c.todayCI.some(ci => ci.phase === phase)
            return (
              <button
                key={phase}
                onClick={() => { if (!done) { c.selectDay(c.today); c.setQuickPhase(phase) } }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 7, borderRadius: 13, padding: '10px 11px',
                  fontSize: 11.5, fontWeight: 700, fontFamily: FONT, cursor: done ? 'default' : 'pointer',
                  background: done ? 'rgba(0,200,150,0.08)' : 'rgba(255,255,255,0.03)',
                  border: done ? '1px solid rgba(0,200,150,0.25)' : '1px dashed rgba(255,255,255,0.14)',
                  color: done ? '#00C896' : 'rgba(255,255,255,0.4)',
                }}
              >
                <span style={{ fontSize: 15 }}>{PHASE_EMOJI[phase]}</span>
                {PHASE_LABELS[phase]}
              </button>
            )
          })}
        </div>

        {/* ── Hoje: eventos + alertas ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '20px 0 10px' }}>
          <span style={{ ...secLabel, margin: 0 }}>
            Hoje · {format(new Date(), 'EEE, d MMM', { locale: pt })}
          </span>
          <button onClick={() => setAlertsOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: '#F5C842', fontFamily: FONT, padding: 0 }}>
            Gerir alertas ›
          </button>
        </div>
        {todayEvents.length === 0 && todayReminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.10)', borderRadius: 16, fontSize: 12.5 }}>
            Nada agendado para hoje. Toca em + para criar.
          </div>
        ) : (
          <>
            {todayEvents.map(e => (
              <div key={e.id} style={{ ...timelineRow, borderLeft: `3px solid ${e.color}` }}>
                <span style={{ fontSize: 16 }}>📅</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflowWrap: 'anywhere' }}>{e.title}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                    {e.all_day ? 'Todo o dia' : e.time ? `${e.time.slice(0, 5)}${e.end_time ? ` – ${e.end_time.slice(0, 5)}` : ''}` : 'Sem hora'}
                  </div>
                </div>
                <span style={{ ...timelineTag, background: 'rgba(157,92,245,0.12)', color: '#9D5CF5' }}>evento</span>
              </div>
            ))}
            {todayReminders.map(r => (
              <div key={r.id} style={{ ...timelineRow, borderLeft: '3px solid #F5C842' }}>
                <span style={{ fontSize: 16 }}>🔔</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflowWrap: 'anywhere' }}>{r.title}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                    {r.time.slice(0, 5)} · {r.days.length === 7 ? 'todos os dias' : r.days.map(d => DAYS_SHORT[d].toLowerCase()).join(', ')}
                  </div>
                </div>
                <span style={{ ...timelineTag, background: 'rgba(245,200,66,0.12)', color: '#F5C842' }}>alerta</span>
              </div>
            ))}
          </>
        )}

        {/* ── Mentor: padrões semanais ── */}
        {c.insights.length > 0 && (
          <div style={{ marginTop: 14, background: 'rgba(0,200,150,0.05)', border: '1px solid rgba(0,200,150,0.15)', borderRadius: 14, padding: '12px 14px', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
            <b style={{ color: '#00C896' }}>Mentor:</b> {c.insights.slice(0, 2).join(' ')}
          </div>
        )}
      </div>

      {/* ── Sheet: detalhe do dia ── */}
      {c.selected && (
        <Sheet
          tall
          icon="📆"
          title={(() => { const s = format(parseLocalDate(c.selected), "EEE, d 'de' MMMM", { locale: pt }); return s.charAt(0).toUpperCase() + s.slice(1) })()}
          sub={selStatus?.complete ? 'dia completo' : selCheckinCount > 0 ? `${selCheckinCount} check-in${selCheckinCount === 1 ? '' : 's'}` : undefined}
          onClose={c.closeDay}
          footer={
            <button
              onClick={() => { c.setEvDate(c.selected!); setCreateOpen('evento') }}
              style={{ width: '100%', border: 'none', borderRadius: 15, padding: 15, fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', background: 'linear-gradient(135deg, #F5C842, #E0A82A)', color: '#1A1200' }}
            >
              ＋ Adicionar a este dia
            </button>
          }
        >
          {c.panelLoad ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>a carregar…</div>
          ) : (
            <>
              {/* Hábitos */}
              {c.selHabits.length > 0 && (
                <>
                  <label style={{ ...sheetLabel, marginTop: 12 }}>
                    Hábitos · {c.selHabits.filter(h => h.habit_logs?.[0]?.completed).length}/{c.selHabits.length}
                    {!canEditSel && <span style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.25)' }}>dia futuro</span>}
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {c.selHabits.map(h => {
                      const done = (h.habit_logs ?? []).length > 0 && h.habit_logs[0].completed
                      const meta = AREA_META[h.area as HabitArea]
                      return (
                        <button
                          key={h.id}
                          disabled={!canEditSel}
                          onClick={() => c.toggleRetroHabit(h.id, done, c.selected!)}
                          aria-label={`${done ? 'Desmarcar' : 'Marcar'} ${h.name}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 11, borderRadius: 13, padding: '10px 12px',
                            cursor: canEditSel ? 'pointer' : 'default', fontFamily: FONT, textAlign: 'left', width: '100%',
                            background: done ? 'rgba(0,200,150,0.05)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${done ? 'rgba(0,200,150,0.18)' : 'rgba(255,255,255,0.08)'}`,
                            opacity: canEditSel ? 1 : 0.5,
                          }}
                        >
                          <span style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${done ? '#00C896' : 'rgba(255,255,255,0.2)'}`,
                            background: done ? '#00C896' : 'transparent',
                            color: done ? '#001A10' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                          }}>✓</span>
                          <span style={{ fontSize: 14 }}>{meta?.icon}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: done ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)', textDecoration: done ? 'line-through' : 'none', textDecorationColor: 'rgba(255,255,255,0.2)' }}>{h.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Check-ins */}
              <label style={sheetLabel}>Check-ins</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['manha', 'tarde', 'noite'] as const).map(phase => {
                  const ci = c.selCheckins.find(x => x.phase === phase)
                  const active = c.quickPhase === phase
                  return (
                    <button
                      key={phase}
                      disabled={!!ci || !canEditSel}
                      onClick={() => c.setQuickPhase(active ? null : phase)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 13, padding: '10px 10px',
                        fontSize: 11.5, fontWeight: 700, fontFamily: FONT, cursor: ci || !canEditSel ? 'default' : 'pointer',
                        background: ci ? 'rgba(0,200,150,0.08)' : active ? 'rgba(245,200,66,0.10)' : 'rgba(255,255,255,0.03)',
                        border: ci ? '1px solid rgba(0,200,150,0.25)' : active ? '1px solid rgba(245,200,66,0.45)' : '1px dashed rgba(255,255,255,0.14)',
                        color: ci ? '#00C896' : active ? '#F5C842' : 'rgba(255,255,255,0.4)',
                        opacity: canEditSel || ci ? 1 : 0.5,
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{PHASE_EMOJI[phase]}</span>
                      {PHASE_LABELS[phase]}
                      {ci && <span style={{ marginLeft: 'auto', fontSize: 9.5, color: '#00C896' }}>✓</span>}
                    </button>
                  )
                })}
              </div>

              {/* Quick check-in */}
              {c.quickPhase && canEditSel && (
                <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 13, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 8 }}>Energia · {c.quickEnergy}/10</div>
                  <input type="range" min={1} max={10} value={c.quickEnergy} onChange={e => c.setQuickEnergy(+e.target.value)} style={{ width: '100%', accentColor: '#00D4C8' }} />
                  {c.quickPhase === 'manha' && (
                    <input value={c.quickMission} onChange={e => c.setQuickMission(e.target.value)} placeholder="O que queres conquistar hoje?" style={{ ...sheetInp, marginTop: 10, fontSize: 13 }} />
                  )}
                  {c.quickPhase === 'noite' && (
                    <input value={c.quickWin} onChange={e => c.setQuickWin(e.target.value)} placeholder="Algo que correu bem hoje…" style={{ ...sheetInp, marginTop: 10, fontSize: 13 }} />
                  )}
                  <button
                    onClick={c.doQuickCheckin}
                    disabled={c.quickSaving}
                    style={{ marginTop: 10, width: '100%', border: '1px solid rgba(0,200,150,0.4)', borderRadius: 12, padding: 12, fontFamily: FONT, fontWeight: 800, fontSize: 13, cursor: 'pointer', background: 'rgba(0,200,150,0.15)', color: '#00C896' }}
                  >
                    {c.quickSaving ? 'A guardar…' : `Guardar check-in da ${PHASE_LABELS[c.quickPhase].toLowerCase()}`}
                  </button>
                </div>
              )}

              {/* Agenda do dia */}
              <label style={sheetLabel}>Agenda</label>
              {c.selEvents.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.3)', padding: '4px 0 8px' }}>Sem eventos neste dia.</div>
              ) : (
                c.selEvents.map(e => (
                  <div key={e.id} style={{ ...timelineRow, borderLeft: `3px solid ${e.color}` }}>
                    <span style={{ fontSize: 16 }}>📅</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflowWrap: 'anywhere' }}>{e.title}</div>
                      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                        {e.all_day ? 'Todo o dia' : e.time ? `${e.time.slice(0, 5)}${e.end_time ? ` – ${e.end_time.slice(0, 5)}` : ''}` : 'Sem hora'}
                        {e.description ? ` · ${e.description}` : ''}
                      </div>
                    </div>
                    <button onClick={() => c.removeEvent(e.id)} aria-label={`Remover ${e.title}`} style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.2)', color: '#E24B4A', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
                  </div>
                ))
              )}
            </>
          )}
        </Sheet>
      )}

      {/* ── Sheet: gerir alertas ── */}
      {alertsOpen && (
        <Sheet
          icon="🔔"
          title="Alertas"
          sub={`${c.reminders.filter(r => r.active).length} ativos`}
          onClose={() => setAlertsOpen(false)}
          footer={
            <button
              onClick={() => { setAlertsOpen(false); setCreateOpen('alerta') }}
              style={{ width: '100%', border: 'none', borderRadius: 15, padding: 15, fontFamily: FONT, fontWeight: 800, fontSize: 15, cursor: 'pointer', background: 'linear-gradient(135deg, #F5C842, #E0A82A)', color: '#1A1200' }}
            >
              ＋ Novo alerta
            </button>
          }
        >
          {c.reminders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '26px 0', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
              Sem alertas. Cria o primeiro para receberes lembretes.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
              {c.reminders.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '11px 13px', opacity: r.active ? 1 : 0.5 }}>
                  <span style={{ fontSize: 16 }}>🔔</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflowWrap: 'anywhere' }}>{r.title}</div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                      {r.time.slice(0, 5)} · {r.days.length === 7 ? 'todos os dias' : r.days.map(d => DAYS_SHORT[d].toLowerCase()).join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={() => c.toggleRm(r.id, r.active)}
                    aria-label={r.active ? 'Desativar' : 'Ativar'}
                    style={{ width: 40, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0, border: 'none', cursor: 'pointer', background: r.active ? '#00D4C8' : 'rgba(255,255,255,0.1)' }}
                  >
                    <span style={{ position: 'absolute', top: 3, left: r.active ? 'auto' : 3, right: r.active ? 3 : 'auto', width: 18, height: 18, borderRadius: '50%', background: r.active ? '#07070F' : 'rgba(255,255,255,0.4)' }} />
                  </button>
                  <button onClick={() => c.removeRm(r.id)} aria-label={`Remover ${r.title}`} style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.2)', color: '#E24B4A', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </Sheet>
      )}

      {/* ── Sheet: criar evento ou alerta ── */}
      {createOpen && (
        <Sheet
          title="Novo"
          onClose={() => setCreateOpen(null)}
          footer={
            <button
              onClick={handleCreate}
              disabled={createOpen === 'evento' ? (c.evSaving || !c.evTitle.trim()) : (c.rmSaving || !c.rmTitle.trim())}
              style={{
                width: '100%', border: 'none', borderRadius: 15, padding: 15, fontFamily: FONT, fontWeight: 800, fontSize: 15,
                cursor: 'pointer',
                background: (createOpen === 'evento' ? c.evTitle.trim() : c.rmTitle.trim()) ? 'linear-gradient(135deg, #F5C842, #E0A82A)' : 'rgba(255,255,255,0.06)',
                color: (createOpen === 'evento' ? c.evTitle.trim() : c.rmTitle.trim()) ? '#1A1200' : 'rgba(255,255,255,0.35)',
              }}
            >
              {createOpen === 'evento' ? (c.evSaving ? 'A guardar…' : 'Criar evento') : (c.rmSaving ? 'A guardar…' : 'Criar alerta')}
            </button>
          }
        >
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {([['evento', '📅 Evento', '#9D5CF5'], ['alerta', '🔔 Alerta', '#F5C842']] as const).map(([k, l, col]) => (
              <button key={k} onClick={() => setCreateOpen(k)} style={{
                flex: 1, padding: '11px 0', borderRadius: 13, cursor: 'pointer', textAlign: 'center',
                fontFamily: FONT, fontWeight: 700, fontSize: 13,
                background: createOpen === k ? `${col}1A` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${createOpen === k ? `${col}80` : 'rgba(255,255,255,0.10)'}`,
                color: createOpen === k ? col : 'rgba(255,255,255,0.5)',
              }}>{l}</button>
            ))}
          </div>

          {createOpen === 'evento' ? (
            <>
              <label style={sheetLabel}>Título</label>
              <input value={c.evTitle} onChange={e => c.setEvTitle(e.target.value)} placeholder="Ex: Reunião de projeto" style={sheetInp} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={sheetLabel}>Data</label>
                  <input type="date" value={c.evDate} onChange={e => c.setEvDate(e.target.value)} style={sheetInp} />
                </div>
                <div>
                  <label style={sheetLabel}>Hora</label>
                  <input type="time" value={c.evTime} onChange={e => c.setEvTime(e.target.value)} disabled={c.evAllDay} style={{ ...sheetInp, opacity: c.evAllDay ? 0.4 : 1 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={sheetLabel}>Fim (opcional)</label>
                  <input type="time" value={c.evEndTime} onChange={e => c.setEvEndTime(e.target.value)} disabled={c.evAllDay} style={{ ...sheetInp, opacity: c.evAllDay ? 0.4 : 1 }} />
                </div>
                <div>
                  <label style={sheetLabel}>Todo o dia</label>
                  <button
                    onClick={() => c.setEvAllDay(!c.evAllDay)}
                    aria-pressed={c.evAllDay}
                    style={{ ...sheetInp, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: c.evAllDay ? '#F5C842' : 'rgba(255,255,255,0.5)' }}
                  >
                    {c.evAllDay ? 'Sim' : 'Não'}
                    <span style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', background: c.evAllDay ? '#F5C842' : 'rgba(255,255,255,0.1)', display: 'inline-block' }}>
                      <span style={{ position: 'absolute', top: 3, left: c.evAllDay ? 'auto' : 3, right: c.evAllDay ? 3 : 'auto', width: 16, height: 16, borderRadius: '50%', background: c.evAllDay ? '#0A0800' : 'rgba(255,255,255,0.4)' }} />
                    </span>
                  </button>
                </div>
              </div>

              <label style={sheetLabel}>Descrição (opcional)</label>
              <input value={c.evDesc} onChange={e => c.setEvDesc(e.target.value)} placeholder="Notas…" style={sheetInp} />

              <label style={sheetLabel}>Cor</label>
              <div style={{ display: 'flex', gap: 9 }}>
                {EVENT_COLORS.map(col => (
                  <button key={col} onClick={() => c.setEvColor(col)} aria-label={`Cor ${col}`} style={{
                    width: 30, height: 30, borderRadius: '50%', background: col, border: 'none', cursor: 'pointer',
                    boxShadow: c.evColor === col ? `0 0 0 2.5px #11131C, 0 0 0 4.5px ${col}` : 'none',
                  }} />
                ))}
              </div>

              <label style={sheetLabel}>Repetir</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['none', 'Não repete'], ['diario', 'Diário'], ['semanal', 'Semanal'], ['mensal', 'Mensal']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => c.setEvRecurrence(k)} style={{
                    flex: 1, padding: '10px 4px', borderRadius: 13, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: FONT,
                    background: c.evRecurrence === k ? 'rgba(245,200,66,0.10)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${c.evRecurrence === k ? 'rgba(245,200,66,0.45)' : 'rgba(255,255,255,0.10)'}`,
                    color: c.evRecurrence === k ? '#F5C842' : 'rgba(255,255,255,0.55)',
                  }}>{l}</button>
                ))}
              </div>
              {c.evRecurrence !== 'none' && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  {c.evRecurrence === 'diario' ? 'Cria o evento nos próximos 14 dias.' : c.evRecurrence === 'semanal' ? 'Cria o evento nas próximas 12 semanas.' : 'Cria o evento nos próximos 6 meses.'}
                </div>
              )}
            </>
          ) : (
            <>
              <label style={sheetLabel}>Título</label>
              <input value={c.rmTitle} onChange={e => c.setRmTitle(e.target.value)} placeholder="Ex: Treino de força" style={sheetInp} />

              <label style={sheetLabel}>Hora</label>
              <input type="time" value={c.rmTime} onChange={e => c.setRmTime(e.target.value)} style={sheetInp} />

              <label style={sheetLabel}>Dias da semana</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DAYS_MIN.map((d, index) => {
                  const on = c.rmDays.includes(index)
                  return (
                    <button
                      key={index}
                      onClick={() => c.setRmDays(on ? c.rmDays.filter(v => v !== index) : [...c.rmDays, index])}
                      aria-pressed={on}
                      aria-label={DAYS_SHORT[index]}
                      style={{
                        flex: 1, height: 38, borderRadius: 11, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: FONT,
                        background: on ? 'rgba(245,200,66,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${on ? 'rgba(245,200,66,0.5)' : 'rgba(255,255,255,0.10)'}`,
                        color: on ? '#F5C842' : 'rgba(255,255,255,0.4)',
                      }}
                    >{d}</button>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, background: 'rgba(245,200,66,0.05)', border: '1px solid rgba(245,200,66,0.18)', borderRadius: 13, padding: '11px 13px', fontSize: 11.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.55)' }}>
                💡 Recebes uma notificação à hora marcada, nos dias escolhidos.
              </div>
            </>
          )}
        </Sheet>
      )}

      <Nav />
    </main>
  )
}

const navArrow: CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)', fontSize: 18, cursor: 'pointer', fontFamily: FONT,
  touchAction: 'manipulation',
}

const secLabel: CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)', margin: '20px 0 10px',
}

const legendSwatch: CSSProperties = {
  width: 9, height: 9, borderRadius: 3, display: 'inline-block', marginRight: 4, verticalAlign: -1,
}

const timelineRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 11,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14, padding: '11px 13px', marginBottom: 7,
}

const timelineTag: CSSProperties = {
  fontSize: 9.5, fontWeight: 800, borderRadius: 7, padding: '3px 7px', flexShrink: 0,
}
