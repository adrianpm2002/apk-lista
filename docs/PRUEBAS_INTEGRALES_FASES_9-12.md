# 🧪 PRUEBAS INTEGRALES: FASES 9, 10, 11 Y 12

## 📋 Descripción General

Este documento contiene pruebas integradas para validar el funcionamiento completo de las últimas fases del modo offline:

- **FASE 9**: Banners y Notificaciones
- **FASE 10**: Cambio de Día
- **FASE 11**: Sidebar - Modo Offline
- **FASE 12**: Optimizaciones y Pulido

---

## ✅ Archivos Implementados

### FASE 9
- ✅ `src/components/ConnectionBanner.js` - Banner compacto (44px)
- ✅ `App.js` - Banner integrado

### FASE 10
- ✅ `src/services/dayChangeService.js` - Detecta cambio y limpia TODAS las jugadas
- ✅ `App.js` - AppState listener

### FASE 11
- ✅ `src/components/SideBar.js` - Indicador offline + badge pendientes

### FASE 12
- ✅ `src/services/offlineStorageService.js` - Transacciones + recuperación
- ✅ `src/contexts/OfflineContext.js` - Validación sesión 24h
- ✅ `App.js` - Recuperación de jugadas interrumpidas

---

## 🎯 ESCENARIO 1: Flujo Completo de Conexión y Sincronización

**Objetivo**: Probar banners, sidebar y sincronización en un flujo realista

### Pasos:

1. **Estado Inicial Online**
   - Abrir app con WiFi activado
   - Verificar que NO aparece banner naranja
   - Abrir sidebar → Verificar que NO aparece indicador "📴 Modo Offline"

2. **Crear Jugadas Online**
   - Ir a Visual Mode
   - Crear 2 jugadas normales
   - Verificar que se guardan correctamente en Supabase

3. **Perder Conexión**
   - Desactivar WiFi/datos móviles
   - **✅ Verificar**: Banner naranja "📴 Sin conexión - Modo offline activado" aparece
   - **✅ Verificar**: Banner desaparece automáticamente después de 3 segundos
   - Abrir sidebar
   - **✅ Verificar**: Indicador naranja "📴 Modo Offline" visible en sidebar

4. **Crear Jugadas Offline**
   - Crear 3 jugadas en modo offline
   - **✅ Verificar**: Mensaje "Jugada guardada en cola" aparece
   - Abrir sidebar
   - **✅ Verificar**: Badge azul muestra "3" en "Registro Offline"

5. **Recuperar Conexión**
   - Activar WiFi/datos móviles
   - Esperar 2-3 segundos
   - **✅ Verificar**: Banner verde "📶 Conexión recuperada - 3 jugada(s) pendiente(s)" aparece
   - **✅ Verificar**: Botón "Sincronizar" visible
   - **✅ Verificar**: Banner NO desaparece automáticamente

6. **Sincronizar desde Banner**
   - Presionar botón "Sincronizar" en banner verde
   - **✅ Verificar**: Banner desaparece
   - **✅ Verificar**: Navega a OfflinePlayRegistryScreen
   - **✅ Verificar**: Lista muestra las 3 jugadas pendientes

7. **Enviar Todo**
   - Presionar "Enviar Todo"
   - **✅ Verificar**: Modal de confirmación muestra "3 jugadas - $XXX total"
   - Confirmar
   - **✅ Verificar**: Modal de progreso aparece
   - **✅ Verificar**: Barra de progreso avanza (1/3, 2/3, 3/3)
   - **✅ Verificar**: Delay de 100ms entre jugadas
   - Esperar finalización

8. **Post-Sincronización**
   - **✅ Verificar**: Notificación "3 jugadas enviadas" aparece
   - **✅ Verificar**: Jugadas cambian a estado "Enviada ✓" (verde)
   - Volver atrás, abrir sidebar
   - **✅ Verificar**: Badge desaparece (o muestra "0")
   - **✅ Verificar**: Indicador naranja NO visible (estamos online)

**Resultado Esperado**: Flujo completo sin errores, banners funcionando correctamente, sincronización exitosa

---

## 🎯 ESCENARIO 2: Cambio de Día - Limpieza Total

**Objetivo**: Validar que TODAS las jugadas se eliminan al cambiar el día

### Pasos:

1. **Preparación**
   - Crear 2 jugadas offline (estado: `pending`)
   - Conectar y sincronizar 1 jugada exitosamente (estado: `success`)
   - Crear 1 jugada con horario cerrado para que falle (estado: `failed`)
   - **Total**: 4 jugadas (1 pending + 1 success + 1 failed + 1 pending)

2. **Verificar Estado Actual**
   - Ir a OfflinePlayRegistryScreen
   - **✅ Verificar**: 4 jugadas visibles con diferentes estados

3. **Simular Cambio de Día**
   - Opción A: Cambiar fecha del sistema a mañana
   - Opción B: Usar React Native Debugger para modificar AsyncStorage:
     - Clave: `@offline_last_check_date`
     - Cambiar valor a fecha de ayer (ej: de `2025-12-04` a `2025-12-03`)

4. **Reabrir App**
   - Cerrar completamente la app
   - Volver a abrir
   - Revisar logs en consola

5. **Verificar Limpieza**
   - Logs esperados:
     ```
     [DayChangeService] 🔍 Verificando cambio de día...
     [DayChangeService] Verificando cambio de día: { today: '2025-12-04', lastCheckDate: '2025-12-03' }
     [DayChangeService] ✅ Detectado cambio de día
     [DayChangeService] 🗓️ Nuevo día detectado, ejecutando limpieza TOTAL...
     [DayChangeService] Total de jugadas antes de limpieza: 4
     [DayChangeService] ✅ Jugadas eliminadas: 4
     [DayChangeService] Jugadas restantes (del día actual): 0
     ```

6. **Verificar en UI**
   - Ir a OfflinePlayRegistryScreen
   - **✅ Verificar**: TODAS las jugadas desaparecieron
   - **✅ Verificar**: Mensaje "No hay jugadas offline registradas"
   - Abrir sidebar
   - **✅ Verificar**: Badge NO visible (0 pendientes)

**Resultado Esperado**: Base de datos limpia completamente, sin jugadas del día anterior

---

## 🎯 ESCENARIO 3: Interrupción de Sincronización

**Objetivo**: Validar recuperación de jugadas interrumpidas (FASE 12.3)

### Pasos:

1. **Preparación**
   - Estar online
   - Crear 5 jugadas offline
   - Ir a OfflinePlayRegistryScreen

2. **Iniciar Sincronización**
   - Presionar "Enviar Todo"
   - Confirmar
   - Modal de progreso aparece
   - Esperar que llegue a 2/5 o 3/5 (progreso parcial)

3. **Interrumpir App**
   - **Importante**: NO presionar "Cerrar" ni "Cancelar"
   - Cerrar la app completamente:
     - Android: Deslizar desde multitarea
     - iOS: Doble tap home y cerrar
   - O forzar cierre desde configuración del dispositivo

4. **Estado en Base de Datos**
   - En este momento, algunas jugadas están en `status='sending'`
   - Otras en `status='pending'`
   - Algunas pueden estar en `status='success'` si ya se enviaron

5. **Reabrir App**
   - Abrir app nuevamente
   - Revisar logs en consola

6. **Verificar Recuperación**
   - Logs esperados:
     ```
     [App] 🔄 Recovering interrupted plays...
     [OfflineStorage] 🔄 Verificando jugadas interrumpidas...
     [OfflineStorage] ⚠️ Encontradas X jugadas interrumpidas
     [OfflineStorage] ✅ Recuperadas X jugadas interrumpidas
     [App] ✅ Recovered X interrupted plays
     ```

7. **Verificar en UI**
   - Ir a OfflinePlayRegistryScreen
   - **✅ Verificar**: Jugadas que estaban en `sending` ahora están en `pending`
   - **✅ Verificar**: Jugadas `success` siguen siendo `success`
   - **✅ Verificar**: Botón "Enviar ahora" disponible para las recuperadas

8. **Re-sincronizar**
   - Presionar "Enviar Todo" nuevamente
   - **✅ Verificar**: Solo envía las jugadas `pending` (las recuperadas + las que no se enviaron)
   - **✅ Verificar**: NO intenta re-enviar las `success`

**Resultado Esperado**: App robusta ante interrupciones, jugadas recuperadas automáticamente

---

## 🎯 ESCENARIO 4: Expiración de Sesión (24 horas)

**Objetivo**: Validar cierre automático después de 24 horas offline (FASE 12.2)

### Pasos:

1. **Login Online**
   - Iniciar sesión con credenciales válidas
   - Verificar login exitoso

2. **Modo Offline**
   - Desconectar WiFi/datos móviles
   - Cerrar app

3. **Simular Paso del Tiempo**
   - Opción A: Cambiar hora del sistema +25 horas (ej: de 10:00 del 4/12 a 11:00 del 5/12)
   - Opción B: Esperar realmente 24+ horas (no práctico para testing)

4. **Reabrir App Offline**
   - Abrir app sin conexión
   - Intentar navegar

5. **Verificar Validación**
   - Logs esperados:
     ```
     [OfflineContext] ⚠️ Sesión offline expirada (>24h)
     ```

6. **Comportamiento Esperado**
   - **Opción 1**: Si está implementado el callback `onSessionExpired`:
     - **✅ Verificar**: Redirect automático a LoginScreen
     - **✅ Verificar**: Mensaje "Sesión expirada. Inicie sesión nuevamente"
   
   - **Opción 2**: Si solo hay logging (implementación actual):
     - **✅ Verificar**: Log en consola indicando sesión expirada
     - **⚠️ Nota**: Usuario puede seguir usando la app (a mejorar en futuro)

7. **Restaurar Conexión y Re-login**
   - Restaurar hora del sistema (volver a la correcta)
   - Activar WiFi
   - Hacer login nuevamente
   - **✅ Verificar**: Login exitoso
   - **✅ Verificar**: Nueva sesión de 24h comienza

**Resultado Esperado**: Sistema detecta y valida expiración de sesión

---

## 🎯 ESCENARIO 5: Transacciones SQLite (Atomicidad)

**Objetivo**: Validar que las transacciones hacen rollback en caso de error (FASE 12.1)

### Pasos:

1. **Preparación**
   - Tener app con base de datos limpia
   - Estar offline

2. **Intentar Guardar 10 Jugadas con Función de Transacción**
   - Esta prueba requiere código de testing o modificación temporal
   - En una pantalla de jugadas, intentar usar `saveMultiplePlaysTransaction([...10 jugadas...])`

3. **Escenario Exitoso**
   - Si todas las jugadas son válidas:
   - **✅ Verificar**: Log muestra "💾 Guardando 10 jugadas en transacción..."
   - **✅ Verificar**: Log muestra "✅ Transacción completada exitosamente"
   - **✅ Verificar**: Todas las 10 jugadas aparecen en la base de datos

4. **Escenario con Error (Simular)**
   - Modificar temporalmente `saveMultiplePlaysTransaction` para que la jugada #5 cause error
   - Por ejemplo, forzar `id_loteria = null` en la jugada 5
   - Intentar guardar las 10 jugadas

5. **Verificar Rollback**
   - **✅ Verificar**: Log muestra "❌ Error en transacción: ..."
   - **✅ Verificar**: NINGUNA de las 10 jugadas se guarda (rollback total)
   - **✅ Verificar**: Base de datos queda en estado consistente (no hay jugadas parciales)

6. **Consultar Base de Datos**
   - Ir a OfflinePlayRegistryScreen
   - **✅ Verificar**: Lista vacía (porque hubo rollback)
   - O usar función `getDatabaseInfo()` para ver count de jugadas = 0

**Resultado Esperado**: Transacciones garantizan atomicidad (todo o nada)

---

## 🎯 ESCENARIO 6: Sidebar - Estados Visuales

**Objetivo**: Probar todos los estados del sidebar en diferentes condiciones

### Pasos:

1. **Online Sin Jugadas Pendientes**
   - Estar online (WiFi activado)
   - Sin jugadas pendientes
   - Abrir sidebar
   - **✅ Verificar**: NO aparece indicador naranja "📴 Modo Offline"
   - **✅ Verificar**: Opción "Registro Offline" visible pero SIN badge
   - **✅ Verificar**: Todas las opciones normales disponibles

2. **Online Con Jugadas Pendientes**
   - Crear 5 jugadas offline
   - Reconectar WiFi (sin sincronizar)
   - Abrir sidebar
   - **✅ Verificar**: NO aparece indicador naranja (estamos online)
   - **✅ Verificar**: Badge azul muestra "5" en "Registro Offline"
   - Presionar opción "Registro Offline"
   - **✅ Verificar**: Navega correctamente y muestra las 5 jugadas

3. **Offline Sin Jugadas**
   - Desconectar WiFi
   - Sin jugadas pendientes
   - Abrir sidebar
   - **✅ Verificar**: Indicador naranja "📴 Modo Offline" visible
   - **✅ Verificar**: Badge NO visible (0 pendientes)

4. **Offline Con Jugadas**
   - Estar offline
   - Crear 3 jugadas
   - Abrir sidebar
   - **✅ Verificar**: Indicador naranja "📴 Modo Offline" visible
   - **✅ Verificar**: Badge muestra "3"
   - **✅ Verificar**: Ambos elementos coexisten sin superposición

5. **Después de Sincronizar**
   - Reconectar WiFi
   - Sincronizar las 3 jugadas exitosamente
   - Abrir sidebar
   - **✅ Verificar**: Indicador naranja desaparece
   - **✅ Verificar**: Badge desaparece (0 pendientes)

**Resultado Esperado**: Sidebar refleja correctamente todos los estados

---

## 🎯 ESCENARIO 7: Banner - Todos los Estados

**Objetivo**: Probar todos los comportamientos del banner

### Pasos:

1. **Banner Offline - Auto Dismiss**
   - Estar online
   - Desconectar WiFi
   - **✅ Verificar**: Banner naranja aparece desde arriba con animación
   - **✅ Verificar**: Texto: "Sin conexión - Modo offline activado"
   - **✅ Verificar**: Icono: 📴
   - **✅ Verificar**: Color: #FF9800 (naranja)
   - **✅ Verificar**: Altura compacta (~44px)
   - Esperar 3 segundos
   - **✅ Verificar**: Banner desaparece automáticamente con animación

2. **Banner Online - Sin Pendientes**
   - Estar offline sin jugadas
   - Reconectar WiFi
   - **✅ Verificar**: NO aparece banner verde
   - **✅ Verificar**: Si había banner naranja, desaparece

3. **Banner Online - Con Pendientes**
   - Estar offline con 3 jugadas pendientes
   - Reconectar WiFi
   - **✅ Verificar**: Banner verde aparece
   - **✅ Verificar**: Texto: "Conexión recuperada - 3 jugada(s) pendiente(s)"
   - **✅ Verificar**: Icono: 📶
   - **✅ Verificar**: Color: #4CAF50 (verde)
   - **✅ Verificar**: Botón "Sincronizar" visible
   - **✅ Verificar**: Botón "✕" (cerrar) visible
   - Esperar más de 3 segundos
   - **✅ Verificar**: Banner NO desaparece (permanece)

4. **Botón Sincronizar**
   - Con banner verde visible
   - Presionar "Sincronizar"
   - **✅ Verificar**: Banner desaparece con animación
   - **✅ Verificar**: Navega a OfflinePlayRegistryScreen

5. **Botón Cerrar**
   - Reconectar para que aparezca banner verde
   - Presionar botón "✕"
   - **✅ Verificar**: Banner desaparece con animación
   - **✅ Verificar**: No reaparece hasta siguiente cambio de conexión

6. **Banner y Notch/Status Bar**
   - En dispositivo con notch (iPhone X+, Android moderno)
   - Mostrar banner
   - **✅ Verificar**: Banner no se superpone con notch
   - **✅ Verificar**: Todo el texto e iconos visibles

7. **Z-Index**
   - Con cualquier pantalla con contenido
   - Mostrar banner
   - **✅ Verificar**: Banner siempre visible sobre todo el contenido
   - **✅ Verificar**: No bloqueado por otros elementos

**Resultado Esperado**: Banner funciona perfectamente en todos los escenarios

---

## 🎯 ESCENARIO 8: Integración Completa End-to-End

**Objetivo**: Simular un día completo de uso con todos los elementos integrados

### Historia del Usuario:

**Lunes 9:00 AM - Inicio del día**
1. Usuario abre la app con conexión
2. **✅ Verificar**: No hay banner, no hay jugadas pendientes
3. Usuario crea 5 jugadas normales online
4. **✅ Verificar**: Jugadas guardadas en Supabase inmediatamente

**Lunes 10:00 AM - Pérdida de señal**
5. Usuario va a un lugar sin señal
6. Banner naranja aparece y desaparece
7. **✅ Verificar**: Sidebar muestra indicador offline
8. Usuario crea 3 jugadas offline
9. **✅ Verificar**: Guardadas en SQLite con status='pending'
10. **✅ Verificar**: Badge en sidebar muestra "3"

**Lunes 11:30 AM - Intento de sincronización fallido**
11. Usuario llega a lugar con señal débil
12. Banner verde aparece
13. Usuario presiona "Sincronizar"
14. Durante sincronización, señal se pierde
15. App se cierra (batería baja)
16. **Estado**: 1 jugada en 'success', 1 en 'sending', 1 en 'pending'

**Lunes 12:00 PM - Recuperación**
17. Usuario carga teléfono y abre app
18. **✅ Verificar**: Log "Recovered 1 interrupted plays"
19. **✅ Verificar**: Jugada 'sending' cambió a 'pending'
20. Usuario tiene señal estable
21. Sincroniza las 2 pendientes exitosamente
22. **✅ Verificar**: Todas las jugadas del día enviadas

**Martes 8:00 AM - Nuevo día**
23. Usuario abre app al día siguiente
24. **✅ Verificar**: Log "Detectado cambio de día"
25. **✅ Verificar**: Log "Jugadas eliminadas: 3" (las del lunes)
26. **✅ Verificar**: Registro offline vacío
27. Usuario comienza nuevo día sin jugadas antiguas

**Resultado Esperado**: Sistema funciona perfectamente en escenario real complejo

---

## 📊 Checklist de Validación Final

### FASE 9: Banners y Notificaciones
- [ ] Banner naranja aparece al perder conexión
- [ ] Banner naranja auto-dismiss en 3 segundos
- [ ] Banner verde aparece al reconectar con pendientes
- [ ] Banner verde NO aparece si no hay pendientes
- [ ] Botón "Sincronizar" navega correctamente
- [ ] Botón "✕" cierra el banner
- [ ] Tamaño compacto (~44px) no invade pantalla
- [ ] No hay problemas con notch/status bar

### FASE 10: Cambio de Día
- [ ] Detecta cambio de día al abrir app
- [ ] Detecta cambio de día al volver de background
- [ ] Elimina TODAS las jugadas del día anterior
- [ ] Preserva solo jugadas del día actual
- [ ] Logs claros y detallados
- [ ] AsyncStorage actualizado correctamente

### FASE 11: Sidebar - Modo Offline
- [ ] Indicador naranja aparece cuando offline
- [ ] Indicador desaparece cuando online
- [ ] Badge muestra número correcto de pendientes
- [ ] Badge desaparece cuando no hay pendientes
- [ ] Navegación a Registro Offline funciona
- [ ] Indicador + Badge coexisten sin problemas

### FASE 12: Optimizaciones
- [ ] Recuperación de jugadas interrumpidas funciona
- [ ] Transacciones SQLite con rollback correcto
- [ ] Validación de sesión 24h ejecuta cada hora
- [ ] Log de sesión expirada aparece después de 24h
- [ ] Base de datos mantiene consistencia

---

## 🐛 Problemas Conocidos y Soluciones

### Problema: Banner no desaparece automáticamente
**Solución**: Verificar que el timer se limpie correctamente en useEffect

### Problema: Badge no actualiza después de sincronizar
**Solución**: Verificar que `loadPendingPlays()` se llame después de sync

### Problema: Jugadas no se recuperan después de interrupción
**Solución**: Verificar que `recoverInterruptedPlays()` se ejecute en App.js

### Problema: Limpieza de día no funciona
**Solución**: Verificar AsyncStorage y query SQL sin filtro de status

### Problema: Sesión no expira después de 24h
**Solución**: Verificar cálculo de horas y timestamp en SQLite

---

## ✅ Resumen de Implementación

**Total de Funcionalidades**: 4 fases completas (9, 10, 11, 12)
**Archivos Modificados**: 6
**Nuevas Funciones**: 4
**Líneas de Código**: ~500
**Escenarios de Prueba**: 8
**Tests Individuales**: 50+

**Estado**: ✅ LISTO PARA PRUEBAS INTEGRALES

