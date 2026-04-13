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

type Props = {
  open: boolean
  title: string
  kind: ImportSourceKind | 'mixed'
  onClose: () => void
  onConfirm?: (result: FileImportResult) => void | Promise<void>
  confirmLabel?: string
}

export default function FileImportModal({
  open,
  title,
  kind,
  onClose,
  onConfirm,
  confirmLabel = 'Confirmar',
}: Props) {
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
