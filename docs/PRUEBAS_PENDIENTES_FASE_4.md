# 🧪 PRUEBAS PENDIENTES - FASE 4

**Fecha:** 17 de noviembre de 2025  
**Cambios recientes:**
- ✅ Fix "Base de datos no disponible" en login offline
- ✅ Fix scroll del modal (height en lugar de maxHeight)
- ✅ Panel ahora muestra todos los botones

---

## ✅ YA PROBADAS Y EXITOSAS (No repetir):

- ✅ Prueba 1: Login online y guardado de credenciales
- ✅ Prueba 4: Ver credenciales guardadas
- ✅ Prueba 5: Validar sesión offline
- ✅ Prueba 6: Ver último login
- ✅ Prueba 7: Probar encriptación
- ✅ Prueba 8: Ver info de BD
- ✅ Prueba 11: Forzar sesión expirada

---

## 🎯 PRUEBAS PENDIENTES (6 pruebas)

---

## 📱 PRUEBA 2: Panel de Testing - Ubicación

### Pasos:
1. Abre la app
2. Ve a **Modo Visual** (o desde LoginScreen también está disponible)
3. Busca el botón morado **"🧪 Testing"**
4. Toca el botón

### ✅ Resultado Esperado:
- Modal se abre centrado en la pantalla
- Fondo oscuro translúcido detrás
- Modal con bordes redondeados
- Título: "🔧 Panel de Testing Offline"
- Botón X visible arriba a la derecha

### Resultado Obtenido:
```
[¿Se abrió correctamente? ¿Algo cortado?]





```

---

## 📱 PRUEBA 3: Panel - Contenido Completo con Scroll

### Pasos:
1. Con el modal abierto
2. Verifica que veas el **Header** y **Estado de Conexión**
3. Haz scroll hacia abajo
4. Continúa hasta el final

### ✅ Resultado Esperado:
Debes ver TODAS estas secciones en orden:

**1. Header:**
- 🔧 Panel de Testing Offline
- Botón X

**2. Estado de Conexión:**
- Conexión: 🟢 Online (o 🔴 Offline)

**3. 📱 FASE 4: Login Offline (6 botones):**
- ✅ Ver Credenciales Guardadas
- ⏰ Validar Sesión Offline
- 📅 Ver Último Login
- 🔐 Probar Encriptación
- ⏳ Forzar Sesión Expirada (rojo)
- 🗑️ Eliminar Credenciales (rojo)

**4. 🗄️ Base de Datos SQLite (2 botones):**
- 📊 Ver Info de BD
- 🧪 Insertar Credenciales de Prueba

**5. 📋 Logs del Sistema (2 botones):**
- 👁️ Ver Últimos Logs
- 🗑️ Limpiar Logs (rojo)

**6. Información (texto):**
- Texto informativo al final

### Resultado Obtenido:
```
[¿Viste TODAS las secciones? ¿Cuántos botones en total?]

Total de botones vistos: ___

¿Falta alguna sección? 




```

---

## 🔐 PRUEBA 9: Login Offline (CRÍTICA - Ahora debe funcionar)

### Preparación - Captura de logs:
```powershell
adb logcat -c
adb logcat -v time | Select-String "AuthService|OfflineStorage|Encryption" > prueba9.txt
```
**NO cierres PowerShell, déjalo corriendo**

### Pasos:
1. **Desactiva WiFi y Datos móviles** (Modo Avión ON)
2. Abre la app (o si ya está abierta, cierra sesión)
3. En LoginScreen, verifica que aparece el botón **"🔴 Login Offline"** debajo del botón normal
4. Ingresa:
   - Usuario: [el mismo que usaste en login online]
   - Contraseña: [la misma correcta]
5. Toca **"🔴 Login Offline"**

### ✅ Resultado Esperado:
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

2. Tras tocar OK:
   - Navegas a la pantalla principal
   - La app funciona normalmente
   - No hay crashes
```

### ❌ NO debe aparecer:
- "Base de datos no disponible" ← Este error YA ESTÁ ARREGLADO
- "No hay credenciales guardadas" (si hiciste login online antes)

### Resultado Obtenido:
```
[¿Login exitoso? ¿Mensaje que apareció?]





[¿Navegaste a pantalla principal?]


```

### Después del login - Logs:
Presiona **Ctrl+C** en PowerShell para detener la captura.

Abre `prueba9.txt` y busca estas líneas (cópialas aquí):
```
[Busca y copia líneas con:]

[AuthService] Iniciando login offline para: ...
[OfflineStorage] Buscando credenciales para username: ...
[OfflineStorage] ✅ Credenciales encontradas para ...
[AuthService] ✅ Sesión válida
[Encryption] ✅ Password decrypted successfully
[AuthService] ✅ Contraseña correcta
[AuthService] ✅ Offline login successful

[Pega las líneas aquí:]







```

---

## 🔐 PRUEBA 10: Login Offline - Contraseña Incorrecta

### Preparación - Logs:
```powershell
adb logcat -c
adb logcat -v time | Select-String "AuthService" > prueba10.txt
```

### Pasos:
1. **Sin internet** (Modo Avión ON)
2. Si estás logueado, cierra sesión
3. En LoginScreen, ingresa:
   - Usuario: [correcto]
   - Contraseña: **INCORRECTA** (ej: "password123")
4. Toca **"🔴 Login Offline"**

### ✅ Resultado Esperado:
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
- App NO se cierra
- Permanece en LoginScreen
```

### Resultado Obtenido:
```
[¿Qué mensaje apareció exactamente?]




[¿Permitió entrar o rechazó correctamente?]


```

### Logs esperados (en prueba10.txt):
```
[AuthService] ❌ Contraseña incorrecta
```

```
[Pega aquí las líneas relevantes:]



```

---

## 🗑️ PRUEBA 12: Ciclo Completo - Eliminar y Restaurar Credenciales

### Parte A: Eliminar credenciales
Ya probaste esto ✅

### Parte B: Verificar que login offline NO funciona

**Pasos:**
1. **Sin internet** (Modo Avión ON)
2. Abre la app → LoginScreen

**Resultado esperado:**
```
El botón "🔴 Login Offline" NO aparece
(porque no hay credenciales guardadas)

Solo ves el botón normal "Iniciar Sesión"
```

**Resultado obtenido:**
```
[¿El botón "Login Offline" está visible o no?]



```

### Parte C: Restaurar con Login Online

**Pasos:**
1. **Activa WiFi** (internet ON)
2. En LoginScreen, haz login normal con tus credenciales
3. Login debe ser exitoso

**Resultado esperado:**
```
- Login exitoso ✅
- Credenciales se guardan automáticamente ✅
```

**Resultado obtenido:**
```
[¿Login funcionó?]


```

### Parte D: Verificar que login offline vuelve a funcionar

**Pasos:**
1. Cierra sesión
2. **Desactiva WiFi** de nuevo
3. Ve a LoginScreen
4. Verifica si ahora el botón **"🔴 Login Offline"** SÍ aparece
5. Intenta login offline

**Resultado esperado:**
```
- Botón offline visible ✅
- Login offline funciona ✅
```

**Resultado obtenido:**
```
[¿Botón visible después de restaurar?]


[¿Login offline funciona?]


```

---

## 📋 PRUEBA 13: Ver y Limpiar Logs

### Parte A: Ver Logs

**Pasos:**
1. Abre Panel de Testing
2. Haz scroll hasta la sección **"📋 Logs del Sistema"**
3. Toca **"👁️ Ver Últimos Logs"**

**Resultado esperado:**
```
Alert muestra hasta 10 logs recientes:

[INFO] Database initialized
07/11/2025 13:45:30

[INFO] Credentials saved
07/11/2025 13:45:35

[INFO] Session validated
07/11/2025 13:50:00

(y más logs...)
```

**Resultado obtenido:**
```
[¿Cuántos logs aparecieron?]


[¿Qué decían los últimos 3 logs?]
1. 
2. 
3. 


```

### Parte B: Limpiar Logs

**Pasos:**
1. En el panel, toca **"🗑️ Limpiar Logs"**
2. Confirma la eliminación
3. Espera el mensaje de éxito
4. Toca **"👁️ Ver Últimos Logs"** de nuevo

**Resultado esperado:**
```
Alert: "Logs"
"No hay logs registrados"
```

**Resultado obtenido:**
```
[¿Se limpiaron correctamente?]


[¿Qué mensaje apareció al ver logs después de limpiar?]


```

---

## 📊 RESUMEN FINAL

### Marca las pruebas completadas:

- [ ] Prueba 2: Panel ubicación
- [ ] Prueba 3: Panel contenido completo (10 botones)
- [ ] Prueba 9: Login offline funciona
- [ ] Prueba 10: Contraseña incorrecta rechazada
- [ ] Prueba 12: Ciclo eliminar/restaurar
- [ ] Prueba 13: Ver y limpiar logs

### Total de pruebas FASE 4:
- ✅ **7 ya probadas** (1, 4, 5, 6, 7, 8, 11)
- 🎯 **6 pendientes** (2, 3, 9, 10, 12, 13)
- 📊 **13 total**

### Criterio de éxito:
✅ **Las 6 pruebas pendientes pasan = FASE 4 COMPLETA AL 100%**

---

## 📤 QUÉ ENVIARME:

1. ✅ Este documento con todos los resultados llenados
2. 📄 Archivos de logs:
   - `prueba9.txt` (login offline exitoso)
   - `prueba10.txt` (contraseña incorrecta)
3. 📸 Screenshots de cualquier error
4. 💬 Comentario: ¿Todo funcionó bien?

---

## 🎯 DESPUÉS DE COMPLETAR FASE 4:

Si todas las pruebas pasan ✅, avanzaremos a:

**FASE 5: Caché de Loterías y Horarios**
- Descargar y guardar loterías cuando hay internet
- Descargar y guardar horarios cuando hay internet
- Usar datos cacheados cuando no hay internet
- Actualizar caché en segundo plano

---

**¡Suerte con las pruebas! 🚀**
