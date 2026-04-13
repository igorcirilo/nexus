import { parseDietImport } from '@/lib/body-plan'
import type { FileImportResult } from '@/types'

function makeSpreadsheetResult(
  rows: Array<Record<string, string | number | boolean | null>>
): Extract<FileImportResult, { kind: 'spreadsheet' }> {
  return {
    kind: 'spreadsheet',
    meta: {
      fileName: 'dieta.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSize: 1234,
    },
    sheets: [
      {
        name: 'Plano',
        headers: Object.keys(rows[0] ?? {}),
        rows,
        rowCount: rows.length,
      },
    ],
    warnings: [],
  }
}

function makePdfResult(text: string): Extract<FileImportResult, { kind: 'pdf' }> {
  return {
    kind: 'pdf',
    meta: {
      fileName: 'dieta.pdf',
      fileType: 'application/pdf',
      fileSize: 4321,
    },
    pageCount: 1,
    extractedText: text,
    pages: [{ pageNumber: 1, text }],
    hasUsefulText: true,
    warnings: [],
  }
}

describe('parseDietImport', () => {
  it('parses wide spreadsheets with meal names as column headers', () => {
    const result = makeSpreadsheetResult([
      {
        'Pequeno-almoço': 'Ovos mexidos; banana',
        Almoco: 'Arroz | frango grelhado',
        Lanche: 'Iogurte skyr',
        Jantar: 'Sopa; salmao',
      },
    ])

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Ovos mexidos',
      'banana',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'almoco')?.items).toEqual([
      'Arroz',
      'frango grelhado',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'jantar')?.items).toEqual([
      'Sopa',
      'salmao',
    ])
  })

  it('keeps quantities when spreadsheet uses separate adjacent quantity columns', () => {
    const result = makeSpreadsheetResult([
      {
        'Pequeno-almoço': 'Ovos mexidos',
        'Qtd pequeno-almoço': '3 un',
        Almoco: 'Frango grelhado',
        'Quantidade almoço': '150 g',
        Jantar: 'Salmão',
        'Obs jantar': '200 g',
      },
    ])

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Ovos mexidos · 3 un',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'almoco')?.items).toEqual([
      'Frango grelhado · 150 g',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'jantar')?.items).toEqual([
      'Salmão · 200 g',
    ])
  })

  it('keeps kcal unit when calories come from a dedicated column', () => {
    const result = makeSpreadsheetResult([
      {
        'Pequeno-almoço': 'Iogurte skyr',
        'Qtd pequeno-almoço': '1 un',
        Kcal: '120',
      },
    ])

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Iogurte skyr · 1 un · 120 kcal',
    ])
  })

  it('formats calories and macros when spreadsheet has nutrition columns', () => {
    const result = makeSpreadsheetResult([
      {
        Refeição: 'Café da manhã',
        Alimento: 'Leite semi-desnatado',
        Quantidade: '250 ml',
        'Calorias (kcal)': '120',
        'Proteínas (g)': '8',
        'Carboidratos (g)': '12',
        'Gorduras (g)': '5',
      },
    ])

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Leite semi-desnatado · 250 ml · 120 kcal · proteínas: 8 g · carboidratos: 12 g · gorduras: 5 g',
    ])
  })

  it('keeps quantities when spreadsheet uses generic third column', () => {
    const result = makeSpreadsheetResult([
      {
        'Coluna 1': 'Pequeno-almoço',
        'Coluna 2': 'Ovos mexidos',
        'Coluna 3': '3 un',
      },
      {
        'Coluna 1': 'Almoço',
        'Coluna 2': 'Frango grelhado',
        'Coluna 3': '150 g',
      },
    ])

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Ovos mexidos · 3 un',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'almoco')?.items).toEqual([
      'Frango grelhado · 150 g',
    ])
  })

  it('parses spreadsheet blocks with __line__ meal headers and following rows', () => {
    const result = makeSpreadsheetResult([
      { __line__: 'Pequeno-almoço' },
      { __line__: 'Papas de aveia' },
      { __line__: 'Whey protein' },
      { __line__: 'Almoço' },
      { __line__: 'Arroz basmati' },
      { __line__: 'Peru grelhado' },
    ])

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Papas de aveia',
      'Whey protein',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'almoco')?.items).toEqual([
      'Arroz basmati',
      'Peru grelhado',
    ])
  })

  it('parses pdf lines with meal and items on the same line', () => {
    const result = makePdfResult([
      'Pequeno-almoço: Ovos mexidos; pão integral',
      'Almoço: arroz; legumes salteados',
      'Jantar: salmão grelhado | batata doce',
    ].join('\n'))

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Ovos mexidos',
      'pão integral',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'jantar')?.items).toEqual([
      'salmão grelhado',
      'batata doce',
    ])
  })

  it('formats pdf nutrition lines with quantity and 4 trailing numbers', () => {
    const result = makePdfResult([
      'Pequeno-almoço',
      'Leite semi-desnatado 250 ml 120 8 12 5',
      'Pasta de amendoim 15 g 90 4 3 8',
      'Jantar',
      'Salada + azeite 100 g + 5 g 70 1 5 5',
    ].join('\n'))

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      'Leite semi-desnatado · 250 ml · 120 kcal · proteínas: 8 g · carboidratos: 12 g · gorduras: 5 g',
      'Pasta de amendoim · 15 g · 90 kcal · proteínas: 4 g · carboidratos: 3 g · gorduras: 8 g',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'jantar')?.items).toEqual([
      'Salada + azeite · 100 g + 5 g · 70 kcal · proteínas: 1 g · carboidratos: 5 g · gorduras: 5 g',
    ])
  })

  it('ignores timed meal headers repeated as content in pdf plans', () => {
    const result = makePdfResult([
      '00 - Pequeno-almoço',
      '4 Ovos inteiros (Cozidos, mexidos ou omelete)',
      '80g de Aveia em flocos',
      '30 - Almoço',
      '200g de Arroz Integral ou Massa Integral cozida',
    ].join('\n'))

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'pequeno_almoco')?.items).toEqual([
      '4 Ovos inteiros (Cozidos, mexidos ou omelete)',
      '80g de Aveia em flocos',
    ])
    expect(parsed.meals.find((meal) => meal.key === 'almoco')?.items).toEqual([
      '200g de Arroz Integral ou Massa Integral cozida',
    ])
  })

  it('maps ceia and pós-treino to lanche and ignores nutrition noise', () => {
    const result = makePdfResult([
      'Ceia: Caseína',
      'Pós treino: banana',
      'Kcal',
      'Proteínas',
    ].join('\n'))

    const parsed = parseDietImport(result)

    expect(parsed.meals.find((meal) => meal.key === 'lanche')?.items).toEqual([
      'Caseína',
      'banana',
    ])
  })
})
