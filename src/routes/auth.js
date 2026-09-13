// ============================================================================
// ROTAS DE AUTENTICAÇÃO
// ============================================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { verificaToken } = require('../middleware/auth');

const router = express.Router();

// ============================================================================
// GERADOR DE HASH DE SENHA
// ============================================================================

const hashSenha = async (senha) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(senha, salt);
};

const comparaSenha = async (senhaInformada, senhaHash) => {
  return bcrypt.compare(senhaInformada, senhaHash);
};

// ============================================================================
// POST /api/auth/login
// ============================================================================

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Validação
    if (!email || !senha) {
      return res.status(400).json({
        erro: 'Email e senha são obrigatórios'
      });
    }

    // Buscar usuário no banco
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        erro: 'Email ou senha incorretos'
      });
    }

    const usuario = result.rows[0];

    // Verificar senha
    const senhaValida = await comparaSenha(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        erro: 'Email ou senha incorretos'
      });
    }

    // Verificar se usuário está ativo
    if (usuario.situacao !== 'ativo') {
      return res.status(401).json({
        erro: 'Usuário desativado'
      });
    }

    // Gerar JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
        role: usuario.role,
        area: usuario.area_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Atualizar último acesso
    await pool.query(
      'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1',
      [usuario.id]
    );

    // Retornar dados do usuário + token
    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        foto_url: usuario.foto_url
      }
    });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({
      erro: 'Erro ao fazer login'
    });
  }
});

// ============================================================================
// POST /api/auth/verificar
// ============================================================================

router.post('/verificar', verificaToken, async (req, res) => {
  try {
    // Se passou no middleware, token é válido
    const result = await pool.query(
      'SELECT id, nome, email, role, foto_url FROM usuarios WHERE id = $1 AND situacao = $2',
      [req.usuario.id, 'ativo']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        erro: 'Usuário não encontrado ou desativado'
      });
    }

    res.json({
      valido: true,
      usuario: result.rows[0]
    });

  } catch (err) {
    console.error('Erro ao verificar token:', err);
    res.status(500).json({
      erro: 'Erro ao verificar token'
    });
  }
});

// ============================================================================
// POST /api/auth/logout
// ============================================================================

router.post('/logout', verificaToken, (req, res) => {
  // Logout é apenas no frontend (remover token do localStorage)
  // Backend não mantém sessões, JWT é stateless
  res.json({
    mensagem: 'Logout realizado'
  });
});

// ============================================================================
// CRIAR USUÁRIO INICIAL (apenas para setup)
// ============================================================================

router.post('/criar-inicial', async (req, res) => {
  try {
    const { email, senha, nome } = req.body;

    // Verificar se já existe usuário
    const existente = await pool.query(
      'SELECT COUNT(*) as count FROM usuarios'
    );

    if (existente.rows[0].count > 0) {
      return res.status(403).json({
        erro: 'Usuário já existe. Rota desabilitada.'
      });
    }

    // Hash da senha
    const senhaHash = await hashSenha(senha);

    // Inserir usuário
    const result = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, role, situacao, criado_em)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, nome, email, role`,
      [nome, email.toLowerCase(), senhaHash, 'admin', 'ativo']
    );

    res.status(201).json({
      mensagem: 'Usuário criado com sucesso',
      usuario: result.rows[0]
    });

  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({
      erro: 'Erro ao criar usuário'
    });
  }
});

module.exports = router;
