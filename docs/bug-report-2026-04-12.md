# Bug Report — Nexus App
**Data:** 2026-04-12  
**Ambiente:** nexus-lccd.vercel.app (Produção)  
**Plataforma:** Mobile Web (Android)

---

## Bug #1 — Erro de Carregamento de Dados (Aba Peso)

**Severidade:** Alta  
**Localização:** Corpo → Peso

### Descrição
A aba "Peso" falha ao carregar o histórico de registos do utilizador. Um toast vermelho aparece no canto inferior direito com a mensagem:

> `Erro: getWeightLogs`

O conteúdo da aba fica vazio com o estado "Sem registos ainda. Regista o teu peso acima.", mesmo que existam registos anteriores.

### Comportamento Esperado
O histórico de peso do utilizador deve ser carregado e exibido correctamente ao entrar na aba.

### Causa Provável
Falha na chamada à API ou na query à base de dados na função `getWeightLogs`. Pode ser um problema de autenticação, permissões RLS no Supabase, ou um erro não tratado na função de fetching.

---

## Bug #2 — Problema de Layout no Modal de Selecção de Treino

**Severidade:** Alta  
**Localização:** Corpo → Treino → Modal "Que treino fazes hoje?"

### Descrição
Ao abrir o modal de selecção de treino, a lista de planos importados aparece mal posicionada — parcialmente escondida ou desalinhada — impedindo a visualização e selecção correctas dos planos. O conteúdo do modal parece ter um overflow negativo ou um problema de z-index/posicionamento.

### Comportamento Esperado
A lista de planos importados deve estar completamente visível e interactiva dentro do modal, permitindo ao utilizador seleccionar o plano e a secção desejada.

### Causa Provável
Erro de CSS: posicionamento incorrecto do modal (offset, overflow, ou height fixo), possivelmente relacionado com o viewport mobile ou com a altura dinâmica do conteúdo da lista.

---

## Bug #3 — Ícones Substituídos por Texto Simples (Regressão Visual)

**Severidade:** Média  
**Localização:** Hábitos (e potencialmente outras áreas da app)

### Descrição
Os botões de acção nos cartões de hábitos exibem os caracteres de texto `E` e `X` em vez dos ícones correctos (editar e eliminar). Os ícones/emojis foram substituídos por fallback de texto, indicando que a biblioteca de ícones ou o mapeamento de assets não está a carregar correctamente.

### Comportamento Esperado
Os botões de editar e eliminar devem exibir os respectivos ícones visuais, sem recorrer a fallback de texto.

### Causa Provável
Regressão na biblioteca de ícones (ex: Lucide, Heroicons ou custom SVGs). Possível falha de importação, bundle incorreto, ou classe CSS em falta após um refactor ou actualização de dependências.

---

## Melhoria #4 — Redesign das Definições do Leitor (UX)

**Severidade:** Baixa (Melhoria)  
**Localização:** Leitura → Visualização de Livro

### Descrição
O painel de definições do leitor (Modo, Tema, Tamanho da fonte, Espaçamento entre linhas e Margens) está permanentemente expandido, ocupando uma grande porção do ecrã e reduzindo o espaço disponível para o conteúdo do livro.

### Comportamento Esperado
As definições de visualização devem ser ocultadas por defeito e acessíveis através de um botão/ícone, abrindo um drawer ou submenu colapsável. O foco inicial deve ser o conteúdo do livro.

### Solução Sugerida
Refactorizar o painel de definições para um componente colapsável (ex: um `Sheet` ou `Drawer` activado por um botão de configuração no topo da página), libertando espaço vertical para a leitura.

---

## Resumo

| # | Área | Tipo | Severidade |
|---|------|------|------------|
| 1 | Corpo → Peso | Falha de dados (`getWeightLogs`) | Alta |
| 2 | Corpo → Treino → Modal | Problema de layout/posicionamento | Alta |
| 3 | Hábitos | Regressão de ícones | Média |
| 4 | Leitura | Melhoria de UX (painel colapsável) | Baixa |
