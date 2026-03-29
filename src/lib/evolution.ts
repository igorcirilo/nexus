export type EvolutionStage = {
  key: 'seed' | 'spark' | 'builder' | 'ascendant' | 'master'
  emoji: string
  label: string
  subtitle: string
  progressLabel: string
}

export function getAvatarStage(level: number, streak: number): EvolutionStage {
  if (level >= 15 || streak >= 30) {
    return {
      key: 'master',
      emoji: '👑',
      label: 'Master',
      subtitle: 'Disciplina rara. Manténs o padrão mesmo sem motivação.',
      progressLabel: 'Presença de elite',
    }
  }

  if (level >= 10 || streak >= 14) {
    return {
      key: 'ascendant',
      emoji: '🔥',
      label: 'Ascendant',
      subtitle: 'Já não estás a tentar. Estás a tornar-te alguém consistente.',
      progressLabel: 'Momentum forte',
    }
  }

  if (level >= 6 || streak >= 7) {
    return {
      key: 'builder',
      emoji: '⚔️',
      label: 'Builder',
      subtitle: 'As bases estão a ficar sólidas. Continua a empilhar vitórias.',
      progressLabel: 'Base consistente',
    }
  }

  if (level >= 3) {
    return {
      key: 'spark',
      emoji: '✨',
      label: 'Spark',
      subtitle: 'Os primeiros sinais de mudança já aparecem no teu sistema.',
      progressLabel: 'Energia crescente',
    }
  }

  return {
    key: 'seed',
    emoji: '🌱',
    label: 'Seed',
    subtitle: 'Ainda estás a plantar identidade. O foco agora é repetição simples.',
    progressLabel: 'Começo limpo',
  }
}

export function getAvatarProgress(level: number, streak: number): number {
  const raw = Math.min(100, Math.max(level * 6 + streak * 2, 8))
  return raw
}
