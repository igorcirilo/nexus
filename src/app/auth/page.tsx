'use client'
// src/app/auth/page.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
    if (!email || !password || (isNew && !name.trim())) {
      setError(isNew ? 'Preenche nome, email e senha.' : 'Preenche email e senha.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (isNew) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
          },
        })

        if (error) throw error

        setSuccess('Conta criada com sucesso. Agora entra com o teu email e senha.')
        setIsNew(false)
        setPassword('')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        router.replace('/hoje')
      }
    } catch (err: any) {
      setError(err?.message || 'Ocorreu um erro ao autenticar.')
    } finally {
      setLoading(false)
    }
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

      <div className="card p-6 w-full max-w-sm">
        <div
          className="flex rounded-xl overflow-hidden mb-5"
          style={{ border: '0.5px solid var(--border)' }}
        >
          <button
            onClick={() => {
              setIsNew(false)
              setError('')
              setSuccess('')
            }}
            className="flex-1 py-2.5 text-[13px] font-dm transition-all"
            style={{
              background: !isNew ? 'var(--bg3)' : 'transparent',
              color: !isNew ? 'var(--text1)' : 'var(--text3)',
            }}
          >
            Entrar
          </button>
          <button
            onClick={() => {
              setIsNew(true)
              setError('')
              setSuccess('')
            }}
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
          className="w-full rounded-xl p-3.5 text-[14px] mb-3"
          style={{
            background: 'var(--bg3)',
            border: '0.5px solid var(--border)',
            color: 'var(--text1)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password"
          placeholder="A tua senha"
          className="w-full rounded-xl p-3.5 text-[14px] mb-4"
          style={{
            background: 'var(--bg3)',
            border: '0.5px solid var(--border)',
            color: 'var(--text1)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <div
            className="text-[12px] mb-3 text-left rounded-lg p-3"
            style={{
              background: 'rgba(255, 80, 80, 0.08)',
              border: '0.5px solid rgba(255, 80, 80, 0.25)',
              color: '#ff9b9b',
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="text-[12px] mb-3 text-left rounded-lg p-3"
            style={{
              background: 'rgba(120, 200, 120, 0.08)',
              border: '0.5px solid rgba(120, 200, 120, 0.25)',
              color: '#a8e6a3',
            }}
          >
            {success}
          </div>
        )}

        <button onClick={submit} disabled={loading} className="btn-primary">
          {loading ? 'A entrar…' : isNew ? 'Criar conta →' : 'Entrar →'}
        </button>

        <p className="text-[11px] text-text-3 mt-4 leading-relaxed">
          Autenticação com email e senha.
        </p>
      </div>
    </main>
  )
}
