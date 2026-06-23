import { describe, it, expect } from 'vitest'
import { buildRitmoDays } from '@/lib/ritmo'
import { localDateKey } from '@/lib/date'

/**
 * Regressão do bug de fuso (P1.3): a UI grava logs com a data LOCAL
 * (todayISO/localDateKey), mas a bucketização antiga agrupava por UTC
 * (toISOString), desalinhando o Ritmo à noite em fusos negativos.
 *
 * buildRitmoDays deve indexar os buckets pela data LOCAL — testável sem BD.
 */
describe('lib/ritmo · fuso horário', () => {
  it('um log com chave de data local cai no bucket de hoje (índice 0)', () => {
    // 22:30 LOCAL — em fusos negativos (ex.: America/Sao_Paulo) o dia UTC já
    // virou, mas a chave local continua a apontar para "hoje".
    const now = new Date(2026, 5, 22, 22, 30, 0)
    const todayKey = localDateKey(now)

    const days = buildRitmoDays(now, 3, { [todayKey]: 2 }, new Set([todayKey]))

    expect(days[0].habitsDone).toBe(2)
    expect(days[0].checkin).toBe(true)
    expect(days[0].habitsTotal).toBe(3)
  })

  it('a chave do bucket usa componentes locais (não o dia UTC)', () => {
    const now = new Date(2026, 5, 22, 22, 30, 0)
    const utcKey = now.toISOString().slice(0, 10)
    const localKey = localDateKey(now)

    // Se o fuso for negativo, as duas chaves diferem; um log keyed por UTC
    // NÃO deve aparecer no bucket de hoje (validando que usamos a data local).
    if (utcKey !== localKey) {
      const days = buildRitmoDays(now, 3, { [utcKey]: 5 }, new Set())
      expect(days[0].habitsDone).toBe(0)
    }
    // Independentemente do fuso, o bucket 0 corresponde à data local.
    const local = buildRitmoDays(now, 3, { [localKey]: 1 }, new Set())
    expect(local[0].habitsDone).toBe(1)
  })

  it('preenche a janela completa de dias do Ritmo', () => {
    const now = new Date(2026, 5, 22, 10, 0, 0)
    const days = buildRitmoDays(now, 2, {}, new Set())
    expect(days.length).toBe(14)
    // Bucket mais antigo = hoje - 13 dias (local).
    const oldest = new Date(now)
    oldest.setDate(oldest.getDate() - 13)
    expect(days[13].habitsTotal).toBe(2)
    expect(localDateKey(oldest).length).toBe(10)
  })
})
