import type { Question, Answers } from '@/types'

const DRAFT_KEY = 'nexus_onboarding_v2_draft'

export function saveDraft(answers: Partial<Answers>): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(answers))
}

export function loadDraft(): Partial<Answers> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}

export async function submitAssessment(
  userId: string,
  answers: Answers
): Promise<string> {
  const { supabase } = await import('@/lib/supabase')
  const { data, error } = await supabase
    .from('user_assessments')
    .insert({
      user_id: userId,
      version: 2,
      responses: answers,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) throw error
  clearDraft()
  return data.id
}

export const ONBOARDING_QUESTIONS: Question[] = [
  { id: 'b1_corpo', block: 1, text: 'Como você avalia sua saúde e disposição física hoje?', type: 'scale', area: 'corpo', weight: 3, min: 1, max: 5 },
  { id: 'b1_produtividade', block: 1, text: 'Como está sua produtividade e foco no trabalho ou estudos?', type: 'scale', area: 'produtividade', weight: 3, min: 1, max: 5 },
  { id: 'b1_idiomas', block: 1, text: 'Como você avalia seu desenvolvimento em idiomas ou habilidades cognitivas?', type: 'scale', area: 'idiomas', weight: 3, min: 1, max: 5 },
  { id: 'b1_carreira', block: 1, text: 'Como está sua carreira e crescimento profissional?', type: 'scale', area: 'carreira', weight: 3, min: 1, max: 5 },
  { id: 'b1_financas', block: 1, text: 'Como você avalia sua situação financeira atual?', type: 'scale', area: 'financas', weight: 3, min: 1, max: 5 },
  { id: 'b1_emocoes', block: 1, text: 'Como está seu bem-estar emocional e mental?', type: 'scale', area: 'emocoes', weight: 3, min: 1, max: 5 },
  { id: 'b1_relacionamentos', block: 1, text: 'Como você avalia seus relacionamentos e vida social?', type: 'scale', area: 'relacionamentos', weight: 3, min: 1, max: 5 },
  {
    id: 'b2_objetivo',
    block: 2,
    text: 'Qual área você mais quer transformar nos próximos 60 dias?',
    type: 'single',
    weight: 0,
    options: [
      { id: 'corpo', label: 'Saúde e corpo', score_value: 0 },
      { id: 'produtividade', label: 'Produtividade e foco', score_value: 0 },
      { id: 'idiomas', label: 'Idiomas e aprendizagem', score_value: 0 },
      { id: 'carreira', label: 'Carreira e crescimento', score_value: 0 },
      { id: 'financas', label: 'Finanças e controle', score_value: 0 },
      { id: 'emocoes', label: 'Emoções e bem-estar', score_value: 0 },
      { id: 'relacionamentos', label: 'Relacionamentos e social', score_value: 0 },
    ],
  },
  {
    id: 'b3_exercicio',
    block: 3,
    text: 'Com que frequência você pratica exercício físico?',
    type: 'single',
    area: 'corpo',
    weight: 2,
    options: [
      { id: 'nunca', label: 'Não pratico', score_value: 0.0 },
      { id: '1_2x', label: '1–2x por semana', score_value: 0.25 },
      { id: '3_4x', label: '3–4x por semana', score_value: 0.67 },
      { id: '5x_mais', label: '5x ou mais', score_value: 1.0 },
    ],
  },
  {
    id: 'b3_planejamento',
    block: 3,
    text: 'Com que frequência você planeja e organiza seu dia antes de começar?',
    type: 'single',
    area: 'produtividade',
    weight: 2,
    options: [
      { id: 'nunca', label: 'Nunca', score_value: 0.0 },
      { id: 'raramente', label: 'Raramente', score_value: 0.25 },
      { id: 'as_vezes', label: 'Às vezes', score_value: 0.5 },
      { id: 'quase', label: 'Quase sempre', score_value: 0.75 },
      { id: 'sempre', label: 'Sempre', score_value: 1.0 },
    ],
  },
  {
    id: 'b4_travas',
    block: 4,
    text: 'O que costuma te impedir de manter hábitos? (selecione todos que se aplicam)',
    type: 'multiple',
    area: ['emocoes', 'produtividade'],
    weight: 1,
    invert: true,
    options: [
      { id: 'tempo', label: 'Falta de tempo', score_value: 0 },
      { id: 'procrastina', label: 'Procrastinação', score_value: 0 },
      { id: 'motivacao', label: 'Falta de motivação', score_value: 0 },
      { id: 'ambiente', label: 'Ambiente desfavorável', score_value: 0 },
      { id: 'social', label: 'Pressão de outras pessoas', score_value: 0 },
      { id: 'financeiro', label: 'Restrição financeira', score_value: 0 },
    ],
  },
  {
    id: 'b4_estresse',
    block: 4,
    text: 'Como está seu nível de estresse no dia a dia?',
    type: 'scale',
    area: 'emocoes',
    weight: 1,
    min: 1,
    max: 5,
    invert: true,
  },
  {
    id: 'b5_autoimagem',
    block: 5,
    text: 'Quanto você acredita na sua capacidade de mudar e criar novos hábitos?',
    type: 'scale',
    area: 'emocoes',
    weight: 2,
    min: 1,
    max: 5,
  },
  {
    id: 'b6_ambiente',
    block: 6,
    text: 'Quais situações fazem parte da sua rotina atual? (selecione todas)',
    type: 'multiple',
    area: ['relacionamentos', 'financas'],
    weight: 1,
    options: [
      { id: 'familia_apoio', label: 'Tenho apoio de família ou parceiro(a)', score_value: 1.0 },
      { id: 'renda_estavel', label: 'Tenho renda estável', score_value: 1.0 },
      { id: 'moro_sozinho', label: 'Moro sozinho sem rede de apoio', score_value: 0.0 },
      { id: 'dividas', label: 'Tenho dívidas que me preocupam', score_value: 0.0 },
      { id: 'trabalho_fixo', label: 'Trabalho em horário fixo', score_value: 0.75 },
      { id: 'freelance', label: 'Trabalho de forma autônoma/freelance', score_value: 0.5 },
    ],
  },
  {
    id: 'b6_suporte',
    block: 6,
    text: 'Você tem pessoas próximas que te apoiam nos seus objetivos de crescimento?',
    type: 'single',
    area: 'relacionamentos',
    weight: 1,
    options: [
      { id: 'sim_muito', label: 'Sim, bastante', score_value: 1.0 },
      { id: 'sim_pouco', label: 'Sim, um pouco', score_value: 0.67 },
      { id: 'raramente', label: 'Raramente', score_value: 0.33 },
      { id: 'nao', label: 'Não tenho esse apoio', score_value: 0.0 },
    ],
  },
  {
    id: 'b7_rotina',
    block: 7,
    text: 'Em que período do dia você tem mais energia e foco?',
    type: 'single',
    area: ['corpo', 'produtividade'],
    weight: 1,
    options: [
      { id: 'manha', label: 'Manhã', score_value: 1.0, icon: '🌅', hint: 'Acordo cheio de energia' },
      { id: 'tarde', label: 'Tarde', score_value: 0.75, icon: '☀️', hint: 'Rendo melhor a meio do dia' },
      { id: 'noite', label: 'Noite', score_value: 0.5, icon: '🌙', hint: 'Sou mais ativo à noite' },
      { id: 'variado', label: 'Varia muito', score_value: 0.5, icon: '🔄', hint: 'Adapto-me ao dia' },
    ],
  },
  {
    id: 'b8_prioridades',
    block: 8,
    text: 'Ordene as 3 áreas mais importantes para você agora (da mais para a menos prioritária)',
    type: 'ranking',
    weight: 0,
    options: [
      { id: 'corpo', label: 'Saúde e corpo', score_value: 0 },
      { id: 'produtividade', label: 'Produtividade e foco', score_value: 0 },
      { id: 'idiomas', label: 'Idiomas e aprendizagem', score_value: 0 },
      { id: 'carreira', label: 'Carreira e crescimento', score_value: 0 },
      { id: 'financas', label: 'Finanças e controle', score_value: 0 },
      { id: 'emocoes', label: 'Emoções e bem-estar', score_value: 0 },
      { id: 'relacionamentos', label: 'Relacionamentos e social', score_value: 0 },
    ],
  },
]
