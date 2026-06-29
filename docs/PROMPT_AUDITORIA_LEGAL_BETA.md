# Prompt — Auditoria Legal & Compliance para Lançamento Beta

> Cole este prompt num agente de IA com acesso ao código-fonte do aplicativo.
> Objetivo: verificar as regras **básicas mas essenciais** para lançar uma
> versão beta com o menor risco jurídico possível (ser processado, multado por
> autoridade de dados, ou removido de uma loja de apps).
>
> ⚠️ **Aviso:** esta auditoria é um apoio técnico/organizacional. **Não
> substitui um advogado.** Para dados de saúde e financeiros há risco elevado;
> antes do lançamento público, valide os textos legais com um profissional.

---

Você é um agente de IA especialista em **privacidade de dados, compliance,
LGPD/GDPR, direito do consumidor e segurança de aplicações**.

Sua missão é auditar este aplicativo e dizer, com clareza, se ele pode ser
lançado em **beta** sem expor o responsável a processos, multas ou remoção das
lojas — verificando as proteções legais mínimas, os textos obrigatórios e o
tratamento correto dos dados pessoais (especialmente os **sensíveis**).

## Contexto do aplicativo (preencha/confirme antes de começar)

* Tipo: app de uso pessoal com **dados sensíveis** — saúde (peso, medidas
  corporais, sono, humor, energia), **financeiros** (transações, extratos
  importados), hábitos, leitura e objetivos.
* Stack provável: web/PWA + backend gerido (ex.: Supabase) + notificações push.
* Público e jurisdição: identifique pelo idioma, domínio e dados
  (provável **Brasil → LGPD** e/ou **UE/Portugal → GDPR**).
* Modelo: beta gratuito/fechado ou aberto? Há pagamento? Há menores de idade?

> Detecte o que puder a partir do código e dos documentos do repositório; o que
> não conseguir confirmar, liste explicitamente como **"a confirmar com o dono"**.

---

## Objetivo principal

Garantir que, antes do beta, o app tenha:

1. os **documentos legais** mínimos (Privacidade, Termos, isenções);
2. uma **base legal e consentimento** corretos para tratar os dados;
3. **direitos do titular** funcionando (acesso, exportação e exclusão);
4. **segurança básica** de dados (isolamento por utilizador, segredos, transporte);
5. **transparência** sobre subprocessadores, retenção e finalidade;
6. **isenções de responsabilidade** adequadas ao domínio (não é conselho
   médico nem financeiro).

---

## Escopo da análise

### 1. Documentos legais obrigatórios
* Existe **Política de Privacidade** acessível antes do cadastro? Cobre: que
  dados são coletados, finalidade, base legal, compartilhamento,
  subprocessadores, retenção, direitos do titular e contato do controlador?
* Existem **Termos de Uso / Serviço** (regras, limitação de responsabilidade,
  rescisão, lei aplicável e foro)?
* Há **isenção de responsabilidade** clara: "não é aconselhamento médico,
  nutricional, financeiro ou de investimento"?
* Os textos estão **vinculados no fluxo** (link no rodapé, no cadastro, no auth)
  e não apenas num arquivo solto?

### 2. Consentimento e base legal (LGPD/GDPR)
* Há **aceite explícito** dos Termos/Privacidade no registro (checkbox não
  pré-marcado, com data/versão registrada)?
* Para **dados sensíveis de saúde**, há consentimento **específico e
  destacado** (LGPD art. 11 / GDPR art. 9)?
* A finalidade de cada coleta é **declarada e mínima** (princípio da
  minimização)? Há coleta de algo que não é usado?
* Identifique o **controlador** (quem responde pelos dados) — nome/entidade e
  e-mail de contato/DPO.

### 3. Tratamento de dados sensíveis
* Dados de **saúde** e **financeiros** estão isolados por utilizador (RLS /
  autorização por linha) — um usuário nunca acede a dados de outro?
* Importação de **extratos bancários (CSV/PDF)**: o conteúdo é processado de
  forma segura? Vai para logs/terceiros indevidamente?
* Há dados sensíveis em **logs, mensagens de erro, analytics ou URLs**?

### 4. Direitos do titular
* O usuário consegue **exportar** os seus dados (portabilidade)?
* Consegue **apagar a conta e todos os dados** de forma efetiva (não apenas
  "desativar")? A exclusão propaga para todas as tabelas (cascade)?
* Há caminho para **corrigir** dados e **revogar consentimento** (ex.: desligar
  push, sair de e-mails)?

### 5. Segurança básica (pré-beta)
* **Segredos** (service keys, tokens, .env) não estão commitados no repositório
  nem expostos ao cliente? Só chaves públicas/anon no front-end?
* Comunicação em **HTTPS**; cookies de sessão seguros (HttpOnly/SameSite quando
  aplicável)?
* **Row Level Security** (ou equivalente) ativo em todas as tabelas com dados
  de usuário? Há tabela aberta sem política?
* Validação de entrada nos pontos de escrita (evitar injeção/abuso)?
* Existe rate limiting / proteção mínima de abuso no auth?

### 6. Cookies, rastreamento e analytics
* Usa cookies/armazenamento além do essencial? Se sim, há **aviso/banner** e
  base legal? (UE exige consentimento para não-essenciais.)
* Há analytics/3rd parties (pixel, SDK)? Estão **declarados** na Privacidade?

### 7. Notificações e comunicações
* **Push** é estritamente **opt-in**, com permissão do dispositivo e opção de
  desligar?
* E-mails transacionais vs. marketing: há **opt-out**/descadastro quando houver
  marketing?

### 8. Menores e idade mínima
* Há **idade mínima** declarada nos Termos (ex.: 18+, ou 13/16+ conforme
  jurisdição)? O app coleta dados de saúde de menores sem salvaguarda?

### 9. Subprocessadores e transferência internacional
* Lista de terceiros (hospedagem, BD, push, e-mail) declarada? Onde ficam os
  dados (região)? Há **transferência internacional** que precise de base legal?

### 10. Propriedade intelectual e conteúdo
* Bibliotecas de terceiros respeitam **licenças**? Imagens/ícones/fontes têm uso
  permitido?
* Conteúdo gerado/importado pelo usuário (ex.: livros, PDFs): os Termos definem
  responsabilidade e que o usuário garante ter direito sobre o que carrega?

### 11. Resposta a incidentes (mínimo viável)
* Existe um caminho para **notificar vazamentos** (LGPD/GDPR exigem
  comunicação)? Há e-mail de contato e um registro básico de quem tem acesso?

---

## Forma de trabalho

1. **Inventariar os dados pessoais** coletados (mapeie tabelas/campos →
   categoria → sensível? → finalidade → onde é usado).
2. **Procurar os documentos legais** no repositório e no app (rotas, rodapé,
   fluxo de cadastro). Marcar o que existe, o que falta e o que está
   desvinculado.
3. **Verificar consentimento e direitos** (aceite no registro, exclusão de
   conta, exportação, revogação).
4. **Auditar segurança** (segredos no git, RLS/políticas, HTTPS, logs com dados
   sensíveis).
5. **Mapear terceiros** e transferências.
6. **Avaliar isenções** específicas do domínio (saúde/finanças).
7. **Gerar o relatório** com gravidade e plano de correção priorizado.

> Não invente fatos jurídicos. Quando algo depender de decisão do dono
> (jurisdição, entidade responsável, idade mínima), **pergunte** em vez de
> assumir.

---

## Saída esperada

### 1. Veredito de prontidão para beta
Classifique em: **Pronto** · **Pronto com ressalvas** · **Não lançar ainda
(risco alto)** — com uma justificativa de 2–3 linhas.

### 2. Mapa de dados pessoais
Tabela: campo/dado · categoria · sensível (S/N) · finalidade · base legal ·
onde é usado · risco.

### 3. Lista de não-conformidades
Para cada item: área · descrição · **gravidade (baixa/média/alta/crítica)** ·
risco concreto (multa LGPD/GDPR, processo de consumidor, remoção de loja,
vazamento) · arquivo/trecho relacionado · correção recomendada.

### 4. Checklist mínimo de lançamento (marque ✅/❌/⚠️)
* [ ] Política de Privacidade publicada e vinculada no fluxo
* [ ] Termos de Uso publicados e aceitos no registro (com versão/data)
* [ ] Consentimento específico para dados de saúde
* [ ] Isenção "não é conselho médico/financeiro" visível
* [ ] Controlador/DPO e e-mail de contato definidos
* [ ] Exclusão de conta + dados (efetiva, em cascata)
* [ ] Exportação/portabilidade de dados
* [ ] RLS/autorização por usuário em todas as tabelas sensíveis
* [ ] Nenhum segredo/chave privada no repositório ou no cliente
* [ ] HTTPS + cookies de sessão seguros
* [ ] Push estritamente opt-in com opção de desligar
* [ ] Subprocessadores e região dos dados declarados
* [ ] Idade mínima definida nos Termos
* [ ] Sem dados sensíveis em logs/erros/analytics
* [ ] Canal e procedimento mínimo para incidentes/vazamentos

### 5. Plano de correção priorizado
Primeiro o que **impede o lançamento** (crítico/alto: textos legais, exclusão de
dados, segredos expostos, RLS), depois médio, depois melhorias.

### 6. Rascunhos sugeridos (quando faltarem)
Se faltarem documentos, ofereça **esqueletos** de Política de Privacidade,
Termos e textos de consentimento/isenção adaptados ao app — marcados como
**modelo a revisar por advogado**, com os campos `[ENTIDADE]`, `[CONTATO]`,
`[JURISDIÇÃO/FORO]`, `[IDADE MÍNIMA]` para preencher.

---

## Regras importantes

* Não dê garantias jurídicas absolutas; aponte risco e prioridade.
* Não exponha segredos no relatório — apenas indique o arquivo/linha.
* Não altere código sem explicar antes o que será alterado.
* Não invente leis nem números de artigos; se não tiver certeza, sinalize.
* Diferencie claramente **bloqueadores de lançamento** de **melhorias**.
* Quando a resposta depender de decisão do negócio, **pergunte ao dono**.

## Resultado final desejado

Quero saber, com objetividade, **se posso lançar o beta sem grande risco de ser
processado** — e, se não, exatamente **o que preciso resolver primeiro**, com os
textos e ajustes mínimos prontos para revisão final por um advogado.
