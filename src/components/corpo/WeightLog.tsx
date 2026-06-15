'use client'
import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import EmptyState from '@/components/EmptyState'
import { useToast } from '@/components/Toast'
import { getWeightLogs, upsertWeightLog, deleteWeightLog, type WeightLog } from '@/lib/body'
import { updateProfile } from '@/lib/supabase'
import { todayISO, parseLocalDate } from '@/lib/date'

interface Props {
  userId: string
  heightCm: number | null
  onHeightSave: (cm: number) => void
}

type Filter = 30 | 90 | 0

export default function WeightLogComponent({ userId, heightCm, onHeightSave }: Props) {
  const toast = useToast()
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [filter, setFilter] = useState<Filter>(30)
  const [weightIn, setWeightIn] = useState('')
  const [dateIn, setDateIn] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const weightInputRef = useRef<HTMLInputElement | null>(null)
  const [heightVal, setHeightVal] = useState(heightCm ? String(heightCm) : '')
  const [heightEditing, setHeightEditing] = useState(heightCm === null)
  const [heightSaving, setHeightSaving] = useState(false)

  useEffect(() => {
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }, [userId, filter])

  async function handleSave() {
    const kg = parseFloat(weightIn.replace(',', '.'))
    if (isNaN(kg) || kg <= 0 || kg > 500) { toast.error('Peso inválido'); return }
    setSaving(true)
    await upsertWeightLog(userId, dateIn, kg)
    setSaving(false)
    toast.success('Peso registado!')
    setWeightIn('')
    getWeightLogs(userId, filter || undefined).then(setLogs)
  }

  async function handleDelete(id: string) {
    await deleteWeightLog(userId, id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  async function handleHeightSave() {
    const cm = parseFloat(heightVal.replace(',', '.'))
    if (isNaN(cm) || cm < 50 || cm > 250) { toast.error('Altura inválida'); return }
    setHeightSaving(true)
    await updateProfile(userId, { height_cm: cm })
    setHeightSaving(false)
    setHeightEditing(false)
    onHeightSave(cm)
    toast.success('Altura guardada!')
  }

  // Média móvel de 7 registos: suaviza o ruído diário e mostra a tendência real,
  // reduzindo a ansiedade com flutuações de 0,2–0,5 kg que não significam nada.
  const chartData = logs.map((l, i) => {
    const windowSlice = logs.slice(Math.max(0, i - 6), i + 1)
    const avg = windowSlice.reduce((sum, x) => sum + Number(x.weight_kg), 0) / windowSlice.length
    return {
      date: format(parseLocalDate(l.date), 'd MMM', { locale: pt }),
      kg: Number(l.weight_kg),
      media: Math.round(avg * 10) / 10,
    }
  })

  // Domínio Y com folga generosa: evita que o eixo auto-escale e exagere
  // variações pequenas, transformando ruído em "queda/subida" dramática.
  const weights = logs.map(l => Number(l.weight_kg))
  const dataMin = weights.length ? Math.min(...weights) : 0
  const dataMax = weights.length ? Math.max(...weights) : 0
  const yPad = Math.max(2, dataMax - dataMin)
  const yDomain: [number, number] = [Math.floor(dataMin - yPad), Math.ceil(dataMax + yPad)]

  const latest = logs[logs.length - 1]
  const first = logs[0]
  const deltaNum = latest && first && logs.length > 1
    ? Number(latest.weight_kg) - Number(first.weight_kg)
    : null
  const deltaAbs = deltaNum !== null ? Math.abs(deltaNum).toFixed(1) : null
  // Tom neutro: direção sem juízo de valor (subir não é "mau", descer não é "bom").
  const deltaArrow = deltaNum === null ? '' : Math.abs(deltaNum) < 0.1 ? '→' : deltaNum > 0 ? '↑' : '↓'
  const deltaLabel = deltaNum === null ? '' : Math.abs(deltaNum) < 0.1 ? 'estável' : `${deltaArrow} ${deltaAbs} kg`

  const filterLabels: { value: Filter; label: string }[] = [
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'Tudo' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Altura card */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: heightEditing ? 10 : 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Altura
          </div>
          {!heightEditing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Syne, sans-serif' }}>
                {heightCm} cm
              </span>
              <button onClick={() => setHeightEditing(true)} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                editar
              </button>
            </div>
          )}
        </div>
        {heightEditing && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="170"
              value={heightVal}
              onChange={e => setHeightVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleHeightSave() }}
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text1)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, padding: '8px 10px', outline: 'none', width: 90 }}
            />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>cm</span>
            <button onClick={handleHeightSave} disabled={heightSaving || !heightVal} style={{ background: heightVal ? 'var(--gold)' : 'var(--bg3)', color: heightVal ? '#000' : 'var(--text3)', border: 'none', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 14, padding: '8px 16px', cursor: heightVal ? 'pointer' : 'not-allowed' }}>
              {heightSaving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Data
          </label>
          <input
            type="date"
            value={dateIn}
            onChange={e => setDateIn(e.target.value)}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              padding: '8px 10px',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Peso (kg)
          </label>
          <input
            ref={weightInputRef}
            type="number"
            inputMode="decimal"
            placeholder="75.4"
            value={weightIn}
            onChange={e => setWeightIn(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text1)',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 14,
              padding: '8px 10px',
              outline: 'none',
              width: 100,
            }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !weightIn}
          style={{
            background: weightIn ? 'var(--gold)' : 'var(--bg3)',
            color: weightIn ? '#000' : 'var(--text3)',
            border: 'none',
            borderRadius: 8,
            fontFamily: 'DM Sans, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            padding: '8px 18px',
            cursor: saving || !weightIn ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {saving ? 'A guardar…' : 'Registar'}
        </button>
      </div>

      {/* Stats row */}
      {latest && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 16px',
            flex: 1,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Último
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Syne, sans-serif' }}>
              {Number(latest.weight_kg)} kg
            </div>
          </div>

          {deltaNum !== null && (
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '10px 16px',
              flex: 1,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Tendência no período
              </div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: 'Syne, sans-serif',
                color: 'var(--text1)',
              }}>
                {deltaLabel}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {logs.length > 1 && (
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '14px 4px 8px',
        }}>
          {/* Filter buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, paddingRight: 12, marginBottom: 8 }}>
            {filterLabels.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                style={{
                  background: filter === value ? 'var(--teal)' : 'var(--bg3)',
                  color: filter === value ? '#000' : 'var(--text2)',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'DM Sans, sans-serif',
                  fontWeight: 600,
                  padding: '3px 10px',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Alternativa textual para leitores de ecrã: o SVG do recharts não é legível. */}
          <div
            role="img"
            aria-label={
              latest
                ? `Gráfico de peso. Atual ${Number(latest.weight_kg)} kg. Tendência no período: ${deltaLabel || 'sem variação'}.`
                : 'Gráfico de evolução do peso'
            }
          >
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: 'DM Sans, sans-serif',
                  fontSize: 13,
                  color: 'var(--text1)',
                }}
                formatter={(v: number, name) => [`${v} kg`, name === 'media' ? 'Média 7d' : 'Peso']}
                labelStyle={{ color: 'var(--text3)', fontSize: 11 }}
              />
              {/* Registos diários: discretos, em segundo plano */}
              <Line
                type="monotone"
                dataKey="kg"
                name="kg"
                stroke="var(--text3)"
                strokeWidth={1}
                dot={{ r: 2, fill: 'var(--text3)' }}
                activeDot={{ r: 4 }}
              />
              {/* Tendência (média móvel): a linha que realmente importa */}
              <Line
                type="monotone"
                dataKey="media"
                name="media"
                stroke="var(--teal)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
          {/* Legenda do gráfico (texto + cor, nunca só cor) */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, fontSize: 10.5, color: 'var(--text3)', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 14, height: 2, background: 'var(--teal)', borderRadius: 1, display: 'inline-block' }} />
              Tendência (média 7d)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 6, height: 6, background: 'var(--text3)', borderRadius: '50%', display: 'inline-block' }} />
              Registo diário
            </span>
          </div>
        </div>
      )}

      {/* History list */}
      {logs.length === 0 ? (
        <EmptyState
          icon="scale"
          title="Registre seu peso hoje"
          body="Registre seu peso hoje e acompanhe sua tendência ao longo do tempo."
          action={{
            label: 'Inserir peso',
            onClick: () => weightInputRef.current?.focus(),
          }}
        />
      ) : (
        <div>
          <div style={{
            fontSize: 11,
            color: 'var(--text3)',
            fontFamily: 'DM Sans, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600,
            marginBottom: 8,
          }}>
            Histórico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[...logs].reverse().map(l => (
              <div
                key={l.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 12px',
                }}
              >
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, color: 'var(--text1)', fontWeight: 600 }}>
                  {Number(l.weight_kg)} kg
                </span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--text3)' }}>
                  {format(parseLocalDate(l.date), "d 'de' MMM", { locale: pt })}
                </span>
                <button
                  onClick={() => handleDelete(l.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text3)',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '2px 4px',
                    borderRadius: 4,
                  }}
                  aria-label="Eliminar registo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
