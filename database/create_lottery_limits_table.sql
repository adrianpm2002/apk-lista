-- Script SQL para crear la tabla lottery_limits
-- Este script debe ejecutarse en Supabase SQL Editor

-- Crear tabla lottery_limits con esquema JSONB
CREATE TABLE IF NOT EXISTS lottery_limits (
    id BIGSERIAL PRIMARY KEY,
    id_banco BIGINT NOT NULL REFERENCES bancos(id) ON DELETE CASCADE,
    id_loteria BIGINT NOT NULL REFERENCES loterias(id) ON DELETE CASCADE,
    limits_config JSONB NOT NULL DEFAULT '{
        "general": {
            "maxBetAmount": 10000,
            "maxDailyAmount": 50000,
            "maxWeeklyAmount": 200000,
            "enabled": true
        },
        "playTypes": {
            "fijo": {
                "maxBetAmount": 5000,
                "maxDailyAmount": 25000,
                "enabled": true
            },
            "corrido": {
                "maxBetAmount": 3000,
                "maxDailyAmount": 15000,
                "enabled": true
            },
            "posicion": {
                "maxBetAmount": 2000,
                "maxDailyAmount": 10000,
                "enabled": true
            },
            "parle": {
                "maxBetAmount": 1000,
                "maxDailyAmount": 5000,
                "enabled": true
            },
            "centena": {
                "maxBetAmount": 500,
                "maxDailyAmount": 2500,
                "enabled": true
            },
            "tripleta": {
                "maxBetAmount": 100,
                "maxDailyAmount": 1000,
                "enabled": true
            }
        },
        "specialNumbers": {
            "restrictedNumbers": [],
            "numberLimits": {}
        },
        "timeRestrictions": {
            "cutoffTime": "18:00",
            "allowLatePlay": false,
            "latePlayFee": 0
        }
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_lottery_limits_banco ON lottery_limits(id_banco);
CREATE INDEX IF NOT EXISTS idx_lottery_limits_loteria ON lottery_limits(id_loteria);
CREATE INDEX IF NOT EXISTS idx_lottery_limits_banco_loteria ON lottery_limits(id_banco, id_loteria);

-- Crear índices GIN para consultas JSONB
CREATE INDEX IF NOT EXISTS idx_lottery_limits_config ON lottery_limits USING GIN (limits_config);

-- Crear constraint único para evitar duplicados
ALTER TABLE lottery_limits 
ADD CONSTRAINT unique_bank_lottery_limits 
UNIQUE (id_banco, id_loteria);

-- Crear trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_lottery_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lottery_limits_update_updated_at
    BEFORE UPDATE ON lottery_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_lottery_limits_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE lottery_limits ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS básicas (ajustar según necesidades específicas)
CREATE POLICY "Users can view lottery limits for their bank" ON lottery_limits
    FOR SELECT USING (
        id_banco IN (
            SELECT id_banco FROM usuarios WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admins can manage lottery limits for their bank" ON lottery_limits
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE id = auth.uid() 
            AND rol = 'admin' 
            AND id_banco = lottery_limits.id_banco
        )
    );

-- Comentarios para documentación
COMMENT ON TABLE lottery_limits IS 'Configuración de límites por lotería usando esquema JSONB flexible';
COMMENT ON COLUMN lottery_limits.limits_config IS 'Configuración JSONB que incluye límites generales, por tipo de jugada, números especiales y restricciones de tiempo';
COMMENT ON COLUMN lottery_limits.id_banco IS 'Referencia al banco propietario de esta configuración';
COMMENT ON COLUMN lottery_limits.id_loteria IS 'Referencia a la lotería específica para estos límites';

-- Consulta de ejemplo para verificar la estructura
-- SELECT id, id_banco, id_loteria, limits_config FROM lottery_limits LIMIT 5;
