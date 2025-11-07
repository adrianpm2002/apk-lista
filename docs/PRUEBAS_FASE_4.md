# 🧪 PRUEBAS COMPLETAS - FASE 4: LOGIN OFFLINE

**Fecha:** 7 de noviembre de 2025  
**Build:** `4637c820-9b50-44b6-b704-c681a86af62a`  
**Link de descarga:** https://expo.dev/accounts/lazaroadrian0803/projects/apk-lista-clean-2024/builds/4637c820-9b50-44b6-b704-c681a86af62a

---

## 📋 PRE-REQUISITOS

✅ APK instalada en Xiaomi Mi 9T PRO (Android 11)  
✅ Conexión WiFi disponible  
✅ Modo Avión disponible para pruebas offline  
✅ Credenciales de prueba listas (usuario y contraseña)

---

## 🎯 PRUEBA 1: LOGIN ONLINE Y GUARDADO DE CREDENCIALES

### Objetivo
Verificar que el login online funciona y guarda credenciales automáticamente.

### Pasos
1. Abrir la app
2. **Verificar:** Conexión WiFi activa
3. Ingresar credenciales:
   - Usuario: `[tu_usuario]`
   - Contraseña: `[tu_contraseña]`
4. Presionar botón "Iniciar sesión"
5. Esperar redirección

### ✅ Resultado CORRECTO
```
1. Sin errores ni crashes
2. Redirección exitosa a pantalla principal (según rol):
   - Admin/Collector → Statistics
   - Listero → MainApp
3. Credenciales guardadas en SQLite (silenciosamente, sin mensaje)
```

### ❌ Resultado INCORRECTO
```
- App se cierra (crash)
- Error: "ReferenceError: Property 'setFieldError' doesn't exist"
- No redirecciona a ninguna pantalla
- Mensaje de error sin detalles
```

---

## 🎯 PRUEBA 2: PANEL DE TESTING - UBICACIÓN Y APERTURA

### Objetivo
Verificar que el panel de testing es visible y se abre correctamente.

### Pasos
1. Navegar a **Modo Visual** (pantalla de jugadas)
2. **Scroll hasta el final** de la pantalla
3. Buscar botón **"🧪 Testing"** (morado con sombra)
4. Presionar el botón

### ✅ Resultado CORRECTO
```
1. Botón "🧪 Testing" visible al final de VisualModeScreen
2. Botón tiene:
   - Color morado (#9b59b6)
   - Sombra/elevación visible
   - Tamaño grande, fácil de presionar
3. Al presionar:
   - Modal se abre CENTRADO en la pantalla
   - Fondo oscuro translúcido detrás del modal
   - Modal ocupa ~90% de altura máxima
   - Contenido completamente visible
```

### ❌ Resultado INCORRECTO
```
- Botón NO visible (eliminado por error)
- Botón muy pequeño, difícil de ver
- Modal se abre cortado (solo título visible)
- Modal pegado a un borde (arriba/abajo)
- No se puede hacer scroll
- Modal ocupa toda la pantalla sin margen
```

---

## 🎯 PRUEBA 3: PANEL DE TESTING - CONTENIDO COMPLETO

### Objetivo
Verificar que todas las secciones del panel son visibles con scroll.

### Pasos
1. Con el modal abierto, verificar título: **"🔧 Panel de Testing Offline"**
2. Verificar sección **"Estado de Conexión"**:
   - Label: "Conexión:"
   - Valor: "🟢 Online" (con WiFi) o "🔴 Offline" (sin WiFi)
3. **Hacer scroll hacia abajo**
4. Verificar sección **"📱 FASE 4: Login Offline"** con 6 botones:
   - ✅ Ver Credenciales Guardadas
   - ⏰ Validar Sesión Offline
   - 📅 Ver Último Login
   - 🔐 Probar Encriptación
   - ⏳ Forzar Sesión Expirada (rojo)
   - 🗑️ Eliminar Credenciales (rojo)
5. Continuar scroll
6. Verificar sección **"🗄️ Base de Datos SQLite"** con 1 botón:
   - 📊 Ver Info de BD
7. Continuar scroll
8. Verificar sección **"📋 Logs del Sistema"** con 2 botones:
   - 👁️ Ver Últimos Logs
   - 🗑️ Limpiar Logs (rojo)
9. Scroll hasta el final
10. Verificar texto de información: "ℹ️ Panel de testing..."

### ✅ Resultado CORRECTO
```
TODAS las secciones visibles:
✅ Estado de Conexión (verde/rojo según estado)
✅ FASE 4: Login Offline (6 botones azules/rojos)
✅ Base de Datos SQLite (1 botón azul)
✅ Logs del Sistema (2 botones azul/rojo)
✅ Información al final

Scroll funciona suavemente
Todos los botones se ven completos
No hay cortes ni contenido oculto
```

### ❌ Resultado INCORRECTO
```
- Solo se ve "Estado de Conexión"
- Secciones inferiores NO aparecen
- Scroll no funciona o no permite bajar
- Modal se corta a mitad de pantalla
- Botones cortados o superpuestos
- Contenido se ve fuera del modal
```

---

## 🎯 PRUEBA 4: VER CREDENCIALES GUARDADAS

### Objetivo
Verificar que las credenciales se guardaron correctamente.

### Pasos
1. En el panel de testing
2. Presionar **"✅ Ver Credenciales Guardadas"**

### ✅ Resultado CORRECTO
```
Alert con título: "✅ Credenciales Guardadas"
Contenido debe mostrar:
┌─────────────────────────────────────┐
│ ✅ Credenciales Guardadas           │
│                                     │
│ Usuario: listero1                   │
│ User ID: 123                        │
│ Rol: listero                        │
│ ID Banco: 5                         │
│ Último Login: 07/11/2025 13:45:30   │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

Valores específicos según tu cuenta:
- Usuario: El que usaste para login
- User ID: ID numérico de tu usuario
- Rol: admin | collector | listero
- ID Banco: ID numérico del banco
- Último Login: Fecha/hora del login online
```

### ❌ Resultado INCORRECTO
```
Alert: "❌ Sin Credenciales"
Mensaje: "No hay credenciales guardadas. Haz login online primero."

O bien:
- Alert con error: "No se pudo verificar: [mensaje]"
- Valores NULL o N/A en todos los campos
- App se cierra (crash)
```

---

## 🎯 PRUEBA 5: VALIDAR SESIÓN OFFLINE

### Objetivo
Verificar que la sesión está válida (<24h desde último login).

### Pasos
1. En el panel de testing
2. Presionar **"⏰ Validar Sesión Offline"**

### ✅ Resultado CORRECTO
```
Alert con título: "✅ Sesión Válida"
Contenido:
┌─────────────────────────────────────┐
│ ✅ Sesión Válida                    │
│                                     │
│ La sesión es válida (<24h)          │
│                                     │
│ Expira en: 23 horas                 │
│ Fecha de expiración:                │
│ 08/11/2025 13:45:30                 │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

Notas:
- "Expira en" debe ser < 24 horas
- Fecha de expiración = Último login + 24h
```

### ❌ Resultado INCORRECTO
```
Alert: "❌ Sesión Expirada"
Mensaje: "La sesión ha expirado (>24h) o no existe"

Esto significa:
- Han pasado más de 24h desde el último login online
- Las credenciales fueron eliminadas
- Necesitas hacer login online de nuevo
```

---

## 🎯 PRUEBA 6: VER ÚLTIMO LOGIN

### Objetivo
Verificar la fecha/hora del último login online.

### Pasos
1. En el panel de testing
2. Presionar **"📅 Ver Último Login"**

### ✅ Resultado CORRECTO
```
Alert con título: "📅 Último Login"
Contenido:
┌─────────────────────────────────────┐
│ 📅 Último Login                     │
│                                     │
│ Fecha: 07/11/2025                   │
│ Hora: 13:45:30                      │
│                                     │
│ Hace: 0.5 horas                     │
│ (0.02 días)                         │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

Notas:
- Fecha/Hora debe coincidir con tu login online
- "Hace" debe ser < 24 horas para sesión válida
```

### ❌ Resultado INCORRECTO
```
Alert: "Info"
Mensaje: "❌ No hay registro de último login"

Esto significa:
- No has hecho login online aún
- Las credenciales fueron eliminadas
```

---

## 🎯 PRUEBA 7: PROBAR ENCRIPTACIÓN

### Objetivo
Verificar que el sistema de encriptación funciona correctamente.

### Pasos
1. En el panel de testing
2. Presionar **"🔐 Probar Encriptación"**

### ✅ Resultado CORRECTO
```
Alert con título: "✅ Encriptación OK"
Contenido:
┌─────────────────────────────────────┐
│ ✅ Encriptación OK                  │
│                                     │
│ Original: MiPassword123!            │
│ Encriptado: YWJjZGVmZ2hpamtsbW5...  │
│ Desencriptado: MiPassword123!       │
│                                     │
│ Estado: CORRECTO                    │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

Notas:
- Original y Desencriptado DEBEN ser idénticos
- Encriptado debe ser diferente (Base64)
- Estado debe decir "CORRECTO"
```

### ❌ Resultado INCORRECTO
```
Alert: "❌ Error de Encriptación"
Mensaje: "Estado: FALLÓ"

O bien:
- Original ≠ Desencriptado
- Error: "Prueba de encriptación falló: [mensaje]"
- App se cierra (crash)
```

---

## 🎯 PRUEBA 8: VER INFO DE BASE DE DATOS

### Objetivo
Verificar los contadores de las tablas SQLite.

### Pasos
1. En el panel de testing
2. Presionar **"📊 Ver Info de BD"**

### ✅ Resultado CORRECTO
```
Alert con título: "🗄️ Info de Base de Datos"
Contenido:
┌─────────────────────────────────────┐
│ 🗄️ Info de Base de Datos           │
│                                     │
│ Credenciales: 1                     │
│ Logs: 15                            │
│ Jugadas pendientes: 0               │
│ Loterías en caché: 0                │
│ Horarios en caché: 0                │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

Valores esperados después del login:
- Credenciales: 1 (tus credenciales)
- Logs: > 0 (varios logs del sistema)
- Jugadas pendientes: 0 (FASE 6 aún no implementada)
- Loterías en caché: 0 (FASE 5 aún no implementada)
- Horarios en caché: 0 (FASE 5 aún no implementada)
```

### ❌ Resultado INCORRECTO
```
- Credenciales: 0 (no se guardaron)
- Error: "No se pudo obtener info: [mensaje]"
- App se cierra (crash)
```

---

## 🎯 PRUEBA 9: LOGIN OFFLINE SIN CONEXIÓN

### Objetivo
Verificar que el login offline funciona correctamente.

### Pasos
1. **Cerrar sesión** en la app
2. **Activar Modo Avión** en el dispositivo:
   - Deslizar desde arriba → Modo Avión ON
   - O: Ajustes → Conexiones → Modo Avión
3. Verificar que no hay conexión (WiFi y datos móviles desactivados)
4. Abrir la app
5. En LoginScreen, ingresar:
   - Usuario: `[el_mismo_del_login_online]`
   - Contraseña: `[la_misma_del_login_online]`
6. **Verificar** que aparece botón **"📵 Login Offline"**
7. Presionar botón "📵 Login Offline"

### ✅ Resultado CORRECTO
```
1. Botón "📵 Login Offline" VISIBLE debajo del botón normal
2. Al presionar, aparece Alert:

┌─────────────────────────────────────┐
│ Modo Offline                        │
│                                     │
│ Sesión iniciada sin conexión.       │
│ Algunas funciones estarán           │
│ limitadas.                          │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

3. Al presionar OK:
   - Redirección exitosa a pantalla principal
   - Sin crashes ni errores
```

### ❌ Resultado INCORRECTO
```
CASO 1: Botón NO aparece
- Posible causa: No hay credenciales guardadas
- Solución: Hacer login online primero

CASO 2: Error al presionar botón
Alert con error:
- "Contraseña incorrecta" → Contraseña mal ingresada
- "Sesión expirada" → Han pasado >24h, hacer login online
- "Error en login offline: [mensaje]" → Error técnico

CASO 3: App se cierra (crash)
- Revisar logs con adb logcat
```

---

## 🎯 PRUEBA 10: LOGIN OFFLINE CON CONTRASEÑA INCORRECTA

### Objetivo
Verificar el manejo de errores en login offline.

### Pasos
1. Con Modo Avión activo
2. En LoginScreen, ingresar:
   - Usuario: `[correcto]`
   - Contraseña: `[INCORRECTA - cualquier texto diferente]`
3. Presionar "📵 Login Offline"

### ✅ Resultado CORRECTO
```
Alert de error:
┌─────────────────────────────────────┐
│ Error                               │
│                                     │
│ Contraseña incorrecta               │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

- NO permite entrar a la app
- App NO se cierra (sin crash)
- Permanece en LoginScreen
```

### ❌ Resultado INCORRECTO
```
- Permite entrar con contraseña incorrecta (GRAVE)
- App se cierra (crash)
- Error sin mensaje claro
```

---

## 🎯 PRUEBA 11: FORZAR SESIÓN EXPIRADA (TESTING)

### Objetivo
Probar el comportamiento cuando la sesión expira.

### Pasos
1. Abrir panel de testing
2. Presionar **"⏳ Forzar Sesión Expirada"** (botón rojo)
3. Confirmar en el Alert de confirmación
4. Esperar mensaje de éxito
5. Ahora presionar **"⏰ Validar Sesión Offline"**

### ✅ Resultado CORRECTO
```
1. Confirmación:
┌─────────────────────────────────────┐
│ Confirmar                           │
│                                     │
│ ¿Forzar expiración de sesión?      │
│                                     │
│ Esto hará que la sesión aparezca    │
│ como expirada (útil para testing).  │
│                                     │
│   [ Cancelar ]    [ Expirar ]       │
└─────────────────────────────────────┘

2. Después de confirmar:
┌─────────────────────────────────────┐
│ Éxito                               │
│                                     │
│ ✅ Sesión marcada como expirada.    │
│ Prueba validar sesión ahora.        │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

3. Al validar sesión:
┌─────────────────────────────────────┐
│ ❌ Sesión Expirada                  │
│                                     │
│ La sesión ha expirado (>24h)        │
│ o no existe                         │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘
```

### ❌ Resultado INCORRECTO
```
- Error al forzar expiración
- Después de forzar, la sesión sigue válida
- App se cierra (crash)
```

---

## 🎯 PRUEBA 12: ELIMINAR CREDENCIALES (TESTING)

### Objetivo
Limpiar credenciales para empezar pruebas de cero.

### Pasos
1. Abrir panel de testing
2. Presionar **"🗑️ Eliminar Credenciales"** (botón rojo)
3. Confirmar en el Alert de confirmación
4. Esperar mensaje de éxito
5. Cerrar sesión
6. Intentar login offline

### ✅ Resultado CORRECTO
```
1. Confirmación:
┌─────────────────────────────────────┐
│ Confirmar                           │
│                                     │
│ ¿Eliminar todas las credenciales    │
│ guardadas?                          │
│                                     │
│ Esto cerrará tu sesión offline.     │
│                                     │
│   [ Cancelar ]    [ Eliminar ]      │
└─────────────────────────────────────┘

2. Después de confirmar:
┌─────────────────────────────────────┐
│ Éxito                               │
│                                     │
│ ✅ Credenciales eliminadas          │
│ correctamente                       │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

3. En LoginScreen (sin conexión):
- Botón "📵 Login Offline" NO aparece
- Solo permite login online
```

### ❌ Resultado INCORRECTO
```
- Error al eliminar credenciales
- Después de eliminar, botón offline sigue apareciendo
- App se cierra (crash)
```

---

## 🎯 PRUEBA 13: VER Y LIMPIAR LOGS

### Objetivo
Verificar el sistema de logging del sistema.

### Pasos
1. Abrir panel de testing
2. Presionar **"👁️ Ver Últimos Logs"**
3. Revisar contenido
4. Cerrar Alert
5. Presionar **"🗑️ Limpiar Logs"**
6. Confirmar
7. Volver a presionar "Ver Últimos Logs"

### ✅ Resultado CORRECTO
```
1. Primera vez (con logs):
┌─────────────────────────────────────┐
│ Últimos 10 Logs                     │
│                                     │
│ [INFO] Database initialized         │
│ 07/11/2025 13:45:30                 │
│                                     │
│ [INFO] Credentials saved            │
│ 07/11/2025 13:45:35                 │
│                                     │
│ [INFO] Session validated            │
│ 07/11/2025 13:50:00                 │
│                                     │
│ (y más logs...)                     │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

2. Después de limpiar:
┌─────────────────────────────────────┐
│ Logs                                │
│                                     │
│ No hay logs registrados             │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘
```

### ❌ Resultado INCORRECTO
```
- No hay logs (tabla vacía desde el inicio)
- Error al limpiar logs
- App se cierra (crash)
```

---

## 📊 CHECKLIST FINAL DE PRUEBAS

### Funcionalidades Core
- [ ] Login online funciona y guarda credenciales
- [ ] Panel de testing visible y accesible
- [ ] Modal se abre centrado y con scroll
- [ ] Todas las secciones del panel visibles
- [ ] Login offline funciona sin conexión
- [ ] Botón offline solo aparece si hay credenciales

### Panel de Testing
- [ ] ✅ Ver Credenciales → Muestra datos correctos
- [ ] ⏰ Validar Sesión → Muestra si es válida <24h
- [ ] 📅 Ver Último Login → Muestra fecha/hora correcta
- [ ] 🔐 Probar Encriptación → Estado CORRECTO
- [ ] ⏳ Forzar Sesión Expirada → Funciona para testing
- [ ] 🗑️ Eliminar Credenciales → Limpia correctamente
- [ ] 📊 Ver Info de BD → Muestra contadores correctos
- [ ] 👁️ Ver Últimos Logs → Muestra logs del sistema
- [ ] 🗑️ Limpiar Logs → Elimina todos los logs

### Manejo de Errores
- [ ] Contraseña incorrecta offline → Error sin crash
- [ ] Sesión expirada → Error sin crash
- [ ] Sin credenciales → Botón offline NO aparece
- [ ] Sin conexión al abrir app → No crash

### Experiencia de Usuario
- [ ] Modal no se corta en Android
- [ ] Scroll funciona suavemente
- [ ] Botones fáciles de presionar
- [ ] Mensajes de error claros
- [ ] Confirmaciones para acciones destructivas

---

## 🐛 REPORTE DE ERRORES

Si encuentras algún error, captura:

### Información del Error
```
- Prueba que estabas realizando: [número de prueba]
- Paso específico donde falló: [paso]
- Mensaje de error (si apareció): [texto]
- Comportamiento esperado: [lo que debería pasar]
- Comportamiento real: [lo que pasó]
```

### Logs de Android
```powershell
# Capturar logs al momento del error
adb logcat *:E -v time > error_fase4.txt

# Luego reproducir el error
# Ctrl+C para detener

# Compartir error_fase4.txt
```

### Screenshots
- Tomar screenshot del error
- Tomar screenshot del panel de testing (si aplica)

---

## ✅ CONFIRMACIÓN FINAL

**Una vez completadas TODAS las pruebas exitosamente:**

```
✅ FASE 4: LOGIN OFFLINE - COMPLETADA AL 100%

Funcionalidades verificadas:
- Login online con guardado automático de credenciales
- Login offline sin conexión (<24h)
- Encriptación XOR + Base64 funcional
- Validación de sesión 24h
- Panel de testing completo con 9 pruebas
- Sistema de logs operativo
- Manejo de errores robusto

Listo para avanzar a FASE 5: Caché de Loterías/Horarios
```

---

## 📞 SOPORTE

Si tienes dudas o problemas:
1. Revisar esta documentación completa
2. Capturar logs con adb logcat
3. Tomar screenshots
4. Reportar con toda la información recopilada
