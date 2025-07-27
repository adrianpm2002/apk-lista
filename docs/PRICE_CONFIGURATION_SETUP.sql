-- Configuración de la tabla Precio
-- Ejecutar en Supabase SQL Editor

-- Verificar que la tabla existe con la estructura correcta
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Precio'
ORDER BY ordinal_position;

-- Crear índice si no existe para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_precio_banco ON Precio(id_banco);

-- Ejemplo de datos de prueba (opcional - solo para testing)
-- INSERT INTO Precio (id_banco, jugada, "activo?", precio, precio_limitado) VALUES
-- ('tu-user-id-aqui', 'fijo', true, 70, 65),
-- ('tu-user-id-aqui', 'corrido', true, 50, 45),
-- ('tu-user-id-aqui', 'posicion', true, 80, 75),
-- ('tu-user-id-aqui', 'parle', true, 800, 750),
-- ('tu-user-id-aqui', 'centena', true, 350, 320),
-- ('tu-user-id-aqui', 'tripleta', true, 4500, 4000);

-- Consulta para ver la configuración de un banco específico
-- SELECT * FROM Precio WHERE id_banco = 'tu-user-id-aqui';

-- Consulta para eliminar configuración de prueba (si es necesario)
-- DELETE FROM Precio WHERE id_banco = 'tu-user-id-aqui';
