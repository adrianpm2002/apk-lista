-- ===================================================
-- SISTEMA DE ESTADÍSTICAS PARA EL BANCO DE APUESTAS
-- ===================================================
-- Autor: Sistema APK-Lista
-- Fecha: 2025-01-22
-- Descripción: Tablas y vistas para estadísticas completas del banco

-- Tabla para estadísticas consolidadas por día
CREATE TABLE IF NOT EXISTS bank_statistics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    id_loteria INTEGER REFERENCES loteria(id) ON DELETE CASCADE,
    id_horario INTEGER REFERENCES horario(id) ON DELETE CASCADE,
    total_bets DECIMAL(12,2) DEFAULT 0 CHECK (total_bets >= 0),
    total_prizes DECIMAL(12,2) DEFAULT 0 CHECK (total_prizes >= 0),
    listero_commissions DECIMAL(12,2) DEFAULT 0 CHECK (listero_commissions >= 0),
    collector_commissions DECIMAL(12,2) DEFAULT 0 CHECK (collector_commissions >= 0),
    net_profit DECIMAL(12,2) DEFAULT 0,
    bet_count INTEGER DEFAULT 0 CHECK (bet_count >= 0),
    winner_count INTEGER DEFAULT 0 CHECK (winner_count >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint único para evitar duplicados por fecha/lotería/horario
    UNIQUE(date, id_loteria, id_horario)
);

-- Tabla para comisiones detalladas
CREATE TABLE IF NOT EXISTS commissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('listero', 'colector')),
    commission_percentage DECIMAL(5,2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    base_amount DECIMAL(10,2) NOT NULL CHECK (base_amount >= 0),
    date DATE NOT NULL,
    id_loteria INTEGER REFERENCES loteria(id),
    id_horario INTEGER REFERENCES horario(id),
    play_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para tracking detallado de jugadas (amplía el sistema existente)
CREATE TABLE IF NOT EXISTS detailed_plays (
    id SERIAL PRIMARY KEY,
    play_id INTEGER, -- Referencia al sistema de storage local si existe
    id_loteria INTEGER REFERENCES loteria(id),
    id_horario INTEGER REFERENCES horario(id),
    play_type VARCHAR(20) NOT NULL,
    numbers TEXT NOT NULL,
    bet_amount DECIMAL(10,2) NOT NULL CHECK (bet_amount > 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount > 0),
    player_name VARCHAR(100),
    listero_id UUID REFERENCES profiles(id),
    listero_name VARCHAR(100),
    colector_id UUID REFERENCES profiles(id),
    colector_name VARCHAR(100),
    is_winner BOOLEAN DEFAULT FALSE,
    prize_amount DECIMAL(10,2) DEFAULT 0,
    result_numbers VARCHAR(20),
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla para configuración de comisiones
CREATE TABLE IF NOT EXISTS commission_config (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('listero', 'colector')),
    id_loteria INTEGER REFERENCES loteria(id),
    play_type VARCHAR(20),
    commission_percentage DECIMAL(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint único por usuario/lotería/tipo
    UNIQUE(user_id, id_loteria, play_type)
);

-- ===================================================
-- VISTAS PARA CONSULTAS OPTIMIZADAS
-- ===================================================

-- Vista de estadísticas diarias consolidadas
CREATE OR REPLACE VIEW daily_bank_stats AS
SELECT 
    date,
    SUM(total_bets) as daily_total_bets,
    SUM(total_prizes) as daily_total_prizes,
    SUM(listero_commissions) as daily_listero_commissions,
    SUM(collector_commissions) as daily_collector_commissions,
    SUM(net_profit) as daily_net_profit,
    SUM(bet_count) as daily_bet_count,
    SUM(winner_count) as daily_winner_count,
    CASE 
        WHEN SUM(total_bets) > 0 
        THEN ROUND((SUM(net_profit) / SUM(total_bets)) * 100, 2)
        ELSE 0 
    END as profit_margin_percentage
FROM bank_statistics
GROUP BY date
ORDER BY date DESC;

-- Vista de estadísticas por lotería
CREATE OR REPLACE VIEW lottery_stats AS
SELECT 
    l.nombre as lottery_name,
    bs.id_loteria,
    SUM(bs.total_bets) as total_bets,
    SUM(bs.total_prizes) as total_prizes,
    SUM(bs.net_profit) as net_profit,
    SUM(bs.bet_count) as bet_count,
    COUNT(*) as days_active,
    CASE 
        WHEN SUM(bs.total_bets) > 0 
        THEN ROUND((SUM(bs.net_profit) / SUM(bs.total_bets)) * 100, 2)
        ELSE 0 
    END as profit_margin
FROM bank_statistics bs
JOIN loteria l ON bs.id_loteria = l.id
GROUP BY bs.id_loteria, l.nombre
ORDER BY total_bets DESC;

-- Vista de estadísticas por horario
CREATE OR REPLACE VIEW schedule_stats AS
SELECT 
    h.nombre as schedule_name,
    bs.id_horario,
    SUM(bs.total_bets) as total_bets,
    SUM(bs.total_prizes) as total_prizes,
    SUM(bs.net_profit) as net_profit,
    SUM(bs.bet_count) as bet_count,
    CASE 
        WHEN SUM(bs.total_bets) > 0 
        THEN ROUND((SUM(bs.net_profit) / SUM(bs.total_bets)) * 100, 2)
        ELSE 0 
    END as profit_margin
FROM bank_statistics bs
JOIN horario h ON bs.id_horario = h.id
GROUP BY bs.id_horario, h.nombre
ORDER BY total_bets DESC;

-- Vista de rendimiento de listeros
CREATE OR REPLACE VIEW listero_performance AS
SELECT 
    dp.listero_id,
    dp.listero_name,
    COUNT(*) as total_plays,
    SUM(dp.total_amount) as total_volume,
    SUM(CASE WHEN dp.is_winner THEN 1 ELSE 0 END) as winning_plays,
    SUM(dp.prize_amount) as total_prizes_generated,
    SUM(c.amount) as total_commissions_earned,
    CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((SUM(CASE WHEN dp.is_winner THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2)
        ELSE 0 
    END as win_rate_percentage
FROM detailed_plays dp
LEFT JOIN commissions c ON dp.listero_id = c.user_id AND dp.date = c.date
WHERE dp.listero_id IS NOT NULL
GROUP BY dp.listero_id, dp.listero_name
ORDER BY total_volume DESC;

-- Vista de números más jugados
CREATE OR REPLACE VIEW popular_numbers AS
SELECT 
    numbers,
    COUNT(*) as times_played,
    SUM(bet_amount) as total_bet_amount,
    SUM(CASE WHEN is_winner THEN 1 ELSE 0 END) as times_won,
    SUM(prize_amount) as total_prizes,
    CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((SUM(CASE WHEN is_winner THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) * 100, 2)
        ELSE 0 
    END as win_percentage
FROM detailed_plays
GROUP BY numbers
ORDER BY total_bet_amount DESC
LIMIT 50;

-- ===================================================
-- FUNCIONES AUXILIARES
-- ===================================================

-- Función para calcular estadísticas de un período
CREATE OR REPLACE FUNCTION calculate_period_stats(
    start_date DATE,
    end_date DATE,
    lottery_id INTEGER DEFAULT NULL,
    schedule_id INTEGER DEFAULT NULL
) RETURNS TABLE (
    total_bets DECIMAL(12,2),
    total_prizes DECIMAL(12,2),
    total_commissions DECIMAL(12,2),
    net_profit DECIMAL(12,2),
    bet_count INTEGER,
    profit_margin DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(bs.total_bets), 0) as total_bets,
        COALESCE(SUM(bs.total_prizes), 0) as total_prizes,
        COALESCE(SUM(bs.listero_commissions + bs.collector_commissions), 0) as total_commissions,
        COALESCE(SUM(bs.net_profit), 0) as net_profit,
        COALESCE(SUM(bs.bet_count), 0)::INTEGER as bet_count,
        CASE 
            WHEN SUM(bs.total_bets) > 0 
            THEN ROUND((SUM(bs.net_profit) / SUM(bs.total_bets)) * 100, 2)
            ELSE 0 
        END as profit_margin
    FROM bank_statistics bs
    WHERE bs.date BETWEEN start_date AND end_date
        AND (lottery_id IS NULL OR bs.id_loteria = lottery_id)
        AND (schedule_id IS NULL OR bs.id_horario = schedule_id);
END;
$$ LANGUAGE plpgsql;

-- Función para obtener tendencia de días
CREATE OR REPLACE FUNCTION get_daily_trend(
    days INTEGER DEFAULT 30,
    lottery_id INTEGER DEFAULT NULL
) RETURNS TABLE (
    date DATE,
    total_bets DECIMAL(12,2),
    net_profit DECIMAL(12,2),
    profit_margin DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bs.date,
        SUM(bs.total_bets) as total_bets,
        SUM(bs.net_profit) as net_profit,
        CASE 
            WHEN SUM(bs.total_bets) > 0 
            THEN ROUND((SUM(bs.net_profit) / SUM(bs.total_bets)) * 100, 2)
            ELSE 0 
        END as profit_margin
    FROM bank_statistics bs
    WHERE bs.date >= CURRENT_DATE - INTERVAL '%s days' 
        AND (lottery_id IS NULL OR bs.id_loteria = lottery_id)
    GROUP BY bs.date
    ORDER BY bs.date;
END;
$$ LANGUAGE plpgsql;

-- ===================================================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ===================================================

-- Índices para bank_statistics
CREATE INDEX IF NOT EXISTS idx_bank_stats_date ON bank_statistics(date);
CREATE INDEX IF NOT EXISTS idx_bank_stats_lottery ON bank_statistics(id_loteria);
CREATE INDEX IF NOT EXISTS idx_bank_stats_schedule ON bank_statistics(id_horario);
CREATE INDEX IF NOT EXISTS idx_bank_stats_date_lottery ON bank_statistics(date, id_loteria);

-- Índices para commissions
CREATE INDEX IF NOT EXISTS idx_commissions_user ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_date ON commissions(date);
CREATE INDEX IF NOT EXISTS idx_commissions_type ON commissions(commission_type);

-- Índices para detailed_plays
CREATE INDEX IF NOT EXISTS idx_detailed_plays_date ON detailed_plays(date);
CREATE INDEX IF NOT EXISTS idx_detailed_plays_listero ON detailed_plays(listero_id);
CREATE INDEX IF NOT EXISTS idx_detailed_plays_lottery ON detailed_plays(id_loteria);
CREATE INDEX IF NOT EXISTS idx_detailed_plays_numbers ON detailed_plays(numbers);

-- ===================================================
-- TRIGGERS PARA MANTENER CONSISTENCIA
-- ===================================================

-- Función para trigger de actualización de timestamp
CREATE OR REPLACE FUNCTION update_statistics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para bank_statistics
CREATE TRIGGER update_bank_statistics_timestamp
    BEFORE UPDATE ON bank_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_statistics_timestamp();

-- Trigger para commission_config
CREATE TRIGGER update_commission_config_timestamp
    BEFORE UPDATE ON commission_config
    FOR EACH ROW
    EXECUTE FUNCTION update_statistics_timestamp();

-- ===================================================
-- DATOS DE EJEMPLO (OPCIONAL - PARA TESTING)
-- ===================================================

-- Insertar datos de ejemplo para testing (comentado)
/*
INSERT INTO bank_statistics (date, id_loteria, id_horario, total_bets, total_prizes, listero_commissions, collector_commissions, net_profit, bet_count, winner_count)
VALUES 
    (CURRENT_DATE, 1, 1, 5000.00, 2000.00, 250.00, 100.00, 2650.00, 150, 8),
    (CURRENT_DATE - 1, 1, 1, 4500.00, 1800.00, 225.00, 90.00, 2385.00, 135, 6),
    (CURRENT_DATE - 2, 1, 1, 6000.00, 2500.00, 300.00, 120.00, 3080.00, 180, 10);
*/

-- ===================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===================================================

COMMENT ON TABLE bank_statistics IS 'Estadísticas consolidadas diarias del banco por lotería y horario';
COMMENT ON TABLE commissions IS 'Registro detallado de comisiones pagadas a listeros y colectores';
COMMENT ON TABLE detailed_plays IS 'Tracking detallado de todas las jugadas con información de ganadores';
COMMENT ON TABLE commission_config IS 'Configuración de porcentajes de comisión por usuario y tipo de jugada';

COMMENT ON VIEW daily_bank_stats IS 'Vista consolidada de estadísticas diarias totales';
COMMENT ON VIEW lottery_stats IS 'Vista de rendimiento por lotería';
COMMENT ON VIEW schedule_stats IS 'Vista de rendimiento por horario';
COMMENT ON VIEW listero_performance IS 'Vista de rendimiento de listeros';
COMMENT ON VIEW popular_numbers IS 'Vista de números más jugados y sus estadísticas';

-- ===================================================
-- PERMISOS (AJUSTAR SEGÚN TUS ROLES)
-- ===================================================

-- Dar permisos completos a administradores
-- GRANT ALL ON bank_statistics, commissions, detailed_plays, commission_config TO admin_role;
-- GRANT SELECT ON daily_bank_stats, lottery_stats, schedule_stats, listero_performance, popular_numbers TO admin_role;

-- Permisos limitados para otros roles
-- GRANT SELECT ON bank_statistics, commissions TO colector_role;
-- GRANT SELECT ON listero_performance TO listero_role WHERE listero_id = current_user_id;
