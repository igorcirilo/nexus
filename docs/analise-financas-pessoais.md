# Análise de produto — Área de Finanças Pessoais (Nexus)

> Data: 2026-07-01 · Base da análise: código real do repositório
> (`src/app/financas/page.tsx`, `src/lib/finance.ts`, `src/lib/csv-parser.ts`,
> `src/lib/pdf.ts`, `src/components/QuickAction.tsx`,
> `src/components/hoje/MetricsGrid.tsx`, `supabase/financas_budgets_v1.sql`,
> tipos em `src/types/index.ts`).

## O que existe hoje (inventário factual)

- **Uma única página** `/financas` com: hero "Saldo do mês" (entradas − saídas
  do mês corrente), resumo de orçamento, dois cards de metas (reserva de
  emergência e poupança mensal), 5 movimentos recentes.
- **Sheets** (bottom sheets) para: movimentos completos (pesquisa, filtros por
  tipo e top-6 categorias, agrupamento por dia com saldo diário), gestão de
  orçamento (gauge global, ritmo vs. dia do mês, sugestões automáticas =
  média de 3 meses × 1,05), orçamento por categoria (com sparkline de 4
  meses), metas, nova transação, edição/apagar com confirmação.
- **Registo manual** com chips de categoria + categoria personalizada, e
  registo rápido via FAB global (`QuickAction`) a partir de qualquer página.
- **Importação**: CSV (deteção automática de colunas + pré-visualização) e PDF
  de extrato (parser com categorização por palavras-chave, ex.
  `netflix|spotify → Assinaturas`).
- **Dados**: tabela `transactions` (data, tipo entrada/saída, categoria,
  descrição, valor); orçamentos em `profiles.fin_budgets` (JSONB, com cache
  localStorage); metas em `fin_monthly_save`, `fin_reserve_goal`,
  `fin_current_savings` (e `fin_debt_goal`, **definido no tipo mas não usado
  em lado nenhum**).
- **Insights existentes**: "dentro/acima do ritmo" do orçamento, dica
  "Mentor" com projeção de quando a reserva fica completa (escondida no sheet
  de poupança), sugestões de orçamento e de reserva 3–6× despesas.
- **Integração**: card "Finanças · saldo" no dashboard Hoje.

### Suposições assumidas (não verificáveis no código)

1. App de uso pessoal/single-user por perfil, mercado PT (EUR e pt-PT
   hardcoded), sem integração bancária (Open Banking) — só manual + CSV/PDF.
2. Não existe hoje sistema de notificações push para finanças (a área
   `/lembretes` existe mas não encontrei ligação a finanças).
3. Ainda não há modelo de negócio/premium ativo — a secção 10 é prospetiva.

---

## 1. Diagnóstico geral

A área de finanças está **acima da média para um MVP manual**: a hierarquia
(saldo → orçamento → metas → movimentos) é correta, os estados vazios ensinam
o próximo passo, as sugestões automáticas de orçamento com base na média de 3
meses são um diferencial real, e a importação CSV/PDF com pré-visualização é
rara em apps deste estágio. A separação de cálculos puros em `finance.ts` com
testes é boa base de engenharia.

Os três problemas estruturais são:

1. **O app regista, mas quase não interpreta.** Os dados para insights já são
   calculados (médias 3m, ritmo, dias restantes, série de 6 meses) mas ficam
   escondidos dentro de sheets ou nem são mostrados. Não há resposta na tela
   principal à pergunta nº 1 do utilizador: *"estou bem ou mal este mês, e
   como termino o mês?"*
2. **Fricção recorrente não resolvida.** Salário, renda, prestações e
   assinaturas têm de ser reintroduzidos à mão todos os meses. É a principal
   causa de abandono em apps de registo manual: ao 2º mês o histórico fica
   incompleto, os gráficos ficam errados e o utilizador desiste.
3. **Horizonte temporal curto e fixo.** A lista de movimentos só carrega 2
   meses (`getTransactions(userId, 2)`), não há navegação entre meses nem
   comparação explícita com o mês anterior na tela principal — a comparação
   só existe implícita num gráfico dentro do sheet de poupança.

---

## 2. Principais problemas e riscos de experiência

Ordenados por gravidade:

| # | Problema | Evidência no código | Risco |
|---|---|---|---|
| P1 | **"Saldo do mês" é ambíguo** — é o *líquido do mês* (entradas−saídas), não o saldo da conta. O card no Hoje diz só "Finanças · saldo". | `balance = totalIn - totalOut` (page.tsx:228); `MetricsGrid` label "saldo" | Utilizador interpreta como saldo bancário, perde confiança nos números ("isto está errado") |
| P2 | **Sem transações recorrentes** — não existe conceito de recorrência no modelo de dados; "Assinaturas" é só uma categoria | `Transaction` em types/index.ts; nenhum campo `recurring` | Fricção mensal → dados incompletos → insights errados → churn |
| P3 | **Sem previsão de fim de mês** — `daysLeft` é calculado mas nunca usado para projetar o saldo | page.tsx:230-232 | O insight mais acionável ("vais acabar o mês negativo") não existe |
| P4 | **Movimentos limitados a 2 meses, sem paginação** — pesquisa e filtros não encontram nada mais antigo; o total filtrado engana | `getTransactions(userId, 2)` (page.tsx:186) | "Onde está a compra de março?" → beco sem saída |
| P5 | **Meta de poupança conta como despesa** — mover €200 para "Poupança" aumenta as "Saídas" e reduz o "Saldo do mês", mas é o comportamento que o app pede para atingir a meta. Poupar *piora* o número principal. | `savedThisMonth` filtra `type==='saida' && category==='Poupança'` (page.tsx:326) | Incoerência conceptual que confunde e desmotiva exatamente o comportamento desejado |
| P6 | **Gauge do orçamento ignora gasto não orçamentado** — `buildBudgetSummary` soma só categorias com orçamento; posso estar "dentro do ritmo" a verde enquanto sangro dinheiro em categorias sem orçamento | finance.ts:97-99 | Falsa sensação de controlo — o pior tipo de erro num app financeiro |
| P7 | **`fin_current_savings` é manual e diverge** — registar movimentos "Poupança" não atualiza a reserva acumulada; o utilizador tem de editar a meta à mão | page.tsx:492-494 | Dois números que deviam ser um; a reserva fica desatualizada e o anel de progresso mente |
| P8 | **Insights enterrados** — a projeção "Mentor" e o histórico de poupança de 6 meses só aparecem dentro do sheet da meta de poupança | page.tsx:1369-1403 | O melhor conteúdo do app tem descoberta ~zero |
| P9 | **Categorização automática só no PDF** — o parser de PDF tem keywords, mas o registo manual e o CSV não sugerem categoria pela descrição, nem aprendem ("Continente" → Alimentação) | pdf.ts:177 vs. csv-parser/addTx | Cada registo manual custa 2 toques a mais; CSVs importados caem em "Outro" |
| P10 | **Sem exportação** — importa CSV/PDF mas não exporta nada | ausência em page.tsx | Sensação de lock-in; mina a confiança (secção 7) |
| P11 | Página monolítica de 1.410 linhas com estilos inline e categorias duplicadas em `QuickAction.tsx` | page.tsx:29 vs QuickAction.tsx:20 | Velocidade de iteração cai; risco de divergência (já há 2 cópias das listas) |

---

## 3. Oportunidades de melhoria

- **Transformar dados já calculados em narrativa.** 80% dos insights da
  secção 7 usam dados que o código **já computa** (`avgExpenses3m`,
  `catAvg3m`, `catMonthly`, `monthlySavings`, ritmo). É trabalho de
  apresentação, não de infraestrutura — o melhor rácio esforço/impacto de
  todo o backlog.
- **Recorrências como motor de retenção**: recorrentes geram (a) menos
  fricção, (b) previsão de fim de mês credível, (c) painel de assinaturas,
  (d) contas a pagar — quatro features com um só modelo de dados.
- **`fin_debt_goal` já existe no schema** e não é usado: acompanhamento de
  dívida é um caso de uso emocionalmente forte e o campo está lá.
- **O FAB global (`QuickAction`) já regista transações de qualquer página** —
  é a base perfeita para o hábito diário de registo; falta só reduzir o
  formulário a 2 toques e ligá-lo a um lembrete.
- **Ecossistema Nexus**: o app já cruza hábitos, corpo e leitura. Finanças
  pode entrar no check-in diário ("registaste os gastos de hoje?") — nenhum
  concorrente puro de finanças tem esse contexto.

---

## 4. Sugestões para a tela principal

Ordem proposta (de cima para baixo):

1. **Hero renomeado e com projeção.** Trocar "Saldo do mês" por **"Balanço do
   mês"** (ou "Sobrou este mês") e acrescentar uma linha de projeção:
   *"Ao ritmo atual terminas o mês com ≈ €X"* (verde/vermelho).
   - *Problema que resolve:* P1 e P3.
   - *Como:* `projeção = totalIn_previsto − (totalOut/diaDoMês × diasNoMês)`;
     com recorrentes (secção 8), somar as ainda-por-acontecer em vez de
     extrapolar linearmente.
   - *Porquê:* responde à pergunta nº 1 do utilizador sem um toque.
   - *Impacto:* sessão principal passa de "consulta" a "orientação"; é o
     insight com maior taxa de screenshot/partilha em apps concorrentes.
2. **Comparação com o mês anterior no hero**: badge "▲ +12% gastos vs.
   junho" ao lado das Saídas. Os dados de 6 meses já estão em `history`.
3. **Faixa de insight rotativa** (1 card, não um feed): o insight mais
   relevante do dia (ver secção 7) entre o hero e o orçamento.
4. **Orçamento**: manter o card, mas o gauge deve incluir uma linha
   secundária *"+€X fora do orçamento"* quando `unbudgetedCats` têm gasto
   (corrige P6 sem mudar o gauge).
5. **Metas**: manter os dois cards; no card de reserva, atualizar
   `fin_current_savings` automaticamente com os movimentos "Poupança"
   (com opção de ajuste manual) — corrige P7.
6. **Movimentos recentes**: manter (está bom), mas o "Ver todos" deve abrir
   a lista com **navegação por mês** (‹ junho ›) e carregamento sob demanda —
   corrige P4.
7. **Navegação temporal global**: um seletor de mês no header da página
   (‹ julho 2026 ›) que recalcula hero + orçamento para meses passados.
   `subMonths`/`addMonths` já estão importados; as funções de `finance.ts`
   já aceitam intervalos arbitrários.

## 5. Sugestões para o cadastro de receitas e despesas

1. **Teclado numérico primeiro, valor em destaque.** O sheet atual abre com
   tipo → valor → categoria → descrição → data. Inverter para: valor gigante
   no topo (como já é no sheet de *edição*, page.tsx:1165) com teclado aberto,
   categorias logo abaixo, tipo default "saída" (é ~90% dos registos), data
   default hoje escondida atrás de "Hoje ▾". Meta: **registo em ≤ 5 segundos
   e 3 toques** (valor → categoria → guardar).
2. **Sugestão de categoria pela descrição** (P9): reutilizar o dicionário de
   keywords do `pdf.ts` como função partilhada `suggestCategory(description)`
   usada no registo manual, no CSV e no PDF; depois, aprender por utilizador
   (guardar par descrição→categoria escolhida e sugerir na próxima).
3. **"Repetir todos os meses?"** — toggle no formulário que cria a regra
   recorrente (secção 8). É o ponto de captura natural: a pessoa está a
   registar a renda e o app pergunta uma vez.
4. **Últimas categorias usadas primeiro** nos chips (hoje a ordem é fixa);
   para a maioria, 3 categorias cobrem 80% dos registos.
5. **Unificar o formulário**: extrair um `<TransactionForm>` partilhado entre
   `/financas` e `QuickAction` (hoje são duas implementações com listas de
   categorias duplicadas — P11).

## 6. Sugestões de gráficos, cards e indicadores

Hoje só existem: barra de poupança 6m (escondida no sheet), sparkline 4m por
categoria (escondida no sheet de orçamento), gauges. Propostas:

1. **Donut/barra "Para onde foi o dinheiro"** na tela principal: top 5
   categorias do mês com % e valor (`spentByCat` já existe; `CAT_COLORS` já
   está definido e subutilizado). É o gráfico que os utilizadores mais
   procuram e não existe.
2. **Barras entradas vs. saídas 6 meses** na tela principal (os dados
   `monthlyChart` já têm `entradas` e `saidas` — só a `poupanca` é
   renderizada hoje).
3. **Linha de gasto acumulado do mês vs. ritmo do orçamento** (eixo X = dia
   do mês, linha real vs. linha ideal): torna visível o conceito
   "dentro/acima do ritmo" que hoje é só uma palavra.
4. **Indicador de taxa de poupança** (% do rendimento poupado no mês) — número
   único, comparável mês a mês, padrão da indústria.
5. Cadência: **diária** = balanço + projeção + último movimento; **semanal**
   = gasto da semana vs. semana anterior + categoria destaque; **mensal** =
   fecho do mês (ver secção 7).

## 7. Sugestões de insights automáticos

Regras determinísticas (sem IA) por ordem de valor; quase tudo usa dados já
computados:

| Insight | Regra | Dados já existem? |
|---|---|---|
| "Ao ritmo atual terminas o mês com **−€120**" | projeção linear ou com recorrentes | Sim (totais + dias) |
| "Gastaste **+18% em Alimentação** vs. a tua média" | `spentByCat[c]` vs. `catAvg3m[c]`, threshold ±15% | Sim |
| "Estás a **€40 de estourar o orçamento de Lazer**" | `pct ≥ 85` por categoria | Sim (já pinta chips; falta virar notificação/insight) |
| "**Poupaste mais** do que no mês passado 🎉" | `monthlySavings` mês n vs. n−1 | Sim |
| "A tua maior despesa recorrente é **Assinaturas: €47/mês**" | requer recorrentes | Não (secção 8) |
| "**Cobrança incomum**: €89 em Contas — 3× o teu normal" | valor > média+2σ da categoria, ou 1ª ocorrência de descrição com valor alto | Parcial |
| "Há **5 dias que não registas** movimentos" | max(date) vs. hoje | Sim |
| **Fecho do mês** (dia 1): resumo do mês anterior — balanço, top categoria, poupança, comparação | `monthlySavings` + `categoryTotals` | Sim |

Implementação sugerida: função pura `buildInsights(txs, budgets, goals) →
Insight[]` em `finance.ts` (testável como o resto), com score de relevância;
a tela principal mostra o top-1, o fecho do mês mostra todos.

## 8. Funcionalidades recomendadas

1. **Transações recorrentes** (a mais importante). Tabela
   `recurring_rules` (categoria, valor, dia do mês, tipo, descrição, ativa).
   Materializar no load do mês ("Confirmar: Renda €650 — pago? ✓/editar/saltar")
   em vez de inserir silenciosamente — mantém o utilizador no controlo e
   serve de *contas a pagar*.
2. **Painel de assinaturas** derivado das recorrentes + deteção de padrões
   no histórico (mesma descrição/valor em meses consecutivos): total mensal,
   lista, "quanto pagas por ano". Alta perceção de valor, custo baixo depois do nº 1.
3. **Previsão de saldo até fim do mês** (secção 4.1).
4. **Categorização automática partilhada + aprendizagem** (secção 5.2).
5. **Exportação CSV** (P10): um botão no menu ⋯ que descarrega as transações
   do período — trivial e crítico para confiança.
6. **Navegação por mês + paginação de movimentos** (P4).
7. **Meta de dívida**: usar o `fin_debt_goal` órfão — card opcional com
   progresso de amortização.
8. **Integração bancária (Open Banking PT — Tink/GoCardless/SIBS API
   Market)**: só como grande aposta (secção 11); o modo manual + CSV/PDF já
   cobre o essencial e a integração traz custo regulatório e de manutenção
   desproporcional para o estágio atual. Manter sempre o modo manual como
   primeira classe.
9. **Educação financeira contextual**: o tom "Mentor" já existe — expandir
   para micro-dicas no fecho do mês (ex. regra 50/30/20 aplicada aos números
   reais da pessoa), não uma secção separada de artigos.

## 9. Estratégia de engajamento e retenção

- **Hábito nuclear = registo diário em <5s** (secção 5.1) + lembrete
  opcional às 21h "30 segundos: registas os gastos de hoje?" — silenciar
  automaticamente se o utilizador já registou nesse dia. Nunca mais de 1
  notificação/dia.
- **Streak de registo** (dias consecutivos com movimentos ou "dia sem
  gastos" confirmado): o Nexus já é um app de hábitos — finanças deve usar o
  mesmo mecanismo mental, e "finanças" já é uma `HabitArea` no QuickAction.
- **Fecho do mês como ritual**: no dia 1, notificação + ecrã de resumo
  (secção 7) com 1 vitória destacada ("poupaste €130 🎉"). É o momento de
  maior emoção do ciclo — hoje o app não faz nada nessa data.
- **Marcos de metas**: 25/50/75/100% da reserva com feedback visual (o anel
  já existe; falta celebrar as passagens).
- **Notificações úteis e raras**: (1) orçamento de categoria ≥85%, (2)
  projeção ficou negativa, (3) fecho do mês, (4) lembrete de registo. Todas
  individualmente desativáveis.
- **Integração no "Hoje"**: o card de finanças no dashboard deve mostrar o
  insight do dia, não só o número líquido.

## 10. Possíveis funcionalidades premium

Princípio: **registo, orçamento básico e metas ficam grátis para sempre**
(cobrar o essencial mata a aquisição); paga-se inteligência e profundidade.

| Grátis | Premium |
|---|---|
| Registo ilimitado, 1 orçamento por categoria, 2 metas, gráficos 6 meses, exportação CSV básica | Histórico e gráficos ilimitados (>6 meses) |
| Insights do dia (top-1) | Feed completo de insights + deteção de cobranças incomuns |
| Recorrentes (até 3 regras) | Recorrentes ilimitadas + painel anual de assinaturas |
| Projeção de fim de mês | Previsão 3–6 meses e simulações ("e se poupar +€50/mês?") |
| — | Relatório mensal em PDF, exportação avançada, metas ilimitadas, alertas personalizados por categoria |
| — | (futuro) Sincronização bancária |

Recorrentes limitadas a 3 no plano grátis é o gancho de conversão mais
natural: quem tem >3 recorrentes é exatamente o utilizador engajado.

## 11. Priorização por impacto e esforço

**Melhorias rápidas (baixo esforço, alto impacto)**
1. Renomear "Saldo do mês" → "Balanço do mês" + tooltip/legenda (P1) — horas.
2. Projeção de fim de mês no hero (P3) — os dados existem.
3. Badge de comparação com mês anterior no hero.
4. Linha "+€X fora do orçamento" no gauge (P6).
5. Exportação CSV (P10).
6. Insight top-1 na tela principal via `buildInsights()` (subset: excesso por
   categoria, projeção, poupança vs. mês anterior).
7. Sugestão de categoria pela descrição reutilizando keywords do `pdf.ts` (P9).
8. Trazer o gráfico entradas/saídas 6m e o donut de categorias para a tela
   principal (dados já computados).

**Melhorias estratégicas (médio esforço, alto impacto)**
9. Transações recorrentes com confirmação mensal (P2) + contas a pagar.
10. Navegação por mês + paginação/pesquisa em todo o histórico (P4).
11. Reserva atualizada automaticamente pelos movimentos "Poupança" (P7) e
    clarificação do modelo poupança-vs-despesa (P5): tratar "Poupança" como
    transferência, excluída das "Saídas" do hero e mostrada à parte.
12. Ecrã de fecho do mês + notificação (ritual de retenção).
13. Lembrete diário de registo + streak integrado no sistema de hábitos.
14. Refactor: extrair `<TransactionForm>`, `categories.ts` partilhado e
    partir `page.tsx` em componentes (P11 — pré-requisito para iterar rápido).

**Grandes apostas (alto esforço, potencial transformador)**
15. Painel de assinaturas + deteção de recorrências no histórico.
16. Motor de insights completo + anomalias, com feed e notificações → base do premium.
17. Plano premium (gating + billing).
18. Integração Open Banking PT — só depois de retenção provada no modo manual.

## 12. Roadmap 30 / 60 / 90 dias

**Dias 1–30 — "O app passa a falar"** (itens 1–8)
Semana 1: renomear hero, projeção, badge de comparação, fix do gauge.
Semana 2: `buildInsights()` com 4 regras + card de insight; testes em `finance.ts`.
Semana 3: donut de categorias + gráfico 6m na tela principal; exportação CSV.
Semana 4: `suggestCategory()` partilhada; encurtar formulário para 3 toques.
*Métrica de sucesso: tempo até registar < 8s; % de sessões que veem um insight.*

**Dias 31–60 — "O app trabalha sozinho"** (itens 9–11, 14)
Refactor da página (pré-requisito) → recorrentes com confirmação mensal →
navegação por mês + histórico completo → poupança como transferência +
reserva automática.
*Métrica: % de utilizadores com ≥1 recorrente; retenção W4.*

**Dias 61–90 — "O app cria rotina"** (itens 12, 13, 15)
Fecho do mês + notificações (orçamento 85%, projeção negativa, lembrete) →
streak de registo → painel de assinaturas v1 (derivado das recorrentes).
*Métrica: DAU/MAU da área; taxa de opt-in de notificações; NPS.*

Premium (16–17) só entra depois de 90 dias com retenção W4 > ~30% no modo
manual; Open Banking (18) fica fora deste horizonte.

## 13. Lista final de ações práticas

1. Renomear "Saldo do mês" → "Balanço do mês" em `page.tsx` e `MetricsGrid.tsx`.
2. Adicionar `projectEndOfMonth()` a `finance.ts` (+ testes) e renderizar no hero.
3. Adicionar badge Δ% vs. mês anterior no hero (usar `monthlySavings` de `history`).
4. Somar gasto de `unbudgetedCats` e mostrar "+€X fora do orçamento" no card.
5. Botão "Exportar CSV" no menu ⋯ (gerar client-side a partir de `txs`/`history`).
6. Criar `buildInsights()` em `finance.ts` com 4 regras + card na tela principal.
7. Extrair keywords do `pdf.ts` para `suggestCategory()` e usar no form manual e CSV.
8. Mostrar donut de `spentByCat` (top 5 + outros) e barras entradas/saídas 6m na página.
9. Reordenar o form de nova transação (valor primeiro, tipo default saída, 3 toques).
10. Extrair `<TransactionForm>` + `src/lib/categories.ts` (remover duplicação com `QuickAction`).
11. Migração `recurring_rules` + UI de confirmação mensal + toggle "repetir todos os meses".
12. Seletor de mês no header + `getTransactions` paginado/por intervalo.
13. Tratar categoria "Poupança" como transferência (fora das Saídas do hero) e
    atualizar `fin_current_savings` automaticamente com opção de ajuste manual.
14. Ecrã de fecho do mês (rota ou sheet) + notificação no dia 1.
15. Lembrete diário opcional de registo + streak (reutilizar sistema de hábitos).
16. Painel de assinaturas alimentado pelas recorrentes.
17. Ativar `fin_debt_goal` com card opcional de dívida.
18. Definir gating premium (recorrentes >3, histórico >6m, feed de insights) — decisão de negócio antes de implementar.
