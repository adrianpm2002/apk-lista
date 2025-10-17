# 📱 Guía para Revisar Logs en Android (APK Compilada)

## ✅ RECOMENDACIÓN: Pasos para Detectar el Error

### **Opción 1: Ver Logs en Tiempo Real con ADB (RECOMENDADO)**

#### **Requisitos:**
1. Habilitar **Opciones de Desarrollador** en el dispositivo Android
2. Habilitar **Depuración USB**
3. Tener `adb` (Android Debug Bridge) instalado en tu PC

#### **Pasos:**

1. **Instalar ADB (si no lo tienes):**
   ```powershell
   # En Windows con Chocolatey
   choco install adb
   
   # O descargar manualmente desde:
   # https://developer.android.com/studio/releases/platform-tools
   ```

2. **Conectar el dispositivo Android al PC vía USB**

3. **Verificar conexión:**
   ```powershell
   adb devices
   ```
   Debería mostrar tu dispositivo conectado

4. **Ver logs en tiempo real MIENTRAS USAS LA APP:**
   ```powershell
   # Ver todos los logs (puede ser abrumador)
   adb logcat
   
   # MEJOR: Filtrar solo logs de ReactNative y errores
   adb logcat *:E ReactNativeJS:V
   
   # O filtrar por el nombre de tu app
   adb logcat | Select-String -Pattern "apk-lista|ReactNativeJS|FATAL"
   ```

5. **Reproducir el error:**
   - Con el comando corriendo, abre la app
   - Navega a Estadísticas
   - **JUSTO cuando crashee, revisa la terminal**
   - Verás el error exacto con el stack trace completo

6. **Guardar los logs en un archivo:**
   ```powershell
   adb logcat -d > logs.txt
   ```

---

### **Opción 2: ErrorBoundary (YA IMPLEMENTADO)**

Con los cambios que acabamos de hacer:

1. **Abre la app normalmente**
2. **Ve a Estadísticas**
3. Si hay un error, **NO crasheará la app completa**
4. **Aparecerá una pantalla roja** con:
   - Mensaje de error
   - Stack trace completo
   - Component stack
5. **Toma captura de pantalla** de esa información
6. **También aparecerá un Alert** antes de la pantalla de error

**Beneficio:** No necesitas cables, ves el error directamente en el dispositivo

---

### **Opción 3: Logs en Consola (para desarrollo)**

Si estás ejecutando con `npx expo start`:

```powershell
# Terminal 1: Iniciar Metro
npx expo start

# Terminal 2: Ver logs filtrados
npx expo start --clear

# O abrir DevTools
# Presiona 'j' en la terminal de expo para abrir debugger
```

Luego en Chrome DevTools verás todos los `console.log`, `console.error`, etc.

---

## 🔍 ¿QUÉ BUSCAR EN LOS LOGS?

### **Patrones de Error Comunes:**

1. **Error de SQLite:**
   ```
   Error: Cannot read property 'executeSql' of undefined
   Error: SQLite database not initialized
   ```

2. **Error de Agrupación:**
   ```
   TypeError: Cannot read property 'length' of undefined
   TypeError: rawData.forEach is not a function
   ```

3. **Error de Supabase:**
   ```
   FetchError: Network request failed
   PostgrestError: ...
   ```

4. **Error de Render:**
   ```
   Invariant Violation: ...
   Error: Objects are not valid as a React child
   ```

### **Logs que agregamos para debugging:**

Busca estas líneas en los logs:
- `[useCollectorStatistics]` - Logs del hook de colector
- `[useAdminStatistics]` - Logs del hook de admin
- `[useListeroStatistics]` - Logs del hook de listero
- `[groupDataForCollector]` - Logs de agrupación de colector
- `[groupDataForAdmin]` - Logs de agrupación de admin
- `⚠️ Error` - Errores capturados pero no fatales
- `❌` - Errores críticos

---

## 📋 PLAN RECOMENDADO

### **Paso 1: Probar con ErrorBoundary (MÁS RÁPIDO)**
1. Generar nueva build con los cambios
2. Instalar APK en dispositivo
3. Abrir Estadísticas
4. Si aparece pantalla de error, **tomar captura**
5. Enviarme la captura con el error completo

### **Paso 2: Si ErrorBoundary no atrapa el error (usar ADB)**
1. Instalar ADB en tu PC
2. Conectar dispositivo por USB
3. Ejecutar: `adb logcat *:E ReactNativeJS:V`
4. Reproducir el crash
5. Copiar los últimos 50-100 líneas de logs
6. Enviarme el archivo

### **Paso 3: Análisis del Error**
Con la información del paso 1 o 2, podré:
- Identificar la línea exacta que causa el crash
- Ver si es SQLite, agrupación, o rendering
- Implementar fix específico

---

## 🎯 ALTERNATIVA: Limpiar Caché SQLite

Si el error es de SQLite corrupto, puedes:

```javascript
// En useCollectorStatistics.js, useAdminStatistics.js, useListeroStatistics.js
// Agregar temporalmente al inicio de loadPlaysData:

try {
  await SQLiteCache.clearAllCache(); // Limpiar todo el caché
  console.log('✅ SQLite cache cleared');
} catch (e) {
  console.log('⚠️ Could not clear cache:', e);
}
```

Esto forzará a cargar todo desde Supabase sin usar SQLite.

---

## 📝 RESUMEN: ¿QUÉ CAMBIÓ?

### **Protecciones Agregadas:**
1. ✅ Try-catch en todas las operaciones de SQLite
2. ✅ Try-catch en funciones de agrupación (collector, admin, listero)
3. ✅ Validación de tipos (Array, null, undefined)
4. ✅ Modo degradado: funciona sin caché si SQLite falla
5. ✅ ErrorBoundary que muestra el error en pantalla
6. ✅ Logs detallados para debugging

### **Archivos Modificados:**
- `src/hooks/useCollectorStatistics.js` ✅
- `src/hooks/useAdminStatistics.js` ✅
- `src/hooks/useListeroStatistics.js` ✅ (RECIÉN AGREGADO)
- `src/components/ErrorBoundary.js` ✅ (NUEVO)
- `src/screens/StatisticsScreen.js` ✅ (envuelto con ErrorBoundary)

---

## 🚀 PRÓXIMOS PASOS

1. **Hacer commit de los cambios**
2. **Generar nueva build**
3. **Probar en dispositivo**
4. **Si hay error, capturarlo con ErrorBoundary o ADB**
5. **Enviarme el error para fix final**

¿Quieres que proceda con el commit y genere la build?
