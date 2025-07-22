-- ===================================================
-- SISTEMA DE LÍMITES DE NÚMEROS PARA CASA DE APUESTAS
-- ===================================================
-- Autor: Sistema APK-Lista
-- Fecha: 2025-01-22
-- Descripción: Tablas para gestionar límites globales y específicos por número

-- Tabla para límites globales por lotería, horario y tipo de jugada
CREATE TABLE IF NOT EXISTS number_limits (
    id SERIAL PRIMARY KEY,
    id_loteria INTEGER REFERENCES loteria(id) ON DELETE CASCADE,
    id_horario INTEGER REFERENCES horario(id) ON DELETE CASCADE,
    play_type VARCHAR(20) NOT NULL CHECK (play_type IN ('fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta')),
    global_limit DECIMAL(10,2) DEFAULT 0 CHECK (global_limit >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint único para evitar duplicados
    UNIQUE(id_loteria, id_horario, play_type)
);

-- Tabla para límites específicos por número individual
CREATE TABLE IF NOT EXISTS specific_number_limits (
    id SERIAL PRIMARY KEY,
    id_loteria INTEGER REFERENCES loteria(id) ON DELETE CASCADE,
    id_horario INTEGER REFERENCES horario(id) ON DELETE CASCADE,
    play_type VARCHAR(20) NOT NULL CHECK (play_type IN ('fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta')),
    number VARCHAR(3) NOT NULL CHECK (LENGTH(number) >= 1 AND LENGTH(number) <= 3),
    limit_amount DECIMAL(10,2) NOT NULL CHECK (limit_amount > 0),
    current_amount DECIMAL(10,2) DEFAULT 0 CHECK (current_amount >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint único para evitar duplicados por número
    UNIQUE(id_loteria, id_horario, play_type, number)
);

-- Tabla para histórico de apuestas por número (para tracking y auditoría)
CREATE TABLE IF NOT EXISTS number_bets_tracking (
    id SERIAL PRIMARY KEY,
    id_loteria INTEGER REFERENCES loteria(id) ON DELETE CASCADE,
    id_horario INTEGER REFERENCES horario(id) ON DELETE CASCADE,
    play_type VARCHAR(20) NOT NULL CHECK (play_type IN ('fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta')),
    number VARCHAR(3) NOT NULL CHECK (LENGTH(number) >= 1 AND LENGTH(number) <= 3),
    bet_amount DECIMAL(10,2) NOT NULL CHECK (bet_amount > 0),
    player_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ===================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- ===================================================

-- Índice para búsquedas rápidas de límites específicos
CREATE INDEX IF NOT EXISTS idx_specific_limits_lookup 
ON specific_number_limits(id_loteria, id_horario, play_type, number);

-- Índice para tracking de apuestas por número
CREATE INDEX IF NOT EXISTS idx_number_tracking 
ON number_bets_tracking(id_loteria, id_horario, play_type, number);

-- Índice para límites globales
CREATE INDEX IF NOT EXISTS idx_global_limits_lookup 
ON number_limits(id_loteria, id_horario, play_type);

-- Índice para consultas por fecha en el tracking
CREATE INDEX IF NOT EXISTS idx_tracking_by_date 
ON number_bets_tracking(created_at);

-- ===================================================
-- FUNCIONES AUXILIARES
-- ===================================================

-- Función para obtener el límite aplicable a un número
CREATE OR REPLACE FUNCTION get_applicable_limit(
    p_id_loteria INTEGER,
    p_id_horario INTEGER,
    p_play_type VARCHAR(20),
    p_number VARCHAR(3)
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    specific_limit DECIMAL(10,2);
    global_limit DECIMAL(10,2);
BEGIN
    -- Normalizar el número a 3 dígitos
    p_number := LPAD(p_number, 3, '0');
    
    -- Buscar límite específico
    SELECT limit_amount INTO specific_limit
    FROM specific_number_limits
    WHERE id_loteria = p_id_loteria
      AND id_horario = p_id_horario
      AND play_type = p_play_type
      AND number = p_number;
    
    -- Si existe límite específico, retornarlo
    IF specific_limit IS NOT NULL THEN
        RETURN specific_limit;
    END IF;
    
    -- Si no, buscar límite global
    SELECT global_limit INTO global_limit
    FROM number_limits
    WHERE id_loteria = p_id_loteria
      AND id_horario = p_id_horario
      AND play_type = p_play_type;
    
    -- Retornar límite global o 0 si no existe
    RETURN COALESCE(global_limit, 0);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener el monto actual apostado a un número
CREATE OR REPLACE FUNCTION get_current_bet_amount(
    p_id_loteria INTEGER,
    p_id_horario INTEGER,
    p_play_type VARCHAR(20),
    p_number VARCHAR(3)
) RETURNS DECIMAL(10,2) AS $$
DECLARE
    current_amount DECIMAL(10,2);
    tracked_amount DECIMAL(10,2);
BEGIN
    -- Normalizar el número a 3 dígitos
    p_number := LPAD(p_number, 3, '0');
    
    -- Buscar en límites específicos (se actualiza automáticamente)
    SELECT current_amount INTO current_amount
    FROM specific_number_limits
    WHERE id_loteria = p_id_loteria
      AND id_horario = p_id_horario
      AND play_type = p_play_type
      AND number = p_number;
    
    -- Si existe en específicos, retornarlo
    IF current_amount IS NOT NULL THEN
        RETURN current_amount;
    END IF;
    
    -- Si no, calcular desde el tracking
    SELECT COALESCE(SUM(bet_amount), 0) INTO tracked_amount
    FROM number_bets_tracking
    WHERE id_loteria = p_id_loteria
      AND id_horario = p_id_horario
      AND play_type = p_play_type
      AND number = p_number;
    
    RETURN tracked_amount;
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- TRIGGERS PARA MANTENER CONSISTENCIA
-- ===================================================

-- Función para trigger de actualización de timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at en number_limits
CREATE TRIGGER update_number_limits_updated_at
    BEFORE UPDATE ON number_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para actualizar updated_at en specific_number_limits
CREATE TRIGGER update_specific_limits_updated_at
    BEFORE UPDATE ON specific_number_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===================================================
-- DATOS DE EJEMPLO (OPCIONAL - PARA TESTING)
-- ===================================================

-- Ejemplo de límite global para Georgia-Mediodía-Fijo: $500 por número
-- INSERT INTO number_limits (id_loteria, id_horario, play_type, global_limit)
-- SELECT 1, 1, 'fijo', 500.00
-- WHERE EXISTS (SELECT 1 FROM loteria WHERE id = 1)
--   AND EXISTS (SELECT 1 FROM horario WHERE id = 1);

-- Ejemplo de límites específicos para números "calientes"
-- INSERT INTO specific_number_limits (id_loteria, id_horario, play_type, number, limit_amount)
-- SELECT 1, 1, 'fijo', '000', 100.00
-- WHERE EXISTS (SELECT 1 FROM loteria WHERE id = 1)
--   AND EXISTS (SELECT 1 FROM horario WHERE id = 1);

-- ===================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===================================================

COMMENT ON TABLE number_limits IS 'Límites globales por lotería, horario y tipo de jugada';
COMMENT ON TABLE specific_number_limits IS 'Límites específicos por número individual';
COMMENT ON TABLE number_bets_tracking IS 'Histórico de apuestas por número para auditoría';

COMMENT ON COLUMN number_limits.global_limit IS 'Límite global aplicable a todos los números sin límite específico';
COMMENT ON COLUMN specific_number_limits.number IS 'Número específico (se almacena con padding de ceros)';
COMMENT ON COLUMN specific_number_limits.limit_amount IS 'Límite máximo para este número específico';
COMMENT ON COLUMN specific_number_limits.current_amount IS 'Monto actual apostado a este número';

-- ===================================================
-- PERMISOS (AJUSTAR SEGÚN TUS ROLES)
-- ===================================================

-- Dar permisos a roles existentes (ajustar según tu configuración)
-- GRANT ALL ON number_limits TO admin_role;
-- GRANT ALL ON specific_number_limits TO admin_role;
-- GRANT ALL ON number_bets_tracking TO admin_role;

-- GRANT SELECT, INSERT, UPDATE ON number_limits TO listero_role;
-- GRANT SELECT, INSERT, UPDATE ON specific_number_limits TO listero_role;
-- GRANT SELECT, INSERT ON number_bets_tracking TO listero_role;
