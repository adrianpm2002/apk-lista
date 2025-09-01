-- Crear tabla limite_loteria si no existe
-- Ejecutar este script en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS limite_loteria (
  id SERIAL PRIMARY KEY,
  id_loteria UUID NOT NULL REFERENCES loteria(id) ON DELETE CASCADE,
  limites JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_limite_loteria_id_loteria ON limite_loteria(id_loteria);

-- Agregar trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_limite_loteria_updated_at 
    BEFORE UPDATE ON limite_loteria 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentación
COMMENT ON TABLE limite_loteria IS 'Tabla para almacenar límites de recogida por lotería y tipo de jugada';
COMMENT ON COLUMN limite_loteria.id_loteria IS 'ID de la lotería (FK a tabla loteria)';
COMMENT ON COLUMN limite_loteria.limites IS 'Límites por jugada en formato JSON: {"fijo": 1000, "corrido": 500, ...}';
COMMENT ON COLUMN limite_loteria.created_at IS 'Fecha de creación del registro';
COMMENT ON COLUMN limite_loteria.updated_at IS 'Fecha de última actualización del registro';

-- Ejemplo de estructura de datos para el campo limites:
-- {
--   "fijo": 1000,
--   "corrido": 500,
--   "posicion": 300,
--   "parle": 200,
--   "centena": 150,
--   "tripleta": 100
-- }
