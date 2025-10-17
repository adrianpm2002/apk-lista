# 🛡️ Resumen de Protecciones Contra Crashes en Estadísticas

## 📋 Commits Realizados

### Commit 1: `bd3a497` - Protección inicial
- useCollectorStatistics.js
- useAdminStatistics.js
- Funciones de agrupación con try-catch
- Operaciones de caché con try-catch

### Commit 2: `608b05e` - Fix de validación en VisualMode
- Corrección de validación de longitud de números
- No relacionado con el crash de estadísticas

### Commit 3: `ebd4775` - Protección completa (ACTUAL)
- useListeroStatistics.js con protecciones
- useStatistics.js con protecciones
- ErrorBoundary.js (nuevo componente)
- StatisticsScreen.js envuelto con ErrorBoundary
- DEBUG_LOGS_ANDROID.md (documentación)

---

## 🔍 PASOS RECOMENDADOS PARA DETECTAR EL ERROR

### Opción 1: VER LOGS EN TIEMPO REAL (RECOMENDADO)

#### Paso 1: Conectar dispositivo Android
```bash
# Verificar que el dispositivo está conectado
adb devices
```

#### Paso 2: Limpiar logs anteriores
```bash
adb logcat -c
```

#### Paso 3: Iniciar captura de logs filtrados
```bash
# Opción A: Ver solo logs de React Native
adb logcat *:S ReactNative:V ReactNativeJS:V

# Opción B: Ver logs de la app específica
adb logcat | findstr "com.lazaroadrian.apk_lista"

# Opción C: Ver solo errores y crashes
adb logcat *:E
```

#### Paso 4: Abrir la app y reproducir el error
1. Abre la APK en el dispositivo
2. Ve a Estadísticas
3. Los logs se mostrarán en tiempo real en la terminal

#### Paso 5: Buscar patrones específicos
```bash
# Buscar errores de SQLite
adb logcat | findstr "SQLite"

# Buscar errores de estadísticas
adb logcat | findstr "Statistics"

# Buscar stack traces
adb logcat | findstr "Stack"
```

---

### Opción 2: GUARDAR LOGS A ARCHIVO

```bash
# Guardar logs completos
adb logcat -d > logs_completos.txt

# Guardar solo errores
adb logcat -d *:E > logs_errores.txt

# Guardar logs con timestamp
adb logcat -v time -d > logs_con_tiempo.txt
```

---

### Opción 3: VER ERROR EN PANTALLA (ErrorBoundary)

**Con los cambios implementados:**
1. Si hay un error de React, se mostrará una pantalla roja con:
   - Título del error
   - Mensaje del error
   - Stack trace completo
   - Botón "Recargar App"

2. Toma screenshot de esa pantalla
3. El stack trace te dirá exactamente dónde falló

---

### Opción 4: USAR REACT NATIVE DEBUGGER

```bash
# En otra terminal, ejecutar:
npx react-devtools

# Luego en el dispositivo, abrir el menú de desarrollo:
# Agitar el dispositivo o ejecutar:
adb shell input keyevent 82

# Seleccionar "Enable Remote JS Debugging"
```

---

## 📊 QUÉ BUSCAR EN LOS LOGS

### 1. Logs de Inicialización
```
[useStatistics] Detecting user role...
[useStatistics] User found: <user-id>
[useStatistics] Role detected: <role>
```

### 2. Logs de Carga de Datos
```
[useCollectorStatistics] Initialize effect - enabled: true
[useCollectorStatistics] Getting user from Supabase...
[useCollectorStatistics] Auto-loading data for userId: <id>
```

### 3. Logs de Caché SQLite
```
[SQLiteCache] SQLite not available on web platform
[useCollectorStatistics] Error reading from cache: <error>
[useCollectorStatistics] Continuing without cache...
```

### 4. Logs de Agrupación
```
[groupDataForCollector] Grouping X records
[groupDataForCollector] Grouped into Y listeros
```

### 5. Errores Críticos (BUSCAR ESTOS)
```
❌ Error in generateKpiData
❌ Error reading from cache
❌ Error in groupDataForCollector
❌ Exception in loadFromSupabase
```

---

## 🎯 ERRORES MÁS PROBABLES

### 1. Error de SQLite en Android
**Síntoma:**
```
[SQLiteCache] Error opening database
[useCollectorStatistics] Error reading from cache
```

**Solución:**
- Ya está protegido con try-catch
- Funcionará sin caché
- Logs te dirán el error específico

### 2. Error de Datos Malformados
**Síntoma:**
```
[groupDataForCollector] Null record found, skipping
[useStatistics] plays is not an array
```

**Solución:**
- Ya validado con Array.isArray()
- Retorna array vacío si hay error

### 3. Error de Permisos o Conexión
**Síntoma:**
```
[useCollectorStatistics] Supabase error: <details>
```

**Solución:**
- Verificar conexión a internet
- Verificar permisos de la app

---

## 🔧 ACCIONES INMEDIATAS

### 1. Compilar nueva APK con protecciones
```bash
eas build --platform android --profile preview
```

### 2. Instalar y probar
```bash
# Cuando descargues la APK:
adb install -r ruta/a/apk-lista.apk

# Abrir logs antes de probar:
adb logcat -c
adb logcat *:E
```

### 3. Reproducir error y capturar logs
1. Abrir app
2. Ir a Estadísticas
3. Si crashea, los logs mostrarán el error exacto
4. Si no crashea pero no carga datos, revisar logs de caché

---

## 📱 COMANDOS ÚTILES DE ADB

```bash
# Ver dispositivos conectados
adb devices

# Limpiar logs
adb logcat -c

# Ver logs en tiempo real
adb logcat

# Ver solo errores
adb logcat *:E

# Filtrar por app
adb logcat | findstr "com.lazaroadrian.apk_lista"

# Guardar logs
adb logcat -d > logs.txt

# Reiniciar app
adb shell am force-stop com.lazaroadrian.apk_lista
adb shell am start -n com.lazaroadrian.apk_lista/.MainActivity

# Abrir menú de desarrollo
adb shell input keyevent 82
```

---

## ✅ VERIFICACIONES POST-FIX

### Si ya NO crashea:
1. ✅ Las protecciones funcionaron
2. ✅ Revisa los logs para ver advertencias
3. ✅ Verifica que los datos se carguen correctamente

### Si AÚN crashea:
1. 📋 Captura los logs completos
2. 📋 Captura screenshot del ErrorBoundary
3. 📋 Anota los pasos exactos para reproducir
4. 📋 Comparte los logs para análisis detallado

---

## 🎯 SIGUIENTE PASO RECOMENDADO

**OPCIÓN A (Más rápido):** Compilar APK y usar logs en tiempo real
```bash
eas build --platform android --profile preview
# Luego:
adb logcat -c && adb logcat *:E
```

**OPCIÓN B (Más completo):** Usar ErrorBoundary + logs
1. Compilar APK
2. Reproducir error
3. Screenshot de ErrorBoundary
4. Capturar logs con `adb logcat -d > logs.txt`

---

## 📞 SOPORTE

Si necesitas ayuda interpretando los logs:
1. Comparte el archivo `logs.txt`
2. Comparte screenshot del ErrorBoundary (si apareció)
3. Describe los pasos que hiciste antes del crash
