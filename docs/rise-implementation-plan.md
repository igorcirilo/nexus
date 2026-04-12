# Rise Reference -> Plano de Implementacao

## Contexto
Este plano foi derivado da analise visual do pacote de referencias em [docs/rise-reference](C:\Users\VORPC\Desktop\nexus-v4\docs\rise-reference) e da folha de contato [rise-contact-sheet.jpg](C:\Users\VORPC\Desktop\nexus-v4\docs\rise-reference\rise-contact-sheet.jpg).

O produto aparente e um app mobile-first de transformacao pessoal com foco em:
- onboarding diagnostico e personalizacao profunda
- plano guiado de 66 dias
- rotina diaria com tarefas de habitos
- score, streak, XP, niveis e ligas
- academia de habitos com conteudo educacional e tarefas contextuais
- ferramentas utilitarias de apoio
- comunidade/feed
- monetizacao via free trial + assinatura

## Leitura consolidada das telas
As imagens sugerem os seguintes macrofluxos:
- `Onboarding`: introducao, pergunta sobre situacao atual, objetivos, travas, autoimagem, ambiente, rotina e prioridades.
- `Analise de perfil`: score inicial, mapa da vida, proposta de transformacao e prova social.
- `Plano`: calendario de 66 dias, semanas, tarefas recorrentes, ajustes de frequencia, edicao e exclusao.
- `Dia atual`: lista de tarefas do dia, concluido/pulado, CTA de conclusao, cards visuais e quick actions.
- `Gamificacao`: streak, trofeus, XP, score global, ranking por ligas e avaliacoes comparativas.
- `Academia de Habitos`: trilha de aprendizagem linear, licoes bloqueadas, leitura resumida, CTA para anexar o conteudo a um habito.
- `Ferramentas`: meditacao, bloqueador de tela, resumo de livros, pomodoro, contador de treinos, respiracao profunda, calorias, alarme.
- `Feed`: publico, amigos e meus posts; reacoes, comentarios, criacao de post.
- `Conta premium`: paywall, free trial, aviso de cobranca, onboarding premium, CTA para Discord/comunidade.

## Estado atual do `nexus-v4`
O projeto ja possui base relevante:
- autenticacao e persistencia via Supabase
- habitos, logs, check-ins, goals, financas, leitura e corpo
- algumas mecanicas de XP, badges, streak e liga semanal
- navegao multi-pagina em `src/app`

Lacunas em relacao ao produto observado:
- onboarding ainda e curto e pouco diagnostico
- falta um motor de plano de 66 dias
- falta score inicial e score evolutivo por pilares
- falta feed social real
- falta academia de habitos com trilha, licoes e vinculo com tarefas
- falta orquestracao de ferramentas como modulo unificado
- monetizacao e trial nao estao estruturadas

## Direcao de arquitetura

### 1. Principios
- manter `Next.js App Router` e `Supabase` como base
- modelar o produto como "programa + tarefas + progresso + conteudo + comunidade"
- evitar acoplamento entre onboarding, plano e feed
- centralizar regras de negocio em `src/lib` e manter componentes mais finos
- priorizar mobile web/PWA, com desktop como adaptacao secundaria

### 2. Dominios funcionais

#### Dominio A. Identidade e onboarding
Objetivo:
- diagnosticar o estado inicial do usuario
- gerar configuracao de programa
- produzir score e mapa da vida

Capacidades:
- sequencia de perguntas com progresso
- perguntas de escolha unica, multipla e texto livre
- rascunho local para retomada
- inferencia de perfil inicial
- geracao do programa da semana 1

Estruturas necessarias:
- `onboarding_flows`
- `onboarding_questions`
- `onboarding_responses`
- `user_assessments`
- `life_area_scores`

Frontend sugerido:
- `src/app/onboarding-v2/page.tsx`
- `src/components/onboarding/*`
- renderizador de perguntas por tipo

Backend/regra:
- `src/lib/onboarding-engine.ts`
- `src/lib/profile-assessment.ts`

#### Dominio B. Plano de 66 dias
Objetivo:
- transformar respostas em um programa progressivo de 66 dias

Capacidades:
- gerar plano por semana e por dia
- revisar e editar frequencia/intensidade
- pular, substituir ou remover tarefa
- vincular tarefa a area da vida, score e recompensa

Estruturas necessarias:
- `programs`
- `program_weeks`
- `program_days`
- `program_tasks`
- `task_templates`
- `task_adjustments`

Campos importantes:
- `program_id`
- `week_number`
- `day_number`
- `task_type`
- `difficulty`
- `frequency_rule`
- `source` (`generated`, `manual`, `academy`, `tool`)
- `status`

Frontend sugerido:
- `src/app/programa/page.tsx`
- `src/app/hoje/page.tsx` evoluindo para consumir `program_days/program_tasks`
- cards de tarefa com info, CTA, editar, pular e concluir

Backend/regra:
- `src/lib/program-engine.ts`
- `src/lib/task-scheduler.ts`

#### Dominio C. Progresso e gamificacao
Objetivo:
- dar feedback continuo e senso de progressao

Capacidades:
- streak diario
- XP por tarefa, licao e uso de ferramenta
- score por pilar
- ranking e ligas
- badges, trofeus e milestones

Estruturas necessarias:
- expandir `profiles`
- `xp_events`
- `streak_events`
- `user_rank_snapshots`
- `achievement_definitions`
- `user_achievements`
- `score_snapshots`

Observacao:
- parte da base ja existe, mas hoje esta distribuida e com foco mais tecnico do que de produto

Frontend sugerido:
- `src/app/progresso/page.tsx` como hub
- `src/components/progress/*`
- cards para score atual, score inicial vs atual, liga e medalhas

Backend/regra:
- `src/lib/gamification.ts`
- `src/lib/scoring.ts`

#### Dominio D. Academia de habitos
Objetivo:
- ensinar os principios comportamentais que sustentam a execucao

Capacidades:
- trilha de licoes sequenciais
- bloqueio por progresso
- pagina de licao
- CTA contextual do tipo "aplique esta licao a uma tarefa"
- checkpoint e quiz leve

Estruturas necessarias:
- `academy_tracks`
- `academy_lessons`
- `academy_lesson_steps`
- `user_lesson_progress`
- `lesson_task_links`

Frontend sugerido:
- `src/app/academia/page.tsx`
- `src/app/academia/[track]/[lesson]/page.tsx`
- mapa vertical de progresso

Backend/regra:
- `src/lib/academy.ts`

#### Dominio E. Ferramentas
Objetivo:
- oferecer utilitarios que melhoram execucao, foco, regulacao emocional e medicao

Ferramentas aparentes:
- meditacao
- respiracao guiada
- pomodoro
- bloqueador de tela
- contador de treinos
- contador de calorias
- alarme
- resumo de livros

Estrutura recomendada:
- tratar ferramentas como modulos plugaveis com:
  - definicao
  - estado do usuario
  - eventos de uso
  - vinculo opcional com tarefas

Estruturas necessarias:
- `tool_definitions`
- `tool_sessions`
- `tool_preferences`
- `tool_task_links`

Frontend sugerido:
- `src/app/ferramentas/page.tsx`
- `src/app/ferramentas/[slug]/page.tsx`

Backend/regra:
- `src/lib/tools/`

#### Dominio F. Feed social e comunidade
Objetivo:
- social proof, accountability e viralidade organica

Capacidades:
- feed publico/amigos/meus
- criar post com imagem, texto e contexto de tarefa
- reacoes, comentarios, contagem
- seguir usuarios
- notificacoes

Estruturas necessarias:
- `posts`
- `post_media`
- `post_reactions`
- `post_comments`
- `follows`
- `notifications`

Frontend sugerido:
- `src/app/feed/page.tsx`
- composer flutuante
- filtros `publico`, `amigos`, `meus`

Backend/regra:
- `src/lib/social.ts`

#### Dominio G. Billing e premium
Objetivo:
- operar free trial e assinatura sem quebrar o fluxo principal

Capacidades:
- ativar teste gratuito
- paywall contextual
- lembretes de cobranca
- gating por feature
- tela de boas-vindas premium

Estruturas necessarias:
- `subscriptions`
- `subscription_events`
- `feature_flags`
- `billing_reminders`

Integracao recomendada:
- Stripe

Frontend sugerido:
- `src/app/paywall/page.tsx`
- `src/app/pro/page.tsx`

Backend/regra:
- `src/lib/billing.ts`
- `src/lib/feature-access.ts`

## Estrutura de dados recomendada

### Tabelas novas prioritarias
- `user_assessments`
- `life_area_scores`
- `programs`
- `program_weeks`
- `program_days`
- `program_tasks`
- `xp_events`
- `score_snapshots`
- `academy_tracks`
- `academy_lessons`
- `user_lesson_progress`
- `posts`
- `post_reactions`
- `post_comments`
- `subscriptions`

### Tabelas existentes que pedem extensao
- `profiles`
- `habits`
- `habit_logs`
- `checkins`
- `reminders`

### Campos recomendados em `profiles`
- `trial_started_at`
- `trial_ends_at`
- `subscription_status`
- `initial_score`
- `current_score`
- `life_map`
- `program_id`
- `onboarding_version`

## Arquitetura de frontend sugerida

### Rotas-alvo
- `/onboarding-v2`
- `/analise-inicial`
- `/mapa-da-vida`
- `/programa`
- `/programa/semana/[week]`
- `/hoje`
- `/progresso`
- `/academia`
- `/academia/[track]/[lesson]`
- `/ferramentas`
- `/ferramentas/[slug]`
- `/feed`
- `/perfil`
- `/paywall`

### Pastas de componentes
- `src/components/onboarding`
- `src/components/program`
- `src/components/progress`
- `src/components/academy`
- `src/components/tools`
- `src/components/social`
- `src/components/billing`

### Estado e fetch
Padrao recomendado:
- server components para shells e carregamento inicial quando fizer sentido
- client components para interacao intensa
- helpers de dominio em `src/lib`
- adaptadores por modulo para Supabase

## Eventos e analytics recomendados
- `onboarding_started`
- `question_answered`
- `assessment_completed`
- `program_generated`
- `task_completed`
- `task_skipped`
- `lesson_started`
- `lesson_completed`
- `tool_session_started`
- `tool_session_completed`
- `post_created`
- `trial_started`
- `paywall_viewed`
- `subscription_started`

## Dependencias e necessidades tecnicas
- integrar storage de imagens para posts e avatares
- adicionar camada de seeds para conteudo inicial da academia
- criar migrations SQL para os novos modulos
- padronizar tipagem do banco em `src/types`
- definir estrategia de notificacoes:
  - web push/PWA
  - agendamentos server-side
- definir integracao de billing:
  - Stripe Checkout
  - webhook de sincronizacao de assinatura

## Riscos de implementacao
- o gerador de plano de 66 dias pode ficar "scriptado demais" sem criterios claros de adaptacao
- feed social e billing aumentam bastante o escopo operacional
- algumas ferramentas aparentes pedem capacidades nativas dificeis no browser, como bloqueio de apps e alarmes robustos
- ha risco de copiar interface sem validar quais recursos sao de fato essenciais para o MVP

## Recomendacao de recorte

### MVP realista
Entregar primeiro:
- onboarding diagnostico v2
- score inicial e mapa da vida
- plano de 66 dias
- rotina diaria
- XP/streak/score
- academia de habitos basica
- paywall simples

### Fase 2
- feed social
- ferramentas avancadas
- comunidade premium
- refinamento de ligas, trofeus e comparativos

## Sequencia recomendada de implementacao
1. Modelagem de dados e migrations.
2. Motor de onboarding e assessment.
3. Geracao de programa de 66 dias.
4. Refactor de `Hoje` para tarefas do programa.
5. Camada de score, XP e snapshots.
6. Academia de habitos com seed de licoes.
7. Billing/trial/paywall.
8. Feed social.
9. Ferramentas modulares.
10. Polimento visual e experimentos de retencao.

## Definicao de pronto por modulo
- dados persistidos no Supabase
- tela funcional em mobile
- regra de negocio encapsulada em `src/lib`
- estados vazios e erros tratados
- eventos analiticos disparados
- pelo menos 1 fluxo completo manualmente validado
