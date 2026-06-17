'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'

export default function CalendarioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[calendario] erro ao carregar a página:', error)
  }, [error])

  return (
    <ErrorState
      title="O calendário não carregou"
      body="Tivemos um problema a carregar a tua agenda. Verifica a ligação e tenta de novo."
      onRetry={reset}
    />
  )
}
