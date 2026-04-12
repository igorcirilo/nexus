# Sprint 1 — Design Spec
**Data:** 2026-04-12  
**Projeto:** nexus-v4 / Rise  
**Abordagem:** Sequencial por camada (Schema → Engine → UI → Integração)

---

## Contexto

O nexus-v4 já possui autenticação, hábitos, XP/streak/badges e onboarding básico (3 passos).  
O Sprint 1 cria a espinha dorsal do produto: diagnóstico → score → programa → execução diária.

**Resultado esperado:** usuário entra, responde o onboarding diagnóstico, recebe um score inicial, tem a semana 1 do seu programa de 60 dias gerada e consegue executar o primeiro dia pelo `/hoje`.

---

## Decisões de design

| Decisão | Escolha |
|---|---|
| Modelo de áreas | 7 áreas existentes: `corpo`, `produtividade`, `idiomas`, `carreira`, `financas`, `emocoes`, `relacionamentos` |
| Questões do onboarding | Hard-coded no frontend (sem tabelas de configuração) |
| Cálculo de score | Pesos por tipo de resposta — todos os tipos contribuem para o score da área |
| Catálogo de tarefas | Seeds no banco (`task_templates`) |
| Refactor do `/hoje` | Mostra apenas `program_tasks`; usuários sem programa veem CTA para onboarding v2 |
| Duração do programa | 60 dias |

---

## Seção 1 — Schema e Migrations

### Tabelas novas

#### `user_assessments`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id       uuid REFERENCES auth.users NOT NULL,
version       int DEFAULT 2,
responses     jsonb NOT NULL,        -- { questionId: answer }
completed_at  timestamptz,
created_at    timestamptz DEFAULT now()
```

#### `life_area_scores`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id        uuid REFERENCES auth.users NOT NULL,
assessment_id  uuid REFERENCES user_assessments(id) ON DELETE CASCADE,
area           text NOT NULL,        -- corpo | produtividade | idiomas | carreira | financas | emocoes | relacionamentos
score          int NOT NULL,         -- 0–100
snapshot_at    timestamptz DEFAULT now()
```

#### `programs`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
user_id        uuid REFERENCES auth.users NOT NULL,
assessment_id  uuid REFERENCES user_assessments(id),
status         text DEFAULT 'active',  -- active | paused | completed
started_at     date NOT NULL,
ends_at        date NOT NULL,          -- started_at + 60 days
created_at     timestamptz DEFAULT now()
```

#### `program_weeks`
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
program_id   uuid REFERENCES programs(id) ON DELETE CASCADE,
week_number  int NOT NULL,    -- 1..9
theme        text,            -- ex: "Fundação", "Consistência"
starts_on    date NOT NULL,
created_at   timestamptz DEFAULT now()
```

#### `program_days`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
program_id  uuid REFERENCES programs(id) ON DELETE CASCADE,
week_id     uuid REFERENCES program_weeks(id) ON DELETE CASCADE,
day_number  int NOT NULL,   -- 1..60
date        date NOT NULL,
created_at  timestamptz DEFAULT now()
```

#### `program_tasks`
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
program_id   uuid REFERENCES programs(id) ON DELETE CASCADE,
day_id       uuid REFERENCES program_days(id) ON DELETE CASCADE,
user_id      uuid REFERENCES auth.users NOT NULL,
template_id  uuid REFERENCES task_templates(id),
title        text NOT NULL,
description  text,
area         text NOT NULL,
difficulty   int DEFAULT 1,    -- 1 | 2 | 3
xp_reward    int DEFAULT 20,
status       text DEFAULT 'pending',  -- pending | completed | skipped
source       text DEFAULT 'generated',  -- generated | manual
completed_at timestamptz,
created_at   timestamptz DEFAULT now()
```

#### `task_templates`
```sql
id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
area               text NOT NULL,
title              text NOT NULL,
description        text,
difficulty         int DEFAULT 1,      -- 1 | 2 | 3
frequency_per_week int DEFAULT 7,
xp_reward          int DEFAULT 20,
tags               text[],
active             bool DEFAULT true,
created_at         timestamptz DEFAULT now()
```

### Seeds de `task_templates` (semana 1 — difficulty = 1)

| Área | Título | Freq/semana | XP |
|---|---|---|---|
| corpo | Beber 2L de água | 7 | 15 |
| corpo | 20min de movimento | 5 | 25 |
| produtividade | Planejar o dia (5min) | 7 | 15 |
| produtividade | Bloco de foco de 25min | 5 | 25 |
| emocoes | Escrever 1 gratidão | 7 | 15 |
| emocoes | 5min de respiração | 3 | 15 |
| idiomas | Estudar 10min | 5 | 20 |
| carreira | Ler 10 páginas | 5 | 20 |
| financas | Registrar 1 gasto | 7 | 15 |
| relacionamentos | Mensagem para alguém | 3 | 20 |

### Extensão de `profiles`
```sql
ALTER TABLE profiles ADD COLUMN program_id         uuid REFERENCES programs(id);
ALTER TABLE profiles ADD COLUMN initial_score       int;
ALTER TABLE profiles ADD COLUMN current_score       int;
ALTER TABLE profiles ADD COLUMN onboarding_version  int DEFAULT 1;
```

### RLS
Todas as tabelas novas: RLS habilitado, políticas `auth.uid() = user_id` para select/insert/update/delete.

---

## Seção 2 — Onboarding Engine

### Arquivo: `src/lib/onboarding-engine.ts`

**Questionário — 8 blocos, ~20 perguntas**

| Bloco | Tema | Tipo | Áreas afetadas |
|---|---|---|---|
| 1 | Situação atual por área | Escala 1–5 (7 perguntas) | todas |
| 2 | Objetivo principal | Escolha única | — (define foco) |
| 3 | Frequência de hábitos-chave | Escolha única por hábito (2 perguntas: frequência de exercício + frequência de planejamento/foco) | corpo, produtividade |
| 4 | Travas e obstáculos | Múltipla escolha | emocoes, produtividade |
| 5 | Autoimagem e motivação | Escala 1–5 | emocoes |
| 6 | Ambiente e contexto | Múltipla escolha | relacionamentos, financas |
| 7 | Rotina atual | Escolha única | corpo, produtividade |
| 8 | Prioridades do programa | Ranking top 3 áreas | — (define peso do plano) |

**Tipos TypeScript:**
```ts
type QuestionType = 'scale' | 'single' | 'multiple' | 'ranking'

type Option = {
  id: string
  label: string
  score_value: number   // 0.0–1.0 (para single/multiple)
}

type Question = {
  id: string
  block: number
  text: string
  type: QuestionType
  area?: HabitArea | HabitArea[]
  weight: number               // peso no cálculo de score
  options?: Option[]
  min?: number                 // para scale
  max?: number                 // para scale
}

type Answers = Record<string, number | string | string[]>
```

**Funções exportadas:**
```ts
ONBOARDING_QUESTIONS: Question[]
saveDraft(answers: Partial<Answers>): void       // localStorage
loadDraft(): Partial<Answers>                    // localStorage
clearDraft(): void
submitAssessment(userId: string, answers: Answers): Promise<string>  // retorna assessmentId
```

**Persistência local:**
- Chave: `nexus_onboarding_v2_draft`
- Salva após cada resposta confirmada
- Limpa após `submitAssessment` bem-sucedido

### Frontend: `src/app/onboarding-v2/page.tsx`

- Barra de progresso linear (pergunta X de 17)
- Renderizador por tipo: `<ScaleQuestion>`, `<SingleQuestion>`, `<MultipleQuestion>`, `<RankingQuestion>`
- Botões Anterior / Próxima com validação de resposta obrigatória
- Carrega rascunho ao montar via `loadDraft()`
- Ao finalizar: chama `submitAssessment(userId, answers)` → salva `assessmentId` em sessionStorage (`nexus_assessment_id`) → redireciona para `/analise-inicial`

**Componentes em `src/components/onboarding/`:**
- `QuestionRenderer.tsx` — despacha para o componente certo por `type`
- `ScaleQuestion.tsx`
- `SingleQuestion.tsx`
- `MultipleQuestion.tsx`
- `RankingQuestion.tsx`
- `ProgressBar.tsx`

---

## Seção 3 — Score Inicial

### Arquivo: `src/lib/profile-assessment.ts`

**Algoritmo de normalização por tipo:**

| Tipo | Fórmula |
|---|---|
| `scale 1–5` | `(valor - 1) / 4` → 0.0–1.0 |
| `single` | usa `option.score_value` da opção selecionada |
| `multiple` | `opções_positivas_marcadas / total_opções_positivas` |
| `ranking` | 1º = 1.0, 2º = 0.67, 3º = 0.33, fora = 0.0 (só influencia plano, não score) |

**Pesos por bloco:**

| Bloco | Peso |
|---|---|
| 1 (escala por área) | 3 |
| 3 (frequência) | 2 |
| 5 (autoimagem) | 2 |
| 4, 6 (travas, ambiente) | 1 |
| 7 (rotina) | 1 |

**Cálculo:**
```
score_area = Σ(resposta_normalizada × peso) / Σ(pesos) × 100   [arredondado para int]
score_global = média simples dos 7 scores de área
```

**Funções exportadas:**
```ts
type AreaScores = Record<HabitArea, number> & { global: number }

calculateScores(answers: Answers): AreaScores
saveScores(userId: string, assessmentId: string, scores: AreaScores): Promise<void>
// insere em life_area_scores (1 linha por área)
// atualiza profiles.initial_score e profiles.current_score
```

### Tela `/analise-inicial`

- Ao montar: lê `assessmentId` do sessionStorage → se ausente, redireciona para `/onboarding-v2`
- Calcula e exibe scores via `calculateScores(answers)` (answers recuperadas do assessment no banco)
- Score global em destaque: "Sua pontuação inicial: **58/100**"
- Card por área com score e barra visual
- Botão "Ver meu plano" → chama `generateProgramFromAssessment` → limpa sessionStorage → redireciona para `/hoje`

---

## Seção 4 — Gerador da Semana 1

### Arquivo: `src/lib/program-engine.ts`

**Seleção de templates para a semana 1:**
- Apenas `difficulty = 1`
- Ao menos 1 tarefa da área com score mais baixo
- Ao menos 1 tarefa da área prioritária (bloco 8, 1ª escolha)
- Total: 3 tarefas por dia
- Frequência respeitada pelo `frequency_per_week` do template

**Funções:**
```ts
createProgram(userId: string, assessmentId: string): Promise<Program>
// status: active, started_at: hoje, ends_at: hoje + 60 dias

selectTemplatesForWeek1(scores: AreaScores, priorityArea: HabitArea): TaskTemplate[]

generateWeek1(programId: string, templates: TaskTemplate[]): Promise<void>
// cria program_weeks (week_number: 1, theme: "Fundação")
// cria 7 program_days (day_number: 1–7)
// cria program_tasks por dia conforme frequency_per_week
```

### Arquivo: `src/lib/assessment-to-program.ts`

Orquestrador chamado por `/analise-inicial` ao clicar "Ver meu plano".  
O `assessmentId` já existe (criado pela tela de onboarding via `submitAssessment`).  
O orquestrador **não re-submete** o assessment — apenas gera o programa a partir dos scores já calculados.

```ts
generateProgramFromAssessment(userId: string, assessmentId: string, scores: AreaScores): Promise<void>
// 1. createProgram(userId, assessmentId) → programId
// 2. priorityArea = área top-1 do bloco 8 (extraída de user_assessments.responses)
// 3. selectTemplatesForWeek1(scores, priorityArea) → templates
// 4. generateWeek1(programId, templates)
// 5. UPDATE profiles SET program_id = programId, onboarding_version = 2
```

**Fluxo completo ponta a ponta:**
1. `/onboarding-v2`: respostas → `submitAssessment` → salva `assessmentId` em sessionStorage → redirect `/analise-inicial`
2. `/analise-inicial`: lê `assessmentId` do sessionStorage → `calculateScores(answers)` → exibe scores → CTA → `generateProgramFromAssessment` → redirect `/hoje`
3. Edge case: se `assessmentId` não estiver no sessionStorage ao abrir `/analise-inicial`, redirecionar para `/onboarding-v2`

---

## Seção 5 — Refactor do `/hoje`

### Nova lógica de carregamento

```
1. Fetch profile
   → se onboarding_version < 2 ou program_id = null:
      exibir CTA "Complete seu diagnóstico" → /onboarding-v2

2. getProgramDayByDate(userId, hoje)
   → se null: exibir estado vazio "Seu próximo dia ainda está sendo preparado"

3. getProgramTasks(dayId)
   → renderizar lista de tarefas (pending | completed | skipped)
```

### Ações por tarefa

| Ação | Efeito |
|---|---|
| Concluir | `status = completed`, `completed_at = now()`, `addXP(task.xp_reward)` |
| Pular | `status = skipped` |
| Abrir detalhe | Bottom sheet: título, descrição, área, XP |
| + Adicionar manual | Cria `program_task` com `source = manual` no `day_id` de hoje |

### Contadores no topo
```
✅ 2/3 concluídas    ⏭ 1 pulada
```

### O que permanece
- Header com saudação por horário
- XP Bar (nível + progresso)
- Streak display
- Mentor Card
- Night Summary (check-in noturno)

### O que é removido
- Lista de `habits` direto da tabela `habits`
- Weekly Challenge hard-coded

### Novas funções em `src/lib/program.ts`

```ts
getProgramDayByDate(userId: string, date: string): Promise<ProgramDay | null>
getProgramTasks(dayId: string): Promise<ProgramTask[]>
updateTaskStatus(taskId: string, status: 'completed' | 'skipped'): Promise<void>
createManualTask(userId: string, dayId: string, title: string, area: HabitArea): Promise<ProgramTask>
```

---

## Novos tipos TypeScript — `src/types/index.ts`

```ts
type UserAssessment = {
  id: string
  user_id: string
  version: number
  responses: Record<string, unknown>
  completed_at: string | null
  created_at: string
}

type LifeAreaScore = {
  id: string
  user_id: string
  assessment_id: string
  area: HabitArea
  score: number
  snapshot_at: string
}

type Program = {
  id: string
  user_id: string
  assessment_id: string
  status: 'active' | 'paused' | 'completed'
  started_at: string
  ends_at: string
  created_at: string
}

type ProgramWeek = {
  id: string
  program_id: string
  week_number: number
  theme: string
  starts_on: string
  created_at: string
}

type ProgramDay = {
  id: string
  program_id: string
  week_id: string
  day_number: number
  date: string
  created_at: string
}

type ProgramTask = {
  id: string
  program_id: string
  day_id: string
  user_id: string
  template_id: string | null
  title: string
  description: string | null
  area: HabitArea
  difficulty: 1 | 2 | 3
  xp_reward: number
  status: 'pending' | 'completed' | 'skipped'
  source: 'generated' | 'manual'
  completed_at: string | null
  created_at: string
}

type TaskTemplate = {
  id: string
  area: HabitArea
  title: string
  description: string | null
  difficulty: 1 | 2 | 3
  frequency_per_week: number
  xp_reward: number
  tags: string[]
  active: boolean
  created_at: string
}
```

---

## Rotas novas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/onboarding-v2` | `src/app/onboarding-v2/page.tsx` | Questionário diagnóstico |
| `/analise-inicial` | `src/app/analise-inicial/page.tsx` | Score + mapa por área + CTA |

---

## Definição de pronto do Sprint 1

- [ ] Migrations aplicadas no Supabase
- [ ] Seeds de `task_templates` inseridos
- [ ] `profiles` com colunas novas
- [ ] `onboarding-engine.ts` com perguntas hard-coded e draft local
- [ ] `profile-assessment.ts` calculando e persistindo scores
- [ ] `program-engine.ts` gerando semana 1
- [ ] `assessment-to-program.ts` orquestrando o fluxo completo
- [ ] `/onboarding-v2` funcional com todos os tipos de pergunta
- [ ] `/analise-inicial` exibindo scores e disparando geração do plano
- [ ] `/hoje` refatorado para `program_tasks` com CTA de fallback
- [ ] Fluxo completo validado manualmente: onboarding → score → plano → hoje
