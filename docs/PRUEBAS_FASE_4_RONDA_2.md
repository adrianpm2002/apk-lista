# 🧪 PRUEBAS FASE 4 - SEGUNDA RONDA

**Fecha:** 10 de noviembre de 2025  
**Build anterior:** 4637c820 (parcialmente probado)  
**Nuevo build:** Pendiente de generar manualmente  

---

## ✅ ESTADO DE PRUEBAS ANTERIORES

### Pruebas EXITOSAS (NO es necesario repetir):
- ✅ **Prueba 1:** Login online y guardado de credenciales - CORRECTO
- ✅ **Prueba 4:** Ver credenciales guardadas - CORRECTO
- ✅ **Prueba 5:** Validar sesión offline - CORRECTO
- ✅ **Prueba 6:** Ver último login - CORRECTO
- ✅ **Prueba 7:** Probar encriptación - CORRECTO
- ✅ **Prueba 8:** Ver info de BD - CORRECTO
- ✅ **Prueba 11:** Forzar sesión expirada - CORRECTO

### Pruebas PENDIENTES (realizar en nuevo build):
- ⏸️ **Prueba 2:** Panel de testing - ubicación (scroll no funcionaba)
- ⏸️ **Prueba 3:** Panel de testing - contenido completo (scroll no funcionaba)
- 🔴 **Prueba 9:** Login offline (ERROR: "Base de datos no disponible") ← **ARREGLADO**
- 🔴 **Prueba 10:** Login offline con contraseña incorrecta (depende de prueba 9)
- ⚠️ **Prueba 12:** Eliminar credenciales completo (parcialmente probado)
- ⏸️ **Prueba 13:** Ver y limpiar logs (scroll no funcionaba)

---

## 🔧 CAMBIOS REALIZADOS EN ESTE COMMIT

### 1. **Función `getCredentialsByUsername` agregada** (offlineStorageService.js)
- Nueva función que busca credenciales por nombre de usuario
- Maneja correctamente la base de datos
- Logs detallados en cada paso

### 2. **Login offline reescrito** (authService.js)
- Eliminado código que causaba "Base de datos no disponible"
- Ahora usa `getCredentialsByUsername` correctamente
- Logs en cada paso: búsqueda, validación, desencriptación

### 3. **Scroll del modal mejorado** (commit anterior)
- `maxHeight: 85%` en lugar de 90%
- `paddingBottom: 80px` en lugar de 40px
- Propiedades Android: `bounces={false}`, `overScrollMode="never"`

---

## 🎯 PRUEBAS A REALIZAR (En orden)

---

## 📱 PRUEBA 2: PANEL DE TESTING - UBICACIÓN (REVISIÓN)

### Objetivo
Verificar que el panel se abre correctamente con el scroll arreglado.

### Pasos
1. Abre la app
2. Navega a **Modo Visual**
3. Busca el botón **"🔧 Testing"** al final de la pantalla
4. Presiona el botón

### ✅ Resultado ESPERADO
```
1. Modal se abre CENTRADO
2. Fondo oscuro translúcido visible
3. Modal tiene margen alrededor (no toca bordes)
4. Título visible: "🔧 Panel de Testing Offline"
5. Botón X de cerrar visible arriba a la derecha
```

### Resultado Obtenido
```
[Describe aquí lo que viste:]





```

---

## 📱 PRUEBA 3: PANEL DE TESTING - SCROLL COMPLETO (REVISIÓN)

### Objetivo
Verificar que el scroll llega hasta el final sin trabarse.

### Pasos
1. Con el modal abierto
2. Intenta hacer scroll hacia abajo
3. Continúa scrolleando hasta el final
4. Verifica que puedas ver el texto de información al final

### ✅ Resultado ESPERADO
```
1. Scroll funciona fluidamente
2. Puedes ver TODAS las secciones:
   ✅ Estado de Conexión
   ✅ FASE 4: Login Offline (6 botones)
   ✅ Base de Datos SQLite (1 botón + botón fake credentials)
   ✅ Logs del Sistema (2 botones)
3. Al final hay texto informativo sobre el panel
4. El scroll NO se traba a mitad
5. Hay espacio extra debajo del último elemento
```

### Resultado Obtenido
```
[Describe si el scroll funcionó correctamente:]





¿Llegaste hasta el botón "🗑️ Limpiar Logs" al final? 
```

---

## 🔐 PRUEBA 9: LOGIN OFFLINE SIN CONEXIÓN (CRÍTICA - FIX APLICADO)

### Objetivo
Verificar que el login offline funciona correctamente AHORA que el error está arreglado.

### Preparación
Antes de empezar, captura logs:

```powershell
adb logcat -c
adb logcat -v time | findstr /R /C:"AuthService" /C:"OfflineStorage" /C:"Encryption" > prueba9_login_offline.txt
```

**NO cierres PowerShell, déjalo corriendo**

### Pasos
1. **Desactiva internet** (Modo Avión ON o WiFi/Datos OFF)
2. Abre la app
3. En LoginScreen, verifica que el botón **"🔴 Login Offline"** aparece
4. Ingresa:
   - Usuario: `[el_mismo_que_usaste_en_login_online]`
   - Contraseña: `[la_misma_correcta]`
5. Presiona **"🔴 Login Offline"**

### ✅ Resultado ESPERADO
```
1. Aparece Alert:
   ┌─────────────────────────────────────┐
   │ Modo Offline                        │
   │                                     │
   │ Sesión iniciada sin conexión.       │
   │ Algunas funciones estarán           │
   │ limitadas.                          │
   │                                     │
   │           [ OK ]                    │
   └─────────────────────────────────────┘

2. Al presionar OK:
   - Navegas a la pantalla principal
   - Sin errores ni crashes
   - La app funciona (modo offline)
```

### ❌ Errores que YA NO deberían aparecer
```
❌ "Base de datos no disponible" ← Este error está ARREGLADO
```

### Resultado Obtenido
```
[Escribe EXACTAMENTE lo que pasó:]

¿Login exitoso? (Sí/No): 

¿Mensaje de error? (si hubo): 


¿Navegaste a pantalla principal? (Sí/No): 


```

### DESPUÉS DEL LOGIN
Presiona **Ctrl+C** en PowerShell para detener la captura.

Abre el archivo `prueba9_login_offline.txt` y busca estas líneas:

```
[Copia aquí las líneas que contengan:]

[AuthService] Iniciando login offline para: ...
[AuthService] Buscando credenciales...
[OfflineStorage] Buscando credenciales para username: ...
[OfflineStorage] Credenciales encontradas en BD: ...
[OfflineStorage] ✅ Credenciales encontradas para ...
[AuthService] ✅ Credenciales encontradas
[AuthService] Verificando expiración de sesión...
[AuthService] Sesión expira en: ...
[AuthService] ✅ Sesión válida
[AuthService] Desencriptando contraseña...
[Encryption] Iniciando desencriptación...
[Encryption] ✅ Password decrypted successfully
[AuthService] Contraseña desencriptada, verificando...
[AuthService] ✅ Contraseña correcta
[AuthService] ✅ Offline login successful

[Pega aquí todas esas líneas:]






```

---

## 🔐 PRUEBA 10: LOGIN OFFLINE CON CONTRASEÑA INCORRECTA

### Objetivo
Verificar el manejo de errores (debe rechazar contraseña incorrecta).

### Preparación
```powershell
adb logcat -c
adb logcat -v time | findstr /R /C:"AuthService" /C:"OfflineStorage" > prueba10_password_incorrecta.txt
```

### Pasos
1. **Sin internet** (Modo Avión ON)
2. Si estás logueado, cierra sesión
3. En LoginScreen, ingresa:
   - Usuario: `[correcto]`
   - Contraseña: `[INCORRECTA - pon cualquier cosa diferente]`
4. Presiona **"🔴 Login Offline"**

### ✅ Resultado ESPERADO
```
Alert de error:
┌─────────────────────────────────────┐
│ Error                               │
│                                     │
│ Contraseña incorrecta               │
│                                     │
│           [ OK ]                    │
└─────────────────────────────────────┘

- NO permite entrar
- App NO se cierra
- Permanece en LoginScreen
```

### Resultado Obtenido
```
[¿Qué mensaje apareció?]



[¿Permitió entrar o rechazó?]


```

### Logs esperados
Presiona Ctrl+C y abre `prueba10_password_incorrecta.txt`

Deberías ver:
```
[AuthService] ❌ Contraseña incorrecta
```

```
[Pega aquí las líneas de [AuthService]:]




```

---

## 🗑️ PRUEBA 12: ELIMINAR CREDENCIALES COMPLETO

### Objetivo
Verificar el ciclo completo: eliminar → login offline no funciona → login online funciona.

### Parte A: Eliminar credenciales (ya probaste esto ✅)
```
Ya confirmaste que al presionar "🗑️ Eliminar Credenciales" 
aparece: "✅ Credenciales eliminadas correctamente"
```

### Parte B: Verificar que login offline NO funciona (NUEVO)

**Pasos:**
1. **Sin internet** (Modo Avión ON)
2. Abre la app
3. Ve a LoginScreen

**Resultado esperado:**
```
El botón "🔴 Login Offline" NO aparece
(porque no hay credenciales guardadas)

Solo ves el botón normal "Iniciar Sesión"
```

**Resultado obtenido:**
```
[¿El botón "Login Offline" aparece o no?]



```

### Parte C: Login online para restaurar (NUEVO)

**Pasos:**
1. **Activa internet** (Modo Avión OFF)
2. En LoginScreen, ingresa tus credenciales
3. Presiona "Iniciar Sesión" (botón normal)
4. Deberías entrar normalmente

**Resultado esperado:**
```
Login exitoso
Credenciales se vuelven a guardar automáticamente
```

**Resultado obtenido:**
```
[¿Login exitoso?]


```

### Parte D: Verificar que login offline vuelve a funcionar (NUEVO)

**Pasos:**
1. Cierra sesión
2. **Desactiva internet** de nuevo
3. Ve a LoginScreen
4. Verifica que el botón "🔴 Login Offline" **SÍ aparece ahora**
5. Haz login offline

**Resultado esperado:**
```
Botón offline visible ✅
Login offline funciona ✅
```

**Resultado obtenido:**
```
[¿Botón visible?]


[¿Login offline funciona?]


```

---

## 📋 PRUEBA 13: VER Y LIMPIAR LOGS (REVISIÓN CON SCROLL)

### Objetivo
Verificar el sistema de logs con el scroll arreglado.

### Pasos
1. Abre Panel de Testing
2. **Haz scroll hasta abajo** (hasta la sección "Logs del Sistema")
3. Presiona **"👁️ Ver Últimos Logs"**
4. Lee el contenido
5. Cierra el Alert
6. Presiona **"🗑️ Limpiar Logs"**
7. Confirma
8. Vuelve a presionar "👁️ Ver Últimos Logs"

### ✅ Resultado ESPERADO
```
1. Primera vez (con logs):
   - Se muestran hasta 10 logs
   - Cada log tiene nivel, mensaje, fecha/hora
   - Hay logs de login, credenciales, sesión, etc.

2. Después de limpiar:
   Alert: "No hay logs registrados"
```

### Resultado Obtenido
```
[¿Cuántos logs aparecieron la primera vez?]


[¿Qué decían los últimos 3 logs?]
1. 
2. 
3. 

[¿Se limpiaron correctamente?]


```

---

## 🧪 PRUEBA EXTRA: INSERTAR CREDENCIALES FAKE (Solo si quieres probar)

Esta prueba es **OPCIONAL**, solo para verificar que SQLite funciona.

### Pasos
1. Panel Testing → "🧪 Insertar Credenciales de Prueba"
2. Confirma
3. Presiona "✅ Ver Credenciales Guardadas"

### ✅ Resultado ESPERADO
```
Alert muestra:
Usuario: test_user
ID Usuario: 999
Rol: listero

NOTA: NO intentes hacer login offline con test_user
porque la contraseña no está encriptada correctamente.
Es solo para testing de lectura de BD.
```

### Resultado Obtenido
```
[¿Apareció test_user?]


```

---

## 📊 RESUMEN DE RESULTADOS - SEGUNDA RONDA

### ✅ Pruebas que deben pasar:

- [ ] **Prueba 2:** Panel se abre centrado con margen
- [ ] **Prueba 3:** Scroll llega hasta el final sin trabarse
- [ ] **Prueba 9:** Login offline funciona (sin error "Base de datos no disponible")
- [ ] **Prueba 10:** Contraseña incorrecta es rechazada
- [ ] **Prueba 12:** Ciclo completo de eliminar/restaurar credenciales
- [ ] **Prueba 13:** Ver y limpiar logs funciona con scroll

### ❌ Si alguna prueba falla:

**Prueba 9 falla con error:**
- 📋 Envía `prueba9_login_offline.txt` completo
- 🔍 Busca líneas con [OfflineStorage] y [AuthService]

**Prueba 3 (scroll) falla:**
- 📸 Toma screenshot del modal
- ❓ ¿Hasta qué botón llega el scroll?

**Cualquier otro error:**
- 📋 Captura logs: `adb logcat *:E -v time > error.txt`
- 📸 Screenshot del error
- 💬 Describe exactamente qué pasó

---

## 🎯 CRITERIO DE ÉXITO GLOBAL

La FASE 4 está **COMPLETA** si:

✅ **13/13 pruebas pasan** (incluyendo las 7 ya probadas + 6 nuevas)  
✅ **Login offline funciona** sin "Base de datos no disponible"  
✅ **Scroll del modal** llega hasta el final  
✅ **Todos los logs** muestran flujo correcto  

---

## 📤 QUÉ ENVIARME DESPUÉS DE LAS PRUEBAS

1. ✅ **Este documento completo** con todos los resultados llenados
2. 📄 **Archivos de logs:**
   - `prueba9_login_offline.txt`
   - `prueba10_password_incorrecta.txt`
3. 📸 **Screenshots** (si hay errores)
4. 💬 **Comentario general:** ¿Todo funcionó bien? ¿Algún comportamiento extraño?

---

## 🚀 SIGUIENTE PASO

Si todas estas pruebas pasan ✅, podemos avanzar a:

**FASE 5: Caché de Loterías y Horarios**
- Descargar loterías cuando hay internet
- Descargar horarios cuando hay internet
- Usar datos cacheados cuando no hay internet
- Actualizar caché en segundo plano

---

**¡Gracias por las pruebas! 🙌**
