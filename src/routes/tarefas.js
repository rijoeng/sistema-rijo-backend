// ============================================================================
// ROTAS DE TAREFAS
// ============================================================================

const express = require('express');
const pool = require('../db');
const { verificaToken, verificaRole } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas de tarefas requerem autenticação
router.use(verificaToken);

// ============================================================================
// GET /api/tarefas — Listar tarefas do usuário
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const { filtro } = req.query;

    let query = `
      SELECT t.* FROM tarefas t
      WHERE t.responsavel_id = $1
      ORDER BY t.prazo ASC, t.prioridade DESC
    `;

    const result = await pool.query(query, [req.usuario.id]);

    res.json({
      tarefas: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error('Erro ao listar tarefas:', err);
    res.status(500).json({
      erro: 'Erro ao listar tarefas'
    });
  }
});

// ============================================================================
// GET /api/tarefas/:id — Obter tarefa específica
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tarefas WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Tarefa não encontrada'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao obter tarefa:', err);
    res.status(500).json({
      erro: 'Erro ao obter tarefa'
    });
  }
});

// ============================================================================
// POST /api/tarefas — Criar nova tarefa
// ============================================================================

router.post('/', async (req, res) => {
  try {
    const { titulo, projeto_id, prioridade, prazo } = req.body;

    const result = await pool.query(
      `INSERT INTO tarefas (titulo, projeto_id, responsavel_id, prioridade, prazo, status, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [titulo, projeto_id, req.usuario.id, prioridade || 'media', prazo, 'pendente']
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    res.status(500).json({
      erro: 'Erro ao criar tarefa'
    });
  }
});

// ============================================================================
// PUT /api/tarefas/:id — Atualizar tarefa
// ============================================================================

router.put('/:id', async (req, res) => {
  try {
    const { titulo, status, prioridade, prazo } = req.body;

    const result = await pool.query(
      `UPDATE tarefas 
       SET titulo = COALESCE($1, titulo),
           status = COALESCE($2, status),
           prioridade = COALESCE($3, prioridade),
           prazo = COALESCE($4, prazo),
           atualizado_em = NOW()
       WHERE id = $5
       RETURNING *`,
      [titulo, status, prioridade, prazo, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Tarefa não encontrada'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar tarefa:', err);
    res.status(500).json({
      erro: 'Erro ao atualizar tarefa'
    });
  }
});

// ============================================================================
// DELETE /api/tarefas/:id — Deletar tarefa
// ============================================================================

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tarefas WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: 'Tarefa não encontrada'
      });
    }

    res.json({
      mensagem: 'Tarefa deletada',
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('Erro ao deletar tarefa:', err);
    res.status(500).json({
      erro: 'Erro ao deletar tarefa'
    });
  }
});

module.exports = router;
