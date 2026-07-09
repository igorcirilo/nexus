// src/lib/categorize.ts
//
// Sugestão de categoria a partir da descrição de um movimento. Extraído do
// parser de PDF para ser partilhado pelo registo manual, importação CSV e PDF:
// a mesma descrição deve sugerir a mesma categoria em qualquer ponto de entrada.

export function suggestCategory(description: string, type: 'entrada' | 'saida' | null): string {
  const text = description.toLowerCase()
  if (type === 'entrada') {
    if (/(sal[áa]rio|ordenado)/.test(text)) return 'Salário'
    if (/(freelance|cliente|invoice|fatura)/.test(text)) return 'Freelance'
    if (/(juros|dividendo|invest)/.test(text)) return 'Investimento'
    return 'Outro'
  }
  // Aportes: transferências para investimentos ou para a reserva de emergência.
  if (/(invest|\betf\b|corretora|degiro|\bxtb\b|trade republic|cripto)/.test(text)) return 'Investimentos'
  if (/emerg[êe]ncia/.test(text)) return 'Emergências'
  if (/(continente|pingo doce|auchan|lidl|mercadona|supermerc)/.test(text)) return 'Alimentação'
  if (/(uber|bolt|cp|metro|galp|bp|repsol|combust)/.test(text)) return 'Transporte'
  if (/(farm[aá]cia|hospital|cl[ií]nica|sa[úu]de)/.test(text)) return 'Saúde'
  if (/(netflix|spotify|disney|prime|assinatura)/.test(text)) return 'Assinaturas'
  if (/(zara|h&m|bershka|pull&bear|roupa)/.test(text)) return 'Roupa'
  if (/(fnac|udemy|curso|livro|propina|educa)/.test(text)) return 'Educação'
  if (/(cinema|restaurante|caf[eé]|bar|lazer)/.test(text)) return 'Lazer'
  if (/(renda|prest[aã]ção|condom[ií]nio|habita)/.test(text)) return 'Habitação'
  return 'Outro'
}
