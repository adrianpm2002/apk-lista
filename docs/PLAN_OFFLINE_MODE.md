# 🎯 PLAN DE IMPLEMENTACIÓN MODO OFFLINE - ESTADO ACTUAL

**Última actualización:** 7 de noviembre de 2025  
**Progreso general:** 11/27 tareas completadas (41%)

---

## ✅ FASE 1: FUNDAMENTOS SQLite - **COMPLETADA**

### Paso 1.1 - Investigar SQLite existente ✅
- ✅ Librería identificada: `react-native-sqlite-storage` v6.0.1
- ✅ Base de datos: `offline.db`
- ✅ Inicialización: `getDatabase()` en offlineStorageService.js

### Paso 1.2 - Crear offlineStorageService.js ✅
- ✅ Inicializar DB SQLite con todas las tablas:
  - `offline_plays` (jugadas pendientes)
  - `offline_lotteries` (caché de loterías)
  - `offline_schedules` (caché de horarios)
  - `offline_credentials` (credenciales encriptadas)
  - `offline_config` (configuración general)
  - `offline_logs` (logs del sistema)
  - `offline_stats_cache` (estadísticas en caché)
- ✅ Funciones CRUD básicas implementadas
- ✅ **PROBADO:** Insertar y leer registros de prueba

### Paso 1.3 - Sistema de Logs ✅
- ✅ Función `addLog(level, message, data)`
- ✅ Función `getLogs(limit, offset)`
- ✅ Función `clearLogs()`
- ✅ **PROBADO:** Guardar y recuperar logs

---

## ✅ FASE 2: DETECCIÓN DE CONEXIÓN - **COMPLETADA**

### Paso 2.1 - Instalar NetInfo ✅
- ✅ `@react-native-community/netinfo` v11.3.1 instalado
- ✅ Configurado en package.json

### Paso 2.2 - Crear servicio de conexión ✅
- ✅ Archivo: `src/services/connectionService.js`
- ✅ Función `checkConnection()` - NetInfo + ping a Supabase
- ✅ Función `startMonitoring()` - Listener de cambios
- ✅ Función `stopMonitoring()`
- ✅ Hook personalizado: `useConnection()`
- ✅ **PROBADO:** Console log cuando cambia estado

### Paso 2.3 - Optimización de banner ✅
- ✅ Banner `ConnectionStatusIndicator` optimizado
- ✅ Sin re-renders innecesarios
- ✅ Estilo mejorado (sin lag)
- ✅ **NOTA:** Se eliminó funcionalidad "Forzar Offline" (no necesaria)

---

## ✅ FASE 3: CONTEXT Y ESTADO GLOBAL - **COMPLETADA**

### Paso 3.1 - Crear OfflineContext.js ✅
- ✅ Archivo: `src/contexts/OfflineContext.js`
- ✅ Estados implementados:
  - `isOnline` (boolean) - Estado de conexión real
  - `pendingPlays` (array) - Jugadas en cola
  - `isSyncing` (boolean) - Estado de sincronización
- ✅ Funciones:
  - `loadPendingPlays()` - Cargar desde SQLite
  - `checkSessionValidity()` - Validar sesión cada hora
- ✅ **PROBADO:** Context consumido en componentes

### Paso 3.2 - Integrar detección de conexión ✅
- ✅ `connectionService` conectado con context
- ✅ `isOnline` se actualiza automáticamente
- ✅ Banner muestra estado en tiempo real
- ✅ **PROBADO:** Cambio de estado al desconectar WiFi

---

## ✅ FASE 4: LOGIN OFFLINE - **COMPLETADA**

### Paso 4.1 - Encriptación de credenciales ✅
- ✅ Librería: `expo-crypto` v13.0.2 instalado
- ✅ Archivo: `src/services/encryptionService.js`
- ✅ Función `encryptPassword(password, key)` - XOR + Base64
- ✅ Función `decryptPassword(encrypted, key)` - Reverso
- ✅ Función `generateDeviceKey()` - Clave única por dispositivo (256-bit)
- ✅ Función `generateHash(text)` - SHA-256
- ✅ **PROBADO:** Encriptar y desencriptar string ✅

### Paso 4.2 - Modificar authService.js ✅
- ✅ `saveCredentialsForOffline(username, password, profile)` - Guarda en SQLite
- ✅ `loginOffline(username, password)` - Login sin conexión
- ✅ `validateOfflineSession()` - Valida sesión <24h (retorna objeto con detalles)
- ✅ `logoutOffline(clearCredentials)` - Cierra sesión offline
- ✅ **PROBADO:** Login online → Cerrar → Login offline ✅

### Paso 4.3 - Modificar LoginScreen.js ✅
- ✅ Componente `OfflineLoginButton` creado
- ✅ Solo visible si hay credenciales guardadas
- ✅ Lógica de cambio entre login online/offline
- ✅ **FIX:** Corregido `setFieldError` ReferenceError
- ✅ **PROBADO:** Login offline con credenciales correctas/incorrectas ✅

### 🧪 Panel de Testing Offline ✅
- ✅ Archivo: `src/components/OfflineTestingPanel.js`
- ✅ Botón visible: "🧪 Testing" (morado, con sombra)
- ✅ **ELIMINADO:** Todas las referencias a `__DEV__` (visible en producción)
- ✅ Pruebas disponibles:
  - ✅ Ver Credenciales Guardadas (con detalles completos)
  - ✅ Validar Sesión Offline (con tiempo de expiración)
  - ✅ Ver Último Login (fecha, hora, tiempo transcurrido)
  - ✅ Probar Encriptación (test de encrypt/decrypt)
  - ✅ Forzar Sesión Expirada (para testing)
  - ✅ Eliminar Credenciales (limpiar para testing)
  - ✅ Ver Info de BD (contadores de tablas)
  - ✅ Ver Últimos Logs (últimos 10 registros)
  - ✅ Limpiar Logs (eliminar todos)
- ✅ Integrado en: `VisualModeScreen` (línea 1176)

---

## ⏸️ FASE 5: CACHÉ DE LOTERÍAS/HORARIOS - **PENDIENTE**

### Paso 5.1 - Funciones de caché en offlineStorageService.js
- ⏸️ `saveLotteries(lotteries)` - INSERT/REPLACE
- ⏸️ `saveSchedules(schedules)` - INSERT/REPLACE
- ⏸️ `getLotteries(id_banco)` - SELECT (ya existe como placeholder)
- ⏸️ `getSchedules(id_loteria)` - SELECT (ya existe como placeholder)
- ⏸️ `getLastCacheUpdate()` - SELECT from config
- ⏸️ **PRUEBA:** Guardar y recuperar loterías

### Paso 5.2 - Background sync en backgroundTaskService.js
- ⏸️ Función `syncOfflineCache()` cada hora
- ⏸️ Fetch loterías del banco del usuario
- ⏸️ Fetch horarios de esas loterías
- ⏸️ Guardar en SQLite con timestamp
- ⏸️ Log en offline_logs
- ⏸️ **PRUEBA:** Esperar 1 hora y verificar actualización

---

## ⏸️ FASE 6: CREAR JUGADAS OFFLINE - **PENDIENTE**

### Paso 6.1 - Crear useOfflinePlaySubmission.js
- ⏸️ Hook similar a usePlaySubmission
- ⏸️ Función `savePlayOffline(playData)`
- ⏸️ Validar datos básicos (no vacíos)
- ⏸️ Calcular monto_total localmente
- ⏸️ INSERT en offline_plays con status='pending'
- ⏸️ Log de operación
- ⏸️ **PRUEBA:** Guardar jugada offline y verificar en SQLite

### Paso 6.2 - Modificar pantallas de jugadas
- ⏸️ Detectar si está offline (OfflineContext)
- ⏸️ Si offline: usar useOfflinePlaySubmission
- ⏸️ Si online: usar usePlaySubmission normal
- ⏸️ Mostrar mensaje "Jugada guardada en cola" si offline
- ⏸️ **PRUEBA:** Crear jugada en cada pantalla en modo offline

### Paso 6.3 - Indicador en header
- ⏸️ Crear componente `OfflineIndicator.js`
- ⏸️ Mostrar icono según estado (online/offline/syncing)
- ⏸️ Badge con cantidad de pendientes
- ⏸️ Solo en pantallas de jugadas
- ⏸️ **PRUEBA:** Ver indicador cambiar según estado

---

## ⏸️ FASE 7: REGISTRO DE JUGADAS OFFLINE - **PENDIENTE**

### Paso 7.1 - Crear OfflinePlayRegistryScreen.js
- ⏸️ Basado en JugadasScreen.js
- ⏸️ Cargar jugadas de SQLite
- ⏸️ Mostrar lista con estados (pending/success/failed)
- ⏸️ Header con totales (pendientes, exitosas, fallidas, total $)
- ⏸️ **PRUEBA:** Ver jugadas creadas

### Paso 7.2 - UI de items
- ⏸️ Mostrar: números, tipo, monto, lotería, horario, timestamp
- ⏸️ Icono de estado con color
- ⏸️ Tocar para expandir/mostrar error
- ⏸️ **PRUEBA:** Tocar items y ver detalles

### Paso 7.3 - Botones de acción
- ⏸️ Pendiente: "Eliminar" + "Enviar ahora"
- ⏸️ Fallida: "Eliminar" + "Ver error" + "Reintentar"
- ⏸️ Exitosa: Solo checkmark
- ⏸️ Mantener presionado: Modo selección múltiple
- ⏸️ Botón "Eliminar seleccionadas"
- ⏸️ **PRUEBA:** Eliminar jugadas individuales y múltiples

### Paso 7.4 - Botón "Limpiar exitosas"
- ⏸️ Modal de confirmación
- ⏸️ DELETE de SQLite donde status='success'
- ⏸️ Actualizar UI
- ⏸️ **PRUEBA:** Limpiar exitosas

### Paso 7.5 - Agregar a Sidebar
- ⏸️ Botón "Registro Offline" siempre visible
- ⏸️ Badge con número de pendientes
- ⏸️ Navegación a OfflinePlayRegistryScreen
- ⏸️ **PRUEBA:** Navegar desde sidebar

---

## ⏸️ FASE 8: SINCRONIZACIÓN - **PENDIENTE**
*13 sub-tareas pendientes*

## ⏸️ FASE 9: BANNERS Y NOTIFICACIONES - **PENDIENTE**
*3 sub-tareas pendientes*

## ⏸️ FASE 10: CAMBIO DE DÍA - **PENDIENTE**
*3 sub-tareas pendientes*

## ⏸️ FASE 11: SIDEBAR - MODO OFFLINE - **PENDIENTE**
*2 sub-tareas pendientes*

## ⏸️ FASE 12: OPTIMIZACIONES Y PULIDO - **PENDIENTE**
*4 sub-tareas pendientes*

## ⏸️ FASE 13: TESTING INTEGRAL - **PENDIENTE**
*5 escenarios de prueba pendientes*

---

## 🔧 ESTADO ACTUAL DEL BUILD

**Último build:** `4637c820-9b50-44b6-b704-c681a86af62a`  
**Account:** lazaroadrian0803  
**Proyecto:** apk-lista-clean-2024  
**Package:** com.adrianpm.apklistaclean  
**Link:** https://expo.dev/accounts/lazaroadrian0803/projects/apk-lista-clean-2024/builds/4637c820-9b50-44b6-b704-c681a86af62a

**Fixes aplicados (incluidos en build):**
1. ✅ Corregido ReferenceError `setFieldError` en LoginScreen
2. ✅ Eliminada condición `__DEV__` de OfflineTestingPanel
3. ✅ Panel de testing mejorado con 9 pruebas completas
4. ✅ Botón "🧪 Testing" más visible (morado, con sombra)
5. ✅ Eliminado código duplicado (SyntaxError)
6. ✅ Modal centrado y scrolleable en Android

**Documento de pruebas:** `docs/PRUEBAS_FASE_4.md` (13 pruebas detalladas)

**Próximo paso:** Descargar APK y ejecutar todas las pruebas de FASE 4

---

## 📝 NOTAS IMPORTANTES

1. **SQLite:** Base de datos `offline.db` inicializada automáticamente al abrir la app
2. **Credenciales:** Se guardan automáticamente al hacer login online exitoso
3. **Sesión:** Válida por 24 horas desde el último login
4. **Encriptación:** XOR + Base64 con clave única por dispositivo
5. **Panel de Testing:** Visible en VisualModeScreen (abajo del todo)
6. **Logs:** Activos en todas las builds (desarrollo y producción)

---

## ❓ PRÓXIMAS DECISIONES REQUERIDAS

**Antes de avanzar a FASE 5:**
- [ ] Usuario debe confirmar que FASE 4 funciona 100% en APK
- [ ] Probar todos los botones del panel de testing
- [ ] Verificar login offline funciona correctamente
- [ ] Confirmar que no hay crashes

**Una vez confirmado:**
- Avanzar a FASE 5: Caché de loterías/horarios
- Implementar sync automático cada hora
- Permitir ver datos offline en pantallas de consulta
