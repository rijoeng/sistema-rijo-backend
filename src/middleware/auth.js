// ============================================================================
// MIDDLEWARE DE AUTENTICAÇÃO JWT
// ============================================================================

const jwt = require('jsonwebtoken');

const verificaToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      erro: 'Token não fornecido',
      code: 'NO_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        erro: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    return res.status(401).json({
      erro: 'Token inválido',
      code: 'INVALID_TOKEN'
    });
  }
};

const verificaRole = (rolesPermitidas) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Usuário não autenticado' });
    }

    if (!rolesPermitidas.includes(req.usuario.role)) {
      return res.status(403).json({
        erro: 'Permissão negada',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

module.exports = {
  verificaToken,
  verificaRole
};
