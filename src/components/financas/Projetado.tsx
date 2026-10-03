'use client'
// src/components/financas/Projetado.tsx
//
// Secção "Projetado" das finanças: valores a receber de pessoas (emprestei,
// dividi uma conta, reembolsos, vendas) e valores que devo. Mostra o cartão
// resumo do painel e gere os próprios sheets (lista, formulário, detalhe com
// abatimentos parciais).
//
// A página carrega os dados (precisa deles para o hero e os insights) e passa
// os estados já calculados por `projectionStatuses`; aqui vivem a UI e as
// escritas. O que já foi recebido/pago são transações normais na categoria
// reservada "Projetado", ligadas por `projection_id`.
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  saveProjection, updateProjection, deleteProjection,
  saveTransaction, updateTransaction, deleteTransaction,
} from '@/lib/supabase'
import {
  projectionOpeningType, projectionSettleType,
  type ProjectionStatus, type ProjectionTotals,
} from '@/lib/finance'
import { PROJECTED_CAT } from '@/lib/categories'
import { Sheet, sheetLabel, sheetInp } from '@/components/financas/Sheet'
import type { Projection, ProjectionReason } from '@/types'

type Direction = Projection['direction']

export interface ProjectionTx {
  id: string
  date: string
  type: 'entrada' | 'saida'
  amount: number
  description: string | null
  projection_id: string | null
}

export const REASONS: { key: ProjectionReason; emoji: string; label: string }[] = [
  { key: 'emprestimo', emoji: '🤝', label: 'Empréstimo' },
  { key: 'divisao',    emoji: '🍽️', label: 'Conta dividida' },
  { key: 'reembolso',  emoji: '🧾', label: 'Reembolso' },
  { key: 'venda',      emoji: '🏷️', label: 'Venda' },
  { key: 'outro',      emoji: '📦', label: 'Outro' },
]
const reasonOf = (k: ProjectionReason) => REASONS.find(r => r.key === k) ?? REASONS[REASONS.length - 1]

const DIR = {
  receber: {
    tab: 'A receber', color: 'var(--teal-ink)', sign: '+',
    bg: 'rgba(0,200,150,0.06)', border: 'rgba(0,200,150,0.22)', bar: '#00C896',
    settleVerb: 'Registar recebimento', settled: 'recebido', settledTitle: 'Recebido',
    accountTitle: 'Tirar da conta agora',
    accountBody: 'O dinheiro sai da conta hoje — não conta como gasto.',
  },
  pagar: {
    tab: 'A pagar', color: 'var(--red-ink)', sign: '−',
    bg: 'rgba(226,75,74,0.06)', border: 'rgba(226,75,74,0.22)', bar: '#E24B4A',
    settleVerb: 'Registar pagamento', settled: 'pago', settledTitle: 'Pago',
    accountTitle: 'Entrou na conta agora',
    accountBody: 'O dinheiro entra na conta hoje — não conta como rendimento.',
  },
} as const

const todayISO = () => format(new Date(), 'yyyy-MM-dd')
const shortDate = (d: string) => format(new Date(d + 'T12:00:00'), 'd MMM', { locale: pt })
const parseAmount = (v: string) => parseFloat(v.replace(',', '.'))

/** Legenda do prazo: atrasado, hoje, ou data prevista. */
function dueLabel(s: ProjectionStatus<Projection>, today: string): { text: string; late: boolean } | null {
  const due = s.projection.due_date
  if (s.settled || !due) return null
  if (s.daysOverdue > 0) return { text: `atrasado ${s.daysOverdue} dia${s.daysOverdue !== 1 ? 's' : ''}`, late: true }
  if (due === today) return { text: 'previsto para hoje', late: true }
  return { text: `previsto ${shortDate(due)}`, late: false }
}

function Switch({ on }: { on: boolean }) {
  return (
    <span style={{ flexShrink: 0, width: 40, height: 23, borderRadius: 12, background: on ? '#F5C842' : 'var(--surface-3)', position: 'relative', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 19 : 2, width: 19, height: 19, borderRadius: 10, background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </span>
  )
}

const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  width: '100%', border: 'none', borderRadius: 15, padding: 15, fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 15,
  cursor: enabled ? 'pointer' : 'not-allowed',
  background: enabled ? 'linear-gradient(135deg, #F5C842, #E0A82A)' : 'rgba(var(--ink-rgb),0.06)',
  color: enabled ? '#1A1200' : 'rgba(var(--ink-rgb),0.35)',
})

const chip = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 11, cursor: 'pointer',
  fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
  background: active ? 'rgba(245,200,66,0.10)' : 'rgba(var(--ink-rgb),0.03)',
  border: `1px solid ${active ? 'rgba(245,200,66,0.45)' : 'rgba(var(--ink-rgb),0.10)'}`,
  color: active ? 'var(--gold-ink)' : 'rgba(var(--ink-rgb),0.55)',
})

interface FormState {
  editing: Projection | null
  direction: Direction
  person: string
  reason: ProjectionReason
  amount: string
  date: string
  due: string
  desc: string
  touchAccount: boolean
}

export default function Projetado({
  userId, statuses, txs, totals, fmt, onChanged, notify,
}: {
  userId: string | null
  statuses: ProjectionStatus<Projection>[]
  txs: ProjectionTx[]
  totals: ProjectionTotals
  fmt: (v: number) => string
  /** Recarrega projeções e movimentos na página depois de uma escrita. */
  onChanged: () => Promise<void>
  notify: (msg: string, type?: 'success' | 'error') => void
}) {
  const [showList, setShowList] = useState(false)
  const [tab, setTab] = useState<Direction>('receber')
  const [showSettled, setShowSettled] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleDate, setSettleDate] = useState(todayISO)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const today = todayISO()
  const open = statuses.filter(s => !s.settled)
  const people = useMemo(
    () => Array.from(new Set(statuses.map(s => s.projection.person))).sort((a, b) => a.localeCompare(b, 'pt')),
    [statuses],
  )
  const detail = detailId ? statuses.find(s => s.projection.id === detailId) ?? null : null
  const detailTxs = detail ? txs.filter(t => t.projection_id === detail.projection.id) : []

  function openForm(direction: Direction, editing: Projection | null = null) {
    setForm(editing ? {
      editing, direction: editing.direction, person: editing.person, reason: editing.reason,
      amount: String(editing.amount), date: editing.date, due: editing.due_date ?? '',
      desc: editing.description ?? '', touchAccount: false,
    } : {
      editing: null, direction, person: '', reason: 'emprestimo', amount: '',
      date: today, due: '', desc: '', touchAccount: true,
    })
  }

  function openDetail(s: ProjectionStatus<Projection>) {
    setDetailId(s.projection.id)
    setSettleAmount(String(s.outstanding))
    setSettleDate(today)
    setConfirmDelete(false)
  }

  async function saveForm() {
    if (!form || !userId || busy) return
    const amount = parseAmount(form.amount)
    const person = form.person.trim()
    if (!person || !Number.isFinite(amount) || amount <= 0 || !form.date) return
    setBusy(true)
    const fields = {
      person, reason: form.reason, description: form.desc.trim() || null,
      amount, date: form.date, due_date: form.due || null,
    }
    if (form.editing) {
      const { error } = await updateProjection(form.editing.id, fields)
      if (error) { setBusy(false); return }
      // O movimento de abertura (se existir) acompanha o valor e a data.
      const opening = txs.find(t => t.projection_id === form.editing!.id && t.type === projectionOpeningType(form.editing!.direction))
      if (opening) await updateTransaction(opening.id, {
        amount, date: form.date, description: person + (fields.description ? ` · ${fields.description}` : ''),
      })
    } else {
      const { data, error } = await saveProjection({ user_id: userId, direction: form.direction, ...fields })
      if (error || !data) { setBusy(false); return }
      if (form.touchAccount) {
        const { error: txErr } = await saveTransaction({
          user_id: userId, type: projectionOpeningType(form.direction), category: PROJECTED_CAT,
          description: person + (fields.description ? ` · ${fields.description}` : ''),
          amount, date: form.date, projection_id: (data as Projection).id,
        })
        if (txErr) notify('Registado, mas não consegui lançar o movimento na conta.', 'error')
      }
    }
    await onChanged()
    setBusy(false)
    setTab(form.direction)
    setForm(null)
    notify(form.editing ? 'Atualizado!' : form.direction === 'receber' ? 'Valor a receber registado!' : 'Valor a pagar registado!')
  }

  async function settle() {
    if (!detail || !userId || busy) return
    const amount = parseAmount(settleAmount)
    if (!Number.isFinite(amount) || amount <= 0 || !settleDate) return
    const p = detail.projection
    setBusy(true)
    const { error } = await saveTransaction({
      user_id: userId, type: projectionSettleType(p.direction), category: PROJECTED_CAT,
      description: `${p.person} · ${DIR[p.direction].settled}`,
      amount, date: settleDate, projection_id: p.id,
    })
    if (error) { setBusy(false); return }
    await onChanged()
    setBusy(false)
    const left = Math.max(0, detail.outstanding - amount)
    setSettleAmount(left > 0 ? String(Math.round(left * 100) / 100) : '')
    notify(left <= 0 ? `${p.person}: quitado! 🎉` : `${fmt(amount)} ${DIR[p.direction].settled}.`)
  }

  async function removeTx(id: string) {
    if (busy) return
    setBusy(true)
    const { error } = await deleteTransaction(id)
    if (!error) await onChanged()
    setBusy(false)
  }

  async function removeProjection() {
    if (!detail || busy) return
    setBusy(true)
    const { error } = await deleteProjection(detail.projection.id)
    if (!error) await onChanged()
    setBusy(false)
    if (error) return
    setDetailId(null)
    setConfirmDelete(false)
    notify('Removido.')
  }

  // ── Linha de uma projeção (lista e cartão do painel) ──
  function renderRow(s: ProjectionStatus<Projection>, compact = false) {
    const p = s.projection
    const d = DIR[p.direction]
    const due = dueLabel(s, today)
    const pct = p.amount > 0 ? Math.min(100, Math.round((s.paid / p.amount) * 100)) : 0
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => openDetail(s)}
        style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          background: 'var(--surface-2)', border: `1px solid ${due?.late ? 'rgba(245,200,66,0.35)' : 'rgba(var(--ink-rgb),0.07)'}`,
          borderRadius: 14, padding: '11px 13px', marginBottom: 8, opacity: s.settled ? 0.55 : 1 }}
      >
        <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: d.bg }}>
          {reasonOf(p.reason).emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {compact ? p.person : (p.description || reasonOf(p.reason).label)}
            </span>
            <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 13, fontWeight: 800, color: s.settled ? 'var(--text2)' : d.color }}>
              {s.settled ? '✓' : `${d.sign}${fmt(s.outstanding)}`}
            </span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.settled
              ? `${fmt(p.amount)} · ${d.settled}`
              : s.paid > 0 ? `${fmt(s.paid)} de ${fmt(p.amount)} ${d.settled}` : `desde ${shortDate(p.date)}`}
            {due && <span style={{ color: due.late ? 'var(--gold-ink)' : 'var(--text2)', fontWeight: due.late ? 700 : 500 }}> · {due.text}</span>}
          </div>
          {!s.settled && s.paid > 0 && (
            <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: d.bar, borderRadius: 4 }} />
            </div>
          )}
        </div>
      </button>
    )
  }

  // ── Lista agrupada por pessoa (em aberto) + quitadas ──
  const tabRows = statuses.filter(s => s.projection.direction === tab)
  const tabOpen = tabRows.filter(s => !s.settled)
  const tabSettled = tabRows.filter(s => s.settled)
  const groupMap = new Map<string, ProjectionStatus<Projection>[]>()
  tabOpen.forEach(s => groupMap.set(s.projection.person, [...(groupMap.get(s.projection.person) ?? []), s]))
  const groups = Array.from(groupMap.entries())
    .map(([person, rows]) => ({ person, rows, total: rows.reduce((a, r) => a + r.outstanding, 0) }))
    .sort((a, b) => b.total - a.total)

  return (
    <>
      {/* ── Cartão do painel ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '20px 0 10px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>Projetado</span>
        {statuses.length > 0 && (
          <button onClick={() => setShowList(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--gold-ink)', fontFamily: 'Inter, sans-serif', padding: 0 }}>Gerir ›</button>
        )}
      </div>
      {open.length > 0 ? (
        <div style={{ background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 16, padding: '13px 13px 5px' }}>
          <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
            {(['receber', 'pagar'] as const).map(dir => (
              <button key={dir} type="button" onClick={() => { setTab(dir); setShowList(true) }}
                style={{ flex: 1, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: DIR[dir].bg, border: `1px solid ${DIR[dir].border}`, borderRadius: 13, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dir === 'receber' ? 'Tenho a receber' : 'Devo'}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: DIR[dir].color, marginTop: 3 }}>{fmt(dir === 'receber' ? totals.toReceive : totals.toPay)}</div>
              </button>
            ))}
          </div>
          {open.slice(0, 3).map(s => renderRow(s, true))}
          {open.length > 3 && (
            <button onClick={() => setShowList(true)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--gold-ink)', fontFamily: 'Inter, sans-serif', padding: '2px 0 10px' }}>
              Ver todos ({open.length}) ›
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => openForm('receber')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),0.07)', borderRadius: 16, padding: '13px 15px' }}>
          <span style={{ fontSize: 18 }}>🔮</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-ink)' }}>Registar um valor a receber ou a pagar</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>Empréstimos, contas divididas, reembolsos — sabe quem te deve e a quem deves.</div>
          </div>
          <span style={{ color: 'var(--text3)', fontSize: 14 }}>›</span>
        </button>
      )}

      {/* ── Sheet: lista ── */}
      {showList && !form && !detail && (
        <Sheet tall icon="🔮" title="Projetado" onClose={() => setShowList(false)}
          footer={<button onClick={() => openForm(tab)} style={primaryBtn(true)}>+ Novo {tab === 'receber' ? 'valor a receber' : 'valor a pagar'}</button>}>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 14 }}>
            {(['receber', 'pagar'] as const).map(dir => (
              <button key={dir} onClick={() => setTab(dir)} style={{
                flex: 1, padding: '10px 12px', borderRadius: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif',
                background: tab === dir ? DIR[dir].bg : 'rgba(var(--ink-rgb),0.03)',
                border: `1px solid ${tab === dir ? DIR[dir].border : 'rgba(var(--ink-rgb),0.10)'}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: tab === dir ? 'var(--ink)' : 'var(--text2)' }}>{DIR[dir].tab}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: tab === dir ? DIR[dir].color : 'var(--text2)', marginTop: 2 }}>{fmt(dir === 'receber' ? totals.toReceive : totals.toPay)}</div>
              </button>
            ))}
          </div>

          {groups.map(g => (
            <div key={g.person} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 2px 7px' }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{g.person}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: DIR[tab].color }}>{fmt(g.total)}</span>
              </div>
              {g.rows.map(s => renderRow(s))}
            </div>
          ))}

          {tabOpen.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.6 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{tab === 'receber' ? '🤝' : '✅'}</div>
              {tab === 'receber' ? 'Ninguém te deve nada neste momento.' : 'Não deves nada a ninguém.'}
            </div>
          )}

          {tabSettled.length > 0 && (
            <>
              <button onClick={() => setShowSettled(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', fontFamily: 'Inter, sans-serif', padding: '8px 2px' }}>
                {showSettled ? '▾' : '▸'} Quitados ({tabSettled.length})
              </button>
              {showSettled && tabSettled.map(s => renderRow(s, true))}
            </>
          )}
        </Sheet>
      )}

      {/* ── Sheet: novo / editar ── */}
      {form && (() => {
        const amount = parseAmount(form.amount)
        const canSave = !!form.person.trim() && Number.isFinite(amount) && amount > 0 && !!form.date
        const set = (patch: Partial<FormState>) => setForm(f => f ? { ...f, ...patch } : f)
        const d = DIR[form.direction]
        return (
          <Sheet icon="🔮" title={form.editing ? 'Editar' : form.direction === 'receber' ? 'Valor a receber' : 'Valor a pagar'} onClose={() => setForm(null)}
            footer={<button onClick={saveForm} disabled={busy || !canSave} style={primaryBtn(canSave && !busy)}>{busy ? 'A guardar…' : 'Guardar'}</button>}>
            {!form.editing && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                {(['receber', 'pagar'] as const).map(dir => (
                  <button key={dir} onClick={() => set({ direction: dir })} style={{
                    flex: 1, padding: '11px', borderRadius: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13,
                    background: form.direction === dir ? DIR[dir].bg : 'rgba(var(--ink-rgb),0.03)',
                    border: `1px solid ${form.direction === dir ? DIR[dir].border : 'rgba(var(--ink-rgb),0.10)'}`,
                    color: form.direction === dir ? DIR[dir].color : 'rgba(var(--ink-rgb),0.55)',
                  }}>{dir === 'receber' ? '↓ Tenho a receber' : '↑ Devo'}</button>
                ))}
              </div>
            )}

            <label style={sheetLabel}>{form.direction === 'receber' ? 'Quem te deve' : 'A quem deves'}</label>
            <input value={form.person} onChange={e => set({ person: e.target.value })} placeholder="Ex: Mãe, Ana, João…" list="projetado-people" style={sheetInp} autoFocus={!form.editing} />
            <datalist id="projetado-people">{people.map(p => <option key={p} value={p} />)}</datalist>
            {!form.editing && people.length > 0 && !form.person && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {people.slice(0, 6).map(p => <button key={p} onClick={() => set({ person: p })} style={chip(false)}>{p}</button>)}
              </div>
            )}

            <label style={sheetLabel}>Motivo</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {REASONS.map(r => (
                // Só o empréstimo mexe na conta por defeito: numa conta
                // dividida ou reembolso a despesa já foi lançada à parte.
                <button key={r.key} onClick={() => set({ reason: r.key, ...(form.editing ? {} : { touchAccount: r.key === 'emprestimo' }) })} style={chip(form.reason === r.key)}>
                  {r.emoji} {r.label}
                </button>
              ))}
            </div>

            <label style={sheetLabel}>Valor (€)</label>
            <input type="number" step="0.01" value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" style={{ ...sheetInp, fontSize: 18, fontWeight: 700 }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={sheetLabel}>Data</label>
                <input type="date" value={form.date} onChange={e => set({ date: e.target.value })} style={sheetInp} />
              </div>
              <div>
                <label style={sheetLabel}>Previsto para</label>
                <input type="date" value={form.due} onChange={e => set({ due: e.target.value })} style={sheetInp} aria-label="Data prevista (opcional)" />
              </div>
            </div>

            <label style={sheetLabel}>Descrição</label>
            <input value={form.desc} onChange={e => set({ desc: e.target.value })} placeholder="Opcional — ex: jantar de sábado" style={sheetInp} />

            {!form.editing && (
              <button onClick={() => set({ touchAccount: !form.touchAccount })} role="switch" aria-checked={form.touchAccount} aria-label={d.accountTitle}
                style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', marginTop: 16, padding: '12px 14px', borderRadius: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left',
                  background: form.touchAccount ? 'rgba(245,200,66,0.08)' : 'var(--surface-2)',
                  border: `1px solid ${form.touchAccount ? 'rgba(245,200,66,0.4)' : 'rgba(var(--ink-rgb),0.10)'}` }}>
                <span style={{ fontSize: 17 }}>💳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{d.accountTitle}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                    {form.touchAccount ? d.accountBody : 'Só fica registado — a conta não mexe (ex.: a despesa já foi lançada).'}
                  </div>
                </div>
                <Switch on={form.touchAccount} />
              </button>
            )}
          </Sheet>
        )
      })()}

      {/* ── Sheet: detalhe + abatimentos ── */}
      {detail && !form && (() => {
        const p = detail.projection
        const d = DIR[p.direction]
        const due = dueLabel(detail, today)
        const pct = p.amount > 0 ? Math.min(100, Math.round((detail.paid / p.amount) * 100)) : 0
        const amt = parseAmount(settleAmount)
        const canSettle = Number.isFinite(amt) && amt > 0 && !!settleDate && !busy
        return (
          <Sheet icon={reasonOf(p.reason).emoji} title={p.person} onClose={() => setDetailId(null)}>
            <div style={{ textAlign: 'center', margin: '12px 0 4px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {detail.settled ? 'Quitado' : p.direction === 'receber' ? 'Falta receber' : 'Falta pagar'}
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px', color: detail.settled ? 'var(--text2)' : d.color }}>
                {fmt(detail.outstanding)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>
                {reasonOf(p.reason).label}{p.description ? ` · ${p.description}` : ''} · {fmt(p.amount)} desde {shortDate(p.date)}
              </div>
              {due && <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, color: due.late ? 'var(--gold-ink)' : 'var(--text2)' }}>{due.text}</div>}
              <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 6, overflow: 'hidden', margin: '12px 0 0' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: d.bar, borderRadius: 6 }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text2)', marginTop: 5 }}>{fmt(detail.paid)} {d.settled} ({pct}%)</div>
            </div>

            {!detail.settled && (
              <>
                <label style={sheetLabel}>{d.settleVerb}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input type="number" step="0.01" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} aria-label="Valor" style={{ ...sheetInp, fontWeight: 700 }} />
                  <input type="date" value={settleDate} onChange={e => setSettleDate(e.target.value)} aria-label="Data" style={sheetInp} />
                </div>
                <button onClick={settle} disabled={!canSettle} style={{ ...primaryBtn(canSettle), marginTop: 10, padding: 13, fontSize: 14 }}>
                  {busy ? 'A guardar…' : amt >= detail.outstanding ? `${d.settleVerb} · quitar` : d.settleVerb}
                </button>
              </>
            )}

            <label style={sheetLabel}>Histórico</label>
            {detailTxs.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>Ainda sem movimentos — só está registado.</div>
            )}
            {detailTxs.map(t => {
              const isOpening = t.type === projectionOpeningType(p.direction)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(var(--ink-rgb),0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>
                      {isOpening ? (p.direction === 'receber' ? 'Saiu da conta' : 'Entrou na conta') : d.settledTitle}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text2)' }}>{shortDate(t.date)}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: t.type === 'entrada' ? 'var(--green-ink)' : 'var(--red-ink)' }}>
                    {t.type === 'entrada' ? '+' : '−'}{fmt(t.amount)}
                  </span>
                  {!isOpening && (
                    <button onClick={() => removeTx(t.id)} disabled={busy} aria-label="Apagar abatimento"
                      style={{ flexShrink: 0, border: '1px solid rgba(226,75,74,0.25)', background: 'transparent', color: '#E24B4A', borderRadius: 9, padding: '5px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  )}
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => openForm(p.direction, p)} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(var(--ink-rgb),0.12)', background: 'var(--surface-2)', color: 'var(--text1)', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✏️ Editar</button>
              <button onClick={() => setConfirmDelete(true)} style={{ flex: 1, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(226,75,74,0.25)', background: 'transparent', color: '#E24B4A', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Apagar</button>
            </div>
            {confirmDelete && (
              <div style={{ marginTop: 12, background: 'rgba(226,75,74,0.06)', border: '1px solid rgba(226,75,74,0.25)', borderRadius: 13, padding: '12px 14px' }}>
                <div style={{ fontSize: 12.5, color: 'var(--text1)', lineHeight: 1.5 }}>
                  Apagar este registo{detailTxs.length > 0 ? ` e os ${detailTxs.length} movimento${detailTxs.length !== 1 ? 's' : ''} ligado${detailTxs.length !== 1 ? 's' : ''} (o balanço dos meses muda)` : ''}? É irreversível.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: '1px solid rgba(var(--ink-rgb),0.12)', background: 'var(--surface-2)', color: 'var(--text1)', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={removeProjection} disabled={busy} style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: 'none', background: '#E24B4A', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{busy ? 'A apagar…' : 'Apagar'}</button>
                </div>
              </div>
            )}
          </Sheet>
        )
      })()}
    </>
  )
}
