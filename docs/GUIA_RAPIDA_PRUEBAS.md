# 🚀 GUÍA RÁPIDA - Pruebas FASE 4

## 📥 DESCARGA APK
**Link:** https://expo.dev/accounts/lazaroadrian0803/projects/apk-lista-clean-2024/builds/26738ee1-724c-4dc1-9bd3-8176667c0526

---

## 🎯 PRUEBAS PRINCIPALES (En orden)

### 1️⃣ **Login Online + Guardar Credenciales**
- ✅ Hacer login con usuario real (CON internet)
- ✅ Abrir Panel Testing → "Ver Credenciales"
- ✅ Debe mostrar tu usuario, no "No hay credenciales"

### 2️⃣ **Verificar Encriptación**
- ✅ Panel Testing → "Probar Encriptación"
- ✅ Debe decir "✅ CORRECTO"

### 3️⃣ **Login Offline**
- ✅ Cerrar sesión
- ✅ Desactivar WiFi + Datos móviles
- ✅ Login con botón "🔴 Login Offline"
- ✅ Debe entrar a la app

### 4️⃣ **Contraseña Incorrecta Offline**
- ✅ Sin internet
- ✅ Login offline con contraseña incorrecta
- ✅ Debe rechazar

### 5️⃣ **Expiración de Sesión**
- ✅ Con internet, hacer login
- ✅ Panel Testing → "Forzar Expiración"
- ✅ Sin internet, login offline
- ✅ Debe rechazar por sesión expirada

---

## 📊 CAPTURA DE LOGS

**Antes de cada prueba principal, ejecuta:**

```powershell
adb logcat -c
adb logcat -v time | findstr /R /C:"Encryption" /C:"AuthService" /C:"OfflineStorage" > prueba_X.txt
```

Presiona Ctrl+C después de cada prueba y guarda el archivo.

---

## ❌ SI ALGO FALLA

### "No hay credenciales guardadas" después de login online:
- 📋 Envía el archivo `prueba_X.txt` del login
- 🔍 Busca líneas con [Encryption] y [AuthService]

### Login offline no funciona:
- 📋 Envía logs del login offline
- ❓ ¿Qué mensaje de error apareció?

### Scroll del modal se traba:
- 📸 Toma screenshot
- ❓ ¿Hasta dónde llega el scroll?

---

## 📤 QUÉ ENVIARME

1. ✅ Documento PRUEBAS_COMPLETAS_FASE_4.md llenado
2. 📄 Archivos de logs (.txt)
3. 📸 Screenshots de errores
4. 💬 Comentarios generales

---

## ✅ ÉXITO = 10/12 pruebas pasadas + logs correctos

¡Gracias! 🙌
