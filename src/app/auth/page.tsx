'use client'
// src/app/auth/page.tsx — reescrito com fix de novos utilizadores + design melhorado
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const inp: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 14,
  background: 'rgba(255,255,255,.05)', border: '0.5px solid rgba(255,255,255,.12)',
  color: '#F0EDE8', fontFamily: 'DM Sans, sans-serif', fontSize: 15,
  outline: 'none', transition: 'border-color .2s',
}

export default function AuthPage() {
  const [email,   setEmail]   = useState('')
  const [name,    setName]    = useState('')
  const [isNew,   setIsNew]   = useState(false)
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function submit() {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    if (isNew) {
      // Novos utilizadores — OTP (magic link) com metadados de nome
      // NÃO usar signUp com password aleatória — causa problemas de confirmação
      const { error: e } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { full_name: name.trim() || email.split('@')[0] },
        },
      })
      if (e) { setError(e.message); setLoading(false); return }
    } else {
      // Utilizadores existentes — OTP simples
      const { error: e } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      })
      if (e) {
        // Se o utilizador não existe, sugerir criar conta
        if (e.message.includes('not found') || e.message.includes('Signups not allowed')) {
          setError('Email não encontrado. Cria uma conta primeiro.')
        } else {
          setError(e.message)
        }
        setLoading(false)
        return
      }
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', background: 'var(--bg0)',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Background decorativo */}
      <div style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,168,56,.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 40,
            color: 'var(--gold)', letterSpacing: '-2px', marginBottom: 8, lineHeight: 1,
          }}>NEXUS</div>
          <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.5 }}>
            O teu sistema de evolução pessoal
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 16 }}>
            {['🎯 Hábitos', '⚡ XP', '🔥 Streak'].map(t => (
              <span key={t} style={{ fontSize: 12, color: 'var(--text3)' }}>{t}</span>
            ))}
          </div>
        </div>

        {sent ? (
          /* ── Estado: email enviado ── */
          <div style={{
            background: 'var(--bg2)', border: '0.5px solid rgba(30,203,180,.3)',
            borderRadius: 20, padding: '32px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, marginBottom: 10 }}>
              Verifica o teu email
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 24 }}>
              Enviámos um link para<br/>
              <strong style={{ color: 'var(--text1)' }}>{email}</strong>.<br/>
              Clica no link para entrar — sem password.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px', borderRadius: 10, background: 'var(--bg3)' }}>
              Não vês o email? Verifica o spam ou{' '}
              <button onClick={() => { setSent(false); setLoading(false) }}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}>
                tenta novamente
              </button>.
            </div>
          </div>
        ) : (
          /* ── Formulário ── */
          <div style={{ background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 20, padding: '28px 24px' }}>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 12, padding: 4, marginBottom: 24, gap: 4 }}>
              {[{ v: false, label: 'Entrar' }, { v: true, label: 'Criar conta' }].map(({ v, label }) => (
                <button key={label} onClick={() => { setIsNew(v); setError('') }} style={{
                  flex: 1, padding: '10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 13, transition: 'all .2s',
                  background: isNew === v ? 'var(--bg1)' : 'transparent',
                  color: isNew === v ? 'var(--text1)' : 'var(--text3)',
                  boxShadow: isNew === v ? '0 1px 3px rgba(0,0,0,.3)' : 'none',
                }}>{label}</button>
              ))}
            </div>

            {/* Campos */}
            {isNew && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Nome</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="Como te chamas?"
                  style={inp}
                  onFocus={e => e.target.style.borderColor = 'rgba(232,168,56,.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.12)'}
                />
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                type="email" placeholder="o.teu@email.com"
                style={inp}
                onFocus={e => e.target.style.borderColor = 'rgba(232,168,56,.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.12)'}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>

            {/* Erro */}
            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(226,75,74,.1)', border: '0.5px solid rgba(226,75,74,.3)', color: '#E24B4A', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* Botão */}
            <button onClick={submit} disabled={loading || !email.trim()} style={{
              width: '100%', padding: '15px', border: 'none', borderRadius: 14, cursor: 'pointer',
              fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15,
              background: email.trim() ? 'var(--gold)' : 'var(--bg3)',
              color: email.trim() ? 'var(--bg0)' : 'var(--text3)',
              transition: 'all .15s',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'A enviar…' : isNew ? 'Criar conta →' : 'Entrar →'}
            </button>

            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 14, textAlign: 'center', lineHeight: 1.6 }}>
              Sem password. Recebes um link no email para entrar de forma segura.
            </p>
          </div>
        )}

        {/* Rodapé */}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
            Ao continuar, aceitas os{' '}
            <span style={{ color: 'var(--gold)' }}>termos de serviço</span>{' '}
            e{' '}
            <span style={{ color: 'var(--gold)' }}>política de privacidade</span>.
          </p>
        </div>
      </div>
    </main>
  )
}
