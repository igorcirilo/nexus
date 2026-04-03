'use client'
// src/components/QuickAction.tsx

import { useState, useEffect, useMemo } from 'react'

export default function QuickAction() {
  const [open, setOpen] = useState(false)
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { window.clearInterval(timer); setRunning(false); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const timeLabel = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
    const secs = (secondsLeft % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }, [secondsLeft])

  const pct = Math.round(((25 * 60 - secondsLeft) / (25 * 60)) * 100)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-quickaction]')) setOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  const actions = [
    { label: 'Hábito',      icon: '✅', color: 'var(--teal)',   bg: 'rgba(30,203,180,.12)',  onClick: () => { window.location.href = '/habitos';  setOpen(false) } },
    { label: 'Transacção',  icon: '💰', color: 'var(--gold)',   bg: 'rgba(232,168,56,.12)',  onClick: () => { window.location.href = '/financas'; setOpen(false) } },
    { label: 'Pomodoro',    icon: '⏱', color: 'var(--accent)', bg: 'rgba(127,119,221,.12)', onClick: () => { setShowPomodoro(true); setOpen(false) } },
  ]

  return (
    <>
      {showPomodoro && (
        <div onClick={() => { setShowPomodoro(false); setRunning(false) }} style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(13,15,20,.88)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(6px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg1)',border:'0.5px solid rgba(127,119,221,.3)',borderRadius:24,padding:'32px 28px',width:300,textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.5)' }}>
            <div style={{ fontSize:11,color:'var(--accent)',textTransform:'uppercase',letterSpacing:2,fontWeight:700,marginBottom:24 }}>Pomodoro</div>
            <div style={{ position:'relative',width:160,height:160,margin:'0 auto 24px' }}>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="68" fill="none" stroke="var(--bg3)" strokeWidth="8"/>
                <circle cx="80" cy="80" r="68" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 68}`}
                  strokeDashoffset={`${2 * Math.PI * 68 * (1 - pct / 100)}`}
                  transform="rotate(-90 80 80)"
                  style={{ transition:'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
                <div style={{ fontFamily:'Syne, sans-serif',fontWeight:800,fontSize:38,color:'var(--text1)',lineHeight:1,letterSpacing:'-1px' }}>{timeLabel}</div>
                <div style={{ fontSize:11,color:'var(--text3)',marginTop:4 }}>{running ? 'em foco' : secondsLeft === 25*60 ? 'pronto' : 'pausado'}</div>
              </div>
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setRunning(v => !v)} style={{ flex:1,padding:'13px 0',borderRadius:14,border:'none',background:running?'var(--bg3)':'var(--accent)',color:running?'var(--text2)':'white',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:14,cursor:'pointer',outline:running?'0.5px solid var(--border)':'none' }}>
                {running ? 'Pausar' : 'Iniciar'}
              </button>
              <button onClick={() => { setRunning(false); setSecondsLeft(25*60) }} style={{ width:48,borderRadius:14,border:'0.5px solid var(--border)',background:'var(--bg3)',color:'var(--text3)',fontFamily:'Syne, sans-serif',fontWeight:700,fontSize:18,cursor:'pointer' }}>↺</button>
            </div>
            <button onClick={() => { setShowPomodoro(false); setRunning(false) }} style={{ marginTop:16,background:'transparent',border:'none',color:'var(--text3)',fontSize:12,cursor:'pointer',fontFamily:'DM Sans, sans-serif' }}>Fechar</button>
          </div>
        </div>
      )}

      <div data-quickaction style={{ position:'fixed',bottom:88,right:20,zIndex:200,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10 }}>
        {open && (
          <div style={{ display:'flex',flexDirection:'column',gap:8,animation:'qaMenuIn .18s ease' }}>
            {actions.map(a => (
              <button key={a.label} onClick={a.onClick} style={{ display:'flex',alignItems:'center',gap:10,background:'var(--bg1)',border:`0.5px solid ${a.color}44`,borderRadius:14,padding:'10px 14px',cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,.35)',whiteSpace:'nowrap' }}>
                <div style={{ width:32,height:32,borderRadius:9,background:a.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>{a.icon}</div>
                <span style={{ fontFamily:'Syne, sans-serif',fontWeight:600,fontSize:13,color:a.color }}>＋ {a.label}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setOpen(v => !v)} style={{ width:52,height:52,borderRadius:'50%',border:'none',background:open?'var(--bg3)':'linear-gradient(135deg, var(--teal), var(--accent))',color:'#fff',fontSize:open?22:26,fontWeight:300,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:open?'0 2px 12px rgba(0,0,0,.3)':'0 4px 20px rgba(30,203,180,.35)',transform:open?'rotate(45deg)':'rotate(0deg)',transition:'transform .2s ease, background .2s ease',flexShrink:0 }} aria-label="Acção rápida">＋</button>
        <style jsx>{`
          @keyframes qaMenuIn { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        `}</style>
      </div>
    </>
  )
}
