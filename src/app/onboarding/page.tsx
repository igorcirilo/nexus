'use client'
// src/app/onboarding/page.tsx
import { useState } from 'react'
import { supabase, updateFullProfile } from '@/lib/supabase'
import { AREA_META } from '@/types'
import type { HabitArea } from '@/types'

const FOCUS_OPTIONS = [
  { key: 'saude',        icon: '💪', label: 'Saúde & Corpo',     desc: 'Treino, sono e energia'      },
  { key: 'produtividade',icon: '🎯', label: 'Produtividade',      desc: 'Foco, tarefas e execução'    },
  { key: 'carreira',     icon: '📚', label: 'Carreira & Estudos', desc: 'Crescimento profissional'    },
  { key: 'financas',     icon: '💰', label: 'Finanças',           desc: 'Poupança e controlo'         },
  { key: 'equilibrio',   icon: '🧘', label: 'Equilíbrio pessoal', desc: 'Emoções e relações'          },
]

const SUGGESTED_HABITS: Record<string, { name: string; area: HabitArea; xp: number; time: string }[]> = {
  saude: [
    { name: 'Treino físico',    area: 'corpo',         xp: 20, time: '07:00–09:00' },
    { name: 'Água · 2L',       area: 'corpo',         xp: 8,  time: 'Todo o dia'  },
    { name: 'Dormir às 23h',   area: 'corpo',         xp: 10, time: '23:00'       },
  ],
  produtividade: [
    { name: 'Bloco de foco',   area: 'produtividade', xp: 15, time: '09:00–11:00' },
    { name: 'Planear o dia',   area: 'produtividade', xp: 8,  time: '08:00'       },
    { name: 'Sem écran 1h',    area: 'produtividade', xp: 10, time: '21:00'       },
  ],
  carreira: [
    { name: 'Leitura · 20 min',area: 'carreira',      xp: 10, time: '21:00–22:00' },
    { name: 'Idioma · 15 min', area: 'idiomas',        xp: 10, time: '18:00–19:00' },
    { name: 'Projecto pessoal',area: 'carreira',      xp: 15, time: '20:00–21:00' },
  ],
  financas: [
    { name: 'Registar despesas',area: 'financas',     xp: 8,  time: '21:00'       },
    { name: 'Sem compras impulsivas', area: 'financas',xp: 15, time: 'Todo o dia' },
    { name: 'Poupança do dia', area: 'financas',      xp: 10, time: 'Todo o dia'  },
  ],
  equilibrio: [
    { name: 'Meditação · 10 min', area: 'emocoes',   xp: 10, time: '07:30'       },
    { name: 'Diário de gratidão', area: 'emocoes',   xp: 8,  time: '22:00'       },
    { name: 'Contacto positivo', area: 'relacionamentos', xp: 10, time: 'Todo o dia' },
  ],
}

const S = {
  input: {
    width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
    borderRadius: 12, padding: '13px 14px', color: 'var(--text1)',
    fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
  } as React.CSSProperties,
  btn: {
    width: '100%', background: 'var(--gold)', color: 'var(--bg0)', border: 'none',
    borderRadius: 14, padding: 15, fontFamily: 'Syne, sans-serif',
    fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all .15s',
  } as React.CSSProperties,
}

export default function OnboardingPage() {
  const [step,       setStep]       = useState(0)
  const [name,       setName]       = useState('')
  const [focus,      setFocus]      = useState('')
  const [goal90,     setGoal90]     = useState('')
  const [selected,   setSelected]   = useState<number[]>([0, 1, 2])
  const [saving,     setSaving]     = useState(false)

  const habits = focus ? SUGGESTED_HABITS[focus] : []

  function toggleHabit(i: number) {
    setSelected(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])
  }

  async function finish() {
    if (!name.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth'; return }

    // Guardar perfil
    await updateFullProfile(user.id, {
      username: name.trim(),
      goal_90_personal: goal90,
      onboarded: true,
    })

    // Criar hábitos seleccionados
    const chosenHabits = selected.map(i => habits[i]).filter(Boolean)
    if (chosenHabits.length > 0) {
      await supabase.from('habits').insert(
        chosenHabits.map(h => ({
          user_id: user.id, name: h.name, area: h.area,
          xp_reward: h.xp, time_window: h.time, active: true,
        }))
      )
    }

    // Criar lembretes padrão
    await supabase.from('reminders').insert([
      { user_id: user.id, title: 'Check-in da Manhã', time: '08:00', days: [0,1,2,3,4,5,6], type: 'checkin_manha' },
      { user_id: user.id, title: 'Check-in da Tarde',  time: '14:00', days: [0,1,2,3,4,5,6], type: 'checkin_tarde' },
      { user_id: user.id, title: 'Check-in da Noite',  time: '21:00', days: [0,1,2,3,4,5,6], type: 'checkin_noite' },
    ])

    window.location.href = '/hoje'
  }

  const pct = ((step + 1) / 3) * 100

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--gold)', letterSpacing: '-1px', marginBottom: 6 }}>
            NEXUS
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>O teu sistema de evolução pessoal</div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 4, marginBottom: 32 }}>
          <div style={{ height: '100%', borderRadius: 100, background: 'var(--gold)', width: `${pct}%`, transition: 'width .4s ease' }} />
        </div>

        {/* ── STEP 0: Nome ── */}
        {step === 0 && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Passo 1 de 3</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, marginBottom: 8, lineHeight: 1.2 }}>
              Como te chamas?
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 28, lineHeight: 1.6 }}>
              Vamos personalizar a experiência para ti.
            </p>
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Nome ou alcunha</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Igor, Guerreiro, Campeão…"
              style={{ ...S.input, marginBottom: 24 }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(1)}
            />
            <button
              disabled={!name.trim()}
              onClick={() => setStep(1)}
              style={{ ...S.btn, opacity: name.trim() ? 1 : 0.4, cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── STEP 1: Foco principal ── */}
        {step === 1 && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Passo 2 de 3</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, marginBottom: 8, lineHeight: 1.2 }}>
              Qual é o teu foco principal, {name}?
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              Vamos sugerir hábitos adaptados ao que queres melhorar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {FOCUS_OPTIONS.map(f => (
                <button key={f.key} onClick={() => setFocus(f.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: focus === f.key ? 'rgba(232,168,56,.1)' : 'var(--bg2)',
                  outline: focus === f.key ? '1.5px solid var(--gold)' : '0.5px solid var(--border)',
                  transition: 'all .15s', textAlign: 'left',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 14, color: focus === f.key ? 'var(--gold)' : 'var(--text1)', marginBottom: 2 }}>{f.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{f.desc}</div>
                  </div>
                  {focus === f.key && (
                    <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="var(--bg0)" strokeWidth="2"><polyline points="1,4 4,7 9,1"/></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
              Objectivo para os próximos 90 dias (opcional)
            </label>
            <textarea
              value={goal90} onChange={e => setGoal90(e.target.value)}
              placeholder="Ex: Perder 5kg e criar uma rotina de treino consistente"
              style={{ ...S.input, height: 72, resize: 'none', marginBottom: 24 } as React.CSSProperties}
            />
            <button
              disabled={!focus}
              onClick={() => setStep(2)}
              style={{ ...S.btn, opacity: focus ? 1 : 0.4, cursor: focus ? 'pointer' : 'not-allowed' }}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── STEP 2: Hábitos iniciais ── */}
        {step === 2 && (
          <div style={{ animation: 'fadeUp .3s ease' }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>Passo 3 de 3</div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, marginBottom: 8, lineHeight: 1.2 }}>
              Os teus primeiros hábitos
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              Selecciona os que queres acompanhar. Podes mudar depois.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {habits.map((h, i) => {
                const area = AREA_META[h.area]
                const on   = selected.includes(i)
                return (
                  <button key={i} onClick={() => toggleHabit(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: on ? 'rgba(30,203,180,.07)' : 'var(--bg2)',
                    outline: on ? '1.5px solid var(--teal)' : '0.5px solid var(--border)',
                    transition: 'all .15s', textAlign: 'left',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      background: `${area.color}18`,
                    }}>{area.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 2 }}>{h.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{h.time} · +{h.xp} XP</div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                      background: on ? 'var(--teal)' : 'var(--bg3)',
                      border: on ? 'none' : '1.5px solid var(--text3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all .15s',
                    }}>
                      {on && <svg width="11" height="9" viewBox="0 0 11 9" fill="none" stroke="var(--bg0)" strokeWidth="2.5"><polyline points="1,4 4.5,7.5 10,1"/></svg>}
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              disabled={saving || selected.length === 0}
              onClick={finish}
              style={{ ...S.btn, opacity: selected.length > 0 ? 1 : 0.4, cursor: selected.length > 0 ? 'pointer' : 'not-allowed' }}>
              {saving ? 'A configurar…' : `Começar a evolução →`}
            </button>
            <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
              Podes adicionar mais hábitos depois em Hábitos
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
