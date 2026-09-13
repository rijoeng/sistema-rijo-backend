// ============================================================================
// SISTEMA RIJO — BACKEND / API
// ============================================================================
// Servidor Express com autenticação JWT e PostgreSQL
// Criado: 13/09/2026
// ============================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const tarefasRoutes = require('./routes/tarefas');
const projetosRoutes = require('./routes/projetos');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});

// ============================================================================
// ROTAS
// ============================================================================

// Autenticação (login, logout, refresh token)
app.use('/api/auth', authRoutes);

// Tarefas
app.use('/api/tarefas', tarefasRoutes);

// Projetos/Obras
app.use('/api/projetos', projetosRoutes);

// ============================================================================
// TRATAMENTO DE ERROS
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Erro:', err.message);
  res.status(err.status || 500).json({
    erro: err.message || 'Erro interno do servidor',
    timestamp: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada',
    path: req.path
  });
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, async () => {
  try {
    // Testar conexão com banco de dados
    const client = await pool.connect();
    console.log('✅ Banco de dados conectado');
    client.release();

    console.log(`✅ Servidor rodando em ${process.env.NODE_ENV === 'production' 
      ? 'PRODUÇÃO' 
      : 'DESENVOLVIMENTO'}`);
    console.log(`✅ Porta: ${PORT}`);
    console.log(`✅ URL: ${process.env.FRONTEND_URL || 'http://localhost:' + PORT}`);
  } catch (err) {
    console.error('❌ Erro ao conectar banco de dados:', err.message);
    process.exit(1);
  }
});

module.exports = app;
