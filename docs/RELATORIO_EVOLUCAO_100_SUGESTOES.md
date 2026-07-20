# NEXUS — Relatório Técnico de Evolução: 100 Sugestões

> **Data:** 2026-07-20 · **Base de análise:** código-fonte na branch `main` (commit `f76d76e`),
> documentação em `docs/` e schema versionado em `supabase/`.
> Este documento serve como insumo de planejamento para as equipes de desenvolvimento e produto.

**Índice**

1. [Resumo executivo](#1-resumo-executivo)
2. [Diagnóstico geral do aplicativo](#2-diagnóstico-geral-do-aplicativo)
3. [As 100 sugestões, por categoria](#3-as-100-sugestões)
4. [Roadmap sugerido](#4-roadmap-sugerido)
5. [Tabela de priorização (100 itens)](#5-tabela-de-priorização)
6. [Top 20 por ROI](#6-top-20-por-roi)

---

## 1. Resumo executivo

O **NEXUS** é um PWA de desenvolvimento pessoal gamificado (hábitos, programa de 63 dias,
treino/dieta/peso, finanças com import de PDF/planilha, e-reader, objetivos, agenda e liga
semanal), construído em **Next.js 14 (App Router) + TypeScript + Supabase**. O produto está
funcional, com build/lint/typecheck/testes verdes, schema completo versionado (38 tabelas,
96 policies RLS) e uma base de lógica de negócio **pura e testada** em `src/lib` — um
diferencial raro em projetos deste porte.

A arquitetura, porém, é **client-heavy ao extremo**: quase todas as páginas são `'use client'`,
fazem fetch direto ao Supabase em `useEffect`, sem cache de servidor, sem camada de estado e com
componentes monolíticos (`financas/page.tsx` com 2.433 linhas, `WorkoutTracker.tsx` com 1.554).
Não existe CI, observabilidade (Sentry/analytics) nem testes de UI/E2E. Há pendências de
segurança conhecidas e auditáveis (chave anon historicamente exposta, `CRON_SECRET` fora do
Vault, 4 casos de RLS a revisar) e uma violação objetiva de acessibilidade
(`userScalable: false` bloqueia zoom).

**Recomendação central:** antes de acelerar features, investir 30 dias em *fundação* —
CI, segurança, observabilidade e correção dos itens críticos (5 sugestões marcadas como
**Críticas** neste relatório). Em paralelo, iniciar a modularização de `lib/supabase.ts` e dos
componentes gigantes, que hoje são o principal freio de velocidade da equipe. As 100 sugestões
abaixo estão priorizadas e estimadas para suportar exatamente esse sequenciamento.

**Números do relatório:** 5 sugestões Críticas · 35 Altas · 43 Médias · 17 Baixas,
distribuídas em 16 categorias.

---

## 2. Diagnóstico geral do aplicativo

### 2.1 Visão de estado atual

| Dimensão | Estado | Evidência |
|---|---|---|
| Build/qualidade estática | 🟢 Verde | `npm run build/lint/typecheck/test` passam |
| Lógica de negócio | 🟢 Sólida | 25+ suítes Vitest sobre engines puros (`src/lib/__tests__`) |
| Schema/BD | 🟢 Versionado | `supabase/migrations/20260718000000_baseline_schema.sql` (38 tabelas, 96 RLS) |
| Arquitetura frontend | 🟡 Frágil | Client-heavy, sem cache, componentes de 1.000–2.400 linhas |
| CI/CD | 🔴 Inexistente | Sem `.github/workflows` |
| Observabilidade | 🔴 Inexistente | Sem Sentry, sem analytics, erros engolidos com toast genérico |
| Testes de UI/E2E | 🔴 Inexistentes | `@testing-library/react` instalado, zero testes de componente |
| Segurança | 🟡 Pendências | Rotação de chave, `CRON_SECRET`, 4 casos de RLS (ver `TECHNICAL_DEBT.md`) |
| Acessibilidade | 🔴 Falhas objetivas | Zoom bloqueado, contraste não auditado, modais sem focus trap |

### 2.2 Pontos fortes

- **Separação de lógica pura**: engines de onboarding, programa, corpo, finanças e parsers em
  `src/lib/*` são funções puras com testes — refatorações de UI não quebram regra de negócio.
- **Schema íntegro e auditável**: baseline completo com RLS ativo em todas as 38 tabelas,
  processo de migrations documentado em `supabase/README.md`.
- **Produto coeso e diferenciado**: 7 áreas de vida integradas com gamificação (XP, streaks,
  liga semanal) e mentor contextual — escopo que concorrentes cobrem só em partes.
- **PWA funcional com Web Push**: notificações agendadas via `pg_cron` + Edge Function
  (`send-reminders`) e service worker de push dedicado que funciona no iOS.
- **Middleware de sessão resiliente**: refresh de sessão com `AbortSignal.timeout(5s)` evita
  que instabilidade do Supabase derrube o site (aprendizado incorporado ao código).
- **Cultura de documentação**: `docs/` com arquitetura, débito técnico, handoffs e specs.

### 2.3 Pontos fracos

- **Monólitos de UI**: `financas/page.tsx` (2.433 linhas), `WorkoutTracker.tsx` (1.554),
  `DietTracker.tsx` (1.065), `lib/supabase.ts` (1.168) — custo de manutenção alto, merge
  conflicts frequentes, difícil de testar.
- **Sem camada de dados no cliente**: cada navegação refaz todos os fetches; sem cache,
  sem deduplicação, sem estado otimista — a UI "pisca" e depende de rede a cada toque.
- **Ausência total de CI e monitoramento**: regressões só são vistas manualmente; erros de
  produção morrem em `console.error`.
- **Acessibilidade negligenciada**: zoom bloqueado no viewport, gestos sem alternativa
  (SwipeRow), gráficos sem descrição textual.
- **Estilo inconsistente**: estilos inline extensos convivendo com Tailwind subutilizado e
  tokens CSS — três formas de estilizar no mesmo repo.
- **Idioma misto para o mercado-alvo**: textos em pt-PT ("utilizador", "a app", comerciantes
  portugueses no categorizador de finanças) num produto com público pt-BR potencial.

### 2.4 Oportunidades de evolução

- **IA como multiplicador**: o mentor por regras (`lib/mentor.ts`), o categorizador heurístico
  (`lib/categorize.ts`, 27 linhas) e o parser de PDF são os três pontos onde um LLM entrega
  salto de qualidade com pouco código (ver S69–S74).
- **Dados já coletados, valor não extraído**: cargas de treino, histórico de peso, transações
  e streaks já existem no banco — análises de volume/PR, orçamentos com alerta e resumos
  semanais são "features baratas" sobre dados existentes.
- **Liga semanal como semente social**: a infraestrutura multi-user (snapshots de liga) permite
  desafios entre amigos com investimento incremental.
- **Open Finance**: substituir o import manual de PDF por agregadores bancários elimina a
  maior fricção do módulo de finanças.

### 2.5 Riscos técnicos

1. **Segurança dependente 100% de RLS** — a anon key é pública por design; qualquer policy
   incorreta é exposição direta de dados (o caso `weekly_league_snapshots` já expõe dados de
   todos os usuários autenticados).
2. **Regressões invisíveis** — sem CI nem testes de UI, mudanças de schema ou refactors podem
   quebrar fluxos silenciosamente (os erros são engolidos por toasts genéricos).
3. **`next-pwa@5.6.0` abandonado** — árvore de dependências antiga (workbox legado) com
   vulnerabilidades de tooling; upgrade tende a ficar mais caro com o tempo.
4. **Acoplamento a Supabase sem camada de abstração** — chamadas `supabase.from()` espalhadas
   em páginas dificultam migração, teste e evolução de contrato.
5. **Perda de dados locais** — cargas de treino e drafts vivem em `localStorage`; troca de
   dispositivo ou limpeza de dados do navegador apaga histórico sem aviso.

### 2.6 Débito técnico identificado (consolidado)

| # | Débito | Severidade | Sugestões relacionadas |
|---|---|---|---|
| 1 | `lib/supabase.ts` monolítico (1.168 linhas, todos os domínios) | Alta | S46, S48, S49 |
| 2 | Componentes/páginas gigantes (financas, corpo) | Alta | S47, S12, S28 |
| 3 | Ausência de CI/CD | Alta | S79, S80, S81 |
| 4 | 4 casos de RLS a revisar (badges, task_templates, liga, policies redundantes) | Alta | S17, S18, S33 |
| 5 | Zero testes de UI/integração/E2E | Alta | S85, S86, S87 |
| 6 | `next-pwa` desatualizado + dois service workers | Média | S16, S27, S38 |
| 7 | Estilos inline vs Tailwind (inconsistência) | Média | S09, S11 |
| 8 | Erros engolidos (toast genérico, catch vazio) | Média | S22, S76 |
| 9 | Docs parcialmente desatualizados (ARCHITECTURE cita 28 tabelas; hoje são 38) | Baixa | S96 |
| 10 | Repo pesado (`docs/rise-reference` com ~95 PNGs) | Baixa | S84 |

---
## 3. As 100 sugestões

> Formato: cada sugestão traz categoria, prioridade (Crítica/Alta/Média/Baixa), impacto
> (Alto/Médio/Baixo), esforço (Pequeno ≤ 2 dias · Médio ≤ 2 semanas · Grande > 2 semanas),
> problema, solução, benefícios, implementação, dependências/riscos e critérios de aceitação.

### 3.1 Experiência do usuário (UX)

#### S01 — Suporte offline real com fila de sincronização

> **Categoria:** UX · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** o app é um PWA instalável, mas toda ação (marcar hábito, registrar peso, salvar série de treino) faz fetch direto ao Supabase no browser. Sem rede — cenário comum na academia, no metrô — as ações falham com toast de erro e o dado se perde.
- **Solução proposta:** implementar fila de escrita offline: mutações são gravadas em IndexedDB e enviadas quando a conexão volta (Background Sync onde disponível; flush no `online` event como fallback). Leitura usa cache local com carimbo de atualização.
- **Benefícios esperados:** o principal caso de uso mobile (registrar no momento) passa a funcionar sempre; menos frustração e abandono.
- **Possível implementação técnica:** biblioteca `idb` + um módulo `lib/offline-queue.ts` com `enqueue({ table, op, payload, clientId })`; reconciliação idempotente por `client_generated_id` (coluna nova com unique constraint) para evitar duplicatas no replay. Integrar com a camada de dados criada em S46/S25.
- **Dependências ou riscos:** depende de S46 (camada de dados única) para não instrumentar 30 call sites; conflitos de merge (last-write-wins é aceitável no domínio pessoal).
- **Critérios de aceitação:** em modo avião, marcar hábito/peso/série mostra estado "pendente"; ao reconectar, os registros aparecem no Supabase sem duplicatas; teste E2E cobre o ciclo.

#### S02 — UI otimista nas ações do dia a dia

> **Categoria:** UX · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** marcar hábito/tarefa em `/hoje` espera o roundtrip ao Supabase (e às RPCs `update_streak`) antes de refletir na UI — em 3G o toque parece "não pegar", gerando toques duplos.
- **Solução proposta:** atualizar o estado local imediatamente ao toque, com rollback e toast em caso de falha (padrão *optimistic update*).
- **Benefícios esperados:** percepção de app "instantâneo"; menos toques duplicados e menos registros dobrados.
- **Possível implementação técnica:** com TanStack Query (S25), usar `onMutate`/`onError`/`onSettled`; sem ele, extrair um hook `useOptimisticToggle` usado por `TodayHabitList`, `TodayTaskList` e `TodayRemindersList`.
- **Dependências ou riscos:** rollback precisa restaurar também XP/streak exibidos; sinergia forte com S25.
- **Critérios de aceitação:** com rede lenta (throttling 3G), o check aparece em <100 ms; falha de rede reverte o check e exibe toast; sem duplicação de `habit_logs` em toques repetidos.

#### S03 — Substituir confirmações bloqueantes por ação + desfazer

> **Categoria:** UX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** exclusões (transação, lembrete, hábito) usam `ConfirmDialog`, adicionando um toque extra a operações frequentes e de baixo risco.
- **Solução proposta:** para itens facilmente restauráveis, executar a exclusão imediatamente e oferecer "Desfazer" no toast por 5 s (padrão Gmail). Manter confirmação apenas para ações irreversíveis (apagar conta, apagar plano de treino).
- **Benefícios esperados:** fluxo mais rápido; proteção real contra erro (undo) em vez de fricção ritual.
- **Possível implementação técnica:** estender `Toast.tsx` com botão de ação; soft-delete em memória (adiar o `delete` até o toast expirar) evita precisar de coluna `deleted_at`.
- **Dependências ou riscos:** garantir que navegar para outra página não cancele o delete pendente (flush em `beforeunload`/unmount).
- **Critérios de aceitação:** excluir transação remove a linha na hora; "Desfazer" a restaura sem refetch; após 5 s o registro some do banco.

#### S04 — Fluxo de replanejamento quando o programa de 63 dias atrasa

> **Categoria:** UX · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o programa (`programs → program_weeks → program_days`) assume progressão linear. Usuário que fica 5 dias fora volta para uma pilha de dias vencidos, sem caminho claro — cenário clássico de churn em apps de hábito.
- **Solução proposta:** ao detectar ≥ N dias sem check-in com programa ativo, oferecer tela de retomada com 3 opções: *recomeçar a semana*, *comprimir* (pular dias perdidos) ou *pausar programa*.
- **Benefícios esperados:** reduz abandono no momento de maior risco; transforma culpa em decisão simples.
- **Possível implementação técnica:** função pura `computeResumePlan(program, lastCheckinDate)` em `lib/program-engine.ts` (testável como os demais engines); mutação que reindexa `program_days.date` a partir de hoje; card de retomada em `/hoje`.
- **Dependências ou riscos:** cuidado com integridade das FKs semana→dia ao reindexar; decidir efeito no streak (recomendado: não punir na retomada).
- **Critérios de aceitação:** com 5 dias de gap, `/hoje` mostra o card de retomada; cada opção produz o estado esperado do programa; testes unitários do engine cobrem os 3 caminhos.

#### S05 — Busca global (⌘K / barra de busca)

> **Categoria:** UX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** com 9 seções (hábitos, finanças, leitura, lembretes...), encontrar "aquela transação" ou "aquele livro" exige navegar até o módulo e rolar; não há busca em lugar nenhum.
- **Solução proposta:** paleta de comandos global (atalho ⌘K no desktop, ícone de lupa no mobile) que busca em hábitos, transações, livros, lembretes e eventos, e também executa ações rápidas ("novo lembrete", "registrar peso").
- **Benefícios esperados:** navegação O(1) para usuários intensivos; superfície natural para o assistente de IA (S74) no futuro.
- **Possível implementação técnica:** componente `CommandPalette` com `cmdk`; busca client-side sobre dados já em cache (S25) + `ilike` no Supabase para históricos longos; índice `pg_trgm` em `transactions.description` e `books.title`.
- **Dependências ou riscos:** sem cache (S25), cada abertura dispara várias queries — implementar depois dele.
- **Critérios de aceitação:** ⌘K abre em qualquer página; digitar "merc" lista transações do Mercado; selecionar resultado navega para o item; funciona por teclado de ponta a ponta.

#### S06 — Reorganizar a navegação principal (9 itens → 5 hubs)

> **Categoria:** UX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** `Nav.tsx` (mobile) e `Sidebar.tsx` expõem 9 itens de navegação. Em bottom nav mobile, 9 itens ficam apertados e sem hierarquia — as diretrizes de iOS/Android recomendam ≤ 5.
- **Solução proposta:** consolidar em 5 hubs: **Hoje**, **Progresso**, **Corpo**, **Finanças**, **Mais** (leitura, objetivos, calendário, lembretes, perfil). Os mockups de hubs já existem em `docs/bug1-analysis/` e `docs/handoff-mockup-hubs.md` — executá-los.
- **Benefícios esperados:** navegação tocável com o polegar, hierarquia clara, espaço para crescer sem lotar a barra.
- **Possível implementação técnica:** refatorar `Nav.tsx` para 5 slots + sheet "Mais"; manter rotas atuais (sem quebra de URL); telemetria (S75) para validar a nova distribuição de acessos.
- **Dependências ou riscos:** mudança de hábito para usuários atuais — anunciar in-app; medir antes/depois.
- **Critérios de aceitação:** bottom nav com ≤ 5 itens e alvos ≥ 44 px; todas as rotas antigas continuam acessíveis em ≤ 2 toques.

#### S07 — Modo demonstração antes do cadastro

> **Categoria:** UX · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** o funil exige criar conta + onboarding completo antes de ver qualquer valor do produto — barreira alta para aquisição.
- **Solução proposta:** modo "explorar sem conta" com dados fictícios locais (read-only ou gravando em `localStorage`), com CTA persistente de criar conta para salvar o progresso.
- **Benefícios esperados:** mais conversão de visitantes; demo utilizável em divulgação.
- **Possível implementação técnica:** provider de dados mock por trás da camada de dados (S46) ativado por `?demo=1`; seeds de demonstração compartilhados com S99.
- **Dependências ou riscos:** depende de S46 para trocar a fonte de dados sem `if` espalhado; manter o mock enxuto para não virar segundo backend.
- **Critérios de aceitação:** visitante sem conta consegue navegar por Hoje/Corpo/Finanças com dados demo; nenhuma escrita atinge o Supabase; criar conta zera o estado demo.

#### S08 — `loading.tsx` e `error.tsx` em todas as rotas de dados

> **Categoria:** UX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** apenas `hoje`, `corpo` e `calendario` têm `loading.tsx`/`error.tsx`. Finanças (a página mais pesada), leitura, hábitos, perfil e progresso abrem "em branco" até o JS hidratar e o fetch terminar, e falhas caem sem tela de recuperação.
- **Solução proposta:** replicar o padrão existente (`HojeLoading`, `ErrorState`) para as rotas restantes, com skeletons fiéis ao layout final.
- **Benefícios esperados:** percepção de velocidade consistente; falhas viram tela com "tentar novamente" em vez de página quebrada.
- **Possível implementação técnica:** reutilizar `components/ui/Skeleton.tsx` e `ErrorState.tsx`; criar `FinancasLoading`, `LeituraLoading` etc. seguindo `components/hoje/HojeLoading.tsx` como referência.
- **Dependências ou riscos:** nenhum relevante; cuidado para skeleton não divergir do layout real (manutenção dupla).
- **Critérios de aceitação:** todas as rotas com fetch têm skeleton imediato ao navegar; simular erro de rede exibe `ErrorState` com retry funcional.

### 3.2 Interface (UI)

#### S09 — Migração progressiva de estilos inline para Tailwind + tokens

> **Categoria:** UI · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Grande

- **Problema identificado:** o código mistura três abordagens: objetos `style={{...}}` extensos, classes Tailwind ocasionais e tokens CSS de `globals.css`. Estilos inline impedem media queries, pseudo-estados (`:hover`, `:focus-visible`) e tornam o modo claro (tokens `--ink`) dependente de disciplina manual.
- **Solução proposta:** definir Tailwind + tokens CSS como padrão único; mapear os tokens (`--gold`, `--teal`, `--bg*`, `--ink`) no `tailwind.config.ts` (`colors: { gold: 'var(--gold)', ... }`) e migrar por página, começando pelas telas em refactor (S12, S47).
- **Benefícios esperados:** consistência visual, menos CSS morto, modo claro/escuro à prova de esquecimento, diffs menores.
- **Possível implementação técnica:** regra ESLint `react/forbid-dom-props` (warn para `style`) para conter novos usos; migrar junto com refactors para não gerar PRs puramente cosméticos.
- **Dependências ou riscos:** migração "big bang" é arriscada — fazer por módulo com screenshot antes/depois (S90 ajuda).
- **Critérios de aceitação:** tokens disponíveis como classes Tailwind; zero `style={}` novos em PRs (lint); 3 primeiras telas migradas sem regressão visual.

#### S10 — Auditoria de contraste e acabamento do modo claro

> **Categoria:** UI · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o modo claro "Aconchego" acabou de ser migrado para tokens `-ink` (commits `4e89852`, `1718524`), e o histórico mostra correções pontuais de legibilidade — sinal de que restam superfícies com contraste insuficiente não inventariadas.
- **Solução proposta:** varredura sistemática tela a tela nos dois temas medindo contraste (WCAG AA: 4.5:1 texto, 3:1 UI), corrigindo tokens em vez de casos isolados.
- **Benefícios esperados:** modo claro sai de "beta visual" para produção; menos issues de legibilidade reportadas.
- **Possível implementação técnica:** Playwright + `axe-core` iterando rotas em `data-theme=light|dark` e reportando violações de contraste; corrigir na fonte (`globals.css`).
- **Dependências ou riscos:** nenhum; sinergia com S40 (contraste como critério permanente) e S90 (regressão visual).
- **Critérios de aceitação:** relatório axe sem violações de contraste nas 9 telas principais em ambos os temas; tokens documentados com seus pares de fundo aprovados.

#### S11 — Biblioteca de componentes base (Button, Input, Card, Tabs)

> **Categoria:** UI · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** `components/ui/` cobre BottomSheet, Skeleton, StatCard etc., mas **não há** Button, Input, Select ou Tabs — cada tela reimplementa botões e campos com estilos próprios, gerando variações de padding, raio e estados de foco.
- **Solução proposta:** criar primitivos `ui/Button`, `ui/Input`, `ui/Select`, `ui/Tabs`, `ui/Field` com variantes (`primary/ghost/danger`, tamanhos) e estados (`disabled`, `loading`, `:focus-visible`), e adotá-los nos refactors.
- **Benefícios esperados:** consistência visual imediata, acessibilidade centralizada (foco, aria) e telas novas muito mais rápidas de construir.
- **Possível implementação técnica:** `class-variance-authority` (cva) + `clsx` (já instalado) sobre os tokens do S09; documentar no Storybook/Ladle (S98).
- **Dependências ou riscos:** requer disciplina de adoção — bloquear via review; risco baixo.
- **Critérios de aceitação:** primitivos publicados e usados em ≥ 3 telas; botão primário idêntico (pixel) em Hoje, Corpo e Finanças; navegação por teclado com foco visível em todos.

#### S12 — Reestruturar a tela de Finanças no modelo de hub (mockups prontos)

> **Categoria:** UI · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** `/financas` concentra numa única página de 2.433 linhas: saldo, movimentos, orçamento, metas, reserva, recorrências e import — rolagem longa, hierarquia confusa e o pior tempo de manutenção do app. Os mockups de solução já existem (`docs/bug1-analysis/financas-*.png`).
- **Solução proposta:** implementar o hub aprovado: visão geral + sub-telas (Movimentos, Orçamento, Metas/Reserva), com navegação interna e URL própria por sub-tela (`/financas/movimentos` etc.).
- **Benefícios esperados:** tela mais legível e rápida; código dividido em módulos testáveis (viabiliza S28/S47); base para orçamento com alertas (S57).
- **Possível implementação técnica:** rotas aninhadas do App Router com `layout.tsx` compartilhando o header do hub; extrair hooks (`useTransactions`, `useBudget`) na quebra.
- **Dependências ou riscos:** maior refactor de UI do plano — fazer por sub-tela, atrás das URLs novas, mantendo a página velha até paridade; testes E2E (S86) antes de cortar.
- **Critérios de aceitação:** cada sub-tela em arquivo próprio ≤ 400 linhas; URLs profundas funcionam; paridade funcional com a tela atual validada por checklist.

#### S13 — Tema inicial segue `prefers-color-scheme`

> **Categoria:** UI · **Prioridade:** Baixa · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** o script inline em `layout.tsx` cai para `dark` quando não há escolha salva, ignorando a preferência do sistema do usuário — quem usa o SO em claro recebe app escuro no primeiro acesso.
- **Solução proposta:** default = `matchMedia('(prefers-color-scheme: light)')` quando `nexus-theme` não existe; escolha manual continua vencendo.
- **Benefícios esperados:** primeira impressão alinhada ao dispositivo; aproveita o investimento recente no modo claro.
- **Possível implementação técnica:** ajustar o script anti-flash: `var t=localStorage.getItem('nexus-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')`.
- **Dependências ou riscos:** garantir que o modo claro esteja auditado (S10) antes de promovê-lo a default.
- **Critérios de aceitação:** dispositivo em modo claro sem preferência salva abre o app claro, sem flash; toggle manual persiste e vence o sistema.

#### S14 — Padronização do sistema de ícones

> **Categoria:** UI · **Prioridade:** Baixa · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** `ui/Icon.tsx` mantém um set SVG próprio (227 linhas) que cresce ad hoc; tamanhos e espessuras variam entre telas e emojis aparecem como ícones em alguns pontos.
- **Solução proposta:** ou consolidar o set próprio com grid/stroke únicos e catálogo documentado, ou migrar para `lucide-react` (tree-shakeable) mantendo `Icon` como wrapper para não tocar os call sites.
- **Benefícios esperados:** coerência visual, ícones novos "de graça", menos SVG manual.
- **Possível implementação técnica:** wrapper `Icon name="..."` mapeando para componentes Lucide; codemod simples para nomes divergentes.
- **Dependências ou riscos:** diferenças sutis de desenho — revisar telas-chave; impacto de bundle mínimo com imports nomeados.
- **Critérios de aceitação:** todos os ícones da navegação e das telas principais vêm do sistema único, com tamanho/stroke consistentes; documentação de uso no repo.

#### S15 — Sistema de microinterações consistente

> **Categoria:** UI · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** os momentos de recompensa (XP, level-up, badge, streak) são o coração da gamificação, mas as animações atuais são heterogêneas (modais que "pulam", transições abruptas em sheets e tabs).
- **Solução proposta:** definir um vocabulário de motion (durações 150/250/400 ms, easings padrão) aplicado a sheets, toasts e celebrações; celebrações especiais (level-up) com animação mais rica porém interruptível.
- **Benefícios esperados:** app percebido como polido; recompensas com mais impacto emocional — núcleo do produto.
- **Possível implementação técnica:** tokens de motion em CSS custom properties + `framer-motion` apenas nos componentes de celebração (`LevelUpModal`, `BadgeModal`); respeitar `prefers-reduced-motion` (S43).
- **Dependências ou riscos:** ~30 kB do framer-motion — importar dinamicamente só nas celebrações.
- **Critérios de aceitação:** sheets/toasts/modais usam as mesmas curvas; level-up tem celebração nova; com `prefers-reduced-motion`, tudo vira fade simples.

### 3.3 Correções de bugs e inconsistências

#### S16 — Resolver a coexistência de dois service workers (sw.js × push-worker.js)

> **Categoria:** Bugs · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o `next-pwa` gera `public/sw.js` (com `worker/index.js` injetado), mas `next.config.mjs` usa `register: false` e o app registra apenas `/push-worker.js` (via `src/lib/push.ts`). Resultado: o SW de cache com `runtimeCaching` nunca é registrado em fluxo normal — e usuários antigos que chegaram a registrar o `sw.js` podem servir cache obsoleto para sempre, enquanto `worker/index.js` duplica a lógica de push que já vive em `push-worker.js`.
- **Solução proposta:** decidir um único SW: ou registrar oficialmente o `sw.js` do next-pwa (que já contém o push via `worker/index.js`), ou remover o pipeline next-pwa e manter só o `push-worker.js` estendendo-o com caching. Adicionar rotina de *cleanup* que desregistra o SW obsoleto e limpa caches antigos.
- **Benefícios esperados:** elimina classe inteira de bugs de "versão velha presa no cache"; código morto removido; comportamento offline previsível.
- **Possível implementação técnica:** em `ServiceWorkerRegister.tsx`, `navigator.serviceWorker.getRegistrations()` + `unregister()` do SW não-canônico e `caches.delete('nexus-cache')` se aplicável; documentar a decisão em `docs/`.
- **Dependências ou riscos:** desregistrar o SW errado quebraria push — testar no iOS standalone (motivo original do SW dedicado, ver comentário em `next.config.mjs`).
- **Critérios de aceitação:** exatamente 1 SW registrado em instalação nova e em upgrade de instalação antiga; push continua chegando no iOS/Android; nenhuma referência ao SW removido no código.

#### S17 — Corrigir RLS de `badges` e `task_templates` (RLS ativo sem policy)

> **Categoria:** Bugs · **Prioridade:** Crítica · **Impacto:** Alto · **Esforço:** Pequeno

- **Problema identificado:** conforme auditoria em `TECHNICAL_DEBT.md`, `badges` e `task_templates` têm RLS habilitado **sem nenhuma policy** — todo `select` do app é negado silenciosamente. Como os erros são engolidos (S22), catálogos de badges e templates de tarefas podem estar vindo vazios em produção sem ninguém perceber.
- **Solução proposta:** confirmar a intenção e criar policies de leitura para `authenticated` (são tabelas de catálogo, não dados pessoais): `create policy read_badges on badges for select to authenticated using (true);` idem `task_templates`. Escrita continua bloqueada.
- **Benefícios esperados:** gamificação (badges) e geração de programa (templates) funcionam de forma garantida; um débito crítico auditado sai da lista.
- **Possível implementação técnica:** migration via `supabase/migrations/` + `apply_migration` (processo do repo); verificar no app os pontos que leem essas tabelas e validar com dados reais.
- **Dependências ou riscos:** se houver colunas sensíveis em `task_templates`, expor via view; risco baixo.
- **Critérios de aceitação:** `select` autenticado retorna linhas nas duas tabelas; fluxo de badge desbloqueada e geração de programa validados manualmente; migration versionada no repo.

#### S18 — Remover policies RLS redundantes em `reminders` e `transactions`

> **Categoria:** Bugs · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** as duas tabelas têm policy `ALL` **e** policies granulares sobrepostas (auditoria do baseline). Policies redundantes tornam o comportamento efetivo difícil de raciocinar e futuras mudanças perigosas (remover uma achando que a outra cobre).
- **Solução proposta:** consolidar em um conjunto único e explícito por operação (`select/insert/update/delete`, todas `using/with check (auth.uid() = user_id)`), removendo a policy `ALL`.
- **Benefícios esperados:** RLS auditável de relance; base para os testes de RLS (S87).
- **Possível implementação técnica:** migration com `drop policy` + `create policy` nomeadas por convenção (`reminders_select_own` etc.); rodar S87 antes/depois como rede de segurança.
- **Dependências ou riscos:** janela de risco se o deploy remover antes de criar — fazer na mesma transação/migration.
- **Critérios de aceitação:** cada tabela com exatamente 4 policies nomeadas por operação; testes de RLS confirmam isolamento por usuário antes e depois.

#### S19 — Auditoria de fuso horário de ponta a ponta (datas de hábito, lembrete e push)

> **Categoria:** Bugs · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o domínio inteiro gira em torno de "hoje" (`todayISO()`, `habit_logs.date`, carryover de lembretes, janela do ritmo), e o histórico mostra que timezone já causou bugs (`ritmo-timezone.test.ts`, migration `notifications_push_v2_timezone.sql`). O cálculo de "hoje" no cliente, o agendamento do `pg_cron` (UTC) e o carimbo das tabelas podem discordar perto da meia-noite ou em viagem, marcando hábitos no dia errado e quebrando streaks.
- **Solução proposta:** definir contrato único — "dia do usuário" = data local do timezone salvo no perfil — e auditar todos os produtores/consumidores de datas (`lib/date.ts`, `today-reminders.ts`, `send-reminders`, RPC `update_streak`) contra esse contrato, com testes nas bordas (23h59/00h01, mudança de fuso, DST).
- **Benefícios esperados:** elimina a classe de bug mais corrosiva para a confiança do usuário (streak perdido "sem culpa").
- **Possível implementação técnica:** tabela de casos de borda em testes Vitest com `vi.setSystemTime` + TZ mockado; coluna `profiles.timezone` como fonte de verdade para a Edge Function (já há suporte parcial na v2).
- **Dependências ou riscos:** mudanças no `update_streak` (SQL) exigem migration + testes de RLS/RPC; cuidado com dados históricos gravados no fuso antigo.
- **Critérios de aceitação:** suíte de timezone cobre as bordas listadas; check às 23h59 e 00h01 grava nos dias corretos; push chega na hora local configurada em 2 fusos testados.

#### S20 — Migrar cargas de treino de `localStorage` para o banco

> **Categoria:** Bugs · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o histórico de cargas/séries do `WorkoutTracker` vive em `localStorage` (decisão documentada em `ARCHITECTURE.md`). Trocar de aparelho, reinstalar o PWA ou limpar dados do navegador **apaga o histórico de treino** — dado que o usuário mais valoriza no módulo Corpo — e impossibilita as análises de progressão (S61).
- **Solução proposta:** persistir séries/cargas em tabela própria (`workout_set_logs`: user_id, training_entry_id/exercise, date, set_index, weight, reps), mantendo `localStorage` apenas como cache de escrita offline (ponte com S01).
- **Benefícios esperados:** dado crítico sobrevive a troca de dispositivo; habilita gráficos de progressão e PRs; multi-dispositivo coerente.
- **Possível implementação técnica:** migration + RLS por `user_id`; script de migração one-shot no primeiro load (lê localStorage, sobe em lote, marca flag); escrita passa a ser dual até estabilizar.
- **Dependências ou riscos:** volume de escrita por treino é baixo (dezenas de linhas) — sem risco de custo; cuidar de duplicação na migração (chave natural user+exercise+date+set).
- **Critérios de aceitação:** treino registrado no aparelho A aparece no aparelho B; limpar dados do navegador não perde histórico; dados legados de localStorage migrados sem duplicatas.

#### S21 — Limpeza de rotas legadas e documentação divergente

> **Categoria:** Bugs · **Prioridade:** Baixa · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** três rotas são shims de redirect (`/dashboard`, `/evolucao`, `/onboarding`); `ARCHITECTURE.md` ainda descreve "28 tabelas" e a RPC `add_xp` que a auditoria provou não existir; `GIT_CLEANUP.md` e handoffs antigos convivem com docs atuais — quem chega ao projeto lê informação errada.
- **Solução proposta:** varrer links internos para apontarem às rotas canônicas, mover os redirects para `next.config.mjs` (`redirects()`), atualizar `ARCHITECTURE.md` e arquivar docs históricos em `docs/archive/`.
- **Benefícios esperados:** menos superfície de manutenção; onboarding de devs sem pistas falsas.
- **Possível implementação técnica:** `grep` por `/dashboard|/evolucao|/onboarding'` no `src/`; redirects 308 no config eliminam os 3 `page.tsx` shim.
- **Dependências ou riscos:** manter os redirects (não remover as URLs) — podem existir bookmarks/notificações antigas apontando para elas.
- **Critérios de aceitação:** nenhuma navegação interna passa por shim; os 3 arquivos shim removidos com redirect no config; `ARCHITECTURE.md` refletindo as 38 tabelas e RPCs reais.

#### S22 — Padronizar tratamento de erros (parar de engolir falhas)

> **Categoria:** Bugs · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o padrão atual (`reportError` em `lib/supabase.ts`) reduz qualquer falha a `console.error` + toast genérico, e há `catch {}` vazios (ex.: middleware). Falhas de gravação podem passar como sucesso visual (o usuário acha que marcou o hábito), e nada chega a um sistema de monitoramento.
- **Solução proposta:** contrato único de erro na camada de dados: toda operação retorna `{ data, error }` tipado; UI decide entre retry, rollback (S02) e mensagem específica; erros inesperados sobem para o Sentry (S76) com contexto (operação, tabela).
- **Benefícios esperados:** usuário nunca "perde" um registro achando que salvou; time enxerga erros reais de produção; base sólida para offline (S01).
- **Possível implementação técnica:** tipo `Result<T> = { ok: true; data: T } | { ok: false; error: AppError }` em `lib/data/`; ESLint `no-empty` + regra proibindo `catch` sem tratamento; toasts com mensagem derivada de `AppError.kind`.
- **Dependências ou riscos:** tocar muitos call sites — fazer junto com a modularização S46 para não passar duas vezes no mesmo código.
- **Critérios de aceitação:** nenhuma mutação silenciosamente descartada (falha sempre gera feedback específico + evento no Sentry); zero `catch` vazio no `src/` (lint garante).

### 3.4 Otimizações de desempenho

#### S23 — Servir fontes via `next/font` (eliminar `@import` bloqueante)

> **Categoria:** Desempenho · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** `globals.css` importa Inter e DM Sans via `@import url(fonts.googleapis.com...)` — requisição bloqueante de renderização, em cadeia (CSS → CSS do Google → WOFF2), com FOUT/FOIT e dependência de terceiro a cada visita.
- **Solução proposta:** migrar para `next/font/google` (self-host automático, preload, `font-display: swap`, subsetting), expondo as famílias como CSS variables consumidas pelos tokens atuais.
- **Benefícios esperados:** melhora direta de FCP/LCP (tipicamente 200–500 ms em 4G); zero dependência do Google Fonts em runtime; sem layout shift de fonte.
- **Possível implementação técnica:**
  ```ts
  // layout.tsx
  import { Inter, DM_Sans } from 'next/font/google'
  const inter = Inter({ subsets: ['latin'], weight: ['400','700','800','900'], variable: '--font-inter' })
  const dmSans = DM_Sans({ subsets: ['latin'], weight: ['300','400','500'], variable: '--font-dm' })
  <html className={`${inter.variable} ${dmSans.variable}`}>
  ```
  e em `globals.css`, trocar os nomes fixos por `var(--font-inter)` / `var(--font-dm)`. Remover o `@import`. (Atenção à regra do projeto: **Syne segue banida** — a migração não deve reintroduzi-la.)
- **Dependências ou riscos:** conferir todos os pesos usados antes de listar `weight`; risco baixo.
- **Critérios de aceitação:** nenhuma requisição a `fonts.googleapis.com` no waterfall; Lighthouse sem aviso de render-blocking de fonte; tipografia visualmente idêntica.

#### S24 — Carregar Recharts sob demanda

> **Categoria:** Desempenho · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** Recharts (~100 kB gzip com d3) entra no bundle de qualquer página que importa componentes de gráfico (peso em Corpo, estatísticas), pesando também na hidratação de quem só veio marcar um hábito.
- **Solução proposta:** envolver os componentes de gráfico em `next/dynamic` com `ssr: false` e skeleton, para que o chunk só baixe quando o gráfico entra em tela.
- **Benefícios esperados:** bundle inicial das rotas quentes menor; TTI melhor em mobile.
- **Possível implementação técnica:** `const WeightChart = dynamic(() => import('./WeightChart'), { ssr: false, loading: () => <Skeleton h={220}/> })`; extrair os `<ResponsiveContainer>` para arquivos próprios onde ainda estão inline.
- **Dependências ou riscos:** flash de skeleton onde o gráfico é o herói da tela — aceitável; nenhum outro.
- **Critérios de aceitação:** `@next/bundle-analyzer` mostra recharts fora dos chunks iniciais de `/hoje` e `/corpo`; gráficos continuam funcionais.

#### S25 — Adotar TanStack Query como camada de cache e estado de servidor

> **Categoria:** Desempenho · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** não há cache de dados: cada `useEffect` refaz as queries a cada montagem — voltar de `/corpo` para `/hoje` recarrega tudo, com spinners repetidos e consumo de rede desnecessário.
- **Solução proposta:** introduzir TanStack Query: queries nomeadas por domínio, `staleTime` por tipo de dado (perfil 5 min, hábitos do dia 30 s), invalidation nas mutações e persistência opcional em IndexedDB (ponte com S01).
- **Benefícios esperados:** navegação instantânea entre telas já visitadas; deduplicação de requests; fundação para otimismo (S02), offline (S01) e busca (S05).
- **Possível implementação técnica:** `QueryClientProvider` no layout; hooks `useHabitsToday()`, `useTransactions(month)` etc. em `lib/queries/`, consumindo os repositórios de S46; migrar página a página começando por `/hoje`.
- **Dependências ou riscos:** melhor depois/junto de S46; invalidation mal feita causa dado obsoleto — padronizar chaves (`['habits', userId, date]`).
- **Critérios de aceitação:** navegar Hoje → Corpo → Hoje não refaz fetch dentro do `staleTime` (verificável na aba Network); mutações invalidam exatamente as queries afetadas; zero regressão funcional nas páginas migradas.

#### S26 — Eliminar cascatas de queries nas páginas (fetch paralelo/agregado)

> **Categoria:** Desempenho · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** páginas como `/hoje` e `/corpo` disparam várias queries dependentes em sequência (perfil → hábitos → logs → ritmo → lembretes), cada uma esperando a anterior — latência total = soma das latências.
- **Solução proposta:** paralelizar o que é independente (`Promise.all`) e agregar o que é sempre usado junto numa RPC (`get_today_bundle(user_id, date)`) ou view, reduzindo N roundtrips a 1–2.
- **Benefícios esperados:** tempo até conteúdo útil da tela Hoje cai proporcionalmente (tipicamente 3–5× em conexões de alta latência).
- **Possível implementação técnica:** função SQL `security definer` com `json_build_object` retornando hábitos+logs+ritmo+lembretes do dia; no cliente, uma única query alimenta os hooks; medir com `performance.mark` antes/depois.
- **Dependências ou riscos:** RPC agregada precisa respeitar RLS (usar `security invoker` ou filtrar por `auth.uid()` explicitamente — testar em S87).
- **Critérios de aceitação:** `/hoje` faz ≤ 2 roundtrips ao Supabase no load (era ~5+); waterfall do DevTools comprova paralelismo; RPC coberta por teste de isolamento.

#### S27 — Estratégias de cache do service worker por tipo de recurso

> **Categoria:** Desempenho · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o `runtimeCaching` atual é uma regra única `NetworkFirst` para `https?.*` com timeout de 10 s — estáticos imutáveis (chunks `_next/static`, ícones) esperam rede à toa, e chamadas ao Supabase (dados pessoais mutáveis) podem ser servidas de cache indevidamente.
- **Solução proposta:** regras segmentadas: `CacheFirst` para `_next/static` e ícones (são content-hashed), `StaleWhileRevalidate` para imagens, e **excluir** o domínio Supabase do cache do SW (o cache de dados é papel do S25/S01).
- **Benefícios esperados:** abertura do PWA instantânea mesmo com rede ruim; sem risco de dado pessoal desatualizado vindo do SW.
- **Possível implementação técnica:** array `runtimeCaching` no `next.config.mjs` com `urlPattern` por origem/caminho; depende da decisão do S16 (qual SW é o canônico).
- **Dependências ou riscos:** encadeado ao S16; testar upgrade de SW para não prender assets velhos.
- **Critérios de aceitação:** assets estáticos servidos do cache (DevTools → Network `from ServiceWorker`) sem tocar a rede; nenhuma resposta do Supabase aparece em `caches`.

#### S28 — Code-splitting dos módulos pesados de página

> **Categoria:** Desempenho · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** telas monolíticas carregam funcionalidades raramente usadas junto do caminho crítico: `/financas` embute o fluxo inteiro de import (modal, parser de PDF/planilha, preview) mesmo para quem só quer ver o saldo; `/corpo` carrega os 3 trackers de uma vez.
- **Solução proposta:** dividir por interação: modais e fluxos secundários (`FileImportModal`, `PlanReviewModal`, `PlanSelector`, e os parsers `pdf.ts`/`spreadsheet.ts`) viram `dynamic import` disparado pelo clique; tabs de Corpo carregam seu tracker sob demanda.
- **Benefícios esperados:** JS inicial das duas rotas mais pesadas cai de forma relevante; interação principal fica interativa antes.
- **Possível implementação técnica:** `next/dynamic` para componentes; `await import('@/lib/pdf')` dentro do handler de upload (os parsers são os candidatos mais gordos); validar com bundle-analyzer (S30).
- **Dependências ou riscos:** naturalmente alinhado ao refactor S12/S47 — fazer junto; latência de primeiro clique no modal (~100 ms) é aceitável com spinner.
- **Critérios de aceitação:** chunk inicial de `/financas` reduzido ≥ 30 %; parser de PDF só baixa após o usuário escolher importar; sem regressão funcional no fluxo de import.

#### S29 — Paginação e índices para dados históricos

> **Categoria:** Desempenho · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** listas históricas (transações, `habit_logs`, pesos, sessões de leitura) são buscadas sem paginação — com 1–2 anos de uso, `/financas` baixará milhares de linhas a cada visita, e a degradação será silenciosa e progressiva.
- **Solução proposta:** paginar por período (mês em finanças — a UI já é mensal; janelas móveis nos gráficos) com `range()`/keyset, e garantir índices compostos `(user_id, date desc)` nas tabelas de série temporal.
- **Benefícios esperados:** tempo de resposta constante independente da idade da conta; menos egress do Supabase (custo).
- **Possível implementação técnica:** `.gte('date', monthStart).lte('date', monthEnd)` onde ainda não há filtro; migration com `create index concurrently if not exists idx_transactions_user_date on transactions (user_id, date desc);` idem `habit_logs`, `body_measurements`, `reading_sessions`; "carregar mais" por keyset (`lt('date', cursor)`).
- **Dependências ou riscos:** agregados de longo prazo (estatísticas) devem migrar para RPC/view agregada em vez de baixar tudo (ligação com S26).
- **Critérios de aceitação:** nenhuma query de lista sem filtro de período ou `limit`; `explain` mostra index scan nas consultas quentes; conta com 5k transações sintéticas abre `/financas` em tempo equivalente a uma conta nova.

#### S30 — Orçamento de bundle e análise contínua

> **Categoria:** Desempenho · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** sem medição, os ganhos de S23–S28 regridem: qualquer `import` descuidado (uma lib de datas nova, um ícone gigante) volta a inflar o bundle sem ninguém notar.
- **Solução proposta:** integrar `@next/bundle-analyzer` (script `npm run analyze`) e um orçamento por rota verificado no CI (falha se o first-load JS de rotas-chave exceder o limite acordado, ex.: 180 kB gzip).
- **Benefícios esperados:** desempenho vira invariante mantida por máquina, não por vigilância humana.
- **Possível implementação técnica:** job no workflow do S79 que roda `next build`, extrai o first-load por rota do output e compara com `perf-budget.json`; PR falha com diff amigável.
- **Dependências ou riscos:** depende do CI (S79); definir limites realistas a partir do estado pós-S23/S24 para não bloquear tudo no dia 1.
- **Critérios de aceitação:** `npm run analyze` funcional; CI falha em PR que estoura o orçamento de `/hoje`, `/financas` ou `/corpo`; limites documentados.

### 3.5 Segurança

#### S31 — Rotacionar a chave anon do Supabase e varrer o histórico do Git

> **Categoria:** Segurança · **Prioridade:** Crítica · **Impacto:** Alto · **Esforço:** Pequeno

- **Problema identificado:** `TECHNICAL_DEBT.md` registra que uma chave real esteve no `.env.example` (hoje sanitizado). A chave anon é pública por design, mas uma chave que circulou no histórico do Git é um vetor conhecido e barato de eliminar — e a recomendação de rotação está pendente desde a auditoria.
- **Solução proposta:** rotacionar para as novas *publishable/secret keys* do Supabase, atualizar Vercel/`.env.local`, e varrer o histórico (`gitleaks`) para confirmar que nenhum outro segredo (service role, VAPID private key) foi commitado.
- **Benefícios esperados:** fecha pendência de auditoria; garante que só a chave atual, protegida por RLS, é válida.
- **Possível implementação técnica:** Supabase Dashboard → API Keys → rotate; `gitleaks detect --source . --log-opts="--all"`; adicionar gitleaks ao CI (S79) como guarda permanente.
- **Dependências ou riscos:** janela de troca — deploy com a chave nova imediatamente após rotacionar (a antiga fica inválida); comunicar se houver builds antigos em cache.
- **Critérios de aceitação:** chave antiga revogada e app funcionando com a nova em produção; `gitleaks` limpo no histórico completo; scan rodando em todo PR.

#### S32 — Mover `CRON_SECRET` para o Supabase Vault

> **Categoria:** Segurança · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o job `pg_cron` que chama a Edge Function `send-reminders` carrega o `CRON_SECRET` em texto claro no comando do job (pendência explícita do `TECHNICAL_DEBT.md`) — legível por qualquer pessoa com acesso ao painel/dump do banco.
- **Solução proposta:** armazenar o segredo no **Supabase Vault** e referenciá-lo no job via `vault.decrypted_secrets`, removendo o valor literal do comando e rotacionando o segredo atual.
- **Benefícios esperados:** segredo fora de dumps/backups/painel; rotação futura sem editar o job.
- **Possível implementação técnica:** `select vault.create_secret('...', 'cron_secret');` e no job: `select net.http_post(..., headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')));` — via migration.
- **Dependências ou riscos:** validar permissão do role do cron sobre o Vault; testar um disparo manual antes do horário real.
- **Critérios de aceitação:** comando do job sem segredo literal; secret antigo rotacionado; lembrete de teste entregue com sucesso após a mudança.

#### S33 — Minimizar a exposição da liga semanal (`weekly_league_snapshots`)

> **Categoria:** Segurança · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** a policy `select ... using (true)` para `authenticated` permite que **qualquer usuário logado leia a tabela inteira** — todos os usernames, níveis e pontos, de todas as semanas, sem limite. É "by design" para exibir a liga, mas expõe mais colunas e mais linhas do que a UI precisa e permite scraping da base de usuários.
- **Solução proposta:** trocar o acesso direto por uma view/RPC que devolve apenas o necessário: colunas mínimas (username exibível, pontos, nível) da **semana corrente** e apenas da liga em que o usuário está; revogar o `select` amplo na tabela.
- **Benefícios esperados:** princípio do menor privilégio; enumeração de usuários deixa de ser trivial; sem mudança visível na UI.
- **Possível implementação técnica:** `create function get_current_league()` (`security definer`, filtrando pela semana atual e pelo grupo do chamador) + `drop policy` do select amplo; ajustar o único ponto de leitura no cliente.
- **Dependências ou riscos:** confirmar todos os consumidores atuais da tabela antes de revogar; testar com dois usuários em ligas diferentes (S87).
- **Critérios de aceitação:** usuário autenticado não consegue `select` direto na tabela; a UI da liga continua idêntica; RPC coberta por teste de isolamento.

#### S34 — Hardening das Edge Functions (`delete-account`, `send-reminders`)

> **Categoria:** Segurança · **Prioridade:** Crítica · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** as duas funções mais sensíveis do sistema — uma **apaga contas** (usa service role) e a outra dispara push em massa — não têm auditoria registrada de autenticação, autorização e rate limiting. Falha aqui é conta de terceiro apagada ou spam de notificações.
- **Solução proposta:** auditar e reforçar: `delete-account` deve validar o JWT do chamador e apagar **somente** `auth.uid()` do token (nunca aceitar user_id do body); `send-reminders` deve exigir o `CRON_SECRET` (do Vault, S32) em comparação constant-time; ambas com rate limit e logs estruturados.
- **Benefícios esperados:** elimina os dois piores cenários de abuso da superfície server-side do app.
- **Possível implementação técnica:** em `delete-account`: `const { data: { user } } = await supabaseAdmin.auth.getUser(jwt)` e derivar o alvo exclusivamente de `user.id`; testes de contorno (JWT ausente/expirado/de outro user → 401/403); deploy via `supabase functions deploy` no CI (S81).
- **Dependências ou riscos:** nenhuma dependência externa; risco de regressão baixo com testes.
- **Critérios de aceitação:** chamadas sem JWT válido retornam 401; JWT válido só apaga a própria conta; `send-reminders` rejeita chamadas sem o secret; testes automatizados cobrindo os 4 cenários.

#### S35 — Headers de segurança HTTP (CSP, HSTS, frame-ancestors)

> **Categoria:** Segurança · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o app não define headers de segurança — sem CSP (mitigação de XSS, relevante porque o layout usa `dangerouslySetInnerHTML` para o script de tema), sem `X-Frame-Options`/`frame-ancestors` (clickjacking), sem HSTS explícito.
- **Solução proposta:** configurar `headers()` no `next.config.mjs`: CSP com allowlist mínima (self + domínio do Supabase em `connect-src`; `script-src 'self'` + hash/nonce do script de tema), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS.
- **Benefícios esperados:** defesa em profundidade contra XSS/clickjacking; requisito comum de revisões de segurança para lançamento.
- **Possível implementação técnica:** começar com `Content-Security-Policy-Report-Only` + endpoint de report para calibrar sem quebrar (fontes self-hosted via S23 simplificam muito a CSP); depois promover a enforce.
- **Dependências ou riscos:** CSP mal calibrada quebra o app — por isso a fase report-only; o `@import` de fontes atual (pré-S23) exigiria liberar domínios do Google.
- **Critérios de aceitação:** securityheaders.com nota A; console sem violações de CSP nas 9 telas principais; script de tema funcionando via hash/nonce.

#### S36 — Endurecer o pipeline de importação de arquivos (PDF/CSV/planilha)

> **Categoria:** Segurança · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** `pdf.ts`, `csv-parser.ts` e `spreadsheet.ts` processam arquivos arbitrários do usuário no browser sem limites declarados de tamanho/linhas, e valores importados chegam ao banco sem validação de schema (o histórico de mojibake — `fix_mojibake_v1.sql` — mostra que entrada suja já corrompeu dados). Exportar CSV no futuro sem escape abriria CSV injection no Excel.
- **Solução proposta:** validação estrita na fronteira: limite de tamanho (ex.: 10 MB) e de linhas, schema Zod por candidato importado (data válida, valor numérico finito, descrição normalizada NFC com limite de caracteres), rejeição de fórmulas (`=`, `+`, `-`, `@` iniciais) em campos texto e escape na exportação (S56).
- **Benefícios esperados:** fim da corrupção de dados por encoding; imports previsíveis; exportações seguras.
- **Possível implementação técnica:** `const CandidateSchema = z.object({ date: z.string().date(), amount: z.number().finite(), description: z.string().trim().max(200).transform(s => s.normalize('NFC')) })`; aplicar em `ImportPreview` antes do insert em lote; fixtures de arquivos malformados nos testes (S88).
- **Dependências ou riscos:** nenhum relevante; falsos rejeitados devem ter mensagem clara linha a linha no preview.
- **Critérios de aceitação:** arquivo > limite é rejeitado com mensagem; linha inválida aparece marcada no preview sem abortar o lote; teste com fixture de encoding quebrado não insere mojibake.

#### S37 — Reforçar autenticação: proteção contra senhas vazadas e MFA opcional

> **Categoria:** Segurança · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o auth é email+senha simples; o projeto não tem registrado o uso das proteções nativas do Supabase — checagem de senhas vazadas (HaveIBeenPwned), requisitos de força, MFA TOTP — deixando contas (com dados financeiros e de saúde) protegidas apenas pela higiene de senha do usuário.
- **Solução proposta:** habilitar *leaked password protection* e requisitos mínimos no painel de Auth; oferecer MFA TOTP opcional no perfil; revisar expiração/rotação de refresh tokens.
- **Benefícios esperados:** proteção significativa de conta a custo quase zero de implementação.
- **Possível implementação técnica:** configuração no Dashboard (documentar em `SUPABASE_AUTH_CONFIG.md`); UI de MFA com `supabase.auth.mfa.enroll({ factorType: 'totp' })` + tela de challenge no login.
- **Dependências ou riscos:** MFA adiciona fluxo de recuperação (códigos de backup) — escopo pequeno mas necessário; senha vazada bloqueia alguns cadastros (comportamento desejado).
- **Critérios de aceitação:** cadastro com senha constante em vazamentos é recusado com mensagem clara; usuário consegue ativar TOTP e o login passa a exigir o código; processo documentado.

#### S38 — Auditoria contínua de dependências (Dependabot/Renovate + npm audit)

> **Categoria:** Segurança · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** `next-pwa@5.6.0` traz árvore workbox antiga com findings conhecidos de `npm audit` (registrado no débito técnico), e não há processo para novas CVEs — dependências só são olhadas quando algo quebra.
- **Solução proposta:** ativar Renovate (ou Dependabot) com agrupamento semanal + `npm audit --audit-level=high` como gate no CI; tratar o upgrade/substituição do `next-pwa` (ligado à decisão do S16) como primeiro item do processo — avaliar `@serwist/next` como sucessor mantido.
- **Benefícios esperados:** CVEs chegam como PR automático testado pelo CI, não como surpresa; débito de versão para de acumular.
- **Possível implementação técnica:** `renovate.json` com `extends: ['config:recommended']`, agrupamento de minors, schedule semanal; job de audit no workflow do S79.
- **Dependências ou riscos:** depende do CI para ser seguro (merge de bump sem testes é troca de risco); ruído de PRs — mitigado pelo agrupamento.
- **Critérios de aceitação:** Renovate abrindo PRs agrupados; CI falha com vulnerabilidade high/critical em dependência de produção; plano registrado para o sucessor do `next-pwa`.

### 3.6 Acessibilidade

#### S39 — Desbloquear o zoom (remover `userScalable: false`)

> **Categoria:** Acessibilidade · **Prioridade:** Crítica · **Impacto:** Alto · **Esforço:** Pequeno

- **Problema identificado:** `layout.tsx` define `maximumScale: 1, userScalable: false` — usuários de baixa visão não conseguem dar pinch-zoom em lugar nenhum do app. Violação direta do WCAG 1.4.4 (Resize Text, nível AA), e o iOS moderno inclusive ignora a diretiva de formas inconsistentes.
- **Solução proposta:** remover as duas propriedades do `viewport` (manter `width: 'device-width', initialScale: 1`). Onde a motivação era evitar zoom-no-foco do iOS, usar `font-size ≥ 16px` nos inputs — que é a correção correta.
- **Benefícios esperados:** conformidade AA no critério mais visível; app utilizável para baixa visão.
- **Possível implementação técnica:** diff de 2 linhas em `layout.tsx`; auditar inputs com fonte < 16 px (causa clássica do "zoom indesejado" que leva a esse bloqueio).
- **Dependências ou riscos:** iOS pode dar zoom ao focar inputs pequenos — corrigir via tamanho de fonte, não re-bloqueando.
- **Critérios de aceitação:** pinch-zoom funciona em todas as telas no iOS e Android; nenhum input dispara zoom automático ao focar; Lighthouse a11y sem o aviso de viewport.

#### S40 — Conformidade de contraste AA em ambos os temas

> **Categoria:** Acessibilidade · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** tokens como `--text3: #5A6070` sobre `--bg0: #0D0F14` (~3,4:1) são usados em textos informativos — abaixo dos 4,5:1 do WCAG AA; o dourado `#E8A838` como texto sobre superfícies claras no modo claro também é limítrofe. Não há verificação sistemática.
- **Solução proposta:** tratar contraste como propriedade dos tokens: tabela de pares aprovados (texto × fundo) validada por script, ajustando os valores-fonte em `globals.css`; reservar `--text3` para elementos decorativos, nunca para informação.
- **Benefícios esperados:** legibilidade real em sol/telas ruins; conformidade auditável e estável (novas telas herdam tokens corretos).
- **Possível implementação técnica:** script Node que parseia os tokens e calcula razões (fórmula WCAG) falhando o CI se um par aprovado regride; integrar com a varredura axe do S10.
- **Dependências ou riscos:** ajustar `--text3` muda o visual de várias telas — validar com screenshots (S90).
- **Critérios de aceitação:** todos os textos informativos ≥ 4,5:1 e UI essencial ≥ 3:1 nos dois temas; script de tokens no CI; zero violações axe de contraste nas telas principais.

#### S41 — Navegação por teclado e focus management nos componentes interativos

> **Categoria:** Acessibilidade · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** os componentes de sobreposição (`BottomSheet`, `ConfirmDialog`, modais de badge/level-up) não implementam focus trap, retorno de foco ao fechar nem fechamento por `Esc`; `:focus-visible` não é estilizado consistentemente — o app é praticamente inoperável por teclado.
- **Solução proposta:** padronizar todos os overlays sobre uma base acessível (`role="dialog"`, `aria-modal`, trap de foco, `Esc`, retorno de foco ao elemento de origem) e garantir anel de foco visível global.
- **Benefícios esperados:** operabilidade por teclado/switch; base para leitores de tela (S42); requisito de WCAG 2.1.2 (No Keyboard Trap) e 2.4.7 (Focus Visible).
- **Possível implementação técnica:** ou o elemento nativo `<dialog>` + `showModal()` (trap e Esc de graça), ou headless (`@radix-ui/react-dialog`) como base de `BottomSheet`/`ConfirmDialog`; token de foco em `globals.css` (`:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px }`).
- **Dependências ou riscos:** trocar a base dos sheets toca várias telas — fazer atrás da mesma API de props para diff mínimo.
- **Critérios de aceitação:** Tab nunca escapa de um modal aberto; `Esc` fecha e o foco volta ao gatilho; percorrer `/hoje` inteiro só com teclado permite marcar um hábito.

#### S42 — Semântica ARIA em tabs, listas de progresso e gráficos

> **Categoria:** Acessibilidade · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** as tabs de `/corpo` (Treino/Dieta/Peso) são botões sem `role="tablist"`; barras de progresso (XP, ritmo, orçamento) são divs sem `role="progressbar"`; gráficos Recharts são SVGs mudos para leitores de tela.
- **Solução proposta:** aplicar padrões WAI-ARIA: tablist/tab/tabpanel com navegação por setas; `role="progressbar"` + `aria-valuenow/min/max` nas barras; gráficos com `aria-label` resumindo a informação ("Peso: 82,4 kg, tendência de queda de 0,5 kg em 30 dias") e tabela de dados alternativa acessível.
- **Benefícios esperados:** usuários de leitor de tela conseguem consumir o núcleo do produto (progresso) e não apenas navegar às cegas.
- **Possível implementação técnica:** componente `ui/Tabs` acessível (S11) reutilizado em Corpo/Finanças; helper `describeSeries(data)` gerando o resumo textual dos gráficos a partir dos mesmos dados.
- **Dependências ou riscos:** melhor após S11 para não implementar tabs duas vezes.
- **Critérios de aceitação:** VoiceOver/TalkBack anuncia tabs com posição e estado; barras anunciam valor atual; cada gráfico tem descrição textual ou tabela alternativa.

#### S43 — Respeitar `prefers-reduced-motion` (animações e vibração)

> **Categoria:** Acessibilidade · **Prioridade:** Média · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** celebrações (level-up, badges), transições de sheets e a vibração do push (`vibrate: [80,40,80]` em `worker/index.js`) ignoram a preferência de movimento reduzido — problema real para usuários com desordens vestibulares.
- **Solução proposta:** media query global que zera transições/animações não essenciais quando `prefers-reduced-motion: reduce`, celebrações substituídas por fade estático, e vibração condicionada a uma preferência do usuário.
- **Benefícios esperados:** conforto para usuários sensíveis a movimento; conformidade WCAG 2.3.3.
- **Possível implementação técnica:** `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important } }` + checagens pontuais nas celebrações JS; flag `reduce_motion`/`haptics` em `reading_preferences`/perfil.
- **Dependências ou riscos:** nenhum; integrar ao vocabulário de motion do S15.
- **Critérios de aceitação:** com a preferência ativa no SO, nenhuma animação de entrada/celebração é reproduzida; push chega sem vibração quando desativada.

#### S44 — Formulários acessíveis (labels, erros anunciados, autocomplete)

> **Categoria:** Acessibilidade · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** formulários (auth, transações, peso, lembretes) usam placeholder como rótulo em vários pontos, erros aparecem só como toast desconectado do campo, e faltam `autocomplete`/`inputmode` (teclado numérico para valores, e-mail para login).
- **Solução proposta:** padrão único de campo via `ui/Field` (S11): `<label>` visível associada, erro inline com `aria-describedby` + `aria-invalid`, `autocomplete="email|current-password|new-password"`, `inputmode="decimal"` para valores monetários e peso.
- **Benefícios esperados:** menos erro de digitação, autofill/gerenciadores de senha funcionando, leitores de tela anunciando erros no contexto certo.
- **Possível implementação técnica:** componente `Field` encapsulando id/label/erro; migrar `/auth` primeiro (maior impacto), depois formulários de finanças/corpo.
- **Dependências ou riscos:** depende do S11; risco baixo.
- **Critérios de aceitação:** todo input tem label programaticamente associada; erro de validação é anunciado pelo leitor de tela e referenciado pelo campo; iOS mostra teclado decimal nos campos de valor.

#### S45 — Alvos de toque e alternativa não-gestual ao swipe

> **Categoria:** Acessibilidade · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** `SwipeRow` é o único caminho para ações de linha (concluir/apagar) em listas — gesto invisível para quem não o conhece e inacessível por teclado/leitor de tela; ícones de ação pequenos podem ficar abaixo de 44×44 px.
- **Solução proposta:** toda ação de swipe ganha equivalente visível: menu de overflow (⋯) na linha com as mesmas ações, e auditoria de alvos para mínimo 44×44 px (WCAG 2.5.8 e HIG).
- **Benefícios esperados:** ações descobríveis e operáveis por qualquer modalidade de entrada; menos "não sabia que dava pra apagar".
- **Possível implementação técnica:** prop `actions` do `SwipeRow` renderizada também num `ui/Menu` acessível; utilitário de hit-area (`min-height/width: 44px` ou padding expandido) nos ícones de ação.
- **Dependências ou riscos:** menu por linha adiciona ruído visual — usar ⋯ discreto; nenhum outro.
- **Critérios de aceitação:** todas as ações de swipe acessíveis via menu por teclado; nenhum alvo interativo < 44 px nas telas principais; teste com TalkBack conclui e apaga um lembrete.

### 3.7 Arquitetura e qualidade do código

#### S46 — Modularizar `lib/supabase.ts` em repositórios por domínio

> **Categoria:** Arquitetura · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** `lib/supabase.ts` (1.168 linhas) concentra o acesso a dados de todos os domínios — hábitos, finanças, corpo, leitura, gamificação — mais o cliente, guarda de auth e até emissão de toasts. Todo PR relevante passa por ele (conflitos), e é impossível testar um domínio isoladamente.
- **Solução proposta:** dividir em `lib/data/{client,habits,finance,body,reading,program,gamification,reminders}.ts`, cada módulo exportando funções puras de acesso que recebem/retornam tipos do domínio; `client.ts` fica com o singleton e `requireUser`. Toasts saem da camada de dados (papel da UI, ver S22).
- **Benefícios esperados:** módulos de 100–200 linhas testáveis; conflitos de merge caem; pré-requisito estrutural de S25, S01, S07 e S22.
- **Possível implementação técnica:** migração mecânica por domínio (mover função + atualizar imports), preservando assinaturas para diff mínimo; `lib/supabase.ts` vira re-export deprecado até o último consumidor migrar, depois é removido.
- **Dependências ou riscos:** refactor amplo mas mecânico; regra: nenhum comportamento muda nesta etapa (mudanças de contrato ficam para S22/S48).
- **Critérios de aceitação:** nenhum arquivo em `lib/data/` acima de 300 linhas; `lib/supabase.ts` removido; typecheck/testes verdes; nenhuma página importa o cliente bruto diretamente para queries.

#### S47 — Decompor os componentes gigantes do módulo Corpo e Finanças

> **Categoria:** Arquitetura · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** `WorkoutTracker.tsx` (1.554 linhas), `DietTracker.tsx` (1.065), `financas/page.tsx` (2.433) misturam fetch, regras, estado e apresentação num arquivo só — revisar um PR nesses arquivos é lento e arriscado, e reuso é impossível.
- **Solução proposta:** padrão consistente por feature: hook de dados (`useWorkoutSession`) + subcomponentes de apresentação (`ExerciseCard`, `RestTimer`, `SetRow`…) ≤ 300 linhas cada; regras que hoje vivem no JSX migram para `lib/` puro com teste (como já é feito em `workout-tracker-helpers`).
- **Benefícios esperados:** velocidade de review e de evolução; testabilidade unitária real; o padrão vira referência para features novas.
- **Possível implementação técnica:** começar pelo `WorkoutTracker` (maior dor + base do S20/S61): extrair primeiro os helpers puros, depois subcomponentes folha, por último o hook de dados; ESLint `max-lines` (ex.: 400, warn) para conter reincidência.
- **Dependências ou riscos:** sinergia com S12 (finanças) e S28 (splitting); risco de regressão mitigado por screenshots (S90) e E2E (S86).
- **Critérios de aceitação:** nenhum componente > 500 linhas nos módulos refatorados; helpers extraídos com testes; comportamento idêntico validado por checklist/E2E.

#### S48 — Gerar tipos TypeScript do schema do Supabase

> **Categoria:** Arquitetura · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** os tipos de `src/types/index.ts` são mantidos à mão e podem divergir do schema real (38 tabelas) — colunas novas não aparecem no autocomplete e typos de nome de tabela/coluna só explodem em runtime (e são engolidos, S22).
- **Solução proposta:** gerar `src/types/database.ts` com `supabase gen types typescript` a partir do projeto/migrations, tipar o cliente (`createBrowserClient<Database>`) e verificar drift no CI.
- **Benefícios esperados:** autocomplete e erro de compilação para toda query; o schema versionado vira contrato executável.
- **Possível implementação técnica:** script `npm run gen:types` (CLI ou MCP `generate_typescript_types`); job de CI que regenera e falha se `git diff` não estiver limpo; migrar tipos manuais gradualmente para aliases dos gerados (`type Habit = Tables<'habits'>`).
- **Dependências ou riscos:** exige migrations em dia (já garantido pelo processo do repo); tipos gerados podem revelar divergências existentes — corrigi-las é parte do valor.
- **Critérios de aceitação:** cliente tipado em toda a camada de dados; typo de coluna falha o typecheck; CI acusa drift entre schema e tipos.

#### S49 — Contrato de erro unificado na camada de dados (Result pattern)

> **Categoria:** Arquitetura · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** funções de dados ora retornam `null`, ora array vazio, ora só logam — o chamador não distingue "não existe" de "falhou" (ex.: RLS negando leitura parece lista vazia, exatamente o modo de falha do S17).
- **Solução proposta:** todas as funções de `lib/data/` retornam `Result<T>` discriminado, com `AppError` classificado (`network | auth | rls | validation | unknown`), e a UI trata cada classe de forma padronizada.
- **Benefícios esperados:** fim das falhas indistinguíveis de vazio; telemetria de erro classificada (S76); código de UI mais simples (um handler por classe).
- **Possível implementação técnica:** wrapper `run(qb)` que converte a resposta do supabase-js (`error.code`, `status`) em `AppError`; exhaustive check no `switch` das classes garante tratamento completo.
- **Dependências ou riscos:** aplicar durante o S46 (mesma passada); risco baixo.
- **Critérios de aceitação:** 100 % das funções de `lib/data/` com `Result`; caso de RLS negada aparece como erro visível (não lista vazia) num teste de componente.

#### S50 — Validação de runtime com Zod nas fronteiras do sistema

> **Categoria:** Arquitetura · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** dados externos entram sem validação: arquivos importados (S36), `localStorage` (drafts de onboarding, cargas — um JSON corrompido quebra a tela), payloads de push e respostas de RPC são consumidos com type assertion.
- **Solução proposta:** schemas Zod nas quatro fronteiras (arquivos, storage local, push, RPC), com parse seguro (`safeParse`) e fallback definido para cada uma.
- **Benefícios esperados:** o tipo estático passa a ser garantido em runtime exatamente onde ele costuma mentir; bugs de "tela branca por dado velho no localStorage" desaparecem.
- **Possível implementação técnica:** `lib/schemas/` por fronteira; helper `readLocal(key, schema, fallback)` substitui `JSON.parse(localStorage.getItem(...))`; RPCs agregadas (S26) validam o JSON retornado.
- **Dependências ou riscos:** ~2 kB de lib; overhead de parse desprezível nos volumes do app.
- **Critérios de aceitação:** nenhuma leitura direta de `localStorage` sem schema (lint/grep); draft corrompido de onboarding cai no fallback sem quebrar a página; fixtures inválidas rejeitadas nos testes.

#### S51 — Mover leituras iniciais para Server Components onde houver ganho

> **Categoria:** Arquitetura · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** a infraestrutura de sessão server-side já existe (middleware + `supabase-server.ts` + cookies via `@supabase/ssr`), mas as páginas são 100 % client — o usuário baixa JS, hidrata, e só então começa o fetch: três viagens antes do primeiro dado na tela.
- **Solução proposta:** para telas read-heavy (`/progresso`, `/programa`, parte estática de `/hoje`), buscar os dados iniciais no Server Component e passar como props/`initialData` ao client (interações continuam client-side com S25).
- **Benefícios esperados:** primeiro paint já com dados (grande em mobile); menos JS de fetch no cliente; caminho preparado para streaming/Suspense.
- **Possível implementação técnica:** `page.tsx` (server) usa `createServerClient` de `supabase-server.ts` + `Promise.all` dos repositórios (S46, que devem aceitar um client injetado); `initialData` do TanStack Query evita duplo fetch.
- **Dependências ou riscos:** depende de S46 (injeção de client) e idealmente S25; atenção a cache do App Router com dados por usuário (`export const dynamic = 'force-dynamic'` onde preciso).
- **Critérios de aceitação:** `/progresso` renderiza dados no HTML inicial (visível com JS desabilitado); TTFB→conteúdo medido cai na tela migrada; sem flash de troca de dados na hidratação.

#### S52 — Endurecer ESLint + adotar Prettier

> **Categoria:** Arquitetura · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** a config atual é só `next/core-web-vitals`; não há Prettier — formatação e padrões variam por arquivo, e regras que preveniriam problemas recorrentes do próprio repo (catch vazio, arquivos de 2 mil linhas, `style` inline, imports desordenados) não existem.
- **Solução proposta:** adicionar `typescript-eslint` (recommended-type-checked nos módulos novos), `eslint-plugin-import` (ordem), `no-empty` com exceção explícita, `max-lines` (warn 400), `react/forbid-dom-props` para `style` (warn, ver S09); Prettier com config padrão no CI.
- **Benefícios esperados:** classes inteiras de problema barradas na máquina; reviews focam em lógica, não estilo.
- **Possível implementação técnica:** um commit único de formatação (`prettier --write .`) isolado para não poluir blame (`.git-blame-ignore-revs`); novas regras como `warn` primeiro, `error` após zerar.
- **Dependências ou riscos:** commit de formatação grande — coordenar com PRs abertos; nenhum risco técnico.
- **Critérios de aceitação:** `npm run lint` cobre as regras novas; CI falha em formatação divergente; contagem de warnings monitorada e decrescente.

#### S53 — Substituir o barramento de eventos `window` dos toasts por Context

> **Categoria:** Arquitetura · **Prioridade:** Baixa · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** convivem dois mecanismos de toast: o `ToastProvider` (Context) e `lib/toast-events.ts` emitindo `CustomEvent` no `window` para que a camada de dados dispare toasts — acoplamento invisível, impossível de testar sem DOM e fora do modelo React.
- **Solução proposta:** com S22/S49, a camada de dados para de emitir toasts (retorna `Result`); `toast-events.ts` é removido e a UI usa apenas o Context.
- **Benefícios esperados:** um único fluxo de notificação, testável; camada de dados livre de efeitos de UI.
- **Possível implementação técnica:** consequência natural do S22 — remover `emitToast` dos repositórios, apagar o módulo e o listener no `Toast.tsx`.
- **Dependências ou riscos:** depende de S22/S46 terem migrado os call sites; risco nulo depois disso.
- **Critérios de aceitação:** `lib/toast-events.ts` removido; nenhum `dispatchEvent`/`addEventListener` de toast no código; toasts continuam funcionando em todos os fluxos.

### 3.8 Novas funcionalidades

#### S54 — Revisão semanal guiada

> **Categoria:** Funcionalidades · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o app mede a semana (`lib/weekly.ts`, liga, `WeeklyDashboard`) mas não tem o ritual que fecha o loop de melhoria: o usuário não é convidado a olhar a semana, tirar conclusões e ajustar a próxima — o check-in é só diário.
- **Solução proposta:** fluxo "Revisão da semana" (domingo à noite/segunda de manhã, com push): resumo automático (hábitos %, treinos, gasto vs orçamento, páginas lidas, evolução na liga) + 2–3 perguntas reflexivas + um ajuste sugerido (ex.: reduzir meta de hábito com aderência < 40 %).
- **Benefícios esperados:** retenção semanal (razão recorrente para voltar); ponte natural para o resumo por IA (S73).
- **Possível implementação técnica:** rota `/revisao` com engine puro `buildWeeklyReview(dados)` em `lib/` (testável); respostas gravadas em tabela `weekly_reviews`; agendamento via infraestrutura de lembretes existente.
- **Dependências ou riscos:** os agregados devem vir de RPC (S26/S29) para não baixar a semana inteira; escopo de perguntas curto para não virar formulário chato.
- **Critérios de aceitação:** push de domingo abre a revisão preenchida com os números da semana; concluir a revisão grava o registro e aplica o ajuste aceito; engine coberto por testes.

#### S55 — Agenda do dia por horário e empilhamento de hábitos (habit stacking)

> **Categoria:** Funcionalidades · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** a tela Hoje lista hábitos/tarefas como checklist plano, sem noção de "quando" — não há como ancorar hábito a um horário ou a outro hábito ("depois do café, ler 10 páginas"), técnica com forte evidência comportamental.
- **Solução proposta:** campo opcional de âncora no hábito (horário aproximado ou hábito-pai) e visão do Hoje agrupada por bloco (manhã/tarde/noite já existem no check-in), com pushes no horário da âncora.
- **Benefícios esperados:** taxa de conclusão maior (gatilhos contextuais); o Hoje vira roteiro do dia, não lista de culpa.
- **Possível implementação técnica:** colunas `anchor_time`/`anchor_habit_id` em `habits` (migration); `day-planner.ts` (já existe) passa a ordenar/agrupar por âncora; reuso do pipeline de push por horário (`notifications_push_v4_habitos.sql` já cobre hábitos).
- **Dependências ou riscos:** ancoragem circular (A depois de B depois de A) — validar no save; manter âncora opcional para não burocratizar.
- **Critérios de aceitação:** hábito ancorado aparece no bloco certo do Hoje e dispara push no horário; encadear a outro hábito o posiciona logo após o pai; ciclos são rejeitados com mensagem.

#### S56 — Exportação completa de dados do usuário (JSON/CSV)

> **Categoria:** Funcionalidades · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** o usuário não tem como extrair seus dados (anos de hábitos, finanças, peso, leituras). Além de aprisionar o usuário, a portabilidade é direito previsto na LGPD (art. 18) — e o app já tem delete de conta, mas não export.
- **Solução proposta:** em Perfil, "Exportar meus dados": JSON completo por domínio + CSVs das séries principais (transações, pesos, logs de hábito), gerados sob demanda.
- **Benefícios esperados:** confiança ("meus dados são meus"), conformidade LGPD, e habilita análises externas pelo próprio usuário.
- **Possível implementação técnica:** Edge Function `export-account` (espelho da `delete-account`, mesma auth do S34) que consulta as tabelas do usuário e retorna um zip (JSON + CSVs com escape anti-injection do S36); no cliente, download via blob.
- **Dependências ou riscos:** volume alto → gerar por streaming ou limitar a 1 export/hora; nunca incluir dados de outros usuários (liga) no dump.
- **Critérios de aceitação:** export baixa zip com todos os domínios do usuário autenticado e nada além; abrir os CSVs no Excel não executa fórmulas; operação auditada em log.

#### S57 — Orçamento por categoria com alertas (concluir o que o schema já suporta)

> **Categoria:** Funcionalidades · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o schema de orçamentos já existe (`financas_budgets_v1.sql`) e a UI mostra orçamento, mas não há o comportamento que gera valor: alerta ao se aproximar/estourar o limite da categoria — o usuário só descobre o estouro olhando depois.
- **Solução proposta:** limites por categoria/mês com estados visuais (ok/atenção ≥ 80 %/estourado) e push no cruzamento de faixa ("Alimentação atingiu 80 % do orçamento com 10 dias restantes").
- **Benefícios esperados:** o módulo de finanças passa de registro passivo a ferramenta ativa de controle — feature clássica de retenção.
- **Possível implementação técnica:** o gatilho de faixa pode ser calculado no fluxo do `send-reminders` (job diário já existe) comparando gasto acumulado × limite; estado visual derivado no cliente com dados que a tela já tem; deduplicar alerta por categoria/mês (tabela `budget_alerts`).
- **Dependências ou riscos:** precisão depende de categorização consistente (S70 ajuda); melhor sobre a UI reestruturada do S12.
- **Critérios de aceitação:** definir limite, registrar gasto que cruza 80 % → push único recebido; barra da categoria muda de cor nos limiares; sem alertas duplicados no mesmo mês.

#### S58 — Atalhos de PWA e Share Target

> **Categoria:** Funcionalidades · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** o `manifest.json` não define `shortcuts` (long-press no ícone) nem `share_target` — registrar uma transação exige abrir o app e navegar, e não dá para "compartilhar" um comprovante/print para dentro do NEXUS.
- **Solução proposta:** shortcuts para as 3 ações de maior frequência ("Check-in", "Nova transação", "Registrar peso") e `share_target` recebendo texto/imagem que pré-preenche uma transação (com S72, extração automática do valor no futuro).
- **Benefícios esperados:** fricção de registro cai (o maior preditor de retenção em trackers); o PWA se comporta como app nativo.
- **Possível implementação técnica:** `shortcuts: [{ name: 'Nova transação', url: '/financas?new=1' }...]` no manifest; `share_target` POST → rota `/share` que interpreta `title/text/files` e abre o formulário pré-preenchido.
- **Dependências ou riscos:** suporte de `share_target` varia (Android/Chrome ok, iOS limitado) — tratar como progressive enhancement.
- **Critérios de aceitação:** long-press no ícone (Android) mostra os 3 atalhos funcionais; compartilhar um texto com valor abre o form de transação preenchido.

#### S59 — Desafios entre amigos na liga semanal

> **Categoria:** Funcionalidades · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Grande

- **Problema identificado:** a liga semanal já ranqueia usuários (infra multi-user pronta), mas não há vínculo social real — competir com estranhos anônimos motiva pouco; accountability entre conhecidos é o mecanismo comprovado.
- **Solução proposta:** convites por link para "duelo semanal" ou mini-liga privada (2–10 pessoas) sobre a mesma pontuação já calculada, com push de virada ("Ana te ultrapassou").
- **Benefícios esperados:** loop de retenção social + aquisição orgânica (convite traz usuário novo).
- **Possível implementação técnica:** tabelas `friend_links`/`private_leagues` com RLS cuidadosa (só membros veem o grupo, ver S33 como modelo); entrada por deep link com token; pontuação reutiliza o snapshot semanal existente.
- **Dependências ou riscos:** privacidade é o risco central — projetar RLS junto com S87; moderação de nomes exibidos.
- **Critérios de aceitação:** convite por link cria o grupo e o convidado entra após cadastro; membros veem só o próprio grupo (teste de isolamento); push de virada entregue.

#### S60 — Metas conectadas a hábitos com progresso automático

> **Categoria:** Funcionalidades · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** objetivos de 90 dias (`goal_milestones`) vivem paralelos aos hábitos: o usuário define "correr 100 km no trimestre" mas o progresso é manual, mesmo quando os dados já entram no app (treinos, leituras, economia).
- **Solução proposta:** metas mensuráveis vinculadas a fontes automáticas: hábito (contagem de conclusões), corpo (treinos/peso), leitura (páginas), finanças (aporte na reserva) — o progresso atualiza sozinho e o milestone comemora ao cruzar.
- **Benefícios esperados:** objetivos deixam de "morrer esquecidos"; conecta os módulos entre si (valor único do app all-in-one).
- **Possível implementação técnica:** colunas `metric_source`/`metric_target` em objetivos; função `computeGoalProgress` em `lib/goal-milestones.ts` agregando da fonte via RPC; recomputo no load da tela + no fluxo diário do job.
- **Dependências ou riscos:** precisa das agregações eficientes (S26/S29); fontes limitadas no MVP (hábito + páginas + treinos) para não explodir escopo.
- **Critérios de aceitação:** criar meta "ler 500 páginas" e registrar leitura atualiza a barra sem ação manual; cruzar milestone dispara celebração/XP; engine testado.

#### S61 — Análise de progressão de treino (volume, PRs, tendências)

> **Categoria:** Funcionalidades · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o usuário registra séries/cargas fielmente, mas o app não devolve nada além do registro — sem volume semanal, sem recordes pessoais, sem tendência por exercício. O dado mais rico do módulo Corpo está inerte.
- **Solução proposta:** aba "Progresso" no Corpo: volume semanal (séries × carga × reps), PRs por exercício com celebração no momento do recorde, gráfico de tendência por exercício e comparativo com a semana anterior.
- **Benefícios esperados:** recompensa intrínseca poderosa (ver o PR no momento em que acontece) — diferencial frente a trackers genéricos.
- **Possível implementação técnica:** depende de S20 (cargas no banco); `lib/workout-stats.ts` puro e testado computando volume/PR/e1RM (fórmula de Epley) sobre `workout_set_logs`; gráficos com o mesmo padrão dinâmico do S24.
- **Dependências ou riscos:** S20 é pré-requisito absoluto; dados legados incompletos → mostrar tendências só a partir do histórico migrado.
- **Critérios de aceitação:** registrar série acima do recorde dispara badge/celebração "PR"; aba mostra volume das últimas 8 semanas por grupo; funções de cálculo com testes unitários.

#### S62 — Suporte a EPUB no e-reader

> **Categoria:** Funcionalidades · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Grande

- **Problema identificado:** o módulo de leitura (biblioteca, destaques, notas, marcadores, progresso) depende de conteúdo carregado em formato próprio — sem suporte ao formato universal (EPUB), a biblioteca do usuário não entra no app e o módulo fica limitado.
- **Solução proposta:** importar arquivos EPUB (upload → parse client-side → capítulos renderizados no reader atual), preservando destaques/notas/posição com a infraestrutura existente (`book_*`).
- **Benefícios esperados:** o e-reader vira utilizável com a biblioteca real do usuário — módulo passa de demo a ferramenta.
- **Possível implementação técnica:** `epub.js` para parse/renderização ou parser próprio (EPUB = zip + XHTML) alimentando o pipeline atual; armazenar o arquivo no Supabase Storage com RLS por usuário; ancorar destaques por CFI.
- **Dependências ou riscos:** DRM fora de escopo (só EPUBs livres); tipografia/temas do reader devem se aplicar ao conteúdo importado; storage tem custo — limitar tamanho/quantidade.
- **Critérios de aceitação:** upload de EPUB livre aparece na biblioteca e abre no reader com os temas atuais; destaque criado persiste e reabre na posição correta; arquivo inacessível a outros usuários (teste RLS).

### 3.9 Integrações com APIs e serviços externos

#### S63 — Conexão bancária via Open Finance (Pluggy/Belvo)

> **Categoria:** Integrações · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** o import financeiro depende de o usuário baixar extrato em PDF/CSV e passar pelo fluxo de upload — fricção alta e recorrente (todo mês), e a maior causa provável de dados financeiros desatualizados.
- **Solução proposta:** integração com um agregador Open Finance (Pluggy ou Belvo para o mercado brasileiro; GoCardless/Tink se o alvo incluir Europa) para sincronizar transações automaticamente após consentimento.
- **Benefícios esperados:** finanças sempre atualizadas sem esforço — transforma o módulo; o import manual vira fallback.
- **Possível implementação técnica:** Edge Function como backend do widget de conexão (as credenciais do agregador **nunca** vão ao cliente); job periódico puxa novidades e insere em `transactions` com dedupe por `external_id`; categorização automática na entrada (S70).
- **Dependências ou riscos:** custo por conexão/mês (avaliar no pricing); LGPD — consentimento explícito e revogável; sandbox dos agregadores para desenvolvimento.
- **Critérios de aceitação:** conectar conta sandbox sincroniza transações sem upload; novas transações aparecem em ≤ 24 h; desconectar remove o vínculo e interrompe a coleta.

#### S64 — Sincronização com Google Calendar

> **Categoria:** Integrações · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** `agenda_events` e lembretes vivem isolados no NEXUS; compromissos reais do usuário estão no Google Calendar — a agenda do app mostra um retrato incompleto do dia, minando a proposta do "Hoje" como roteiro único.
- **Solução proposta:** OAuth com escopo read-only de calendário: eventos do Google aparecem no `/calendario` e no Hoje (somente leitura no MVP); opcionalmente, exportar treinos/revisão semanal como eventos.
- **Benefícios esperados:** o Hoje passa a refletir o dia real; menos alternância de apps.
- **Possível implementação técnica:** fluxo OAuth PKCE + Edge Function para troca/refresh de tokens (guardados no Vault ou tabela cifrada, nunca no cliente); busca incremental com `syncToken` da Calendar API; merge client-side com eventos nativos.
- **Dependências ou riscos:** verificação do app no Google Cloud Console para produção; tokens = dado sensível (tratar no padrão do S34).
- **Critérios de aceitação:** conectar conta lista eventos do dia no Hoje e no calendário; desconectar revoga e limpa tokens; eventos do Google claramente distinguíveis dos nativos.

#### S65 — Peso e atividade via Health Connect / Apple Health

> **Categoria:** Integrações · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Grande

- **Problema identificado:** peso e treinos são digitados à mão enquanto balanças smart e relógios já registram tudo em Health Connect (Android) / HealthKit (iOS) — dupla digitação e histórico incompleto no módulo Corpo.
- **Solução proposta:** importar peso (e opcionalmente treinos/passos) das plataformas de saúde. Como PWA não acessa HealthKit, a rota viável é: Android via Health Connect (quando exposto ao web/TWA) e, no iOS, atalho registrado via Shortcuts/companion mínimo — ou reposicionar como integração futura do app nativo.
- **Benefícios esperados:** dados de corpo completos sem digitação; gráficos de peso (já prontos) ganham densidade.
- **Possível implementação técnica:** MVP pragmático: endpoint autenticado de ingestão (`POST /ingest/weight` via Edge Function com token pessoal) + Atalho iOS/Tasker que envia a pesagem — funciona hoje sem app nativo.
- **Dependências ou riscos:** limitação real de plataforma para PWA (expectativa deve ser gerida); token pessoal com escopo mínimo e revogável.
- **Critérios de aceitação:** pesagem enviada pelo atalho aparece em `body_measurements` com origem marcada; token revogável no perfil; documentação do atalho para o usuário.

#### S66 — Bot de Telegram para registro rápido e lembretes

> **Categoria:** Integrações · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** parte dos registros se perde porque abrir o PWA tem fricção; push web no iOS ainda é frágil dependendo de instalação correta — um canal conversacional cobriria registro e notificação onde o usuário já está.
- **Solução proposta:** bot de Telegram vinculado à conta: "peso 82.4", "gasto 35 mercado", "feito leitura" registram diretamente; lembretes críticos também chegam pelo bot como fallback do push.
- **Benefícios esperados:** captura em 3 segundos de qualquer contexto; canal de notificação resiliente.
- **Possível implementação técnica:** Edge Function como webhook do bot; vínculo por código único gerado no perfil (tabela `telegram_links` com RLS); parser de comandos simples reusando `suggestCategory`/validações; com S74, o mesmo canal vira conversa com IA.
- **Dependências ou riscos:** superfície de segurança nova — validar `secret_token` do webhook e nunca aceitar comandos de chat não vinculado; escopo de comandos curto no MVP.
- **Critérios de aceitação:** vincular conta via código funciona; "gasto 35 mercado" cria transação categorizada; mensagem de chat desconhecido é ignorada e logada.

#### S67 — Metadados e capas de livros via Google Books/Open Library

> **Categoria:** Integrações · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** cadastrar livro na biblioteca é manual (título, autor, páginas digitados) e sem capa — biblioteca visualmente pobre e cadastro com fricção.
- **Solução proposta:** busca por título/ISBN na Open Library (sem chave, sem limite prático) com fallback Google Books: um toque preenche título, autor, páginas e capa.
- **Benefícios esperados:** cadastro em segundos; biblioteca visual (capas) aumenta o apelo do módulo.
- **Possível implementação técnica:** `fetch('https://openlibrary.org/search.json?q=...&fields=title,author_name,number_of_pages_median,cover_i&limit=5')` direto do cliente (API pública, CORS ok — adicionar o domínio à CSP do S35); URL da capa persistida em `books.cover_url`.
- **Dependências ou riscos:** cobertura de títulos em português varia — manter edição manual como fallback; hotlink de capas da Open Library é permitido.
- **Critérios de aceitação:** buscar "O Poder do Hábito" preenche o formulário com capa; ISBN também funciona; sem resultado, o fluxo manual atual permanece intacto.

#### S68 — E-mail transacional como fallback de notificações (Resend)

> **Categoria:** Integrações · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** a entrega de Web Push é melhor-esforço: subscription expira, usuário limpa dados, iOS desinstala o SW — e lembretes críticos (revisão semanal, estouro de orçamento) simplesmente não chegam, sem fallback.
- **Solução proposta:** camada de e-mail (Resend ou Postmark) para dois usos: fallback quando o push falha/inexiste e o resumo semanal por e-mail (S54/S73), com preferências por tipo no perfil.
- **Benefícios esperados:** nenhum evento importante se perde; e-mail semanal é canal clássico de reativação.
- **Possível implementação técnica:** na `send-reminders`, se `push_subscriptions` vazio ou envio falhar com `410 Gone`, enfileirar e-mail via API do Resend (chave no Vault, S32); template React Email para o resumo semanal.
- **Dependências ou riscos:** custo por volume (residual nesta escala); configurar SPF/DKIM do domínio; respeitar opt-out por categoria (LGPD).
- **Critérios de aceitação:** usuário sem subscription de push recebe o lembrete por e-mail; subscription expirada é detectada e o fallback dispara; preferências por tipo respeitadas.

### 3.10 Inteligência Artificial e automação

#### S69 — Mentor 2.0: coaching contextual com LLM

> **Categoria:** IA · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** `lib/mentor.ts` é uma árvore de ~20 regras fixas sobre 7 variáveis — as mensagens se repetem em poucos dias de uso e não incorporam o contexto rico que o app tem (histórico de streaks, área em queda, padrão de horário, programa em atraso).
- **Solução proposta:** gerar a mensagem do mentor com um LLM (Claude Haiku 4.5 pela latência/custo) alimentado por um resumo estruturado do estado do usuário, mantendo as regras atuais como fallback offline/de custo.
- **Benefícios esperados:** conselhos específicos e não repetitivos — eleva a peça central de engajamento diário do produto.
- **Possível implementação técnica:** Edge Function `mentor-message` (a chave da API **nunca** no cliente): monta contexto compacto (JSON de métricas, sem dados sensíveis desnecessários), chama a API com prompt de persona curto, cacheia 1 mensagem/fase/dia em tabela para custo previsível (~3 chamadas/usuário/dia).
- **Dependências ou riscos:** custo por usuário (mitigado por cache e modelo pequeno); latência → gerar de forma assíncrona no primeiro load da fase; guardrails de tom no prompt (nunca prescrever médico/financeiro).
- **Critérios de aceitação:** mensagem do dia referencia dados reais do usuário (ex.: cita a área em queda); repetição textual < 10 % em 30 dias; sem chave de API no bundle; fallback de regras funciona com a função fora do ar.

#### S70 — Categorização de transações com IA (substituir heurística de regex)

> **Categoria:** IA · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** `lib/categorize.ts` são 27 linhas de regex com comerciantes portugueses hardcoded (Continente, Pingo Doce, Galp) — qualquer estabelecimento fora da lista cai em "Outro", e o usuário recategoriza à mão import após import.
- **Solução proposta:** categorização em camadas: (1) memória exata do próprio usuário (descrição já categorizada antes → mesma categoria), (2) LLM em lote para os desconhecidos, (3) regex atual como último fallback. Correções do usuário realimentam a camada 1.
- **Benefícios esperados:** precisão de categorização salta (principal dor do import); orçamentos (S57) ficam confiáveis.
- **Possível implementação técnica:** Edge Function `categorize-batch` que envia até 50 descrições numa única chamada (Haiku, resposta JSON com enum das categorias existentes); tabela `category_memory (user_id, description_norm, category)` para a camada 1; roda no preview do import antes da confirmação.
- **Dependências ou riscos:** custo desprezível em lote; enum fechado no prompt evita categorias inventadas; privacidade — enviar apenas a descrição, nunca valores/saldos.
- **Critérios de aceitação:** import com 30 transações variadas categoriza ≥ 85 % fora de "Outro"; correção manual é lembrada no próximo import; funciona offline via fallback.

#### S71 — Programa 63 dias adaptativo por aderência

> **Categoria:** IA · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** o programa é gerado uma vez do assessment (`assessment-to-program.ts`) e fica estático por 9 semanas — quem sobre-performa fica sem desafio, quem falha acumula frustração; a única resposta hoje seria abandonar o programa.
- **Solução proposta:** checkpoint semanal automático: engine analisa a aderência da semana (por área e por tipo de tarefa) e propõe ajustes na semana seguinte (intensificar, manter, simplificar, trocar tarefa recorrentemente ignorada) — usuário aprova com um toque; LLM opcional gera a explicação do ajuste.
- **Benefícios esperados:** o programa parece "vivo" e pessoal — diferencial competitivo central; menos churn nas semanas 3–5 (vale clássico).
- **Possível implementação técnica:** função pura `proposeWeekAdjustments(weekStats, program)` em `program-engine.ts` (regra determinística testável — IA só na narração via S69); mutação que regrava `program_tasks` da semana seguinte; integra a revisão semanal (S54).
- **Dependências ou riscos:** regras de ajuste exigem calibração (começar conservador: só simplificar automático, intensificar sob opt-in); manter auditabilidade (log de ajustes aplicados).
- **Critérios de aceitação:** semana com aderência < 40 % gera proposta de simplificação na revisão; aceitar aplica as mudanças na semana seguinte; engine 100 % coberto por testes com cenários de sobre/sub-performance.

#### S72 — Extração de extratos PDF com LLM (fallback do parser)

> **Categoria:** IA · **Prioridade:** Média · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** `pdf.ts` depende de heurísticas de layout que quebram a cada banco/formato novo — extratos fora do padrão suportado falham silenciosamente ou geram candidatos errados, e cada banco novo é código novo.
- **Solução proposta:** pipeline híbrido: parser atual primeiro (barato, offline); se a confiança for baixa (poucas linhas reconhecidas), enviar o texto extraído do PDF a um LLM com schema estruturado (data, descrição, valor, tipo) e apresentar no mesmo `ImportPreview` com validação Zod (S36).
- **Benefícios esperados:** compatibilidade com "qualquer banco" sem manter um parser por instituição — remove o teto do módulo de import.
- **Possível implementação técnica:** Edge Function `parse-statement` usando tool use/structured output (Claude Sonnet 5 para os difíceis); enviar texto, não a imagem, quando possível (custo); nunca persistir o extrato bruto no servidor.
- **Dependências ou riscos:** privacidade (extrato é dado sensível — processar e descartar, documentar na política); custo por página controlado pelo gate de confiança; alucinação mitigada por validação + preview humano obrigatório.
- **Critérios de aceitação:** extrato de banco não suportado pelo parser clássico produz candidatos corretos no preview; valores conferem com o documento em teste com 3 bancos distintos; nada do PDF fica armazenado após o processamento.

#### S73 — Resumo semanal narrativo gerado por IA

> **Categoria:** IA · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** os números da semana existem (S54), mas números não criam vínculo — falta a narrativa ("você treinou nos 3 dias que planejou pela primeira vez em um mês") que dá sentido e é compartilhável.
- **Solução proposta:** parágrafo narrativo no topo da revisão semanal e do e-mail (S68), gerado por LLM a partir dos agregados da semana + comparativo com as 4 anteriores, com um destaque e uma sugestão.
- **Benefícios esperados:** a revisão semanal ganha alma; conteúdo naturalmente compartilhável (aquisição).
- **Possível implementação técnica:** reaproveita a infra do S69 (mesma Edge Function, prompt diferente); gera 1×/semana/usuário no job de domingo — custo mínimo; card compartilhável como imagem via canvas.
- **Dependências ou riscos:** depende de S54 (agregados) e S69 (infra); tom precisa de guardrails (celebrar sem condescender, nunca envergonhar).
- **Critérios de aceitação:** revisão de domingo abre com narrativa que cita ≥ 2 fatos reais da semana; geração falha → revisão mostra só números (degradação graciosa); custo por usuário/semana dentro do orçado.

#### S74 — Assistente conversacional sobre os próprios dados

> **Categoria:** IA · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Grande

- **Problema identificado:** perguntas naturais do usuário ("quanto gastei com mercado este mês?", "qual meu recorde de supino?", "quantos dias li em julho?") não têm resposta direta — exigem navegar, filtrar e somar de cabeça.
- **Solução proposta:** chat no app (e no bot do S66) com tool use: o LLM recebe ferramentas de consulta read-only (`query_transactions`, `query_habits`, `query_workouts`) e responde com dados reais, citando os números.
- **Benefícios esperados:** acesso instantâneo a qualquer recorte dos dados; vitrine do valor de ter tudo num app só.
- **Possível implementação técnica:** Edge Function com loop de tool use (Claude Sonnet 5); cada tool executa query parametrizada **com o client do usuário** (RLS aplicada — nunca service role); histórico curto por sessão; UI de chat reaproveitando o BottomSheet.
- **Dependências ou riscos:** o LLM nunca deve montar SQL livre — só chamar tools parametrizadas; custo por conversa (limitar mensagens/dia no início); depende de S46 para expor as consultas com segurança.
- **Critérios de aceitação:** as 3 perguntas-exemplo retornam valores que batem com as telas; tentativa de acessar dados de outro usuário é impossível por construção (teste); limite diário aplicado.

### 3.11 Analytics e métricas

#### S75 — Telemetria de produto (PostHog)

> **Categoria:** Analytics · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Pequeno

- **Problema identificado:** não existe nenhuma telemetria: as decisões de produto (quais módulos são usados? onde o onboarding perde gente? o modo claro pegou?) são tomadas às cegas — num app com 9 módulos, saber o que cortar/investir é vital.
- **Solução proposta:** PostHog (cloud EU ou self-host) com plano de eventos enxuto e nomeado: `onboarding_step_completed`, `habit_checked`, `program_generated`, `import_completed`, `push_opted_in`, `screen_viewed` — mais funil do onboarding e retenção D1/D7/D30 por módulo.
- **Benefícios esperados:** priorização baseada em uso real (inclusive deste roadmap); métricas de retenção viram o KPI norteador.
- **Possível implementação técnica:** `posthog-js` inicializado no layout com `person_profiles: 'identified_only'`, `identify(user.id)` após login; helper `track()` tipado (union de eventos permitidos) para evitar taxonomia caótica; respeitar Do Not Track e consentimento (LGPD).
- **Dependências ou riscos:** privacidade — sem autocapture, sem gravar conteúdo (valores, textos), IP anonimizado; documentar no aviso de privacidade (`/privacidade`).
- **Critérios de aceitação:** funil do onboarding visível no painel; eventos fora da union tipada não compilam; opt-out funcional; nenhum payload contém dado financeiro/de saúde.

#### S76 — Monitoramento de erros com Sentry

> **Categoria:** Analytics · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Pequeno

- **Problema identificado:** erros de produção morrem em `console.error` no dispositivo do usuário (ver S22) — o time literalmente não sabe o que está quebrando, nem com que frequência, nem para quem.
- **Solução proposta:** `@sentry/nextjs` no cliente + instrumentação das Edge Functions (Deno SDK), com source maps, release tracking por commit e alerta para novos issues.
- **Benefícios esperados:** visibilidade imediata de regressões (complemento indispensável do CI); diagnóstico com stack trace real em vez de "usuário disse que não salvou".
- **Possível implementação técnica:** `npx @sentry/wizard@latest -i nextjs`; integrar com o contrato de erro do S49 (`AppError` → `captureException` com tags de domínio/operação); sample rate de performance baixo (10 %) para custo.
- **Dependências ou riscos:** scrub de PII no `beforeSend` (nunca enviar descrições de transação, e-mails); plano gratuito cobre o volume atual.
- **Critérios de aceitação:** erro forçado em staging aparece no Sentry com source map legível e release; alerta chega no canal do time; evento auditado sem PII.

#### S77 — Web Vitals e monitoramento de performance real (RUM)

> **Categoria:** Analytics · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** as otimizações S23–S30 não têm linha de base nem verificação em campo — Lighthouse local não representa o Android mediano em 4G que é o usuário-alvo de um PWA.
- **Solução proposta:** coletar Core Web Vitals reais (LCP, INP, CLS) por rota — via Vercel Speed Insights (se o deploy for Vercel) ou `useReportWebVitals` enviando ao PostHog (S75) — com metas explícitas (LCP < 2,5 s p75, INP < 200 ms).
- **Benefícios esperados:** performance passa a ser medida onde importa; regressões de campo detectadas sem depender de reclamação.
- **Possível implementação técnica:** hook `useReportWebVitals` no layout → evento `web_vital` com rota/valor/rating; dashboard por rota; combinar com o orçamento de bundle (S30) para prevenção + detecção.
- **Dependências ou riscos:** depende de S75 (destino dos eventos) ou do deploy Vercel; amostragem para não inflar volume de eventos.
- **Critérios de aceitação:** p75 de LCP/INP visível por rota; alerta configurado ao estourar a meta por 7 dias; baseline registrada antes das otimizações da seção 3.4.

#### S78 — Métricas de engajamento no próprio app (transparência com o usuário)

> **Categoria:** Analytics · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** os indicadores que o app mostra (streak, XP, ritmo) medem esforço, não consistência de longo prazo — o usuário não vê sua própria "retenção" (semanas ativas seguidas, taxa de conclusão histórica por hábito), dados que já existem nas tabelas.
- **Solução proposta:** seção "Consistência" em `/progresso`: heatmap anual de dias ativos (estilo GitHub), taxa de conclusão por hábito ao longo do tempo e "semanas perfeitas" — computados de `habit_logs`/`checkins`.
- **Benefícios esperados:** reforço de identidade ("sou alguém consistente") — o motivador mais durável; diferencia o Progresso de um simples contador.
- **Possível implementação técnica:** RPC agregada (`select date, count(*) from habit_logs ... group by date`) alimentando um heatmap SVG leve (sem lib nova); cache com S25.
- **Dependências ou riscos:** agregação eficiente exige S29 (índices); heatmap acessível (S42 — tabela alternativa).
- **Critérios de aceitação:** heatmap dos últimos 12 meses carrega em 1 roundtrip; taxa por hábito confere com os logs; versão textual acessível disponível.

### 3.12 Infraestrutura, DevOps e CI/CD

#### S79 — Pipeline de CI no GitHub Actions

> **Categoria:** Infra/DevOps · **Prioridade:** Crítica · **Impacto:** Alto · **Esforço:** Pequeno

- **Problema identificado:** não existe `.github/workflows` — lint, typecheck, os 25+ arquivos de teste e o build **não rodam automaticamente**. Todo o investimento existente em testes depende de alguém lembrar de rodá-los; um PR pode quebrar o build de produção sem nenhum aviso.
- **Solução proposta:** workflow único em PR e push na `main`: `npm ci → lint → typecheck → test → build`, com cache de npm e do `.next/cache`.
- **Benefícios esperados:** o "verde" atual (build/lint/test) vira invariante garantida; pré-requisito de S30, S31, S38, S52, S81, S89 — é a sugestão que destrava mais outras.
- **Possível implementação técnica:**
  ```yaml
  # .github/workflows/ci.yml
  on: { pull_request: {}, push: { branches: [main] } }
  jobs:
    ci:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20, cache: npm }
        - run: npm ci
        - run: npm run lint
        - run: npm run typecheck
        - run: npm test
        - run: npm run build
          env: { NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder }
  ```
  (os placeholders funcionam porque o código já os prevê — ver `lib/supabase.ts`).
- **Dependências ou riscos:** nenhum; minutos de Actions gratuitos cobrem o volume.
- **Critérios de aceitação:** PR com erro de tipo/teste/build fica vermelho; `main` só recebe commits verdes (com S80); tempo total do pipeline < 5 min.

#### S80 — Proteção de branch e preview deployments

> **Categoria:** Infra/DevOps · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** nada impede push direto na `main` nem merge de PR vermelho; e sem preview por PR, mudanças de UI (como a migração do modo claro) são avaliadas só localmente ou já em produção.
- **Solução proposta:** branch protection na `main` (PR obrigatório + status check do CI do S79) e previews automáticos por PR (Vercel), com variáveis de ambiente de preview apontando para o Supabase de staging (S82).
- **Benefícios esperados:** produção protegida por processo, não disciplina; review de UI com link clicável no PR.
- **Possível implementação técnica:** Settings → Branches → require status checks + require PR; integração GitHub↔Vercel (automática); comentar a URL do preview no PR.
- **Dependências ou riscos:** depende do S79 (o check precisa existir); previews contra produção seriam perigosos — condicionar env de preview ao S82.
- **Critérios de aceitação:** push direto na `main` é rejeitado; PR vermelho não tem botão de merge; todo PR ganha URL de preview funcional.

#### S81 — Pipeline de migrations do Supabase com verificação de drift

> **Categoria:** Infra/DevOps · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** o processo de migrations é manual e baseado em disciplina ("toda mudança via `apply_migration` + arquivo no repo no mesmo commit", `supabase/README.md`) — um esquecimento e o schema real diverge do versionado de novo, repetindo o débito crítico que acabou de ser pago.
- **Solução proposta:** automatizar: job de CI que valida migrations (aplicáveis do zero num Postgres efêmero) em todo PR que toca `supabase/`, e job agendado de *drift check* comparando produção × repo, alertando divergências.
- **Benefícios esperados:** o schema versionado se mantém verdadeiro por construção; segurança para refactors de banco (S17, S18, S29, S33).
- **Possível implementação técnica:** `supabase db start` + `supabase db reset` no CI (aplica todas as migrations num container); drift: `supabase db diff --linked` em cron semanal do Actions, falhando se o diff não for vazio; deploy de Edge Functions (`supabase functions deploy`) no mesmo pipeline.
- **Dependências ou riscos:** requer `SUPABASE_ACCESS_TOKEN`/`DB_URL` como secrets do repo (somente leitura para o diff); depende do S79.
- **Critérios de aceitação:** PR com migration inválida fica vermelho; alteração manual em produção dispara o alerta de drift na semana; Edge Functions deployadas via pipeline, não à mão.

#### S82 — Ambiente de staging separado (Supabase Branching ou projeto dedicado)

> **Categoria:** Infra/DevOps · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** tudo indica um único projeto Supabase: testar migration destrutiva, policy nova (S17/S18/S33) ou a Edge Function de apagar conta (S34) acontece **contra o banco de produção** — um erro é irreversível sobre dados reais.
- **Solução proposta:** ambiente de staging: Supabase Branching (preview branch por PR) ou um segundo projeto `nexus-staging` com seeds (S99); previews do Vercel (S80) apontam para ele.
- **Benefícios esperados:** experimentos de banco e auth sem risco; E2E (S86) ganha um alvo seguro; pré-requisito prático do S80.
- **Possível implementação técnica:** com Branching: habilitar no dashboard e ligar à integração do GitHub (branch por PR com migrations aplicadas automaticamente); sem Branching: projeto free dedicado + `supabase db reset` com seeds no pipeline.
- **Dependências ou riscos:** custo do Branching (avaliar vs projeto free dedicado); nunca copiar dados reais para staging (LGPD) — usar seeds sintéticos.
- **Critérios de aceitação:** migrations de PR aplicam em staging antes de produção; E2E roda contra staging; nenhum dado real fora de produção.

#### S83 — Atualização automatizada de dependências (Renovate)

> **Categoria:** Infra/DevOps · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** desdobramento operacional do S38: sem automação, as versões continuam envelhecendo (Next 14 numa era de Next 15+, `@supabase/ssr` 0.1 muito atrás) e cada upgrade adiado fica maior e mais arriscado.
- **Solução proposta:** Renovate com PRs semanais agrupados (minor/patch juntos, majors isolados com changelog), validados pelo CI; janela mensal no time para os majors.
- **Benefícios esperados:** upgrades viram rotina pequena e contínua em vez de projeto trimestral doloroso.
- **Possível implementação técnica:** `renovate.json`: `extends: ['config:recommended', ':semanticCommits']`, `packageRules` agrupando devDependencies; label automática para majors.
- **Dependências ou riscos:** depende do S79 (sem CI, merge automático é roleta); majors de Next/Supabase exigem leitura de breaking changes — nunca automerge.
- **Critérios de aceitação:** PRs de update chegando semanalmente e verdes; nenhuma dependência de produção > 1 major atrás sem issue registrando o motivo.

#### S84 — Higiene do repositório (imagens de referência fora do Git)

> **Categoria:** Infra/DevOps · **Prioridade:** Baixa · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** `docs/rise-reference/` guarda ~95 screenshots PNG de um app de referência — dezenas de MB que todo clone/CI baixa para sempre, além de material de terceiros versionado no repo.
- **Solução proposta:** mover as referências para storage externo (Drive/Notion do time) deixando um link no doc; opcionalmente reescrever o histórico (`git filter-repo`) para reduzir o tamanho do clone, ou apenas remover do HEAD e aceitar o histórico.
- **Benefícios esperados:** clones e CI mais rápidos; repo contém só o que é do projeto.
- **Possível implementação técnica:** `git rm -r docs/rise-reference` + link no `rise-roadmap.md`; se reescrever histórico, coordenar com todos os clones ativos (force-push disruptivo).
- **Dependências ou riscos:** reescrita de histórico invalida clones/PRs abertos — avaliar se o ganho compensa; a remoção simples do HEAD é segura.
- **Critérios de aceitação:** HEAD sem os PNGs e docs com link para as referências; clone raso do repo perceptivelmente menor; nenhuma referência quebrada em docs ativos.

### 3.13 Testes automatizados

#### S85 — Testes de componentes com Testing Library

> **Categoria:** Testes · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** `@testing-library/react` está instalada e o ambiente jsdom configurado (`vitest.config.ts`), mas **não existe um único teste de componente** — toda a camada de UI (onde vivem os bugs de estado, otimismo, formulários) está sem rede de proteção.
- **Solução proposta:** cobrir os componentes de maior risco/valor: `TodayHabitList` (check/uncheck + estados), `ImportPreview` (validação linha a linha), `ConfirmDialog`/`BottomSheet` (foco e teclado, valida S41), `QuestionRenderer` (onboarding dinâmico) — com mocks da camada de dados (facilitados por S46).
- **Benefícios esperados:** refactors S12/S47 deixam de ser saltos sem rede; bugs de interação pegos no PR.
- **Possível implementação técnica:** padrão `renderWithProviders()` (ToastProvider, QueryClient de teste); MSW ou stub dos repositórios para as respostas do Supabase; convenção co-locada `Component.test.tsx`.
- **Dependências ou riscos:** mock do supabase-js bruto é doloroso — testar via repositórios (S46) simplifica muito; começar antes dos refactors para proteger o comportamento atual.
- **Critérios de aceitação:** ≥ 10 componentes críticos com testes de interação (não snapshot); testes rodando no CI (S79); quebra proposital de um handler faz a suíte falhar.

#### S86 — Suíte E2E com Playwright para os fluxos vitais

> **Categoria:** Testes · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Grande

- **Problema identificado:** os fluxos que definem o produto — cadastro → onboarding → gerar programa → marcar o primeiro hábito; login; import financeiro; check-in — atravessam páginas, Supabase e RPCs, e nenhum teste os cobre de ponta a ponta; só um clique manual detectaria uma quebra.
- **Solução proposta:** Playwright com 5–6 jornadas críticas rodando contra staging (S82) no CI (em PRs que tocam áreas sensíveis + nightly), com usuários de teste descartáveis.
- **Benefícios esperados:** garantia de que "o app funciona" de verdade a cada mudança; os refactors grandes do roadmap (S12, S46, S47) ficam seguros.
- **Possível implementação técnica:** `@playwright/test` com projects mobile (viewport 390×844, é um PWA mobile-first) e desktop; fixtures de auth via API do Supabase (criar/limpar usuário por teste); seletores por `getByRole` (reforça a11y de S41/S44).
- **Dependências ou riscos:** depende de S82 (nunca E2E contra produção); flakiness — usar auto-waiting e evitar sleeps; tempo de CI (rodar nightly a suíte completa, no PR só smoke).
- **Critérios de aceitação:** as 6 jornadas passam no CI contra staging; teste de onboarding cria e destrói o próprio usuário; smoke E2E em todo PR < 5 min.

#### S87 — Testes automatizados de RLS (isolamento entre usuários)

> **Categoria:** Testes · **Prioridade:** Alta · **Impacto:** Alto · **Esforço:** Médio

- **Problema identificado:** as 96 policies são **toda** a segurança de dados do app (não há backend), e nenhuma é testada — uma policy trocada num refactor (S18, S33) pode abrir dados de todos os usuários e nada avisaria (é exatamente a classe de bug do `weekly_league_snapshots`).
- **Solução proposta:** suíte que sobe o schema num Postgres efêmero (ou staging), cria os usuários A e B e verifica, tabela a tabela: A lê/escreve o seu; A **não** lê/escreve o de B; anônimo não lê nada; e os casos especiais (liga, catálogos S17) se comportam como especificado.
- **Benefícios esperados:** a única camada de segurança do produto ganha verificação contínua; migrations de policy deixam de ser mudanças cegas.
- **Possível implementação técnica:** Vitest + dois clients supabase-js autenticados (A/B) rodando contra o container do `supabase db start` no CI (encaixa no S81); gerar a matriz de casos a partir da lista de tabelas para não esquecer nenhuma; alternativa: pgTAP nas migrations.
- **Dependências ou riscos:** depende de S81/S82 (banco de teste); manter a matriz sincronizada com tabelas novas (falhar se surgir tabela sem casos).
- **Critérios de aceitação:** matriz cobre as 38 tabelas; teste demonstra que B não lê dados de A em nenhuma; remover uma policy faz o CI falhar; casos especiais (S17/S33) documentados nos próprios testes.

#### S88 — Testes de contrato dos parsers de import com fixtures reais

> **Categoria:** Testes · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** `pdf.ts`, `csv-parser.ts` e `spreadsheet.ts` têm testes unitários, mas não uma bateria de arquivos reais (anonimizados) por banco/formato — cada extrato novo do mundo real é uma roleta, e regressões de parsing (o mojibake do `fix_mojibake_v1.sql`) já aconteceram.
- **Solução proposta:** pasta `fixtures/statements/` com amostras anonimizadas por formato suportado (+ casos adversariais: encoding quebrado, colunas trocadas, milhares com vírgula/ponto, linhas vazias) e testes de contrato: cada fixture → candidatos esperados (golden files).
- **Benefícios esperados:** suporte a formatos vira lista verificável; mudar o parser com confiança; base de avaliação para o fallback LLM (S72).
- **Possível implementação técnica:** script de anonimização (troca descrições/valores preservando o layout); `expect(parse(fixture)).toMatchSnapshot()` com snapshots revisados; incluir fixtures inválidas que devem ser rejeitadas (S36).
- **Dependências ou riscos:** garantir anonimização real antes de commitar (revisão dupla); nenhum outro.
- **Critérios de aceitação:** ≥ 8 fixtures cobrindo os formatos suportados + 4 adversariais; alterar o parser sem atualizar golden files falha; nenhuma fixture contém dado real.

#### S89 — Cobertura de testes com limiar no CI

> **Categoria:** Testes · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** não há medição de cobertura — impossível saber se os 25+ arquivos de teste cobrem 30 % ou 70 % dos engines, e nada impede código novo de chegar sem teste algum.
- **Solução proposta:** `vitest --coverage` (v8) com limiar por diretório: exigente em `src/lib` (a lógica pura, ex.: 80 % lines) e progressivo em `src/components` conforme S85 avança; relatório no PR.
- **Benefícios esperados:** régua objetiva; a cultura de "engine novo nasce com teste" (que o repo já pratica) vira regra verificada.
- **Possível implementação técnica:** `coverage.thresholds` no `vitest.config.ts` com valores por glob; iniciar nos números atuais (ratchet: nunca cair, subir aos poucos) para não bloquear o time no dia 1.
- **Dependências ou riscos:** depende do S79; cobertura é proxy, não fim — revisar qualidade dos testes no review.
- **Critérios de aceitação:** CI publica cobertura por PR; PR que derruba a cobertura de `src/lib` abaixo do limiar falha; limiar registrado e ajustado trimestralmente.

#### S90 — Testes de regressão visual (dois temas)

> **Categoria:** Testes · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** o histórico recente é de bugs visuais de tema (legibilidade do modo claro, comentário CSS quebrando minificação) — mudanças de token em `globals.css` afetam todas as telas e só olho humano detecta hoje; a migração S09 multiplicará esse risco.
- **Solução proposta:** screenshots automatizados das ~10 telas principais × 2 temas × mobile/desktop comparados contra baseline (Playwright `toHaveScreenshot`), rodando nas mudanças de CSS/tokens/componentes de UI.
- **Benefícios esperados:** mudanças de token deixam de ser apostas; os refactors visuais (S09, S12) ganham verificação automática de "nada mudou onde não devia".
- **Possível implementação técnica:** reusar a infra do S86 com dados seedados estáveis (S99) e animações desligadas; `maxDiffPixelRatio` tolerante a antialiasing; baselines versionadas via Git LFS ou artefato de CI.
- **Dependências ou riscos:** flakiness por fontes/animações — congelar com `prefers-reduced-motion` e fontes self-hosted (S23); atualização de baseline deve ser ato consciente no PR.
- **Critérios de aceitação:** mudar um token de cor gera diff visível no PR com imagens antes/depois; suíte estável (< 1 % flake) nas 40 combinações; baseline atualizável por comando documentado.

### 3.14 SEO

#### S91 — Metadata por rota, robots e Open Graph

> **Categoria:** SEO · **Prioridade:** Média · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** só o layout raiz define metadata — todas as páginas compartilham o mesmo título/descrição; não há `robots.ts`, `sitemap.ts` nem tags Open Graph, e as rotas privadas (`/hoje`, `/financas`…) ficam indexáveis por padrão apesar de inúteis (e indesejáveis) num índice de busca.
- **Solução proposta:** `export const metadata` por rota (título específico: "Finanças — NEXUS"); `robots: { index: false }` nas rotas autenticadas; OG/Twitter cards nas páginas públicas (`/`, `/termos`, `/privacidade` e a futura landing S92) com imagem OG.
- **Benefícios esperados:** links compartilhados com preview decente; superfície privada fora dos índices; títulos de aba/histórico utilizáveis.
- **Possível implementação técnica:** `metadata` estático por `page.tsx`; helper `privateMeta(title)` que embute o `noindex`; `opengraph-image.tsx` (geração nativa do App Router) para a OG image.
- **Dependências ou riscos:** nenhum; páginas client precisam mover metadata para o `page.tsx` server (padrão já usado em `/hoje`).
- **Critérios de aceitação:** cada rota com título único; `curl` das rotas privadas mostra `noindex`; compartilhar o domínio no WhatsApp/Twitter exibe card com imagem.

#### S92 — Landing page pública de marketing + sitemap

> **Categoria:** SEO · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** a raiz `/` redireciona direto para `/hoje` (→ `/auth` sem sessão) — o produto **não tem página pública**: nada para indexar, nada para linkar em divulgação, zero aquisição orgânica; o visitante decide criar conta sem ver o que o app faz.
- **Solução proposta:** landing estática em `/` para visitantes sem sessão (proposta de valor, screenshots dos módulos, CTA de cadastro e do modo demo S07), com `sitemap.ts`/`robots.ts`; usuários logados seguem indo direto ao `/hoje`.
- **Benefícios esperados:** canal de aquisição orgânica passa a existir; página para apontar em qualquer divulgação; primeira impressão controlada.
- **Possível implementação técnica:** `page.tsx` raiz como Server Component estático (ótimo LCP) que checa sessão via `supabase-server.ts` e redireciona logados; conteúdo com as seções clássicas (herói, features por módulo, prova social, FAQ); `generateStaticParams`/ISR para custo zero.
- **Dependências ou riscos:** screenshots devem refletir a UI atual (atualizar junto com releases visuais); textos em pt-BR desde já (S94).
- **Critérios de aceitação:** visitante anônimo em `/` vê a landing (sem flash de redirect); logado cai no `/hoje` como hoje; Lighthouse SEO ≥ 95 na landing; sitemap servido e válido.

### 3.15 Internacionalização (i18n)

#### S93 — Externalizar strings para camada de mensagens (next-intl)

> **Categoria:** i18n · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Grande

- **Problema identificado:** todo texto do app está hardcoded em JSX/engines (incluindo as ~40 mensagens do mentor e os textos do onboarding) — traduzir ou sequer ajustar a variante do português exige tocar centenas de arquivos, e novas telas perpetuam o padrão.
- **Solução proposta:** adotar `next-intl`: mensagens em `messages/pt.json` (chaves por domínio), hooks `useTranslations` nos componentes, formatação de data/número/moeda via API do pacote; o conteúdo dos engines (mentor, onboarding) migra para catálogos próprios versionados.
- **Benefícios esperados:** pt-BR/en viram questão de arquivo novo, não de refactor; textos revisáveis num lugar só (ajuda o S94); consistência terminológica.
- **Possível implementação técnica:** migração por módulo (novo código já nasce com chaves; legado migra junto dos refactors S12/S47); lint proibindo strings de UI hardcoded nos módulos migrados; conteúdo longo (perguntas do onboarding) como namespaces dedicados.
- **Dependências ou riscos:** esforço espalhado — só vale com a decisão de mercado tomada (ver S94); textos de gamificação têm tom de marca — glossário antes de traduzir.
- **Critérios de aceitação:** módulos migrados sem nenhuma string literal de UI (lint verifica); trocar o locale muda o app inteiro nos módulos migrados; catálogos revisados por um falante da variante-alvo.

#### S94 — Unificar a variante do português (pt-PT × pt-BR) por decisão de mercado

> **Categoria:** i18n · **Prioridade:** Alta · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** o produto mistura sinais: UI e mentor em pt-PT ("utilizador", "propina", tuteamento à portuguesa), categorizador financeiro com comerciantes de Portugal (Continente, Galp) e moeda implícita em euros — enquanto o contexto do produto aponta para usuários brasileiros. Para um público pt-BR, o texto soa estrangeiro exatamente nos momentos de vínculo emocional (mentor, celebrações).
- **Solução proposta:** decidir o mercado primário e normalizar: glossário de termos (app/aplicativo, utilizador/usuário, ecrã/tela…), revisão dos textos de mentor/onboarding/UI na variante escolhida, e regionalização do categorizador (S70 resolve por aprendizado) e da moeda (S95).
- **Benefícios esperados:** linguagem nativa para o público-alvo — impacto direto em percepção de qualidade e conversão; base sã para o S93.
- **Possível implementação técnica:** auditoria por grep de termos marcadores (`utilizador|ecrã|propina|telemóvel`); se S93 já estiver em curso, a revisão vira edição de catálogo; senão, passada única de find/replace revisada.
- **Dependências ou riscos:** decisão de produto antes de tudo (envolver o dono do produto); manter suporte à outra variante como segundo locale se houver base instalada.
- **Critérios de aceitação:** decisão registrada (ADR); zero termos da variante não escolhida na UI (grep no CI); mentor e onboarding revisados por falante nativo da variante.

#### S95 — Moeda e formatos por localidade via `Intl`

> **Categoria:** i18n · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** valores monetários e datas são formatados de forma manual/fixa (moeda única implícita) — usuário no Brasil vê formatos que não batem com R$ (separadores, símbolo, posição), e datas fora do padrão local em alguns pontos.
- **Solução proposta:** preferência de moeda no perfil (`profiles.currency`, default pela decisão do S94) e formatação centralizada: `formatMoney(cents, currency)` com `Intl.NumberFormat` e datas com `Intl.DateTimeFormat`/date-fns `locale` — proibindo concatenação manual de símbolo.
- **Benefícios esperados:** números "parecem certos" para qualquer usuário; um único ponto de mudança para novas moedas.
- **Possível implementação técnica:** `lib/format.ts` com `new Intl.NumberFormat(locale, { style: 'currency', currency })`; armazenar valores como inteiro em centavos (auditar se já é o caso — se for float, migrar junto); varrer os call sites de formatação em finanças.
- **Dependências ou riscos:** não é conversão cambial (misturar moedas numa conta fica fora de escopo — uma moeda por conta); migração de float→centavos, se necessária, pede cuidado.
- **Critérios de aceitação:** trocar a moeda no perfil reformata todo o módulo de finanças; nenhum símbolo de moeda hardcoded (grep); testes de formatação para BRL e EUR.

### 3.16 Documentação e experiência do desenvolvedor

#### S96 — Consolidar e atualizar a documentação viva

> **Categoria:** Docs/DX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** documentos excelentes convivem com informação vencida e material morto: `ARCHITECTURE.md` cita 28 tabelas (são 38) e a RPC `add_xp` (inexistente); `GIT_CLEANUP.md`, handoffs de abril e `nexus_handoff_corpo_habitos_3001.md` na raiz confundem quem chega — não dá para saber o que ainda vale.
- **Solução proposta:** varredura única: atualizar os 4 docs canônicos (`PROJECT_OVERVIEW`, `ARCHITECTURE`, `SETUP`, `TECHNICAL_DEBT`) contra o código atual, mover históricos para `docs/archive/` com aviso de "congelado", e adotar a regra "PR que muda arquitetura atualiza o doc" no template (S97).
- **Benefícios esperados:** onboarding de dev (humano ou agente de IA) sem pistas falsas; docs voltam a ser confiáveis como fonte.
- **Possível implementação técnica:** meio dia de revisão guiada pelo diff entre docs e código (este relatório já mapeia várias divergências); `docs/archive/README.md` explicando o congelamento.
- **Dependências ou riscos:** nenhum; disciplina contínua fica a cargo do template de PR (S97).
- **Critérios de aceitação:** docs canônicos sem afirmações falsas verificáveis; raiz do repo sem handoffs soltos; índice em `docs/README.md` apontando o que é vivo e o que é arquivo.

#### S97 — CONTRIBUTING.md e template de Pull Request

> **Categoria:** Docs/DX · **Prioridade:** Baixa · **Impacto:** Baixo · **Esforço:** Pequeno

- **Problema identificado:** as convenções reais do projeto (branch de feature + PR contra `main`, migrations junto do commit, engines puros com teste, a regra da fonte Syne banida) vivem espalhadas entre README, CLAUDE.md e a cabeça de quem participou — não há CONTRIBUTING nem template de PR que as cobre.
- **Solução proposta:** `CONTRIBUTING.md` curto (setup, fluxo de branch, o que roda no CI, regras de migration e de estilo) + `.github/pull_request_template.md` com checklist (testes? migration versionada? docs atualizados? screenshots se UI?).
- **Benefícios esperados:** menos idas e vindas em review; contribuidores novos (e agentes) produtivos no primeiro PR.
- **Possível implementação técnica:** derivar o conteúdo dos docs existentes; checklist do template alinhado aos gates do CI (S79) para não virar teatro.
- **Dependências ou riscos:** nenhum.
- **Critérios de aceitação:** ambos os arquivos no repo; PRs novos abrem com o template preenchível; convenções citadas em review por link, não por repetição.

#### S98 — Catálogo de componentes com Ladle/Storybook

> **Categoria:** Docs/DX · **Prioridade:** Baixa · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** os componentes de `ui/` e os blocos de gamificação só são visíveis dentro das telas — testar um estado raro (streak em risco, badge nova, sheet com lista longa) exige navegar até produzi-lo; o design system nascente (S11) não tem vitrine nem contrato visual.
- **Solução proposta:** Ladle (leve, Vite, ideal para o porte) com stories dos primitivos de `ui/` e dos componentes de gamificação nos seus estados relevantes × 2 temas.
- **Benefícios esperados:** desenvolvimento de UI isolado e rápido; QA visual de estados raros; documentação executável do design system; alvo natural para os screenshots do S90.
- **Possível implementação técnica:** `npx ladle serve` com stories co-locadas (`Component.stories.tsx`); decorator global de tema (toggle `data-theme`); publicar o build estático no preview (S80).
- **Dependências ou riscos:** vale a pena junto com S11 (os primitivos nascem com story); manter stories atualizadas exige a regra "componente novo em `ui/` nasce com story".
- **Critérios de aceitação:** todos os componentes de `ui/` com stories nos dois temas; estados de gamificação navegáveis sem tocar o banco; link do catálogo no README.

#### S99 — Seeds de desenvolvimento com usuário demo realista

> **Categoria:** Docs/DX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Médio

- **Problema identificado:** subir o app localmente entrega um banco vazio: para ver o Hoje populado, gráficos de peso, liga ou finanças com histórico é preciso cadastrar dados à mão durante dias — desenvolvimento e QA lentos, e estados de "usuário maduro" (streak de 60 dias, 6 meses de transações) são impraticáveis de reproduzir.
- **Solução proposta:** `supabase/seed.sql` (+ script TS para dados em massa) criando um usuário demo com 90 dias de histórico plausível em todos os módulos: hábitos com falhas realistas, programa na semana 5, 300 transações categorizadas, pesos com tendência, 2 livros em progresso.
- **Benefícios esperados:** `db reset && seed` → app "vivido" em 1 minuto; base para E2E (S86), screenshots (S90) e modo demo (S07).
- **Possível implementação técnica:** gerador determinístico (seed fixa) em `scripts/seed-demo.ts` usando a service key local; datas relativas a `now()` para o dado nunca "envelhecer"; integrado ao fluxo do `supabase db start` (S81/S82).
- **Dependências ou riscos:** manter o seed em sincronia com o schema (rodá-lo no CI detecta quebra); dados 100 % sintéticos.
- **Critérios de aceitação:** um comando popula o ambiente local do zero; todas as telas principais exibem dados plausíveis com o usuário demo; seed roda no CI sem erro após qualquer migration.

#### S100 — Validação de variáveis de ambiente no boot

> **Categoria:** Docs/DX · **Prioridade:** Média · **Impacto:** Médio · **Esforço:** Pequeno

- **Problema identificado:** com env ausente, o app **sobe normalmente com placeholders** (`https://placeholder.supabase.co`) e falha depois, em runtime, com erros confusos de rede — armadilha documentada no próprio README ("sem elas o cliente usa placeholders e não liga ao backend") mas não prevenida; o mesmo vale para um deploy de produção com env esquecida.
- **Solução proposta:** validação central com Zod (`lib/env.ts`): em produção, URL/chave placeholder ou malformada **falha o build/boot** com mensagem clara; em dev, aviso visível (banner/console destacado); build de CI continua permitindo placeholders explicitamente.
- **Benefícios esperados:** a classe de erro "esqueci a env" morre no build, não na mão do usuário; setup de novato mais amigável.
- **Possível implementação técnica:** `const env = EnvSchema.parse({...})` importado por `lib/data/client.ts` e `middleware.ts`; flag `ALLOW_PLACEHOLDER_ENV=1` usada só no workflow de CI (S79); mensagem de erro aponta para o trecho do README.
- **Dependências ou riscos:** cuidado para não quebrar o build de CI que depende dos placeholders (a flag resolve); nenhum outro.
- **Critérios de aceitação:** build de produção sem env real falha com mensagem acionável; dev sem env mostra aviso claro; CI continua verde com a flag explícita.

---

## 4. Roadmap sugerido

> Sequenciamento pensado para: (1) eliminar risco primeiro, (2) construir a fundação que
> barateia todo o resto, (3) só então acelerar features. Estimativas assumem 1–2 devs.

### 4.1 Curto prazo (0–30 dias) — "Fundação e risco zero"

**Tema: segurança, CI, observabilidade e quick wins.**

| Ordem | Itens | Racional |
|---|---|---|
| Semana 1 | S79 (CI) · S31 (rotação de chave) · S17 (RLS badges/templates) · S39 (zoom) | As 4 Críticas de menor esforço — dias, não semanas |
| Semana 2 | S34 (edge functions) · S32 (Vault) · S33 (liga) · S18 (policies redundantes) · S80 (branch protection) | Fecha a frente de segurança auditada |
| Semana 3 | S76 (Sentry) · S75 (PostHog) · S16 (service workers) · S23 (next/font) · S100 (env) | Observabilidade + quick wins de perf/bug |
| Semana 4 | S35 (headers) · S38/S83 (Renovate) · S08 (loading states) · S13 (tema do sistema) · S10 (contraste claro) · S96 (docs) | Acabamento da fundação |

**Critério de saída:** CI verde obrigatório na `main`; zero pendências Críticas; erros de produção visíveis no Sentry; funil de onboarding medido.

### 4.2 Médio prazo (30–90 dias) — "Arquitetura e qualidade"

**Tema: pagar o débito estrutural e instalar a rede de testes, habilitando velocidade.**

- **Arquitetura de dados:** S46 (modularizar supabase.ts) → S49/S22 (contrato de erro) → S48 (tipos gerados) → S25 (TanStack Query) → S26/S29 (waterfalls, paginação e índices).
- **Testes:** S85 (componentes) e S87 (RLS) primeiro — protegem os refactors; S81/S82 (pipeline de migrations + staging) como pré-requisito; S88/S89 na sequência.
- **Refactors de UI protegidos:** S47 (WorkoutTracker) e início do S12 (hub de finanças); S52 (lint/Prettier) e S11 (primitivos de UI) no caminho.
- **Correções de fundo:** S19 (timezone) · S20 (cargas → banco) · S02 (UI otimista) · S24/S27/S28/S30 (perf restante).
- **Acessibilidade:** S40, S41, S44 (contraste, teclado, formulários).
- **Produto:** S57 (orçamento com alertas) e S94 (variante do idioma) — as duas decisões de maior impacto de percepção.

**Critério de saída:** nenhum arquivo > 500 linhas nos módulos refatorados; RLS 100 % testada; `/hoje` com ≤ 2 roundtrips; decisão de mercado registrada.

### 4.3 Longo prazo (90+ dias) — "Produto e diferenciação"

**Tema: com fundação sólida, investir em valor visível e diferenciação por IA.**

- **IA:** S69 (mentor LLM) → S73 (resumo narrativo) → S70 (categorização) → S72 (PDF via LLM) → S71 (programa adaptativo) → S74 (chat).
- **Features de retenção:** S54 (revisão semanal) · S60 (metas conectadas) · S61 (análise de treino, pós-S20) · S55 (habit stacking) · S04 (retomada do programa) · S78 (consistência).
- **Aquisição:** S92 (landing) · S91 (SEO) · S07 (modo demo) · S58 (shortcuts/share) · S59 (desafios sociais).
- **Integrações:** S63 (Open Finance) · S64 (Calendar) · S67 (livros) · S68 (e-mail) · S66 (Telegram) · S65 (saúde).
- **Plataforma:** S01 (offline real) · S51 (Server Components) · S86 (E2E completo) · S90 (regressão visual) · S93 (i18n) · S95 (moeda) · S62 (EPUB) · S05/S06 (busca e navegação) · S98/S99 (Ladle, seeds — antes se S11 acelerar).

**Critério de saída:** mentor IA em produção com custo monitorado; ao menos 1 canal de aquisição orgânica ativo; offline funcional nas ações diárias.

---

## 5. Tabela de priorização

> Ordenada por prioridade (Crítica → Alta → Média → Baixa); dentro de cada faixa, por categoria.

| Prioridade | Sugestão | Impacto | Esforço | Categoria |
|---|---|---|---|---|
| Crítica | S17 — RLS de `badges`/`task_templates` sem policy | Alto | Pequeno | Bugs |
| Crítica | S31 — Rotacionar chave anon + varrer histórico | Alto | Pequeno | Segurança |
| Crítica | S34 — Hardening das Edge Functions | Alto | Médio | Segurança |
| Crítica | S39 — Desbloquear zoom (viewport) | Alto | Pequeno | Acessibilidade |
| Crítica | S79 — Pipeline de CI (GitHub Actions) | Alto | Pequeno | Infra/DevOps |
| Alta | S01 — Offline com fila de sincronização | Alto | Grande | UX |
| Alta | S02 — UI otimista nas ações diárias | Alto | Médio | UX |
| Alta | S04 — Replanejamento do programa 63d | Alto | Médio | UX |
| Alta | S10 — Auditoria de contraste do modo claro | Médio | Pequeno | UI |
| Alta | S12 — Finanças no modelo de hub | Alto | Grande | UI |
| Alta | S16 — Resolver dois service workers | Médio | Pequeno | Bugs |
| Alta | S19 — Auditoria de timezone ponta a ponta | Alto | Médio | Bugs |
| Alta | S20 — Cargas de treino no banco | Alto | Médio | Bugs |
| Alta | S22 — Padronizar tratamento de erros | Alto | Médio | Bugs |
| Alta | S23 — Fontes via next/font | Médio | Pequeno | Desempenho |
| Alta | S25 — TanStack Query (cache de dados) | Alto | Grande | Desempenho |
| Alta | S26 — Eliminar cascatas de queries | Alto | Médio | Desempenho |
| Alta | S29 — Paginação e índices | Alto | Médio | Desempenho |
| Alta | S32 — CRON_SECRET no Vault | Médio | Pequeno | Segurança |
| Alta | S33 — Minimizar exposição da liga | Médio | Pequeno | Segurança |
| Alta | S35 — Headers de segurança/CSP | Médio | Pequeno | Segurança |
| Alta | S36 — Endurecer pipeline de import | Médio | Médio | Segurança |
| Alta | S38 — Auditoria contínua de dependências | Médio | Pequeno | Segurança |
| Alta | S40 — Contraste AA nos dois temas | Médio | Médio | Acessibilidade |
| Alta | S41 — Teclado + focus management | Alto | Médio | Acessibilidade |
| Alta | S46 — Modularizar `lib/supabase.ts` | Alto | Grande | Arquitetura |
| Alta | S47 — Decompor componentes gigantes | Alto | Grande | Arquitetura |
| Alta | S48 — Tipos gerados do schema | Alto | Médio | Arquitetura |
| Alta | S56 — Exportação de dados (LGPD) | Médio | Médio | Funcionalidades |
| Alta | S57 — Orçamento por categoria com alertas | Alto | Médio | Funcionalidades |
| Alta | S69 — Mentor 2.0 com LLM | Alto | Médio | IA |
| Alta | S75 — Telemetria de produto (PostHog) | Alto | Pequeno | Analytics |
| Alta | S76 — Monitoramento de erros (Sentry) | Alto | Pequeno | Analytics |
| Alta | S80 — Branch protection + previews | Médio | Pequeno | Infra/DevOps |
| Alta | S81 — Pipeline de migrations + drift check | Alto | Médio | Infra/DevOps |
| Alta | S82 — Ambiente de staging | Alto | Médio | Infra/DevOps |
| Alta | S85 — Testes de componentes | Alto | Médio | Testes |
| Alta | S86 — E2E com Playwright | Alto | Grande | Testes |
| Alta | S87 — Testes de RLS | Alto | Médio | Testes |
| Alta | S94 — Unificar variante do português | Médio | Médio | i18n |
| Média | S03 — Ação + desfazer no lugar de confirmação | Médio | Pequeno | UX |
| Média | S05 — Busca global (⌘K) | Médio | Médio | UX |
| Média | S06 — Navegação em 5 hubs | Médio | Médio | UX |
| Média | S08 — loading/error em todas as rotas | Médio | Pequeno | UX |
| Média | S09 — Migração inline → Tailwind/tokens | Médio | Grande | UI |
| Média | S11 — Primitivos de UI (Button, Input…) | Alto | Médio | UI |
| Média | S18 — Policies RLS redundantes | Médio | Pequeno | Bugs |
| Média | S24 — Recharts sob demanda | Médio | Pequeno | Desempenho |
| Média | S27 — Cache do SW por tipo de recurso | Médio | Pequeno | Desempenho |
| Média | S28 — Code-splitting dos módulos pesados | Médio | Médio | Desempenho |
| Média | S30 — Orçamento de bundle no CI | Médio | Pequeno | Desempenho |
| Média | S37 — Senhas vazadas + MFA | Médio | Pequeno | Segurança |
| Média | S42 — ARIA em tabs/progresso/gráficos | Médio | Médio | Acessibilidade |
| Média | S43 — prefers-reduced-motion | Baixo | Pequeno | Acessibilidade |
| Média | S44 — Formulários acessíveis | Médio | Médio | Acessibilidade |
| Média | S45 — Alvos de toque + alternativa ao swipe | Médio | Médio | Acessibilidade |
| Média | S49 — Contrato de erro (Result) | Médio | Médio | Arquitetura |
| Média | S50 — Zod nas fronteiras | Médio | Médio | Arquitetura |
| Média | S51 — Server Components nas telas read-heavy | Alto | Grande | Arquitetura |
| Média | S52 — ESLint estrito + Prettier | Médio | Pequeno | Arquitetura |
| Média | S54 — Revisão semanal guiada | Alto | Médio | Funcionalidades |
| Média | S55 — Habit stacking / agenda por bloco | Médio | Médio | Funcionalidades |
| Média | S60 — Metas conectadas a hábitos | Alto | Médio | Funcionalidades |
| Média | S61 — Análise de progressão de treino | Alto | Médio | Funcionalidades |
| Média | S63 — Open Finance (Pluggy/Belvo) | Alto | Grande | Integrações |
| Média | S64 — Google Calendar (read-only) | Médio | Médio | Integrações |
| Média | S67 — Metadados de livros (Open Library) | Médio | Pequeno | Integrações |
| Média | S68 — E-mail como fallback de push | Médio | Pequeno | Integrações |
| Média | S70 — Categorização de transações com IA | Médio | Pequeno | IA |
| Média | S71 — Programa 63d adaptativo | Alto | Grande | IA |
| Média | S72 — Extratos PDF via LLM | Alto | Médio | IA |
| Média | S73 — Resumo semanal narrativo | Médio | Pequeno | IA |
| Média | S77 — Web Vitals reais (RUM) | Médio | Pequeno | Analytics |
| Média | S83 — Renovate (updates automáticos) | Médio | Pequeno | Infra/DevOps |
| Média | S88 — Fixtures de parsers | Médio | Pequeno | Testes |
| Média | S89 — Cobertura com limiar | Médio | Pequeno | Testes |
| Média | S91 — Metadata por rota + robots | Baixo | Pequeno | SEO |
| Média | S92 — Landing pública + sitemap | Médio | Médio | SEO |
| Média | S93 — Strings em next-intl | Médio | Grande | i18n |
| Média | S95 — Moeda/formatos via Intl | Médio | Pequeno | i18n |
| Média | S96 — Consolidar documentação | Médio | Pequeno | Docs/DX |
| Média | S99 — Seeds com usuário demo | Médio | Médio | Docs/DX |
| Média | S100 — Validação de env no boot | Médio | Pequeno | Docs/DX |
| Baixa | S07 — Modo demonstração sem conta | Médio | Médio | UX |
| Baixa | S13 — Tema segue o sistema | Baixo | Pequeno | UI |
| Baixa | S14 — Sistema de ícones padronizado | Baixo | Pequeno | UI |
| Baixa | S15 — Microinterações consistentes | Médio | Médio | UI |
| Baixa | S21 — Rotas legadas + docs divergentes | Baixo | Pequeno | Bugs |
| Baixa | S53 — Remover barramento window dos toasts | Baixo | Pequeno | Arquitetura |
| Baixa | S58 — PWA shortcuts + share target | Médio | Pequeno | Funcionalidades |
| Baixa | S59 — Desafios entre amigos | Médio | Grande | Funcionalidades |
| Baixa | S62 — EPUB no e-reader | Médio | Grande | Funcionalidades |
| Baixa | S65 — Health Connect/Apple Health | Médio | Grande | Integrações |
| Baixa | S66 — Bot de Telegram | Médio | Médio | Integrações |
| Baixa | S74 — Assistente conversacional | Médio | Grande | IA |
| Baixa | S78 — Métricas de consistência no app | Médio | Médio | Analytics |
| Baixa | S84 — Imagens de referência fora do Git | Baixo | Pequeno | Infra/DevOps |
| Baixa | S90 — Regressão visual | Médio | Médio | Testes |
| Baixa | S97 — CONTRIBUTING + template de PR | Baixo | Pequeno | Docs/DX |
| Baixa | S98 — Catálogo Ladle/Storybook | Médio | Médio | Docs/DX |

---

## 6. Top 20 por ROI

> ROI = (impacto no produto/risco evitado) ÷ esforço, considerando também o efeito
> desbloqueador (quantas outras sugestões cada uma viabiliza).

| # | Sugestão | Justificativa da posição |
|---|---|---|
| 1 | **S79 — CI no GitHub Actions** | Meio dia de trabalho que transforma todo o investimento já feito em testes numa garantia automática — e é pré-requisito direto de outras 8 sugestões (S30, S31, S38, S52, S80, S81, S83, S89). Nenhum outro item compra tanto por tão pouco. |
| 2 | **S31 — Rotacionar chave + varrer histórico** | Elimina um vetor de segurança conhecido, pendente desde a auditoria, em horas de trabalho. Risco evitado (vazamento de dados pessoais/financeiros) é de outra ordem de grandeza que o custo. |
| 3 | **S17 — Corrigir RLS de badges/task_templates** | Uma migration de minutos que provavelmente conserta funcionalidades quebradas em silêncio (catálogos negados + erros engolidos). Impacto imediato em gamificação e geração de programa. |
| 4 | **S39 — Desbloquear zoom** | Diff de 2 linhas que remove uma violação objetiva de WCAG AA que afeta todos os usuários de baixa visão. O melhor custo-benefício de acessibilidade possível. |
| 5 | **S76 — Sentry** | Setup de horas que liga a luz num cômodo hoje totalmente escuro: erros reais de produção. Multiplica o valor de S22/S49 e reduz o tempo de diagnóstico de qualquer bug futuro. |
| 6 | **S75 — PostHog** | Também horas de setup — e é o que permite priorizar o resto deste relatório com dados em vez de intuição (que módulos importam, onde o onboarding perde gente). ROI composto: melhora todas as decisões seguintes. |
| 7 | **S34 — Hardening das Edge Functions** | Esforço médio, mas protege o pior cenário do sistema (conta de terceiro apagada via função com service role). Risco catastrófico × custo moderado = topo da lista. |
| 8 | **S23 — next/font** | Uma manhã de trabalho para ganho mensurável de LCP em toda visita, além de simplificar a CSP (S35). Quick win de performance mais limpo do repo. |
| 9 | **S26 — Eliminar cascatas de queries** | A tela mais usada (`/hoje`) fica 3–5× mais rápida em redes de alta latência com uma RPC agregada. Impacto diário, para todo usuário, com esforço médio. |
| 10 | **S02 — UI otimista** | Ataca a fricção do gesto mais repetido do produto (marcar hábito). Percepção de velocidade é o atributo nº 1 de qualidade percebida em mobile; esforço médio bem delimitado. |
| 11 | **S22 — Padronizar tratamento de erros** | "Salvou mas não salvou" é o pior bug de confiança possível num app de progresso pessoal. Elimina a classe inteira e alimenta o Sentry com sinal de qualidade. |
| 12 | **S29 — Paginação e índices** | Barato agora, impagável depois: evita a degradação inevitável que atingiria as contas mais valiosas (usuários antigos) primeiro. ROI cresce com o tempo. |
| 13 | **S57 — Orçamento com alertas** | O schema já existe — falta só o comportamento. Menor distância entre "código já escrito" e "feature de retenção clássica" de todo o backlog de produto. |
| 14 | **S48 — Tipos gerados do schema** | Esforço médio que converte o schema versionado em contrato de compilação: typos de coluna viram erro de build. Paga-se a cada PR, para sempre. |
| 15 | **S16 — Resolver os dois service workers** | Pequeno em esforço, grande em risco evitado: bugs de "versão presa no cache" são os mais caros de diagnosticar em PWA (irreproduzíveis localmente). |
| 16 | **S33 — Minimizar exposição da liga** | Uma view/RPC fecha a possibilidade de enumerar toda a base de usuários — risco reputacional alto, correção pequena e invisível para o usuário. |
| 17 | **S69 — Mentor com LLM** | Entre as apostas de produto, a de melhor razão valor/esforço: infraestrutura pequena (1 Edge Function + cache), toca o ponto de engajamento diário e diferencia o produto de imediato. |
| 18 | **S87 — Testes de RLS** | As 96 policies são toda a segurança do app; testá-las custa esforço médio e converte cada mudança futura de policy de aposta em operação segura. Seguro barato para risco existencial. |
| 19 | **S10 — Contraste do modo claro** | O investimento no modo claro já foi feito (3 sprints recentes); a auditoria é o pequeno passo final que o torna utilizável de verdade — proteger investimento anterior é ROI puro. |
| 20 | **S94 — Unificar a variante do português** | Esforço médio, majoritariamente editorial, com efeito direto na percepção de qualidade do público-alvo: o mentor — coração emocional do produto — precisa soar nativo para funcionar. |

---

*Relatório gerado a partir de análise estática do repositório em 2026-07-20. Estimativas de
esforço assumem familiaridade com a base; valores de impacto refletem o estágio atual do
produto e devem ser recalibrados com os dados de telemetria propostos em S75.*
