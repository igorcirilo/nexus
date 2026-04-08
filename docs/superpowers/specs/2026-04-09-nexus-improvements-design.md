# NEXUS — Melhorias por Fases: Design Doc
**Data:** 2026-04-09  
**Âmbito:** Feedback de erros, features incompletas, parser de Corpo

---

## Contexto

O app está funcionalmente completo para MVP mas tem falhas visíveis para o utilizador:
- Erros do Supabase falham em silêncio (32 `console.error()` sem UI)
- Badges ganhos não são notificados
- Streak recovery existe na UI mas sem lógica implementada
- CSV de Finanças tem UI mas sem parser
- Parser de Corpo falha com formatos variados (Excel, PDF de app, PDF manual, mistura)

---

## Fase 1 — Sistema de Toast Global (A1)

### Objetivo
Substituir todos os erros silenciosos por feedback visível ao utilizador.

### Arquitetura
- Novo `src/components/Toast.tsx` — componente provider + contexto React
- Hook `useToast()` expõe: `toast.success(msg)`, `toast.error(msg)`, `toast.info(msg)`
- `layout.tsx` envolve a app com `<ToastProvider>`
- `src/lib/supabase.ts` — cada `console.error()` é substituído por emit de evento customizado que o ToastProvider escuta e converte em toast

### Visual
- Toast fixo: canto inferior direito (desktop), topo (mobile)
- Cor por tipo: verde (success), vermelho (error), azul (info)
- Auto-dismiss: 4 segundos
- Máximo 3 toasts simultâneos (FIFO)

### Ficheiros
- `src/app/layout.tsx` — adicionar `<ToastProvider>`
- `src/components/Toast.tsx` — novo
- `src/lib/supabase.ts` — substituir 32 `console.error()` por emits

---

## Fase 2 — Badge Notifications + Streak Recovery (A3 + A4)

### Badge Notifications
`checkAndAwardBadges()` já retorna badges ganhos mas nenhuma página usa o retorno.

- Novo `src/components/BadgeModal.tsx` — modal com ícone, nome e descrição do badge
- Badges simples (primeira_checkin): toast via sistema da Fase 1
- Badges de milestone (streak_7, streak_21, streak_100, xp_1000+): modal completo
- `hoje/page.tsx` passa o retorno de `checkAndAwardBadges()` para o modal

### Streak Recovery
A UI `StreakRecovery` existe mas a lógica não está implementada.

**Regra de negócio:** 1 freeze por semana ISO. Se o utilizador perder o streak, pode recuperar até 24h depois consumindo o freeze semanal.

**Schema:** Adicionar coluna `streak_freeze_used_week` (tipo `text`, formato `YYYY-Www`) ao perfil no Supabase.

**Lógica nova em `supabase.ts`:**
- `canClaimStreakRecovery()` — verifica se streak foi perdido há <24h e freeze semanal disponível
- `claimStreakRecovery()` — restaura streak, marca freeze como usado na semana atual

### Ficheiros
- `src/components/BadgeModal.tsx` — novo
- `src/app/hoje/page.tsx` — integrar BadgeModal + lógica recovery
- `src/lib/supabase.ts` — adicionar `canClaimStreakRecovery()` e `claimStreakRecovery()`
- Supabase: 1 coluna nova `streak_freeze_used_week` na tabela `profiles`

---

## Fase 3 — CSV Import para Finanças (A2)

### Objetivo
Implementar o parser de CSV que a UI de Finanças já espera.

### Fluxo
1. Utilizador seleciona ficheiro `.csv`
2. Parser tenta detetar colunas automaticamente por nome (data, valor, descrição, categoria, tipo)
3. Se deteção automática for incerta: mostra tabela de preview com dropdowns por coluna
4. Utilizador confirma mapeamento
5. Transações inseridas via `saveTransactionsBulk()` (já existe)

### Novo `src/lib/csv-parser.ts`
- Deteção de separador: `,` ou `;`
- Deteção de header: linha 1 com texto vs. números
- Normalização de datas: `DD/MM/YYYY` e `YYYY-MM-DD`
- Normalização de valores: `1.234,56` e `1234.56`
- Inferência de tipo (entrada/saída) por sinal do valor ou coluna "tipo"
- Retorna: `{ rows: Transaction[], needsReview: boolean, columnMap: Record<string, string> }`

### Ficheiros
- `src/lib/csv-parser.ts` — novo
- `src/app/financas/page.tsx` — ligar `csvRef` ao parser + UI de review de mapeamento

---

## Fase 4 — Parser de Corpo com Revisão Manual (B)

### Problema
Com formatos variados (Excel estruturado, PDF de app, PDF manual, mistura), nenhum parser automático é suficiente. A solução durável é: parser melhorado + UI de revisão antes de guardar.

### Fluxo Novo
1. Ficheiro importado e parseado
2. Em vez de guardar diretamente, abre `<PlanReviewModal>`
3. Utilizador vê resultado extraído (secções, exercícios ou refeições)
4. Pode: renomear/apagar secções, renomear/apagar itens, mover itens, adicionar manualmente
5. Confirma → guarda no Supabase

### Melhorias no Parser (`src/lib/body-plan.ts`)
- **Score de secção:** múltiplos sinais (posição, comprimento, padrão de texto, linha isolada) em vez de heurística binária
- **Filtro de ruído mais agressivo:** lista expandida de termos técnicos (séries, reps, RPE, AMRAP, resto, técnica, siglas comuns)
- **Excel estruturado:** ler colunas (nome exercício, séries, reps) em vez de texto livre por linha
- **PDF de app (Hevy/Strong):** detetar padrão de exportação específico (data, exercício, set, reps, kg)
- **PDF manual:** melhor separação de exercício vs. detalhe (métrica na mesma linha)

### Novo `src/components/PlanReviewModal.tsx`
- Modal full-screen (mobile-friendly)
- Lista de secções colapsável
- Por item: botão editar nome inline, botão apagar, drag para reordenar (ou botões ↑↓)
- Botão "Adicionar item" por secção
- Botão "Confirmar e Guardar" no rodapé

### Ficheiros
- `src/lib/body-plan.ts` — melhorar parser existente
- `src/components/PlanReviewModal.tsx` — novo
- `src/app/corpo/page.tsx` — abrir PlanReviewModal após parse, guardar só após confirmação

---

## Ordem de Execução

| Fase | Dependências | Risco |
|------|-------------|-------|
| 1 — Toast | Nenhuma | Baixo |
| 2 — Badges + Streak | Fase 1 (toast para badges simples) | Médio (schema change) |
| 3 — CSV Finanças | Fase 1 (toast de erro/sucesso) | Baixo |
| 4 — Corpo | Fase 1 (toast de erro) | Médio |

As fases 3 e 4 são independentes entre si e podem correr em paralelo após a Fase 2.

---

## O que NÃO está neste scope
- Refactor de performance (queries N+1, paginação)
- Segurança de XP server-side
- Mentor messages personalizadas
- Qualquer mudança visual não relacionada com as features acima
