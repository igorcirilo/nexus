import type { HabitArea } from '@/types'

export type GoalSize = 'pequeno' | 'medio' | 'grande'

export const GOAL_SIZE_META: Record<GoalSize, { label: string; hint: string }> = {
  pequeno: { label: 'Pequenos', hint: 'Começar com pouco atrito' },
  medio: { label: 'Médios', hint: 'Criar consistência' },
  grande: { label: 'Grandes', hint: 'Transformações de fundo' },
}

export const GOAL_SIZE_ORDER: GoalSize[] = ['pequeno', 'medio', 'grande']

export type GoalSuggestionArea = {
  /** Chave estável da área de sugestões. */
  key: string
  /** Rótulo apresentado ao utilizador. */
  label: string
  /** Emoji/ícone curto. */
  icon: string
  /** Área de hábito real onde o objetivo é guardado. */
  area: HabitArea
  /** Sugestões prontas, organizadas por tamanho do objetivo. */
  suggestions: Record<GoalSize, string[]>
}

// Sugestões prontas por área e por tamanho. As áreas de UI (Dieta, Treino, Sono…)
// mapeiam para as áreas de hábito existentes (corpo, produtividade, emocoes).
export const GOAL_SUGGESTIONS: GoalSuggestionArea[] = [
  {
    key: 'dieta',
    label: 'Dieta',
    icon: '🥗',
    area: 'corpo',
    suggestions: {
      pequeno: [
        'Beber mais água diariamente',
        'Comer proteína em pelo menos 2 refeições',
        'Reduzir refrigerante durante a semana',
      ],
      medio: [
        'Seguir uma rotina alimentar por 30 dias',
        'Organizar 4 refeições por dia',
        'Aumentar o consumo de frutas e vegetais',
      ],
      grande: [
        'Perder gordura corporal de forma consistente',
        'Ganhar massa muscular com dieta estruturada',
        'Manter uma alimentação equilibrada por 6 meses',
      ],
    },
  },
  {
    key: 'treino',
    label: 'Treino',
    icon: '🏋️',
    area: 'corpo',
    suggestions: {
      pequeno: [
        'Treinar 2 vezes na semana',
        'Caminhar 20 minutos por dia',
        'Fazer alongamento 3 vezes na semana',
      ],
      medio: [
        'Treinar 4 vezes por semana durante 1 mês',
        'Melhorar a execução dos principais exercícios',
        'Criar consistência na rotina de treino',
      ],
      grande: [
        'Ganhar massa muscular',
        'Melhorar o condicionamento físico geral',
        'Completar 6 meses de treino consistente',
      ],
    },
  },
  {
    key: 'sono',
    label: 'Sono',
    icon: '😴',
    area: 'corpo',
    suggestions: {
      pequeno: [
        'Dormir e acordar a horas fixas durante a semana',
        'Evitar o telemóvel 30 minutos antes de dormir',
        'Reduzir a cafeína depois das 16h',
      ],
      medio: [
        'Dormir 7 a 8 horas por noite durante 30 dias',
        'Criar uma rotina relaxante antes de dormir',
        'Reduzir o tempo de ecrã à noite',
      ],
      grande: [
        'Manter um sono regular e reparador por 3 meses',
        'Acordar com mais energia de forma consistente',
        'Eliminar noites mal dormidas no dia a dia',
      ],
    },
  },
  {
    key: 'hidratacao',
    label: 'Hidratação',
    icon: '💧',
    area: 'corpo',
    suggestions: {
      pequeno: [
        'Beber 1 copo de água ao acordar',
        'Levar uma garrafa de água sempre comigo',
        'Beber água antes de cada refeição',
      ],
      medio: [
        'Beber 2 litros de água por dia durante 30 dias',
        'Substituir bebidas açucaradas por água',
        'Acompanhar a hidratação diária na app',
      ],
      grande: [
        'Manter boa hidratação todos os dias por 3 meses',
        'Tornar beber água um hábito automático',
        'Reduzir bebidas açucaradas de forma permanente',
      ],
    },
  },
  {
    key: 'saude',
    label: 'Saúde',
    icon: '❤️',
    area: 'corpo',
    suggestions: {
      pequeno: [
        'Fazer uma pausa ativa por dia',
        'Tomar sol 10 minutos por dia',
        'Medir o peso uma vez por semana',
      ],
      medio: [
        'Fazer um check-up médico de rotina',
        'Reduzir o stress com 10 minutos de pausa por dia',
        'Melhorar a postura ao longo do dia',
      ],
      grande: [
        'Adotar um estilo de vida mais saudável',
        'Melhorar indicadores de saúde de forma consistente',
        'Manter hábitos saudáveis por 6 meses',
      ],
    },
  },
  {
    key: 'produtividade',
    label: 'Produtividade',
    icon: '🎯',
    area: 'produtividade',
    suggestions: {
      pequeno: [
        'Planear as 3 tarefas mais importantes do dia',
        'Fazer um bloco de foco de 25 minutos por dia',
        'Reduzir distrações durante o trabalho',
      ],
      medio: [
        'Manter uma rotina de foco durante 30 dias',
        'Concluir tarefas importantes antes do almoço',
        'Organizar a semana todos os domingos',
      ],
      grande: [
        'Concluir um projeto pessoal importante',
        'Criar um sistema de produtividade consistente',
        'Reduzir a procrastinação de forma duradoura',
      ],
    },
  },
  {
    key: 'habitos',
    label: 'Hábitos',
    icon: '🔁',
    area: 'produtividade',
    suggestions: {
      pequeno: [
        'Cumprir 1 hábito novo durante 7 dias',
        'Fazer a cama todas as manhãs',
        'Rever os hábitos do dia à noite',
      ],
      medio: [
        'Manter uma sequência de hábitos por 30 dias',
        'Adicionar um novo hábito saudável à rotina',
        'Eliminar um mau hábito durante 1 mês',
      ],
      grande: [
        'Consolidar uma rotina diária por 3 meses',
        'Construir 3 hábitos fortes e duradouros',
        'Tornar os hábitos parte natural do dia',
      ],
    },
  },
  {
    key: 'bem-estar',
    label: 'Bem-estar',
    icon: '🧘',
    area: 'emocoes',
    suggestions: {
      pequeno: [
        'Respirar fundo 5 minutos por dia',
        'Escrever uma gratidão por dia',
        'Fazer uma pausa sem ecrãs por dia',
      ],
      medio: [
        'Meditar 10 minutos por dia durante 30 dias',
        'Reservar tempo semanal para mim',
        'Reduzir o stress com uma rotina de relaxamento',
      ],
      grande: [
        'Cultivar mais calma e equilíbrio no dia a dia',
        'Melhorar a saúde emocional de forma consistente',
        'Manter práticas de bem-estar por 6 meses',
      ],
    },
  },
]
