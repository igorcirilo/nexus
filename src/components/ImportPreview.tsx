'use client'

import type { CSSProperties } from 'react'
import type { FileImportResult } from '@/types'

const card: CSSProperties = {
  background: 'var(--bg1)',
  border: '0.5px solid var(--border)',
  borderRadius: 14,
  padding: 14,
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function ImportPreview({ result }: { result: FileImportResult }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ ...card, display: 'grid', gap: 8 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15 }}>
          Pre-visualizacao
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div>
            <div style={{ color: 'var(--text3)', marginBottom: 4 }}>Ficheiro</div>
            <div style={{ color: 'var(--text1)', wordBreak: 'break-word' }}>{result.meta.fileName}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text3)', marginBottom: 4 }}>Tamanho</div>
            <div style={{ color: 'var(--text1)' }}>{formatSize(result.meta.fileSize)}</div>
          </div>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div style={{ ...card, border: '0.5px solid rgba(232,168,56,.35)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, marginBottom: 8, color: 'var(--gold)' }}>
            Atencao
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {result.warnings.map((warning) => (
              <div key={warning} style={{ fontSize: 12, color: 'var(--text2)' }}>
                - {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.kind === 'pdf' && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>
                Leitura base do PDF
              </div>
              <div style={{ fontSize: 12, color: result.hasUsefulText ? 'var(--teal)' : 'var(--gold)' }}>
                {result.pageCount} pagina{result.pageCount === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{
              maxHeight: 240,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              lineHeight: 1.55,
              color: 'var(--text2)',
              background: 'var(--bg0)',
              borderRadius: 12,
              border: '0.5px solid var(--border)',
              padding: 12,
            }}>
              {result.extractedText || 'Sem texto util para mostrar.'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {result.pages.slice(0, 3).map((page) => (
              <div key={page.pageNumber} style={card}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                  Pagina {page.pageNumber}
                </div>
                <div style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text2)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 120,
                  overflow: 'auto',
                }}>
                  {page.text || 'Sem texto extraido nesta pagina.'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {result.kind === 'spreadsheet' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {result.sheets.map((sheet) => (
            <div key={sheet.name} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>
                  {sheet.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {sheet.rowCount} linha{sheet.rowCount === 1 ? '' : 's'}
                </div>
              </div>

              {sheet.headers.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Sem colunas reconhecidas.</div>
              ) : (
                <div style={{
                  overflowX: 'auto',
                  border: '0.5px solid var(--border)',
                  borderRadius: 12,
                  background: 'var(--bg0)',
                }}>
                  <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr>
                        {sheet.headers.map((header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              color: 'var(--text2)',
                              borderBottom: '0.5px solid var(--border)',
                              fontWeight: 700,
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.rows.slice(0, 8).map((row, index) => (
                        <tr key={`${sheet.name}-${index}`}>
                          {sheet.headers.map((header) => (
                            <td
                              key={`${sheet.name}-${index}-${header}`}
                              style={{
                                padding: '10px 12px',
                                color: 'var(--text3)',
                                borderBottom: '0.5px solid rgba(255,255,255,.04)',
                                verticalAlign: 'top',
                              }}
                            >
                              {row[header] === null ? '—' : String(row[header])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
