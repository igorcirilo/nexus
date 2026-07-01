'use client'
// src/app/auth/page.tsx — login "Orbit": formulário à esquerda + showcase do
// produto à direita (mockup do "Hoje" com pills e bolha do assistente).
// O showcase é decorativo e esconde-se em mobile; o formulário mantém todo o
// fluxo real de auth (email+password, registo com consentimento, recuperação).
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TERMS_VERSION = 'beta-2026-06-28'

const inp: React.CSSProperties = {
  width: '100%', height: 50, padding: '0 16px', borderRadius: 12,
  background: 'var(--surface-2)', border: '1px solid rgba(var(--ink-rgb),.12)',
  color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, outline: 'none',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 7,
}

export default function AuthPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [isNew,    setIsNew]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [accepted, setAccepted] = useState(false)

  const canSubmit = !!email.trim() && !!password && (!isNew || accepted)

  async function submit() {
    if (!email.trim() || !password) return
    if (isNew && !accepted) { setError('Precisas de aceitar os Termos e a Política de Privacidade.'); return }
    setLoading(true); setError('')

    if (isNew) {
      // Registo
      const { error: e } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim() || email.split('@')[0],
            // Registo do consentimento (versão + data) para prova de aceite.
            terms_accepted_at: new Date().toISOString(),
            terms_version: TERMS_VERSION,
            health_data_consent: true,
          },
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
    <div className="orbit-auth">
      {/* Layout e responsividade (media queries não são possíveis inline) */}
      <style>{`
        .orbit-auth { position: fixed; inset: 0; z-index: 50; display: flex;
          background: var(--bg0); overflow-y: auto; }
        .orbit-form-col { flex: 1; display: flex; align-items: center;
          justify-content: center; padding: 40px 22px; min-height: 100%; }
        .orbit-form { width: 100%; max-width: 340px; }
        .orbit-showcase { display: none; }
        .orbit-eye { position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%); background: none; border: none;
          cursor: pointer; color: var(--text3); font-size: 15px; padding: 0; }
        .orbit-pill { position: absolute; background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.16); border-radius: 100px;
          padding: 9px 15px; font-size: 12.5px; font-weight: 600; color: #F0EDE8;
          backdrop-filter: blur(10px); display: flex; align-items: center; gap: 7px;
          font-family: 'DM Sans', sans-serif; }
        @media (min-width: 820px) {
          .orbit-form-col { flex: 0 0 46%; max-width: 620px; }
          .orbit-showcase { display: flex; flex: 1; position: relative;
            overflow: hidden; align-items: center; justify-content: center;
            border-left: 1px solid rgba(255,255,255,.07);
            background:
              radial-gradient(600px 500px at 60% 30%, rgba(127,119,221,.22), transparent 60%),
              radial-gradient(500px 400px at 85% 100%, rgba(30,203,180,.18), transparent 60%),
              #0c0e16; }
        }
      `}</style>

      {/* ─────────── ESQUERDA · Formulário ─────────── */}
      <div className="orbit-form-col">
        <div className="orbit-form">

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:26 }}>
            <span style={{ width:30, height:30, borderRadius:9, background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--on-bright)', fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:15 }}>N</span>
            <span style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:18, color:'var(--text1)' }}>NEXUS</span>
          </div>

          {/* Título */}
          <h1 style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:24, letterSpacing:'-.4px', color:'var(--text1)', marginBottom:6 }}>
            {isNew ? 'Cria a tua conta' : 'O teu assistente pessoal'}
          </h1>
          <p style={{ color:'var(--text2)', fontSize:13.5, marginBottom:24 }}>
            {isNew ? 'Hábitos, rotina e foco — começa em segundos.' : 'Hábitos, rotina e foco — num só lugar.'}
          </p>

          {/* Nome (só no registo) */}
          {isNew && (
            <div style={{ marginBottom:13 }}>
              <label style={lbl}>Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Como te chamas?" style={inp}
                onFocus={e => e.target.style.borderColor='rgba(232,168,56,.6)'}
                onBlur={e  => e.target.style.borderColor='rgba(var(--ink-rgb),.12)'} />
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom:13 }}>
            <label style={lbl}>E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="o.teu@email.com" style={inp}
              onFocus={e => e.target.style.borderColor='rgba(232,168,56,.6)'}
              onBlur={e  => e.target.style.borderColor='rgba(var(--ink-rgb),.12)'}
              onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>

          {/* Senha */}
          <div>
            <label style={lbl}>Senha</label>
            <div style={{ position:'relative' }}>
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPw ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                style={{ ...inp, paddingRight:46 }}
                onFocus={e => e.target.style.borderColor='rgba(232,168,56,.6)'}
                onBlur={e  => e.target.style.borderColor='rgba(var(--ink-rgb),.12)'}
                onKeyDown={e => e.key === 'Enter' && submit()} />
              <button type="button" className="orbit-eye" onClick={() => setShowPw(v => !v)}>{showPw ? '🙈' : '👁'}</button>
            </div>
          </div>

          {/* Esqueci a senha (só no login) */}
          {!isNew && (
            <div style={{ display:'flex', justifyContent:'flex-end', margin:'14px 0 20px' }}>
              <button type="button" onClick={resetPassword} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gold)', fontSize:13, fontWeight:600 }}>
                Esqueci a senha
              </button>
            </div>
          )}

          {/* Consentimento (só no registo) — Termos, Privacidade e dados de saúde */}
          {isNew && (
            <label style={{ display:'flex', gap:10, alignItems:'flex-start', margin:'16px 0 18px', cursor:'pointer' }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop:2, width:16, height:16, accentColor:'var(--gold)', flexShrink:0, cursor:'pointer' }}
              />
              <span style={{ fontSize:11.5, color:'var(--text3)', lineHeight:1.5 }}>
                Li e aceito os{' '}
                <Link href="/termos" target="_blank" style={{ color:'var(--gold)', textDecoration:'underline' }}>Termos de Uso</Link>{' '}
                e a{' '}
                <Link href="/privacidade" target="_blank" style={{ color:'var(--gold)', textDecoration:'underline' }}>Política de Privacidade</Link>,
                e <b>consinto o tratamento dos meus dados de saúde</b> (peso, sono,
                humor) para o funcionamento do app.
              </span>
            </label>
          )}

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
          <button onClick={submit} disabled={loading || !canSubmit} style={{
            width:'100%', height:52, border:'none', borderRadius:13, cursor: canSubmit ? 'pointer' : 'default',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:15, transition:'all .15s',
            background: canSubmit ? 'var(--gold)' : 'var(--bg3)',
            color:      canSubmit ? 'var(--on-bright)' : 'var(--text3)',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'A processar…' : isNew ? 'Criar conta →' : 'Entrar →'}
          </button>

          {/* Alternar login / registo */}
          <p style={{ textAlign:'center', marginTop:22, fontSize:13, color:'var(--text2)' }}>
            {isNew ? 'Já tens conta? ' : 'Sem conta? '}
            <button type="button" onClick={() => { setIsNew(v => !v); setError('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gold)', fontWeight:700, fontSize:13, padding:0 }}>
              {isNew ? 'Entrar' : 'Criar conta'}
            </button>
          </p>

          {/* Rodapé legal */}
          <p style={{ textAlign:'center', marginTop:20, fontSize:11, color:'var(--text3)', lineHeight:1.6 }}>
            Os teus dados são isolados por conta e a ligação é cifrada (HTTPS).{' '}
            <Link href="/privacidade" style={{ color:'var(--text3)', textDecoration:'underline' }}>Privacidade</Link>
            {' · '}
            <Link href="/termos" style={{ color:'var(--text3)', textDecoration:'underline' }}>Termos</Link>
          </p>
        </div>
      </div>

      {/* ─────────── DIREITA · Showcase do produto (desktop) ─────────── */}
      <div className="orbit-showcase" aria-hidden="true">
        {/* Mockup do telemóvel — ecrã "Hoje" */}
        <div style={{ width:266, height:560, borderRadius:38, background:'#000', padding:9, boxShadow:'0 40px 80px -24px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.1)' }}>
          <div style={{ width:'100%', height:'100%', borderRadius:30, overflow:'hidden', background:'#0D0F14', position:'relative', padding:'20px 16px' }}>
            <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:96, height:22, background:'#000', borderRadius:'0 0 14px 14px' }} />
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:11, color:'#9BA0B0' }}>Quinta · 18 jun</div>
              <div style={{ fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:20, marginTop:2, color:'#F0EDE8' }}>Olá, Igor 👋</div>
            </div>
            {/* Próxima ação */}
            <div style={{ marginTop:14, background:'linear-gradient(135deg,rgba(232,168,56,.18),rgba(232,168,56,.05))', border:'1px solid rgba(232,168,56,.3)', borderRadius:16, padding:14 }}>
              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.1em', color:'#E8A838' }}>Próxima ação</div>
              <div style={{ fontWeight:700, fontSize:14, marginTop:4, color:'#F0EDE8' }}>Treino de força · 18:00</div>
              <div style={{ marginTop:10, height:34, borderRadius:9, background:'#E8A838', color:'#0D0F14', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12.5, fontFamily:'Syne, sans-serif' }}>Começar agora →</div>
            </div>
            {/* Métricas */}
            <div style={{ display:'flex', gap:9, marginTop:12 }}>
              <div style={{ flex:1, background:'#161824', border:'1px solid rgba(255,255,255,.07)', borderRadius:13, padding:11 }}>
                <div style={{ fontSize:9, color:'#9BA0B0' }}>Ofensiva</div>
                <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:19, color:'#E24B4A' }}>47🔥</div>
              </div>
              <div style={{ flex:1, background:'#161824', border:'1px solid rgba(255,255,255,.07)', borderRadius:13, padding:11 }}>
                <div style={{ fontSize:9, color:'#9BA0B0' }}>Nível</div>
                <div style={{ fontFamily:'Syne, sans-serif', fontWeight:800, fontSize:19, color:'#7F77DD' }}>12</div>
              </div>
            </div>
            {/* Hábitos */}
            <div style={{ marginTop:12, background:'#11131c', border:'1px solid rgba(255,255,255,.07)', borderRadius:13, padding:13 }}>
              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.1em', color:'#9BA0B0', marginBottom:10 }}>Hábitos · 3/4</div>
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {([['Beber 2L água', true], ['Leitura 20 min', true], ['Meditação', false]] as const).map(([txt, done]) => (
                  <div key={txt} style={{ display:'flex', alignItems:'center', gap:9, fontSize:12.5, color: done ? '#F0EDE8' : '#9BA0B0' }}>
                    <span style={done
                      ? { width:16, height:16, borderRadius:5, background:'#1ECBB4', color:'#0D0F14', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800 }
                      : { width:16, height:16, borderRadius:5, border:'1.5px solid rgba(255,255,255,.2)' }}>{done ? '✓' : ''}</span>
                    {txt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pills flutuantes */}
        <div className="orbit-pill" style={{ top:60, left:34 }}>🎯 Hábitos</div>
        <div className="orbit-pill" style={{ top:130, right:30 }}>🧠 Foco</div>
        <div className="orbit-pill" style={{ bottom:150, left:26 }}>⏰ Rotina</div>
        <div className="orbit-pill" style={{ bottom:70, right:36 }}>📊 Insights</div>

        {/* Bolha do assistente */}
        <div style={{ position:'absolute', top:36, right:40, maxWidth:210, background:'#171a24', border:'1px solid rgba(232,168,56,.3)', borderRadius:'14px 14px 4px 14px', padding:'12px 14px', fontSize:12.5, lineHeight:1.5, color:'#F0EDE8', fontFamily:'DM Sans, sans-serif', boxShadow:'0 16px 30px -12px rgba(0,0,0,.6)' }}>
          <b style={{ color:'#E8A838' }}>✦ Assistente:</b> sugiro 20 min de leitura antes de dormir 🌙
        </div>
      </div>
    </div>
  )
}
