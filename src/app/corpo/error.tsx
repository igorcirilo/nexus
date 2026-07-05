'use client'

import { useEffect } from 'react'
import ErrorState from '@/components/ui/ErrorState'

export default function CorpoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[corpo] erro ao carregar a página:', error)
  }, [error])

  return (
    <ErrorState
      title="Seus dados não carregaram"
      body="Tivemos um problema ao carregar seu progresso corporal. Verifique a conexão e tente de novo."
      onRetry={reset}
    />
  )
}
