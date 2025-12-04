# 🧪 FASE 10: CAMBIO DE DÍA - GUÍA DE PRUEBAS

## ✅ Resumen de Implementación

### Archivos Creados/Modificados
- ✅ `src/services/dayChangeService.js` - Servicio completo de cambio de día
- ✅ `App.js` - Integrado AppState listener y verificación automática

### Funcionalidades Implementadas
1. **Detección de cambio de día**: Compara fecha actual con última verificación
2. **Limpieza automática TOTAL**: Elimina TODAS las jugadas del día anterior (pending, success, failed)
3. **Regla de negocio**: Al cambiar el día, la base de datos se limpia completamente
4. **Verificación al inicio**: Se ejecuta al abrir la app
5. **Verificación en foreground**: Se ejecuta cuando la app vuelve desde background

## 📋 PRUEBAS OBLIGATORIAS

### **Prueba 10.1: Primera Inicialización**

**Objetivo**: Verificar que el servicio se inicialice correctamente

**Pasos**:
1. Desinstalar app completamente (para borrar AsyncStorage)
2. Instalar y abrir app
3. Revisar logs

**Resultado Esperado**:
```
[App] 🔄 Initializing day change service...
[DayChangeService] Primera inicialización, estableciendo fecha actual
[DayChangeService] 📅 Fecha actualizada: 2025-12-04
[DayChangeService] 🔍 Verificando cambio de día...
[DayChangeService] Verificando cambio de día: { today: '2025-12-04', lastCheckDate: null }
[DayChangeService] ✅ Detectado cambio de día
[DayChangeService] 🗓️ Nuevo día detectado, ejecutando limpieza...
```

---

### **Prueba 10.2: Mismo Día - Sin Limpieza**

**Objetivo**: Verificar que NO se limpie si es el mismo día

**Pasos**:
1. Abrir app (hoy)
2. Cerrar app (minimizar)
3. Volver a abrir app (mismo día)
4. Revisar logs

**Resultado Esperado**:
```
[App] 📱 App volvió al foreground, verificando cambio de día...
[DayChangeService] 🔍 Verificando cambio de día...
[DayChangeService] Estado: { isOnline: ..., bannerType: ..., pendingCount: ... }
[DayChangeService] Mismo día, sin acciones necesarias
```

**Verificar**: NO debe ejecutar limpieza de jugadas

---

### **Prueba 10.3: Crear Jugadas y Sincronizar**

**Objetivo**: Preparar jugadas exitosas para prueba de limpieza

**Pasos**:
1. Desconectar WiFi
2. Crear 3 jugadas offline
3. Reconectar WiFi
4. Sincronizar todas las jugadas exitosamente
5. Verificar en OfflinePlayRegistryScreen que las 3 están con status `success`

**Resultado Esperado**:
- ✅ 3 jugadas con estado "Enviada ✓"
- ✅ Color verde en las tarjetas
- ✅ No aparecen botones "Enviar ahora" ni "Reintentar"

---

### **Prueba 10.4: Simular Cambio de Día (Método Manual)**

**Objetivo**: Forzar limpieza cambiando la fecha almacenada

**Pasos**:
1. Tener 3 jugadas con status `success` del día actual (de Prueba 10.3)
2. Usar React Native Debugger o Flipper para modificar AsyncStorage:
   - Clave: `@offline_last_check_date`
   - Cambiar valor de `2025-12-04` a `2025-12-03` (día anterior)
3. Cerrar y volver a abrir app
4. Revisar logs

**Resultado Esperado**:
```
[DayChangeService] 🔍 Verificando cambio de día...
[DayChangeService] Verificando cambio de día: { today: '2025-12-04', lastCheckDate: '2025-12-03' }
[DayChangeService] ✅ Detectado cambio de día
[DayChangeService] 🗓️ Nuevo día detectado, ejecutando limpieza TOTAL...
[DayChangeService] 🧹 Iniciando limpieza de TODAS las jugadas del día anterior...
[DayChangeService] Total de jugadas antes de limpieza: 3
[DayChangeService] ✅ Jugadas eliminadas: 3
[DayChangeService] ✅ Limpieza completada. Eliminadas: 3 jugadas de 3 totales
[DayChangeService] Jugadas restantes (del día actual): 0
[DayChangeService] 📅 Fecha actualizada: 2025-12-04
```

**Verificar en OfflinePlayRegistryScreen**:
- ✅ TODAS las jugadas desaparecieron (sin importar el estado)
- ✅ Lista vacía o mensaje "No hay jugadas offline registradas"

---
### **Prueba 10.5: Eliminar TODAS las Jugadas (Regla de Negocio)**

**Objetivo**: Verificar que se eliminan TODAS las jugadas sin importar el estado

**Pre-requisito**: Tener jugadas con diferentes estados

**Pasos**:
1. Crear 2 jugadas offline (dejarlas en `pending`, no sincronizar)
2. Crear 1 jugada que falle (por límite cerrado) → `failed`
3. Crear 2 jugadas y sincronizarlas exitosamente → `success`
4. **Total**: 5 jugadas (2 pending + 1 failed + 2 success)
5. Simular cambio de día (modificar AsyncStorage como en Prueba 10.4)
6. Reabrir app
7. Ir a OfflinePlayRegistryScreen

**Resultado Esperado**:
```
[DayChangeService] Total de jugadas antes de limpieza: 5
[DayChangeService] ✅ Jugadas eliminadas: 5
[DayChangeService] Jugadas restantes (del día actual): 0
```

**Verificar en pantalla**:
- ✅ TODAS las jugadas eliminadas (pending, failed, success)
- ✅ Lista vacía: "No hay jugadas offline registradas"
- ✅ Base de datos limpia para el nuevo día
- ✅ Total visible: 3 jugadas (2 pending + 1 failed)

---

### **Prueba 10.6: Cambio de Día Real (Esperar Medianoche)**

**Objetivo**: Probar el comportamiento real sin simulación

**Pasos**:
1. Antes de medianoche:
   - Crear y sincronizar 2 jugadas (status `success`)
   - Dejar app abierta o en background
2. Esperar a que pase la medianoche (00:00:01)
3. Volver a la app o abrirla nuevamente
4. Revisar logs

**Resultado Esperado**:
```
[App] 📱 App volvió al foreground, verificando cambio de día...
[DayChangeService] Verificando cambio de día: { today: '2025-12-05', lastCheckDate: '2025-12-04' }
[DayChangeService] ✅ Detectado cambio de día
[DayChangeService] 🧹 Iniciando limpieza...
[DayChangeService] ✅ Jugadas eliminadas: 2
```

**Nota**: Esta prueba solo se puede hacer esperando realmente la medianoche

---

### **Prueba 10.7: App en Background por Varios Días**

**Objetivo**: Verificar limpieza después de dejar la app cerrada por días

**Pasos**:
1. Tener jugadas exitosas del día actual
2. Cerrar la app completamente (no solo minimizar)
3. Cambiar manualmente la fecha del dispositivo a 3 días después
4. Abrir la app
5. Revisar logs

**Resultado Esperado**:
```
[DayChangeService] Verificando cambio de día: { today: '2025-12-07', lastCheckDate: '2025-12-04' }
[DayChangeService] ✅ Detectado cambio de día
[DayChangeService] ✅ Jugadas eliminadas: X
```

**Verificar**: Todas las jugadas exitosas previas eliminadas

**⚠️ IMPORTANTE**: Restaurar fecha del dispositivo después de la prueba

---

### **Prueba 10.8: Sin Conexión - Limpieza Funciona**

**Objetivo**: Verificar que la limpieza no depende de conexión

**Pasos**:
1. Crear 2 jugadas offline
2. Conectar y sincronizar (status `success`)
3. Desconectar WiFi
4. Simular cambio de día (AsyncStorage)
5. Reabrir app sin conexión

**Resultado Esperado**:
```
[DayChangeService] ✅ Detectado cambio de día
[DayChangeService] ✅ Jugadas eliminadas: 2
```

**Verificar**: Limpieza funciona sin conexión (solo depende de SQLite local)

---

## 🐛 Problemas Conocidos y Soluciones

### Problema 1: Limpieza no se ejecuta
**Síntomas**: Jugadas exitosas no desaparecen después de cambio de día
**Causas posibles**:
- AsyncStorage no actualizado
- Base de datos no inicializada
**Solución**: Verificar logs de inicialización de SQLite

### Problema 2: No se eliminan todas las jugadas
**Síntomas**: Algunas jugadas del día anterior quedan en la base de datos
**Causas posibles**:
- Query SQL con filtro incorrecto de status
- Fecha no comparada correctamente
**Solución**: Verificar que query sea `DELETE FROM offline_plays WHERE DATE(created_at) < DATE(?)`

### Problema 3: No detecta cambio de día
**Síntomas**: Logs muestran "Mismo día" aunque pasó un día
**Causas posibles**:
- AsyncStorage no se actualizó
- Timezone del dispositivo incorrecta
**Solución**: Verificar `new Date().toISOString().split('T')[0]` devuelve fecha correcta

---

## ✅ Checklist Final

Antes de marcar FASE 10 como completa, verificar:

- [ ] Prueba 10.1 ✅ (Primera inicialización)
- [ ] Prueba 10.2 ✅ (Mismo día - sin limpieza)
- [ ] Prueba 10.3 ✅ (Crear jugadas exitosas)
- [ ] Prueba 10.4 ✅ (Simular cambio de día)
- [ ] Prueba 10.5 ✅ (Preservar pending/failed)
- [ ] Prueba 10.6 ⏭️ (Cambio real - opcional, esperar medianoche)
- [ ] Prueba 10.7 ✅ (App cerrada varios días)
- [ ] Prueba 10.8 ✅ (Sin conexión)

---

## 📊 Comportamiento Esperado del Sistema

### Cuando se abre la app:
1. Verifica si cambió el día
2. Si cambió: elimina jugadas `success` antiguas
3. Si no cambió: no hace nada

### Cuando vuelve del background:
1. Detecta cambio de AppState
2. Ejecuta misma lógica que al abrir
### Jugadas que se eliminan:
- ✅ **TODAS** las jugadas con `created_at < fecha_actual` (del día anterior o más antiguas)
- ✅ Sin importar el estado: `pending`, `success`, `failed`

### Jugadas que se preservan:
- ✅ **Solo** las jugadas del día actual (`created_at >= fecha_actual`)
- ✅ Permite empezar cada día con base de datos limpiaronización)
- ✅ Cualquier jugada del día actual

---

## 🎯 Estado Actual

**FASE 10**: ✅ IMPLEMENTADA - Pendiente de pruebas

**Archivos Modificados**:
- ✅ `src/services/dayChangeService.js` - Servicio completo (nuevo)
- ✅ `App.js` - AppState listener integrado

**Siguiente Fase**: FASE 11 - Sidebar (Modo Offline)

---

## 📝 Notas Técnicas

### AsyncStorage Key
```javascript
const LAST_CHECK_DATE_KEY = '@offline_last_check_date';
// Formato: 'YYYY-MM-DD' (ejemplo: '2025-12-04')
```

### Query SQL de Limpieza
```sql
DELETE FROM offline_plays 
WHERE DATE(created_at) < DATE(?)
-- Parámetro: fecha_actual en formato 'YYYY-MM-DD'
-- Elimina TODAS las jugadas del día anterior (sin filtro de status)
```

### Trigger de Verificación
- Al iniciar app: `useEffect` en App.js
- Al volver de background: `AppState.addEventListener('change')`
- Estado anterior: `inactive` o `background`
- Estado nuevo: `active`

