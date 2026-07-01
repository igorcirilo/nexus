'use client'
// src/app/checkin/page.tsx
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Nav from '@/components/Nav'
import FeedbackToast, { triggerToast } from '@/components/FeedbackToast'
import { requireUser, getProfile, saveCheckin, updateStreak, getCheckinsForDate } from '@/lib/supabase'
import type { Profile, CheckinPhase, ProgramTask } from '@/types'
import { getTasksForDate } from '@/lib/program'

type Phase = 'manha' | 'tarde' | 'noite'
const LABELS: Record<Phase, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const PHASE_EMOJI: Record<Phase, string> = { manha: '🌅', tarde: '☀️', noite: '🌙' }

function Pill({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button onClick={onSelect} style={{
      padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
      fontSize: 13, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
      background: selected ? 'var(--gold)' : 'var(--bg2)',
      color: selected ? 'var(--bg0)' : 'var(--text2)',
      fontWeight: selected ? 600 : 400,
    }}>{label}</button>
  )
}

function MoodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const moods = ['😔', '😐', '🙂', '😄', '🔥']
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '4px 0 20px' }}>
      {moods.map((e, i) => (
        <button key={e} onClick={() => onChange(i + 1)} style={{
          width: 52, height: 52, borderRadius: 16, border: 'none', cursor: 'pointer',
          fontSize: 22, transition: 'all .15s',
          background: value === i + 1 ? 'rgba(232,168,56,.12)' : 'var(--bg2)',
          outline: value === i + 1 ? '2px solid var(--gold)' : '0.5px solid var(--border)',
          transform: value === i + 1 ? 'scale(1.12)' : 'scale(1)',
        }}>{e}</button>
      ))}
    </div>
  )
}

function EnergySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const color = value <= 3 ? '#E24B4A' : value <= 6 ? 'var(--gold)' : 'var(--teal)'
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Esgotado</span>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 28, color }}>{value}<span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 400 }}>/10</span></span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Imparável</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  )
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 16, marginBottom: 12, lineHeight: 1.4, color: 'var(--text1)' }}>{label}</p>
      {children}
    </div>
  )
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
        borderRadius: 12, padding: '13px 14px', color: 'var(--text1)',
        fontFamily: 'DM Sans, sans-serif', fontSize: 14, resize: 'none', outline: 'none',
        lineHeight: 1.5,
      }}
    />
  )
}

export default function CheckinPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activePhase, setActivePhase] = useState<Phase>('manha')
  const [donePhases, setDonePhases] = useState<Set<Phase>>(new Set())
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  // Manhã
  const [sleep, setSleep] = useState('')
  const [energy, setEnergy] = useState(7)
  const [mood, setMood] = useState(3)
  const [mission, setMission] = useState('')
  const [willTrain, setWillTrain] = useState<boolean | null>(null)

  // Tarde
  const [progressOpt, setProgressOpt] = useState('')
  const [focusOpt, setFocusOpt] = useState('')
  const [nextAction, setNextAction] = useState('')

  // Noite
  const [missionDone, setMissionDone] = useState('')
  const [winOfDay, setWinOfDay] = useState('')
  const [reflection, setReflection] = useState('')
  const [moodNight, setMoodNight] = useState(3)
  const [nightTasks, setNightTasks] = useState<ProgramTask[]>([])

  useEffect(() => {
    requireUser().then(async (user) => {
      if (!user) return
      const [prof, checkins] = await Promise.all([
        getProfile(user.id),
        getCheckinsForDate(user.id, today),
      ])
      setProfile(prof)
      const todayTasks = await getTasksForDate(user.id, today)
      setNightTasks(todayTasks)
      const done = new Set(checkins.map((c: { phase: CheckinPhase }) => c.phase as Phase))
      setDonePhases(done)
      const manha = checkins.find((c: { phase: string; mission?: string }) => c.phase === 'manha')
      if (manha?.mission) setMission(manha.mission)
      // Fase activa por hora
      const h = new Date().getHours()
      if (!done.has('manha')) setActivePhase('manha')
      else if (!done.has('tarde') && h >= 12) setActivePhase('tarde')
      else if (!done.has('noite') && h >= 18) setActivePhase('noite')
      else setActivePhase(done.has('manha') ? (done.has('tarde') ? 'noite' : 'tarde') : 'manha')
    })
  }, [today])

  useEffect(() => { setStep(0) }, [activePhase])

  async function reset(phase: Phase) {
    if (!profile) return
    // Remove do set de concluídas para permitir re-fazer
    setDonePhases(p => { const n = new Set(Array.from(p)); n.delete(phase); return n })
    setStep(0)
  }

  async function finish(phase: Phase) {
    if (!profile || submitting) return
    setSubmitting(true)

    const payload: Record<string, unknown> = {
      user_id: profile.id, date: today, phase,
    }
    if (phase === 'manha') Object.assign(payload, {
      sleep_hours: sleep === 'Menos de 5h' ? 4.5 : sleep === '5–6h' ? 5.5 : sleep === '7–8h' ? 7.5 : 9,
      energy, mood, mission, will_train: willTrain,
    })
    if (phase === 'tarde') Object.assign(payload, {
      progress_pct: progressOpt === 'Quase tudo' ? 90 : progressOpt === 'Metade' ? 50 : progressOpt === 'Pouco' ? 25 : 5,
      focus_level: focusOpt, next_action: nextAction,
    })
    if (phase === 'noite') Object.assign(payload, {
      mission_done: missionDone, win_of_day: winOfDay,
      reflection, mood: moodNight,
    })

    const { error: saveError } = await saveCheckin(payload)
    if (saveError) {
      // Não marca a fase como concluída se a gravação falhar (P2.8).
      triggerToast('Não foi possível guardar o check-in. Tenta de novo.')
      setSubmitting(false)
      return
    }
    // Qualquer check-in conta para a ofensiva do dia (constrói consistência).
    await updateStreak(profile.id)
    triggerToast(`Check-in ${LABELS[phase].toLowerCase()} registado`)
    setDonePhases(p => new Set(Array.from(p).concat(phase)))
    setSubmitting(false)
  }

  function StepDots({ total, current }: { total: number; current: number }) {
    return (
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            style={{
              flex: 1, height: 3, borderRadius: 100, border: 'none', cursor: i < current ? 'pointer' : 'default',
              background: i < current ? 'var(--gold)' : i === current ? 'rgba(232,168,56,.4)' : 'var(--bg3)',
              transition: 'background .3s',
            }}
          />
        ))}
      </div>
    )
  }

  const isDone = donePhases.has(activePhase)

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      <FeedbackToast />

      {/* Phase tabs */}
      <div style={{ padding: '24px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 16 }}>Check-in</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['manha', 'tarde', 'noite'] as Phase[]).map(p => {
            const done = donePhases.has(p)
            const active = activePhase === p
            return (
              <button
                key={p}
                onClick={() => setActivePhase(p)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: active ? 'rgba(232,168,56,.08)' : done ? 'rgba(30,203,180,.05)' : 'var(--bg2)',
                  outline: active ? '1.5px solid var(--gold)' : done ? '0.5px solid rgba(30,203,180,.3)' : '0.5px solid var(--border)',
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: 18 }}>{PHASE_EMOJI[p]}</span>
                <span style={{
                  fontSize: 11, fontFamily: 'Syne, sans-serif', fontWeight: 600,
                  color: active ? 'var(--gold)' : done ? 'var(--teal)' : 'var(--text3)',
                }}>
                  {LABELS[p]}{done ? ' ✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>

        {/* ── Fase concluída ── */}
        {isDone && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>{PHASE_EMOJI[activePhase]}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
              {LABELS[activePhase]} concluída!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28 }}>
              Ofensiva mantida. Volta amanhã para não quebrar.
            </div>
            <button
              onClick={() => reset(activePhase)}
              style={{
                background: 'transparent', border: '0.5px solid var(--border)',
                borderRadius: 12, padding: '11px 20px', cursor: 'pointer',
                fontSize: 13, color: 'var(--text2)', fontFamily: 'DM Sans, sans-serif',
                marginBottom: 12, width: '100%',
              }}
            >
              ↩ Corrigir respostas desta fase
            </button>
            {activePhase !== 'noite' && (
              <button
                onClick={() => setActivePhase(activePhase === 'manha' ? 'tarde' : 'noite')}
                style={{
                  width: '100%', background: 'var(--gold)', color: 'var(--on-bright)',
                  border: 'none', borderRadius: 14, padding: 14,
                  fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                {activePhase === 'manha' ? 'Ir para Tarde →' : 'Ir para Noite →'}
              </button>
            )}
            {activePhase === 'noite' && donePhases.size === 3 && (
              <div style={{ background: 'rgba(232,168,56,.08)', border: '0.5px solid rgba(232,168,56,.22)', borderRadius: 14, padding: 16, marginTop: 8 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--gold)', marginBottom: 4 }}>🔥 Dia completo!</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>Todos os check-ins feitos. Streak actualizado.</div>
              </div>
            )}
          </div>
        )}

        {/* ── MANHÃ ── */}
        {!isDone && activePhase === 'manha' && (
          <>
            <StepDots total={4} current={step} />
            {step === 0 && (
              <Question label="Quantas horas dormiste esta noite?">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Menos de 5h', '5–6h', '7–8h', '8h+'].map(o => (
                    <Pill key={o} label={o} selected={sleep === o} onSelect={() => setSleep(o)} />
                  ))}
                </div>
                <button
                  disabled={!sleep}
                  onClick={() => setStep(1)}
                  style={{
                    width: '100%', marginTop: 24, background: sleep ? 'var(--gold)' : 'var(--bg3)',
                    color: sleep ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14,
                    padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
                    cursor: sleep ? 'pointer' : 'not-allowed', transition: 'all .2s',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 1 && (
              <Question label="Como está a tua energia agora?">
                <EnergySlider value={energy} onChange={setEnergy} />
                <button
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
                    borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 2 && (
              <Question label="Qual é a tua missão principal hoje?">
                <TextArea value={mission} onChange={setMission} placeholder="A 1 coisa que não podes deixar por fazer hoje..." />
                <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 20 }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)', alignSelf: 'center' }}>Vais treinar hoje?</span>
                  {[true, false].map(v => (
                    <button
                      key={String(v)}
                      onClick={() => setWillTrain(v)}
                      style={{
                        padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
                        background: willTrain === v ? 'var(--gold)' : 'var(--bg2)',
                        color: willTrain === v ? 'var(--bg0)' : 'var(--text2)',
                      }}
                    >
                      {v ? 'Sim 💪' : 'Não'}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!mission.trim()}
                  onClick={() => setStep(3)}
                  style={{
                    width: '100%', background: mission.trim() ? 'var(--gold)' : 'var(--bg3)',
                    color: mission.trim() ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14,
                    padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
                    cursor: mission.trim() ? 'pointer' : 'not-allowed', transition: 'all .2s',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 3 && (
              <Question label="Como estás emocionalmente?">
                <MoodPicker value={mood} onChange={setMood} />
                <button
                  disabled={submitting}
                  onClick={() => finish('manha')}
                  style={{
                    width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
                    borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {submitting ? 'A guardar…' : 'Concluir Manhã ✓'}
                </button>
              </Question>
            )}
          </>
        )}

        {/* ── TARDE ── */}
        {!isDone && activePhase === 'tarde' && (
          <>
            <StepDots total={3} current={step} />
            {mission && (
              <div style={{ background: 'rgba(127,119,221,.07)', border: '0.5px solid rgba(127,119,221,.18)', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Missão prometida esta manhã</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic' }}>&quot;{mission}&quot;</div>
              </div>
            )}
            {step === 0 && (
              <Question label="O que já avançaste na missão?">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Nada ainda', 'Pouco', 'Metade', 'Quase tudo'].map(o => (
                    <Pill key={o} label={o} selected={progressOpt === o} onSelect={() => setProgressOpt(o)} />
                  ))}
                </div>
                <button
                  disabled={!progressOpt}
                  onClick={() => setStep(1)}
                  style={{
                    width: '100%', marginTop: 24, background: progressOpt ? 'var(--gold)' : 'var(--bg3)',
                    color: progressOpt ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14,
                    padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
                    cursor: progressOpt ? 'pointer' : 'not-allowed',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 1 && (
              <Question label="Estás focado ou disperso agora?">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['Muito focado', 'Razoável', 'Disperso', 'Esgotado'].map(o => (
                    <Pill key={o} label={o} selected={focusOpt === o} onSelect={() => setFocusOpt(o)} />
                  ))}
                </div>
                <button
                  disabled={!focusOpt}
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%', marginTop: 24, background: focusOpt ? 'var(--gold)' : 'var(--bg3)',
                    color: focusOpt ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14,
                    padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
                    cursor: focusOpt ? 'pointer' : 'not-allowed',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 2 && (
              <Question label="Qual é o próximo passo imediato?">
                <TextArea value={nextAction} onChange={setNextAction} placeholder="Uma acção concreta e específica para agora..." />
                <button
                  disabled={submitting}
                  onClick={() => finish('tarde')}
                  style={{
                    width: '100%', marginTop: 14, background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
                    borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {submitting ? 'A guardar…' : 'Concluir Tarde ✓'}
                </button>
              </Question>
            )}
          </>
        )}

        {/* ── NOITE ── */}
        {!isDone && activePhase === 'noite' && (
          <>
            <StepDots total={nightTasks.length > 0 ? 4 : 3} current={step} />
            {mission && (
              <div style={{ background: 'rgba(127,119,221,.07)', border: '0.5px solid rgba(127,119,221,.18)', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Missão do dia — cumpriste?</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic' }}>&quot;{mission}&quot;</div>
              </div>
            )}
            {step === 0 && (
              <Question label="Como foi a execução da tua missão?">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['Sim, completamente ✓', 'Em grande parte', 'Parcialmente', 'Não consegui hoje'].map(o => (
                    <button
                      key={o}
                      onClick={() => setMissionDone(o)}
                      style={{
                        padding: '13px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        fontSize: 14, fontFamily: 'DM Sans, sans-serif', textAlign: 'left', transition: 'all .15s',
                        background: missionDone === o ? 'rgba(232,168,56,.08)' : 'var(--bg2)',
                        color: missionDone === o ? 'var(--gold)' : 'var(--text2)',
                        outline: missionDone === o ? '0.5px solid var(--gold)' : '0.5px solid var(--border)',
                      }}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                <button
                  disabled={!missionDone}
                  onClick={() => setStep(1)}
                  style={{
                    width: '100%', marginTop: 20, background: missionDone ? 'var(--gold)' : 'var(--bg3)',
                    color: missionDone ? 'var(--bg0)' : 'var(--text3)', border: 'none', borderRadius: 14,
                    padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14,
                    cursor: missionDone ? 'pointer' : 'not-allowed',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 1 && (
              <Question label="Qual foi a tua maior vitória hoje?">
                <TextArea value={winOfDay} onChange={setWinOfDay} placeholder="Mesmo pequena — o que correu bem..." />
                <button
                  onClick={() => setStep(2)}
                  style={{
                    width: '100%', marginTop: 14, background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
                    borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Próxima →
                </button>
              </Question>
            )}
            {step === 2 && (
              <Question label="Como te sentiste hoje?">
                <MoodPicker value={moodNight} onChange={setMoodNight} />
                <Question label="Reflexão do dia (opcional)">
                  <TextArea value={reflection} onChange={setReflection} placeholder="O que aprendeste hoje..." />
                </Question>
                <button
                  disabled={submitting}
                  onClick={() => nightTasks.length > 0 ? setStep(3) : finish('noite')}
                  style={{
                    width: '100%', background: 'var(--gold)', color: 'var(--on-bright)', border: 'none',
                    borderRadius: 14, padding: 14, fontFamily: 'Syne, sans-serif', fontWeight: 700,
                    fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {submitting ? 'A guardar…' : nightTasks.length > 0 ? 'Próxima →' : 'Fechar o Dia ✓'}
                </button>
              </Question>
            )}
            {step === 3 && (() => {
              const doneTasks = nightTasks.filter(t => t.status === 'completed')
              const skipped = nightTasks.filter(t => t.status === 'skipped')
              const pending = nightTasks.filter(t => t.status === 'pending')
              return (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 6 }}>
                      Check-in noturno
                    </p>
                    <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 26, color: 'var(--text1)', lineHeight: 1.1 }}>
                      Tasks do dia
                    </h2>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                    padding: '18px 16px', background: 'var(--bg2)',
                    border: '0.5px solid var(--border)', borderRadius: 16, marginBottom: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--teal)', lineHeight: 1 }}>{doneTasks.length}</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5, color: 'var(--text3)' }}>Feitas</div>
                    </div>
                    <div style={{ width: '0.5px', height: 36, background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>{skipped.length}</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5, color: 'var(--text3)' }}>Puladas</div>
                    </div>
                    <div style={{ width: '0.5px', height: 36, background: 'var(--border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 800, color: 'var(--bg3)', lineHeight: 1 }}>{pending.length}</div>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.8px', marginTop: 5, color: 'var(--text3)' }}>Pendentes</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                    {nightTasks.map(task => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14,
                          background: task.status === 'completed' ? 'rgba(30,203,180,.04)' : 'var(--bg2)',
                          border: `0.5px solid ${task.status === 'completed' ? 'rgba(30,203,180,.2)' : 'var(--border)'}`,
                          opacity: task.status === 'pending' ? 0.35 : task.status === 'skipped' ? 0.5 : 1,
                        }}
                      >
                        {task.status === 'completed' && <span style={{ color: 'var(--teal)', fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>✓</span>}
                        {task.status === 'skipped' && <span style={{ fontSize: 10, fontWeight: 600, color: '#666', background: 'var(--bg3)', padding: '3px 7px', borderRadius: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>pulado</span>}
                        {task.status === 'pending' && <span style={{ color: 'var(--text3)', fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' }}>○</span>}
                        <span style={{
                          flex: 1, fontSize: 14, fontWeight: 500,
                          color: task.status === 'completed' ? 'var(--text3)' : 'var(--text2)',
                          textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        }}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {doneTasks.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: 14, background: 'rgba(30,203,180,.06)',
                      border: '0.5px solid rgba(30,203,180,.18)', borderRadius: 14, marginBottom: 12 }}>
                      <span style={{ fontSize: 18 }}>✓</span>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--teal)' }}>
                        {doneTasks.length} {doneTasks.length === 1 ? 'task concluída' : 'tasks concluídas'} hoje
                      </span>
                    </div>
                  )}

                  <button
                    disabled={submitting}
                    onClick={() => finish('noite')}
                    style={{
                      width: '100%', padding: 17, background: 'var(--accent)', color: 'var(--on-accent)', border: 'none',
                      borderRadius: 16, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                    }}
                  >
                    {submitting ? 'A guardar…' : 'Fechar o Dia 🌙'}
                  </button>
                </div>
              )
            })()}
          </>
        )}
      </div>

      <Nav />
    </main>
  )
}
