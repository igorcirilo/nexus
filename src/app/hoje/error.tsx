'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'

export default function HojeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[hoje] erro ao carregar a página:', error)
  }, [error])

  return (
    <ErrorState
      title="O teu dia não carregou"
      body="Tivemos um problema a montar a página Hoje. Verifica a ligação e tenta de novo."
      onRetry={reset}
    />
  )
}
