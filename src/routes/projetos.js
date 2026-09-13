// ============================================================================
// ROTAS DE PROJETOS/OBRAS
// ============================================================================

const express = require('express');
const pool = require('../db');
const { verificaToken } = require('../middleware/auth');

const router = express.Router();

router.use(verificaToken);

// ============================================================================
// GET /api/projetos — Listar projetos
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.* FROM projetos p
       ORDER BY p.nome ASC`
    );

    res.json({
      projetos: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error('Erro ao listar projetos:', err);
    res.status(500).json({
      erro: 'Erro ao listar projetos'
    });
  }
});

// ============================================================================
// GET /api/projetos/:id — Obter projeto específico
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projetos WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Projeto não encontrado'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao obter projeto:', err);
    res.status(500).json({
      erro: 'Erro ao obter projeto'
    });
  }
});

// ============================================================================
// POST /api/projetos — Criar novo projeto
// ============================================================================

router.post('/', async (req, res) => {
  try {
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({
        erro: 'Nome do projeto é obrigatório'
      });
    }

    const result = await pool.query(
      `INSERT INTO projetos (nome, status, criado_em)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [nome, 'ativa']
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    res.status(500).json({
      erro: 'Erro ao criar projeto'
    });
  }
});

// ============================================================================
// PUT /api/projetos/:id — Atualizar projeto
// ============================================================================

router.put('/:id', async (req, res) => {
  try {
    const { nome, status } = req.body;

    const result = await pool.query(
      `UPDATE projetos 
       SET nome = COALESCE($1, nome),
           status = COALESCE($2, status),
           atualizado_em = NOW()
       WHERE id = $3
       RETURNING *`,
      [nome, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Projeto não encontrado'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar projeto:', err);
    res.status(500).json({
      erro: 'Erro ao atualizar projeto'
    });
  }
});

// ============================================================================
// DELETE /api/projetos/:id — Deletar projeto
// ============================================================================

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM projetos WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Projeto não encontrado'
      });
    }

    res.json({
      mensagem: 'Projeto deletado',
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('Erro ao deletar projeto:', err);
    res.status(500).json({
      erro: 'Erro ao deletar projeto'
    });
  }
});

module.exports = router;
