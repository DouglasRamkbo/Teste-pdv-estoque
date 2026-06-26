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

O projeto vem com um Firebase de exemplo embutido em `src/main.js`. Para usar o seu próprio:

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative **Authentication** (Email/Password e Google)
3. Ative **Firestore Database** em modo de produção
4. Substitua o objeto `firebaseConfig` em `src/main.js` pelas suas credenciais

#### Regras de segurança do Firestore

Para o modo multi-usuário funcionar, configure as regras:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/stores/{storeId}/data/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

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

35 testes unitários cobrindo utils, storage, cart, inventory, orders e cálculos financeiros.

```bash
npm test
```

## Licença

Projeto privado. Todos os direitos reservados.
