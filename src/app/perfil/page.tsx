'use client'
// src/app/perfil/page.tsx
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase, requireUser, getProfile, updateFullProfile, getUserBadges, getTrainingCount30d, getReadingPages30d, getRitmo, getGoals90 } from '@/lib/supabase'
import { emitToast } from '@/lib/toast-events'
import { normalizeProfileForm } from '@/lib/profile-form'
import { clearDraft } from '@/lib/onboarding-engine'
import { resetUserData, exportUserData, downloadUserDataFile, deleteAccount } from '@/lib/account'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Profile, UserBadge, Goal90 } from '@/types'
import PerfilHub from '@/components/perfil/PerfilHub'
import AchievementsGoalsModal from '@/components/perfil/AchievementsGoalsModal'
import HabitLevelCard from '@/components/perfil/HabitLevelCard'

type AppTab = 'resumo' | 'editar'
type Section = 'corpo'

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

// Mesmas 6 conquistas do catálogo da BD (checkAndAwardBadges); as badges de XP
// foram removidas do produto e nunca seriam desbloqueadas aqui.
const LOCKED_BADGES = [
  { key: 'primeiro_checkin', name: 'Primeira Vez', icon: '🌅' },
  { key: 'streak_7', name: 'Uma Semana', icon: '🔥' },
  { key: 'streak_21', name: 'Três Semanas', icon: '⚡' },
  { key: 'streak_100', name: 'Centenário', icon: '💎' },
  { key: 'ritmo_80', name: 'Em Chamas', icon: '🚀' },
  { key: 'consistencia_30', name: 'Inabalável', icon: '🏔️' },
]

export default function PerfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [badges, setBadges] = useState<UserBadge[]>([])
  const [goals, setGoals] = useState<Goal90[]>([])
  const [showAchievements, setShowAchievements] = useState(false)
  const [journeyData, setJourneyData] = useState<{ trainingCount30d: number; readingPages30d: number } | undefined>(undefined)
  const [tab, setTab] = useState<AppTab>('resumo')
  const [editSection, setEditSection] = useState<Section | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [ritmo, setRitmo] = useState(0)
  const [form, setForm] = useState<Record<string, string | number>>({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [dangerBusy, setDangerBusy] = useState<null | 'reset' | 'export' | 'delete'>(null)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const user = await requireUser()
      if (!user) return

      const [prof, userBadges, trainingCount, readingPages, ritmoNow, userGoals] = await Promise.all([
        getProfile(user.id),
        getUserBadges(user.id),
        getTrainingCount30d(user.id),
        getReadingPages30d(user.id),
        getRitmo(user.id),
        getGoals90(user.id),
      ])
      setProfile(prof)
      setBadges((userBadges ?? []) as UserBadge[])
      setGoals((userGoals ?? []) as Goal90[])
      setRitmo(ritmoNow)
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
        // Campos financeiros ficam de fora de propósito: são geridos em
        // /financas e não têm inputs nesta página; incluí-los no form fazia o
        // Guardar reescrevê-los com um snapshot antigo (bug de divergência,
        // o mesmo que já afetou fin_current_savings).
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
    // Campos numéricos: '' → null; strings numéricas → Number. Evita enviar
    // strings vazias para colunas numéricas (que falham/gravam lixo). (P2.7)
    const payload = normalizeProfileForm(form)
    const { error } = await updateFullProfile(profile.id, payload)
    setSaving(false)
    if (error) {
      emitToast('Não foi possível guardar o perfil.', 'error')
      return
    }
    // Reflete o que foi gravado no estado local: o hub (tab resumo) lê de
    // `profile`, não do form, e mostrava valores antigos até recarregar.
    setProfile((p) => (p ? { ...p, ...payload } as Profile : p))
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

  // Identidade do modal de edição.
  const sectionMeta: Record<Section, { icon: string; title: string; sub: string }> = {
    corpo: { icon: '💪', title: 'Corpo & Físico', sub: 'Medidas, água e treinos' },
  }

  // Campos de Corpo & Físico, partilhados entre a página de edição e o modal.
  function renderSectionFields() {
    return (
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

        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, margin: '6px 0 12px' }}>
          Metas diárias
        </div>
        <div style={rowStyle}>
          <Field label="Água diária (L)" hint="Recomendado: 2.0–3.0L">
            <input style={inputStyle} type="number" step="0.25" min="1" max="4" value={form.water_goal_ml === '' ? '' : +form.water_goal_ml / 1000} onChange={(e) => set('water_goal_ml', e.target.value === '' ? '' : Math.round(+e.target.value * 1000))} placeholder="2.5" />
          </Field>
          <Field label="Treinos / semana">
            <input style={inputStyle} type="number" step="1" min="1" max="7" value={String(form.workouts_per_week)} onChange={(e) => set('workouts_per_week', e.target.value === '' ? '' : +e.target.value)} placeholder="3" />
          </Field>
        </div>
      </>
    )
  }

  async function saveSection() {
    await save()
    setEditSection(null)
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
      <main style={{ paddingBottom: 'calc(150px + env(safe-area-inset-bottom))', minHeight: '100dvh', background: 'var(--surface-page)' }}>
        {photoError && (
          <div style={{
            position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--surface-pop)', border: '1px solid rgba(226,75,74,.38)', borderRadius: 12,
            padding: '10px 18px', fontSize: 13, color: '#E24B4A', zIndex: 10000, whiteSpace: 'nowrap',
          }}>
            {photoError}
          </div>
        )}
        <PerfilHub
          profile={profile!}
          ritmo={ritmo}
          badges={badges}
          email={email}
          onEdit={(sec) => setEditSection(sec ?? 'corpo')}
          onEditAll={() => setTab('editar')}
          onLogout={logout}
          onPhotoSelect={handlePhotoSelect}
          photoUploading={photoUploading}
          journeyData={journeyData}
          onOpenAchievements={() => setShowAchievements(true)}
        />

        {showAchievements && (
          <AchievementsGoalsModal badges={badges} goals={goals} onClose={() => setShowAchievements(false)} />
        )}

        {editSection && (
          <div
            onClick={() => !saving && setEditSection(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 480, background: 'var(--bg1)', borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '0.5px solid var(--border)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ padding: '18px 24px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{sectionMeta[editSection].icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18 }}>{sectionMeta[editSection].title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sectionMeta[editSection].sub}</div>
                </div>
                <button onClick={() => setEditSection(null)} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--bg3)', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text2)' }}>✕</button>
              </div>
              <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
                {renderSectionFields()}
              </div>
              <div style={{ padding: '12px 24px calc(20px + env(safe-area-inset-bottom))', background: 'var(--bg1)', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 10 }}>
                <button onClick={() => setEditSection(null)} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: '0.5px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={saveSection} disabled={saving} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: 'var(--gold)', color: 'var(--on-bright)', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'A guardar…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {saved && (
          <div style={{
            position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)', borderRadius: 12,
            padding: '10px 18px', fontSize: 13, color: 'var(--teal-ink)', zIndex: 10000, whiteSpace: 'nowrap',
          }}>
            Perfil guardado!
          </div>
        )}

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
            color: 'var(--teal-ink)',
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
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Perfil</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{form.username || 'Utilizador'}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            background: 'var(--gold)',
            color: 'var(--on-bright)',
            border: 'none',
            borderRadius: 12,
            padding: '10px 20px',
            fontFamily: 'Inter, sans-serif',
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
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>Estatísticas rápidas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: 'Ritmo', value: ritmo, color: 'var(--gold-ink)' },
                { label: 'Nível', value: profile.level, color: 'var(--teal-ink)' },
                { label: 'Streak', value: profile.streak_current, color: 'var(--accent)' },
                { label: 'Máximo', value: profile.streak_best, color: 'var(--text2)' },
              ].map((item) => (
                <div key={item.label} style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '12px 10px' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 20, color: item.color, marginBottom: 4 }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 10 }}>As tuas conquistas</div>
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

      {profile?.habit_level != null && (
        <HabitLevelCard userId={profile.id} currentLevel={profile.habit_level} />
      )}

      <div style={{ padding: '0 20px' }}>
        {renderSectionFields()}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            width: '100%',
            background: 'var(--gold)',
            color: 'var(--on-bright)',
            border: 'none',
            borderRadius: 16,
            padding: '15px',
            marginTop: 24,
            fontFamily: 'Inter, sans-serif',
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
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Terminar sessão
        </button>
        <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 10 }}>Será redirecionado para o login.</p>
      </div>


      {/* Privacidade & dados */}
      <div style={{ margin: '0 20px 16px', padding: '16px', background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 10 }}>
          Privacidade & dados
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
          Descarrega uma cópia de tudo o que guardamos sobre ti (perfil, hábitos, check-ins, peso, finanças, leitura…) em formato JSON.
        </p>
        <button
          type="button"
          disabled={dangerBusy !== null}
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setDangerBusy('export')
            try {
              const data = await exportUserData(user.id)
              downloadUserDataFile(data)
              emitToast('Dados exportados.', 'success')
            } catch {
              emitToast('Falha ao exportar os dados.', 'error')
            } finally {
              setDangerBusy(null)
            }
          }}
          style={{
            width: '100%', border: '0.5px solid var(--border)', borderRadius: 12,
            padding: '11px 16px', background: 'transparent', color: 'var(--text1)',
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13,
            cursor: dangerBusy ? 'not-allowed' : 'pointer', opacity: dangerBusy === 'export' ? 0.6 : 1,
          }}
        >
          {dangerBusy === 'export' ? 'A preparar…' : 'Exportar os meus dados'}
        </button>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14 }}>
          <Link href="/privacidade" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'underline' }}>Política de Privacidade</Link>
          <Link href="/termos" style={{ fontSize: 12, color: 'var(--text3)', textDecoration: 'underline' }}>Termos de Uso</Link>
        </div>
      </div>

      {/* Zona de perigo */}
      <div style={{ margin: '0 20px 100px', padding: '16px', background: 'rgba(226,75,74,.05)', border: '0.5px solid rgba(226,75,74,.2)', borderRadius: 16 }}>
        <div style={{ fontSize: 11, color: '#E24B4A', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, marginBottom: 10 }}>
          Zona de perigo
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
          <b style={{ color: 'var(--text2)' }}>Repor dados:</b> apaga permanentemente todo o teu progresso (hábitos, check-ins, peso, finanças, leitura…). A conta mantém-se activa.
        </p>
        <button
          type="button"
          disabled={dangerBusy !== null}
          onClick={async () => {
            if (!window.confirm('Tens a certeza? Esta acção é irreversível.')) return
            if (!window.confirm('Confirmas que queres apagar todos os teus dados?')) return
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setDangerBusy('reset')
            // Apagamento COMPLETO (todas as tabelas com user_id) + perfil reposto
            // para um estado de onboarding limpo. A lista vive em lib/account.ts.
            const { ok, errors } = await resetUserData(user.id)
            if (!ok) {
              emitToast('Alguns dados não foram apagados. Tenta de novo.', 'error')
              console.error('[perfil] resetUserData falhou:', errors)
              setDangerBusy(null)
              return
            }
            clearDraft()
            window.location.href = '/onboarding-v2'
          }}
          style={{
            width: '100%', border: '0.5px solid rgba(226,75,74,.4)', borderRadius: 12,
            padding: '11px 16px', background: 'transparent', color: '#E24B4A',
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13,
            cursor: dangerBusy ? 'not-allowed' : 'pointer', opacity: dangerBusy === 'reset' ? 0.6 : 1,
          }}
        >
          {dangerBusy === 'reset' ? 'A apagar…' : 'Repor todos os dados'}
        </button>

        <div style={{ height: 1, background: 'rgba(226,75,74,.15)', margin: '16px 0' }} />

        <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6, marginBottom: 14 }}>
          <b style={{ color: 'var(--text2)' }}>Apagar conta:</b> remove definitivamente a tua conta e todos os dados associados. Não há recuperação.
        </p>
        <button
          type="button"
          disabled={dangerBusy !== null}
          onClick={async () => {
            if (!window.confirm('Apagar a CONTA e TODOS os dados? Esta acção é permanente e irreversível.')) return
            if (!window.confirm('Última confirmação: queres mesmo apagar a tua conta?')) return
            setDangerBusy('delete')
            const { ok, error } = await deleteAccount()
            if (!ok) {
              emitToast(error || 'Falha ao apagar a conta.', 'error')
              setDangerBusy(null)
              return
            }
            await supabase.auth.signOut()
            clearDraft()
            window.location.href = '/auth'
          }}
          style={{
            width: '100%', border: 'none', borderRadius: 12,
            padding: '12px 16px', background: '#E24B4A', color: '#fff',
            fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13,
            cursor: dangerBusy ? 'not-allowed' : 'pointer', opacity: dangerBusy === 'delete' ? 0.6 : 1,
          }}
        >
          {dangerBusy === 'delete' ? 'A apagar a conta…' : 'Apagar a minha conta'}
        </button>
      </div>
      <Nav />
    </main>
  )
}
