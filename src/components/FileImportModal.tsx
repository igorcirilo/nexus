'use client'

import { useMemo, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import ImportPreview from '@/components/ImportPreview'
import { extractPdfText } from '@/lib/pdf'
import { parseSpreadsheetFile, downloadXlsx } from '@/lib/spreadsheet'
import type { FileImportResult, FileImportStatus, ImportSourceKind } from '@/types'

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10,12,18,.72)',
  backdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 9999,
}

const modal: CSSProperties = {
  width: '100%',
  maxWidth: 520,
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--bg2)',
  border: '0.5px solid var(--border)',
  borderRadius: 20,
  boxShadow: '0 20px 80px rgba(0,0,0,.35)',
}

type ImportDomain = 'diet' | 'training'

type SpreadsheetCell = string | number

type SpreadsheetTemplate = {
  /** Rótulo apresentado ao utilizador (ex.: "Modelo masculino"). */
  name: string
  /** Nota curta sobre o conteúdo do modelo. */
  description: string
  /** Nome do ficheiro descarregado (sem extensão — fica .xlsx). */
  fileName: string
  /** Nome da aba dentro do ficheiro. */
  sheetName: string
  /** Linhas de dados (números nas colunas numéricas, texto no resto). */
  rows: SpreadsheetCell[][]
}

type ImportGuide = {
  who: string
  columns: string[]
  /** Largura sugerida de cada coluna no XLSX (em caracteres). */
  columnWidths: number[]
  /** Pré-visualização da estrutura esperada (cabeçalho + exemplos). */
  example: SpreadsheetCell[][]
  /** Um ou mais modelos XLSX prontos a descarregar. */
  templates: SpreadsheetTemplate[]
  /** Exemplo de prompt para o Claude (faz perguntas antes de gerar). */
  prompt: string
}

// Colunas alinhadas com o parser (looksLikeDietHeaderRow / looksLikeTrainingHeaderRow
// em src/lib/body-plan.ts). Mantém esta ordem exata para máxima compatibilidade.
// Calorias, macros, séries e carga ficam como NÚMEROS (sem unidades).
const IMPORT_GUIDES: Record<ImportDomain, ImportGuide> = {
  diet: {
    who: 'nutricionista',
    columns: ['refeição', 'alimento', 'quantidade', 'calorias (kcal)', 'proteínas (g)', 'carboidratos (g)', 'gorduras (g)'],
    columnWidths: [16, 28, 14, 14, 14, 16, 14],
    example: [
      ['Café da manhã', 'Ovos', '2 unidades', 140, 12, 1, 10],
      ['Café da manhã', 'Aveia', '50 g', 190, 7, 30, 4],
      ['Almoço', 'Arroz', '120 g', 156, 3, 34, 1],
    ],
    templates: [
      {
        name: 'Modelo de dieta equilibrada (~2200 kcal)',
        description: 'Exemplo generalista para homens e mulheres · 4 refeições · alta em proteína',
        fileName: 'modelo-dieta-equilibrada',
        sheetName: 'Dieta',
        rows: [
          ['Café da manhã', 'Ovos inteiros', '3 unidades', 210, 18, 2, 14],
          ['Café da manhã', 'Pão integral', '2 fatias', 160, 7, 28, 2],
          ['Café da manhã', 'Banana', '1 unidade', 90, 1, 23, 0],
          ['Café da manhã', 'Café sem açúcar', '1 xícara', 5, 0, 0, 0],
          ['Almoço', 'Arroz integral', '150 g', 195, 4, 41, 1],
          ['Almoço', 'Feijão preto', '130 g', 120, 8, 20, 1],
          ['Almoço', 'Peito de frango grelhado', '150 g', 250, 47, 0, 5],
          ['Almoço', 'Brócolis cozido', '120 g', 40, 3, 8, 0],
          ['Almoço', 'Salada verde com azeite', '1 prato', 110, 2, 6, 9],
          ['Lanche', 'Iogurte natural desnatado', '170 g', 100, 10, 8, 4],
          ['Lanche', 'Aveia em flocos', '30 g', 115, 4, 20, 2],
          ['Lanche', 'Maçã', '1 unidade', 80, 0, 21, 0],
          ['Lanche', 'Amêndoas', '15 g', 90, 3, 3, 8],
          ['Jantar', 'Salmão grelhado', '150 g', 310, 34, 0, 19],
          ['Jantar', 'Batata-doce cozida', '150 g', 130, 2, 30, 0],
          ['Jantar', 'Legumes salteados', '150 g', 90, 3, 12, 3],
          ['Jantar', 'Azeite de oliva', '1 colher de sopa', 90, 0, 0, 10],
        ],
      },
    ],
    prompt: [
      'És um nutricionista experiente. Antes de criar qualquer plano alimentar, faz-me PRIMEIRO as seguintes perguntas e aguarda as minhas respostas (não geres a dieta já):',
      '• Objetivo principal (emagrecimento, ganho de massa, manutenção, performance ou saúde geral)',
      '• Idade · Sexo · Peso · Altura',
      '• Nível de atividade física',
      '• Restrições alimentares · Preferências alimentares · Alimentos que não gosto',
      '• Número de refeições por dia · Horários aproximados das refeições',
      '• Condições de saúde relevantes · Uso de suplementos',
      '• Rotina de trabalho/estudo · Orçamento alimentar · Nível de habilidade na cozinha',
      '',
      'Só depois de teres as minhas respostas, gera uma dieta estruturada, clara e prática.',
      'Apresenta o resultado final como uma tabela com as colunas exatamente nesta ordem: refeição, alimento, quantidade, calorias (kcal), proteínas (g), carboidratos (g), gorduras (g).',
      'Uma linha por alimento, repetindo o nome da refeição em cada linha. Usa apenas números (sem unidades) nas colunas de calorias e macros, para eu poder colar diretamente numa planilha XLSX.',
      'No fim, deixa claro que a dieta é uma orientação geral e não substitui acompanhamento profissional individualizado.',
    ].join('\n'),
  },
  training: {
    who: 'treinador',
    columns: ['dia', 'exercício', 'séries', 'reps alvo', 'descanso', 'carga (kg)'],
    columnWidths: [30, 32, 8, 12, 12, 12],
    example: [
      ['Segunda - Inferiores', 'Agachamento livre', 4, '8-12', '90s', 40],
      ['Segunda - Inferiores', 'Leg press', 4, '10-12', '90s', 80],
      ['Terça - Superiores', 'Supino reto', 4, '8-12', '90s', 30],
    ],
    templates: [
      {
        name: 'Modelo feminino',
        description: 'Foco em inferiores, glúteos, posterior e quadríceps + core',
        fileName: 'modelo-treino-feminino',
        sheetName: 'Treino feminino',
        rows: [
          ['Segunda - Inferiores (Glúteos e Posterior)', 'Agachamento livre', 4, '8-12', '90s', 30],
          ['Segunda - Inferiores (Glúteos e Posterior)', 'Levantamento terra romeno', 4, '10-12', '90s', 30],
          ['Segunda - Inferiores (Glúteos e Posterior)', 'Elevação pélvica (hip thrust)', 4, '10-12', '90s', 40],
          ['Segunda - Inferiores (Glúteos e Posterior)', 'Cadeira flexora', 3, '12-15', '60s', 25],
          ['Segunda - Inferiores (Glúteos e Posterior)', 'Panturrilha em pé', 4, '15-20', '45s', 20],
          ['Quarta - Superiores e Core', 'Supino com halteres', 3, '10-12', '60s', 10],
          ['Quarta - Superiores e Core', 'Puxada frontal', 3, '10-12', '60s', 30],
          ['Quarta - Superiores e Core', 'Desenvolvimento de ombros', 3, '12', '60s', 8],
          ['Quarta - Superiores e Core', 'Prancha abdominal', 3, '30-45s', '45s', 0],
          ['Quarta - Superiores e Core', 'Abdominal infra', 3, '15', '45s', 0],
          ['Sexta - Inferiores (Quadríceps e Glúteos)', 'Leg press', 4, '10-12', '90s', 80],
          ['Sexta - Inferiores (Quadríceps e Glúteos)', 'Afundo (passada)', 3, '10-12 cada', '75s', 14],
          ['Sexta - Inferiores (Quadríceps e Glúteos)', 'Cadeira extensora', 4, '12-15', '60s', 30],
          ['Sexta - Inferiores (Quadríceps e Glúteos)', 'Abdução de quadril', 4, '15-20', '45s', 25],
          ['Sexta - Inferiores (Quadríceps e Glúteos)', 'Elevação pélvica unilateral', 3, '12 cada', '60s', 0],
        ],
      },
      {
        name: 'Modelo masculino',
        description: 'Divisão equilibrada: peito, costas, ombros, braços, pernas e core',
        fileName: 'modelo-treino-masculino',
        sheetName: 'Treino masculino',
        rows: [
          ['Segunda - Peito e Tríceps', 'Supino reto', 4, '8-10', '90s', 50],
          ['Segunda - Peito e Tríceps', 'Supino inclinado com halteres', 3, '10-12', '75s', 20],
          ['Segunda - Peito e Tríceps', 'Crucifixo na máquina', 3, '12-15', '60s', 25],
          ['Segunda - Peito e Tríceps', 'Tríceps na polia', 4, '12', '60s', 25],
          ['Segunda - Peito e Tríceps', 'Tríceps francês', 3, '12', '60s', 12],
          ['Terça - Costas e Bíceps', 'Barra fixa (ou puxada assistida)', 4, '8-10', '90s', 0],
          ['Terça - Costas e Bíceps', 'Remada curvada', 4, '10', '90s', 40],
          ['Terça - Costas e Bíceps', 'Remada unilateral com haltere', 3, '10-12', '60s', 22],
          ['Terça - Costas e Bíceps', 'Rosca direta', 3, '12', '60s', 16],
          ['Terça - Costas e Bíceps', 'Rosca martelo', 3, '12', '60s', 12],
          ['Quinta - Pernas e Core', 'Agachamento livre', 4, '6-8', '120s', 70],
          ['Quinta - Pernas e Core', 'Leg press', 4, '10-12', '90s', 120],
          ['Quinta - Pernas e Core', 'Cadeira extensora', 3, '12-15', '60s', 40],
          ['Quinta - Pernas e Core', 'Mesa flexora', 3, '12', '60s', 35],
          ['Quinta - Pernas e Core', 'Prancha abdominal', 3, '45s', '45s', 0],
          ['Sexta - Ombros e Braços', 'Desenvolvimento militar', 4, '8-10', '90s', 30],
          ['Sexta - Ombros e Braços', 'Elevação lateral', 4, '12-15', '45s', 8],
          ['Sexta - Ombros e Braços', 'Remada alta', 3, '12', '60s', 25],
          ['Sexta - Ombros e Braços', 'Rosca direta', 3, '12', '60s', 16],
          ['Sexta - Ombros e Braços', 'Tríceps testa', 3, '12', '60s', 14],
        ],
      },
    ],
    prompt: [
      'És um treinador/personal trainer experiente. Antes de montar qualquer treino, faz-me PRIMEIRO as seguintes perguntas e aguarda as minhas respostas (não geres o treino já):',
      '• Objetivo principal (hipertrofia, emagrecimento, força, condicionamento ou saúde geral)',
      '• Idade · Sexo · Peso · Altura',
      '• Nível de experiência com treino · Histórico de treino · Nível de condicionamento atual',
      '• Frequência semanal disponível · Tempo disponível por treino',
      '• Local de treino (academia, casa ou ambos) · Equipamentos disponíveis',
      '• Lesões ou limitações físicas',
      '• Grupos musculares prioritários · Exercícios que gosto ou não gosto',
      '• Preferência por divisão de treino · Foco específico (glúteos, pernas, superiores, core ou corpo inteiro)',
      '',
      'Só depois de teres as minhas respostas, gera um treino estruturado.',
      'Apresenta o resultado final como uma tabela com as colunas exatamente nesta ordem: dia, exercício, séries, reps alvo, descanso, carga (kg).',
      'Uma linha por exercício, repetindo o nome do dia/secção em todos os exercícios desse bloco. Usa números na coluna carga (kg) — 0 quando for peso corporal — para eu poder colar diretamente numa planilha XLSX.',
      'No fim, deixa claro que o treino é uma orientação geral e não substitui acompanhamento profissional individualizado.',
    ].join('\n'),
  },
}

function downloadTemplate(guide: ImportGuide, template: SpreadsheetTemplate) {
  void downloadXlsx(template.fileName, [
    {
      name: template.sheetName,
      columns: guide.columns,
      rows: template.rows,
      columnWidths: guide.columnWidths,
    },
  ])
}

type Props = {
  open: boolean
  title: string
  kind: ImportSourceKind | 'mixed'
  domain?: ImportDomain
  onClose: () => void
  onConfirm?: (result: FileImportResult) => void | Promise<void>
  confirmLabel?: string
}

export default function FileImportModal({
  open,
  title,
  kind,
  domain,
  onClose,
  onConfirm,
  confirmLabel = 'Confirmar',
}: Props) {
  const guide = domain ? IMPORT_GUIDES[domain] : null
  const [status, setStatus] = useState<FileImportStatus>('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState<FileImportResult | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')

  const accept = useMemo(() => {
    if (kind === 'pdf') return '.pdf,application/pdf'
    if (kind === 'spreadsheet') return '.xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
    return '.pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv'
  }, [kind])

  if (!open) return null

  async function handleFile(file: File) {
    setSelectedFileName(file.name)
    setStatus('loading')
    setError('')
    setResult(null)

    try {
      const lower = file.name.toLowerCase()
      const fileKind: ImportSourceKind =
        lower.endsWith('.pdf') || file.type.includes('pdf') ? 'pdf' : 'spreadsheet'

      if (kind !== 'mixed' && fileKind !== kind) {
        throw new Error(kind === 'pdf' ? 'Escolhe um PDF.' : 'Escolhe uma planilha ou CSV.')
      }

      const parsed = fileKind === 'pdf'
        ? await extractPdfText(file)
        : await parseSpreadsheetFile(file)

      setResult(parsed)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Nao foi possivel ler o ficheiro.')
    }
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    await handleFile(file)
    event.target.value = ''
  }

  async function handleConfirm() {
    if (!result || !onConfirm) return
    await onConfirm(result)
  }

  function reset() {
    setStatus('idle')
    setError('')
    setResult(null)
    setSelectedFileName('')
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(event) => event.stopPropagation()}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Upload com leitura base, preview e validacao inicial.
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ flex: '1 1 auto', minHeight: 120, padding: 16, overflowY: 'auto', display: 'grid', gap: 14, alignContent: 'start' }}>
          <label style={{
            display: 'grid',
            gap: 8,
            border: '1px dashed rgba(255,255,255,.14)',
            borderRadius: 16,
            padding: 16,
            background: 'var(--bg1)',
            cursor: 'pointer',
          }}>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>Escolher ficheiro</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Aceita {kind === 'pdf' ? 'PDF' : kind === 'spreadsheet' ? 'XLSX, XLS e CSV' : 'PDF, XLSX, XLS e CSV'}.
            </span>
            <span style={{ fontSize: 12, color: selectedFileName ? 'var(--teal)' : 'var(--text2)' }}>
              {selectedFileName || 'Nenhum ficheiro selecionado'}
            </span>
            <input type="file" accept={accept} onChange={onPickFile} style={{ display: 'none' }} />
          </label>

          {guide && (
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14, display: 'grid', gap: 10 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>
                Para o melhor aproveitamento
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                Pede ao teu {guide.who} para entregar a planilha com estas colunas — ou descarrega um modelo XLSX abaixo e edita. Quanto mais completa, melhor a app lê.
              </div>
              <div style={{ overflowX: 'auto', border: '0.5px solid var(--border)', borderRadius: 10 }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap', width: '100%' }}>
                  <thead>
                    <tr>
                      {guide.columns.map((col) => (
                        <th key={col} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--teal)', borderBottom: '0.5px solid var(--border)', fontWeight: 700 }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {guide.example.slice(0, 3).map((rowCells, ri) => (
                      <tr key={ri}>
                        {rowCells.map((cell, ci) => (
                          <td key={ci} style={{ padding: '6px 10px', color: 'var(--text2)', borderBottom: ri < 2 ? '0.5px solid rgba(255,255,255,.05)' : 'none' }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                {guide.templates.length > 1 ? 'Modelos XLSX prontos a usar:' : 'Modelo XLSX pronto a usar:'}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {guide.templates.map((template) => (
                  <button
                    key={template.fileName}
                    type="button"
                    onClick={() => downloadTemplate(guide, template)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      background: 'var(--bg3)',
                      color: 'var(--text1)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1, color: 'var(--teal)' }}>↓</span>
                    <span style={{ display: 'grid', gap: 2 }}>
                      <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 12 }}>
                        Baixar {template.name} (XLSX)
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                        {template.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <details style={{ fontSize: 12, color: 'var(--text3)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text2)' }}>
                  Exemplo de prompt para o Claude (gerar {domain === 'diet' ? 'dieta' : 'treino'})
                </summary>
                <div style={{ marginTop: 8, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 10, lineHeight: 1.5, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>
                  {guide.prompt}
                </div>
              </details>
            </div>
          )}

          {status === 'loading' && (
            <div style={{ background: 'var(--bg1)', border: '0.5px solid var(--border)', borderRadius: 14, padding: 14, fontSize: 13, color: 'var(--text2)' }}>
              A ler conteudo e a montar preview...
            </div>
          )}

          {status === 'error' && (
            <div style={{ background: 'rgba(226,75,74,.08)', border: '0.5px solid rgba(226,75,74,.35)', borderRadius: 14, padding: 14, fontSize: 13, color: '#FFB4B1' }}>
              {error}
            </div>
          )}

          {result && <ImportPreview result={result} />}
        </div>

        <div style={{ padding: 16, borderTop: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button
            onClick={reset}
            style={{
              background: 'var(--bg1)',
              color: 'var(--text2)',
              border: '0.5px solid var(--border)',
              borderRadius: 12,
              padding: '10px 14px',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Limpar
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                color: 'var(--text3)',
                border: '0.5px solid var(--border)',
                borderRadius: 12,
                padding: '10px 14px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
            <button
              disabled={!result || !onConfirm}
              onClick={handleConfirm}
              style={{
                background: !result || !onConfirm ? 'rgba(232,168,56,.35)' : 'var(--gold)',
                color: 'var(--bg0)',
                border: 'none',
                borderRadius: 12,
                padding: '10px 16px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                cursor: !result || !onConfirm ? 'not-allowed' : 'pointer',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
