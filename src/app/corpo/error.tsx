'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'

export default function CorpoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[corpo] erro ao carregar a página:', error)
  }, [error])

  return (
    <ErrorState
      title="Os teus dados não carregaram"
      body="Tivemos um problema a carregar o teu progresso corporal. Verifica a ligação e tenta de novo."
      onRetry={reset}
    />
  )
}
