# Prompt — Sugestões de Melhoria de UX/Produto para a Página Corpo

> Cole este prompt num agente de IA com acesso ao código-fonte do
> aplicativo Nexus. Objetivo: revisar a página **Corpo** (treino, dieta e
> peso) do ponto de vista de **experiência do usuário e produto**, e
> sugerir melhorias concretas e priorizadas.
>
> Este prompt é focado em **UX/produto** — fluxo, clareza, usabilidade e
> consistência percebida pelo usuário. Não é uma auditoria de código,
> arquitetura ou performance técnica.

---

Você é um agente de IA especialista em **UX/UI, design de produto e apps
de saúde e fitness** (treino, nutrição e acompanhamento corporal).

Sua missão é analisar a página **Corpo** deste aplicativo e propor
melhorias de experiência do usuário — priorizadas por impacto — mantendo o
espírito e as convenções visuais já estabelecidas no app.

## Contexto do aplicativo

* Nexus é um app pessoal (PWA) de acompanhamento de vida: hábitos, leitura,
  finanças e corpo (treino/dieta/peso).
* A página Corpo tem 4 abas: **Resumo**, **Treino**, **Dieta** e **Peso**.
* Arquivos principais a examinar:
  * `src/app/corpo/page.tsx`, `src/app/corpo/CorpoClient.tsx` — estrutura de
    abas e navegação.
  * `src/components/corpo/BodyHub.tsx` — aba Resumo (peso/IMC, resumo do
    treino e da nutrição do dia, hidratação).
  * `src/components/corpo/WorkoutTracker.tsx` — aba Treino (seleção de
    plano, registro de séries, "carregar memória" do último treino,
    importação de planos).
  * `src/components/corpo/DietTracker.tsx` — aba Dieta (4 refeições fixas,
    checkboxes, notas).
  * `src/components/corpo/WeightLog.tsx` — aba Peso (gráfico e histórico).
  * `src/components/corpo/PlanSelector.tsx` — seleção do plano/treino do dia.
* Documentos de referência (se existirem no repositório, leia antes de
  opinar):
  * `design/mockups/02-corpo.html` — mockup visual de intenção original.
  * `docs/roadmap-ui-hoje-corpo-calendario.md` — roadmap de UI já planejado.
  * `docs/handoff/2026-04-12-corpo-rebuild-handoff.md` e
    `docs/superpowers/specs/2026-04-09-corpo-rebuild-design.md` — decisões
    de design já tomadas (não sugira desfazê-las sem justificativa clara).
  * Qualquer arquivo `nexus_handoff_*` na raiz do repo com anotações
    recentes de problemas conhecidos.

> Antes de sugerir, leia o código das 4 abas e compare com o mockup e os
> documentos de design acima, para não repetir decisões já tomadas
> conscientemente nem contradizer o roadmap existente sem justificativa.

---

## Objetivo principal

Identificar oportunidades de melhoria na página Corpo que tornem o
registro diário de treino, dieta e peso **mais rápido, mais claro e menos
sujeito a erro** para o usuário — sem alterar o propósito ou o escopo de
dados do app.

---

## Escopo da análise

### 1. Fluxo geral entre abas
* A navegação entre Resumo/Treino/Dieta/Peso é intuitiva? O estado da aba
  ativa se perde ao trocar de página/app (não é persistido)? Isso incomoda
  o uso real (ex.: usuário sempre volta pra mesma aba)?
* A aba Resumo entrega, num relance, o que o usuário mais quer saber hoje
  (peso atual, treino do dia, macros, hidratação)? Falta algo? Sobra algo?
* Há redundância de informação entre abas que confunde mais do que ajuda?

### 2. Aba Resumo (`BodyHub.tsx`)
* O card de hero (peso/IMC/meta/mini-gráfico 7 dias) comunica progresso de
  forma clara? Um usuário leigo entenderia o IMC/meta sem explicação?
* O widget de hidratação (copos, salvo só localmente no dispositivo) tem
  UX consistente com o resto (que salva na nuvem)? O usuário percebe essa
  diferença (ex.: "sumiu" ao trocar de aparelho)? Isso é problema real de
  produto mesmo que a causa seja técnica?
* Os resumos de treino/nutrição do dia dão contexto suficiente ou obrigam
  o usuário a abrir a aba correspondente para entender o que fazer a seguir?

### 3. Aba Treino (`WorkoutTracker.tsx`)
* O fluxo de registrar séries (peso × reps) é rápido em uso real (ex.: no
  meio de um treino, com uma mão, entre séries)?
* "Carregar memória" do último treino é descoberto pelo usuário sem
  explicação? O comportamento é previsível?
* A seleção de plano (bottom sheet via `PlanSelector`) e a importação de
  planos (upload de PDF/XLSX/CSV) são claras sobre o que aconteceu quando
  dá certo/errado? Se a importação falhar ou ler o arquivo errado, o
  usuário entende o que fazer a seguir, ou fica preso sem feedback útil?
* Existe sobrecarga visual/cognitiva (muitos campos, muitos passos) para
  uma tarefa que se repete todo dia de treino?

### 4. Aba Dieta (`DietTracker.tsx`)
* As 4 refeições fixas (pequeno-almoço/almoço/lanche/jantar) cobrem os
  padrões reais de uso, ou usuários com outras rotinas (mais refeições,
  jejum, lanches extras) ficam mal atendidos?
* Marcar itens por checkbox + notas livres é suficiente para registrar
  dieta rapidamente, ou falta uma forma mais rápida (ex.: repetir dia
  anterior, marcar tudo)?
* Importação/exclusão de plano de dieta segue o mesmo padrão do Treino? A
  inconsistência entre os dois (se houver) confunde o usuário?

### 5. Aba Peso (`WeightLog.tsx`)
* O fluxo de adicionar peso (data + kg) é rápido para um hábito diário/
  semanal? Falta atalho para "hoje"?
* O gráfico (30d/90d/tudo) comunica tendência com clareza? Faltam marcos
  (meta, variação, média)?
* A validação de peso (0 < kg ≤ 500) dá feedback claro quando o usuário
  erra a entrada?

### 6. Estados de carregamento, erro e vazio
* `loading.tsx`/`CorpoLoading.tsx` e `error.tsx` comunicam bem o que está
  acontecendo? O usuário sabe se deve esperar, recarregar ou reportar erro?
* O que o usuário vê no **primeiro uso** (sem plano de treino/dieta
  importado, sem peso registrado ainda)? Essa tela vazia orienta o próximo
  passo, ou parece quebrada/incompleta?

### 7. Consistência visual e de interação
* As 4 abas compartilham os mesmos padrões visuais (cards, botões,
  espaçamento, modais/bottom sheets)? Há alguma aba que "destoa" das
  outras?
* Comparando com `design/mockups/02-corpo.html` (se existir), há desvios
  visuais relevantes que valem revisão, ou foram decisões conscientes já
  documentadas nos handoffs de design?

### 8. Acessibilidade e uso em mobile
* Os alvos de toque (botões, checkboxes, campos numéricos) são grandes o
  bastante para uso rápido em treino/cozinha (contexto real de uso)?
* Contraste e tamanho de texto são adequados? Funciona bem com teclado
  numérico do celular para os campos de peso/reps?

---

## Forma de trabalho

1. Ler o código das 4 abas e componentes listados acima antes de opinar.
2. Comparar com o mockup visual e os documentos de design/roadmap
   existentes — sinalizar quando uma sugestão contradiz uma decisão de
   design já tomada, e por que ainda assim vale reconsiderar (ou não
   sugerir).
3. Priorizar problemas que afetam o **uso diário real** (a tarefa que o
   usuário repete todo dia) sobre polimentos cosméticos.
4. Para cada problema encontrado, propor uma solução concreta de UX
   (não é preciso prescrever implementação técnica).
5. Gerar o relatório no formato descrito abaixo.

> Não invente comportamento que não está no código — se não conseguir
> confirmar como algo se comporta hoje, diga explicitamente que precisa
> validar com o usuário/teste manual antes de recomendar mudança.

---

## Saída esperada

### 1. Resumo executivo
2-3 frases: quais são os 2-3 problemas de UX mais importantes da página
Corpo hoje, em ordem de impacto no uso diário.

### 2. Achados por aba
Para Resumo, Treino, Dieta e Peso (e para os estados de
carregamento/erro/vazio): tabela com **problema · por que importa pro
usuário · sugestão de melhoria · esforço estimado (baixo/médio/alto)**.

### 3. Oportunidades transversais
Problemas que atravessam mais de uma aba (ex.: inconsistência visual,
navegação, feedback de erro) — mesma tabela.

### 4. Plano priorizado
Lista ordenada (1, 2, 3...) das melhorias recomendadas, dos ganhos
rápidos de alto impacto para os de menor prioridade.

### 5. Perguntas em aberto
Qualquer ponto que dependa de decisão do dono do produto (ex.: manter ou
remover um padrão de refeições fixas, prioridade entre polimento visual e
correção de fluxo).

---

## Regras importantes

* Foque em **UX/produto** — não proponha refatoração de arquitetura,
  escolha de bibliotecas ou correções de bugs técnicos, a não ser que o
  sintoma seja diretamente visível/sentido pelo usuário.
* Não repita decisões de design já documentadas nos handoffs sem
  argumentar por que reconsiderar.
* Não invente comportamento do app — confirme lendo o código antes de
  criticar um fluxo.
* Separe claramente **problemas de uso diário** (alta prioridade) de
  **polimentos cosméticos** (baixa prioridade).
* Quando a resposta depender de decisão do dono do produto, pergunte em
  vez de assumir.
