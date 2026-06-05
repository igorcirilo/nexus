// src/lib/log.ts
// Helpers de logging: garantem que falhas de fundo aparecem no console COM
// contexto e uma mensagem legível, em vez de um valor cru/vazio (ex.: `null`).

/** Converte qualquer valor lançado/capturado numa string legível. */
export function formatError(err: unknown): string {
  if (err == null) return 'erro desconhecido (valor vazio)'
  if (typeof err === 'string') return err || 'erro desconhecido (string vazia)'
  if (err instanceof Error) return err.message || err.name || 'Error'
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    const msg = o.message ?? o.error_description ?? o.error ?? o.hint ?? o.details
    if (msg) return String(msg)
    try { return JSON.stringify(o) } catch { return String(o) }
  }
  return String(err)
}

/** Loga um erro com contexto e mensagem serializada. */
export function logError(context: string, err: unknown): void {
  console.error(`[${context}]`, formatError(err))
}
