# 📋 PRUEBAS COMPLETAS - FASE 4: Login Offline

**Build ID:** 26738ee1-724c-4dc1-9bd3-8176667c0526  
**Fecha:** 10 de noviembre de 2025  
**Cambios principales:**
- ✅ Encriptación sin expo-crypto (compatible producción)
- ✅ Scroll del modal de testing arreglado
- ✅ Panel de testing con 10 funciones
- ✅ Logs detallados en todos los servicios

---

## 🎯 OBJETIVO DE ESTA FASE

Verificar que el sistema de **Login Offline** funciona correctamente, incluyendo:
1. Guardado de credenciales durante login online
2. Encriptación y desencriptación de contraseñas
3. Validación de sesiones offline
4. Login offline cuando no hay conexión

---

## 📱 ANTES DE EMPEZAR

### Preparación:
1. **Desinstalar** la APK anterior (si existe)
2. **Descargar** la nueva APK del build: https://expo.dev/accounts/lazaroadrian0803/projects/apk-lista-clean-2024/builds/26738ee1-724c-4dc1-9bd3-8176667c0526
3. **Instalar** la nueva APK en tu Xiaomi Mi 9T PRO
4. **Tener listo** tu usuario y contraseña real del sistema

### Herramientas de captura de logs (IMPORTANTE):
Abre PowerShell y ejecuta este comando ANTES de cada prueba crítica:

```powershell
adb logcat -c
adb logcat -v time | findstr /R /C:"Encryption" /C:"AuthService" /C:"OfflineStorage" > prueba_X.txt
```

(Reemplaza X por el número de prueba)

---

## 🧪 SECCIÓN 1: PANEL DE TESTING (Verificar que funciona)

### ✅ PRUEBA 1.1: Abrir el Panel de Testing

**Pasos:**
1. Abre la app
2. En la pantalla de login, presiona el botón "Modo Visual"
3. En la pantalla principal, busca el botón flotante "🔧 Panel Testing" (esquina inferior derecha)
4. Presiona el botón

**Resultado Esperado:**
- ✅ Se abre un modal centrado
- ✅ Título: "🔧 Panel de Testing Offline"
- ✅ Se ve el estado de conexión (🟢 Online)
- ✅ Se ven todas las secciones: FASE 4, Encriptación, Base de Datos

**Resultado Obtenido:**
```
[Escribe aquí: ¿Se abrió correctamente? ¿Algo cortado?]
```

---

### ✅ PRUEBA 1.2: Scroll del Modal

**Pasos:**
1. Con el panel abierto, intenta hacer scroll hacia abajo
2. Llega hasta el ÚLTIMO botón visible
3. Intenta seguir scrolleando más allá

**Resultado Esperado:**
- ✅ El scroll es fluido
- ✅ Puedes ver TODOS los botones hasta el final
- ✅ El último botón tiene espacio debajo (no está cortado)
- ✅ El scroll no se traba a mitad

**Resultado Obtenido:**
```
[Escribe aquí: ¿Llegaste hasta el final? ¿Se trabó?]
```

---

## 🔐 SECCIÓN 2: LOGIN ONLINE Y GUARDADO DE CREDENCIALES

### ✅ PRUEBA 2.1: Login Online (CON INTERNET)

**Preparación:**
1. Asegúrate de tener conexión a internet (WiFi o datos)
2. Abre PowerShell y ejecuta:
   ```powershell
   adb logcat -c
   adb logcat -v time | findstr /R /C:"Encryption" /C:"AuthService" /C:"OfflineStorage" > prueba_2_1.txt
   ```
3. NO cierres PowerShell, déjalo corriendo

**Pasos:**
1. En la pantalla de login, ingresa tu usuario real
2. Ingresa tu contraseña real
3. Presiona "Iniciar Sesión"
4. Observa si te lleva a la pantalla principal

**Resultado Esperado:**
- ✅ Login exitoso (navegas a pantalla principal)
- ✅ No hay errores visibles
- ✅ La app funciona normalmente

**Resultado Obtenido:**
```
[Escribe aquí: ¿Login exitoso? ¿Algún error?]
```

**DESPUÉS DEL LOGIN:**
1. Presiona Ctrl+C en PowerShell para detener la captura
2. Abre el archivo `prueba_2_1.txt`
3. Busca las siguientes líneas (copia y pega aquí):

```
[Copia TODAS las líneas que contengan:]
- [Encryption] Iniciando encriptación...
- [Encryption] ✅ Password encrypted successfully
- [AuthService] Iniciando guardado de credenciales offline...
- [AuthService] ✅ Credenciales guardadas exitosamente
- [OfflineStorage] Credenciales guardadas...
```

---

### ✅ PRUEBA 2.2: Verificar Credenciales Guardadas

**Pasos:**
1. Estando en la pantalla principal (después del login)
2. Abre el Panel de Testing (botón 🔧)
3. En la sección "FASE 4: Login Offline", presiona:
   - **"✅ Ver Credenciales Guardadas"**

**Resultado Esperado:**
```
✅ Credenciales Guardadas

Usuario: [tu_usuario]
ID Usuario: [número]
Rol: [tu_rol]
ID Banco: [número]
Último Login: [fecha y hora]
```

**Resultado Obtenido:**
```
[Copia EXACTAMENTE lo que apareció en la alerta:]


```

**❌ Si sale "No hay credenciales guardadas":**
- ¡COPIA LOS LOGS de prueba_2_1.txt COMPLETOS!
- Esto significa que la encriptación o guardado falló

---

### ✅ PRUEBA 2.3: Validar Sesión Actual

**Pasos:**
1. En el Panel de Testing, presiona:
   - **"⏰ Validar Sesión Actual"**

**Resultado Esperado:**
```
✅ Sesión Válida

Expira en: 23 horas, XX minutos
Fecha de expiración: [fecha y hora de mañana]
```

**Resultado Obtenido:**
```
[Copia EXACTAMENTE lo que apareció:]


```

---

### ✅ PRUEBA 2.4: Último Login

**Pasos:**
1. En el Panel de Testing, presiona:
   - **"📅 Ver Último Login"**

**Resultado Esperado:**
```
📅 Último Login Registrado

Fecha: [hoy]
Hora: [hace unos minutos]
Hace X minutos
Hace 0 días
```

**Resultado Obtenido:**
```
[Copia EXACTAMENTE lo que apareció:]


```

---

## 🔒 SECCIÓN 3: ENCRIPTACIÓN

### ✅ PRUEBA 3.1: Test de Encriptación

**Pasos:**
1. En el Panel de Testing, en la sección "🔐 Encriptación"
2. Presiona: **"🔐 Probar Encriptación"**

**Resultado Esperado:**
```
✅ Test de Encriptación Exitoso

Original: test123
Encriptado: [string en Base64]
Desencriptado: test123
✅ CORRECTO: La contraseña coincide después de desencriptar
```

**Resultado Obtenido:**
```
[Copia EXACTAMENTE lo que apareció:]


```

---

## 📊 SECCIÓN 4: BASE DE DATOS

### ✅ PRUEBA 4.1: Info de Base de Datos

**Pasos:**
1. En el Panel de Testing, en la sección "💾 Base de Datos"
2. Presiona: **"📊 Ver Info de BD"**

**Resultado Esperado:**
```
📊 Información de Base de Datos

Credenciales: 1
Logs: [número > 0]
Jugadas Pendientes: 0
Loterías: 0
Horarios: 0
```

**Resultado Obtenido:**
```
[Copia EXACTAMENTE lo que apareció:]


```

---

### ✅ PRUEBA 4.2: Ver Logs del Sistema

**Pasos:**
1. En el Panel de Testing, presiona: **"👁️ Ver Últimos Logs"**
2. Lee los últimos 10 logs

**Resultado Esperado:**
- ✅ Se muestran 10 logs (o menos si hay menos de 10)
- ✅ Cada log tiene: nivel, mensaje, fecha/hora
- ✅ Hay logs relacionados con credenciales y encriptación

**Resultado Obtenido:**
```
[Copia los logs que aparecieron:]


```

---

## 🚫 SECCIÓN 5: LOGIN OFFLINE (Sin Internet)

### ✅ PRUEBA 5.1: Cerrar Sesión

**Pasos:**
1. En la pantalla principal, busca el botón de "Cerrar Sesión" o menú
2. Cierra la sesión
3. Deberías volver a la pantalla de login

**Resultado Esperado:**
- ✅ Vuelves a la pantalla de login
- ✅ Los campos están vacíos

**Resultado Obtenido:**
```
[¿Funcionó correctamente?]
```

---

### ✅ PRUEBA 5.2: Desactivar Internet

**Pasos:**
1. En tu teléfono, abre el panel de notificaciones
2. **Desactiva WiFi** (apaga)
3. **Desactiva Datos Móviles** (apaga)
4. Asegúrate de que el icono de internet desaparezca

**Confirmación:**
- ❌ Sin WiFi
- ❌ Sin datos móviles
- 🔴 Teléfono completamente offline

---

### ✅ PRUEBA 5.3: Intento de Login Online Sin Internet

**Preparación:**
1. Abre PowerShell:
   ```powershell
   adb logcat -c
   adb logcat -v time | findstr /R /C:"Encryption" /C:"AuthService" /C:"OfflineStorage" > prueba_5_3.txt
   ```

**Pasos:**
1. En la pantalla de login (sin internet)
2. Ingresa tu usuario
3. Ingresa tu contraseña
4. Presiona "Iniciar Sesión" (botón normal, NO el de offline)

**Resultado Esperado:**
- ❌ Aparece error: "No hay conexión a internet"
- ❌ NO navegas a la pantalla principal
- ✅ Te quedas en la pantalla de login

**Resultado Obtenido:**
```
[¿Qué pasó? ¿Mensaje de error?]
```

---

### ✅ PRUEBA 5.4: Login Offline (SIN INTERNET)

**Preparación:**
1. Confirma que el internet sigue desactivado
2. En PowerShell:
   ```powershell
   adb logcat -c
   adb logcat -v time | findstr /R /C:"Encryption" /C:"AuthService" /C:"OfflineStorage" > prueba_5_4.txt
   ```

**Pasos:**
1. En la pantalla de login (sin internet)
2. Ingresa tu usuario (el mismo que usaste en el login online)
3. Ingresa tu contraseña (la misma)
4. Presiona el botón "🔴 Login Offline" (debajo del botón normal)

**Resultado Esperado:**
- ✅ Login exitoso
- ✅ Navegas a la pantalla principal
- ✅ Puedes usar la app (con datos cacheados)
- ✅ Aparece indicador de "Modo Offline" en algún lugar

**Resultado Obtenido:**
```
[¿Login exitoso? ¿Navegaste a la pantalla principal? ¿Hay indicador de offline?]
```

**DESPUÉS DEL LOGIN:**
1. Presiona Ctrl+C en PowerShell
2. Abre `prueba_5_4.txt`
3. Busca líneas con:
   - `[Encryption] Iniciando desencriptación...`
   - `[Encryption] ✅ Password decrypted successfully`
   - `[AuthService] Login offline exitoso`

```
[Copia las líneas relevantes aquí:]


```

---

### ✅ PRUEBA 5.5: Contraseña Incorrecta Offline

**Pasos:**
1. Cierra sesión (si estás logueado)
2. Asegúrate de estar sin internet
3. Ingresa tu usuario correcto
4. Ingresa una contraseña **INCORRECTA** (ejemplo: "123456")
5. Presiona "🔴 Login Offline"

**Resultado Esperado:**
- ❌ Login fallido
- ❌ Mensaje de error: "Credenciales incorrectas"
- ❌ NO navegas a la pantalla principal

**Resultado Obtenido:**
```
[¿Qué mensaje apareció? ¿Te dejó entrar o no?]
```

---

### ✅ PRUEBA 5.6: Usuario No Existe Offline

**Pasos:**
1. En pantalla de login (sin internet)
2. Ingresa un usuario que **NO EXISTE** (ejemplo: "usuariofalso123")
3. Ingresa cualquier contraseña
4. Presiona "🔴 Login Offline"

**Resultado Esperado:**
- ❌ Login fallido
- ❌ Mensaje: "No hay credenciales guardadas para este usuario" o similar
- ❌ NO navegas a la pantalla principal

**Resultado Obtenido:**
```
[¿Qué mensaje apareció?]
```

---

## ⏱️ SECCIÓN 6: EXPIRACIÓN DE SESIÓN

### ✅ PRUEBA 6.1: Forzar Expiración

**Pasos:**
1. **Reactiva internet** en tu teléfono
2. Haz login online normal (con internet)
3. Abre el Panel de Testing
4. Presiona: **"⏱️ Forzar Expiración de Sesión"**
5. Lee el mensaje que aparece

**Resultado Esperado:**
```
⚠️ Sesión Expirada Forzadamente

La sesión fue configurada para expirar hace 25 horas.
Prueba ahora hacer login offline.
```

**Resultado Obtenido:**
```
[Copia el mensaje:]


```

---

### ✅ PRUEBA 6.2: Login Offline con Sesión Expirada

**Pasos:**
1. **Desactiva internet** de nuevo
2. Cierra sesión (si estás logueado)
3. Intenta hacer login offline con tus credenciales correctas

**Resultado Esperado:**
- ❌ Login fallido
- ❌ Mensaje: "Sesión expirada. Conéctate a internet para renovar."
- ❌ NO navegas a la pantalla principal

**Resultado Obtenido:**
```
[¿Qué mensaje apareció?]
```

---

### ✅ PRUEBA 6.3: Renovar Sesión Online

**Pasos:**
1. **Reactiva internet**
2. Haz login online normal (con tu usuario y contraseña)
3. Abre Panel de Testing
4. Verifica que la sesión sea válida: **"⏰ Validar Sesión Actual"**

**Resultado Esperado:**
- ✅ Login online exitoso
- ✅ Sesión válida por 24 horas nuevas

**Resultado Obtenido:**
```
[¿Cuántas horas dice que expira?]
```

---

## 🧹 SECCIÓN 7: LIMPIEZA Y RESET

### ✅ PRUEBA 7.1: Limpiar Credenciales

**Pasos:**
1. Estando logueado (con o sin internet)
2. Abre Panel de Testing
3. Presiona: **"🗑️ Limpiar Credenciales"**
4. Confirma la acción

**Resultado Esperado:**
```
✅ Credenciales Eliminadas

Todas las credenciales fueron borradas de la base de datos.
Deberás hacer login online de nuevo.
```

**Resultado Obtenido:**
```
[Copia el mensaje:]


```

---

### ✅ PRUEBA 7.2: Verificar Limpieza

**Pasos:**
1. En Panel de Testing
2. Presiona: **"✅ Ver Credenciales Guardadas"**

**Resultado Esperado:**
```
ℹ️ No Hay Credenciales

No hay credenciales guardadas.
Haz login online primero.
```

**Resultado Obtenido:**
```
[¿Qué mensaje apareció?]
```

---

### ✅ PRUEBA 7.3: Login Offline Sin Credenciales

**Pasos:**
1. **Desactiva internet**
2. Cierra sesión
3. Intenta login offline

**Resultado Esperado:**
- ❌ Login fallido
- ❌ Mensaje: "No hay credenciales guardadas"

**Resultado Obtenido:**
```
[¿Qué mensaje apareció?]
```

---

## 🧪 SECCIÓN 8: FUNCIONES AUXILIARES

### ✅ PRUEBA 8.1: Insertar Credenciales de Prueba

**Pasos:**
1. Abre Panel de Testing
2. Presiona: **"🧪 Insertar Credenciales de Prueba"**
3. Confirma la inserción

**Resultado Esperado:**
```
✅ Credenciales Insertadas

Usuario: test_user
Contraseña: test123
Rol: listero
ID Usuario: 999

NOTA: Login Offline NO funcionará con estas credenciales
ya que la contraseña no está encriptada correctamente.
Esto es solo para testing de lectura de BD.
```

**Resultado Obtenido:**
```
[¿Apareció el mensaje? ¿Hubo error?]
```

---

### ✅ PRUEBA 8.2: Ver Credenciales Fake

**Pasos:**
1. Después de insertar las fake
2. Presiona: **"✅ Ver Credenciales Guardadas"**

**Resultado Esperado:**
```
✅ Credenciales Guardadas

Usuario: test_user
ID Usuario: 999
Rol: listero
...
```

**Resultado Obtenido:**
```
[¿Apareció test_user?]
```

---

### ✅ PRUEBA 8.3: Limpiar Logs

**Pasos:**
1. Presiona: **"🗑️ Limpiar Logs"**
2. Confirma
3. Luego presiona: **"👁️ Ver Últimos Logs"**

**Resultado Esperado:**
```
ℹ️ No Hay Logs

No hay logs registrados aún.
```

**Resultado Obtenido:**
```
[¿Se limpiaron los logs?]
```

---

## 📝 RESUMEN DE RESULTADOS

### ✅ Funcionalidades que DEBEN funcionar:

- [ ] Panel de Testing abre correctamente
- [ ] Scroll del modal llega hasta el final
- [ ] Login online guarda credenciales (verificar con logs)
- [ ] Ver credenciales muestra datos correctos
- [ ] Encriptación funciona (test exitoso)
- [ ] Login offline funciona sin internet
- [ ] Login offline rechaza contraseña incorrecta
- [ ] Login offline rechaza usuario no existente
- [ ] Expiración de sesión funciona
- [ ] Login online renueva sesión expirada
- [ ] Limpiar credenciales funciona
- [ ] Base de datos muestra info correcta

### ❌ Funcionalidades con problemas:

```
[Lista aquí cualquier prueba que falló y describe qué pasó:]

1. 
2. 
3. 
```

---

## 📤 ENVIAR RESULTADOS

Por favor envía:

1. **Este documento completo** con todos los resultados llenados
2. **Archivos de logs:**
   - `prueba_2_1.txt` (login online)
   - `prueba_5_3.txt` (intento login online sin internet)
   - `prueba_5_4.txt` (login offline exitoso)
3. **Screenshots** de cualquier error o comportamiento extraño
4. **Comentarios adicionales** sobre la experiencia de uso

---

## 🎯 CRITERIOS DE ÉXITO

La FASE 4 se considera **EXITOSA** si:

✅ Al menos 10 de 12 pruebas principales pasan  
✅ Login online guarda credenciales (se ven en panel)  
✅ Login offline funciona sin internet  
✅ Encriptación funciona correctamente  
✅ Validación de contraseñas funciona  
✅ Expiración de sesión funciona  

---

**¡Gracias por tu ayuda con las pruebas! 🚀**
