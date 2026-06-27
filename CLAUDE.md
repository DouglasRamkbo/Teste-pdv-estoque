# CLAUDE.md — Foz Import's PDV 3.0

Diretrizes comportamentais para o Claude trabalhar neste projeto. Inspiradas nas [Karpathy Guidelines](https://github.com/forrestchang/andrej-karpathy-skills) (MIT) e adaptadas ao contexto deste PDV.

**Tradeoff:** estas diretrizes priorizam cautela sobre velocidade. Para tarefas triviais, use bom senso.

---

## 1. Pense antes de codar

**Não suponha. Não esconda dúvidas. Exponha tradeoffs.**

Antes de implementar:
- Explicite suas suposições. Se estiver incerto, pergunte.
- Se houver múltiplas interpretações, apresente-as — não escolha em silêncio.
- Se existir uma abordagem mais simples, diga. Discorde quando fizer sentido.
- Se algo não estiver claro, pare. Nomeie o que está confuso. Pergunte.

## 2. Simplicidade primeiro

**Código mínimo que resolve o problema. Nada especulativo.**

- Sem features além do que foi pedido.
- Sem abstrações para código usado uma única vez.
- Sem "flexibilidade" ou "configurabilidade" não solicitada.
- Sem tratamento de erro para cenários impossíveis.
- Se você escreveu 200 linhas e dava pra fazer em 50, reescreva.

Pergunte-se: "Um engenheiro sênior diria que isso está overengineered?" Se sim, simplifique.

## 3. Mudanças cirúrgicas

**Mexa só no que precisa. Limpe só a sua bagunça.**

Ao editar código existente:
- Não "melhore" código adjacente, comentários ou formatação.
- Não refatore o que não está quebrado.
- Siga o estilo existente, mesmo que você faria diferente.
- Se notar código morto não relacionado, mencione — não delete.

Quando suas mudanças deixarem órfãos:
- Remova imports/variáveis/funções que SUAS mudanças tornaram inúteis.
- Não remova código morto pré-existente sem pedirem.

O teste: toda linha alterada deve rastrear diretamente para o pedido do usuário.

## 4. Execução orientada a objetivos

**Defina critérios de sucesso. Itere até verificar.**

Transforme tarefas em objetivos verificáveis com exemplos. Apresente um plano breve com etapas e pontos de verificação.

Exemplo: em vez de "corrija o bug", faça "escreva um teste que reproduz o bug, depois faça-o passar".

**Estas diretrizes estão funcionando se:** menos mudanças desnecessárias nos diffs, menos retrabalho por overengineering, e perguntas de esclarecimento aparecem antes da implementação — não depois do erro.

---

## Convenções específicas deste projeto

### Stack e estilo
- **Vanilla JS** sem frameworks. Não introduza React/Vue/etc.
- **Sem CDN em runtime** — todos os assets são empacotados via `vendor/` ou `public/`.
- **Tailwind via build local** (sem CDN).
- Padrão de módulos: factory pattern em `src/modules/*.js`.

### Antes de mexer em código
- Rode `npm test` antes e depois de mudanças significativas (35 testes em `src/**`).
- Para mudanças de UI, suba `npm run dev` e teste o fluxo no browser.
- Storage tem rate limiting (20 escritas/min) — cuidado ao adicionar `set()` em loops.

### Estrutura crítica
- `src/main.js` — bootstrap e `App` global. Mudanças aqui afetam tudo.
- `src/storage.js` — sync Firestore + offline + conflito. Não simplifique sem entender o fluxo de `onSnapshot` e rate limit.
- `src/modules/auth.js` — fluxo de login (email, Google, offline). Não quebre o modo offline.

### Commits
- Mensagens em português, descritivas, focando no "porquê".
- Não commite credenciais Firebase reais — `src/main.js` tem config de exemplo.
