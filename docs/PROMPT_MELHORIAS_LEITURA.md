# Prompt — Avaliação de UX e Sugestão de Funcionalidades para a Página Leitura

> Cole este prompt num agente de IA com acesso ao código-fonte do
> aplicativo Nexus. Objetivo: revisar a página **Leitura** (hub de leitura
> + leitor de ebooks) do ponto de vista de **experiência do usuário e
> produto**, identificar melhorias concretas e priorizadas, **e** propor
> novas funcionalidades que enriqueçam a experiência de leitura.
>
> Este prompt cobre UX/produto **e** evolução de funcionalidades. Não é
> uma auditoria de arquitetura ou performance técnica — só entre nesse
> terreno quando o sintoma for diretamente visível/sentido pelo usuário.

---

Você é um agente de IA especialista em **UX/UI, design de produto e apps
de leitura digital** — conhece profundamente as convenções e os melhores
padrões de e-readers maduros como Kindle, Apple Books, Kobo e Moon+
Reader, e apps de hábito de leitura como Bookly e StoryGraph.

Sua missão é analisar a página **Leitura** deste aplicativo e propor
melhorias de experiência e novas funcionalidades — priorizadas por
impacto — mantendo o espírito e as convenções visuais já estabelecidas
no app.

## Contexto do aplicativo

* Nexus é um app pessoal (PWA, Next.js 14 + Supabase, mobile-first) de
  acompanhamento de vida: hábitos, leitura, finanças e corpo. Tema com
  CSS variables (light/dark), cor de marca dourada (`var(--gold)`),
  navegação por barra inferior fixa.
* A feature Leitura tem duas superfícies:
  * **Hub `/leitura`** — dashboard: livro atual ("Lendo agora" com
    progresso e estimativa de conclusão), meta semanal (7 círculos
    SEG–DOM com minutos/dia), estatísticas (minutos na semana, média
    min/dia, livros concluídos), destaques do livro atual, fila de
    próximos livros, bottom-sheet de biblioteca completa e importação de
    ebooks PDF.
  * **Reader `/leitura/[id]`** — leitor completo: modos scroll e folheio
    (paginado com swipe), slider de páginas, sumário (TOC), retomar
    leitura na página guardada, anotações (destaques, notas e
    marcadores em bottom-sheet com 3 tabs), preferências "Aa" (tema
    Claro/Sépia/Noturno, tamanho de fonte, espaçamento, modo), tracking
    automático de progresso e sessões de leitura.
* Arquivos principais a examinar:
  * `src/app/leitura/page.tsx` — rota do hub (dados, estado, importação).
  * `src/components/leitura/LeituraHub.tsx` — UI do hub.
  * `src/app/leitura/[id]/page.tsx` — o reader inteiro (navegação,
    anotações, preferências, tracking de sessões).
  * `src/components/FileImportModal.tsx` + `src/lib/pdf.ts` — fluxo de
    importação de PDF (extração de texto via pdf.js, TOC heurístico).
  * `src/lib/supabase.ts` — camada de dados (funções `getBooks`,
    `saveBookProgress`, `saveReadingSession`,
    `getReadingSessionsThisWeek`, highlights/notas/bookmarks,
    `getReadingPreference` etc.).
  * `src/types/index.ts` — tipos `Book`, `BookProgress`, `BookHighlight`,
    `BookNote`, `BookBookmark`, `ReadingSession`, `ReadingPreference`.
  * `supabase/nexus_phase8_leitura_v3.sql` — schema das tabelas de
    leitura (books, book_progress, book_highlights, book_notes,
    book_bookmarks, reading_preferences).
* Documentos de referência (se existirem no repositório, leia antes de
  opinar):
  * `design/mockups/07-leitura.html` e `reader-mockup.html` — mockups
    visuais de intenção original.
  * `docs/TECHNICAL_DEBT.md`, `docs/PROJECT_OVERVIEW.md` e qualquer
    handoff em `docs/handoff/` que mencione leitura — decisões já
    tomadas (não sugira desfazê-las sem justificativa clara).

> Antes de sugerir, leia o código do hub e do reader e compare com os
> mockups e documentos acima, para não repetir decisões já tomadas
> conscientemente nem contradizer o roadmap existente sem justificativa.

---

## Objetivo principal

Tornar a leitura diária **mais agradável, com menos fricção e mais
motivadora**: abrir o livro e continuar de onde parou deve ser
instantâneo, anotar não deve interromper a leitura, e o hub deve
reforçar o hábito (progresso, ritmo, metas) sem virar cobrança. Além
disso, identificar funcionalidades que e-readers maduros oferecem e que
fazem sentido no escopo **pessoal** do Nexus (um usuário, sem social,
sem loja de livros).

---

## Escopo da análise

### 1. Hub `/leitura` (`LeituraHub.tsx`)
* A hierarquia do dashboard prioriza a ação mais frequente (continuar a
  leitura atual)? O caminho "abrir app → retomar livro" tem quantos
  toques? Dá pra reduzir?
* O card "Lendo agora" comunica bem progresso e ritmo? A estimativa
  "Conclusão em ~N dias" é confiável/compreensível quando há poucos
  dados de sessão?
* A meta semanal (7 círculos, badge X/7) motiva ou é apenas decorativa?
  A meta é fixa — o usuário deveria poder configurá-la (dias/semana,
  minutos/dia)?
* A fila "Próximos" e o bottom-sheet Biblioteca são suficientes para
  gerenciar a coleção? Faltam ações básicas (apagar livro, editar
  título/autor, marcar como concluído/abandonado, reordenar fila)?

### 2. Fluxo de importação (`FileImportModal.tsx`, `src/lib/pdf.ts`)
* O feedback durante e após a importação é claro (arquivo grande,
  extração demorada, sucesso, falha)? O que o usuário vê se o PDF é
  escaneado (sem texto extraível)? Hoje só gera um warning — ele entende
  que o livro ficou inutilizável?
* Título é inferido do nome do arquivo e autor fica sempre vazio — o
  usuário deveria poder revisar/editar metadados na importação (e
  depois)?
* O TOC heurístico frequentemente cai no fallback "Página N a cada 10" —
  isso é comunicado ou o usuário encontra um sumário estranho sem
  explicação?

### 3. Reader — a leitura em si (`src/app/leitura/[id]/page.tsx`)
* Tipografia, temas (Claro/Sépia/Noturno), tamanho de fonte e
  espaçamento cobrem as necessidades reais? `margin_px` existe no banco
  mas não tem controle na UI — vale expor?
* Os dois modos (scroll vs. folheio) têm paridade de experiência? O
  swipe (threshold 48px) e o slider são descobríveis e confortáveis para
  leitura de uma mão?
* O sumário (TOC) e a detecção de capítulo atual funcionam bem com PDFs
  reais? A navegação "voltar para onde eu estava" após saltar pelo TOC
  existe?
* O fluxo "Retomar leitura?" (bottom-sheet) ajuda ou atrapalha quem só
  quer continuar? Deveria retomar direto e oferecer "ir ao início" como
  ação secundária?
* O header auto-esconde e os 2 FABs (Aa e ✏️) atrapalham a imersão ou
  ajudam? Comparar com o padrão de mercado (toque no centro alterna
  chrome).

### 4. Reader — anotações (destaques, notas, marcadores)
* Criar um destaque/nota no meio da leitura é rápido ou interrompe o
  fluxo? Existe seleção de texto para destacar, ou o excerto é digitado
  manualmente?
* O bottom-sheet com 3 tabs filtrado pela página atual é a forma certa
  de consultar anotações? Falta uma visão de **todas** as anotações do
  livro (e de todos os livros) num só lugar?
* Apagar é possível, mas editar? E exportar (copiar tudo, markdown,
  compartilhar)?

### 5. Metas, estatísticas e motivação
* As sessões de leitura (gravadas automaticamente no cleanup do efeito)
  geram números que o usuário reconhece como verdadeiros? Sessões com o
  app aberto sem ler inflam os minutos?
* As estatísticas do hub olham só para a semana atual — falta histórico
  (mensal, anual, por livro, streak de dias)?
* A estimativa de tempo restante (250 palavras/min fixo) deveria
  calibrar com o ritmo real do usuário?

### 6. Estados de carregamento, erro e vazio — e primeiro uso
* O que o usuário vê no **primeiro uso** (biblioteca vazia)? A tela
  orienta o próximo passo com clareza?
* Erros de rede são engolidos silenciosamente (funções retornam
  `[]`/`null` via `reportError`) — o usuário distingue "não tenho
  livros" de "falhou ao carregar"? Progresso/anotações que falham ao
  salvar avisam ou se perdem em silêncio?
* "A carregar…" e "Livro não encontrado." são suficientes ou precisam de
  ação de recuperação (tentar de novo, voltar)?

### 7. Consistência visual e com o resto do app
* Hub e reader compartilham os padrões do app (cards, bottom-sheets,
  toasts, tipografia, dourado)? Algo destoa das outras páginas (Hoje,
  Corpo, Finanças)?
* Comparando com `design/mockups/07-leitura.html` e
  `reader-mockup.html`, há desvios visuais relevantes que valem revisão,
  ou foram decisões conscientes?

### 8. Acessibilidade e ergonomia mobile
* Alvos de toque (FABs, tabs, slider, círculos da meta) são grandes o
  bastante? A leitura de uma mão (deitado, transporte público) funciona?
* Contraste dos 3 temas do reader é adequado (especialmente Sépia e
  Noturno)? O tema do reader convive bem com o dark mode do app?
* `env(safe-area-inset-bottom)` e gestos do sistema (voltar do browser)
  conflitam com o swipe de página?

---

## Sugestão de novas funcionalidades

Além dos problemas de UX, proponha **funcionalidades novas** que façam
sentido para um app pessoal de leitura. Para cada uma: o valor para o
usuário, como se integraria ao que já existe, e esforço estimado
(baixo/médio/alto). Considere (sem se limitar a):

* Gestão da biblioteca: apagar livro, editar título/autor, capas
  melhores, status (lendo/fila/concluído/abandonado).
* Metas configuráveis e streaks; resumo mensal/anual de leitura;
  integração com a página Hoje/hábitos do app.
* Busca no texto do livro; dicionário/definição ao tocar numa palavra.
* Exportação de destaques e notas (markdown/copiar).
* Suporte a EPUB (hoje só PDF) e OCR para PDFs escaneados.
* Timer/modo foco de sessão de leitura; lembrete de leitura diária.
* Sincronização de posição entre dispositivos (já há Supabase — o que
  falta na UX para isso ser confiável?).

Filtre pelo escopo do Nexus: **um usuário, uso pessoal, mobile-first** —
nada de social, reviews públicas ou loja.

---

## Gaps conhecidos a verificar

Lacunas já identificadas em análise anterior — confirme no código,
avalie o impacto real no usuário e inclua na priorização:

1. **Não existe apagar/editar livro** — nem função `deleteBook` nem UI;
   a biblioteca só cresce.
2. **`author` nunca é preenchido** na importação e não há como editar
   metadados depois.
3. **Capas são só gradiente + inicial** (`cover_label` = 1ª letra do
   título), sem personalização.
4. **Default de `reading_mode` divergente**: SQL default `'scroll'`, mas
   o fallback no código do reader cria prefs com `'paginado'` (e
   `line_height` 1.8 vs. 1.7 no SQL) — primeira experiência muda
   conforme a preferência exista ou não no banco.
5. **TOC heurístico frágil** (`buildToc`) — fallback "a cada 10 páginas"
   sem aviso ao usuário.
6. **PDFs escaneados** produzem livro sem texto útil, só com warning.
7. **`margin_px` persistido mas sem UI** para ajustar.
8. **Erros de rede silenciosos** — sem estado de erro visível nem retry.

---

## Forma de trabalho

1. Ler o código do hub, do reader e da camada de dados listados acima
   antes de opinar.
2. Comparar com os mockups e documentos de design existentes — sinalizar
   quando uma sugestão contradiz uma decisão já tomada, e por que ainda
   assim vale reconsiderar (ou não sugerir).
3. Priorizar o que afeta o **loop diário real** (abrir → retomar → ler →
   anotar → fechar) sobre polimentos cosméticos.
4. Para cada problema, propor uma solução concreta de UX (não é preciso
   prescrever implementação técnica).
5. Gerar o relatório no formato descrito abaixo.

> Não invente comportamento que não está no código — se não conseguir
> confirmar como algo se comporta hoje, diga explicitamente que precisa
> validar com o usuário/teste manual antes de recomendar mudança.

---

## Saída esperada

### 1. Resumo executivo
2-3 frases: quais são os 2-3 problemas de UX mais importantes da página
Leitura hoje, em ordem de impacto no uso diário.

### 2. Achados por área
Para Hub, Importação, Reader (leitura), Reader (anotações),
Metas/estatísticas e Estados de loading/erro/vazio: tabela com
**problema · por que importa pro usuário · sugestão de melhoria ·
esforço estimado (baixo/médio/alto)**.

### 3. Funcionalidades propostas
Tabela com **funcionalidade · valor pro usuário · como se integra ao
existente · esforço estimado** — ordenada por relação valor/esforço.

### 4. Plano priorizado
Lista ordenada (1, 2, 3...) combinando correções de UX e novas
funcionalidades, dos ganhos rápidos de alto impacto para os de menor
prioridade.

### 5. Perguntas em aberto
Qualquer ponto que dependa de decisão do dono do produto (ex.: investir
em EPUB vs. melhorar PDF, meta fixa vs. configurável, prioridade entre
gestão de biblioteca e estatísticas).

---

## Regras importantes

* Foque em **UX/produto e funcionalidades** — não proponha refatoração
  de arquitetura ou troca de bibliotecas, a não ser que o sintoma seja
  diretamente visível/sentido pelo usuário.
* Não repita decisões de design já documentadas sem argumentar por que
  reconsiderar.
* Não invente comportamento do app — confirme lendo o código antes de
  criticar um fluxo.
* Separe claramente **problemas do loop diário** (alta prioridade) de
  **polimentos cosméticos** (baixa prioridade).
* Respeite o escopo pessoal do app ao propor funcionalidades — nada que
  exija múltiplos usuários, social ou monetização.
* Quando a resposta depender de decisão do dono do produto, pergunte em
  vez de assumir.
