// src/lib/categories.ts
//
// Categorias financeiras partilhadas entre a área /financas e o registo rápido
// global (QuickAction). Antes estavam duplicadas nos dois ficheiros e corriam o
// risco de divergir; aqui há uma única fonte de verdade.

export const CATEGORIES_IN = ['Salário', 'Freelance', 'Investimento', 'Rendas', 'Presente', 'Poupança', 'Outro']
export const CATEGORIES_OUT = ['Alimentação', 'Transporte', 'Habitação', 'Contas', 'Saúde', 'Lazer', 'Roupa', 'Educação', 'Assinaturas', 'Emergências', 'Investimentos', 'Poupança', 'Outro']

// Cores por categoria (gráficos/detalhes). Índice alinhado com a ordem visual.
export const CAT_COLORS = ['#7F77DD', '#1ECBB4', '#E8A838', '#E24B4A', '#1D9E75', '#D4537E', '#85B7EB', '#F0C060', '#534AB7', '#9BA0B0']

// Categoria reservada: transferências de/para a poupança. É transferência, não
// consumo nem rendimento — tratada à parte nas saídas/entradas e no balanço.
// O tipo lê-se do ponto de vista da poupança: entrada + Poupança = depositar
// (o poupado sobe; o dinheiro sai da conta corrente); saída + Poupança =
// levantar (o poupado desce; o dinheiro volta à conta corrente).
export const SAVINGS_CAT = 'Poupança'

// Categorias de aporte: saídas que não são consumo — o dinheiro muda de sítio,
// não desaparece. Lêem-se do ponto de vista da CONTA (ao contrário de
// "Poupança"): saída = aporte (guardar/investir), entrada = resgate (voltar à
// conta). "Emergências" alimenta a reserva (cartão 🛡️ Reserva); "Investimentos"
// conta como poupado no mês (cartão 💰 Poupança) mas não entra na reserva.
export const EMERGENCY_CAT = 'Emergências'
export const INVEST_CAT = 'Investimentos'

// Todas as categorias de transferência interna: ficam fora de consumo,
// rendimento, anomalias e do toggle "pagar com a reserva".
export const TRANSFER_CATS = [SAVINGS_CAT, EMERGENCY_CAT, INVEST_CAT]
export const isTransferCat = (cat: string) => TRANSFER_CATS.includes(cat)

// Sentinela do chip "Personalizar" nos formulários de transação.
export const CUSTOM_KEY = '__custom__'

export const CAT_EMOJI: Record<string, string> = {
  Alimentação: '🍔', Transporte: '🚗', Habitação: '🏠', Contas: '🧾', Saúde: '💊', Lazer: '🎮',
  Roupa: '👕', Educação: '🎓', Assinaturas: '📺', Emergências: '🛡️', Investimentos: '💹', Poupança: '🏦', Outro: '📦',
  Salário: '💼', Freelance: '💻', Investimento: '📈', Rendas: '🏘️', Presente: '🎁',
}

export const catEmoji = (cat: string) => CAT_EMOJI[cat] ?? '📦'
