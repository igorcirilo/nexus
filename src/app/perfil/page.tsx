'use client'
// src/app/perfil/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, getProfile, updateFullProfile, getUserBadges, getTrainingCount30d, getReadingPages30d } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Profile, UserBadge } from '@/types'
import PerfilHub from '@/components/perfil/PerfilHub'

type AppTab = 'resumo' | 'editar'
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
  const [journeyData, setJourneyData] = useState<{ trainingCount30d: number; readingPages30d: number } | undefined>(undefined)
  const [tab, setTab] = useState<AppTab>('resumo')
  const [section, setSection] = useState<Section>('corpo')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [form, setForm] = useState<Record<string, string | number>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth'
        return
      }

      const [prof, userBadges, trainingCount, readingPages] = await Promise.all([
        getProfile(user.id),
        getUserBadges(user.id),
        getTrainingCount30d(user.id),
        getReadingPages30d(user.id),
      ])
      setProfile(prof)
      setBadges((userBadges ?? []) as UserBadge[])
      setJourneyData({ trainingCount30d: trainingCount, readingPages30d: readingPages })
      setEmail(user.email ?? '')

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
      setLoading(false)
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

  async function handlePhotoSelect(file: File) {
    if (!profile) return
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('A foto deve ter no máximo 5MB.')
      setTimeout(() => setPhotoError(''), 3000)
      return
    }
    setPhotoUploading(true)
    setPhotoError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)
      if (updateError) throw updateError

      setProfile(p => (p ? { ...p, avatar_url: publicUrl } : p))
    } catch {
      setPhotoError('Não foi possível carregar a foto. Tenta novamente.')
      setTimeout(() => setPhotoError(''), 3000)
    } finally {
      setPhotoUploading(false)
    }
  }

  const sections: Section[] = ['corpo', 'metas', 'objetivos', 'xp']
  const sectionLabels: Record<Section, string> = {
    corpo: 'Corpo',
    metas: 'Metas',
    objetivos: '90 Dias',
    xp: 'XP & Goals',
  }

  const earnedKeys = new Set(badges.map((b) => b.badge_key))

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>
        a carregar…
      </div>
    )
  }

  // ── Hub (tab resumo) ────────────────────────────────────────────────────────
  if (tab === 'resumo') {
    return (
      <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: '#07070F' }}>
        {photoError && (
          <div style={{
            position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
            background: '#161825', border: '1px solid rgba(226,75,74,.38)', borderRadius: 12,
            padding: '10px 18px', fontSize: 13, color: '#E24B4A', zIndex: 10000, whiteSpace: 'nowrap',
          }}>
            {photoError}
          </div>
        )}
        <PerfilHub
          profile={profile!}
          badges={badges}
          email={email}
          onEdit={(sec) => { setSection(sec ?? 'corpo'); setTab('editar') }}
          onLogout={logout}
          onPhotoSelect={handlePhotoSelect}
          photoUploading={photoUploading}
          journeyData={journeyData}
        />
        <Nav />
      </main>
    )
  }

  // ── Editar perfil ───────────────────────────────────────────────────────────
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

      <div style={{ padding: '28px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <button onClick={() => setTab('resumo')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, padding: '4px 0',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Resumo
          </button>
        </div>
      </div>
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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


      {/* Zona de perigo */}
      <div style={{ margin: '0 20px 100px', padding: '16px', background: 'rgba(226,75,74,.05)', border: '0.5px solid rgba(226,75,74,.2)', borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 10 }}>
          Zona de perigo
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
          Repõe todos os teus dados — XP, hábitos, check-ins, streak e progresso serão apagados permanentemente. A conta mantém-se activa.
        </p>
        <button
          type="button"
          onClick={async () => {
            const confirm1 = window.confirm('Tens a certeza? Esta acção é irreversível.')
            if (!confirm1) return
            const confirm2 = window.confirm('Confirmas que queres apagar todos os teus dados?')
            if (!confirm2) return
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            await Promise.all([
              supabase.from('habit_logs').delete().eq('user_id', user.id),
              supabase.from('habits').delete().eq('user_id', user.id),
              supabase.from('checkins').delete().eq('user_id', user.id),
              supabase.from('focus_sessions').delete().eq('user_id', user.id),
              supabase.from('user_badges').delete().eq('user_id', user.id),
              supabase.from('goals_90').delete().eq('user_id', user.id),
              supabase.from('reminders').delete().eq('user_id', user.id),
              supabase.from('transactions').delete().eq('user_id', user.id),
              supabase.from('agenda_events').delete().eq('user_id', user.id),
              supabase.from('profiles').update({
                xp_total: 0, level: 1, streak_current: 0, streak_best: 0,
                streak_last_date: null, mission_today: null, energy_today: 5, onboarded: false,
              }).eq('id', user.id),
            ])
            window.location.href = '/onboarding'
          }}
          style={{
            width: '100%', border: '0.5px solid rgba(226,75,74,.4)', borderRadius: 12,
            padding: '11px 16px', background: 'transparent', color: '#E24B4A',
            fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}
        >
          Repor todos os dados
        </button>
      </div>
      <Nav />
    </main>
  )
}
