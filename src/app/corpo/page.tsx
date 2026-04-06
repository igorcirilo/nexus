'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import Nav from '@/components/Nav'
import FileImportModal from '@/components/FileImportModal'
import {
  supabase,
  getDietPlans,
  getTrainingPlans,
  saveDietPlan,
  saveTrainingPlan,
} from '@/lib/supabase'
import type { DietPlan, FileImportResult, TrainingPlan } from '@/types'

type BodyTab = 'treino' | 'dieta'

const card: CSSProperties = {
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 16,
  padding: 14,
}

export default function CorpoPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<BodyTab>('treino')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [showTrainingImport, setShowTrainingImport] = useState(false)
  const [showDietImport, setShowDietImport] = useState(false)
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([])
  const [dietPlans, setDietPlans] = useState<DietPlan[]>([])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2600)
  }

  async function loadBodyData(uid: string) {
    const [training, diet] = await Promise.all([
      getTrainingPlans(uid),
      getDietPlans(uid),
    ])
    setTrainingPlans(training as TrainingPlan[])
    setDietPlans(diet as DietPlan[])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = '/auth'
        return
      }

      setUserId(user.id)
      await loadBodyData(user.id)
      setLoading(false)
    })
  }, [])

  const trainingSummary = useMemo(() => {
    const latest = trainingPlans[0]
    return {
      total: trainingPlans.length,
      latestTitle: latest?.title ?? 'Sem plano importado',
      latestDate: latest?.created_at ? format(new Date(latest.created_at), "d MMM", { locale: pt }) : '—',
    }
  }, [trainingPlans])

  const dietSummary = useMemo(() => {
    const latest = dietPlans[0]
    return {
      total: dietPlans.length,
      latestTitle: latest?.title ?? 'Sem plano importado',
      latestDate: latest?.created_at ? format(new Date(latest.created_at), "d MMM", { locale: pt }) : '—',
    }
  }, [dietPlans])

  async function handleTrainingImport(result: FileImportResult) {
    if (!userId) return

    const summary = result.kind === 'pdf'
      ? `PDF com ${result.pageCount} página(s)`
      : `${result.sheets.length} folha(s) · ${result.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0)} linhas`

    const { error } = await saveTrainingPlan({
      user_id: userId,
      title: `Treino importado · ${result.meta.fileName}`,
      source_type: result.kind,
      source_file_name: result.meta.fileName,
      summary,
      raw_content: result,
    })

    if (error) {
      showToast('Erro ao guardar treino.')
      return
    }

    await loadBodyData(userId)
    setShowTrainingImport(false)
    showToast('Plano de treino importado!')
  }

  async function handleDietImport(result: FileImportResult) {
    if (!userId) return

    const summary = result.kind === 'pdf'
      ? `PDF com ${result.pageCount} página(s)`
      : `${result.sheets.length} folha(s) · ${result.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0)} linhas`

    const { error } = await saveDietPlan({
      user_id: userId,
      title: `Dieta importada · ${result.meta.fileName}`,
      source_type: result.kind,
      source_file_name: result.meta.fileName,
      summary,
      raw_content: result,
    })

    if (error) {
      showToast('Erro ao guardar dieta.')
      return
    }

    await loadBodyData(userId)
    setShowDietImport(false)
    showToast('Plano de dieta importado!')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text3)' }}>a carregar…</div>
      </div>
    )
  }

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.35)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: 'var(--teal)' }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ padding: '28px 20px 0' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Corpo</h1>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Treino e dieta num único sítio, com importação e consulta rápida.</p>
      </div>

      <div style={{ padding: '14px 20px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Treino</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--teal)' }}>{trainingSummary.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{trainingSummary.latestTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Última importação: {trainingSummary.latestDate}</div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Dieta</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--gold)' }}>{dietSummary.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{dietSummary.latestTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Última importação: {dietSummary.latestDate}</div>
        </div>
      </div>

      <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 14, padding: 4, gap: 3, margin: '14px 20px 0', border: '0.5px solid var(--border)' }}>
        {[
          { key: 'treino' as BodyTab, label: 'Treino', icon: '🏋️' },
          { key: 'dieta' as BodyTab, label: 'Dieta', icon: '🥗' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              background: tab === item.key ? 'var(--bg1)' : 'transparent',
              color: tab === item.key ? 'var(--gold)' : 'var(--text3)',
              fontFamily: 'Syne, sans-serif',
              fontWeight: tab === item.key ? 700 : 500,
              fontSize: 12,
            }}
          >
            <span style={{ marginRight: 6 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'treino' && (
        <section style={{ padding: '14px 20px 0', display: 'grid', gap: 12 }}>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>Importar treino</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Aceita PDF, XLSX, XLS e CSV com preview antes de guardar.</div>
            </div>
            <button onClick={() => setShowTrainingImport(true)} style={{ background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 12, padding: '10px 14px', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
              Importar
            </button>
          </div>

          {trainingPlans.length === 0 ? (
            <div style={card}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Ainda não tens planos de treino importados.</div>
            </div>
          ) : (
            trainingPlans.map((plan) => (
              <div key={plan.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>{plan.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{plan.summary ?? 'Sem resumo'}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{format(new Date(plan.created_at), "d MMM yyyy", { locale: pt })}</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>Ficheiro: {plan.source_file_name ?? '—'}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>Origem: {plan.source_type === 'pdf' ? 'PDF' : 'Planilha'}</div>
              </div>
            ))
          )}
        </section>
      )}

      {tab === 'dieta' && (
        <section style={{ padding: '14px 20px 0', display: 'grid', gap: 12 }}>
          <div style={{ ...card, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16 }}>Importar dieta</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Aceita PDF e planilhas para guardar plano alimentar com preview.</div>
            </div>
            <button onClick={() => setShowDietImport(true)} style={{ background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 12, padding: '10px 14px', fontFamily: 'Syne, sans-serif', fontWeight: 700, cursor: 'pointer' }}>
              Importar
            </button>
          </div>

          {dietPlans.length === 0 ? (
            <div style={card}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Ainda não tens planos de dieta importados.</div>
            </div>
          ) : (
            dietPlans.map((plan) => (
              <div key={plan.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>{plan.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{plan.summary ?? 'Sem resumo'}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{format(new Date(plan.created_at), "d MMM yyyy", { locale: pt })}</div>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text2)' }}>Ficheiro: {plan.source_file_name ?? '—'}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>Origem: {plan.source_type === 'pdf' ? 'PDF' : 'Planilha'}</div>
              </div>
            ))
          )}
        </section>
      )}

      <FileImportModal
        open={showTrainingImport}
        title="Importar treino"
        kind="mixed"
        onClose={() => setShowTrainingImport(false)}
        onConfirm={handleTrainingImport}
        confirmLabel="Guardar treino"
      />

      <FileImportModal
        open={showDietImport}
        title="Importar dieta"
        kind="mixed"
        onClose={() => setShowDietImport(false)}
        onConfirm={handleDietImport}
        confirmLabel="Guardar dieta"
      />

      <Nav />
    </main>
  )
}
