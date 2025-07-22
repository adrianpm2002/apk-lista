# 📊 Guía de Implementación de Estadísticas Reales

## 🎯 Estado Actual
- ✅ Sistema de estadísticas completamente funcional con datos **MOCK**
- ✅ Interfaz visual completa y responsive
- ✅ Gráficos, KPIs, y tablas funcionando perfectamente
- ⚠️ Preparado para transición a datos reales cuando esté listo

## 🔄 Configuración Actual

El sistema está configurado en **modo MOCK** mediante la variable:
```javascript
const USE_MOCK_DATA = true; // Línea 19 en useStatistics.js
```

## 📋 Pasos para Implementar Datos Reales

### 1. 🗄️ Crear Tablas en Supabase

#### Tabla: `jugadas`
```sql
CREATE TABLE jugadas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    loteria_id UUID REFERENCES loteria(id),
    horario_id UUID REFERENCES horario(id),
    listero_id UUID REFERENCES profiles(id),
    numeros_apostados JSONB,
    monto_apostado DECIMAL(10,2),
    comision_listero DECIMAL(10,2),
    estado VARCHAR(20) DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente', 'ganada', 'perdida'))
);
```

#### Tabla: `resultados`
```sql
CREATE TABLE resultados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    jugada_id UUID REFERENCES jugadas(id),
    fecha_sorteo TIMESTAMP WITH TIME ZONE,
    numeros_ganadores JSONB,
    premio_ganado DECIMAL(10,2) DEFAULT 0,
    es_ganadora BOOLEAN DEFAULT FALSE
);
```

#### Tabla: `comisiones` (opcional)
```sql
CREATE TABLE comisiones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listero_id UUID REFERENCES profiles(id),
    fecha DATE,
    total_comisiones DECIMAL(10,2),
    total_ventas DECIMAL(10,2),
    porcentaje_comision DECIMAL(5,2)
);
```

### 2. 🔧 Configurar Políticas RLS (Row Level Security)

```sql
-- Política para jugadas
ALTER TABLE jugadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden ver sus propias jugadas" ON jugadas
    FOR SELECT USING (auth.uid() = listero_id);

-- Política para resultados
ALTER TABLE resultados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Los usuarios pueden ver resultados de sus jugadas" ON resultados
    FOR SELECT USING (
        jugada_id IN (
            SELECT id FROM jugadas WHERE listero_id = auth.uid()
        )
    );
```

### 3. ⚙️ Activar Datos Reales

1. **Cambiar configuración:**
   ```javascript
   const USE_MOCK_DATA = false; // Cambiar a false en línea 19
   ```

2. **Descomentar consultas SQL:**
   - Buscar comentarios `🔮 CONSULTA SQL` en el archivo
   - Descomentar las consultas dentro de los bloques comentados
   - Comentar las líneas de fallback temporal

### 4. 🧪 Probar la Implementación

1. **Verificar conexión:**
   ```javascript
   // El hook automáticamente verificará si las tablas existen
   await checkRealDataAvailability();
   ```

2. **Datos de prueba:**
   ```sql
   -- Insertar datos de prueba
   INSERT INTO jugadas (loteria_id, horario_id, listero_id, numeros_apostados, monto_apostado, comision_listero)
   VALUES (
       (SELECT id FROM loteria LIMIT 1),
       (SELECT id FROM horario LIMIT 1),
       (SELECT id FROM profiles LIMIT 1),
       '{"numeros": ["12", "34", "56"]}',
       100.00,
       10.00
   );
   ```

## 📊 Estructura de Datos

### KPIs Calculados
- **Apuestas Diarias:** Suma de `monto_apostado` del día actual
- **Comisiones:** Suma de `comision_listero` del día actual
- **Premios:** Suma de `premio_ganado` del día actual
- **Ganancia Neta:** `Total Apuestas - Total Premios - Total Comisiones`
- **Cantidad de Jugadas:** Conteo de registros del día

### Tendencias (7 días)
- Agrupación por fecha de los últimos 7 días
- Cálculos diarios de métricas principales
- Datos para gráficos de líneas

### Estadísticas por Lotería
- Agrupación por `loteria_id`
- Totales de apuestas, premios, y jugadas por lotería
- Datos para gráficos de barras

### Estadísticas por Horario
- Agrupación por `horario_id`
- Totales de apuestas, comisiones, y ganancias por horario
- Datos para gráficos circulares

## 🔍 Funciones Preparadas

### Carga de Datos
- `loadRealDailyStats()` - Estadísticas del día actual
- `loadRealTrendData()` - Tendencias de período
- `loadRealLotteryStats()` - Estadísticas por lotería
- `loadRealScheduleStats()` - Estadísticas por horario

### Filtros
- Por fecha (rango personalizable)
- Por lotería específica
- Por horario específico
- Combinación de filtros

### Exportación
- Formato CSV con datos reales
- Incluye metadatos de filtros aplicados
- Fecha y hora de exportación

## 🚨 Consideraciones Importantes

### Rendimiento
- Las consultas están optimizadas para datasets grandes
- Se recomienda crear índices en:
  ```sql
  CREATE INDEX idx_jugadas_fecha ON jugadas(fecha_creacion);
  CREATE INDEX idx_jugadas_loteria ON jugadas(loteria_id);
  CREATE INDEX idx_jugadas_horario ON jugadas(horario_id);
  CREATE INDEX idx_jugadas_listero ON jugadas(listero_id);
  ```

### Seguridad
- RLS configurado para que cada listero vea solo sus datos
- Validación de datos en el frontend y backend
- Auditoría de cambios en tablas críticas

### Fallback
- Si hay errores con datos reales, automáticamente usa datos mock
- Logs detallados para debugging
- Sistema robusto ante fallas de conexión

## 🎉 Resultado Final

Una vez implementado, tendrás:
- ✅ Dashboard en tiempo real con datos reales
- ✅ Gráficos actualizados automáticamente
- ✅ Filtros funcionales con datos de la base
- ✅ Exportación de reportes reales
- ✅ Sistema híbrido robusto (mock/real)

## 📞 Soporte

El sistema está diseñado para ser:
- **Mantenible:** Código bien documentado y estructurado
- **Escalable:** Preparado para grandes volúmenes de datos
- **Flexible:** Fácil adición de nuevas métricas
- **Robusto:** Manejo de errores y fallbacks automáticos

¡Cuando estés listo para implementar datos reales, simplemente sigue esta guía paso a paso! 🚀
