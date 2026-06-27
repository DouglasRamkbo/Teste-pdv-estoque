# Foz Import's — Gestor PDV 3.0

Sistema completo de PDV (Ponto de Venda), gestão de estoque e controle financeiro para pequenas lojas. SPA em Vanilla JS com sincronização em nuvem via Firebase, modo offline, PWA instalável e suporte multi-usuário.

## Funcionalidades

### Vendas e Caixa
- **PDV** com busca rápida de produtos, carrinho com desconto (% ou R$), múltiplas formas de pagamento
- **Controle de Caixa**: abertura, fechamento, sangria, suprimento e cálculo de saldo esperado
- **Comprovante PDF** gerado automaticamente para cada venda
- **Histórico de pedidos** com filtros por data/cliente, edição, estorno e exportação CSV/PDF

### Estoque
- Cadastro de produtos com categoria, custo, preço, quantidade, imagem e código de barras
- Filtros por categoria, busca por nome/SKU, ordenação por colunas
- Alerta de estoque baixo configurável
- Paginação (50 itens/página)
- Undo de exclusão (5 segundos)
- Exportação PDF com cálculo de valor total em custo e venda

### Relatórios e Dashboard
- Dashboard com KPIs: vendas do dia, ticket médio, lucro, produtos vendidos
- Relatórios diários e gerais filtráveis por cliente/período
- Gráficos de vendas e top produtos

### Autenticação e Sincronização
- **Login com email/senha**, Google ou modo offline
- **Multi-usuário**: compartilhe o código da loja para sincronizar dados entre dispositivos
- **Sincronização em tempo real** via Firestore (`onSnapshot`)
- **Detecção de conflito** offline/online com opção de manter local ou usar nuvem
- **Rate limiting** automático (máx. 20 escritas/min)
- Backup/restauração local em JSON

### UX
- **Dark mode** com detecção da preferência do sistema
- **Atalhos de teclado**: `F2`–`F7` para navegação, `N` para busca, `+/-` para quantidade, `Esc` para fechar modais, `?` para ajuda
- **PWA** instalável (funciona offline depois da primeira visita)
- Interface responsiva (desktop e mobile)

## Stack

- **Vanilla JavaScript** (sem frameworks) — arquitetura modular com factory pattern
- **Vite** como bundler e dev server
- **Firebase** (Auth + Firestore) para auth e sincronização
- **Tailwind CSS** (build local, sem CDN)
- **Vitest** para testes unitários
- **html2pdf.js** para geração de PDFs
- **Phosphor Icons** (assets locais)

Nenhum CDN externo em runtime — todos os assets são empacotados localmente.

## Como rodar

Requer Node.js 18+.

```bash
npm install
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # build de produção em dist/
npm run preview   # preview do build
npm test          # roda os 35 testes unitários
```

### Configuração do Firebase

O projeto vem com um Firebase de exemplo embutido em `src/main.js` como fallback. Para usar o seu próprio (recomendado):
O projeto vem com um Firebase de exemplo embutido em `src/main.js`. Para usar o seu próprio, **prefira variáveis de ambiente** (não comite as chaves):

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Authentication** (Email/Password e Google)
3. Ative **Firestore Database** em modo de produção
4. Copie `.env.example` para `.env` e preencha com suas credenciais — o Vite as injeta em build/dev automaticamente

#### Regras de segurança do Firestore

> **Aviso:** a regra abaixo (`allow read, write: if request.auth != null;`) deixa qualquer usuário autenticado ler/escrever qualquer loja se conhecer o `storeId` (UID do dono). Use apenas em ambientes de teste. Para produção, restrinja por owner/membership:
4. Copie `.env.example` para `.env` e preencha `VITE_FIREBASE_*`
5. (Opcional) Habilite **App Check** + restrinja a apiKey por referer HTTP no console do Google Cloud — apiKeys de Firebase Web são públicas no bundle, mas só são realmente seguras com essas duas proteções

> ⚠️ A apiKey de exemplo embutida em `src/main.js` está no histórico do git. Se você usá-la em produção, **rotacione-a** no console do Firebase e mude o projeto para o seu.

#### Regras de segurança do Firestore

A loja é compartilhada por uma lista de UIDs em `members[]` dentro do próprio doc. O dono cria a loja (storeId = uid dele) e adiciona outros UIDs em `members` para compartilhar:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Estrito: apenas o dono da loja (storeId == uid) pode ler/escrever.
    match /artifacts/{appId}/stores/{storeId}/data/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == storeId;
    }
  }
}
```

Para suporte multi-usuário (compartilhar `storeId`), mantenha uma subcoleção `members/{uid}` na loja e use `exists(/.../stores/$(storeId)/members/$(request.auth.uid))` na regra.
    match /artifacts/{appId}/stores/{storeId}/data/store {
      // Leitura/escrita só se o usuário for membro OU o próprio dono (storeId == uid)
      allow read, write: if request.auth != null
        && (
          request.auth.uid == storeId
          || (resource != null && request.auth.uid in resource.data.members)
        );
      // Criação inicial: storeId tem que bater com o uid do criador
      allow create: if request.auth != null
        && request.auth.uid == storeId
        && request.auth.uid in request.resource.data.members;
    }
  }
}
```

> Para adicionar outro usuário à loja, abra Configurações → Loja, peça o UID dele e adicione manualmente em `members[]` (ou implemente um fluxo de convite). O simples "colar o código da loja" do README antigo **não é seguro** com regras abertas — qualquer usuário autenticado leria tudo.

## Estrutura do projeto

```
src/
├── main.js              # bootstrap da aplicação e App global
├── storage.js           # Firestore sync + offline + rate limit + conflito
├── utils.js             # helpers (formatMoney, formatDate, escapeHtml, etc)
└── modules/
    ├── auth.js          # login, registro, Google, logout
    ├── cart.js          # carrinho de vendas e finalização
    ├── inventory.js     # CRUD de produtos
    ├── orders.js        # histórico, edição, comprovante PDF
    ├── caixa.js         # controle de caixa
    ├── reports.js       # relatórios diário e geral
    ├── dashboard.js     # KPIs e gráficos
    ├── backup.js        # export/import JSON
    ├── shortcuts.js     # atalhos de teclado
    ├── router.js        # navegação entre views
    └── ui.js            # toasts, modais, dark mode

public/
├── sw.js                # service worker (PWA)
└── manifest.json        # manifesto PWA

vendor/                  # assets locais (fontes, ícones, CSS)
```

## Atalhos de teclado

| Tecla | Ação |
|-------|------|
| `F2`  | Finalizar venda |
| `F3`  | Ir para PDV |
| `F4`  | Ir para Estoque |
| `F5`  | Ir para Histórico |
| `F6`  | Ir para Relatórios |
| `F7`  | Ir para Dashboard |
| `N`   | Focar busca do carrinho |
| `+` / `-` | Aumentar/diminuir quantidade |
| `Esc` | Fechar modal |
| `?`   | Mostrar/ocultar dicas de atalhos |

## Testes

Testes unitários cobrindo utils (formatação, sanitização, CSV, debounce, IDs), cálculo de saldo de caixa e helpers críticos.

```bash
npm test
```

## Licença

Projeto privado. Todos os direitos reservados.
