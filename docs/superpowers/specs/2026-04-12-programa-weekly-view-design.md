# Design: Página /programa — Visualização Semanal

**Data:** 2026-04-12
**Status:** Aprovado
**Sprint:** 3 — Fase 1

---

## Contexto

O programa de 63 dias foi gerado (Sprint 2), mas o usuário não tem como visualizar a estrutura completa. Esta feature adiciona a página `/programa`: um carrossel de semanas onde o usuário navega pelos 9 blocos temáticos, vê o status de cada dia e consulta as tasks de qualquer dia em um drawer inline.

---

## Decisões de design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Layout | Carrossel de semanas | Uma semana de cada vez, foco no contexto atual |
| Tap no dia | Drawer inline | Não muda de página, mais imersivo |
| Acesso | Botão em `/hoje` | Evita alterar menu global neste sprint |
| Estado | `useState` local | Sem necessidade de estado global |

---

## Layout e UX

### Página `/programa`

```
┌─────────────────────────────────┐
│ ← Voltar    Seu Programa        │  ← header
│             Dia 9 de 63 · S2    │
├─────────────────────────────────┤
│ ████░░░░░░░░░░░░░░░░░░░░░░ 14% │  ← barra progresso global
├─────────────────────────────────┤
│  ◀   Semana 2 — Ritmo   ▶      │  ← nav semana
│       Dias 8–14                 │
├─────────────────────────────────┤
│  [8] [9] [10✦] [11] [12][13][14]│  ← grid 7 dias
│   ✓   ½   hoje   –    –   –   – │
├─────────────────────────────────┤
│  • • ● • • • • • •             │  ← dots semanas (9)
├─────────────────────────────────┤
│ ┌── Drawer: Dia 9 ──────────── ┐│
│ │ ✓ Treinar 30min   corpo      ││  ← drawer inline
│ │ ✓ Bloco foco      produt.    ││
│ │ ○ Meditação       emoções    ││
│ └───────────────────────────── ┘│
└─────────────────────────────────┘
```

### Cards de dia — estados visuais

| Estado | Background | Border | Barra | Texto |
|--------|-----------|--------|-------|-------|
| Concluído (100%) | bg2 | border | teal 100% | text1 |
| Parcial (>0%) | bg2 | border | gold proporcional | text1 |
| Hoje | accent/12% | accent | accent | accent |
| Futuro | bg2 | border/40% | bg3 | text3, opacity .4 |
| Selecionado | bg2 | accent | — | text1 |

### Drawer

- Abre ao clicar em qualquer dia (passado, hoje ou futuro)
- Mostra: data formatada + número do dia + tema da semana + contagem tasks
- Lista de tasks: ícone de status (✓ teal / ○ vazio / – pulado) + título + área + XP
- Tasks de dias futuros: exibidas sem status (pending)
- Fechar: clicar em outro dia ou no mesmo dia novamente (toggle)

---

## Arquitetura

### Novos arquivos

**`src/app/programa/page.tsx`** — página completa (client component)
- Busca `getProgramWithWeeks(userId)` ao montar
- Estado: `selectedWeek` (1–9, inicia na semana atual), `selectedDayId` (string | null)
- Ao mudar semana: limpa `selectedDayId`
- Ao clicar dia: se mesmo ID → fecha (null); senão → abre e busca tasks via `getProgramTasks(dayId)` (já existe em `src/lib/program.ts:61`)

### Arquivos modificados

**`src/lib/program.ts`** — adicionar:

```ts
export async function getProgramWithWeeks(userId: string): Promise<{
  program: Program
  weeks: (ProgramWeek & { days: ProgramDay[] })[]
} | null>
```

Lógica:
1. Busca programa ativo do usuário (`status = 'active'`) via `profiles.program_id`
2. Busca `program_weeks` ordenadas por `week_number`
3. Para cada semana, busca `program_days` ordenados por `day_number`
4. Retorna `null` se não houver programa ativo

**`src/app/hoje/page.tsx`** — adicionar link no rodapé:

```tsx
<button className="btn-ghost" onClick={() => router.push('/programa')}>
  Ver programa completo →
</button>
```

Condição: só exibir se `programDay` existir (usuário tem programa ativo).

---

## Semana atual

A semana inicial do carrossel é calculada pela data de hoje:

```ts
function currentWeekNumber(program: Program): number {
  const start = new Date(program.started_at)
  const today = new Date()
  const dayDiff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return Math.min(Math.floor(dayDiff / 7) + 1, 9)
}
```

---

## Estados de loading e erro

- Loading inicial: spinner centralizado (padrão do projeto — `border-top: transparent` + `animation: spin`)
- Sem programa ativo: mensagem "Nenhum programa ativo" + botão "Fazer diagnóstico →" para `/onboarding-v2`
- Erro ao buscar tasks do drawer: texto "Erro ao carregar tarefas" dentro do drawer

---

## Fora do escopo desta feature

- Edição de tasks a partir do `/programa` (só leitura)
- Navegação para `/hoje` ao clicar em "hoje" no carrossel (já é o comportamento do botão Voltar)
- Streak ou XP acumulado por semana
- Animação de swipe entre semanas (só setas)

---

## Tipos necessários (já existem em `src/types/index.ts`)

- `Program`, `ProgramWeek`, `ProgramDay`, `ProgramTask` — todos definidos no Sprint 1
- Nenhum tipo novo necessário
