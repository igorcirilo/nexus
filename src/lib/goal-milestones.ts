// Marcos sugeridos para objetivos ("ciência do hábito"): checkpoints em
// offsets fixos desde o início, mais a conclusão na data-fim. Só entram os
// que cabem na janela do objetivo, por isso janelas curtas geram menos marcos.

import { addDays, format } from 'date-fns'

export interface SuggestedMilestone {
  title: string
  due_date: string
}

// 66 dias é a média para um comportamento virar automático (estudo UCL,
// Lally et al. 2010); 21 e 45 marcam consolidação e meio dos 90 dias padrão.
const STEPS: { offset: number; title: string }[] = [
  { offset: 3, title: 'Arranque: 3 primeiros dias' },
  { offset: 7, title: 'Primeira semana completa' },
  { offset: 21, title: '21 dias — consolidação' },
  { offset: 45, title: '45 dias de constância' },
  { offset: 66, title: '66 dias — hábito automático' },
]

/** Datas em yyyy-MM-dd (interpretadas como dia local, sem UTC). */
export function suggestMilestones(startDate: string, endDate: string): SuggestedMilestone[] {
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const windowDays = Math.round((end.getTime() - start.getTime()) / 86400000)
  if (windowDays <= 0) return []

  const out: SuggestedMilestone[] = STEPS
    .filter((s) => s.offset < windowDays)
    .map((s) => ({ title: s.title, due_date: format(addDays(start, s.offset), 'yyyy-MM-dd') }))
  out.push({ title: 'Conclusão do objetivo', due_date: endDate })
  return out
}
