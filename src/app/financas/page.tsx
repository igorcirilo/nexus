'use client'
// src/app/financas/page.tsx
import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import Nav from '@/components/Nav'
import { supabase, getProfile, getTransactions, saveTransaction, deleteTransaction } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { pt } from 'date-fns/locale'
import type { Profile } from '@/types'

type Tx = { id: string; date: string; type: 'entrada' | 'saida'; category: string; description: string | null; amount: number }

const CATEGORIES_IN  = ['Salário', 'Freelance', 'Investimento', 'Presente', 'Outro']
const CATEGORIES_OUT = ['Alimentação', 'Transporte', 'Habitação', 'Saúde', 'Lazer', 'Roupa', 'Educação', 'Poupança', 'Outro']

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border)',
  borderRadius: 12, padding: '12px 14px', color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
}

export default function FinancasPage() {
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [txs,       setTxs]       = useState<Tx[]>([])
  const [userId,    setUserId]     = useState<string | null>(null)
  const [showForm,  setShowForm]   = useState(false)
  const [txType,    setTxType]     = useState<'entrada' | 'saida'>('saida')
  const [fCat,      setFCat]       = useState('')
  const [fDesc,     setFDesc]      = useState('')
  const [fAmount,   setFAmount]    = useState('')
  const [fDate,     setFDate]      = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving,    setSaving]     = useState(false)
  const [toast,     setToast]      = useState('')
  const [ready,     setReady]      = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth'; return }
      setUserId(user.id)
      const [prof, data] = await Promise.all([getProfile(user.id), getTransactions(user.id, 2)])
      setProfile(prof)
      setTxs(data as Tx[])
      setTimeout(() => setReady(true), 60)
    })
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2400) }

  async function addTx() {
    if (!userId || !fAmount || !fCat) return
    setSaving(true)
    await saveTransaction({
      user_id: userId, type: txType, category: fCat,
      description: fDesc || null, amount: parseFloat(fAmount),
      date: fDate,
    })
    const data = await getTransactions(userId, 2)
    setTxs(data as Tx[])
    setFAmount(''); setFDesc(''); setFCat('')
    setShowForm(false)
    showToast('Transacção adicionada!')
    setSaving(false)
  }

  async function removeTx(id: string) {
    await deleteTransaction(id)
    setTxs(t => t.filter(x => x.id !== id))
    showToast('Removido.')
  }

  // Métricas do mês actual
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(new Date()),   'yyyy-MM-dd')
  const thisMonth  = txs.filter(t => t.date >= monthStart && t.date <= monthEnd)
  const totalIn    = thisMonth.filter(t => t.type === 'entrada').reduce((a, t) => a + t.amount, 0)
  const totalOut   = thisMonth.filter(t => t.type === 'saida').reduce((a, t) => a + t.amount, 0)
  const balance    = totalIn - totalOut
  const savedPct   = totalIn > 0 ? Math.round((totalIn - totalOut) / totalIn * 100) : 0

  // Gráfico por categoria (saídas)
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    thisMonth.filter(t => t.type === 'saida').forEach(t => {
      map[t.category] = (map[t.category] ?? 0) + t.amount
    })
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value).slice(0, 6)
  }, [txs])

  // Meta de poupança — cast via unknown para evitar erro de tipo
  const p = profile as unknown as Record<string, number>
  const savingsGoal    = p?.fin_monthly_save    ?? 0
  const currentSavings = p?.fin_current_savings ?? 0
  const reserveGoal    = p?.fin_reserve_goal    ?? 0

  const fmt = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

  return (
    <main style={{ paddingBottom: 100, minHeight: '100vh' }}>

      {toast && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)', borderRadius: 12, padding: '10px 18px', fontSize: 13, color: 'var(--teal)', zIndex: 200, whiteSpace: 'nowrap' }}>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '28px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 3 }}>Finanças</h1>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{format(new Date(), 'MMMM yyyy', { locale: pt })}</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: 'var(--gold)', color: 'var(--bg0)', border: 'none', borderRadius: 12, padding: '9px 16px', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Registar
        </button>
      </div>

      {/* Métricas do mês */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px 20px 0' }}>
        <div style={{ background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.2)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Entradas</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--teal)' }}>{fmt(totalIn)}</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '0.5px solid rgba(226,75,74,.2)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Saídas</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#E24B4A' }}>{fmt(totalOut)}</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: `0.5px solid ${balance >= 0 ? 'rgba(232,168,56,.2)' : 'rgba(226,75,74,.2)'}`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Saldo do mês</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: balance >= 0 ? 'var(--gold)' : '#E24B4A' }}>{fmt(balance)}</div>
        </div>
        <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Taxa de poupança</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: savedPct >= 20 ? 'var(--teal)' : savedPct >= 10 ? 'var(--gold)' : 'var(--text2)' }}>
            {savedPct}%
          </div>
        </div>
      </div>

      {/* Metas */}
      {(savingsGoal > 0 || reserveGoal > 0) && (
        <div style={{ margin: '12px 20px 0', padding: '14px 16px', borderRadius: 14, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Metas financeiras</div>
          {savingsGoal > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: 'var(--text2)' }}>Poupança mensal</span>
                <span style={{ color: balance >= savingsGoal ? 'var(--teal)' : 'var(--gold)', fontWeight: 600 }}>{fmt(Math.max(0, balance))} / {fmt(savingsGoal)}</span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5 }}>
                <div style={{ height: '100%', borderRadius: 100, background: balance >= savingsGoal ? 'var(--teal)' : 'var(--gold)', width: `${Math.min(100, Math.round(Math.max(0, balance) / savingsGoal * 100))}%`, transition: 'width .5s' }} />
              </div>
            </div>
          )}
          {reserveGoal > 0 && currentSavings > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: 'var(--text2)' }}>Reserva de emergência</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(currentSavings)} / {fmt(reserveGoal)}</span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 100, height: 5 }}>
                <div style={{ height: '100%', borderRadius: 100, background: 'var(--accent)', width: `${Math.min(100, Math.round(currentSavings / reserveGoal * 100))}%`, transition: 'width .5s' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gráfico por categoria */}
      {byCategory.length > 0 && (
        <div style={{ margin: '12px 20px 0', padding: '14px 16px', borderRadius: 16, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Saídas por categoria</div>
          <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
            {ready && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byCategory} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9BA0B0', fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [fmt(v), 'Valor']} contentStyle={{ background: '#1C2030', border: '0.5px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#F0EDE8', fontSize: 12 }} />
                  <Bar dataKey="value" fill="#E24B4A" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Lista de transacções */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
          Transacções recentes
        </div>
        {txs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 13 }}>
            Nenhuma transacção registada. Começa por adicionar uma entrada ou saída.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {txs.slice(0, 30).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, background: t.type === 'entrada' ? 'rgba(30,203,180,.1)' : 'rgba(226,75,74,.1)' }}>
                {t.type === 'entrada' ? '↓' : '↑'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text1)', marginBottom: 2 }}>{t.category}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {t.description && `${t.description} · `}{format(new Date(t.date + 'T12:00:00'), 'd MMM', { locale: pt })}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: t.type === 'entrada' ? 'var(--teal)' : '#E24B4A' }}>
                  {t.type === 'entrada' ? '+' : '-'}{fmt(t.amount)}
                </div>
              </div>
              <button onClick={() => removeTx(t.id)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg3)', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, flexShrink: 0 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ width: '100%', maxWidth: 448, margin: '0 auto', background: 'var(--bg1)', borderRadius: '20px 20px 0 0', borderTop: '0.5px solid var(--border)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>Nova transacção</h2>
              <button onClick={() => setShowForm(false)} style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--bg3)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text2)' }}>×</button>
            </div>

            {/* Tipo */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['entrada', 'saida'] as const).map(t => (
                <button key={t} onClick={() => { setTxType(t); setFCat('') }} style={{
                  flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, transition: 'all .15s',
                  background: txType === t ? (t === 'entrada' ? 'var(--teal)' : '#E24B4A') : 'var(--bg2)',
                  color: txType === t ? 'var(--bg0)' : 'var(--text2)',
                }}>
                  {t === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                </button>
              ))}
            </div>

            {/* Valor */}
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Valor (€)</label>
            <input type="number" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)}
              placeholder="0.00" style={{ ...inp, marginBottom: 12, fontSize: 18, fontFamily: 'Syne, sans-serif', fontWeight: 600 }} />

            {/* Categoria */}
            <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Categoria</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(txType === 'entrada' ? CATEGORIES_IN : CATEGORIES_OUT).map(cat => (
                <button key={cat} onClick={() => setFCat(cat)} style={{
                  padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
                  background: fCat === cat ? (txType === 'entrada' ? 'var(--teal)' : '#E24B4A') : 'var(--bg2)',
                  color: fCat === cat ? 'var(--bg0)' : 'var(--text2)',
                  outline: fCat === cat ? 'none' : '0.5px solid var(--border)',
                }}>{cat}</button>
              ))}
            </div>

            {/* Descrição + Data */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Descrição</label>
                <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Opcional" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Data</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inp} />
              </div>
            </div>

            <button onClick={addTx} disabled={saving || !fAmount || !fCat} style={{
              width: '100%', border: 'none', borderRadius: 14, padding: 14,
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              background: (fAmount && fCat) ? 'var(--gold)' : 'var(--bg3)',
              color: (fAmount && fCat) ? 'var(--bg0)' : 'var(--text3)',
            }}>{saving ? 'A guardar…' : 'Guardar transacção'}</button>
          </div>
        </div>
      )}

      <Nav />
    </main>
  )
}
