# Plano de Correção — Auditoria Nexus (pacote completo)

## Context

O projeto **Nexus** (Next.js 14 App Router + Supabase, app gamificado de hábitos/corpo/finanças/leitura) passou por uma auditoria de código. `typecheck` e os 69 testes (`npm test`) estão verdes — portanto os problemas são de **lógica de estado, contadores e integração**, não de compilação.

Esta tarefa implementa **todas** as correções identificadas, organizadas por prioridade. O objetivo é eliminar perda de dados (posição de leitura), restaurar a integridade da ofensiva/badges, alinhar fusos horários, corrigir contadores dessincronizados e remover/ligar código morto.

**Branch de trabalho:** `claude/code-audit-debugging-sgcrzt` (criar localmente se não existir; nunca fazer push para outra branch).

**Regras de execução:**
- Após cada bloco de correção, rodar `npm run typecheck` e `npm test`.
- Adicionar testes automatizados novos onde indicado (a infra Vitest já existe em `src/lib/__tests__/`).
- Commits descritivos por prioridade (P1, P2, P3). Não abrir PR a menos que solicitado.
- **A1 é decisão de produto** — está marcado abaixo; implementar conforme a opção recomendada, mas deixar o comportamento claro no commit.

---

## P1 — Corrigir primeiro (dados e integridade)

### P1.1 — Progresso de leitura sobrescrito para página 1 (perda de dados) — CRÍTICO
**Arquivo:** `src/app/leitura/[id]/page.tsx`

**Problema:** O efeito de persistência (l.~196-200, deps `[userId, bookId, book, currentPage, pageCount]`) dispara assim que `book` carrega com `currentPage === 1`, gravando `current_page: 1` na BD e apagando a página guardada (`savedPage`) antes de o utilizador tocar em "Retomar".

**Correção (ref-guard de hidratação):**
1. Adicionar `const hydrated = useRef(false)` junto aos outros refs (l.~85-88).
2. No fim de `loadAll` (após resolver `requestedPage`/`savedPage`/`resumePrompt`, l.~129), marcar `hydrated.current = true`.
3. No efeito de persistência, sair cedo enquanto não hidratado:
   ```ts
   useEffect(() => {
     if (!userId || !bookId || !book || !hydrated.current) return
     const pct = Math.round((currentPage / Math.max(pageCount, 1)) * 100)
     saveBookProgress({ user_id: userId, book_id: bookId, current_page: currentPage, progress_pct: pct })
   }, [userId, bookId, book, currentPage, pageCount])
   ```
   Como `hydrated` é um ref (não está nas deps), o efeito só persistirá quando `currentPage` mudar **depois** da hidratação (swipe, retomar, TOC), nunca no paint inicial.

**Verificação manual:** ler até pág. 50 → sair → reabrir → sair sem tocar em "Retomar" → reabrir deve continuar em 50. (Confirmar que aceitar "Retomar" continua a gravar normalmente.)

---

### P1.2 — Ofensiva (streak) avança só por abrir a app — ALTO
**Decisão do produto (confirmada):** a ofensiva passa a avançar **só com atividade real** — check-in concluído OU hábito concluído no dia. Abrir o app sem fazer nada não conta.

**Arquivos:** `src/app/hoje/HojeClient.tsx` (l.~131) e, opcionalmente, `supabase/gamification_ritmo_v1.sql` (RPC `update_streak`).

**Problema:** `HojeClient` chama `await updateStreak(userId)` em **todo** carregamento, sem atividade real. O RPC grava `streak_last_date = today` e incrementa se `last_date = today-1`. Resultado: abrir o app diariamente infla a ofensiva, infla badges (`checkAndAwardBadges`) e bloqueia o Streak Recovery (porque `canClaimStreakRecovery` exige `streak_current === 0`, que o `updateStreak` na mesma sessão já anulou).

**Correção recomendada (mínima, no cliente):** só chamar `updateStreak` quando houver atividade real do dia.
- Em `HojeClient`, remover a chamada incondicional na sequência de side-effects (l.~131) e a leitura de `streakFields` que depende dela; em vez disso, ler os campos de streak diretamente do perfil já carregado.
- Garantir que a ofensiva é atualizada nos pontos onde há compromisso cumprido:
  - `checkin/page.tsx` `finish()` já chama `updateStreak` (l.~173) — **manter**.
  - Em `HojeClient.handleToggleHabit` (l.~187-196): após `toggleHabitLog(... done=true)` com sucesso, chamar `updateStreak(userId)` e refazer a leitura de `streak_current/streak_best/level/title` para o estado (e só então recalcular badges/level-up — ver P2.1). Não chamar `updateStreak` ao desmarcar (`done=false`).
- Reordenar: a deteção de `showRecovery`/`canRecover` (l.~126-129) deve continuar a usar o `initialProfile` do servidor (antes de qualquer `updateStreak`).

**Nota:** Não há recálculo retroativo de ofensivas já infladas (aceitável; documentar no commit).

**Verificação manual:** abrir "Hoje" 2 dias seguidos sem completar nada → `streak_current` **não** deve subir. Completar um hábito → ofensiva avança e (se aplicável) badge/level-up dispara.

---

### P1.3 — Datas: logs locais vs. agrupamento UTC — ALTO
**Arquivo principal:** `src/lib/supabase.ts` (15 ocorrências de `new Date().toISOString().split('T')[0]`). Também: `src/app/leitura/[id]/page.tsx` (l.~218), `src/app/leitura/page.tsx`, `src/components/leitura/LeituraHub.tsx`.

**Problema:** A UI grava datas com `todayISO()` (data **local**, `src/lib/date.ts`), mas funções de leitura/agregação usam `toISOString()` (data **UTC**). Em fusos negativos (ex.: Brasil UTC-3), à noite o dia UTC já é o seguinte, desalinhando Ritmo, stats semanais, calendário e contadores.

**Correção:** substituir todos os `new Date().toISOString().split('T')[0]` por `todayISO()` (de `@/lib/date`). Para datas deslocadas (ex.: `since.setDate(... - N)`), usar `format(date, 'yyyy-MM-dd')` do `date-fns` (já importado em `supabase.ts`) em vez de `toISOString()`.
- Funções afetadas em `supabase.ts`: `getRitmo`, `getWeeklyStats`, `getDynamicWeeklyChallenge` (se não for removida em P3), `getWeeklyConsistencyPoints` (idem), `getReadingSessionsThisWeek`, `getTrainingCount30d`, `getReadingPages30d`, `claimLoginBonus`, `saveFocusSession`, `currentISOWeek`/recovery.
- Importar `todayISO` (e usar `format` já presente). **Reutilizar** os helpers existentes de `src/lib/date.ts`; não criar novos.

**Verificação:** novo teste (ver P4) simulando fuso `America/Sao_Paulo` e log às 23h local; manual: completar hábito à noite e ver Ritmo/"dias" refletirem o dia local corrente.

---

## P2 — Corrigir depois (contadores e robustez)

### P2.1 — Modal de Level-Up nunca dispara (código morto funcional)
**Arquivo:** `src/app/hoje/HojeClient.tsx` (l.~95, 272-274).
`setLevelUpData` nunca é chamado com valor. **Ligar** a celebração: ao atualizar streak (no fluxo de atividade real de P1.2), comparar `level` anterior (do perfil em estado) com o novo `level` retornado; se subiu, chamar `setLevelUpData({ level: novo, title: novoTitle })`. Manter `LevelUpModal` (já importado). Se a equipa preferir remover, alinhar — mas o pedido é "pacote completo", então **ligar**.

### P2.2 — "Treinos (30d)" conta interação, não conclusão
**Arquivo:** `src/lib/supabase.ts` `getTrainingCount30d` (l.~1133-1146).
Adicionar `.eq('completed', true)` à query de `training_entries`. (Exibido em `src/app/perfil/page.tsx` l.~102.)
**Teste:** entry com `completed=false` não deve contar.

### P2.3 — Exercícios "extra" não persistidos + contador divergente
**Arquivo:** `src/components/corpo/WorkoutTracker.tsx`.
- Persistir a lista de extras dentro do `NotesV2` (estender o tipo em l.~24: `extras?: TrainingExercisePlan[]`). Em `persistEntry` (l.~171-187), incluir `extras` no JSON; em `loadEntries` (l.~133-151), restaurar `setExtras(notesV2.extras ?? [])`.
- Tornar `doneCount` (l.~326, barra de progresso) e o `doneCount` de `persistEntry` (l.~174) consistentes: ambos devem contar exercícios do plano **+** extras (ou ambos só do plano). Recomendado: contar plano + extras em ambos, e ajustar `totalCount` para incluir extras.

### P2.4 — Backfill de hábitos pode duplicar
**Arquivos:** `src/lib/assessment-to-habits.ts` (`generateHabitsFromAssessment`, l.~162-184) e `src/app/hoje/HojeClient.tsx` (`handleBackfill`, l.~213-239).
- Em `handleBackfill`, garantir que o botão/ação fica desabilitado durante `backfilling` (o `EmptyState` action deve refletir `disabled`; verificar `src/components/EmptyState.tsx` para suportar `disabled`/loading — se não suportar, guardar com early-return `if (backfilling) return` no início de `handleBackfill`).
- Em `generateHabitsFromAssessment`, antes do `INSERT`, verificar `catalog_key` já existentes (mesma defesa que `regenerateHabitsForLevel` em l.~191-245) e inserir só os ausentes. **Reutilizar** o padrão de `byKey`/`desiredKeys` já existente nesse arquivo.

### P2.5 — `addTx` aceita montante inválido (NaN)
**Arquivo:** `src/app/financas/page.tsx` `addTx` (l.~372-382).
Validar como `saveTxEdit` (l.~337-338): `const amount = parseFloat(fAmount.replace(',','.')); if (!Number.isFinite(amount) || amount <= 0) return` (com toast de erro). Usar `amount` validado no payload.

### P2.6 — `removeTx` não remove de `history`
**Arquivos:** `src/app/financas/page.tsx` (`removeTx`, l.~384-387) e `src/lib/supabase.ts` (`getTransactionsByMonth`, l.~441-459 — select sem `id`).
Opção recomendada: após delete bem-sucedido, refazer fetch (como `addTx`/`saveTxEdit` fazem):
```ts
const [r,h] = await Promise.all([getTransactions(userId,2), getTransactionsByMonth(userId,6)])
setTxs(r as Transaction[]); setHistory(h as Transaction[])
```
(Requer `userId` em escopo — já existe.) Alternativa: incluir `id` no select de `getTransactionsByMonth` e filtrar por `id`.

### P2.7 — `save()` do Perfil envia strings vazias em campos numéricos
**Arquivo:** `src/app/perfil/page.tsx` (`save`, l.~143-150; `form`, l.~112-132).
- Antes do `updateFullProfile`, normalizar: campos numéricos com `''` → `null`; strings numéricas → `Number(...)`. Criar um pequeno mapeamento de campos numéricos (`age, weight_kg, height_cm, goal_weight, water_goal_ml, workouts_per_week, sleep_goal_h, read_pages_day, fin_current_savings, fin_monthly_save, fin_debt_goal, fin_reserve_goal, completion_pct_goal`).
- Remover `xp_weekly_goal` do `form`/payload (deprecado).
- Tratar o `error` de `updateFullProfile`; só mostrar "guardado" em sucesso.

### P2.8 — Tratamento de erro silencioso (robustez)
- `checkin/page.tsx` `finish()` (l.~151-177): verificar retorno de `saveCheckin`/`updateStreak`; em erro, mostrar toast e **não** marcar fase como concluída.
- `HojeClient.handleToggleHabit` (l.~187-196): se `toggleHabitLog` retornar `error`, reverter o update otimista.

---

## P3 — Limpeza / código morto (opcional mas incluído no pacote)

Remover (confirmado sem qualquer import/uso em `src/`). **Antes de remover, fazer um `grep` final** para garantir que nada passou a usá-los nas correções acima:

| Item | Arquivo |
|---|---|
| Subsistema "Liga semanal" | `src/lib/supabase.ts`: `getWeeklyLeagueOverview`, `ensureWeeklyLeagueSnapshot`, `getWeeklyConsistencyPoints`, `getWeekWindow`, `getLeagueTier` (l.~830-1029) |
| `WeeklyLeagueCard` | `src/components/WeeklyLeagueCard.tsx` |
| `WeeklyRankCard` | `src/components/WeeklyRankCard.tsx` |
| `WeeklyChallengeStrip` | `src/components/hoje/WeeklyChallengeStrip.tsx` |
| `MissionCard` | `src/components/MissionCard.tsx` |
| `MentorCard` | `src/components/MentorCard.tsx` |
| `getDynamicWeeklyChallenge` | `src/lib/supabase.ts` (l.~239-295) |
| `saveMilestone` | `src/lib/supabase.ts` (l.~319-325) |
| `claimLoginBonus` (não concede mais nada) | `src/lib/supabase.ts` (l.~810-828) + remover chamada em `HojeClient` l.~145 |

Também:
- **B1** — padronizar limites de fase: `HojeClient` mentor usa `<13/<19`; check-in usa `<12/<18`. Unificar para `<12/<18` (ou extrair helper `phaseForHour(hour)` em `src/lib/date.ts` e reutilizar nos dois).
- **B5** — `tsconfig.json`: subir `target` de `es5` para `es2018+` (remove aviso de depreciação) e remover `"types": ["vitest/globals"]` do `tsconfig` de produção (os globals do Vitest já vêm de `vitest.config.ts` / `globals: true`). Validar que `npm test` e `npm run typecheck` continuam verdes.

> Se a Liga semanal / cards forem roadmap futuro intencionalmente desligado, NÃO remover — apenas comentar a decisão. Em caso de dúvida, manter (são auto-contidos) e remover só os utilitários verdadeiramente órfãos (`getDynamicWeeklyChallenge`, `saveMilestone`).

---

## Arquivos críticos (resumo)

- `src/app/leitura/[id]/page.tsx` — P1.1
- `src/app/hoje/HojeClient.tsx` — P1.2, P2.1, P2.8, P3 (claimLoginBonus, fase)
- `src/lib/supabase.ts` — P1.3, P2.2, P2.6, P3
- `src/lib/date.ts` — reutilizar `todayISO`/`formatLocalDate`; possível helper `phaseForHour`
- `src/components/corpo/WorkoutTracker.tsx` — P2.3
- `src/lib/assessment-to-habits.ts` — P2.4
- `src/app/financas/page.tsx` — P2.5, P2.6
- `src/app/perfil/page.tsx` — P2.7
- `src/app/checkin/page.tsx` — P2.8
- `tsconfig.json` — B5

---

## Testes a adicionar (`src/lib/__tests__/`)

1. **`ritmo-timezone.test.ts`** — com `TZ=America/Sao_Paulo`, log local às 23h cai no dia local correto em `getRitmo` (falha hoje; passa após P1.3). *(Pode exigir refatorar a parte pura de buckets para uma função testável; se `getRitmo` depender de `supabase`, testar a função de bucketização extraída.)*
2. **`assessment-to-habits.test.ts`** (estender o existente) — chamar geração 2x → 0 duplicados por `catalog_key` (P2.4).
3. Teste unitário de normalização numérica do perfil (`'' → null`, `'5' → 5`) se a lógica for extraída para função pura (P2.7).
4. Se viável sem BD: teste de `getTrainingCount30d` com mock do client garantindo filtro `completed=true` (P2.2).

Manuais: ver cada secção P1/P2 acima.

---

## Verificação final (end-to-end)

1. `npm run typecheck` — sem erros reais (ignorar avisos de config já existentes, ou eliminados por B5).
2. `npm test` — todos verdes, incluindo os novos.
3. `npm run lint`.
4. Smoke manual no app (`npm run dev`, porta 3001):
   - Leitura: cenário de "retomar" (P1.1).
   - Hoje: ofensiva só sobe com atividade (P1.2) e level-up dispara ao subir de nível (P2.1).
   - Perfil: contador de treinos só conta concluídos (P2.2); salvar perfil com campos vazios não quebra (P2.7).
   - Finanças: adicionar transação inválida é bloqueada (P2.5); apagar remove dos gráficos (P2.6).
   - Corpo: exercícios extra persistem após reload (P2.3).
5. Commits por prioridade na branch `claude/code-audit-debugging-sgcrzt`; `git push -u origin claude/code-audit-debugging-sgcrzt` (retry com backoff em falha de rede). **Sem PR** salvo pedido explícito.
