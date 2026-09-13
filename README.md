# Sistema Rijo — Backend API

Servidor Node.js/Express com autenticação JWT e PostgreSQL para o Sistema Rijo de Gestão de Tarefas.

## 🚀 Quick Start

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Executar banco de dados
```bash
# Crie as tabelas com:
psql $DATABASE_URL -f src/migrations/init.sql
```

### 4. Iniciar servidor (desenvolvimento)
```bash
npm run dev
```

Servidor rodará em `http://localhost:3001`

## 📚 Endpoints

### Autenticação
- `POST /api/auth/login` — Fazer login
- `POST /api/auth/verificar` — Verificar token
- `POST /api/auth/logout` — Fazer logout

### Tarefas
- `GET /api/tarefas` — Listar tarefas
- `GET /api/tarefas/:id` — Obter tarefa
- `POST /api/tarefas` — Criar tarefa
- `PUT /api/tarefas/:id` — Atualizar tarefa
- `DELETE /api/tarefas/:id` — Deletar tarefa

### Projetos
- `GET /api/projetos` — Listar projetos
- `GET /api/projetos/:id` — Obter projeto
- `POST /api/projetos` — Criar projeto
- `PUT /api/projetos/:id` — Atualizar projeto
- `DELETE /api/projetos/:id` — Deletar projeto

## 🔧 Tecnologias

- Express.js
- PostgreSQL
- JWT (jsonwebtoken)
- Bcrypt (hash de senha)
- Dotenv

## 📝 Estrutura de Pastas

```
src/
├── server.js          — Servidor principal
├── db.js              — Configuração do banco
├── middleware/
│   └── auth.js        — Middleware JWT
├── routes/
│   ├── auth.js        — Rotas de autenticação
│   ├── tarefas.js     — Rotas de tarefas
│   └── projetos.js    — Rotas de projetos
└── migrations/
    └── init.sql       — Inicialização do BD
```

## 🔐 Autenticação

Todos os endpoints (exceto login) requerem token JWT no header:

```bash
Authorization: Bearer <token>
```

## 📄 Licença

Proprietary — Rijo Engenharia
