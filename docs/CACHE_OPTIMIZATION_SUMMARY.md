# 📋 Optimización de Caché AsyncStorage - Resumen Final

## ✅ **ESTADO ACTUAL**

### 🎯 Estrategia Implementada
- **Solo se cachea**: Últimos 7 días (`recent`)
- **NO se cachea**: Mes actual, mes pasado (períodos largos)
- **Razón**: Evitar `QuotaExceededError` por límites de AsyncStorage (~5-10MB en web)

---

## 📦 **ARCHIVOS MODIFICADOS**

### 1. **`src/utils/statisticsCache.js`**
**Cambios:**
- ✅ Solo guarda caché para período `'recent'` (7 días)
- ✅ Ignora períodos `'thisMonth'` y `'lastMonth'`
- ✅ Función `saveToCache()` verifica período antes de guardar
- ✅ Función `clearAllCache()` solo limpia `'recent'`
- ✅ Función `getCacheStats()` solo reporta stats de `'recent'`

**Logs esperados:**
```
[StatisticsCache] ⏭️ Saltando caché para período: thisMonth (solo se cachea 'recent')
[StatisticsCache] ✅ Guardado en caché: recent (1080 registros)
```

---

### 2. **`src/hooks/useListeroStatistics.js`**
**Cambios:**
- ✅ Variable `canUseCache` determina si se puede usar caché
- ✅ Solo `canUseCache = true` para: `today`, `yesterday`, `last7days`
- ✅ Períodos largos (`last30days`, `lastMonth`, `custom`): `canUseCache = false`
- ✅ Si `canUseCache = false` → carga directa desde Supabase sin cachear
- ✅ Background refresh solo guarda caché si `canUseCache = true`

**Logs esperados:**
```
[useListeroStatistics] 📡 Período largo (last30days): carga directa desde Supabase (sin caché)
[useListeroStatistics] 🔍 Período de caché: recent, Filtro local: false, Usa caché: false
[useListeroStatistics] ℹ️ Período largo: no se guarda en caché (3500 registros)
```

---

### 3. **`src/screens/StatisticsScreen.js`**
**Cambios:**
- ❌ **ELIMINADA**: Función `progressiveLoadAllCaches()`
- ❌ **ELIMINADO**: useEffect de carga progresiva automática
- ✅ **AGREGADA**: Verificación de `userId` en `applyPeriodFilter()`
- ✅ Caché se carga bajo demanda (cuando usuario selecciona período)

**Logs esperados:**
```
[StatisticsScreen] 👤 UserId disponible, caché se cargará bajo demanda
[StatisticsScreen] ⏸️ applyPeriodFilter: No hay userId, saltando...
```

---

## 🔄 **FLUJO DE TRABAJO ACTUALIZADO**

### **Escenario 1: Usuario selecciona "Hoy"**
1. ✅ `canUseCache = true` (Hoy está dentro de 7 días)
2. ✅ Intenta cargar desde caché `recent`
3. ✅ Si no hay caché → carga 7 días desde Supabase
4. ✅ Guarda en caché `recent`
5. ✅ Aplica filtro local para mostrar solo hoy
6. ✅ Background refresh actualiza caché

### **Escenario 2: Usuario selecciona "Este mes"**
1. ❌ `canUseCache = false` (período largo)
2. 📡 Carga directa desde Supabase (vista `v_estadisticas_mes`)
3. ❌ NO guarda en caché (evita QuotaExceededError)
4. ✅ Muestra datos completos del mes
5. ❌ NO hay background refresh de caché

### **Escenario 3: Usuario selecciona "Últimos 7 días"**
1. ✅ `canUseCache = true`
2. ✅ Intenta cargar desde caché `recent`
3. ✅ Si hay caché → muestra instantáneamente
4. ✅ Background refresh actualiza caché
5. ✅ Guarda nuevamente en caché `recent`

---

## 📊 **PERÍODOS Y SUS CONFIGURACIONES**

| Período | Vista Supabase | Usa Caché | Filtro Local | Guarda Caché |
|---------|---------------|-----------|--------------|--------------|
| **Hoy** | `v_estadisticas_7d` | ✅ Sí (`recent`) | ✅ Sí | ✅ Sí |
| **Ayer** | `v_estadisticas_7d` | ✅ Sí (`recent`) | ✅ Sí | ✅ Sí |
| **Últimos 7 días** | `v_estadisticas_7d` | ✅ Sí (`recent`) | ❌ No | ✅ Sí |
| **Este mes** | `v_estadisticas_mes` | ❌ No | ❌ No | ❌ No |
| **Mes pasado** | `v_estadisticas_mes_pasado` | ❌ No | ❌ No | ❌ No |
| **Custom** | `v_estadisticas` | ❌ No | ❌ No | ❌ No |

---

## 🐛 **PROBLEMAS RESUELTOS**

### **Problema 1: QuotaExceededError**
**Error:**
```
QuotaExceededError: Failed to execute 'setItem' on 'Storage': 
Setting the value of 'stats_v1_xxx_thisMonth' exceeded the quota.
```

**Solución:**
- Solo cachear período corto (7 días ≈ 1000-1500 registros)
- NO cachear períodos largos (mes ≈ 3000-5000 registros)

---

### **Problema 2: Carga progresiva sin userId**
**Error:**
```
[useListeroStatistics] ⚠️ No hay userId, no se puede cargar datos
```

**Solución:**
- Eliminada carga progresiva automática
- Agregada verificación de `userId` en `applyPeriodFilter()`
- Caché se carga bajo demanda cuando usuario selecciona período

---

### **Problema 3: Logs duplicados**
**Causa:** React Strict Mode en desarrollo

**No requiere solución:** Es comportamiento esperado en desarrollo

---

## 📝 **DOCUMENTOS MOVIDOS A `/docs`**

Archivos movidos desde raíz a carpeta `/docs`:
1. ✅ `TESTING_CACHE_OPTIMIZATION.md`
2. ✅ `BORRAR_VISTAS_SUPABASE.md`
3. ✅ `CACHE_OPTIMIZATION_SUMMARY.md` (NUEVO)

**Razón:** Reducir tamaño de APK compilado. Estos archivos solo son útiles para desarrollo, no deben incluirse en el build de producción.

---

## 🚀 **PRÓXIMOS PASOS**

### **1. Probar implementación**
- [ ] Seleccionar "Hoy" → debe usar caché + filtro local
- [ ] Seleccionar "Este mes" → debe cargar directo sin caché
- [ ] Verificar logs en consola para confirmar comportamiento

### **2. Validar que NO hay errores**
- [ ] No debe aparecer `QuotaExceededError`
- [ ] No debe aparecer `No hay userId` después de login
- [ ] Filtros Hoy/Ayer deben mostrar datos correctos

### **3. Borrar vistas obsoletas de Supabase**
Después de validar, ejecutar en Supabase SQL Editor:
```sql
DROP VIEW IF EXISTS v_estadisticas_hoy;
DROP VIEW IF EXISTS v_estadisticas_ayer;
```

### **4. Aplicar optimización a otros roles**
- [ ] Adaptar para `useCollectorStatistics`
- [ ] Adaptar para `useAdminStatistics`

---

## 📌 **NOTAS IMPORTANTES**

### **Límites de AsyncStorage**
- **Web (localStorage)**: ~5-10 MB
- **Mobile (AsyncStorage)**: Prácticamente ilimitado
- **Solución**: Solo cachear datos críticos (7 días)

### **Vistas de Supabase que SE MANTIENEN**
- ✅ `v_estadisticas_7d` (HOY, AYER, 7 DÍAS) 🔥
- ✅ `v_estadisticas_mes` (ESTE MES)
- ✅ `v_estadisticas_mes_pasado` (MES PASADO)
- ✅ `v_estadisticas` (CUSTOM/FALLBACK)

### **Vistas de Supabase OBSOLETAS (borrar después de validar)**
- ❌ `v_estadisticas_hoy` (ahora usa v_estadisticas_7d + filtro local)
- ❌ `v_estadisticas_ayer` (ahora usa v_estadisticas_7d + filtro local)

---

## 🎯 **RESUMEN EJECUTIVO**

**¿Qué cambió?**
- Solo se cachean últimos 7 días
- Períodos largos se cargan directo desde Supabase
- Eliminada carga progresiva automática
- Agregadas verificaciones de userId

**¿Por qué?**
- Evitar QuotaExceededError en AsyncStorage
- Mejorar rendimiento inicial (no pre-cargar datos innecesarios)
- Simplificar flujo de carga

**¿Qué mejora?**
- ✅ No más errores de almacenamiento lleno
- ✅ Carga bajo demanda más eficiente
- ✅ Filtros Hoy/Ayer siguen siendo instantáneos
- ✅ Períodos largos se cargan cuando se necesitan

**¿Qué se pierde?**
- ❌ Pre-carga automática de mes/mes pasado
- ❌ Caché de períodos largos

**¿Vale la pena?**
- ✅ **SÍ**: Estabilidad y confiabilidad > Pre-carga de datos que quizá no se usen

---

**Última actualización:** 15 de octubre de 2025
**Commits relacionados:** (Se agregarán después de los commits)
