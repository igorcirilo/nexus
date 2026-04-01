'use client'
// src/app/perfil/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, getProfile, updateFullProfile, getUserBadges } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Profile, UserBadge } from '@/types'

type Section = 'corpo' | 'metas' | 'objetivos' | 'xp'

function SectionTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '9px 4px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 12,
        transition: 'all .2s',
        background: active ? 'var(--bg3)' : 'transparent',
        color: active ? 'var(--text1)' : 'var(--text3)',
      }}
    >
      {label}
    </button>
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
  width: '100%',
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '13px 14px',
  color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 14,
  outline: 'none',
}

const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12,
}

const LOCKED_BADGES = [
  { key: 'primeiro_checkin', name: 'Primeira Vez', icon: '🌅' },
  { key: 'streak_7', name: 'Uma Semana', icon: '🔥' },
  { key: 'streak_21', name: 'Três Semanas', icon: '⚡' },
  { key: 'streak_100', name: 'Centenário', icon: '💎' },
  { key: 'xp_1000', name: 'Mil Pontos', icon: '⭐' },
  { key: 'xp_5000', name: 'Veterano', icon: '🏆' },
]

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [section, setSection] = useState<Section>('corpo')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Record<string, string | number>>({})
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }

      const [prof, userBadges] = await Promise.all([getProfile(user.id), getUserBadges(user.id)])
      setProfile(prof)
      setBadges((userBadges ?? []) as UserBadge[])

      setForm({
        username: prof?.username ?? '',
        age: prof?.age ?? '',
        sex: prof?.sex ?? '',
        weight_kg: prof?.weight_kg ?? '',
        height_cm: prof?.height_cm ?? '',
        goal_weight: prof?.goal_weight ?? '',
        water_goal_ml: prof?.water_goal_ml ?? 2000,
        workouts_per_week: prof?.workouts_per_week ?? 3,
        sleep_goal_h: prof?.sleep_goal_h ?? 8,
        read_pages_day: prof?.read_pages_day ?? 10,
        fin_current_savings: prof?.fin_current_savings ?? '',
        fin_monthly_save: prof?.fin_monthly_save ?? '',
        fin_debt_goal: prof?.fin_debt_goal ?? '',
        fin_reserve_goal: prof?.fin_reserve_goal ?? '',
        goal_90_personal: prof?.goal_90_personal ?? '',
        goal_90_career: prof?.goal_90_career ?? '',
        goal_90_health: prof?.goal_90_health ?? '',
        xp_weekly_goal: prof?.xp_weekly_goal ?? 500,
        completion_pct_goal: prof?.completion_pct_goal ?? 80,
      })
    }

    load()
  }, [])

  function set(key: string, val: string | number) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function save() {
    if (!profile) return
    setSaving(true)
    await updateFullProfile(profile.id, form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const sections: Section[] = ['corpo', 'metas', 'objetivos', 'xp']
  const sectionLabels: Record<Section, string> = {
    corpo: 'Corpo',
    metas: 'Metas',
    objetivos: '90 Dias',
    xp: 'XP & Goals',
  }

  const earnedKeys = new Set(badges.map((b) => b.badge_key))

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      {saved && (
        <div
          style={{
            position: 'fixed',
            bottom: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg2)',
            border: '0.5px solid rgba(30,203,180,.38)',
            borderRadius: 12,
            padding: '10px 18px',
            fontSize: 13,
            color: 'var(--teal)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 200,
            whiteSpace: 'nowrap',
          }}
        >
          Perfil guardado!
        </div>
      )}

      <div style={{ padding: '28px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Perfil</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{form.username || 'Utilizador'}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            background: 'var(--gold)',
            color: 'var(--bg0)',
            border: 'none',
            borderRadius: 12,
            padding: '10px 20px',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {saving ? 'A guardar…' : 'Guardar'}
        </button>
      </div>

      {profile && (
        <>
          <div style={{ padding: '0 20px', marginBottom: 18 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Estatísticas rápidas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'XP Total', value: profile.xp_total, color: 'var(--gold)' },
                { label: 'Nível', value: profile.level, color: 'var(--teal)' },
                { label: 'Streak', value: profile.streak_current, color: 'var(--accent)' },
                { label: 'Máximo', value: profile.streak_best, color: 'var(--text2)' },
              ].map((item) => (
                <div key={item.label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '12px 10px' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: item.color, marginBottom: 4 }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>As tuas conquistas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {LOCKED_BADGES.map((badge) => {
                const unlocked = earnedKeys.has(badge.key)
                const earned = badges.find((b) => b.badge_key === badge.key)
                return (
                  <div
                    key={badge.key}
                    style={{
                      background: 'var(--bg2)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 14,
                      padding: '12px 10px',
                      minHeight: 104,
                      opacity: unlocked ? 1 : 0.35,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{unlocked ? badge.icon : '🔒'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text1)', fontWeight: 600, marginBottom: 4 }}>{badge.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                      {unlocked && earned?.earned_at ? new Date(earned.earned_at).toLocaleDateString('pt-PT') : 'Bloqueado'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', margin: '0 20px 20px', padding: 4, background: 'var(--bg2)', borderRadius: 12, border: '0.5px solid var(--border)', gap: 2 }}>
        {sections.map((s) => (
          <SectionTab key={s} label={sectionLabels[s]} active={section === s} onClick={() => setSection(s)} />
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {section === 'corpo' && (
          <>
            <Field label="Nome de utilizador">
              <input style={inputStyle} value={String(form.username)} onChange={(e) => set('username', e.target.value)} placeholder="Como te chamamos" />
            </Field>
            <div style={rowStyle}>
              <Field label="Idade (anos)">
                <input style={inputStyle} type="number" value={String(form.age)} onChange={(e) => set('age', e.target.value === '' ? '' : +e.target.value)} placeholder="30" />
              </Field>
              <Field label="Sexo">
                <select style={inputStyle} value={String(form.sex)} onChange={(e) => set('sex', e.target.value)}>
                  <option value="">—</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </Field>
            </div>
            <div style={rowStyle}>
              <Field label="Peso actual (kg)">
                <input style={inputStyle} type="number" step="0.1" value={String(form.weight_kg)} onChange={(e) => set('weight_kg', e.target.value === '' ? '' : +e.target.value)} placeholder="75.0" />
              </Field>
              <Field label="Altura (cm)">
                <input style={inputStyle} type="number" value={String(form.height_cm)} onChange={(e) => set('height_cm', e.target.value === '' ? '' : +e.target.value)} placeholder="175" />
              </Field>
            </div>
            <Field label="Peso objetivo (kg)">
              <input style={inputStyle} type="number" step="0.1" value={String(form.goal_weight)} onChange={(e) => set('goal_weight', e.target.value === '' ? '' : +e.target.value)} placeholder="70.0" />
            </Field>
          </>
        )}

        {section === 'metas' && (
          <>
            <Field label={`Meta de água diária: ${Math.round((+form.water_goal_ml / 1000) * 10) / 10}L`} hint="Recomendado: 2.0–3.0L por dia">
              <input type="range" min={1000} max={4000} step={250} value={+form.water_goal_ml} onChange={(e) => set('water_goal_ml', +e.target.value)} style={{ width: '100%', accentColor: 'var(--teal)' }} />
            </Field>
            <Field label={`Treinos por semana: ${form.workouts_per_week}`}>
              <input type="range" min={1} max={7} step={1} value={+form.workouts_per_week} onChange={(e) => set('workouts_per_week', +e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
            </Field>
            <Field label={`Meta de sono: ${form.sleep_goal_h}h`}>
              <input type="range" min={5} max={10} step={0.5} value={+form.sleep_goal_h} onChange={(e) => set('sleep_goal_h', +e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </Field>
            <Field label={`Páginas de leitura por dia: ${form.read_pages_day}`}>
              <input type="range" min={5} max={100} step={5} value={+form.read_pages_day} onChange={(e) => set('read_pages_day', +e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </Field>
          </>
        )}

        {section === 'objetivos' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
              Define o que queres alcançar nos próximos 90 dias em cada área. Estas metas guiam o sistema.
            </div>
            <Field label="Objectivo pessoal de 90 dias">
              <textarea style={{ ...inputStyle, height: 90, resize: 'none' }} value={String(form.goal_90_personal)} onChange={(e) => set('goal_90_personal', e.target.value)} placeholder="Ex: Criar um hábito de meditação diária e melhorar o sono" />
            </Field>
            <Field label="Objectivo profissional / carreira">
              <textarea style={{ ...inputStyle, height: 90, resize: 'none' }} value={String(form.goal_90_career)} onChange={(e) => set('goal_90_career', e.target.value)} placeholder="Ex: Lançar o projecto X e conseguir os primeiros clientes" />
            </Field>
            <Field label="Objectivo de saúde">
              <textarea style={{ ...inputStyle, height: 90, resize: 'none' }} value={String(form.goal_90_health)} onChange={(e) => set('goal_90_health', e.target.value)} placeholder="Ex: Perder 5kg e correr 5km sem parar" />
            </Field>
          </>
        )}

        {section === 'xp' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
              Define as tuas metas de desempenho semanal. O dashboard vai mostrar o teu progresso em relação a estes valores.
            </div>
            <Field label={`Meta de XP por semana: ${form.xp_weekly_goal} XP`} hint="Média de referência: 500 XP/semana. Agressivo: 1000+">
              <input type="range" min={100} max={2000} step={50} value={+form.xp_weekly_goal} onChange={(e) => set('xp_weekly_goal', +e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
            </Field>
            <Field label={`Taxa de conclusão semanal aceitável: ${form.completion_pct_goal}%`} hint="Abaixo disto o mentor activa modo de retomada">
              <input type="range" min={40} max={100} step={5} value={+form.completion_pct_goal} onChange={(e) => set('completion_pct_goal', +e.target.value)} style={{ width: '100%', accentColor: 'var(--teal)' }} />
            </Field>
            <button
              type="button"
              disabled
              style={{
                width: '100%',
                opacity: 0.4,
                cursor: 'not-allowed',
                background: 'var(--bg2)',
                color: 'var(--text2)',
                border: '0.5px solid var(--border)',
                borderRadius: 14,
                padding: 14,
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Exportar dados (em breve)
            </button>
          </>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
            background: 'var(--gold)',
            color: 'var(--bg0)',
            border: 'none',
            borderRadius: 16,
            padding: '15px',
            marginTop: 24,
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {saving ? 'A guardar…' : 'Guardar perfil'}
        </button>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 20 }} />
        <button
          type="button"
          onClick={logout}
          style={{
            width: '100%',
            padding: '14px',
            border: '0.5px solid rgba(226,75,74,.3)',
            borderRadius: 14,
            background: 'transparent',
            color: '#E24B4A',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Terminar sessão
        </button>
        <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 10 }}>Será redirecionado para o login.</p>
      </div>

      <Nav />
    </main>
  )
}
