// ============================================================================
// ROTAS DE TAREFAS — Sistema Rijo INS.02
// ============================================================================
// Implementa: Painel, Minhas Tarefas, Equipe, Filtros, Prioridade automática

const express = require('express');
const pool = require('../db');
const { verificaToken, verificaRole } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(verificaToken);

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calcula prioridade efetiva baseado em status, prioridade manual e prazo
 * Regra: ≤3 dias = alta (emergencial), ≤15 dias = media (curto prazo), >15 = baixa
 */
function calcularPrioridade(status, prioManual, prazo) {
  if (status === 'concluida') return 'baixa';
  if (prioManual) return prioManual;
  if (!prazo) return 'baixa';

  const dias = Math.floor((new Date(prazo) - new Date()) / (1000 * 60 * 60 * 24));
  if (dias <= 3) return 'alta';
  if (dias <= 15) return 'media';
  return 'baixa';
}

/**
 * Verifica se tarefa está atrasada
 */
function estaAtrasada(status, prazo) {
  if (status === 'concluida' || !prazo) return false;
  return new Date(prazo) < new Date();
}

// ============================================================================
// GET /api/tarefas/painel — KPIs e estatísticas gerais
// ============================================================================

router.get('/painel/overview', async (req, res) => {
  try {
    const userId = req.usuario.id;

    // Total de tarefas por status
    const statusResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
        COUNT(*) FILTER (WHERE status = 'andamento') as andamento,
        COUNT(*) FILTER (WHERE status = 'concluida') as concluidas,
        COUNT(*) FILTER (WHERE status != 'concluida' AND prazo < CURRENT_DATE) as atrasadas
      FROM tarefas
    `);

    // Emergenciais (≤3 dias, não concluídas)
    const emergenciaisResult = await pool.query(`
      SELECT COUNT(*) as total FROM tarefas
      WHERE status != 'concluida' 
        AND prazo IS NOT NULL 
        AND prazo <= CURRENT_DATE + INTERVAL '3 days'
    `);

    // Curto prazo (4-15 dias)
    const curtoPrazoResult = await pool.query(`
      SELECT COUNT(*) as total FROM tarefas
      WHERE status != 'concluida' 
        AND prazo > CURRENT_DATE + INTERVAL '3 days'
        AND prazo <= CURRENT_DATE + INTERVAL '15 days'
    `);

    // Carga por colaborador (top 5)
    const cargaResult = await pool.query(`
      SELECT 
        c.id,
        c.nome,
        COUNT(t.id) as total_tarefas,
        COUNT(t.id) FILTER (WHERE t.status != 'concluida') as ativas
      FROM colaboradores c
      LEFT JOIN tarefas t ON c.id = t.responsavel_id
      GROUP BY c.id, c.nome
      ORDER BY COUNT(t.id) DESC
      LIMIT 5
    `);

    res.json({
      resumo: {
        pendentes: parseInt(statusResult.rows[0].pendentes) || 0,
        emAndamento: parseInt(statusResult.rows[0].andamento) || 0,
        concluidas: parseInt(statusResult.rows[0].concluidas) || 0,
        atrasadas: parseInt(statusResult.rows[0].atrasadas) || 0,
        emergenciais: parseInt(emergenciaisResult.rows[0].total) || 0,
        curtoPrazo: parseInt(curtoPrazoResult.rows[0].total) || 0
      },
      cargaPorColaborador: cargaResult.rows
    });

  } catch (err) {
    console.error('Erro ao obter painel:', err);
    res.status(500).json({ erro: 'Erro ao obter painel' });
  }
});

// ============================================================================
// GET /api/tarefas/minhas — Minhas tarefas (do usuário logado)
// ============================================================================

router.get('/minhas/lista', async (req, res) => {
  try {
    const { status, ordenacao } = req.query;
    const userId = req.usuario.id;

    // Buscar colaborador do usuário
    const colabResult = await pool.query(
      'SELECT id FROM colaboradores WHERE usuario_id = $1 LIMIT 1',
      [userId]
    );

    if (colabResult.rows.length === 0) {
      return res.json({ tarefas: [], total: 0 });
    }

    const colaboradorId = colabResult.rows[0].id;

    let query = `
      SELECT 
        t.*,
        c.nome as responsavel_nome,
        p.nome as projeto_nome,
        ta.nome as tipo_nome
      FROM tarefas t
      LEFT JOIN colaboradores c ON t.responsavel_id = c.id
      LEFT JOIN projetos p ON t.projeto_id = p.id
      LEFT JOIN tipos_atividade ta ON t.tipo_id = ta.id
      WHERE t.responsavel_id = $1
    `;

    const params = [colaboradorId];

    // Filtro de status
    if (status && status !== 'todas') {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    // Ordenação
    switch (ordenacao) {
      case 'prazo':
        query += ' ORDER BY t.prazo ASC NULLS LAST';
        break;
      case 'prioridade':
        query += ` ORDER BY CASE 
          WHEN t.status = 'concluida' THEN 3
          WHEN t.prioridade_manual IS NOT NULL THEN 
            CASE t.prioridade_manual WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END
          ELSE 
            CASE 
              WHEN t.prazo IS NULL THEN 3
              WHEN t.prazo <= CURRENT_DATE + INTERVAL '3 days' THEN 1
              WHEN t.prazo <= CURRENT_DATE + INTERVAL '15 days' THEN 2
              ELSE 3
            END
        END, t.prazo ASC`;
        break;
      case 'criacao':
        query += ' ORDER BY t.criado_em DESC';
        break;
      default:
        query += ' ORDER BY t.prazo ASC NULLS LAST';
    }

    const result = await pool.query(query, params);

    res.json({
      tarefas: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error('Erro ao listar minhas tarefas:', err);
    res.status(500).json({ erro: 'Erro ao listar tarefas' });
  }
});

// ============================================================================
// GET /api/tarefas/equipe — Tarefas agrupadas por colaborador
// ============================================================================

router.get('/equipe/lista', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.nome,
        c.area_id,
        a.nome as area_nome,
        json_agg(json_build_object(
          'id', t.id,
          'titulo', t.titulo,
          'status', t.status,
          'prazo', t.prazo,
          'projeto', p.nome,
          'tipo', ta.nome
        ) ORDER BY t.prazo ASC NULLS LAST) FILTER (WHERE t.id IS NOT NULL) as tarefas
      FROM colaboradores c
      LEFT JOIN areas a ON c.area_id = a.id
      LEFT JOIN tarefas t ON c.id = t.responsavel_id AND t.status != 'concluida'
      LEFT JOIN projetos p ON t.projeto_id = p.id
      LEFT JOIN tipos_atividade ta ON t.tipo_id = ta.id
      WHERE c.situacao = 'ativo'
      GROUP BY c.id, c.nome, c.area_id, a.nome
      ORDER BY c.nome
    `);

    res.json(result.rows);

  } catch (err) {
    console.error('Erro ao listar equipe:', err);
    res.status(500).json({ erro: 'Erro ao listar equipe' });
  }
});

// ============================================================================
// GET /api/tarefas — Listar com filtros avançados
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      projeto_id, 
      responsavel_id, 
      tipo_id,
      apenas_ativas 
    } = req.query;

    let query = `
      SELECT 
        t.*,
        c.nome as responsavel_nome,
        p.nome as projeto_nome,
        ta.nome as tipo_nome
      FROM tarefas t
      LEFT JOIN colaboradores c ON t.responsavel_id = c.id
      LEFT JOIN projetos p ON t.projeto_id = p.id
      LEFT JOIN tipos_atividade ta ON t.tipo_id = ta.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    if (apenas_ativas === 'true') {
      query += ` AND t.status != 'concluida'`;
    }

    if (projeto_id) {
      query += ` AND t.projeto_id = $${params.length + 1}`;
      params.push(projeto_id);
    }

    if (responsavel_id) {
      query += ` AND t.responsavel_id = $${params.length + 1}`;
      params.push(responsavel_id);
    }

    if (tipo_id) {
      query += ` AND t.tipo_id = $${params.length + 1}`;
      params.push(tipo_id);
    }

    query += ' ORDER BY t.prazo ASC, t.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      tarefas: result.rows,
      total: result.rows.length
    });

  } catch (err) {
    console.error('Erro ao listar tarefas:', err);
    res.status(500).json({ erro: 'Erro ao listar tarefas' });
  }
});

// ============================================================================
// GET /api/tarefas/:id — Obter tarefa específica
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        c.nome as responsavel_nome,
        p.nome as projeto_nome,
        ta.nome as tipo_nome
      FROM tarefas t
      LEFT JOIN colaboradores c ON t.responsavel_id = c.id
      LEFT JOIN projetos p ON t.projeto_id = p.id
      LEFT JOIN tipos_atividade ta ON t.tipo_id = ta.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao obter tarefa:', err);
    res.status(500).json({ erro: 'Erro ao obter tarefa' });
  }
});

// ============================================================================
// POST /api/tarefas — Criar nova tarefa
// ============================================================================

router.post('/', async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      responsavel_id,
      projeto_id,
      tipo_id,
      prazo,
      prazo_estimado,
      prioridade_manual,
      recorrente,
      dossie,
      acompanhamento,
      observacoes,
      checklist
    } = req.body;

    if (!titulo) {
      return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    const result = await pool.query(`
      INSERT INTO tarefas (
        titulo, descricao, responsavel_id, projeto_id, tipo_id,
        criado_em, prazo, prazo_estimado, prioridade_manual, status,
        recorrente, dossie, acompanhamento, observacoes, checklist,
        criado_por_id
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, 'pendente',
                $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      titulo,
      descricao || null,
      responsavel_id || null,
      projeto_id || null,
      tipo_id || null,
      prazo || null,
      prazo_estimado || false,
      prioridade_manual || null,
      recorrente || false,
      dossie || false,
      acompanhamento || false,
      observacoes || null,
      JSON.stringify(checklist || []),
      req.usuario.id
    ]);

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    res.status(500).json({ erro: 'Erro ao criar tarefa' });
  }
});

// ============================================================================
// PUT /api/tarefas/:id — Atualizar tarefa
// ============================================================================

router.put('/:id', async (req, res) => {
  try {
    const {
      titulo,
      descricao,
      responsavel_id,
      projeto_id,
      tipo_id,
      prazo,
      prazo_estimado,
      prioridade_manual,
      status,
      recorrente,
      dossie,
      acompanhamento,
      observacoes,
      checklist
    } = req.body;

    const result = await pool.query(`
      UPDATE tarefas SET
        titulo = COALESCE($1, titulo),
        descricao = COALESCE($2, descricao),
        responsavel_id = COALESCE($3, responsavel_id),
        projeto_id = COALESCE($4, projeto_id),
        tipo_id = COALESCE($5, tipo_id),
        prazo = COALESCE($6, prazo),
        prazo_estimado = COALESCE($7, prazo_estimado),
        prioridade_manual = COALESCE($8, prioridade_manual),
        status = COALESCE($9, status),
        recorrente = COALESCE($10, recorrente),
        dossie = COALESCE($11, dossie),
        acompanhamento = COALESCE($12, acompanhamento),
        observacoes = COALESCE($13, observacoes),
        checklist = COALESCE($14::jsonb, checklist),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `, [
      titulo, descricao, responsavel_id, projeto_id, tipo_id,
      prazo, prazo_estimado, prioridade_manual, status,
      recorrente, dossie, acompanhamento, observacoes,
      checklist ? JSON.stringify(checklist) : null,
      req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar tarefa:', err);
    res.status(500).json({ erro: 'Erro ao atualizar tarefa' });
  }
});

// ============================================================================
// PUT /api/tarefas/:id/status — Atualizar apenas status (simples)
// ============================================================================

router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pendente', 'andamento', 'concluida'].includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    const result = await pool.query(`
      UPDATE tarefas SET
        status = $1,
        concluido_em = CASE WHEN $1 = 'concluida' THEN CURRENT_DATE ELSE concluido_em END,
        concluido_por_id = CASE WHEN $1 = 'concluida' THEN $3 ELSE concluido_por_id END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, req.params.id, req.usuario.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// ============================================================================
// PUT /api/tarefas/:id/checklist — Atualizar checklist
// ============================================================================

router.put('/:id/checklist', async (req, res) => {
  try {
    const { checklist } = req.body;

    if (!Array.isArray(checklist)) {
      return res.status(400).json({ erro: 'Checklist deve ser um array' });
    }

    const result = await pool.query(`
      UPDATE tarefas SET
        checklist = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [JSON.stringify(checklist), req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erro ao atualizar checklist:', err);
    res.status(500).json({ erro: 'Erro ao atualizar checklist' });
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
      return res.status(404).json({ erro: 'Tarefa não encontrada' });
    }

    res.json({
      mensagem: 'Tarefa deletada',
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('Erro ao deletar tarefa:', err);
    res.status(500).json({ erro: 'Erro ao deletar tarefa' });
  }
});

module.exports = router;
