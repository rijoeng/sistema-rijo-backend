// ============================================================================
// CONFIGURAÇÃO DO POOL DE CONEXÕES PostgreSQL
// ============================================================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool:', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('✅ Nova conexão estabelecida');
});

module.exports = pool;
