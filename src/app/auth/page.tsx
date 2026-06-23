'use client'
// src/app/auth/page.tsx — email + password
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const inp: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 14,
  background: 'var(--surface-2)', border: '0.5px solid rgba(var(--ink-rgb),.12)',
  color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 15, outline: 'none',
}

export default function AuthPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [isNew,    setIsNew]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)

  async function submit() {
    if (!email.trim() || !password) return
    setLoading(true); setError('')

    if (isNew) {
      // Registo
      const { error: e } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() || email.split('@')[0] },
          // Link de confirmação volta SEMPRE para o domínio atual (evita
          // depender do "Site URL" fixo no Supabase, que pode estar obsoleto).
          emailRedirectTo: `${window.location.origin}/hoje`,
        },
      })
      if (e) { setError(e.message); setLoading(false); return }
      // Login imediato após registo
      const { error: le } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (le) { setError('Conta criada! Faz login manualmente.'); setLoading(false); return }
    } else {
      // Login
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (e) {
        setError(e.message === 'Invalid login credentials'
          ? 'Email ou password incorrectos.'
          : e.message)
        setLoading(false); return
      }
    }

    window.location.href = '/hoje'
  }

  async function resetPassword() {
    if (!email.trim()) { setError('Introduz o teu email primeiro.'); return }
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth`,
    })
    if (e) setError(e.message)
    else setError('✓ Email de recuperação enviado.')
  }

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 20px', background:'var(--bg0)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-200, left:'50%', transform:'translateX(-50%)', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(232,168,56,.07) 0%, transparent 70%)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:380, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:40, color:'var(--gold)', letterSpacing:'-2px', marginBottom:8, lineHeight:1 }}>NEXUS</div>
          <div style={{ fontSize:15, color:'var(--text2)' }}>O teu sistema de evolução pessoal</div>
          <div style={{ display:'flex', justifyContent:'center', gap:20, marginTop:14 }}>
            {['🎯 Hábitos','⚡ Ritmo','🔥 Ofensiva'].map(t => (
              <span key={t} style={{ fontSize:12, color:'var(--text3)' }}>{t}</span>
            ))}
          </div>
        </div>

        <div style={{ background:'var(--bg2)', border:'0.5px solid var(--border)', borderRadius:20, padding:'28px 24px' }}>

          {/* Tabs */}
          <div style={{ display:'flex', background:'var(--bg3)', borderRadius:12, padding:4, marginBottom:24, gap:4 }}>
            {[{v:false,l:'Entrar'},{v:true,l:'Criar conta'}].map(({v,l}) => (
              <button key={l} onClick={() => { setIsNew(v); setError('') }} style={{
                flex:1, padding:'10px', borderRadius:9, border:'none', cursor:'pointer',
                fontFamily:'Syne, sans-serif', fontWeight:600, fontSize:13, transition:'all .2s',
                background: isNew===v ? 'var(--bg1)' : 'transparent',
                color: isNew===v ? 'var(--text1)' : 'var(--text3)',
                boxShadow: isNew===v ? '0 1px 3px rgba(0,0,0,.3)' : 'none',
              }}>{l}</button>
            ))}
          </div>

          {/* Nome (só no registo) */}
          {isNew && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Como te chamas?" style={inp}
                onFocus={e => e.target.style.borderColor='rgba(232,168,56,.5)'}
                onBlur={e  => e.target.style.borderColor='rgba(var(--ink-rgb),.12)'} />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="o.teu@email.com" style={inp}
              onFocus={e => e.target.style.borderColor='rgba(232,168,56,.5)'}
              onBlur={e  => e.target.style.borderColor='rgba(var(--ink-rgb),.12)'}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {/* Password */}
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, color:'var(--text3)', display:'block', marginBottom:6 }}>Password</label>
            <div style={{ position:'relative' }}>
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                style={{ ...inp, paddingRight:48 }}
                onFocus={e => e.target.style.borderColor='rgba(232,168,56,.5)'}
                onBlur={e  => e.target.style.borderColor='rgba(var(--ink-rgb),.12)'}
                onKeyDown={e => e.key === 'Enter' && submit()} />
              <button onClick={() => setShowPw(v => !v)} style={{
                position:'absolute', right:14, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14, padding:0,
              }}>{showPw ? '🙈' : '👁'}</button>
            </div>
          </div>

          {/* Erro / sucesso */}
          {error && (
            <div style={{
              padding:'10px 14px', borderRadius:10, marginBottom:16, fontSize:13,
              background: error.startsWith('✓') ? 'rgba(30,203,180,.1)' : 'rgba(226,75,74,.1)',
              border: `0.5px solid ${error.startsWith('✓') ? 'rgba(30,203,180,.3)' : 'rgba(226,75,74,.3)'}`,
              color: error.startsWith('✓') ? 'var(--teal)' : '#E24B4A',
            }}>{error}</div>
          )}

          {/* Botão principal */}
          <button onClick={submit} disabled={loading || !email.trim() || !password} style={{
            width:'100%', padding:'15px', border:'none', borderRadius:14, cursor:'pointer',
            fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15, transition:'all .15s',
            background: (email.trim() && password) ? 'var(--gold)' : 'var(--bg3)',
            color:      (email.trim() && password) ? 'var(--bg0)' : 'var(--text3)',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'A processar…' : isNew ? 'Criar conta →' : 'Entrar →'}
          </button>

          {/* Recuperar password */}
          {!isNew && (
            <button onClick={resetPassword} style={{ width:'100%', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:12, marginTop:12, textDecoration:'underline' }}>
              Esqueci-me da password
            </button>
          )}
        </div>

        <p style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--text3)' }}>
          Os teus dados são privados e encriptados pelo Supabase.
        </p>
      </div>
    </main>
  )
}
