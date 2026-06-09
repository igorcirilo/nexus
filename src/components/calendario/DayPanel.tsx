'use client'

import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import Icon from '@/components/ui/Icon'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { AREA_META } from '@/types'
import {
  inputStyle,
  PHASE_ICONS,
  PHASE_LABELS,
  PHASE_XP,
  type AgendaEvent,
  type Checkin,
  type DayStatus,
  type HabitRow,
} from '@/components/calendario/types'

interface DayPanelProps {
  dateStr: string
  today: string
  dayMap: Record<string, DayStatus>
  selCheckins: Checkin[]
  selEvents: AgendaEvent[]
  selHabits: HabitRow[]
  panelLoad: boolean
  quickPhase: string | null
  quickEnergy: number
  quickMission: string
  quickWin: string
  quickSaving: boolean
  onQuickPhaseChange: (phase: string | null) => void
  onQuickEnergyChange: (energy: number) => void
  onQuickMissionChange: (mission: string) => void
  onQuickWinChange: (win: string) => void
  onQuickCheckin: () => void | Promise<void>
  onToggleRetroHabit: (habitId: string, currentDone: boolean, dateStr: string) => void | Promise<void>
  onRemoveEvent: (id: string) => void | Promise<void>
  onNewEventInDay: (dateStr: string) => void
}

export default function DayPanel({
  dateStr,
  today,
  dayMap,
  selCheckins,
  selEvents,
  selHabits,
  panelLoad,
  quickPhase,
  quickEnergy,
  quickMission,
  quickWin,
  quickSaving,
  onQuickPhaseChange,
  onQuickEnergyChange,
  onQuickMissionChange,
  onQuickWinChange,
  onQuickCheckin,
  onToggleRetroHabit,
  onRemoveEvent,
  onNewEventInDay,
}: DayPanelProps) {
  const isPast = dateStr < today
  const isTodayDate = dateStr === today
  const totalXP = selCheckins.reduce((sum, checkin) => sum + (checkin.xp_earned ?? 0), 0)
  const status = dayMap[dateStr]
  const hasData = selCheckins.length > 0 || selHabits.length > 0 || selEvents.length > 0
  const donePhases = selCheckins.map(checkin => checkin.phase)
  const missingPhases = (['manha', 'tarde', 'noite'] as const).filter(phase => !donePhases.includes(phase))

  return (
    <div style={{ paddingTop: 14, marginTop: 14, borderTop: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text1)', lineHeight: 1.3 }}>
            {format(new Date(`${dateStr}T12:00:00`), "EEEE, d 'de' MMMM", { locale: pt })}
          </div>
          {isPast && !isTodayDate && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ background: 'rgba(127,119,221,.15)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 5, fontSize: 9, fontWeight: 600 }}>
                RETRO
              </span>
              clica nos hábitos para marcar (sem XP)
            </div>
          )}
        </div>
        {totalXP > 0 && (
          <div style={{ background: 'rgba(232,168,56,.12)', border: '0.5px solid rgba(232,168,56,.3)', borderRadius: 10, padding: '4px 10px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--gold)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            +{totalXP} XP
          </div>
        )}
      </div>

      {panelLoad ? (
        <SkeletonRow count={3} />
      ) : (
        <>
          {isTodayDate && missingPhases.length > 0 && (
            <div style={{ marginBottom: 14, padding: 12, borderRadius: 14, background: 'rgba(30,203,180,.05)', border: '0.5px solid rgba(30,203,180,.18)' }}>
              <div style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 9 }}>CHECK-IN RÁPIDO</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: quickPhase ? 12 : 0 }}>
                {missingPhases.map(phase => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => onQuickPhaseChange(quickPhase === phase ? null : phase)}
                    aria-pressed={quickPhase === phase}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '9px 6px',
                      borderRadius: 11,
                      border: 'none',
                      cursor: 'pointer',
                      background: quickPhase === phase ? 'rgba(30,203,180,.18)' : 'var(--bg3)',
                      outline: quickPhase === phase ? '1.5px solid var(--teal)' : '0.5px solid var(--border)',
                      transition: 'all .15s',
                      touchAction: 'manipulation',
                    }}
                  >
                    <Icon name={PHASE_ICONS[phase]} size={15} color={quickPhase === phase ? 'var(--teal)' : 'var(--text2)'} />
                    <span style={{ fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 600, color: quickPhase === phase ? 'var(--teal)' : 'var(--text2)' }}>
                      {PHASE_LABELS[phase]}
                    </span>
                  </button>
                ))}
              </div>

              {quickPhase && (
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Energia · {quickEnergy}/10</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onQuickEnergyChange(value)}
                          aria-label={`Energia ${value} de 10`}
                          style={{
                            flex: 1,
                            minHeight: 34,
                            padding: '6px 0',
                            borderRadius: 7,
                            border: 'none',
                            cursor: 'pointer',
                            background: value <= quickEnergy ? 'var(--teal)' : 'var(--bg3)',
                            fontSize: 10,
                            color: value <= quickEnergy ? 'var(--bg0)' : 'var(--text3)',
                            fontFamily: 'Syne, sans-serif',
                            fontWeight: 700,
                            transition: 'all .1s',
                            touchAction: 'manipulation',
                          }}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  {quickPhase === 'manha' && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Intenção do dia (opcional)</div>
                      <input value={quickMission} onChange={event => onQuickMissionChange(event.target.value)} placeholder="O que queres conquistar hoje?" style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} />
                    </div>
                  )}
                  {quickPhase === 'noite' && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>Vitória do dia (opcional)</div>
                      <input value={quickWin} onChange={event => onQuickWinChange(event.target.value)} placeholder="Algo que correu bem hoje…" style={{ ...inputStyle, fontSize: 13, padding: '9px 12px' }} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={onQuickCheckin}
                    disabled={quickSaving}
                    style={{
                      width: '100%',
                      minHeight: 44,
                      padding: '10px',
                      borderRadius: 11,
                      border: 'none',
                      cursor: 'pointer',
                      background: 'var(--teal)',
                      color: 'var(--bg0)',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 700,
                      fontSize: 13,
                      opacity: quickSaving ? 0.7 : 1,
                      touchAction: 'manipulation',
                    }}
                  >
                    {quickSaving ? 'A guardar…' : `Guardar check-in da ${PHASE_LABELS[quickPhase]} +${PHASE_XP[quickPhase]} XP`}
                  </button>
                </div>
              )}
            </div>
          )}

          {selHabits.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.06em' }}>HÁBITOS</span>
                {status && status.total > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>
                    {status.habits}/{status.total}
                  </span>
                )}
              </div>
              {status && status.total > 0 && (
                <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 4, marginBottom: 9 }}>
                  <div style={{ height: '100%', borderRadius: 100, background: 'var(--teal)', width: `${Math.round((status.habits / status.total) * 100)}%`, transition: 'width .4s' }} />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {selHabits.map(habit => {
                  const done = (habit.habit_logs ?? []).length > 0 && habit.habit_logs[0].completed
                  const meta = AREA_META[habit.area] ?? { color: 'var(--teal)' }
                  const canEdit = isPast && !isTodayDate
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      onClick={canEdit ? () => onToggleRetroHabit(habit.id, done, dateStr) : undefined}
                      disabled={!canEdit}
                      aria-label={`${done ? 'Desmarcar' : 'Marcar'} hábito ${habit.name} em ${dateStr}`}
                      style={{
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 11,
                        background: done ? 'rgba(30,203,180,.07)' : 'var(--bg3)',
                        border: done ? '0.5px solid rgba(30,203,180,.22)' : '0.5px solid transparent',
                        cursor: canEdit ? 'pointer' : 'default',
                        transition: 'all .15s',
                        userSelect: 'none',
                        color: 'inherit',
                        textAlign: 'left',
                        touchAction: 'manipulation',
                        opacity: 1,
                      }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--teal)' : 'transparent', border: done ? 'none' : '1.5px solid var(--text3)', transition: 'all .15s' }}>
                        {done && <Icon name="check" size={12} color="var(--bg0)" />}
                      </span>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: done ? 'var(--text1)' : 'var(--text2)', fontWeight: done ? 500 : 400 }}>{habit.name}</span>
                      {canEdit && <span style={{ fontSize: 10, color: 'var(--text3)', opacity: .7 }}>{done ? 'desfazer' : 'marcar'}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selCheckins.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 7 }}>CHECK-INS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selCheckins.map((checkin, index) => (
                  <div key={`${checkin.phase}-${index}`} style={{ padding: '10px 12px', borderRadius: 11, background: 'var(--bg3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: (checkin.energy || checkin.mission || checkin.win_of_day) ? 5 : 0 }}>
                      <Icon name={PHASE_ICONS[checkin.phase] ?? 'clock'} size={15} color="var(--text2)" />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>{PHASE_LABELS[checkin.phase] ?? checkin.phase}</span>
                      <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>+{checkin.xp_earned} XP</span>
                    </div>
                    {(checkin.energy || checkin.sleep_hours || checkin.mood) && (
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                        {checkin.energy && <span>Energia {checkin.energy}/10</span>}
                        {checkin.sleep_hours && <span>Sono {checkin.sleep_hours}h</span>}
                        {checkin.mood && <span>Humor {checkin.mood}/10</span>}
                      </div>
                    )}
                    {checkin.mission && checkin.phase === 'manha' && <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', marginTop: 4 }}>&ldquo;{checkin.mission}&rdquo;</div>}
                    {checkin.win_of_day && (
                      <div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="trophy" size={13} color="var(--teal)" />
                        {checkin.win_of_day}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selEvents.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, letterSpacing: '.06em', marginBottom: 7 }}>EVENTOS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {selEvents.map(event => (
                  <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 11, background: 'var(--bg3)' }}>
                    <div style={{ width: 3, height: 34, borderRadius: 2, background: event.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 500 }}>{event.title}</div>
                      {!event.all_day && event.time && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{event.time.slice(0, 5)}{event.end_time ? ` – ${event.end_time.slice(0, 5)}` : ''}</div>}
                      {event.all_day && <div style={{ fontSize: 11, color: 'var(--text3)' }}>Dia inteiro</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveEvent(event.id)}
                      aria-label={`Remover evento ${event.title}`}
                      style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg2)', border: 'none', cursor: 'pointer', color: 'var(--text3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasData && !isTodayDate && (
            <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text3)' }}>Sem registos neste dia.</div>
          )}
          <button
            type="button"
            onClick={() => onNewEventInDay(dateStr)}
            style={{ width: '100%', minHeight: 44, marginTop: 4, padding: '9px', border: '0.5px solid rgba(30,203,180,.28)', borderRadius: 11, background: 'rgba(30,203,180,.06)', color: 'var(--teal)', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 12, touchAction: 'manipulation' }}
          >
            + Evento neste dia
          </button>
        </>
      )}
    </div>
  )
}
