'use client'
// src/app/checkin/page.tsx
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Nav from '@/components/Nav'
import XPToast, { triggerXP } from '@/components/XPToast'
import { supabase, getProfile, saveCheckin, addXP, updateStreak, getCheckinsForDate } from '@/lib/supabase'
import type { Profile, CheckinPhase } from '@/types'

type Phase = 'manha' | 'tarde' | 'noite'

const PHASE_LABELS: Record<Phase, string> = {
  manha: 'Manhã', tarde: 'Tarde', noite: 'Noite',
}
const PHASE_XP: Record<Phase, number> = {
  manha: 80, tarde: 60, noite: 100,
}

export default function CheckinPage() {
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [activePhase, setActivePhase] = useState<Phase>('manha')
  const [donePhases, setDonePhases]   = useState<Set<Phase>>(new Set())
  const [step, setStep]               = useState(0)
  const [mission, setMission]         = useState('')

  // Manhã
  const [sleep, setSleep]         = useState('')
  const [energy, setEnergy]       = useState(7)
  const [mood, setMood]           = useState(3)

  // Tarde
  const [progressOpt, setProgressOpt] = useState('')
  const [focusOpt, setFocusOpt]       = useState('')
  const [nextAction, setNextAction]   = useState('')

  // Noite
  const [missionDone, setMissionDone] = useState('')
  const [winOfDay, setWinOfDay]       = useState('')
  const [reflection, setReflection]   = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      const [prof, checkins] = await Promise.all([
        getProfile(user.id),
        getCheckinsForDate(user.id, today),
      ])
      setProfile(prof)
      const done = new Set(checkins.map((c: { phase: CheckinPhase }) => c.phase as Phase))
      setDonePhases(done)
      // Pré-preencher missão do check-in da manhã
      const manha = checkins.find((c: { phase: string }) => c.phase === 'manha')
      if (manha?.mission) setMission(manha.mission)
      // Selecionar fase activa automaticamente
      const hour = new Date().getHours()
      if (!done.has('manha')) setActivePhase('manha')
      else if (!done.has('tarde') && hour >= 12) setActivePhase('tarde')
      else if (!done.has('noite') && hour >= 18) setActivePhase('noite')
      else setActivePhase('tarde')
    }
    load()
  }, [today])

  useEffect(() => { setStep(0) }, [activePhase])

  async function finishPhase(phase: Phase) {
    if (!profile) return
    const xp = PHASE_XP[phase]
    const payload: Record<string, unknown> = {
      user_id: profile.id, date: today, phase, xp_earned: xp,
    }
    if (phase === 'manha') Object.assign(payload, {
      sleep_hours: parseFloat(sleep) || null,
      energy, mood, mission,
    })
    if (phase === 'tarde') Object.assign(payload, {
      progress_pct: progressOpt === 'Quase tudo' ? 90 : progressOpt === 'Metade — 50%' ? 50 : progressOpt === 'Pouco — 25%' ? 25 : 5,
      focus_level: focusOpt,
      next_action: nextAction,
    })
    if (phase === 'noite') Object.assign(payload, {
      mission_done: missionDone,
      win_of_day: winOfDay,
      reflection,
    })

    await saveCheckin(payload)
    await addXP(profile.id, xp)
    if (phase === 'noite') await updateStreak(profile.id)
    triggerXP(xp, `Check-in ${PHASE_LABELS[phase].toLowerCase()} completo!`)
    setDonePhases(p => new Set([...p, phase]))
    // Avança automaticamente para a próxima fase
    if (phase === 'manha') setActivePhase('tarde')
    else if (phase === 'tarde') setActivePhase('noite')
  }

  function Dots({ total, current }: { total: number; current: number }) {
    return (
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full transition-all duration-300"
               style={{ background: i < current ? 'var(--gold)' : i === current ? 'rgba(232,168,56,.35)' : 'var(--bg3)' }} />
        ))}
      </div>
    )
  }

  function Option({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
    return (
      <button onClick={onSelect}
        className="px-3.5 py-2.5 rounded-xl text-[13px] transition-all"
        style={{
          border: selected ? '0.5px solid var(--gold)' : '0.5px solid var(--border)',
          background: selected ? 'rgba(232,168,56,.08)' : 'var(--bg2)',
          color: selected ? 'var(--gold)' : 'var(--text2)',
        }}>
        {label}
      </button>
    )
  }

  return (
    <main className="animate-in pb-28">
      <XPToast />

      {/* Phase selector */}
      <div className="flex gap-2 px-5 pt-6 pb-2">
        {(['manha', 'tarde', 'noite'] as Phase[]).map(p => (
          <button key={p} onClick={() => setActivePhase(p)}
            className="flex-1 py-2.5 rounded-xl text-[12px] font-dm transition-all"
            style={{
              border: activePhase === p ? '0.5px solid var(--gold)' : donePhases.has(p) ? '0.5px solid rgba(30,203,180,.3)' : '0.5px solid var(--border)',
              background: activePhase === p ? 'rgba(232,168,56,.07)' : donePhases.has(p) ? 'rgba(30,203,180,.05)' : 'var(--bg2)',
              color: activePhase === p ? 'var(--gold)' : donePhases.has(p) ? 'var(--teal)' : 'var(--text3)',
            }}>
            {PHASE_LABELS[p]}{donePhases.has(p) ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {/* ── MANHÃ ────────────────────────────── */}
      {activePhase === 'manha' && !donePhases.has('manha') && (
        <div className="px-5 pt-4">
          <div className="chip-gold mb-1.5">Check-in da Manhã</div>
          <Dots total={3} current={step} />

          {step === 0 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Quantas horas dormiste?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Menos de 5h', '5–6h', '7–8h', '8h+'].map(o => (
                  <Option key={o} label={o} selected={sleep === o} onSelect={() => setSleep(o)} />
                ))}
              </div>
              <button className="btn-primary" onClick={() => setStep(1)}>Próxima →</button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Qual é a tua missão principal hoje?</h2>
              <textarea value={mission} onChange={e => setMission(e.target.value)}
                placeholder="A 1 coisa que não podes deixar por fazer..."
                className="w-full rounded-xl p-4 text-[14px] mb-6 resize-none h-24"
                style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit', outline: 'none' }} />
              <button className="btn-primary" onClick={() => setStep(2)}>Próxima →</button>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-2 leading-snug">Como estás emocionalmente?</h2>
              <div className="flex gap-2 justify-center my-5">
                {['😔', '😐', '🙂', '😄', '🔥'].map((e, i) => (
                  <button key={e} onClick={() => setMood(i + 1)}
                    className="w-12 h-12 rounded-2xl text-xl transition-all"
                    style={{
                      border: mood === i + 1 ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                      background: mood === i + 1 ? 'rgba(232,168,56,.08)' : 'var(--bg2)',
                      transform: mood === i + 1 ? 'scale(1.12)' : 'scale(1)',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="mb-6">
                <label className="text-[12px] text-text-3 block mb-2">Energia agora: <strong className="font-syne text-teal text-[16px]">{energy}/10</strong></label>
                <input type="range" min={1} max={10} value={energy}
                  onChange={e => setEnergy(+e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--gold)' }} />
                <div className="flex justify-between text-[11px] text-text-3 mt-1">
                  <span>Esgotado</span><span>Imparável</span>
                </div>
              </div>
              <button className="btn-primary" onClick={() => finishPhase('manha')}>Concluir Manhã ✓</button>
            </>
          )}
        </div>
      )}

      {/* ── TARDE ────────────────────────────── */}
      {activePhase === 'tarde' && !donePhases.has('tarde') && (
        <div className="px-5 pt-4">
          <div className="chip-gold mb-1.5">Check-in da Tarde</div>
          <Dots total={3} current={step} />

          {/* Referência à missão da manhã */}
          {mission && (
            <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(127,119,221,.07)', border: '0.5px solid rgba(127,119,221,.18)' }}>
              <div className="text-[10px] text-accent uppercase tracking-wider mb-1">Missão prometida esta manhã</div>
              <div className="text-[13px] italic text-text-2">"{mission}"</div>
            </div>
          )}

          {step === 0 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">O que já avançaste nessa missão?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Nada ainda', 'Pouco — 25%', 'Metade — 50%', 'Quase tudo'].map(o => (
                  <Option key={o} label={o} selected={progressOpt === o} onSelect={() => setProgressOpt(o)} />
                ))}
              </div>
              <button className="btn-primary" onClick={() => setStep(1)}>Próxima →</button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Estás focado ou disperso agora?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Muito focado', 'Razoável', 'Disperso', 'Esgotado'].map(o => (
                  <Option key={o} label={o} selected={focusOpt === o} onSelect={() => setFocusOpt(o)} />
                ))}
              </div>
              <button className="btn-primary" onClick={() => setStep(2)}>Próxima →</button>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Qual é o próximo passo imediato?</h2>
              <textarea value={nextAction} onChange={e => setNextAction(e.target.value)}
                placeholder="Uma acção concreta e específica..."
                className="w-full rounded-xl p-4 text-[14px] mb-6 resize-none h-24"
                style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit', outline: 'none' }} />
              <button className="btn-primary" onClick={() => finishPhase('tarde')}>Concluir Tarde ✓</button>
            </>
          )}
        </div>
      )}

      {/* ── NOITE ────────────────────────────── */}
      {activePhase === 'noite' && !donePhases.has('noite') && (
        <div className="px-5 pt-4">
          <div className="chip-gold mb-1.5">Check-in da Noite</div>
          <Dots total={3} current={step} />

          {mission && (
            <div className="p-3 rounded-xl mb-4" style={{ background: 'rgba(127,119,221,.07)', border: '0.5px solid rgba(127,119,221,.18)' }}>
              <div className="text-[10px] text-accent uppercase tracking-wider mb-1">Missão do dia — cumpriste?</div>
              <div className="text-[13px] italic text-text-2">"{mission}"</div>
            </div>
          )}

          {step === 0 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Como foi a execução hoje?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {['Sim, completamente', 'Em grande parte', 'Parcialmente', 'Não consegui'].map(o => (
                  <Option key={o} label={o} selected={missionDone === o} onSelect={() => setMissionDone(o)} />
                ))}
              </div>
              <button className="btn-primary" onClick={() => setStep(1)}>Próxima →</button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Qual foi a tua maior vitória de hoje?</h2>
              <textarea value={winOfDay} onChange={e => setWinOfDay(e.target.value)}
                placeholder="Mesmo pequena — o que funcionou bem..."
                className="w-full rounded-xl p-4 text-[14px] mb-6 resize-none h-24"
                style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit', outline: 'none' }} />
              <button className="btn-primary" onClick={() => setStep(2)}>Próxima →</button>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-syne font-semibold text-[18px] mb-4 leading-snug">Como te sentiste hoje?</h2>
              <div className="flex gap-2 justify-center my-5">
                {['😔', '😐', '🙂', '😄', '🔥'].map((e, i) => (
                  <button key={e} onClick={() => setMood(i + 1)}
                    className="w-12 h-12 rounded-2xl text-xl transition-all"
                    style={{
                      border: mood === i + 1 ? '1.5px solid var(--gold)' : '1.5px solid var(--border)',
                      background: mood === i + 1 ? 'rgba(232,168,56,.08)' : 'var(--bg2)',
                      transform: mood === i + 1 ? 'scale(1.12)' : 'scale(1)',
                    }}>
                    {e}
                  </button>
                ))}
              </div>
              <textarea value={reflection} onChange={e => setReflection(e.target.value)}
                placeholder="Uma aprendizagem do dia (opcional)..."
                className="w-full rounded-xl p-4 text-[14px] mb-6 resize-none h-20"
                style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', color: 'var(--text1)', fontFamily: 'inherit', outline: 'none' }} />
              <button className="btn-primary" onClick={() => finishPhase('noite')}>Fechar o Dia ✓</button>
            </>
          )}
        </div>
      )}

      {/* Fase concluída */}
      {donePhases.has(activePhase) && (
        <div className="px-5 pt-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="font-syne font-bold text-[20px] mb-2">
            Check-in {PHASE_LABELS[activePhase]} concluído!
          </h2>
          <p className="text-[14px] text-text-2 mb-6">
            +{PHASE_XP[activePhase]} XP ganhos. Continua assim.
          </p>
          {activePhase !== 'noite' && (
            <button className="btn-primary"
              onClick={() => setActivePhase(activePhase === 'manha' ? 'tarde' : 'noite')}>
              Próxima fase →
            </button>
          )}
          {activePhase === 'noite' && donePhases.size === 3 && (
            <div className="card-gold p-4 text-center">
              <div className="font-syne font-bold text-[18px] mb-1" style={{ color: 'var(--gold)' }}>
                🔥 Dia completo!
              </div>
              <div className="text-[13px] text-text-2">
                Streak actualizado. Volta amanhã para manter a sequência.
              </div>
            </div>
          )}
        </div>
      )}

      <Nav />
    </main>
  )
}
