# NEXUS — Visão Geral do Projeto

> Documentação derivada de análise de código (somente-leitura). Legenda:
> **[C]** confirmado pelo código · **[I]** inferência · **[?]** não confirmado.

## O que é

**NEXUS** é um **PWA de desenvolvimento pessoal gamificado** ("o teu sistema diário
de alta performance"), construído em **Next.js 14 (App Router) + TypeScript +
Supabase**. Consolida num único app: hábitos, check-ins diários, um programa de
63 dias gerado a partir de um onboarding/assessment, treino + dieta + peso,
finanças (com import de PDF/planilha), leitura (e-reader), objetivos de 90 dias,
calendário/lembretes e uma camada de gamificação (XP, níveis, streaks, badges,
liga semanal). **[C]**

- **Idioma:** português (pt-PT). **[C]**
- **Público-alvo [I]:** indivíduos de "self-improvement", uso mobile-first (PWA).
- **Problema que resolve [I]:** evita fragmentação de hábitos/treino/finanças/
  leitura em vários apps, unificando tudo num "sistema operativo pessoal" com
  feedback diário e progresso medido.

## Áreas de vida (domínio central)

Sete áreas (`HabitArea` em `src/types/index.ts:39`): `corpo`, `produtividade`,
`idiomas`, `carreira`, `financas`, `emocoes`, `relacionamentos`.

## Funcionalidades principais (confirmadas)

1. **Onboarding/Assessment** → score por área (0–100) — `lib/onboarding-engine.ts`,
   `lib/profile-assessment.ts`, `/onboarding-v2`, `/analise-inicial`.
2. **Programa de 63 dias** (9 semanas) gerado do assessment — `lib/program-engine.ts`,
   `lib/assessment-to-program.ts`, `/programa`.
3. **Hoje** (hub diário), **Hábitos**, **Check-in** manhã/tarde/noite.
4. **Corpo** (`/corpo`): Treino, Dieta, Peso (gráfico Recharts).
5. **Finanças** (`/financas`): transações + import de extrato **PDF e planilha/CSV**.
6. **Leitura** (`/leitura`, `/leitura/[id]`): e-reader com destaques/notas/marcadores.
7. **Objetivos** 90d, **Calendário/Agenda**, **Lembretes**.
8. **Progresso** (estatísticas) e **Perfil**.
9. **Gamificação:** XP/nível/streak/badges + **liga semanal** (Bronze→Lenda).
10. **Mentor** (`lib/mentor.ts`): coaching **baseado em regras (sem IA)**.

## Estado atual

Após o PR #1 (recovery & cleanup): **build, lint, typecheck e testes verdes**.
Dívidas principais: schema de BD parcialmente versionado, `lib/supabase.ts`
monolítico, ausência de CI e de testes de UI/integração. Ver
[`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md).

## Documentos relacionados

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitetura, rotas, dados, fluxos.
- [`SETUP.md`](./SETUP.md) — instalar, rodar, testar, buildar.
- [`API_AND_INTEGRATIONS.md`](./API_AND_INTEGRATIONS.md) — Supabase, env, integrações.
- [`TECHNICAL_DEBT.md`](./TECHNICAL_DEBT.md) — problemas, riscos e recomendações.
