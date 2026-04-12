# Design: Geração de 63 dias completos

**Data:** 2026-04-12
**Status:** Aprovado
**Sprint:** 2 — Fase 1

---

## Contexto

O engine atual (`program-engine.ts`) gera apenas a semana 1 de um programa (7 dias, ~3 tasks/dia, dificuldade 1). O objetivo desta feature é gerar o programa completo de 63 dias (9 semanas × 7 dias) upfront no momento da criação do programa.

---

## Decisões de design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Estratégia de geração | Upfront (tudo de uma vez) | Sem dados de desempenho ainda, lazy não agrega valor |
| Duração | 9 semanas / 63 dias | Evita edge case de semana incompleta |
| Templates | Adicionar diff 2 e 3 | Progressão real é central para o conceito do produto |
| Copy | "63 dias" substitui "66 dias" | Alinhado com a duração real do programa |

---

## Arquitetura

### Fases de dificuldade

| Fase | Semanas | Dificuldade | Narrativa |
|------|---------|-------------|-----------|
| Fundação | 1–3 | 1 | Construir o hábito |
| Desenvolvimento | 4–6 | 2 | Intensificar |
| Maestria | 7–9 | 3 | Consolidar |

### Temas por semana

| Semana | Tema |
|--------|------|
| 1 | Fundação |
| 2 | Ritmo |
| 3 | Consistência |
| 4 | Foco |
| 5 | Expansão |
| 6 | Profundidade |
| 7 | Resistência |
| 8 | Excelência |
| 9 | Legado |

---

## Componentes afetados

### 1. `src/lib/program-engine.ts`

**Mudanças:**

- `createProgram`: corrigir `ends_at` de `today + 60` para `today + 62` (63 dias, 0-indexed).
- `selectTemplatesForWeek1` → renomear para `selectTemplatesForProgram(templates, scores, priorityArea, weekNumber)`: mesma lógica de seleção (área mais fraca + área prioritária + 1 restante), mas filtrando por dificuldade da fase correspondente ao `weekNumber`.
- `generateWeek1` → substituir por `generate63Days(userId, programId, templates, startDate)`:
  - Loop de 9 semanas: insere `program_weeks` (tema, starts_on)
  - Para cada semana: insere 7 `program_days`
  - Para cada dia: chama `selectTemplatesForProgram` com o número da semana, insere `program_tasks`
  - Inserções em batch por semana para evitar timeout

**Interface pública resultante:**
```ts
export function selectTemplatesForProgram(
  templates: TaskTemplate[],
  scores: AreaScores,
  priorityArea: HabitArea,
  weekNumber: number   // 1–9
): TaskTemplate[]

export async function generate63Days(
  userId: string,
  programId: string,
  templates: TaskTemplate[],
  startDate?: Date
): Promise<void>
```

### 2. `src/lib/assessment-to-program.ts`

- Substituir chamada `generateWeek1(...)` por `generate63Days(...)`
- Importar `generate63Days` e `selectTemplatesForProgram` no lugar dos anteriores

### 3. `supabase/sprint2_63days.sql`

Seeds de templates novos:

**Dificuldade 2 (~10 seeds, ~1–2 por área):**
- corpo: "Treinar 30min" (freq 3/sem), "Dormir antes das 23h" (freq 7/sem)
- produtividade: "Bloco de foco de 60min" (freq 5/sem)
- idiomas: "Praticar idioma 20min" (freq 5/sem)
- carreira: "Ler artigo da área" (freq 3/sem)
- financas: "Registrar gastos do dia" (freq 7/sem)
- emocoes: "Meditação 10min" (freq 5/sem)
- relacionamentos: "Mensagem para alguém próximo" (freq 3/sem)
- (2 extras à escolha do implementador para fechar 10)

**Dificuldade 3 (~10 seeds, ~1–2 por área):**
- corpo: "Treinar 45min com intensidade" (freq 4/sem), "Seguir protocolo de recuperação" (freq 3/sem)
- produtividade: "Deep work: 2h sem interrupção" (freq 5/sem)
- idiomas: "Conversar ou assistir conteúdo no idioma 30min" (freq 5/sem)
- carreira: "Trabalhar no projeto pessoal 45min" (freq 3/sem)
- financas: "Revisar orçamento semanal" (freq 1/sem)
- emocoes: "Journaling reflexivo 15min" (freq 5/sem)
- relacionamentos: "Encontro ou ligação de qualidade" (freq 1/sem)
- (2 extras à escolha do implementador para fechar 10)

### 4. `src/lib/__tests__/program-engine.test.ts`

Testes novos:
- `selectTemplatesForProgram` retorna diff 1 para semana 1–3
- `selectTemplatesForProgram` retorna diff 2 para semana 4–6
- `selectTemplatesForProgram` retorna diff 3 para semana 7–9
- `generate63Days` cria exatamente 9 semanas, 63 dias, tasks coerentes (mock Supabase)

---

## Volume de dados por programa

| Tabela | Rows |
|--------|------|
| program_weeks | 9 |
| program_days | 63 |
| program_tasks | ~130–189 (depende de frequency_per_week) |

---

## Copy a atualizar

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `src/app/analise-inicial/page.tsx` | 164 | "Ver meu plano de 66 dias →" | "Ver meu plano de 63 dias →" |
| `src/app/analise-inicial/page.tsx` | 166 | "Vamos montar sua semana 1 personalizada..." | "Vamos montar seu plano de 63 dias personalizado..." |

---

## Fora do escopo desta OS

- Visualização semanal/calendário do programa
- XP real ao completar task
- Score snapshots / comparativo antes vs agora
- Geração adaptativa (ajustar plano com base em desempenho)
