# 🧪 FASE 9: BANNERS Y NOTIFICACIONES - GUÍA DE PRUEBAS

## ✅ Resumen de Implementación

### Componentes Actualizados
- ✅ `ConnectionBanner.js` - Banner animado de conexión
- ✅ `App.js` - Banner integrado en NavigationContainer
- ✅ `OfflineContext.js` - Ya expone pendingPlays

## 📋 PRUEBAS OBLIGATORIAS

### **Prueba 9.1: Banner Offline (Auto-dismiss)**

**Objetivo**: Verificar que se muestre banner naranja al perder conexión y se oculte automáticamente

**Pasos**:
1. Abrir la app con WiFi activado
2. Desactivar WiFi/datos móviles
3. **Resultado Esperado**:
   - ✅ Banner naranja aparece desde arriba con animación
   - ✅ Texto: "Sin conexión" / "Modo offline activado"
   - ✅ Icono: 📴
   - ✅ Banner desaparece automáticamente después de 3 segundos

**Logs a verificar**:
```
[ConnectionBanner] Estado: { isOnline: false, bannerType: null, pendingCount: 0 }
[ConnectionBanner] 📴 Mostrando banner offline
[ConnectionBanner] Auto-dismiss banner offline
```

---

### **Prueba 9.2: Banner Online sin Pendientes**

**Objetivo**: Verificar que NO se muestre banner al reconectar si no hay jugadas pendientes

**Pasos**:
1. Estar offline sin jugadas pendientes
2. Activar WiFi/datos móviles
3. **Resultado Esperado**:
   - ✅ NO aparece banner verde
   - ✅ Banner naranja desaparece si aún estaba visible

**Logs a verificar**:
```
[ConnectionBanner] Estado: { isOnline: true, bannerType: 'offline', pendingCount: 0 }
[ConnectionBanner] Sin pendientes, ocultando banner
```

---

### **Prueba 9.3: Banner Online con Pendientes (Persistente)**

**Objetivo**: Verificar que se muestre banner verde al reconectar con jugadas pendientes

**Pre-requisito**: Crear al menos 2 jugadas offline

**Pasos**:
1. Estar offline, crear 2 jugadas offline
2. Activar WiFi/datos móviles
3. **Resultado Esperado**:
   - ✅ Banner verde aparece desde arriba
   - ✅ Texto: "Conexión recuperada" / "2 jugada(s) pendiente(s)"
   - ✅ Icono: 📶
   - ✅ Botón "Sincronizar" visible
   - ✅ Botón "✕" (cerrar) visible
   - ✅ Banner NO desaparece automáticamente (permanece hasta acción del usuario)

**Logs a verificar**:
```
[ConnectionBanner] Estado: { isOnline: true, bannerType: 'offline', pendingCount: 2 }
[ConnectionBanner] ✅ Mostrando banner online con 2 pendientes
```

---

### **Prueba 9.4: Botón Sincronizar (Navegación)**

**Objetivo**: Verificar que el botón "Sincronizar" navegue correctamente

**Pre-requisito**: Banner verde visible con pendientes

**Pasos**:
1. Tener banner verde visible
2. Presionar botón "Sincronizar"
3. **Resultado Esperado**:
   - ✅ Banner desaparece con animación
   - ✅ Navega a OfflinePlayRegistryScreen
   - ✅ Lista de jugadas pendientes visible

---

### **Prueba 9.5: Botón Cerrar Banner**

**Objetivo**: Verificar que el botón "✕" cierre el banner

**Pre-requisito**: Banner verde visible

**Pasos**:
1. Tener banner verde visible
2. Presionar botón "✕"
3. **Resultado Esperado**:
   - ✅ Banner desaparece con animación
   - ✅ Banner no reaparece (hasta siguiente cambio de conexión)

---

### **Prueba 9.6: Ciclo Completo Offline → Online → Sync**

**Objetivo**: Probar el flujo completo desde perder conexión hasta sincronizar

**Pasos**:
1. Desactivar WiFi
   - ✅ Banner naranja: "Sin conexión"
   - ✅ Auto-dismiss después de 3s
2. Crear 3 jugadas offline
3. Activar WiFi
   - ✅ Banner verde: "3 jugada(s) pendiente(s)"
   - ✅ Botón "Sincronizar" visible
4. Presionar "Sincronizar"
   - ✅ Navega a Registro Offline
5. Presionar "Enviar Todo"
   - ✅ Modal de sincronización se abre
   - ✅ Progreso muestra 3/3
6. Esperar sincronización completa
   - ✅ Todas las jugadas enviadas
7. Volver atrás y desconectar WiFi nuevamente
   - ✅ Banner naranja aparece
8. Reconectar WiFi
   - ✅ Banner verde NO aparece (porque no hay pendientes)

---

### **Prueba 9.7: Banner con Notch/StatusBar**

**Objetivo**: Verificar que el banner no se superponga con el notch

**Pasos**:
1. Probar en dispositivo con notch (iPhone X+, Android moderno)
2. Mostrar banner naranja
3. **Resultado Esperado**:
   - ✅ Banner comienza debajo del notch/status bar
   - ✅ Texto e iconos completamente visibles
   - ✅ No hay superposición

**Nota**: El banner no tiene paddingTop específico. Si hay problemas, ajustar:
```javascript
// En ConnectionBanner.js, styles.banner
paddingTop: Platform.OS === 'ios' ? 44 : 0, // Ajustar según dispositivo
```

---

### **Prueba 9.8: Z-Index y Superposición**

**Objetivo**: Verificar que el banner esté siempre visible sobre otros elementos

**Pasos**:
1. Estar en cualquier pantalla con contenido
2. Desactivar WiFi → banner naranja aparece
3. **Resultado Esperado**:
   - ✅ Banner visible sobre todo contenido
   - ✅ Banner no bloqueado por otros elementos
   - ✅ zIndex: 9999 funcionando correctamente

---

## 🐛 Problemas Conocidos y Soluciones

### Problema 1: Banner no aparece
**Síntomas**: No se ve ningún banner al cambiar conexión
**Causas posibles**:
- NavigationContainer no envuelve ConnectionBanner
- OfflineContext no disponible
**Solución**: Verificar que ConnectionBanner esté dentro de NavigationContainer en App.js

### Problema 2: Banner no se oculta automáticamente
**Síntomas**: Banner naranja permanece más de 3 segundos
**Causas posibles**:
- Timer no se limpia correctamente
**Solución**: Verificar que useEffect retorne cleanup del timer

### Problema 3: Banner verde no muestra pendientes
**Síntomas**: Banner verde aparece pero dice "0 jugada(s)"
**Causas posibles**:
- pendingPlays no actualizado en OfflineContext
- loadPendingPlays() no llamado después de sincronización
**Solución**: Verificar que syncService llame a context.loadPendingPlays() después de sync

### Problema 4: Navegación no funciona
**Síntomas**: Error al presionar "Sincronizar"
**Causas posibles**:
- Ruta 'OfflinePlayRegistry' no registrada
- useNavigation() fuera de NavigationContainer
**Solución**: Verificar AppNavigator.js incluye la ruta

---

## ✅ Checklist Final

Antes de marcar FASE 9 como completa, verificar:

- [ ] Prueba 9.1 ✅ (Banner offline auto-dismiss)
- [ ] Prueba 9.2 ✅ (No banner si no hay pendientes)
- [ ] Prueba 9.3 ✅ (Banner online con pendientes)
- [ ] Prueba 9.4 ✅ (Navegación desde banner)
- [ ] Prueba 9.5 ✅ (Cerrar banner manualmente)
- [ ] Prueba 9.6 ✅ (Ciclo completo)
- [ ] Prueba 9.7 ✅ (Compatibilidad notch)
- [ ] Prueba 9.8 ✅ (Z-index correcto)

---

## 📊 Resultados Esperados

Todos los tests deben pasar sin errores. Si algún test falla, reportar:
1. Número de prueba
2. Paso específico que falló
3. Comportamiento observado vs esperado
4. Logs relevantes de consola
5. Plataforma (iOS/Android) y versión

---

## 🎯 Estado Actual

**FASE 9**: ✅ IMPLEMENTADA - Pendiente de pruebas

**Archivos Modificados**:
- ✅ `src/components/ConnectionBanner.js` - Mejoras en lógica y logs
- ✅ `App.js` - Banner integrado en NavigationContainer

**Siguiente Fase**: FASE 10 - Day Change Handler

