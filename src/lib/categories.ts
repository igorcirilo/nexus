// src/lib/categories.ts
//
// Categorias financeiras partilhadas entre a área /financas e o registo rápido
// global (QuickAction). Antes estavam duplicadas nos dois ficheiros e corriam o
// risco de divergir; aqui há uma única fonte de verdade.

export const CATEGORIES_IN = ['Salário', 'Freelance', 'Investimento', 'Rendas', 'Presente', 'Outro']
export const CATEGORIES_OUT = ['Alimentação', 'Transporte', 'Habitação', 'Contas', 'Saúde', 'Lazer', 'Roupa', 'Educação', 'Assinaturas', 'Poupança', 'Outro']

// Cores por categoria (gráficos/detalhes). Índice alinhado com a ordem visual.
export const CAT_COLORS = ['#7F77DD', '#1ECBB4', '#E8A838', '#E24B4A', '#1D9E75', '#D4537E', '#85B7EB', '#F0C060', '#534AB7', '#9BA0B0']

// Categoria reservada: mover dinheiro para poupança. É transferência, não
// consumo — tratada à parte nas saídas/balanço.
export const SAVINGS_CAT = 'Poupança'

// Sentinela do chip "Personalizar" nos formulários de transação.
export const CUSTOM_KEY = '__custom__'

export const CAT_EMOJI: Record<string, string> = {
  Alimentação: '🍔', Transporte: '🚗', Habitação: '🏠', Contas: '🧾', Saúde: '💊', Lazer: '🎮',
  Roupa: '👕', Educação: '🎓', Assinaturas: '📺', Poupança: '🏦', Outro: '📦',
  Salário: '💼', Freelance: '💻', Investimento: '📈', Rendas: '🏘️', Presente: '🎁',
}

export const catEmoji = (cat: string) => CAT_EMOJI[cat] ?? '📦'
