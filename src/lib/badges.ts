/**
 * Catálogo de conquistas (badges). As chaves correspondem às atribuídas em
 * checkAndAwardBadges (supabase.ts). Usado pelo modal Conquistas & Metas para
 * mostrar desbloqueadas e bloqueadas com ícone e descrição.
 */

import type { IconName } from '@/lib/icons'

export interface BadgeDef {
  key: string
  name: string
  icon: IconName
  desc: string
  color: string
}

export const BADGE_CATALOG: BadgeDef[] = [
  // Fonte única dos ícones de conquista: PerfilHub, BadgeModal e a página de
  // Perfil leem daqui, para a mesma conquista ter sempre o mesmo símbolo.
  { key: 'primeiro_checkin', name: 'Primeira Vez', icon: 'sunrise', desc: 'Fizeste o teu primeiro check-in', color: '#85B7EB' },
  { key: 'streak_7', name: 'Uma Semana', icon: 'flame', desc: '7 dias seguidos sem falhar', color: '#E8A838' },
  { key: 'streak_21', name: 'Três Semanas', icon: 'zap', desc: '21 dias seguidos — vira hábito', color: '#9C94EC' },
  { key: 'consistencia_30', name: 'Inabalável', icon: 'mountain', desc: 'Melhor sequência de 30 dias', color: '#1ECBB4' },
  { key: 'ritmo_80', name: 'Em Chamas', icon: 'trend-up', desc: 'Ritmo acima de 80', color: '#E2884B' },
  { key: 'streak_100', name: 'Centenário', icon: 'gem', desc: '100 dias seguidos — lendário', color: '#F2C45A' },
]


export function badgeIcon(key: string): IconName {
  return BADGE_CATALOG.find((b) => b.key === key)?.icon ?? 'medal'
}
