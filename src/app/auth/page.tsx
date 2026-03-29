'use client'
// src/app/auth/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (mounted && data.session) {
        router.replace('/hoje')
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace('/hoje')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  async function submit() {
    if (!email) return

    setLoading(true)

    const emailRedirectTo = `${window.location.origin}/auth`

    if (isNew) {
      await supabase.auth.signUp({
        email,
        password: crypto.randomUUID(), // magic link — sem password
        options: {
          data: { full_name: name },
          emailRedirectTo,
        },
      })
    } else {
      await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
        },
      })
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <div
          className="font-syne font-extrabold text-[36px] tracking-tight mb-1"
          style={{ color: 'var(--gold)' }}
        >
          NEXUS
        </div>
        <div className="text-[14px] text-text-3">O teu sistema de evolução pessoal</div>
      </div>

      {sent ? (
        <div className="card-gold p-6 w-full max-w-sm">
          <div className="text-3xl mb-3">📬</div>
          <div className="font-syne font-semibold text-[17px] mb-2">Verifica o teu email</div>
          <div className="text-[13px] text-text-2 leading-relaxed">
            Enviámos um link mágico para <strong>{email}</strong>.
            <br />
            Clica no link para entrar — sem password.
          </div>
        </div>
      ) : (
        <div className="card p-6 w-full max-w-sm">
          <div
            className="flex rounded-xl overflow-hidden mb-5"
            style={{ border: '0.5px solid var(--border)' }}
          >
            <button
              onClick={() => setIsNew(false)}
              className="flex-1 py-2.5 text-[13px] font-dm transition-all"
              style={{
                background: !isNew ? 'var(--bg3)' : 'transparent',
                color: !isNew ? 'var(--text1)' : 'var(--text3)',
              }}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsNew(true)}
              className="flex-1 py-2.5 text-[13px] font-dm transition-all"
              style={{
                background: isNew ? 'var(--bg3)' : 'transparent',
                color: isNew ? 'var(--text1)' : 'var(--text3)',
              }}
            >
              Criar conta
            </button>
          </div>

          {isNew && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="O teu nome"
              className="w-full rounded-xl p-3.5 text-[14px] mb-3"
              style={{
                background: 'var(--bg3)',
                border: '0.5px solid var(--border)',
                color: 'var(--text1)',
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          )}

          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            placeholder="O teu email"
            className="w-full rounded-xl p-3.5 text-[14px] mb-4"
            style={{
              background: 'var(--bg3)',
              border: '0.5px solid var(--border)',
              color: 'var(--text1)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          <button onClick={submit} disabled={loading} className="btn-primary">
            {loading ? 'A enviar…' : isNew ? 'Criar conta →' : 'Entrar com link mágico →'}
          </button>

          <p className="text-[11px] text-text-3 mt-4 leading-relaxed">
            Sem password. Recebes um link no email.
          </p>
        </div>
      )}
    </main>
  )
}
