# Leitura — Revisão de UX e Proposta de Funcionalidades

> Análise de produto/UX da página **Leitura** (hub `/leitura` + reader
> `/leitura/[id]`), feita a partir da leitura do código em 2026-07-07.
> Ficheiros examinados: `src/app/leitura/page.tsx`,
> `src/components/leitura/LeituraHub.tsx`, `src/app/leitura/[id]/page.tsx`,
> `src/components/FileImportModal.tsx`, `src/components/ImportPreview.tsx`,
> `src/lib/pdf.ts`, `src/lib/supabase.ts`, `src/types/index.ts`,
> `supabase/nexus_phase8_leitura_v3.sql`, mockups
> `design/mockups/07-leitura.html` e `reader-mockup.html`, e handoffs em
> `docs/`.
>
> Legenda de esforço: **B** baixo · **M** médio · **A** alto.
> Tudo o que está marcado *(confirmado no código)* foi verificado na fonte;
> o que depende de comportamento em dispositivo real está sinalizado.

---

## 1. Resumo executivo

Os três problemas mais importantes, por impacto no uso diário:

1. **O modo scroll não regista leitura nenhuma.** Não existe qualquer
   deteção de posição por scroll (`src/app/leitura/[id]/page.tsx` — o único
   listener de scroll esconde o header). Quem lê em scroll não avança
   `current_page`, não gera `pages_read`, não move a barra de progresso do
   hub, nunca vê ETA e nunca "conclui" um livro. Metade do produto
   (tracking, meta, estatísticas) fica cega para um dos dois modos de leitura.
2. **O fluxo "Retomar leitura?" pode perder a posição guardada.** O guard
   `hydrated` é ativado no fim de `loadAll`, no mesmo batch de render, pelo
   que o efeito de persistência grava `current_page=1` assim que o livro
   carrega — antes de o utilizador tocar em "Retomar". A página antiga
   sobrevive apenas no estado do bottom-sheet: um reload/kill do PWA com o
   prompt aberto perde a posição. Além disso, o prompt adiciona um toque a
   TODAS as aberturas de livro em curso — o oposto de "retomar instantâneo".
3. **Anotar interrompe a leitura por completo.** Destacar exige abrir o
   bottom-sheet e **digitar manualmente o trecho** num textarea — não há
   seleção de texto. Na prática, o custo de criar um destaque é tão alto que
   a funcionalidade (e a secção "Destaques" do hub) tende a ficar vazia.

Logo atrás destes: a biblioteca só cresce (sem apagar/editar/estado), e
todos os erros de rede são silenciosos (`reportError` + `[]`/`null`), o que
faz "não tenho dados" e "falhou a carregar" parecerem a mesma coisa.

---

## 2. Achados por área

### 2.1 Hub `/leitura`

| Problema | Por que importa | Sugestão | Esforço |
|---|---|---|---|
| O caminho "abrir app → retomar livro" são 3+ toques (nav Leitura → card → responder ao prompt Retomar). *(confirmado)* | É a ação mais frequente do módulo; cada toque extra corrói o hábito. | Card "Lendo agora" abre o reader **já na página guardada** (sem prompt — ver 2.3). Opcional: ação "Continuar a ler" na página Hoje quando há livro em curso. | B |
| Livro "atual" é derivado (maior % em curso); um 2.º livro em curso não aparece nem em "Lendo agora" nem em "Próximos" (fila = só livros a 0%). *(confirmado em `page.tsx` — memos `currentBook`/`queue`)* | Quem alterna entre 2 livros "perde" um deles do dashboard e só o reencontra no sheet Biblioteca. | Secção "Em curso" com todos os livros 0<pct<100 (o de maior % em destaque), ou permitir fixar manualmente o livro ativo. | B |
| A estimativa "Conclusão em ~N dias" usa `pagesPerDay` **só da semana atual** e só de dias com páginas; com o bug do modo scroll, muitas vezes nem aparece. | Número volátil (1 dia de dados ⇒ extrapolação absurda) mina a confiança nas estatísticas. | Calcular sobre 14–30 dias de sessões; esconder ou rotular como "estimativa inicial" com <3 dias de dados. | B |
| Meta semanal fixa (implícita: 7 dias; cores mudam em 3 e 5 dias) — não configurável; círculo do dia conta com **1 minuto** lido. | Meta que não é do utilizador vira decoração; 1 min "cumprir" o dia esvazia o significado. | Meta configurável (dias/semana **e** min/dia mínimos para contar o dia); badge "X/meta" em vez de "X/7". | M |
| Biblioteca (bottom-sheet) sem qualquer gestão: não dá para apagar, editar título/autor, marcar concluído/abandonado, nem reordenar a fila. *(confirmado — não existe `deleteBook`/`updateBook` em `supabase.ts`; gap conhecido #1)* | A biblioteca só cresce; um PDF importado por engano fica lá para sempre; "Próximos" não é ordenável. | Ações por livro no sheet (menu ou long-press): Apagar (com `ConfirmDialog` já existente em `src/components/ui/`), Editar título/autor, Marcar concluído/abandonado. Reordenar fila é fase 2. | M |
| Subtítulo do header ("N livros na biblioteca") e 3.º stat ("livros concluídos") divergem do mockup ("8 livros lidos em 2026" / "livros em 2026"). | O mockup comunica **realização anual** (motivador); a versão atual comunica tamanho de coleção (neutro). | Voltar à métrica do mockup: "N livros lidos em 2026" — os dados existem (`progress_pct>=100` + `reading_sessions`). | B |

### 2.2 Importação (`FileImportModal` + `pdf.ts`)

| Problema | Por que importa | Sugestão | Esforço |
|---|---|---|---|
| Sem passo de metadados: título inferido do nome do ficheiro, `author` sempre `null`, sem edição posterior. *(confirmado — `handleImport` em `page.tsx`; gaps #2)* | "atomic habits clear 2018 v3 final" vira o título do livro para sempre; o card do hub tem espaço para autor que nunca é preenchido. | Ecrã de confirmação pós-parse com Título/Autor editáveis e pré-preenchidos; edição posterior via "Editar" na Biblioteca. | B/M |
| PDF escaneado gera livro inutilizável com apenas um aviso amarelo ("Atencao") — o botão "Guardar ebook" continua ativo. *(confirmado — `hasUsefulText` só alimenta warning; gap #6)* | O utilizador guarda, abre o livro e encontra "Sem texto extraível nesta página" em todas as páginas — beco sem saída descoberto tarde. | Quando `hasUsefulText=false`: bloquear o guardar por defeito com explicação clara ("Este PDF é uma imagem — o texto não pode ser extraído") + opção explícita "guardar mesmo assim". | B |
| TOC heurístico cai no fallback "Página 1, 11, 21…" sem qualquer aviso. *(confirmado — `buildToc`; gap #5)* | O utilizador abre o Sumário e encontra uma lista de números sem sentido — parece bug. | No fallback, rotular a secção do sumário: "Sumário automático (marcos a cada 10 páginas)"; no preview de importação, avisar "capítulos não detetados". | B |
| Sem progresso durante a extração — só "A ler conteudo e a montar preview..." estático; pdf.js processa página a página mas não reporta. | PDFs grandes (300+ pág.) parecem congelados; o utilizador pode desistir/fechar a meio. | Callback de progresso em `extractPdfText` (página N/M) para uma barra no modal. | B |
| pdf.js é carregado de CDN (cdnjs) em runtime. *(confirmado — `PDFJS_SRC` em `pdf.ts`)* | Num PWA, importar offline (ou com o CDN bloqueado) falha com "Falha ao carregar…" — sintoma direto para o utilizador. | Empacotar `pdfjs-dist` no bundle da app (dependência local). É troca de fonte, não de biblioteca; justifica-se pelo sintoma visível. | B/M |
| O copy do modal está sem acentos ("validacao", "Nao foi possivel", "A ler conteudo") e o cabeçalho fala de "leitura base, preview e validacao" — linguagem de planilha, não de ebook. | Destoa do resto do app (pt cuidado) num momento de primeira impressão. | Rever copy do modal para o contexto ebook + corrigir acentuação. | B |

### 2.3 Reader — a leitura em si

| Problema | Por que importa | Sugestão | Esforço |
|---|---|---|---|
| **Modo scroll não atualiza `currentPage`** — nenhum observer de posição; progresso, sessões (`pages_read`), ETA, círculos de páginas e conclusão do livro não funcionam nesse modo. *(confirmado)* | É um dos dois modos oferecidos (e o default do SQL!); quem o usa perde TODO o valor de tracking do Nexus, silenciosamente. | `IntersectionObserver` nas secções de página para atualizar `currentPage` durante o scroll (e por consequência progresso/sessões). Enquanto não existir, considerar esconder o modo scroll ou avisar. | M |
| **Prompt "Retomar leitura?" grava `current_page=1` antes da resposta** — `hydrated.current=true` é definido no fim de `loadAll`, no mesmo batch, e o efeito de persistência dispara logo no primeiro commit. *(confirmado por leitura do fluxo; validar com teste manual)* | Reload/kill com o prompt aberto perde a posição; toque acidental em "Começar do início" é irreversível. E o prompt em si adiciona fricção diária. | Inverter o padrão (convenção Kindle/Apple Books): **abrir direto na página guardada**, com toast/ação secundária "Ir para o início". Isso elimina o prompt e a janela de perda de dados de uma vez. | B |
| Sem zonas de toque para virar página nem toque-no-centro para alternar chrome — só swipe (48px) e botões na barra inferior. O header esconde-se **durante** o scroll e reaparece sozinho após 1,6s — o inverso da convenção (chrome escondido enquanto se lê; toque revela). | Leitura de uma mão em folheio depende de swipe ou de alcançar botões; o padrão universal (toque na margem direita/esquerda = página seguinte/anterior) é mais confortável e descobrível. | Zonas de toque: terço esquerdo = página anterior, terço direito = seguinte, centro = mostrar/esconder header+barra. Manter swipe. | M |
| O reader mantém a `<Nav />` global do app sempre visível — o mockup do reader não tem nav inferior. *(confirmado — desvio do mockup, aparentemente não documentado)* | Rouba ~64px de altura de leitura + `bottom bar` do folheio fica a 64px do fundo; imersão quebrada; risco de toque acidental em outra secção do app a meio da leitura. | Esconder a Nav no reader (o "←" do header já leva ao hub), ou escondê-la junto com o chrome no toque-no-centro. | B |
| `margin_px` persiste no banco mas não tem controlo no sheet "Aa". *(confirmado; gap #7)* | Margens são um dos 3 controlos básicos de conforto tipográfico em e-readers. | Adicionar linha "Margens" (3 presets: estreitas/normais/largas) no sheet Aspecto. | B |
| Defaults divergentes: SQL `reading_mode='scroll'`, `line_height=1.7`, `margin_px=20` vs. fallback do código `'paginado'`, `1.8`, `24`. *(confirmado; gap #4)* | A primeira experiência muda conforme a linha de prefs exista ou não — inconsistente e imprevisível. | Alinhar SQL e código num único default (recomendado: `paginado`/1.8/24, já que é o que o mockup principal mostra e o modo que funciona com tracking). | B |
| Folheio: swipe pode conflitar com o gesto "voltar" do browser/PWA na margem esquerda; os touch handlers estão no `<main>`, por isso um swipe dentro dos bottom-sheets também pode virar página. | Página virada sem intenção ao fechar um sheet, ou navegação para trás inesperada. | Ignorar toques iniciados nos ~24px da borda esquerda e quando qualquer sheet está aberto. **Validar em dispositivo real.** | B |
| Modo scroll renderiza o livro inteiro num único DOM (todas as páginas). | Em PDFs de 300+ páginas: abertura lenta e scroll com jank — sintoma sentido pelo utilizador. | Virtualizar/paginar por blocos (ex.: janela de ±20 páginas). | M |
| Estimativa "~N min" fixa em 250 wpm. *(confirmado — `WORDS_PER_MIN`)* | Para leitores lentos/rápidos, o número está sistematicamente errado — e nota-se ao fim de poucos dias. | Calibrar wpm com as sessões reais (palavras das páginas viradas ÷ minutos), com 250 como fallback. | B/M |

### 2.4 Reader — anotações

| Problema | Por que importa | Sugestão | Esforço |
|---|---|---|---|
| Destacar = abrir sheet + **digitar o trecho à mão**. *(confirmado — textarea `highlightText`)* | Custo altíssimo por destaque; interrompe a leitura por ~30s+; na prática mata a funcionalidade. | Usar a seleção nativa de texto (`selectionchange` sobre o texto renderizado): selecionar → mini-toolbar "Destacar · Nota" → guarda o excerto automaticamente com a página. | M |
| Sem vista de **todas** as anotações do livro — as tabs Destaques/Notas mostram apenas a página atual (o contador da tab mostra o total, o conteúdo não). *(confirmado — filtros `currentHighlights`/`currentNotes`)* | Rever o que se sublinhou num livro inteiro (o motivo de sublinhar) é impossível sem navegar página a página; o contador "12" com lista de 1 item confunde. | Toggle "Esta página / Todo o livro" no sheet; itens de "todo o livro" navegam para a página ao toque (como os marcadores já fazem). | B |
| Não há edição de destaques/notas — só apagar e recriar. *(confirmado — só `delete*` no código)* | Corrigir um typo numa nota exige reescrevê-la. | Ação "Editar" inline no item (o schema já tem policies de UPDATE). | B |
| Sem exportação (copiar tudo / markdown). | Destaques são o output durável da leitura; presos no app valem menos. | "Exportar" na vista de todas as anotações: copia markdown (`## Livro`, `> excerto — p. N`, notas) para o clipboard / share sheet. | B |
| Highlights no hub são só do "livro atual" e limitados a 3, sem vista completa em lado nenhum. | Anotações de livros terminados desaparecem da UI para sempre. | Entrada "Todas as anotações" (por livro) acessível do hub/Biblioteca. | M |

### 2.5 Metas, estatísticas e motivação

| Problema | Por que importa | Sugestão | Esforço |
|---|---|---|---|
| Sessões = tempo com o reader aberto (início no mount, fim no cleanup, cap 240 min). Ecrã aberto sem ler infla minutos; e se o PWA for morto pelo SO, o cleanup pode nem correr — sessão perdida. *(confirmado — efeito de sessão)* | Os números da semana deixam de ser "verdade" — e o utilizador percebe ("li 10 min, marca 47"). Meta baseada em números falsos desmotiva. | Pausar o relógio com `visibilitychange` (app em background) e após N min sem interação (sem scroll/página virada); gravar a sessão também em `visibilitychange`/`pagehide`, não só no unmount. | M |
| Estatísticas olham só para a semana atual; não há histórico mensal/anual, por livro, nem streak de dias (o Perfil já usa `getReadingPages30d`, mas o hub não mostra nada disso). | O progresso de longo prazo — o que sustenta o hábito — é invisível; a cada segunda-feira o quadro "zera". | Secção/ecrã "Histórico": livros por ano, minutos por mês, streak atual/recorde. Os dados já estão em `reading_sessions`. | M |
| Leitura não aparece na página Hoje nem liga ao sistema de hábitos/streaks que o app já tem. | O Nexus é um app de hábitos — e o hábito de ler vive isolado do loop diário principal. | Card "Continuar a ler" (livro + página) na Hoje quando a meta do dia não foi cumprida; opcionalmente um hábito "Ler X min" auto-completado pelas sessões. | M |
| Círculo do dia acende com 1 minuto; sessões <1 min são descartadas (`durationMinutes < 1`). | Regras invisíveis: às vezes "li e não contou" (59s), às vezes "abri sem ler e contou". | Com meta configurável (2.1), o círculo acende ao atingir os min/dia definidos; mostrar minutos parciais no círculo de hoje. | B (com 2.1) |

### 2.6 Estados de loading, erro e vazio — primeiro uso

| Problema | Por que importa | Sugestão | Esforço |
|---|---|---|---|
| Erros de rede totalmente silenciosos: todas as funções de dados devolvem `[]`/`null` via `reportError`. Hub com rede falhada = "Biblioteca vazia". *(confirmado; gap #8)* | Indistinguível de não ter livros; o utilizador pode achar que perdeu a biblioteca. Progresso/anotações que falham ao gravar perdem-se sem aviso. | Loads: estado de erro com "Tentar de novo" (já existe `ErrorState` em `src/components/ui/` — usar). Saves críticos (progresso, anotações): toast de falha + retry automático simples. | M |
| Primeiro uso: hub mostra header + card tracejado "Importar ebook PDF" + meta vazia + stats "—" — funcional mas seco; nada explica o que a página faz. | Primeira impressão define se a feature será usada. | Empty state único e acolhedor (1 ecrã: o que é, o que suporta — "PDFs com texto" — e um CTA grande), escondendo meta/estatísticas até existir 1 livro. | B |
| "a carregar…" (hub, minúsculas) vs "A carregar…" (reader); "Livro não encontrado." sem ação de voltar. | Polimento básico; num deep-link `?page=` inválido o utilizador fica num beco. | Unificar loading (skeleton do layout do hub, idealmente); "Livro não encontrado" com botão "← Voltar à Leitura". | B |
| Importação: sucesso é só um toast; o livro novo não é evidenciado. | Momento de recompensa desperdiçado. | Após importar, abrir o livro (ou fazer scroll/haptic para o card novo). | B |

### 2.7 Consistência visual e acessibilidade (transversal)

- O hub é fiel ao mockup `07-leitura.html` (confirma o handoff "Hub fiel ao
  mockup"), com os desvios de métrica anotados em 2.1. O reader é fiel ao
  `reader-mockup.html` **exceto**: os 2 FABs (Aa e ✏️) não existem no mockup
  (que usa só o header + tray), e o mockup não tem a nav global. Os FABs
  duplicam o "Aa" do header — com toque-no-centro (2.3) o FAB "Aa" torna-se
  redundante e pode sair; o ✏️ pode integrar a barra inferior.
- A Leitura hand-rolla bottom-sheets/toasts/confirm enquanto já existem
  `BottomSheet`, `ConfirmDialog`, `ErrorState` em `src/components/ui/` —
  não é problema de UX per se, mas usar os primitivos partilhados dá
  consistência de graça nas melhorias acima.
- Alvos de toque geralmente OK (36–48px). Atenção: thumb do slider de
  páginas é pequeno para polegar (considerar área de toque maior), e os
  links "Apagar" das anotações têm ~16px de altura.
- Contraste: no tema Sépia, o accent `#E8A838` sobre `#F3E8D2` tem contraste
  baixo para texto pequeno (usado em metadados/percentagens) — verificar
  WCAG; Noturno está confortável. O reader impõe o seu próprio tema sobre o
  dark mode do app corretamente (paleta própria), sem conflito aparente.
- `env(safe-area-inset-bottom)` é usado nos sheets mas a barra inferior do
  folheio assenta na Nav (que trata o safe-area) — se a Nav sair do reader
  (2.3), a barra precisa de herdar o safe-area.

---

## 3. Funcionalidades propostas

Ordenadas por relação valor/esforço. Todas cabem no escopo pessoal
(1 utilizador, sem social/loja).

| # | Funcionalidade | Valor para o utilizador | Integração com o existente | Esforço |
|---|---|---|---|---|
| F1 | **Gestão de livros** (apagar, editar título/autor, marcar concluído/abandonado) | Biblioteca deixa de ser só-cresce; corrige metadados maus da importação | Menu por item no sheet Biblioteca; `ConfirmDialog` existente; policies de UPDATE/DELETE já existem no SQL | B/M |
| F2 | **Exportar destaques e notas** (markdown → clipboard/share) | O output durável da leitura sai do app; combina com o hábito de rever notas | Botão na vista "todas as anotações" (2.4); dados já estruturados por página | B |
| F3 | **Retomar direto + toque-no-centro** (pacote de imersão) | Abrir e ler em 2 toques; chrome sob controlo do leitor | Substitui o prompt Retomar e o auto-hide por tempo; remove FAB "Aa" | B/M |
| F4 | **Seleção de texto para destacar** | Anotar sem sair do fluxo — destrava toda a feature de anotações | Mini-toolbar sobre a seleção; grava nos mesmos `book_highlights`/`book_notes` | M |
| F5 | **Meta configurável + streak de leitura** | A meta passa a ser um compromisso pessoal; streak reaproveita a linguagem de gamificação do app | Nova coluna em `reading_preferences` (ou tabela de metas); círculos e badge do hub já preparados | M |
| F6 | **Capa = 1.ª página do PDF** (thumbnail via pdf.js `render`) | Biblioteca reconhecível de relance, sem custo de curadoria | Gerar dataURL na importação, guardar em `books` (nova coluna `cover_image`); fallback = gradiente atual | M |
| F7 | **Histórico de leitura** (mensal/anual, por livro, streak recorde) | Progresso de longo prazo visível — o motor do hábito | `reading_sessions` já tem tudo; secção no hub ou ecrã dedicado; Perfil já consome dados 30d | M |
| F8 | **Busca no texto do livro** | Reencontrar passagens ("onde é que ele fala de X?") | O texto já está em `raw_content.pages`; busca client-side com lista de resultados → salta para a página | M |
| F9 | **Integração com a página Hoje** (card "Continuar a ler" / hábito auto-completado) | A leitura entra no loop diário principal do Nexus | Reusa `getReadingSessionsThisWeek` + padrão de cards da Hoje | M |
| F10 | **Timer/modo foco de sessão** (opcional, com pausa por inatividade) | Sessões intencionais e números verdadeiros | Extensão do tracking de sessões (2.5); UI mínima no header | M |
| F11 | **Lembrete diário de leitura** | Fecha o ciclo do hábito nos dias esquecidos | Infra de notificações já documentada (`docs/SETUP_NOTIFICATIONS.md`, `NOTIFICACOES_AGENDADAS.md`) | M |
| F12 | **Suporte a EPUB** | Formato dominante de ebooks pessoais; refluxo real (vs. texto plano de PDF) | Novo parser (ex.: epub.js) alimentando o mesmo `raw_content`/reader; TOC real de graça | A |
| F13 | **OCR para PDFs escaneados** | Recupera livros hoje inutilizáveis | Pesado no cliente (tesseract.js) e qualidade irregular; ver pergunta aberta Q3 | A |
| F14 | Dicionário ao tocar numa palavra | Nice-to-have de e-readers maduros | Exige fonte de definições (online/offline) — valor baixo face ao resto | M/A |

**Sincronização entre dispositivos** (mencionada no prompt): a base já
existe via Supabase; o que falta para ser *confiável* não é feature nova, e
sim as correções de 2.3/2.5 — gravar progresso em `visibilitychange` (não só
no unmount), tracking no modo scroll, e feedback de erro ao gravar. Com
isso, sincronização "acontece" sozinha; um toast "posição atualizada
noutro dispositivo → ir para p. N" seria o único polimento extra (B).

---

## 4. Plano priorizado

Ganhos rápidos de alto impacto primeiro; loop diário antes de cosmética.

1. **Retomar direto** (matar o prompt; toast "Recomeçar do início" como ação
   secundária) — corrige fricção diária **e** a janela de perda de posição. (B)
2. **Tracking no modo scroll** (IntersectionObserver → `currentPage`) — sem
   isto, metade dos modos anula progresso/meta/estatísticas. (M)
3. **Alinhar defaults de `reading_preferences`** (SQL ↔ código) e gravar
   progresso/sessão em `visibilitychange`/`pagehide`. (B)
4. **Gestão de livros — F1** (apagar/editar/estado) + passo de metadados na
   importação (título/autor editáveis). (M)
5. **PDF escaneado: bloquear com explicação** + rotular TOC de fallback +
   progresso de extração no modal. (B)
6. **Erros visíveis**: `ErrorState` com retry nos loads do hub/reader; toast
   de falha em saves de progresso/anotações. (M)
7. **Vista "todas as anotações" + editar + exportar markdown — F2/2.4.** (B/M)
8. **Toque-no-centro + zonas de toque + esconder Nav no reader — F3.** (M)
9. **Seleção de texto para destacar — F4.** (M)
10. **Sessões honestas — F10-lite**: pausa por inatividade/background; wpm
    calibrado para o "~N min" e ETA sobre 14–30 dias. (M)
11. **Meta configurável + streak — F5**, e círculo do dia baseado na meta. (M)
12. **Capas da 1.ª página — F6** e métrica "livros lidos em 2026" no hub. (M)
13. **Histórico de leitura — F7** e integração com a Hoje — F9. (M)
14. **Busca no texto — F8**; controlo de margens (`margin_px`); empty state
    de primeiro uso; unificação de loadings e copy do modal. (B/M cada)
15. **EPUB — F12** (decisão de produto — ver Q1) e lembrete diário — F11.

---

## 5. Perguntas em aberto (decisões do dono do produto)

1. **EPUB vs. aprofundar PDF?** O pipeline atual trata PDF como texto plano
   (perde formatação, hifenização, imagens). Investir em EPUB (F12) dá uma
   experiência de leitura muito superior — mas só vale se os teus livros
   existirem em EPUB. Qual é a origem real dos teus ebooks?
2. **Meta fixa ou configurável?** O mockup assume 7 dias com minutos/dia. Se
   a tua meta real é "todos os dias", basta acrescentar min/dia mínimos; a
   configuração completa (F5) só se justifica se a meta variar.
3. **OCR (F13) vale o custo?** Só se uma fração relevante da tua biblioteca
   for de scans. Alternativa barata: a mensagem clara na importação (plano
   #5) e converter fora do app.
4. **Gestão de biblioteca vs. estatísticas — qual primeiro?** O plano acima
   põe gestão (item 4) antes de histórico (item 13) por assumir que apagar/
   corrigir livros é dor imediata. Se a biblioteca ainda é pequena, o
   histórico/streak pode motivar mais.
5. **Modo scroll: consertar ou despriorizar?** Se lês sempre em folheio,
   o item 2 do plano pode descer — mas então o modo scroll devia ser
   escondido ou marcado como "sem tracking" para não enganar.
6. **Nav global no reader**: escondê-la contradiz o padrão atual do app
   (nav sempre presente) mas segue o mockup do reader e a convenção de
   e-readers. Confirmar antes de mudar.

---

*Notas de verificação: o comportamento do gesto de swipe vs. gesto "voltar"
do browser (2.3) e o contraste efetivo do tema Sépia (2.7) precisam de
validação em dispositivo real antes de qualquer mudança. A afirmação sobre
o prompt Retomar gravar `current_page=1` foi confirmada por leitura do fluxo
de estado (batching do React 18), mas merece um teste manual de reprodução.*
