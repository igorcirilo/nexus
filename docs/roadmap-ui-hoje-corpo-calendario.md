# Roadmap UI/UX — Páginas Hoje, Corpo e Calendário

> **Para o agente executor:** Este documento é a fonte da verdade. Execute as fases **em ordem**. Cada tarefa tem um `ID`, arquivos-alvo, instruções e **critério de aceite**. Não pule critérios de aceite. Não refatore lógica de negócio (Supabase, XP, streak, queries) — apenas a camada de apresentação, salvo quando explicitamente indicado.

---

## Princípios globais (valem para TODAS as tarefas)

1. **Idioma:** toda UI visível ao usuário em português (PT).
2. **Não quebrar dados:** não altere assinaturas de funções em `src/lib/*` nem queries Supabase, exceto quando a tarefa pedir.
3. **Stack:** Next.js App Router + React client components. Estilo é inline-style (padrão atual do projeto) — manter consistência, **não introduzir Tailwind** sem necessidade.
4. **Tokens de cor existentes:** `--bg0`, `--bg1`, `--bg2`, `--bg3`, `--border`, `--text1`, `--text2`, `--text3`, `--accent` (roxo), `--teal`, `--gold`. Use sempre tokens, nunca hex cru novo.
5. **Fontes:** `Syne` (headings, `fontFamily: 'Syne, sans-serif'`), `DM Sans` (body, `var(--font-dm)`).
6. **Ícones:** **proibido emoji como ícone estrutural.** Usar SVG (seguir o padrão de `src/components/Nav.tsx`). Emoji só é permitido em conteúdo expressivo pontual (ex: 🔥 do streak), nunca como ícone de navegação/tab/card.
7. **Toque mínimo:** alvos clicáveis ≥ 44×44px. Adicionar `touch-action: manipulation` em botões.
8. **Acessibilidade:** todo `<button>` icon-only precisa de `aria-label`. Cor nunca é o único indicador de estado.
9. **Cada tarefa deve compilar** (`npm run build` ou `npm run lint`) antes de marcar como concluída.

---

## FASE 0 — Fundação do Design System

Criar componentes reutilizáveis primeiro. As fases seguintes dependem deles.

### T0.1 — Mapa central de ícones SVG
**Arquivo novo:** `src/components/ui/Icon.tsx`
- Criar um componente `<Icon name="..." size={16} color="..." />` que renderiza SVGs no padrão de `Nav.tsx` (stroke 1.8, viewBox 0 0 24 24).
- Ícones necessários (mínimo): `zap` (energia), `target` (hábitos/missão), `clipboard` (check-in), `flame` (streak), `dumbbell` (treino), `salad` (dieta), `scale` (peso), `calendar`, `check`, `bell`, `list`, `trend-up`, `trend-down`, `plus`, `chevron-left`, `chevron-right`, `x`.
- Exportar tipo `IconName` com union de strings.
- **Critério de aceite:** importável em qualquer página; renderiza SVG nítido; aceita `size` e `color`.

### T0.2 — Escala de tipografia e espaçamento (tokens)
**Arquivo:** `src/app/globals.css`
- Adicionar ao `:root`:
  ```css
  --text-xs: 10px; --text-sm: 12px; --text-base: 14px;
  --text-md: 16px; --text-lg: 18px; --text-xl: 22px;
  --space-1: 4px; --space-2: 8px; --space-3: 12px;
  --space-4: 16px; --space-6: 24px; --space-8: 32px;
  --radius-sm: 10px; --radius-md: 14px; --radius-lg: 20px;
  ```
- **Critério de aceite:** variáveis disponíveis globalmente. (Não é necessário refatorar todos os valores inline existentes nesta tarefa.)

### T0.3 — Skeleton loading
**Arquivo novo:** `src/components/ui/Skeleton.tsx`
- Exportar `<SkeletonCard height={number} />` e `<SkeletonRow count={number} />`.
- Usar shimmer com `@keyframes` (animação de opacidade/gradiente). Respeitar `prefers-reduced-motion` (sem animação se reduzido).
- Cores: base `var(--bg2)`, highlight `var(--bg3)`.
- **Critério de aceite:** componente reserva espaço (evita CLS), anima suavemente, desliga animação com reduced-motion.

### T0.4 — Bottom Sheet reutilizável
**Arquivo novo:** `src/components/ui/BottomSheet.tsx`
- Props: `open: boolean`, `onClose: () => void`, `title?: string`, `children`.
- Overlay com scrim `rgba(0,0,0,.5)`, painel ancorado embaixo, `max-width: 512px` centrado, `border-radius: 20px 20px 0 0`, handle de arraste no topo.
- Fechar ao clicar no scrim e via botão. `aria-modal`, foco gerenciado.
- **Critério de aceite:** abre/fecha; clicar fora fecha; conteúdo arbitrário renderiza. (Vai substituir os overlays inline existentes.)

### T0.5 — StatCard e SectionHeader
**Arquivos novos:** `src/components/ui/StatCard.tsx`, `src/components/ui/SectionHeader.tsx`
- `StatCard`: props `icon: IconName`, `label`, `value`, `suffix?`, `color`. Layout: ícone em quadrado colorido + label + valor. (Substitui os 3 cards inline da Hoje.)
- `SectionHeader`: props `title`, `action?: { label, onClick }`. Título Syne 16px + ação opcional à direita.
- **Critério de aceite:** ambos usam `<Icon>` (sem emoji), respeitam tokens.

---

## FASE 1 — Página Hoje (prioridade ALTA)

Arquivo principal: `src/app/hoje/page.tsx`

### T1.1 — Substituir `prompt()` por BottomSheet
- **Localização atual:** `src/app/hoje/page.tsx:424-434` (botão "Adicionar tarefa manual" usa `prompt()` nativo).
- Criar `src/components/hoje/AddTaskSheet.tsx` usando `<BottomSheet>` (T0.4) com input de texto real + seletor de área + botão "Criar tarefa".
- Manter a chamada a `createManualTask(...)` intacta.
- Microcopy do botão: `＋ Nova tarefa`.
- **Critério de aceite:** criar tarefa sem `prompt()` nativo; tarefa aparece na lista; XP/área corretos.

### T1.2 — Skeleton loading na Hoje
- **Localização atual:** `src/app/hoje/page.tsx:196-202` (loading = texto "A carregar...").
- Criar `src/app/hoje/loading.tsx` com skeletons: hero (60px), XP bar (40px), 3 stat cards em row, 2 task cards (120px cada).
- Substituir o bloco de loading inline pelo mesmo skeleton (ou deixar `loading.tsx` cuidar).
- **Critério de aceite:** sem texto "A carregar..."; layout não salta (CLS baixo).

### T1.3 — Trocar emojis dos stat cards por SVG
- **Localização atual:** `src/app/hoje/page.tsx:261-278` (cards com `⚡ 🎯 📋`).
- Refatorar para usar `<StatCard>` (T0.5) com ícones `zap`, `target`, `clipboard`.
- **Critério de aceite:** zero emoji nos stat cards; ícones SVG consistentes.

### T1.4 — Hierarquia: Próxima Ação em destaque
- Criar `src/components/hoje/NextActionCard.tsx`: card único proeminente (borda colorida + leve glow) que mostra a "próxima melhor ação".
- Fonte de dados: reaproveitar `getMentorMessage(...)` (já calculado em `page.tsx:184-194`) — campo `action`.
- Posicionar **logo após os stat cards**, acima do MentorCard atual.
- O `MentorCard` (`body`) continua abaixo como contexto secundário.
- **Critério de aceite:** existe 1 (e apenas 1) elemento de destaque visual acima da dobra além do hero/XP.

### T1.5 — Compactar "Desafio da Semana"
- **Localização atual:** `src/app/hoje/page.tsx:280-316`.
- Transformar em accordion fechado por padrão (título + progresso visível; detalhes expandem ao tocar) **ou** mover para depois da lista de tarefas.
- **Critério de aceite:** o bloco não compete por atenção acima da dobra; progresso ainda visível em estado fechado.

### T1.6 — Estado vazio "sem programa" acionável
- **Localização atual:** `src/app/hoje/page.tsx:331-344` (bloco `noProgram`).
- Reaproveitar `src/components/EmptyState.tsx` se aplicável. Garantir CTA claro para `/onboarding` (NÃO `/onboarding-v2` — a rota foi consolidada).
- Microcopy: título "Complete seu diagnóstico", corpo "Responda algumas perguntas para receber seu plano personalizado de 63 dias.", botão "Começar diagnóstico".
- **Critério de aceite:** link aponta para `/onboarding`; visual alinhado ao design system.

### T1.7 — Acessibilidade dos botões de tarefa
- **Localização atual:** botões "Pular" / "Feito ✓" (`page.tsx:392-419`).
- Garantir ≥44px de altura de toque; adicionar `aria-label` descritivo; `touch-action: manipulation`.
- **Critério de aceite:** alvos ≥44px; labels lidos por screen reader.

---

## FASE 2 — Página Corpo (prioridade ALTA/MÉDIA)

Arquivo principal: `src/app/corpo/page.tsx`

### T2.1 — Hero de resumo corporal
- Criar `src/components/corpo/BodyHeroSection.tsx`: exibido **acima das tabs**.
- Mostrar: peso atual + tendência (seta `trend-up`/`trend-down` com delta vs. registro anterior), nº de treinos na semana, último registro.
- Buscar dados existentes (peso via `WeightLog`/lib; treinos via `getTrainingPlans`/logs). Se não houver dado, mostrar estado vazio compacto, não quebrar.
- **Critério de aceite:** ao entrar na página, usuário vê resumo do próprio corpo sem trocar de tab.

### T2.2 — Trocar emojis das tabs por SVG
- **Localização atual:** `src/app/corpo/page.tsx:12-16` (`🏋️ 🥗 ⚖️`).
- Substituir por `<Icon name="dumbbell|salad|scale">`.
- **Critério de aceite:** zero emoji nas tabs.

### T2.3 — Skeleton loading na Corpo
- **Localização atual:** `src/app/corpo/page.tsx:51-57`.
- Criar `src/app/corpo/loading.tsx` (hero skeleton + tab bar + bloco de conteúdo).
- **Critério de aceite:** sem texto "A carregar…".

### T2.4 — Estados vazios melhorados (Treino/Dieta/Peso)
- Em cada tab sem dados, usar `<EmptyState>` com microcopy que explica o fluxo antes do CTA:
  - Treino: "Adicione um plano de treino para acompanhar sua evolução semana a semana."
  - Dieta: "Monte ou importe um plano para registrar suas refeições."
  - Peso: "Registre seu peso hoje e acompanhe sua tendência ao longo do tempo."
- **Critério de aceite:** nenhum estado vazio é um dead-end; todos têm CTA + explicação.

### T2.5 — Indicador de consistência semanal (opcional dentro da fase)
- No hero ou abaixo das tabs, mostrar um número composto de consistência da semana (ex: treinos feitos / meta).
- **Critério de aceite:** métrica acionável, não decorativa (mostra progresso real da semana).

---

## FASE 3 — Página Calendário (prioridade MÉDIA)

Arquivo principal: `src/app/calendario/page.tsx` (**949 linhas — ver T3.1 antes de tudo**)

### T3.1 — Refatorar em subcomponentes (pré-requisito)
- Extrair de `src/app/calendario/page.tsx` para `src/components/calendario/`:
  - `CalendarGrid.tsx` (vista mensal + semanal / heatmap)
  - `DayPanel.tsx` (painel do dia selecionado — atual `DayPanel` interno)
  - `CheckinTab.tsx`, `RemindersTab.tsx`, `AgendaTab.tsx`
- Manter `page.tsx` como orquestrador (estado + handlers). **Sem mudança de comportamento** nesta tarefa — é refatoração pura.
- **Critério de aceite:** comportamento idêntico ao atual; `page.tsx` < ~250 linhas; build passa.

### T3.2 — Aumentar indicadores dos dias
- **Localização atual:** `src/app/calendario/page.tsx:670-676` (pontos de 3px).
- Aumentar para ≥6px e/ou usar um único indicador sólido legível no mobile.
- **Critério de aceite:** indicadores distinguíveis a olho nu em tela 375px.

### T3.3 — Rótulos na legenda do heatmap
- **Localização atual:** `src/app/calendario/page.tsx:682-701`.
- Adicionar rótulos textuais nas extremidades: "Nenhum" → "Completo".
- **Critério de aceite:** usuário entende a escala sem adivinhar.

### T3.4 — Trocar emojis dos tabs e toggle por SVG
- **Localização atual:** tabs `📅 ✅ 🔔 📋` (`page.tsx:380-385`) e toggle `📅 Mês / 📆 Semana` (`page.tsx:635`).
- Substituir por `<Icon>`. Emojis de fase (🌅☀️🌙) podem permanecer como conteúdo expressivo, mas avaliar trocar por ícones se quiser consistência total.
- **Critério de aceite:** zero emoji em tabs/toggle de navegação.

### T3.5 — Acessibilidade dos controles
- Botões de seta `‹ ›` (`page.tsx:644,653,709,713`) e `×` da agenda (`page.tsx:569`): adicionar `aria-label` ("Mês anterior", "Próximo mês", "Remover evento"); garantir ≥44px.
- Cada dia do calendário: `aria-label` com data + status (não depender só de cor).
- **Critério de aceite:** navegável por teclado/screen reader; alvos ≥44px.

### T3.6 — Skeleton loading no Calendário
- **Localização atual:** `page.tsx:588-592`.
- Criar `src/app/calendario/loading.tsx` (header + grid de calendário skeleton).
- **Critério de aceite:** sem texto "a carregar…".

### T3.7 — Mover/repensar tab "Check-in" (decisão de produto)
- A tab "Check-in" dentro do Calendário é semanticamente estranha. **Opção A:** mover o check-in rápido para a Hoje (FAB ou card). **Opção B:** manter, mas só se houver justificativa.
- ⚠️ **Confirmar com o Igor antes de remover** — é mudança de navegação. Implementar só após decisão.
- **Critério de aceite:** decisão registrada; se mover, check-in funciona no novo local sem perder a lógica `doQuickCheckin`.

---

## FASE 4 — Navegação global (prioridade ALTA, transversal)

### T4.1 — Reduzir bottom nav para ≤5 itens
- **Localização atual:** `src/components/Nav.tsx:6-16` (9 itens — viola regra de máx. 5).
- Manter visíveis: **Hoje, Hábitos, Corpo, Progresso** + um item "Mais" (`···`) que abre drawer/sheet com os secundários (Calendário, Finanças, Leitura, Objetivos, Perfil).
- Reusar `<BottomSheet>` (T0.4) para o drawer "Mais".
- Preservar estado ativo (`usePathname`) e ícones SVG já existentes.
- **Critério de aceite:** nav inferior com ≤5 itens; todos os destinos antigos ainda alcançáveis via "Mais"; item ativo destacado.

---

## FASE 5 — Refinamentos (prioridade BAIXA)

- **T5.1** Animação leve (confetti/scale) ao completar todas as tarefas da Hoje. Respeitar `prefers-reduced-motion`.
- **T5.2** Swipe-to-complete nas task cards da Hoje (com fallback de botão visível — não pode ser gesture-only).
- **T5.3** Banner offline (`navigator.onLine === false`): "Sem conexão — dados podem estar desatualizados."
- **T5.4** Card de "Revisão semanal" na Hoje aos domingos, usando a lógica de padrões já existente no Calendário (`getPatternInsights`).
- **T5.5** Auditoria formal de contraste dark mode (texto secundário ≥3:1, primário ≥4.5:1).

---

## Ordem de execução recomendada

```
FASE 0  (fundação)        → bloqueia todo o resto
FASE 1  (Hoje)            → maior impacto percebido
FASE 4  (Nav)             → transversal, melhora todas as telas
FASE 2  (Corpo)
FASE 3  (Calendário)      → começar SEMPRE por T3.1 (refactor)
FASE 5  (refinamentos)
```

## Checklist de "Definition of Done" por tarefa
- [ ] Sem emoji como ícone estrutural
- [ ] Tokens de cor/tipografia usados (sem hex/valores mágicos novos)
- [ ] Alvos de toque ≥44px + `aria-label` onde icon-only
- [ ] `prefers-reduced-motion` respeitado em animações
- [ ] `npm run build` / `lint` passa
- [ ] Comportamento de dados (Supabase/XP/streak) inalterado
- [ ] Testado mentalmente em 375px (mobile-first)
