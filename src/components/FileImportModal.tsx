'use client'

import { useMemo, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'
import ImportPreview from '@/components/ImportPreview'
import { extractPdfText } from '@/lib/pdf'
import { parseSpreadsheetFile } from '@/lib/spreadsheet'
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

type ImportGuide = {
  who: string
  columns: string[]
  example: string[][]
  prompt: string
  fileName: string
}

// Colunas alinhadas com o parser (looksLikeDietHeaderRow / looksLikeTrainingHeaderRow
// em src/lib/body-plan.ts). Mantém esta ordem para máxima compatibilidade.
const IMPORT_GUIDES: Record<ImportDomain, ImportGuide> = {
  diet: {
    who: 'nutricionista',
    columns: ['refeição', 'alimento', 'quantidade', 'calorias (kcal)', 'proteínas (g)', 'carboidratos (g)', 'gorduras (g)'],
    example: [
      ['Pequeno-almoço', 'Ovos mexidos', '3 unidades', '220', '18', '2', '15'],
      ['Pequeno-almoço', 'Aveia em flocos', '60 g', '230', '8', '40', '4'],
      ['Lanche da manhã', 'Iogurte natural', '170 g', '110', '10', '8', '4'],
      ['Almoço', 'Arroz integral', '120 g', '160', '3', '34', '1'],
      ['Almoço', 'Frango grelhado', '200 g', '330', '62', '0', '7'],
      ['Lanche da tarde', 'Banana', '1 unidade', '90', '1', '23', '0'],
      ['Jantar', 'Salmão grelhado', '180 g', '370', '40', '0', '22'],
      ['Jantar', 'Brócolos cozidos', '150 g', '50', '4', '7', '1'],
      ['Ceia', 'Queijo quark', '250 g', '160', '28', '8', '1'],
    ],
    prompt: 'Cria uma planilha CSV do meu plano de dieta com as colunas exatamente nesta ordem: refeição, alimento, quantidade, calorias (kcal), proteínas (g), carboidratos (g), gorduras (g). Uma linha por alimento, repetindo o nome da refeição em cada linha. Usa números (sem unidades) nas colunas de calorias e macros.',
    fileName: 'modelo-dieta.csv',
  },
  training: {
    who: 'treinador',
    columns: ['dia', 'exercício', 'séries', 'reps alvo', 'descanso', 'carga (kg)'],
    example: [
      ['Segunda - Peito e Tríceps', 'Supino reto', '4', '8-10', '90s', '60'],
      ['Segunda - Peito e Tríceps', 'Supino inclinado halteres', '3', '10-12', '75s', '22'],
      ['Segunda - Peito e Tríceps', 'Crucifixo na máquina', '3', '12-15', '60s', '25'],
      ['Segunda - Peito e Tríceps', 'Tríceps na polia', '4', '12', '60s', '30'],
      ['Quarta - Costas e Bíceps', 'Puxada frontal', '4', '8-10', '90s', '55'],
      ['Quarta - Costas e Bíceps', 'Remada curvada', '4', '10', '90s', '50'],
      ['Quarta - Costas e Bíceps', 'Rosca direta', '3', '12', '60s', '18'],
      ['Sexta - Pernas', 'Agachamento livre', '4', '6-8', '120s', '80'],
      ['Sexta - Pernas', 'Leg press', '4', '10-12', '90s', '160'],
      ['Sexta - Pernas', 'Cadeira extensora', '3', '15', '60s', '45'],
    ],
    prompt: 'Cria uma planilha CSV do meu plano de treino com as colunas exatamente nesta ordem: dia, exercício, séries, reps alvo, descanso, carga (kg). Uma linha por exercício, agrupando por dia/secção na coluna "dia" (repete o nome do dia em cada exercício desse dia).',
    fileName: 'modelo-treino.csv',
  },
}

function downloadCsv(guide: ImportGuide) {
  const escape = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)
  const csv = [guide.columns, ...guide.example].map(row => row.map(escape).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = guide.fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
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
                Pede ao teu {guide.who} para entregar a planilha com estas colunas — ou pede ao Claude para a gerar neste formato. Quanto mais completa, melhor a app lê.
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
                    {guide.example.slice(0, 2).map((rowCells, ri) => (
                      <tr key={ri}>
                        {rowCells.map((cell, ci) => (
                          <td key={ci} style={{ padding: '6px 10px', color: 'var(--text2)', borderBottom: ri === 0 ? '0.5px solid rgba(255,255,255,.05)' : 'none' }}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => downloadCsv(guide)}
                style={{ justifySelf: 'start', background: 'var(--bg3)', color: 'var(--text1)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
              >
                ↓ Baixar modelo CSV
              </button>
              <details style={{ fontSize: 12, color: 'var(--text3)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text2)' }}>Exemplo de prompt para o Claude</summary>
                <div style={{ marginTop: 8, background: 'var(--bg2)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 10, lineHeight: 1.5, color: 'var(--text2)' }}>
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
