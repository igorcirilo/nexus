'use client'
// src/app/perfil/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, getProfile, updateFullProfile } from '@/lib/supabase'
import type { Profile } from '@/types'

type Section = 'corpo' | 'metas' | 'financas' | 'objetivos' | 'xp'

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontFamily: 'DM Sans, sans-serif', fontSize: 12, transition: 'all .2s',
      background: active ? 'var(--bg3)' : 'transparent',
      color: active ? 'var(--text1)' : 'var(--text3)',
    }}>{label}</button>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
  borderRadius: 12, padding: '13px 14px', color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
}

const rowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
}

export default function PerfilPage() {
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [section,  setSection]  = useState<Section>('corpo')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [form,     setForm]     = useState<Record<string, string | number>>({})

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth'; return }
      const prof = await getProfile(user.id)
      setProfile(prof)
      // Pré-preencher formulário
      setForm({
        username:           prof?.username ?? '',
        age:                prof?.age ?? '',
        sex:                prof?.sex ?? '',
        weight_kg:          prof?.weight_kg ?? '',
        height_cm:          prof?.height_cm ?? '',
        goal_weight:        prof?.goal_weight ?? '',
        water_goal_ml:      prof?.water_goal_ml ?? 2000,
        workouts_per_week:  prof?.workouts_per_week ?? 3,
        sleep_goal_h:       prof?.sleep_goal_h ?? 8,
        read_pages_day:     prof?.read_pages_day ?? 10,
        fin_current_savings: prof?.fin_current_savings ?? '',
        fin_monthly_save:   prof?.fin_monthly_save ?? '',
        fin_debt_goal:      prof?.fin_debt_goal ?? '',
        fin_reserve_goal:   prof?.fin_reserve_goal ?? '',
        goal_90_personal:   prof?.goal_90_personal ?? '',
        goal_90_career:     prof?.goal_90_career ?? '',
        goal_90_health:     prof?.goal_90_health ?? '',
        xp_weekly_goal:     prof?.xp_weekly_goal ?? 500,
        completion_pct_goal:prof?.completion_pct_goal ?? 80,
      })
    }
    load()
  }, [])

  function set(key: string, val: string | number) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    await updateFullProfile(profile.id, form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const sections: Section[] = ['corpo', 'metas', 'financas', 'objetivos', 'xp']
  const sectionLabels: Record<Section, string> = {
    corpo: 'Corpo', metas: 'Metas', financas: 'Finanças', objetivos: '90 Dias', xp: 'XP & Goals',
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>

      {/* Toast */}
      {saved && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)',
          borderRadius: 12, padding: '10px 18px', fontSize: 13, color: 'var(--teal)',
          display: 'flex', alignItems: 'center', gap: 8, zIndex: 200, whiteSpace: 'nowrap',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Perfil guardado!
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '28px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Perfil</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{form.username || 'Guerreiro'}</p>
        </div>
        <button onClick={save} disabled={saving} style={{
          background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 12,
          padding: '10px 20px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', margin: '0 20px 20px', padding: 4,
        background: 'var(--bg2)', borderRadius: 12, border: '0.5px solid var(--border)',
        gap: 2,
      }}>
        {sections.map(s => (
          <SectionTab key={s} label={sectionLabels[s]} active={section === s} onClick={() => setSection(s)} />
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ── CORPO ── */}
        {section === 'corpo' && (
          <>
            <Field label="Nome de utilizador">
              <input style={inputStyle} value={String(form.username)} onChange={e => set('username', e.target.value)} placeholder="Como te chamamos" />
            </Field>
            <div style={rowStyle}>
              <Field label="Idade (anos)">
                <input style={inputStyle} type="number" value={String(form.age)} onChange={e => set('age', +e.target.value)} placeholder="30" />
              </Field>
              <Field label="Sexo">
                <select style={inputStyle} value={String(form.sex)} onChange={e => set('sex', e.target.value)}>
                  <option value="">—</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </Field>
            </div>
            <div style={rowStyle}>
              <Field label="Peso actual (kg)">
                <input style={inputStyle} type="number" step="0.1" value={String(form.weight_kg)} onChange={e => set('weight_kg', +e.target.value)} placeholder="75.0" />
              </Field>
              <Field label="Altura (cm)">
                <input style={inputStyle} type="number" value={String(form.height_cm)} onChange={e => set('height_cm', +e.target.value)} placeholder="175" />
              </Field>
            </div>
            <Field label="Peso objetivo (kg)">
              <input style={inputStyle} type="number" step="0.1" value={String(form.goal_weight)} onChange={e => set('goal_weight', +e.target.value)} placeholder="70.0" />
            </Field>
          </>
        )}

        {/* ── METAS ── */}
        {section === 'metas' && (
          <>
            <Field label={`Meta de água diária: ${Math.round(+form.water_goal_ml / 1000 * 10) / 10}L`}
                   hint="Recomendado: 2.0–3.0L por dia">
              <input type="range" min={1000} max={4000} step={250} value={+form.water_goal_ml}
                onChange={e => set('water_goal_ml', +e.target.value)}
                style={{ width: '100%', accentColor: 'var(--teal)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>1L</span><span>4L</span>
              </div>
            </Field>

            <Field label={`Treinos por semana: ${form.workouts_per_week}`}>
              <input type="range" min={1} max={7} step={1} value={+form.workouts_per_week}
                onChange={e => set('workouts_per_week', +e.target.value)}
                style={{ width: '100%', accentColor: 'var(--gold)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>1×</span><span>7×</span>
              </div>
            </Field>

            <Field label={`Meta de sono: ${form.sleep_goal_h}h`}>
              <input type="range" min={5} max={10} step={0.5} value={+form.sleep_goal_h}
                onChange={e => set('sleep_goal_h', +e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>5h</span><span>10h</span>
              </div>
            </Field>

            <Field label={`Páginas de leitura por dia: ${form.read_pages_day}`}>
              <input type="range" min={5} max={100} step={5} value={+form.read_pages_day}
                onChange={e => set('read_pages_day', +e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>5 pág</span><span>100 pág</span>
              </div>
            </Field>
          </>
        )}

        {/* ── FINANÇAS ── */}
        {section === 'financas' && (
          <>
            {/* Saldo actual */}
            <div style={{ background:'var(--bg2)', border:'0.5px solid rgba(30,203,180,.22)', borderRadius:14, padding:16, marginBottom:20 }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Saldo actual em poupança</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontFamily:'Syne,sans-serif', fontSize:22, color:'var(--teal)' }}>€</span>
                <input type="number" value={String(form.fin_current_savings)} onChange={e => set('fin_current_savings', +e.target.value)} placeholder="0"
                  style={{ flex:1, fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:24, padding:'8px 0', background:'transparent', border:'none', borderBottom:'0.5px solid var(--border)', borderRadius:0, color:'var(--text1)', outline:'none' }} />
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>Valor actual disponível em conta/poupança</div>
            </div>
            <Field label="Meta de poupança mensal (€)" hint="Quanto queres guardar por mês">
              <input style={inputStyle} type="number" value={String(form.fin_monthly_save)}
                onChange={e => set('fin_monthly_save', +e.target.value)} placeholder="500" />
            </Field>
            <Field label="Meta de reserva de emergência (€)" hint="Objectivo de fundo de emergência">
              <input style={inputStyle} type="number" value={String(form.fin_reserve_goal)}
                onChange={e => set('fin_reserve_goal', +e.target.value)} placeholder="10000" />
            </Field>
            <Field label="Meta de eliminação de dívida (€)" hint="Total de dívida a eliminar">
              <input style={inputStyle} type="number" value={String(form.fin_debt_goal)}
                onChange={e => set('fin_debt_goal', +e.target.value)} placeholder="5000" />
            </Field>
            {+form.fin_reserve_goal > 0 && (
              <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:14, padding:14 }}>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>Progresso para reserva de emergência</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6 }}>
                  <span style={{ color:'var(--text2)' }}>€{Number(form.fin_current_savings||0).toLocaleString('pt-PT')}</span>
                  <span style={{ color:'var(--text3)' }}>€{Number(form.fin_reserve_goal).toLocaleString('pt-PT')}</span>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:100, height:6 }}>
                  <div style={{ height:'100%', borderRadius:100, background:'var(--teal)', width:`${Math.min(100,Math.round(+form.fin_current_savings / +form.fin_reserve_goal * 100))}%`, transition:'width .5s' }} />
                </div>
                <div style={{ fontSize:11, color:'var(--teal)', marginTop:6 }}>
                  {Math.min(100,Math.round(+form.fin_current_savings / +form.fin_reserve_goal * 100))}% da meta atingida
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 90 DIAS ── */}
        {section === 'objetivos' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
              Define o que queres alcançar nos próximos 90 dias em cada área. Estas metas guiam o sistema e o mentor.
            </div>
            <Field label="Objectivo pessoal de 90 dias">
              <textarea style={{ ...inputStyle, height: 90, resize: 'none' }}
                value={String(form.goal_90_personal)}
                onChange={e => set('goal_90_personal', e.target.value)}
                placeholder="Ex: Criar um hábito de meditação diária e melhorar o sono" />
            </Field>
            <Field label="Objectivo profissional / carreira">
              <textarea style={{ ...inputStyle, height: 90, resize: 'none' }}
                value={String(form.goal_90_career)}
                onChange={e => set('goal_90_career', e.target.value)}
                placeholder="Ex: Lançar o projecto X e conseguir os primeiros clientes" />
            </Field>
            <Field label="Objectivo de saúde">
              <textarea style={{ ...inputStyle, height: 90, resize: 'none' }}
                value={String(form.goal_90_health)}
                onChange={e => set('goal_90_health', e.target.value)}
                placeholder="Ex: Perder 5kg e correr 5km sem parar" />
            </Field>
          </>
        )}

        {/* ── XP & GOALS ── */}
        {section === 'xp' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
              Define as tuas metas de desempenho semanal. O dashboard vai mostrar o teu progresso em relação a estes valores.
            </div>
            <Field label={`Meta de XP por semana: ${form.xp_weekly_goal} XP`}
                   hint="Média de referência: 500 XP/semana. Agressivo: 1000+">
              <input type="range" min={100} max={2000} step={50} value={+form.xp_weekly_goal}
                onChange={e => set('xp_weekly_goal', +e.target.value)}
                style={{ width: '100%', accentColor: 'var(--gold)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>100 XP</span><span>2000 XP</span>
              </div>
            </Field>

            <Field label={`Taxa de conclusão semanal aceitável: ${form.completion_pct_goal}%`}
                   hint="Abaixo disto o mentor activa modo de retomada">
              <input type="range" min={40} max={100} step={5} value={+form.completion_pct_goal}
                onChange={e => set('completion_pct_goal', +e.target.value)}
                style={{ width: '100%', accentColor: 'var(--teal)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                <span>40%</span><span>100%</span>
              </div>
            </Field>

            {/* Preview visual */}
            <div style={{ marginTop: 8, padding: '14px 16px', borderRadius: 14, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Preview semanal com estas metas</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text2)' }}>
                <span>Meta XP</span>
                <span style={{ color: 'var(--gold)', fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>{form.xp_weekly_goal} XP</span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 6 }}>
                <div style={{ width: '60%', height: '100%', borderRadius: 100, background: 'linear-gradient(90deg, var(--gold), #F0C060)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Exemplo: 60% da meta esta semana</div>
            </div>
          </>
        )}

        {/* Botão guardar */}
        <button onClick={save} disabled={saving} style={{
          width: '100%', background: 'var(--gold)', color: 'var(--bg0)', border: 'none',
          borderRadius: 16, padding: '15px', marginTop: 24,
          fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          {saving ? 'A guardar…' : 'Guardar perfil'}
        </button>
      </div>

      <Nav />
    </main>
  )
}
