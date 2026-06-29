# NEXUS — 5 conceitos de redesign do Login

Mockups de alta-fidelidade (HTML/CSS reais, renderizados no browser — não imagens estáticas) em formato desktop.
Abre `index.html` para ver os 5 conceitos lado a lado. Os PNGs são exports prontos a partilhar.

Todos os conceitos cumprem os requisitos de UX: **e-mail, senha (com mostrar/ocultar), "lembrar-me", "esqueci a senha", login social e CTA de cadastro.**

---

## Diagnóstico da tela atual

| Problema | Impacto |
|---|---|
| Botão "Entrar" fica cinza/desativado e quase invisível até preencher | Reduz percepção de affordance e conversão |
| Sem login social | Mais atrito; perda de utilizadores que preferem 1-clique |
| Sem "lembrar-me" | Sessões curtas, re-login frequente |
| Ícone 👁 emoji para mostrar senha | Parece protótipo, não produto |
| Muita altura morta no topo (logo + tagline + chips) empurra o form para baixo | Form abaixo da dobra em alguns ecrãs |
| Hierarquia plana: labels, placeholders e texto legal competem | Olhos sem ponto focal claro |
| Só funciona bem em mobile escuro; sem versão desktop pensada | Aparência inconsistente em telas grandes |

### Melhorias aplicadas em todos os conceitos
- CTA principal sempre sólido e de alto contraste (nunca "apagado").
- Login social (Google/Apple) acima ou abaixo do divisor "ou".
- "Lembrar-me" + "Esqueci a senha" na mesma linha (padrão consolidado).
- Botão mostrar/ocultar senha com ícone real e estado de foco visível.
- Estados de foco com `ring` (anel) claro e acessível.
- Tipografia hierarquizada (display + UI) e espaçamento de 8px consistente.
- Layout desktop pensado (split, card centrado ou cartão elevado).

---

## Os 5 conceitos

### 1 · Aurum — Minimalista Premium  (`01-aurum-minimalista.png`)
Fundo off-white, formulário único centrado, um só acento dourado. Sensação de produto caro.
- **Paleta:** `#FBFBF9` off-white · `#111` tinta · `#E8A838` dourado · `#EDEAE3` linhas
- **Tipografia:** Fraunces (display serif) + Inter (UI)
- **UX:** foco máximo, zero ruído, CTA preto sólido com âncora.

### 2 · Momentum — SaaS Moderno  (`02-momentum-saas.png`)
Split 50/50: painel com gradiente roxo→teal, prova social e métricas à esquerda; form à direita.
- **Paleta:** `#6D5CE7` roxo · `#22D3A6` teal · `#0F1118` grafite · branco
- **Tipografia:** Space Grotesk (títulos) + Inter (corpo)
- **UX:** prova social aumenta confiança, social-login em destaque, CTA com gradiente.

### 3 · Halo — Dark Mode Futurista  (`03-halo-dark.png`)
Glassmorphism sobre fundo escuro com aura neon dourada e grid sutil. Evolução do visual atual da NEXUS.
- **Paleta:** `#0A0B12` · `#E8A838` dourado neon · `#1ECBB4` teal · `#7F77DD` roxo
- **Tipografia:** Syne (display, já no produto) + DM Sans (UI)
- **UX:** cartão "vidro" elevado, foco com glow, hierarquia por luz.

### 4 · Sprout — Friendly & Human  (`04-sprout-friendly.png`)
Cores quentes, cantos muito arredondados, ilustração amigável e copy acolhedora.
- **Paleta:** `#FFF6EC` creme · `#FF8A4C` coral · `#3AA981` verde · `#3B3024` castanho
- **Tipografia:** Plus Jakarta Sans
- **UX:** humaniza o momento de login, reduz ansiedade, alvos grandes e tocáveis.

### 5 · Meridian — Enterprise Clean  (`05-meridian-enterprise.png`)
Corporativo, navy confiável, grade rígida, selos de segurança (TLS · RGPD · SOC 2).
- **Paleta:** `#F4F6FA` · `#1B3A6B` navy · `#2E6FE6` azul ação · `#0F1B2D`
- **Tipografia:** Manrope
- **UX:** transmite robustez e confiança institucional, hierarquia clássica.

---

## Recomendação

Para a NEXUS (produto de hábitos/evolução pessoal, B2C, brand dourado-escuro):

1. **Halo (Dark Futurista)** — maior coerência com o brand atual + percepção premium/gamificada.
2. **Momentum (SaaS Moderno)** — maior potencial de **conversão** graças à prova social e ao split clássico.
3. **Aurum (Minimalista)** — melhor se o posicionamento virar "premium silencioso".

**Sugestão prática:** adotar **Halo** como tema principal e reaproveitar o **painel de prova social do Momentum** numa versão desktop. Friendly/Enterprise ficam como variantes para públicos específicos.

---

## Prompts de geração de imagem (Midjourney / DALL·E / Figma AI)

> Caso queiras também versões "renderizadas por IA", usa os prompts abaixo. Recomendo `--ar 16:10` e `--style raw` (Midjourney).

**1 · Aurum:** `High-fidelity desktop login screen UI, minimal premium SaaS, warm off-white background #FBFBF9, single centered form, elegant serif headline "Bom te ver de novo" in Fraunces, Inter UI labels, one gold accent #E8A838, black solid primary button, email + password fields with focus ring, remember-me checkbox, forgot password link, Google social login, generous whitespace, soft subtle shadows, Apple-level craft, 4k product mockup`

**2 · Momentum:** `High-fidelity desktop login page, modern SaaS startup, 50/50 split layout, left panel purple-to-teal gradient (#6D5CE7 → #22D3A6) with abstract circles, social proof stats cards and 5-star testimonial, right panel clean white login form with Google and Apple buttons, Space Grotesk headings, gradient primary CTA, remember-me, forgot password, very polished, dribbble shot, 4k`

**3 · Halo:** `High-fidelity desktop login screen, dark futuristic UI, near-black background #0A0B12, glassmorphism card with blur, golden neon glow #E8A838, subtle tech grid overlay, Syne display logo "NEXUS", tab switch Entrar/Criar conta, glowing focused password field, gradient gold CTA, Google + Apple buttons, teal and purple ambient light, premium gamified product, 4k`

**4 · Sprout:** `High-fidelity desktop login page, friendly and human, warm cream background #FFF6EC, coral accent #FF8A4C, soft rounded corners, cute plant/sprout illustration on left, encouraging microcopy "Olá de novo!", Plus Jakarta Sans, large tactile inputs, remember-me, Google + Apple, approachable wellness app aesthetic, 4k`

**5 · Meridian:** `High-fidelity desktop enterprise login, corporate trustworthy SaaS, light slate background #F4F6FA, top navbar with logo and Support link, centered elevated white card, navy primary button #1B3A6B, Manrope typography, corporate email + password, keep-me-signed-in, Google Workspace SSO, security badges TLS · GDPR · SOC 2 in footer, clean grid, B2B admin console, 4k`
