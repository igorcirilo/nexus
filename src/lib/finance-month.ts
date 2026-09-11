// src/lib/finance-month.ts
//
// Suporte à navegação por mês do painel de finanças. A página deixou de estar
// presa ao mês corrente: há um "mês em vista" e tudo o que se mostra (balanço,
// gastos, orçamento, gráficos) é desse mês. Estas funções respondem às
// perguntas que essa mudança levanta — quanto do mês já decorreu, até onde se
// pode navegar, e quanto histórico é preciso carregar — sem BD nem React.

/** Índice absoluto do mês (ano*12+mês), para comparar meses sem passar por dias. */
function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth()
}

/** Meses entre o mês em vista e o corrente: 0 = corrente, 1 = o anterior. */
export function monthsBack(view: Date, now: Date): number {
  return monthIndex(now) - monthIndex(view)
}

/** O mês em vista ainda está por vir? Navegar para a frente pára aqui. */
export function isFutureMonth(view: Date, now: Date): boolean {
  return monthsBack(view, now) < 0
}

export interface MonthProgress {
  /**
   * Dias do mês já decorridos. Num mês passado é o mês inteiro — ele já
   * aconteceu todo, e tratá-lo como parcial faria as comparações "ao dia N" e
   * o ritmo do orçamento mentir.
   */
  elapsedDays: number
  daysInMonth: number
  /** Dias que ainda faltam; zero num mês passado. */
  daysLeft: number
  isCurrent: boolean
  isPast: boolean
}

/** Dias em `d`, sem depender de date-fns (o dia 0 do mês seguinte é o último deste). */
function daysIn(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export function monthProgress(view: Date, now: Date): MonthProgress {
  const back = monthsBack(view, now)
  const daysInMonth = daysIn(view)
  const isCurrent = back === 0
  const elapsedDays = isCurrent ? now.getDate() : daysInMonth
  return {
    elapsedDays,
    daysInMonth,
    daysLeft: isCurrent ? daysInMonth - now.getDate() : 0,
    isCurrent,
    isPast: back > 0,
  }
}

/**
 * Quantos meses de histórico carregar para servir o mês em vista.
 *
 * O histórico é pedido como "desde há N meses" a contar de hoje, mas as
 * derivações (gráfico de 6 meses, médias dos 3 meses anteriores, saldo
 * arrastado) olham para trás a partir do MÊS EM VISTA. Recuar no tempo tem
 * portanto de alargar a janela, senão os meses que essas derivações precisam
 * caem fora do que foi carregado e os números encolhem sem aviso.
 */
export function historyMonthsFor(view: Date, now: Date, window = 6): number {
  return window + Math.max(0, monthsBack(view, now))
}
