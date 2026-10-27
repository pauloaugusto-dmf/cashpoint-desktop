# Cashpoint Desktop

Gerenciador financeiro pessoal para desktop construído com Electron, React, Vite, Tailwind CSS e SQLite.

## 🚀 Tecnologias

- **Electron**: Framework desktop multiplataforma
- **React 18 + Vite**: Interface rápida e moderna
- **Tailwind CSS**: Estilização com suporte a temas e layout frameless
- **SQLite (sqlite3 + sqlite)**: Armazenamento persistente local no diretório de usuário (`userData`)
- **Lucide React & Sonner**: Ícones e notificações toast

## 📦 Instalação e Execução

### 1. Instalar dependências
```bash
npm install
```

### 2. Modo de Desenvolvimento
Inicia o Vite e o Electron com Hot Reload:
```bash
npm run dev
```

### 3. Build do Frontend
```bash
npm run build
```

### 4. Gerar Instalador para Windows (NSIS)
Gera o executável de instalação (`.exe`) na pasta `release/`:
```bash
npm run build:win
```

## 🗄️ Estrutura do Banco Local

O banco de dados SQLite é criado automaticamente no diretório `userData` da aplicação (`cashpoint.sqlite`), contendo:
- **accounts**: Contas bancárias, carteiras e saldos
- **credit_cards**: Cartões de crédito, limites, datas de fechamento e vencimento
- **categories**: Categorias de receitas/despesas
- **expenses**: Lançamentos, parcelamentos, status de liquidação e vínculos
