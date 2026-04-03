'use client'
// src/components/QuickAction.tsx

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createHabitQuick, saveFocusSession, saveTransaction, supabase } from '@/lib/supabase'
import type { HabitArea } from '@/types'

const HABIT_AREAS: Array<{ key: HabitArea; label: string; icon: string; color: string }> = [
  { key: 'corpo', label: 'Corpo & Saúde', icon: '💪', color: '#1ECBB4' },
  { key: 'produtividade', label: 'Produtividade', icon: '🎯', color: '#7F77DD' },
  { key: 'idiomas', label: 'Idiomas', icon: '🗣️', color: '#E24B4A' },
  { key: 'carreira', label: 'Carreira', icon: '📚', color: '#E8A838' },
  { key: 'financas', label: 'Finanças', icon: '💰', color: '#1D9E75' },
  { key: 'emocoes', label: 'Emoções', icon: '🧘', color: '#D4537E' },
  { key: 'relacionamentos', label: 'Relacionamentos', icon: '🤝', color: '#85B7EB' },
]

const CATEGORIES_IN = ['Salário', 'Freelance', 'Investimento', 'Rendas', 'Presente', 'Outro']
const CATEGORIES_OUT = ['Alimentação', 'Transporte', 'Habitação', 'Saúde', 'Lazer', 'Roupa', 'Educação', 'Assinaturas', 'Poupança', 'Outro']

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 12,
  padding: '11px 14px',
  color: 'var(--text1)',
  fontFamily: 'DM Sans, sans-serif',
  fontSize: 14,
  outline: 'none',
}

export default function QuickAction() {
  const router = useRouter()
  const pathname = usePathname()
  const [userId, setUserId] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [showHabit, setShowHabit] = useState(false)
  const [showTransaction, setShowTransaction] = useState(false)
  const [toast, setToast] = useState('')

  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [pomodoroTask, setPomodoroTask] = useState('')
  const [pomodoroSaved, setPomodoroSaved] = useState(false)

  const [habitName, setHabitName] = useState('')
  const [habitArea, setHabitArea] = useState<HabitArea>('produtividade')
  const [habitXP, setHabitXP] = useState('10')
  const [habitWindow, setHabitWindow] = useState('')
  const [habitSaving, setHabitSaving] = useState(false)

  const [txType, setTxType] = useState<'entrada' | 'saida'>('saida')
  const [txCategory, setTxCategory] = useState('Alimentação')
  const [txDescription, setTxDescription] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txDate, setTxDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [txSaving, setTxSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [])

  useEffect(() => {
    setOpen(false)
    setShowHabit(false)
    setShowTransaction(false)
  }, [pathname])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          window.clearInterval(timer)
          setRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-quickaction]')) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setShowPomodoro(false)
        setShowHabit(false)
        setShowTransaction(false)
      }
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (txType === 'entrada' && !CATEGORIES_IN.includes(txCategory)) {
      setTxCategory(CATEGORIES_IN[0])
    }
    if (txType === 'saida' && !CATEGORIES_OUT.includes(txCategory)) {
      setTxCategory(CATEGORIES_OUT[0])
    }
  }, [txType, txCategory])

  const timeLabel = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
    const secs = (secondsLeft % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }, [secondsLeft])

  const pct = Math.round(((25 * 60 - secondsLeft) / (25 * 60)) * 100)

  function resetHabitForm() {
    setHabitName('')
    setHabitArea('produtividade')
    setHabitXP('10')
    setHabitWindow('')
  }

  function resetTxForm() {
    setTxType('saida')
    setTxCategory('Alimentação')
    setTxDescription('')
    setTxAmount('')
    setTxDate(format(new Date(), 'yyyy-MM-dd'))
  }

  async function handleSaveHabit() {
    if (!userId || !habitName.trim()) return
    const xp = Number(habitXP)
    if (!Number.isFinite(xp) || xp < 1) return

    setHabitSaving(true)
    const { error } = await createHabitQuick({
      user_id: userId,
      name: habitName,
      area: habitArea,
      xp_reward: Math.round(xp),
      time_window: habitWindow,
    })
    setHabitSaving(false)

    if (error) {
      setToast('Não foi possível criar o hábito.')
      return
    }

    resetHabitForm()
    setShowHabit(false)
    setToast('Hábito criado.')
    router.push('/habitos')
  }

  async function handleSaveTransaction() {
    if (!userId || !txAmount.trim()) return
    const amount = Number(txAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) return

    setTxSaving(true)
    const { error } = await saveTransaction({
      user_id: userId,
      type: txType,
      category: txCategory,
      description: txDescription.trim() || null,
      amount,
      date: txDate,
    })
    setTxSaving(false)

    if (error) {
      setToast('Não foi possível guardar a transação.')
      return
    }

    resetTxForm()
    setShowTransaction(false)
    setToast('Transação guardada.')
    router.push('/financas')
  }

  async function savePomodoroIfNeeded() {
    if (!userId || secondsLeft > 0 || pomodoroSaved) return
    await saveFocusSession(userId, 25, pomodoroTask.trim() || undefined)
    setPomodoroSaved(true)
    setToast('Sessão de foco guardada. +10 XP')
  }

  const actions = [
    { label: 'Hábito', icon: '✅', color: 'var(--teal)', bg: 'rgba(30,203,180,.12)', onClick: () => { setShowHabit(true); setOpen(false) } },
    { label: 'Transação', icon: '💰', color: 'var(--gold)', bg: 'rgba(232,168,56,.12)', onClick: () => { setShowTransaction(true); setOpen(false) } },
    { label: 'Pomodoro', icon: '⏱', color: 'var(--accent)', bg: 'rgba(127,119,221,.12)', onClick: () => { setShowPomodoro(true); setOpen(false) } },
  ]

  return (
    <>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.38)',
          borderRadius: 12, padding: '10px 18px', fontSize: 13, color: 'var(--teal)',
          whiteSpace: 'nowrap', boxShadow: '0 8px 30px rgba(0,0,0,.35)',
        }}>
          ✓ {toast}
        </div>
      )}

      {showHabit && (
        <div onClick={() => !habitSaving && setShowHabit(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '90vh', background: 'var(--bg1)', borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>Novo hábito</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Criação rápida sem sair da página.</div>
            </div>
            <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Nome</div>
                <input value={habitName} onChange={e => setHabitName(e.target.value)} placeholder="Ex: Ler 10 páginas" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Área</div>
                <select value={habitArea} onChange={e => setHabitArea(e.target.value as HabitArea)} style={inputStyle}>
                  {HABIT_AREAS.map(area => <option key={area.key} value={area.key}>{area.icon} {area.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>XP</div>
                  <input value={habitXP} onChange={e => setHabitXP(e.target.value)} type="number" min={1} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Janela</div>
                  <input value={habitWindow} onChange={e => setHabitWindow(e.target.value)} placeholder="manhã / tarde / noite" style={inputStyle} />
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 24px 48px', background: 'var(--bg1)', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowHabit(false)} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: '0.5px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveHabit} disabled={habitSaving || !habitName.trim()} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: 'var(--teal)', color: '#0D0F14', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: habitSaving || !habitName.trim() ? 0.6 : 1 }}>
                {habitSaving ? 'A guardar…' : 'Guardar hábito'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransaction && (
        <div onClick={() => !txSaving && setShowTransaction(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '90vh', background: 'var(--bg1)', borderTopLeftRadius: 24, borderTopRightRadius: 24, border: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>Nova transação</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Registo rápido financeiro sem trocar de página.</div>
            </div>
            <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['saida', 'entrada'] as const).map(type => (
                  <button key={type} onClick={() => setTxType(type)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', background: txType === type ? (type === 'saida' ? '#E24B4A' : 'var(--teal)') : 'var(--bg3)', color: txType === type ? '#fff' : 'var(--text2)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>
                    {type === 'saida' ? 'Saída' : 'Entrada'}
                  </button>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Categoria</div>
                <select value={txCategory} onChange={e => setTxCategory(e.target.value)} style={inputStyle}>
                  {(txType === 'entrada' ? CATEGORIES_IN : CATEGORIES_OUT).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Valor</div>
                  <input value={txAmount} onChange={e => setTxAmount(e.target.value)} type="number" min="0.01" step="0.01" placeholder="0,00" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Data</div>
                  <input value={txDate} onChange={e => setTxDate(e.target.value)} type="date" style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Descrição</div>
                <input value={txDescription} onChange={e => setTxDescription(e.target.value)} placeholder="Opcional" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '12px 24px 48px', background: 'var(--bg1)', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 10 }}>
              <button onClick={() => setShowTransaction(false)} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: '0.5px solid var(--border)', background: 'var(--bg3)', color: 'var(--text2)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveTransaction} disabled={txSaving || !txAmount.trim()} style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: 'var(--gold)', color: '#0D0F14', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: txSaving || !txAmount.trim() ? 0.6 : 1 }}>
                {txSaving ? 'A guardar…' : 'Guardar transação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPomodoro && (
        <div onClick={() => { setShowPomodoro(false); setRunning(false) }} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(13,15,20,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg1)', border: '0.5px solid rgba(127,119,221,.3)', borderRadius: 24, padding: '32px 28px', width: 300, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700, marginBottom: 20 }}>Pomodoro</div>
            <input value={pomodoroTask} onChange={e => setPomodoroTask(e.target.value)} placeholder="Tarefa opcional" style={{ ...inputStyle, marginBottom: 18, textAlign: 'left' }} />
            <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto 24px' }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="68" fill="none" stroke="var(--bg3)" strokeWidth="8" />
                <circle cx="80" cy="80" r="68" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 68}`}
                  strokeDashoffset={`${2 * Math.PI * 68 * (1 - pct / 100)}`}
                  transform="rotate(-90 80 80)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 38, color: 'var(--text1)', lineHeight: 1, letterSpacing: '-1px' }}>{timeLabel}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {running ? 'em foco' : secondsLeft === 0 ? 'sessão concluída' : secondsLeft === 25 * 60 ? 'pronto' : 'pausado'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => {
                if (secondsLeft === 0) {
                  setSecondsLeft(25 * 60)
                  setPomodoroSaved(false)
                }
                setRunning(v => !v)
              }} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: running ? 'var(--bg3)' : 'var(--accent)', color: running ? 'var(--text2)' : 'white', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {running ? 'Pausar' : secondsLeft === 0 ? 'Nova sessão' : 'Iniciar'}
              </button>
              <button onClick={() => { setRunning(false); setSecondsLeft(25 * 60); setPomodoroSaved(false) }} style={{ width: 48, borderRadius: 14, border: '0.5px solid var(--border)', background: 'var(--bg3)', color: 'var(--text3)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}>↺</button>
            </div>
            {secondsLeft === 0 && (
              <button onClick={savePomodoroIfNeeded} disabled={pomodoroSaved} style={{ marginTop: 12, width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', background: pomodoroSaved ? 'var(--bg3)' : 'var(--teal)', color: pomodoroSaved ? 'var(--text2)' : '#0D0F14', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {pomodoroSaved ? 'Sessão guardada' : 'Guardar sessão +10 XP'}
              </button>
            )}
            <button onClick={() => { setShowPomodoro(false); setRunning(false) }} style={{ marginTop: 16, background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Fechar</button>
          </div>
        </div>
      )}

      <div data-quickaction style={{ position: 'fixed', bottom: 88, right: 20, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        {open && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'qaMenuIn .18s ease' }}>
            {actions.map(a => (
              <button key={a.label} onClick={a.onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg1)', border: `0.5px solid ${a.color}44`, borderRadius: 14, padding: '10px 14px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,.35)', whiteSpace: 'nowrap' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{a.icon}</div>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, color: a.color }}>＋ {a.label}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setOpen(v => !v)} style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: open ? 'var(--bg3)' : 'linear-gradient(135deg, var(--teal), var(--accent))', color: '#fff', fontSize: open ? 22 : 26, fontWeight: 300, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: open ? '0 2px 12px rgba(0,0,0,.3)' : '0 4px 20px rgba(30,203,180,.35)', transform: open ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform .2s ease, background .2s ease', flexShrink: 0 }} aria-label="Acção rápida">＋</button>
        <style jsx>{`
          @keyframes qaMenuIn { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        `}</style>
      </div>
    </>
  )
}
