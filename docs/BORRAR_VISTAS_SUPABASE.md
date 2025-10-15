# 🗑️ INSTRUCCIONES: Borrar Vistas Optimizadas de Supabase

## ✅ **CAMBIOS COMPLETADOS EN CÓDIGO**

Se han realizado los siguientes cambios:

### 1. **Fix `ageMinutes` → `age`**
- ✅ Corregido acceso a propiedad correcta en logs

### 2. **Fix `userId` null**
- ✅ Agregados guards en `useStatistics.js` (loadAllStats, loadPlaysData, applyFilters)
- ✅ Agregados logs de carga de userId en `useListeroStatistics.js`
- ✅ Comentado useEffect de carga automática (ahora se hace desde StatisticsScreen)

### 3. **Cambio de Vistas Optimizadas**
- ✅ **HOY**: Ahora usa `v_estadisticas_7d` + filtro local (ACTUALIZADO en commit 5c4a385)
- ✅ **AYER**: Ahora usa `v_estadisticas_7d` + filtro local (ACTUALIZADO en commit 5c4a385)
- ✅ **7 DÍAS**: Sigue usando `v_estadisticas_7d` ✅
- ✅ **ESTE MES**: Sigue usando `v_estadisticas_mes` ✅
- ✅ **MES PASADO**: Sigue usando `v_estadisticas_mes_pasado` ✅
- ✅ **CUSTOM**: Usa `v_estadisticas` (vista base) como fallback ✅

### 4. **Carga Progresiva Automática**
- ✅ Implementada en `StatisticsScreen.js`
- ✅ Función `progressiveLoadAllCaches()` que carga:
  1. Caché de 7 días
  2. Caché de mes actual (delay 1s)
  3. Caché de mes pasado (delay 1s)
- ✅ Se ejecuta automáticamente 2 segundos después de tener `userId`
- ✅ Solo para role `listero` (por ahora)

---

## 🗑️ **VISTAS A BORRAR DE SUPABASE**

Ahora que el código ya no usa estas vistas, puedes borrarlas de la base de datos:

### **Vista 1: `v_estadisticas_hoy`**
```sql
DROP VIEW IF EXISTS v_estadisticas_hoy;
```

**Razón:** Ahora "Hoy" usa filtro local desde caché de 7 días.

---

### **Vista 2: `v_estadisticas_ayer`**
```sql
DROP VIEW IF EXISTS v_estadisticas_ayer;
```

**Razón:** Ahora "Ayer" usa filtro local desde caché de 7 días.

---

## ✅ **VISTAS QUE SE MANTIENEN** (NO BORRAR)

Estas vistas **SÍ se siguen usando** y son importantes para el rendimiento:

### ✅ `v_estadisticas_7d` 🔥 (MÁS USADA)
- **Usado para:** "Últimos 7 días", "Hoy" (filtro local), "Ayer" (filtro local)
- **Razón:** Vista optimizada + filtrado local = máxima eficiencia
- **ACTUALIZADO:** Ahora también se usa para Hoy y Ayer (commit 5c4a385)

### ✅ `v_estadisticas_mes`
- **Usado para:** Filtro "Este mes"
- **Razón:** Vista optimizada es más rápida que filtrar por fecha

### ✅ `v_estadisticas_mes_pasado`
- **Usado para:** Filtro "Mes pasado"
- **Razón:** Vista optimizada es más rápida que filtrar por fecha

### ✅ `v_estadisticas` (vista base)
- **Usado para:** Rangos de fechas personalizados fuera de cachés
- **Razón:** Fallback necesario para casos custom (ej: hace 2 meses)
- **Ejemplo:** Usuario selecciona del 1 al 15 de agosto (fuera de cachés actuales)

---

## 🔧 **CÓMO BORRAR LAS VISTAS**

### **Opción 1: Desde Supabase Dashboard**
1. Ir a: **Database** → **Tables**
2. En el menú lateral, buscar: **Views** (Vistas)
3. Buscar `v_estadisticas_hoy`
4. Click en los tres puntos (⋮) → **Delete View**
5. Confirmar eliminación
6. Repetir para `v_estadisticas_ayer`

---

### **Opción 2: SQL Editor**
1. Ir a: **SQL Editor** en Supabase
2. Ejecutar este script:

```sql
-- Borrar vistas que ya no se usan
DROP VIEW IF EXISTS v_estadisticas_hoy;
DROP VIEW IF EXISTS v_estadisticas_ayer;

-- Verificar que se borraron
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'v_estadisticas%'
ORDER BY table_name;
```

**Resultado esperado después del script:**
```
v_estadisticas
v_estadisticas_7d
v_estadisticas_mes
v_estadisticas_mes_pasado
```

---

## ⚠️ **IMPORTANTE: VERIFICACIÓN**

**ANTES de borrar**, verifica que:
1. ✅ El commit `161af1a` está aplicado
2. ✅ La app funciona correctamente con los cambios
3. ✅ Los filtros "Hoy" y "Ayer" funcionan (aunque no haya datos)

**DESPUÉS de borrar**, verifica que:
1. ✅ Los filtros "Hoy" y "Ayer" siguen funcionando
2. ✅ No hay errores en la consola tipo "relation v_estadisticas_hoy does not exist"
3. ✅ Los otros filtros (7d, mes, mes pasado) siguen funcionando

---

## 📊 **LOGS ESPERADOS DESPUÉS DEL CAMBIO**

### **Filtro "Hoy" (filtro local):**
```
[useListeroStatistics] 🎯 Filtro local detectado: HOY
[useListeroStatistics] 📅 Usando caché de 7 días + filtro local para HOY
[useListeroStatistics] ⚡ Caché encontrado (X min): 1024 registros
[useListeroStatistics] 🔍 Filtro local aplicado: 1024 → 0 registros
[useListeroStatistics] ✅ Mostrando 0 registros en UI
```

### **Filtro "Ayer" (filtro local):**
```
[useListeroStatistics] 🎯 Filtro local detectado: AYER
[useListeroStatistics] 📅 Usando caché de 7 días + filtro local para AYER
[useListeroStatistics] ⚡ Caché encontrado (X min): 1024 registros
[useListeroStatistics] 🔍 Filtro local aplicado: 1024 → Y registros
[useListeroStatistics] ✅ Mostrando Y registros en UI
```

### **Filtro "Últimos 7 días" (vista optimizada):**
```
[useListeroStatistics] 📅 Usando caché de 7 DÍAS (default)
[useListeroStatistics] ⚡ Caché encontrado (X min): 1024 registros
[useListeroStatistics] ✅ Mostrando 1024 registros en UI
```

### **Carga progresiva (automática):**
```
[StatisticsScreen] 👤 UserId disponible, iniciando carga progresiva en 2 segundos...
[StatisticsScreen] 🚀 Iniciando carga progresiva de cachés...
[StatisticsScreen] 📥 Paso 1/3: Cargando caché de 7 días...
[StatisticsScreen] 📥 Paso 2/3: Cargando caché de mes actual...
[StatisticsScreen] 📥 Paso 3/3: Cargando caché de mes pasado...
[StatisticsScreen] ✅ Carga progresiva completada
```

---

## ✅ **CHECKLIST POST-CAMBIOS**

- [ ] Commit `161af1a` aplicado y funcionando
- [ ] App cargada sin errores
- [ ] Filtro "Hoy" funciona con filtro local
- [ ] Filtro "Ayer" funciona con filtro local
- [ ] Vistas `v_estadisticas_hoy` y `v_estadisticas_ayer` borradas de BD
- [ ] Verificado que no hay errores en consola sobre vistas faltantes
- [ ] Carga progresiva funciona (ver logs)
- [ ] Todos los demás filtros funcionan correctamente

---

## 🎯 **RESUMEN**

**LO QUE CAMBIÓ:**
- "Hoy" y "Ayer" ahora usan **filtro local** (más rápido, sin consulta a BD)
- Vistas `v_estadisticas_hoy` y `v_estadisticas_ayer` **ya no se usan**
- Carga progresiva **automática** de todos los cachés al abrir pantalla
- Fixes de `userId` null y `ageMinutes` undefined

**LO QUE SE MANTIENE:**
- Vistas optimizadas: `v_estadisticas_7d`, `v_estadisticas_mes`, `v_estadisticas_mes_pasado`
- Caché sigue funcionando igual
- Background refresh sigue funcionando

**LO PRÓXIMO:**
1. ✅ **TÚ**: Borrar vistas de Supabase
2. ⏳ **NOSOTROS**: Probar todo funciona correctamente
3. ⏳ **NOSOTROS**: Aplicar misma estrategia a Colector y Admin

---

**Fecha:** 14 de octubre de 2025  
**Commit:** `161af1a`  
**Estado:** ✅ Listo para borrar vistas
