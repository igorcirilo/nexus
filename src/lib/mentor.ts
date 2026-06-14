// src/lib/mentor.ts
// Lógica condicional do mentor — sem IA, com mensagens inteligentes

interface MentorContext {
  energy: number      // 1–10
  streak: number
  habitsDone: number
  habitsTotal: number
  missionPct: number  // 0–100
  phase: 'manha' | 'tarde' | 'noite'
  hour: number
}

interface MentorMessage {
  body: string
  action: string
}

export function getMentorMessage(ctx: MentorContext): MentorMessage {
  const { energy, streak, habitsDone, habitsTotal, missionPct, phase, hour } = ctx
  const ratio = habitsTotal > 0 ? habitsDone / habitsTotal : 0

  // ── Manhã ────────────────────────────────────────────────
  if (phase === 'manha') {
    if (energy <= 3) return {
      body: 'Energia baixa — é sinal de que o corpo precisa de recuperação. Não exijas 100% hoje.',
      action: 'Próximo passo: faz só 1 hábito essencial e descansa onde podes.',
    }
    if (streak >= 21) return {
      body: `${streak} dias. Isso não é motivação — é identidade. Estás a tornar-te noutra pessoa.`,
      action: 'Próximo passo: protege as próximas 2h como se fossem as mais importantes do dia.',
    }
    if (streak >= 7) return {
      body: `${streak} dias seguidos. O teu futuro eu vai agradecer-te cada vez que não desististe.`,
      action: 'Próximo passo: define a missão principal e começa com um bloco de foco de 25 min.',
    }
    if (energy >= 8) return {
      body: 'Boa energia hoje. Aproveitares as primeiras horas para o trabalho mais difícil é a decisão mais inteligente que podes tomar.',
      action: 'Próximo passo: abre a tua missão principal e trabalha 25 min sem distrações.',
    }
    return {
      body: 'Novo dia, nova oportunidade de agir. Não precisas de estar perfeito — precisas de começar.',
      action: 'Próximo passo: faz o check-in completo e escolhe a missão do dia.',
    }
  }

  // ── Tarde ────────────────────────────────────────────────
  if (phase === 'tarde') {
    if (missionPct >= 80) return {
      body: 'Missão quase completa — estás claramente em modo de execução. Isso é raro e valioso.',
      action: 'Próximo passo: termina a missão principal antes das 18h e celebra.',
    }
    if (missionPct < 20 && hour >= 15) return {
      body: 'Ainda há tempo para recuperar a tarde. Não precisas de fazer tudo — precisas de fazer o essencial.',
      action: 'Próximo passo: 25 min de foco agora. Só isso. Sem abrir mais nada.',
    }
    if (ratio < 0.3) return {
      body: 'A tarde é boa para recuperar hábitos da manhã. Sem drama — sem acumulação.',
      action: `Próximo passo: escolhe 1 hábito e marca-o como feito agora.`,
    }
    return {
      body: 'A tarde é onde a maioria das pessoas perde o ritmo. Tu não és a maioria.',
      action: 'Próximo passo: verifica o progresso da missão e ajusta o escopo se necessário.',
    }
  }

  // ── Noite ────────────────────────────────────────────────
  if (ratio >= 0.9) return {
    body: 'Dia completo. Isso não se faz com força de vontade — faz-se com identidade bem construída.',
    action: 'Próximo passo: faz o check-in da noite e prepara a missão de amanhã.',
  }
  if (ratio < 0.3) return {
    body: hour < 22
      ? 'Ainda dá para fechar bem o dia. Um gesto pequeno agora muda o tom de tudo.'
      : 'Dia mais leve do que querias — acontece. O que importa é não quebrares o ritmo.',
    action: hour < 22
      ? 'Próximo passo: escolhe 1 hábito e marca-o como feito agora.'
      : 'Próximo passo: faz o check-in da noite e prepara um arranque melhor amanhã.',
  }
  if (missionPct >= 70) return {
    body: 'A missão avançou mesmo que o dia não tenha sido perfeito. Isso é execução real.',
    action: 'Próximo passo: fecha o dia com o check-in noturno e define amanhã.',
  }
  return {
    body: 'Fechar o dia com consciência é tão importante como começá-lo com intenção.',
    action: 'Próximo passo: faz o check-in da noite em 2 minutos e descansa.',
  }
}
