'use client'
// src/app/auth/page.tsx — login "Orbit".
// Mobile: "Hero Glow" — hero com glow + pills de funcionalidades sobre um card
// de formulário. Desktop (≥820px): split-screen com showcase do produto ("Hoje")
// à direita. Mantém todo o fluxo real de auth (email+password, registo com
// consentimento, recuperação) + login social Google/Apple via Supabase OAuth.
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TERMS_VERSION = 'beta-2026-06-28'

// Login social: os botões estão implementados e ligados ao Supabase OAuth, mas
// ficam desativados até os providers Google/Apple serem configurados no painel
// (Authentication → Providers). Muda para `true` quando estiverem prontos — não
// é preciso mais nada. Enquanto false, clicar mostra "chega em breve" em vez de
// redirecionar para um endpoint que ainda não aceita estes providers.
const SOCIAL_LOGIN_ENABLED = false

const inp: React.CSSProperties = {
  width: '100%', height: 50, padding: '0 16px', borderRadius: 13,
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

  // Login social. A implementação é real (Supabase OAuth); só falta ativar os
  // providers no painel e pôr SOCIAL_LOGIN_ENABLED a true. Em sucesso, o browser
  // é redirecionado para o provider; em erro mostramos mensagem amigável.
  async function oauth(provider: 'google' | 'apple') {
    const nome = provider === 'google' ? 'Google' : 'Apple'
    if (!SOCIAL_LOGIN_ENABLED) { setError(`Login com ${nome} chega em breve.`); return }
    setLoading(true); setError('')
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/hoje` },
    })
    if (e) {
      setError(`Login com ${nome} ainda não está disponível.`)
      setLoading(false)
    }
  }

  return (
    <div className="orbit-auth">
      {/* Layout e responsividade (media queries não são possíveis inline).
          Base = mobile "Hero Glow"; ≥820px = split-screen com showcase. */}
      <style>{`
        .orbit-auth { position: fixed; inset: 0; z-index: 50; overflow-y: auto;
          background: var(--bg0); display: flex; flex-direction: column; }
        .orbit-form-col { display: flex; flex-direction: column; min-height: 100%; }
        .orbit-hero { position: relative; padding: 60px 26px 22px;
          background:
            radial-gradient(420px 300px at 50% -10%, rgba(232,168,56,.20), transparent 62%),
            radial-gradient(360px 320px at 100% 12%, rgba(127,119,221,.20), transparent 60%); }
        .orbit-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
        .orbit-pill { background: var(--surface-3); border: 1px solid var(--border);
          border-radius: 100px; padding: 8px 13px; font-size: 12px; font-weight: 600;
          color: var(--text2); display: inline-flex; align-items: center; gap: 6px;
          white-space: nowrap; }
        /* Pills flutuantes do showcase (painel sempre escuro) — estilo "vidro" */
        .orbit-fpill { position: absolute; background: rgba(255,255,255,.08);
          border: 1px solid rgba(255,255,255,.16); border-radius: 100px;
          padding: 9px 15px; font-size: 12.5px; font-weight: 600; color: #F0EDE8;
          backdrop-filter: blur(10px); display: flex; align-items: center; gap: 7px;
          font-family: 'DM Sans', sans-serif; }
        .orbit-form { margin: 6px 16px 0; background: var(--bg1);
          border: 1px solid var(--border); border-radius: 22px; padding: 22px 20px; }
        .orbit-legal { text-align: center; font-size: 11px; color: var(--text3);
          line-height: 1.6; padding: 18px 26px 30px; }
        .orbit-eye { position: absolute; right: 14px; top: 50%;
          transform: translateY(-50%); background: none; border: none;
          cursor: pointer; color: var(--text3); font-size: 15px; padding: 0; }
        .orbit-dvd { display: flex; align-items: center; gap: 14px;
          margin: 18px 0; font-size: 12px; color: var(--text3); }
        .orbit-dvd::before, .orbit-dvd::after { content: ""; flex: 1; height: 1px;
          background: var(--border); }
        .orbit-soc { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .orbit-sbtn { height: 46px; border-radius: 12px; display: flex;
          align-items: center; justify-content: center; gap: 9px; font-size: 13.5px;
          font-weight: 600; cursor: pointer; background: var(--surface-2);
          border: 1px solid var(--border); color: var(--text1);
          font-family: 'DM Sans', sans-serif; }
        .orbit-sbtn:disabled { opacity: .6; cursor: default; }
        .orbit-showcase { display: none; }

        @media (min-width: 820px) {
          .orbit-auth { flex-direction: row; }
          .orbit-form-col { flex: 0 0 46%; max-width: 620px; align-items: center;
            justify-content: center; padding: 40px 22px; }
          .orbit-hero { padding: 0; background: none; width: 100%; max-width: 340px; }
          .orbit-pills { display: none; }
          .orbit-form { margin: 0; width: 100%; max-width: 340px; background: none;
            border: none; border-radius: 0; padding: 0; }
          .orbit-legal { width: 100%; max-width: 340px; padding: 20px 0 0; }
          .orbit-showcase { display: flex; flex: 1; position: relative;
            overflow: hidden; align-items: center; justify-content: center;
            border-left: 1px solid rgba(255,255,255,.07);
            background:
              radial-gradient(600px 500px at 60% 30%, rgba(127,119,221,.22), transparent 60%),
              radial-gradient(500px 400px at 85% 100%, rgba(30,203,180,.18), transparent 60%),
              #0c0e16; }
        }
      `}</style>

      {/* ─────────── Coluna do formulário (hero + card + legal) ─────────── */}
      <div className="orbit-form-col">

        {/* Hero: logo + título + subtítulo + pills (pills só em mobile) */}
        <div className="orbit-hero">
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:22 }}>
            <span style={{ width:32, height:32, borderRadius:10, background:'var(--gold)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--on-bright)', fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:16 }}>N</span>
            <span style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:19, color:'var(--text1)' }}>NEXUS</span>
          </div>
          <h1 style={{ fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:27, lineHeight:1.14, letterSpacing:'-.6px', color:'var(--text1)', marginBottom:10 }}>
            {isNew ? 'Cria a tua conta' : 'O teu assistente pessoal de evolução'}
          </h1>
          <p style={{ color:'var(--text2)', fontSize:14, lineHeight:1.5 }}>
            {isNew ? 'Hábitos, rotina e foco — começa em segundos.' : 'Hábitos, rotina e foco — organizados todos os dias por ti e pela NEXUS.'}
          </p>
          <div className="orbit-pills">
            {['🎯 Hábitos','🧠 Foco','⏰ Rotina','📊 Insights'].map(t => (
              <span key={t} className="orbit-pill">{t}</span>
            ))}
          </div>
        </div>

        {/* Card do formulário */}
        <div className="orbit-form">

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
            <div style={{ display:'flex', justifyContent:'flex-end', margin:'12px 0 18px' }}>
              <button type="button" onClick={resetPassword} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gold-ink)', fontSize:13, fontWeight:600 }}>
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
                <Link href="/termos" target="_blank" style={{ color:'var(--gold-ink)', textDecoration:'underline' }}>Termos de Uso</Link>{' '}
                e a{' '}
                <Link href="/privacidade" target="_blank" style={{ color:'var(--gold-ink)', textDecoration:'underline' }}>Política de Privacidade</Link>,
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
            width:'100%', height:52, border:'none', borderRadius:14, cursor: canSubmit ? 'pointer' : 'default',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:15, transition:'all .15s',
            background: canSubmit ? 'var(--gold)' : 'var(--bg3)',
            color:      canSubmit ? 'var(--on-bright)' : 'var(--text3)',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'A processar…' : isNew ? 'Criar conta →' : 'Entrar →'}
          </button>

          {/* Login social */}
          <div className="orbit-dvd">ou continua com</div>
          <div className="orbit-soc">
            <button type="button" className="orbit-sbtn" disabled={loading} onClick={() => oauth('google')}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.9z"/>
                <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.3 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.8z"/>
                <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3l3.7 2.8c.9-2.5 3.2-4.4 6-4.4z"/>
              </svg>
              Google
            </button>
            <button type="button" className="orbit-sbtn" disabled={loading} onClick={() => oauth('apple')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.4 1c.1 1-.3 2-1 2.8-.6.8-1.7 1.4-2.7 1.3-.1-1 .4-2 1-2.7.7-.8 1.8-1.4 2.7-1.4zM19 17.3c-.5 1.2-.8 1.7-1.4 2.7-.9 1.4-2.2 3.1-3.7 3.1-1.4 0-1.7-.9-3.6-.9-1.8 0-2.2.9-3.5.9-1.6 0-2.7-1.5-3.6-2.9C.8 17.2.5 12.7 2.1 10.3c1-1.6 2.5-2.5 4-2.5 1.5 0 2.5 1 3.7 1 1.2 0 1.9-1 3.7-1 1.3 0 2.7.7 3.7 2-3.2 1.8-2.7 6.4.1 7.5z"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Alternar login / registo */}
          <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text2)' }}>
            {isNew ? 'Já tens conta? ' : 'Sem conta? '}
            <button type="button" onClick={() => { setIsNew(v => !v); setError('') }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--gold-ink)', fontWeight:700, fontSize:13, padding:0 }}>
              {isNew ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </div>

        {/* Rodapé legal */}
        <p className="orbit-legal">
          Os teus dados são isolados por conta e a ligação é cifrada (HTTPS).{' '}
          <Link href="/privacidade" style={{ color:'var(--text3)', textDecoration:'underline' }}>Privacidade</Link>
          {' · '}
          <Link href="/termos" style={{ color:'var(--text3)', textDecoration:'underline' }}>Termos</Link>
        </p>
      </div>

      {/* ─────────── Showcase do produto (desktop ≥820px) ─────────── */}
      <div className="orbit-showcase" aria-hidden="true">
        {/* Mockup do telemóvel — ecrã "Hoje" */}
        <div style={{ width:266, height:560, borderRadius:38, background:'#000', padding:9, boxShadow:'0 40px 80px -24px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.1)' }}>
          <div style={{ width:'100%', height:'100%', borderRadius:30, overflow:'hidden', background:'#0D0F14', position:'relative', padding:'20px 16px' }}>
            <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:96, height:22, background:'#000', borderRadius:'0 0 14px 14px' }} />
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:11, color:'#9BA0B0' }}>Quinta · 18 jun</div>
              <div style={{ fontFamily:'Inter, sans-serif', fontWeight:700, fontSize:20, marginTop:2, color:'#F0EDE8' }}>Olá, Igor 👋</div>
            </div>
            {/* Próxima ação */}
            <div style={{ marginTop:14, background:'linear-gradient(135deg,rgba(232,168,56,.18),rgba(232,168,56,.05))', border:'1px solid rgba(232,168,56,.3)', borderRadius:16, padding:14 }}>
              <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.1em', color:'#E8A838' }}>Próxima ação</div>
              <div style={{ fontWeight:700, fontSize:14, marginTop:4, color:'#F0EDE8' }}>Treino de força · 18:00</div>
              <div style={{ marginTop:10, height:34, borderRadius:9, background:'#E8A838', color:'#0D0F14', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12.5, fontFamily:'Inter, sans-serif' }}>Começar agora →</div>
            </div>
            {/* Métricas */}
            <div style={{ display:'flex', gap:9, marginTop:12 }}>
              <div style={{ flex:1, background:'#161824', border:'1px solid rgba(255,255,255,.07)', borderRadius:13, padding:11 }}>
                <div style={{ fontSize:9, color:'#9BA0B0' }}>Ofensiva</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:19, color:'#E24B4A' }}>47🔥</div>
              </div>
              <div style={{ flex:1, background:'#161824', border:'1px solid rgba(255,255,255,.07)', borderRadius:13, padding:11 }}>
                <div style={{ fontSize:9, color:'#9BA0B0' }}>Nível</div>
                <div style={{ fontFamily:'Inter, sans-serif', fontWeight:800, fontSize:19, color:'#7F77DD' }}>12</div>
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
        <div style={{ top:60, left:34 }} className="orbit-fpill">🎯 Hábitos</div>
        <div style={{ top:130, right:30 }} className="orbit-fpill">🧠 Foco</div>
        <div style={{ bottom:150, left:26 }} className="orbit-fpill">⏰ Rotina</div>
        <div style={{ bottom:70, right:36 }} className="orbit-fpill">📊 Insights</div>

        {/* Bolha do assistente */}
        <div style={{ position:'absolute', top:36, right:40, maxWidth:210, background:'#171a24', border:'1px solid rgba(232,168,56,.3)', borderRadius:'14px 14px 4px 14px', padding:'12px 14px', fontSize:12.5, lineHeight:1.5, color:'#F0EDE8', fontFamily:'DM Sans, sans-serif', boxShadow:'0 16px 30px -12px rgba(0,0,0,.6)' }}>
          <b style={{ color:'#E8A838' }}>✦ Assistente:</b> sugiro 20 min de leitura antes de dormir 🌙
        </div>
      </div>
    </div>
  )
}
