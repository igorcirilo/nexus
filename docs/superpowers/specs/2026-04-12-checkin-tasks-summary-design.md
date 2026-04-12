# Design Spec: Check-in Noturno — Resumo de Tasks

**Data:** 2026-04-12
**Sprint:** 4
**Escopo:** Adicionar step de resumo de tasks ao final do check-in noturno

---

## Objetivo

Fechar o loop entre o programa de 63 dias e o ritual diário. Ao terminar o check-in noturno, o usuário vê um resumo read-only das tasks do dia antes de fechar o dia — reforçando consistência e dando visibilidade sobre a execução.

---

## Comportamento

### Posição no fluxo noturno

O step `tasks_summary` é inserido **após** todos os steps existentes da fase noite (missao_done → vitoria → humor → reflexao), como penúltimo passo antes da conclusão:

```
missao_done → vitoria → humor → reflexao → tasks_summary → conclusão
```

### Condição de exibição

- Se `nightTasks.length === 0` (usuário sem programa ativo ou sem tasks para o dia): step é **pulado silenciosamente**, sem mensagem ou UI alternativa.
- Se `nightTasks.length > 0`: step é exibido normalmente.

### Interação

O step é **somente leitura**. O usuário não pode alterar o status de nenhuma task a partir deste step. As tasks continuam gerenciáveis em `/hoje`.

---

## Camada de dados

### Nova função em `src/lib/program.ts`

```ts
export async function getTasksForDate(
  userId: string,
  date: string
): Promise<ProgramTask[]>
```

**Implementação:**
1. Busca programa ativo: `programs` where `user_id = userId AND status = 'active'`
2. Se não encontrar → retorna `[]`
3. Busca dia: `program_days` where `program_id = program.id AND date = date`
4. Se não encontrar → retorna `[]`
5. Chama `getProgramTasks(day.id)` (já existente) e retorna o resultado

Usa lazy import `const { supabase } = await import('@/lib/supabase')` conforme padrão do arquivo.

**Verificação:** Função Supabase-bound — verificada via `tsc --noEmit` (sem erros de tipo). Não requer Vitest (padrão estabelecido nos Sprints 1-3 para funções com I/O de banco).

---

## Mudanças em `src/app/checkin/page.tsx`

### Novo estado

```ts
const [nightTasks, setNightTasks] = useState<ProgramTask[]>([])
```

### Fetch no `useEffect` existente

Logo após `setUserId(user.id)`, adicionar:

```ts
const todayTasks = await getTasksForDate(user.id, today)
setNightTasks(todayTasks)
```

Busca uma vez no load da página. O loading geral da página cobre o estado de espera.

### Novo import

```ts
import { getTasksForDate, ... } from '@/lib/program'
```

### Inserção do step no array da fase `noite`

O step `'tasks_summary'` é adicionado condicionalmente ao array de steps da fase `noite`, apenas se `nightTasks.length > 0`. Fica após `reflexao` e antes do passo de conclusão.

---

## Visual do step `tasks_summary`

Layout vertical, largura total, fundo `--bg0` (#0d0d0d). Componentes de cima para baixo:

### 1. Título
- Label superior: `"Check-in noturno"` — 11px, uppercase, `--text3`
- Título: `"Tasks do dia"` — Syne 26px bold, `--text1`

### 2. Contador
Card com fundo `--bg2`, borda `--border`, border-radius 16px. Três colunas separadas por divisores finos:

| Coluna | Número | Label |
|--------|--------|-------|
| Feitas | `--teal` | "FEITAS" |
| Puladas | `--gold` | "PULADAS" |
| Pendentes | `#3a3a3a` | "PENDENTES" |

Número: Syne 32px bold. Label: 10px uppercase, `--text3`.

### 3. Lista de tasks

Cada task é uma linha com:
- **Completed**: fundo `rgba(30,203,180,.04)`, borda `rgba(30,203,180,.2)`, ícone `✓` teal, título riscado em `--text3`, XP em teal
- **Skipped**: opacity 0.5, badge `"pulado"` (bg `#222`, cor `#666`), título escuro
- **Pending**: opacity 0.35, ícone `○` cinza escuro, título escuro, sem XP

### 4. XP total das tasks

Box com fundo `rgba(232,168,56,.06)`, borda `rgba(232,168,56,.18)`, ícone ⚡, texto `"+X XP em tasks hoje"` em `--gold`, Syne 15px bold.

Só exibe se houver XP > 0 (pelo menos uma task concluída).

### 5. Botão "Fechar dia 🌙"

Igual ao botão de conclusão atual do check-in noturno — `--accent` com sombra roxa, largura total, Syne bold 16px.

---

## Casos de borda

| Situação | Comportamento |
|----------|---------------|
| Todas as tasks feitas | Contador: 5 feitas, 0 puladas, 0 pendentes. XP total exibido. |
| Nenhuma task feita | Contador: 0 feitas. XP box oculta. |
| Sem programa ativo | Step pulado silenciosamente |
| Sem `program_day` para hoje | Step pulado silenciosamente |

---

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/program.ts` | Nova função `getTasksForDate` |
| `src/app/checkin/page.tsx` | Novo estado, fetch no useEffect, novo step no fluxo noturno |
| `src/lib/__tests__/program-engine.test.ts` | Sem novos testes (função Supabase-bound; verificada via tsc) |

---

## Fora de escopo

- Permitir editar status de tasks a partir do check-in (interativo)
- Exibir tasks no check-in matinal
- Qualquer mudança no fluxo de manhã ou tarde
