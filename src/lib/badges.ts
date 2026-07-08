/**
 * Catálogo de conquistas (badges). As chaves correspondem às atribuídas em
 * checkAndAwardBadges (supabase.ts). Usado pelo modal Conquistas & Metas para
 * mostrar desbloqueadas e bloqueadas com ícone e descrição.
 */

export interface BadgeDef {
  key: string
  name: string
  icon: string
  desc: string
  color: string
}

export const BADGE_CATALOG: BadgeDef[] = [
  // Ícones alinhados com o catálogo da BD (schema_completo.sql) e com o
  // PerfilHub/BadgeModal, para a mesma conquista ter sempre o mesmo símbolo.
  { key: 'primeiro_checkin', name: 'Primeira Vez', icon: '🌅', desc: 'Fizeste o teu primeiro check-in', color: '#85B7EB' },
  { key: 'streak_7', name: 'Uma Semana', icon: '🔥', desc: '7 dias seguidos sem falhar', color: '#E8A838' },
  { key: 'streak_21', name: 'Três Semanas', icon: '⚡', desc: '21 dias seguidos — vira hábito', color: '#9C94EC' },
  { key: 'consistencia_30', name: 'Inabalável', icon: '🏔️', desc: 'Melhor sequência de 30 dias', color: '#1ECBB4' },
  { key: 'ritmo_80', name: 'Em Chamas', icon: '🚀', desc: 'Ritmo acima de 80', color: '#E2884B' },
  { key: 'streak_100', name: 'Centenário', icon: '💎', desc: '100 dias seguidos — lendário', color: '#F2C45A' },
]
