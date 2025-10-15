# 📋 Guía de Pruebas - Optimización de Caché AsyncStorage

## ✅ Implementación Completada

### 🎯 Objetivo
Optimizar la carga de estadísticas para rol **LISTERO** usando AsyncStorage con:
- ⚡ Carga instantánea desde caché (< 100ms)
- 🔄 Actualización en background sin bloquear UI
- 🎯 Filtros locales para Hoy/Ayer (sin consultar Supabase)
- 💾 Caché por usuario y período (recent, thisMonth, lastMonth)

---

## 📦 Archivos Modificados/Creados

### 1. **`src/utils/statisticsCache.js`** (NUEVO)
Módulo de caché con funciones:
- `saveToCache(userId, period, data)` - Guardar datos
- `readFromCache(userId, period)` - Leer datos
- `hasCacheFor(userId, period)` - Verificar existencia
- `filterByDateRange(data, startDate, endDate)` - Filtrado local
- `getTodayRange()` / `getYesterdayRange()` - Rangos de fechas
- `clearCache()` / `clearAllCache()` - Limpieza
- `getCacheStats(userId)` - Estadísticas de caché

### 2. **`src/hooks/useListeroStatistics.js`** (MODIFICADO)
Integración de caché:
- ✅ Carga instantánea desde caché
- ✅ Actualización background automática
- ✅ Filtros locales para Hoy/Ayer
- ✅ Estado `isRefreshing` para feedback UI
- ✅ Logs detallados para debugging

### 3. **`src/hooks/useStatistics.js`** (MODIFICADO)
- ✅ Expone `isRefreshing` para UI

---

## 🧪 Plan de Pruebas

### 📍 **Prueba 1: Primera Carga (Sin Caché)**
**Objetivo:** Verificar que se carga desde Supabase y se guarda en caché

**Pasos:**
1. Limpiar caché de la app (Settings → Storage → Clear)
2. Iniciar sesión como **LISTERO**
3. Ir a pantalla de **Estadísticas**
4. Seleccionar filtro **"Últimos 7 días"**

**Logs esperados:**
```
[useListeroStatistics] 🔍 Cargando datos para período: recent
[useListeroStatistics] 📥 No hay caché, cargando desde Supabase...
[StatisticsCache] ✅ Guardado en caché: recent (XXX registros)
[useListeroStatistics] ✅ Mostrando XXX registros en UI
```

**Resultado esperado:** ✅
- Carga tarda 2-5 segundos (primera vez)
- Datos se muestran correctamente
- Sin errores en consola

---

### 📍 **Prueba 2: Carga desde Caché (Instantánea)**
**Objetivo:** Verificar carga instantánea desde caché

**Pasos:**
1. Desde la Prueba 1, cerrar y reabrir la app
2. Iniciar sesión como **LISTERO**
3. Ir a pantalla de **Estadísticas**
4. Seleccionar filtro **"Últimos 7 días"**

**Logs esperados:**
```
[useListeroStatistics] 🔍 Cargando datos para período: recent
[StatisticsCache] ✅ Caché leído: recent (XXX registros, YY min antiguos)
[useListeroStatistics] ⚡ Caché encontrado (YY min): XXX registros
[useListeroStatistics] ✅ Mostrando XXX registros en UI
[useListeroStatistics] 🔄 Iniciando actualización en background...
```

**Resultado esperado:** ✅
- Carga **INSTANTÁNEA** (< 100ms)
- Datos se muestran inmediatamente
- Actualización en background (sin bloquear UI)
- Indicador de "refreshing" sutil (si está implementado en UI)

---

### 📍 **Prueba 3: Filtro Local "Hoy"**
**Objetivo:** Verificar filtro local desde caché de 7 días

**Pasos:**
1. Con caché de 7 días disponible (Prueba 2)
2. Cambiar filtro a **"Hoy"**

**Logs esperados:**
```
[useListeroStatistics] 🎯 Filtro local detectado: HOY
[useListeroStatistics] 📅 Usando caché de 7 días + filtro local para HOY
[useListeroStatistics] ⚡ Caché encontrado (YY min): XXX registros
[useListeroStatistics] 🔍 Filtro local aplicado: XXX → YYY registros
[useListeroStatistics] 📅 Rango: [fecha inicio] - [fecha fin]
[useListeroStatistics] ✅ Mostrando YYY registros en UI
```

**Resultado esperado:** ✅
- Carga **INSTANTÁNEA** (< 100ms)
- Muestra SOLO datos de HOY
- NO hace consulta a Supabase (usa caché)
- Actualiza caché de 7 días en background

---

### 📍 **Prueba 4: Filtro Local "Ayer"**
**Objetivo:** Verificar filtro local para Ayer

**Pasos:**
1. Con caché de 7 días disponible
2. Cambiar filtro a **"Ayer"**

**Logs esperados:**
```
[useListeroStatistics] 🎯 Filtro local detectado: AYER
[useListeroStatistics] 📅 Usando caché de 7 días + filtro local para AYER
[useListeroStatistics] ⚡ Caché encontrado (YY min): XXX registros
[useListeroStatistics] 🔍 Filtro local aplicado: XXX → YYY registros
[useListeroStatistics] ✅ Mostrando YYY registros en UI
```

**Resultado esperado:** ✅
- Carga **INSTANTÁNEA** (< 100ms)
- Muestra SOLO datos de AYER
- NO hace consulta a Supabase (usa caché)

---

### 📍 **Prueba 5: Cambio de Período (7d → Mes Actual)**
**Objetivo:** Verificar caché separado por período

**Pasos:**
1. Con caché de 7 días disponible
2. Cambiar filtro a **"Este mes"**

**Logs esperados:**
```
[useListeroStatistics] 📅 Usando caché de MES ACTUAL
[useListeroStatistics] 🔍 Período de caché: thisMonth, Filtro local: false
```

**Primera vez (sin caché de mes):**
```
[useListeroStatistics] 📥 No hay caché, cargando desde Supabase...
[StatisticsCache] ✅ Guardado en caché: thisMonth (XXX registros)
```

**Segunda vez (con caché):**
```
[useListeroStatistics] ⚡ Caché encontrado (YY min): XXX registros
```

**Resultado esperado:** ✅
- Primera vez: Carga desde Supabase (2-5s)
- Segunda vez: Carga instantánea desde caché
- Caché separado por período

---

### 📍 **Prueba 6: Actualización en Background**
**Objetivo:** Verificar que actualización no bloquea UI

**Pasos:**
1. Con caché disponible, cargar estadísticas
2. Observar que datos aparecen INMEDIATAMENTE
3. Esperar 2-3 segundos
4. Verificar que se actualiza en background

**Logs esperados:**
```
[useListeroStatistics] ⚡ Caché encontrado (YY min): XXX registros
[useListeroStatistics] ✅ Mostrando XXX registros en UI
[useListeroStatistics] 🔄 Iniciando actualización en background...
[useListeroStatistics] 📡 Fetch background con filtros: [...]
[useListeroStatistics] 💾 Caché actualizado: recent (XXX registros)
[useListeroStatistics] ✅ Datos actualizados en background (XXX registros)
```

O si no hay cambios:
```
[useListeroStatistics] ℹ️ No hay cambios en los datos
```

**Resultado esperado:** ✅
- UI responde inmediatamente
- Usuario puede interactuar mientras actualiza
- Actualización no bloquea pantalla
- Mensaje sutil si hay cambios (opcional)

---

### 📍 **Prueba 7: Cambio Rápido entre Filtros**
**Objetivo:** Verificar que cambios rápidos no causan problemas

**Pasos:**
1. Cambiar rápidamente entre: Hoy → Ayer → 7 días → Este mes
2. Verificar que no hay errores

**Logs esperados:**
```
[useListeroStatistics] ⏸️ Ya hay una carga en progreso, saltando...
```
(Si hay carga concurrente)

**Resultado esperado:** ✅
- Sin errores
- Sin cargas concurrentes
- Muestra datos correctos del último filtro seleccionado

---

## 🐛 Errores Comunes y Soluciones

### ❌ Error: "Cannot read property 'data' of null"
**Causa:** Caché corrupto o vacío
**Solución:** 
```javascript
// Ya está manejado en el código
if (cachedResult && cachedResult.data && cachedResult.data.length > 0)
```

### ❌ Error: "isRefreshing is not defined"
**Causa:** useStatistics no expone isRefreshing
**Solución:** ✅ Ya implementado en commit 1c1dc0d

### ❌ Logs no aparecen
**Causa:** Logs de consola deshabilitados
**Solución:** Abrir React Native Debugger o usar `npx react-native log-android`

### ❌ Caché no se limpia
**Causa:** AsyncStorage persiste entre reinicios
**Solución:** 
```javascript
// En desarrollo, llamar manualmente:
import * as statisticsCache from './src/utils/statisticsCache';
await statisticsCache.clearAllCache(userId);
```

---

## 📊 Métricas de Éxito

| Métrica | Objetivo | Estado |
|---------|----------|--------|
| Carga desde caché | < 100ms | ⏳ Por probar |
| Primera carga (Supabase) | 2-5s | ⏳ Por probar |
| Filtro local (Hoy/Ayer) | < 100ms | ⏳ Por probar |
| Background refresh | No bloquea UI | ⏳ Por probar |
| Caché por usuario | Separado | ⏳ Por probar |
| Caché por período | Separado | ⏳ Por probar |

---

## 🔍 Comandos Útiles para Debugging

### Ver logs en tiempo real (Android):
```bash
npx react-native log-android | grep "useListeroStatistics\|StatisticsCache"
```

### Ver logs en tiempo real (iOS):
```bash
npx react-native log-ios | grep "useListeroStatistics\|StatisticsCache"
```

### Verificar AsyncStorage (React Native Debugger):
```javascript
// En consola del debugger:
AsyncStorage.getAllKeys().then(keys => console.log(keys));
AsyncStorage.getItem('stats_v1_USER_ID_recent').then(data => console.log(JSON.parse(data)));
```

### Limpiar caché específico:
```javascript
import * as statisticsCache from './src/utils/statisticsCache';

// Limpiar un período
await statisticsCache.clearCache(userId, 'recent');

// Limpiar todo
await statisticsCache.clearAllCache(userId);

// Ver estadísticas de caché
const stats = await statisticsCache.getCacheStats(userId);
console.log(stats);
```

---

## ✅ Checklist de Pruebas

- [ ] Prueba 1: Primera carga sin caché
- [ ] Prueba 2: Carga instantánea desde caché
- [ ] Prueba 3: Filtro local "Hoy"
- [ ] Prueba 4: Filtro local "Ayer"
- [ ] Prueba 5: Cambio de período (7d → mes)
- [ ] Prueba 6: Actualización en background
- [ ] Prueba 7: Cambios rápidos entre filtros
- [ ] Verificar logs detallados en consola
- [ ] Verificar que no hay errores en consola
- [ ] Verificar que UI no se bloquea
- [ ] Verificar métricas de rendimiento

---

## 🚀 Próximos Pasos (Después de Validación)

1. ✅ **LISTERO completado** (este documento)
2. ⏳ Implementar para **COLECTOR** (useCollectorStatistics)
3. ⏳ Implementar para **ADMIN** (useAdminStatistics)
4. ⏳ Agregar indicador visual de `isRefreshing` en UI
5. ⏳ Implementar limpieza automática de caché antiguo (opcional)
6. ⏳ Agregar métricas de performance (opcional)

---

## 📝 Notas Importantes

- ⚠️ El caché es **infinito** (nunca expira automáticamente)
- ⚠️ El caché se actualiza en background cada vez que se abre la pantalla
- ⚠️ Los filtros "Hoy" y "Ayer" usan el caché de 7 días (no consultan Supabase)
- ⚠️ El caché es por **usuario** (cada usuario tiene su propio caché)
- ⚠️ El caché es por **período** (recent, thisMonth, lastMonth son independientes)
- ✅ Todos los logs tienen prefijo `[useListeroStatistics]` o `[StatisticsCache]` para fácil filtrado
- ✅ Los emojis en logs ayudan a identificar rápidamente el tipo de operación

---

**Fecha de creación:** 14 de octubre de 2025  
**Versión:** 1.0.0  
**Autor:** GitHub Copilot  
**Commits relacionados:**
- `a0c6908` - feat: Integrar AsyncStorage cache en useListeroStatistics
- `1c1dc0d` - feat: Exponer isRefreshing en useStatistics para UI feedback
- `757cea8` - feat: Implementar filtros locales para Hoy/Ayer en useListeroStatistics
