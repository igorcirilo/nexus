'use client'

import Icon, { type IconName } from '@/components/ui/Icon'

type EmptyAction =
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href: string; onClick?: never }

type GenericProps = {
  icon: IconName
  title: string
  body: string
  action?: EmptyAction
}

type LegacyProps = {
  hasHabits: boolean
  hasMission: boolean
  username: string
}

type Props = GenericProps | LegacyProps

export default function EmptyState(props: Props) {
  if ('title' in props) {
    return <GenericEmptyState {...props} />
  }

  const steps = [
    {
      done: props.hasMission,
      icon: 'clipboard' as IconName,
      title: 'Define a missão do dia',
      body: 'Faz o check-in da manhã para definir o teu foco.',
      action: { label: 'Fazer check-in', href: '/checkin' },
    },
    {
      done: props.hasHabits,
      icon: 'target' as IconName,
      title: 'Adiciona os teus hábitos',
      body: 'Cria pelo menos 3 hábitos para acompanhar diariamente.',
      action: { label: 'Ir para Hábitos', href: '/habitos' },
    },
  ].filter(step => !step.done)

  if (steps.length === 0) return null

  return (
    <div style={{ margin: '12px 20px 0', display: 'grid', gap: 10 }}>
      <div
        style={{
          padding: 'var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg2)',
          border: '0.5px solid rgba(232,168,56,.2)',
        }}
      >
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text1)', marginBottom: 4 }}>
          Olá, {props.username}
        </div>
        <div style={{ fontSize: 'var(--text-base)', color: 'var(--text2)', lineHeight: 1.5 }}>
          Faltam {steps.length} passo{steps.length > 1 ? 's' : ''} para activar o teu painel completo.
        </div>
      </div>

      {steps.map((step, index) => (
        <GenericEmptyState
          key={step.title}
          icon={step.icon}
          title={`${index + 1}. ${step.title}`}
          body={step.body}
          action={step.action}
        />
      ))}
    </div>
  )
}

function GenericEmptyState({ icon, title, body, action }: GenericProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-8) var(--space-4)',
        background: 'var(--bg2)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(30,203,180,.1)',
          border: '0.5px solid rgba(30,203,180,.22)',
          color: 'var(--teal)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} />
      </div>
      <div>
        <h3
          style={{
            fontFamily: 'Syne, sans-serif',
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            color: 'var(--text1)',
            marginBottom: 6,
          }}
        >
          {title}
        </h3>
        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text3)', lineHeight: 1.5, maxWidth: 320 }}>
          {body}
        </p>
      </div>
      {action && 'href' in action ? (
        <a
          href={action.href}
          style={{
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--gold)',
            color: 'var(--on-bright)',
            textDecoration: 'none',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 'var(--text-base)',
            touchAction: 'manipulation',
          }}
        >
          {action.label}
        </a>
      ) : action ? (
        <button
          type="button"
          onClick={action.onClick}
          style={{
            minHeight: 44,
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--gold)',
            color: 'var(--on-bright)',
            padding: '0 var(--space-4)',
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: 'var(--text-base)',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
