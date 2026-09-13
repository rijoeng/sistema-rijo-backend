-- ============================================================================
-- SISTEMA RIJO — INICIALIZAÇÃO DO BANCO DE DADOS
-- ============================================================================
-- Execute este script para criar todas as tabelas necessárias
-- Data: 13/09/2026
-- ============================================================================

-- ============================================================================
-- 1. TABELA: EMPRESA
-- ============================================================================

CREATE TABLE IF NOT EXISTS empresa (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  logo_url TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. TABELA: AREAS (Setores/Departamentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dados iniciais
INSERT INTO areas (nome, ativa) VALUES 
  ('Engenharia', true),
  ('Financeiro', true),
  ('Administrativo', true),
  ('RH', true),
  ('Diretoria', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. TABELA: CARGOS (Funções)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cargos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dados iniciais
INSERT INTO cargos (nome, ativa) VALUES 
  ('Diretor', true),
  ('Engenheiro Senior', true),
  ('Engenheiro', true),
  ('Assistente de Engenharia', true),
  ('Gerente Financeiro', true),
  ('Assistente Administrativo', true),
  ('Gerente de RH', true),
  ('Gestor de Projetos', true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. TABELA: USUARIOS (Colaboradores com login)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  area_id INTEGER REFERENCES areas(id),
  cargo_id INTEGER REFERENCES cargos(id),
  foto_url TEXT,
  role VARCHAR(50) DEFAULT 'usuario',
  situacao VARCHAR(20) DEFAULT 'ativo',
  ultimo_acesso TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_role ON usuarios(role);

-- ============================================================================
-- 5. TABELA: PROJETOS (Obras)
-- ============================================================================

CREATE TABLE IF NOT EXISTS projetos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  status VARCHAR(50) DEFAULT 'ativa',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projetos_status ON projetos(status);

-- ============================================================================
-- 6. TABELA: TAREFAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tarefas (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT,
  projeto_id INTEGER REFERENCES projetos(id) ON DELETE CASCADE,
  responsavel_id INTEGER REFERENCES usuarios(id),
  prioridade VARCHAR(20) DEFAULT 'media',
  status VARCHAR(50) DEFAULT 'pendente',
  prazo DATE,
  tipo VARCHAR(100),
  checklist JSONB DEFAULT '[]',
  marcadores JSONB DEFAULT '{}',
  ordem_manual INTEGER,
  criado_por INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  concluida_em TIMESTAMP
);

CREATE INDEX idx_tarefas_responsavel ON tarefas(responsavel_id);
CREATE INDEX idx_tarefas_projeto ON tarefas(projeto_id);
CREATE INDEX idx_tarefas_status ON tarefas(status);
CREATE INDEX idx_tarefas_prazo ON tarefas(prazo);

-- ============================================================================
-- 7. TABELA: MODELOS DE TAREFAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS modelos_tarefas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  itens_checklist JSONB DEFAULT '[]',
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dados iniciais - 10 modelos da Central de Tarefas
INSERT INTO modelos_tarefas (nome, descricao, itens_checklist) VALUES 
  ('Preparação de Obra', 'Checklist para início de uma obra', '["Levantamento de topografia","Aquisição de materiais","Mobilização de equipamentos","Contratação de mão de obra","Geração de cronograma"]'),
  ('Execução de Fundação', 'Atividades para execução de fundação','["Escavação","Fôrmas","Armação","Concretagem","Cura do concreto"]'),
  ('Alvenaria', 'Checklist para execução de alvenaria','["Marcação de prumadas","Assentamento de blocos","Verificação de esquadro","Limpeza","Inspeção"]'),
  ('Cobertura', 'Atividades de execução de cobertura','["Estrutura de madeira/aço","Impermeabilização","Telha/Laje","Acabamento"]'),
  ('Instalações Elétricas', 'Checklist para instalação elétrica','["Levantamento de projeto","Instalação de eletrodutos","Passagem de fios","Instalação de caixas","Testes e comissionamento"]'),
  ('Instalações Hidráulicas', 'Atividades de instalação hidráulica','["Levantamento de projeto","Instalação de tubulação","Testes de pressão","Instalação de aparelhos","Comissionamento"]'),
  ('Acabamentos', 'Checklist para acabamentos internos','["Chapisco","Emboço","Reboco","Pintura","Colocação de rodapé"]'),
  ('Verificação de Qualidade', 'Inspeção de qualidade','["Verificação dimensional","Verificação de nível e prumo","Inspeção de acabamentos","Teste de funcionalidade","Relatório de conformidade"]'),
  ('Fechamento de Obra', 'Atividades finais da obra','["Limpeza geral","Remoção de escombros","Desmobilização","Documentação final","Chave entregue"]'),
  ('Reunião de Obra', 'Pontos a abordar em reunião','["Status de tarefas pendentes","Problemas identificados","Cronograma próximas atividades","Segurança e saúde","Próximos passos"]')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. TABELA: LOGS / AUDITORIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS logs_auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  acao VARCHAR(100) NOT NULL,
  tabela VARCHAR(100) NOT NULL,
  registro_id INTEGER,
  detalhes JSONB,
  ip_address VARCHAR(45),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX idx_logs_criado ON logs_auditoria(criado_em);

-- ============================================================================
-- 9. TABELA: PERMISSOES POR MÓDULO
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissoes_modulos (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  modulo VARCHAR(100) NOT NULL,
  pode_visualizar BOOLEAN DEFAULT false,
  pode_criar BOOLEAN DEFAULT false,
  pode_editar BOOLEAN DEFAULT false,
  pode_deletar BOOLEAN DEFAULT false,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(usuario_id, modulo)
);

CREATE INDEX idx_permissoes_usuario ON permissoes_modulos(usuario_id);

-- ============================================================================
-- FUNÇÃO: Atualizar timestamp de atualizado_em
-- ============================================================================

CREATE OR REPLACE FUNCTION atualiza_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tabelas relevantes
DROP TRIGGER IF EXISTS trigger_atualiza_usuarios ON usuarios;
CREATE TRIGGER trigger_atualiza_usuarios
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION atualiza_timestamp();

DROP TRIGGER IF EXISTS trigger_atualiza_tarefas ON tarefas;
CREATE TRIGGER trigger_atualiza_tarefas
BEFORE UPDATE ON tarefas
FOR EACH ROW
EXECUTE FUNCTION atualiza_timestamp();

DROP TRIGGER IF EXISTS trigger_atualiza_projetos ON projetos;
CREATE TRIGGER trigger_atualiza_projetos
BEFORE UPDATE ON projetos
FOR EACH ROW
EXECUTE FUNCTION atualiza_timestamp();

-- ============================================================================
-- DADOS INICIAIS
-- ============================================================================

-- Garantir que existe empresa default
INSERT INTO empresa (nome) VALUES ('Rijo Engenharia')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIM DA INICIALIZAÇÃO
-- ============================================================================

COMMIT;
