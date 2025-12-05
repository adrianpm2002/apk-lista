# 🧪 FASE 13: TESTING INTEGRAL - MODO OFFLINE

## 📋 Objetivo

Validar el funcionamiento completo del sistema offline mediante escenarios realistas que cubren todos los casos de uso posibles.

---

## ✅ Pre-requisitos

Antes de iniciar las pruebas, verificar:

- [ ] Todas las FASES 1-12 implementadas
- [ ] App instalada en dispositivo físico (Android/iOS)
- [ ] Cuenta de prueba con rol `listero`
- [ ] Acceso a configuración de red del dispositivo
- [ ] Capacidad de cambiar fecha/hora del sistema
- [ ] Logs de consola visibles (React Native Debugger o adb logcat)

---

## 🎯 ESCENARIO 1: Flujo Completo Offline

**Objetivo**: Validar el flujo completo desde login hasta sincronización

**Duración estimada**: 15-20 minutos

### Pre-condiciones
- App instalada sin datos previos
- Conexión WiFi/datos móviles activos
- Dispositivo con fecha/hora correctas

### Pasos

#### 1.1 - Login Online (Día 1 - 9:00 AM)
1. Abrir app
2. Iniciar sesión con credenciales válidas
   - Usuario: `listero1`
   - Password: `password123`
3. **✅ Verificar**:
   - Login exitoso
   - Navegación a MainAppScreen
   - No hay banner visible
   - Sidebar sin indicador offline

**Logs esperados**:
```
[AuthService] Login exitoso
[OfflineStorage] Credenciales guardadas en SQLite
[OfflineContext] isOnline: true
```

#### 1.2 - Crear Jugadas Online
4. Ir a **Visual Mode**
5. Crear 3 jugadas normales:
   - Jugada 1: Fijo 45 - $100 - Nueva York Tarde
   - Jugada 2: Corrido 12 - $50 - Leidsa Mediodía
   - Jugada 3: Parle 45-12-89 - $200 - King Lottery Noche
6. **✅ Verificar**:
   - Mensaje "Jugada guardada correctamente"
   - Sin indicador de "guardada en cola"
   - Jugadas visibles en JugadasScreen
   - Guardadas en Supabase (verificar en dashboard)

**Logs esperados**:
```
[PlaySubmission] Enviando jugada online...
[Supabase] INSERT exitoso - tabla: jugada
```

#### 1.3 - Perder Conexión (9:30 AM)
7. Desactivar **WiFi** y **Datos móviles**
8. Esperar 2-3 segundos
9. **✅ Verificar**:
   - Banner naranja aparece: "📴 Sin conexión - Modo offline activado"
   - Banner desaparece automáticamente después de 3 segundos
   - Abrir sidebar → Indicador naranja "📴 Modo Offline" visible
   - Badge de pendientes NO visible (todavía)

**Logs esperados**:
```
[ConnectionService] Conexión perdida
[OfflineContext] isOnline: false
[ConnectionBanner] 📴 Mostrando banner offline
[ConnectionBanner] Auto-dismiss banner offline
```

#### 1.4 - Crear Jugadas Offline
10. Ir a **Visual Mode**
11. Crear 5 jugadas offline:
    - Jugada 4: Fijo 23 - $100 - Nueva York Tarde
    - Jugada 5: Fijo 78 - $50 - Leidsa Mediodía
    - Jugada 6: Corrido 56 - $75 - King Lottery Noche
    - Jugada 7: Parle 12-34-56 - $150 - Nueva York Tarde
    - Jugada 8: Fijo 99 - $200 - Leidsa Mediodía

12. **✅ Verificar** cada jugada:
    - Mensaje: "Jugada guardada en cola offline"
    - NO aparece en JugadasScreen del servidor
    - Sidebar badge incrementa: 1 → 2 → 3 → 4 → 5

**Logs esperados**:
```
[OfflinePlaySubmission] Guardando jugada offline...
[OfflineStorage] INSERT en offline_plays - status: pending
[OfflineContext] pendingPlays count: 5
```

#### 1.5 - Ver Registro Offline
13. Abrir **Sidebar**
14. **✅ Verificar**:
    - Badge muestra "5" en "📱 Registro Offline"
    - Indicador naranja sigue visible
15. Presionar "📱 Registro Offline"
16. **✅ Verificar en OfflinePlayRegistryScreen**:
    - Header muestra:
      - Pendientes: 5
      - Exitosas: 0
      - Fallidas: 0
      - Total: $575
    - 5 jugadas visibles con estado "Pendiente ⏳" (amarillo)
    - Cada jugada muestra: números, tipo, monto, lotería, horario
    - Botón "📤 Enviar Todo (5)" visible y habilitado
    - Botón "Limpiar exitosas" deshabilitado (0 exitosas)

#### 1.6 - Recuperar Conexión (10:00 AM)
17. Activar **WiFi** o **Datos móviles**
18. Esperar 3-5 segundos
19. **✅ Verificar**:
    - Banner verde aparece: "📶 Conexión recuperada - 5 jugada(s) pendiente(s)"
    - Botón "Sincronizar" visible
    - Botón "✕" (cerrar) visible
    - Banner NO desaparece automáticamente

**Logs esperados**:
```
[ConnectionService] Conexión restaurada
[OfflineContext] isOnline: true
[ConnectionBanner] ✅ Mostrando banner online con 5 pendientes
```

#### 1.7 - Sincronizar desde Banner
20. Presionar botón **"Sincronizar"** en banner verde
21. **✅ Verificar**:
    - Banner desaparece con animación
    - Navega a OfflinePlayRegistryScreen
    - Lista de 5 jugadas visible

22. Presionar **"📤 Enviar Todo (5)"**
23. **✅ Verificar modal de confirmación**:
    - Título: "🔄 Sincronizar jugadas"
    - Mensaje: "5 jugada(s) pendiente(s) - Total: RD$575.00"
    - Botón "Cancelar"
    - Botón "Sincronizar"

24. Presionar **"Sincronizar"**
25. **✅ Verificar modal de progreso**:
    - Título: "Sincronizando jugadas"
    - Barra de progreso: 0% → 20% → 40% → 60% → 80% → 100%
    - Progreso: "1/5" → "2/5" → "3/5" → "4/5" → "5/5"
    - Mensaje: "⏳ Procesando... No cierres esta pantalla"
    - Lista en tiempo real mostrando cada jugada:
      - Estado inicial: Procesando (icono ⏳)
      - Estado final: Enviada ✓ (icono verde) o Error ❌ (icono rojo)
    - Delay de ~100ms entre jugadas (se nota el progreso)

**Logs esperados**:
```
[SyncService] Iniciando sincronización de jugadas...
[SyncService] 5 jugadas pendientes encontradas
[OfflineStorage] UPDATE offline_plays - id: 1, status: 'sending'
[SyncService] Enviando a Supabase: { jugada: 'fijo', numeros: '23', ... }
[Supabase] INSERT exitoso
[OfflineStorage] UPDATE offline_plays - id: 1, status: 'success'
[SyncService] ✅ Jugada 1 sincronizada
... (repetir para jugadas 2-5)
[SyncService] ✅ Sincronización completada - 5 exitosas, 0 fallidas
```

#### 1.8 - Post-Sincronización
26. Esperar a que termine la sincronización
27. **✅ Verificar alerta final**:
    - Título: "✅ Éxito"
    - Mensaje: "5 jugada(s) sincronizada(s) correctamente"
    - Botón "OK"

28. Presionar **"OK"**
29. **✅ Verificar en OfflinePlayRegistryScreen**:
    - Header actualizado:
      - Pendientes: 0
      - Exitosas: 5
      - Fallidas: 0
      - Total: $575
    - 5 jugadas con estado "Enviada ✓" (verde)
    - Sin botones de acción en las jugadas exitosas
    - Botón "Limpiar exitosas" habilitado

30. Volver atrás, abrir **Sidebar**
31. **✅ Verificar**:
    - Badge desaparece (0 pendientes)
    - Indicador naranja NO visible (estamos online)

32. Ir a **JugadasScreen** (del servidor)
33. **✅ Verificar**:
    - Las 5 jugadas offline ahora visibles
    - Junto con las 3 jugadas creadas online inicialmente
    - Total: 8 jugadas en el sistema

34. Verificar en **Dashboard de Supabase**:
    - Tabla `jugada` tiene 8 registros nuevos
    - Timestamps correctos (hora de creación offline + hora de sincronización)

### Resultado Esperado

✅ **ESCENARIO EXITOSO** si:
- Banner offline/online funcionan correctamente
- Jugadas offline se guardan en SQLite
- Sincronización envía todas las jugadas
- Estados actualizan correctamente
- Jugadas visibles en servidor después de sync

---

## 🎯 ESCENARIO 2: Errores de Sincronización

**Objetivo**: Validar manejo de errores durante sincronización

**Duración estimada**: 10-15 minutos

### Pre-condiciones
- App con login activo
- Modo offline activado
- Caché de loterías/horarios actualizado

### Pasos

#### 2.1 - Crear Jugada con Horario Cerrado
1. Estar offline
2. Verificar horarios disponibles (ej: "Nueva York Tarde" cierra a 17:30)
3. Cambiar **hora del dispositivo** a 18:00 (después del cierre)
4. Ir a Visual Mode
5. Crear jugada:
   - Fijo 45 - $100 - Nueva York Tarde
6. **✅ Verificar**:
   - Jugada guardada en cola (sin validación de horario en creación offline)

#### 2.2 - Crear Jugada que Exceda Límite
7. Cambiar hora del dispositivo de vuelta a la correcta
8. Crear jugada:
   - Fijo 12 - $999,999 (monto extremadamente alto para exceder límite del banco)
9. **✅ Verificar**:
   - Jugada guardada en cola (sin validación de límite en creación offline)

#### 2.3 - Reconectar y Sincronizar
10. Activar conexión
11. Ir a **Registro Offline**
12. **✅ Verificar**:
    - 2 jugadas pendientes
13. Presionar **"Enviar Todo"**
14. Confirmar sincronización
15. **✅ Verificar durante sincronización**:
    - Jugada 1 (horario cerrado): Estado cambia a ❌ con error
    - Jugada 2 (límite): Estado cambia a ❌ con error

**Logs esperados**:
```
[SyncService] Validando horario...
[SyncService] ❌ Validación falló: Horario cerrado. Jugada creada a las 18:00, pero el horario "Nueva York Tarde" es de 12:00 a 17:30
[OfflineStorage] UPDATE offline_plays - id: X, status: 'failed', last_error: 'Horario cerrado...'

[SyncService] Enviando a Supabase...
[Supabase] ERROR: Límite de banco excedido
[OfflineStorage] UPDATE offline_plays - id: Y, status: 'failed', last_error: 'Límite de banco excedido'
```

#### 2.4 - Ver Errores Específicos
16. **✅ Verificar alerta final**:
    - Título: "Sincronización completada"
    - Mensaje: "✅ 0 exitosa(s) - ❌ 2 fallida(s) - Revisa las jugadas fallidas para ver los errores"

17. Presionar "OK"
18. **✅ Verificar en lista**:
    - Header:
      - Pendientes: 0
      - Exitosas: 0
      - Fallidas: 2
      - Total: $1,000,099
    - Jugada 1: Estado "Error ❌" (rojo)
    - Jugada 2: Estado "Error ❌" (rojo)

19. Tocar **Jugada 1** (horario cerrado)
20. **✅ Verificar detalles expandidos**:
    - Números, monto, lotería visibles
    - Error visible: "Horario cerrado. Jugada creada a las 18:00..."
    - Botones: "🔄 Reintentar" y "🗑️ Eliminar"

21. Tocar **Jugada 2** (límite)
22. **✅ Verificar detalles**:
    - Error visible: "Límite de banco excedido"
    - Botones disponibles

#### 2.5 - Eliminar Jugadas Fallidas
23. Mantener presionada **Jugada 1**
24. **✅ Verificar**:
    - Modo selección activado
    - Checkbox visible en ambas jugadas
    - Botón "Eliminar seleccionadas" visible

25. Seleccionar **ambas jugadas**
26. Presionar **"Eliminar seleccionadas"**
27. **✅ Verificar confirmación**:
    - Mensaje: "¿Eliminar 2 jugada(s) seleccionada(s)?"

28. Confirmar
29. **✅ Verificar**:
    - Jugadas desaparecen de la lista
    - Mensaje: "No hay jugadas offline registradas"

### Resultado Esperado

✅ **ESCENARIO EXITOSO** si:
- Errores específicos se muestran correctamente
- Horario cerrado detectado ANTES de enviar al servidor
- Límite excedido detectado por Supabase y mensaje parseado
- Jugadas fallidas pueden reintentar o eliminarse

---

## 🎯 ESCENARIO 3: Modo Offline Forzado

**Objetivo**: Validar toggle manual de modo offline

**Duración estimada**: 8-10 minutos

### Pre-condiciones
- App con login activo
- Conexión WiFi/datos móviles activos

### Pasos

#### 3.1 - Activar Modo Offline Manual
1. Abrir **Sidebar**
2. **✅ Verificar estado inicial**:
   - NO hay indicador naranja (estamos online)
   - Badge de pendientes NO visible

3. Buscar opción **"Modo Offline"** o toggle de modo offline
   - **Nota**: Si no existe, saltar a 3.2 (implementación futura)

4. Activar toggle **"Modo Offline Manual"**
5. **✅ Verificar**:
   - Toggle cambia a ON
   - Indicador naranja aparece en sidebar
   - Mensaje: "Modo offline activado manualmente"

#### 3.2 - Crear Jugadas en Modo Forzado
6. Ir a **Visual Mode**
7. Crear 2 jugadas:
   - Fijo 45 - $100 - Nueva York Tarde
   - Corrido 12 - $50 - Leidsa Mediodía

8. **✅ Verificar**:
   - Jugadas guardadas en cola offline
   - NO se envían al servidor (aunque hay conexión)
   - Badge muestra "2"

#### 3.3 - Verificar Acceso a Consultas con Caché
9. Ir a **Estadísticas**
10. **✅ Verificar**:
    - Pantalla carga correctamente
    - Datos mostrados son del caché (si está disponible)
    - Sin errores de conexión

11. Ir a **Capacidad del Banco**
12. **✅ Verificar**:
    - Datos de caché visibles (si existen)
    - Mensaje informativo: "Datos desde caché offline" (opcional)

#### 3.4 - Desactivar Modo Offline Manual
13. Abrir **Sidebar**
14. Desactivar toggle **"Modo Offline Manual"**
15. **✅ Verificar**:
    - Indicador naranja desaparece
    - Banner verde aparece: "Conexión recuperada - 2 jugada(s) pendiente(s)"
    - Badge sigue mostrando "2"

#### 3.5 - Sincronizar
16. Presionar **"Sincronizar"** en banner
17. Sincronizar las 2 jugadas
18. **✅ Verificar**:
    - Ambas enviadas exitosamente
    - Badge desaparece

### Resultado Esperado

✅ **ESCENARIO EXITOSO** si:
- Toggle manual funciona correctamente
- Jugadas NO se envían aunque haya conexión
- Al desactivar, permite sincronización normal
- Acceso a consultas funciona con caché

---

## 🎯 ESCENARIO 4: Cambio de Día

**Objetivo**: Validar limpieza automática al cambiar el día

**Duración estimada**: 5-10 minutos

### Pre-condiciones
- App con login activo
- Tener jugadas offline con diferentes estados

### Pasos

#### 4.1 - Preparar Jugadas de Diferentes Estados
1. Estar offline
2. Crear **2 jugadas pendientes**
3. Reconectar
4. Sincronizar **1 jugada exitosamente** (success)
5. Crear **1 jugada con horario cerrado** y sincronizarla (failed)
6. **✅ Verificar en Registro Offline**:
   - Pendientes: 1
   - Exitosas: 1
   - Fallidas: 1
   - Total: 3 jugadas

#### 4.2 - Simular Cambio de Día
7. **Método A - React Native Debugger**:
   - Conectar React Native Debugger
   - Abrir AsyncStorage
   - Buscar clave: `@offline_last_check_date`
   - Cambiar valor de `2025-12-05` a `2025-12-04` (día anterior)

8. **Método B - Cambiar Fecha del Sistema**:
   - Ir a Configuración del dispositivo
   - Cambiar fecha manual a mañana (2025-12-06)

#### 4.3 - Reabrir App
9. Cerrar app completamente (no solo minimizar)
10. Abrir app nuevamente
11. **✅ Verificar logs en consola**:
```
[App] 🔄 Initializing day change service...
[DayChangeService] 🔍 Verificando cambio de día...
[DayChangeService] Verificando cambio de día: { today: '2025-12-06', lastCheckDate: '2025-12-05' }
[DayChangeService] ✅ Detectado cambio de día
[DayChangeService] 🗓️ Nuevo día detectado, ejecutando limpieza TOTAL...
[DayChangeService] 🧹 Iniciando limpieza de TODAS las jugadas del día anterior...
[DayChangeService] Total de jugadas antes de limpieza: 3
[DayChangeService] ✅ Jugadas eliminadas: 3
[DayChangeService] ✅ Limpieza completada. Eliminadas: 3 jugadas de 3 totales
[DayChangeService] Jugadas restantes (del día actual): 0
[DayChangeService] 📅 Fecha actualizada: 2025-12-06
```

#### 4.4 - Verificar Limpieza
12. Ir a **Registro Offline**
13. **✅ Verificar**:
    - Mensaje: "No hay jugadas offline registradas"
    - Header:
      - Pendientes: 0
      - Exitosas: 0
      - Fallidas: 0
      - Total: $0

14. Abrir **Sidebar**
15. **✅ Verificar**:
    - Badge NO visible (0 pendientes)

16. **IMPORTANTE**: Restaurar fecha del dispositivo a la correcta

### Resultado Esperado

✅ **ESCENARIO EXITOSO** si:
- Cambio de día detectado correctamente
- TODAS las jugadas eliminadas (sin importar estado)
- Base de datos limpia para el nuevo día
- AsyncStorage actualizado con nueva fecha

---

## 🎯 ESCENARIO 5: Expiración de Sesión

**Objetivo**: Validar cierre automático después de 24 horas offline

**Duración estimada**: 5-8 minutos

### Pre-condiciones
- App con login activo
- Modo offline

### Pasos

#### 5.1 - Login Offline
1. Estar online, hacer login
2. Cerrar app
3. Desconectar WiFi/datos móviles
4. Abrir app → **Login offline automático** (credenciales guardadas)
5. **✅ Verificar**:
   - Login exitoso sin conexión
   - Acceso a pantallas

#### 5.2 - Simular Paso de 24+ Horas
6. Cerrar app
7. **Cambiar hora del sistema**:
   - De: 5/12/2025 10:00
   - A: 6/12/2025 11:00 (25 horas después)

8. Abrir app (sin conexión)
9. **✅ Verificar logs**:
```
[OfflineContext] Validando sesión offline...
[OfflineContext] ⚠️ Sesión offline expirada (>24h)
[OfflineContext] Trigger para cerrar sesión
```

#### 5.3 - Verificar Comportamiento
10. **Opción A** - Si callback `onSessionExpired` implementado:
    - **✅ Verificar**: Redirect automático a LoginScreen
    - **✅ Verificar**: Mensaje "Sesión expirada. Inicie sesión nuevamente"

11. **Opción B** - Si solo hay logging (implementación actual):
    - **✅ Verificar**: Log en consola indicando sesión expirada
    - **⚠️ Nota**: Usuario puede seguir usando la app (a mejorar en futuro)

#### 5.4 - Re-login
12. Restaurar **hora del sistema** a la correcta
13. Activar **conexión**
14. Hacer login nuevamente
15. **✅ Verificar**:
    - Login exitoso
    - Nueva sesión de 24h comienza
    - Timestamp actualizado en SQLite

### Resultado Esperado

✅ **ESCENARIO EXITOSO** si:
- Sistema detecta sesión expirada después de 24h
- Log de advertencia visible
- Re-login funciona correctamente

---

## 🎯 ESCENARIO 6: Interrupción Durante Sincronización

**Objetivo**: Validar recuperación de jugadas interrumpidas

**Duración estimada**: 8-10 minutos

### Pre-condiciones
- App con login activo
- Conexión activa
- 5+ jugadas offline pendientes

### Pasos

#### 6.1 - Preparar Jugadas
1. Estar offline
2. Crear **5 jugadas offline**
3. **✅ Verificar**: 5 pendientes en Registro Offline

#### 6.2 - Iniciar Sincronización
4. Reconectar
5. Ir a **Registro Offline**
6. Presionar **"Enviar Todo"**
7. Confirmar
8. **✅ Verificar**: Modal de progreso aparece
9. Esperar hasta que llegue a **2/5 o 3/5** (progreso parcial)

#### 6.3 - Interrumpir App
10. **Sin presionar "Cancelar" ni "Cerrar"**:
    - **Android**: Deslizar desde multitarea y cerrar app
    - **iOS**: Doble tap home y cerrar app
    - **O**: Forzar cierre desde Configuración → Apps

11. **✅ Verificar estado en SQLite** (si es posible):
    - Algunas jugadas en `status='sending'`
    - Otras en `status='success'` (si ya se enviaron)
    - Otras en `status='pending'` (si no se procesaron)

#### 6.4 - Reabrir App
12. Abrir app nuevamente
13. **✅ Verificar logs**:
```
[App] 🔄 Recovering interrupted plays...
[OfflineStorage] 🔄 Verificando jugadas interrumpidas...
[OfflineStorage] ⚠️ Encontradas 2 jugadas interrumpidas
[OfflineStorage] ✅ Recuperadas 2 jugadas interrumpidas
[App] ✅ Recovered 2 interrupted plays
```

#### 6.5 - Verificar Recuperación
14. Ir a **Registro Offline**
15. **✅ Verificar**:
    - Jugadas que estaban en `sending` ahora están en `pending`
    - Jugadas `success` siguen siendo `success`
    - Botón "Enviar ahora" disponible para las recuperadas

16. Re-sincronizar las pendientes
17. **✅ Verificar**:
    - Solo envía las `pending` (las recuperadas + las no procesadas)
    - NO intenta re-enviar las `success`
    - Todas terminan en `success`

### Resultado Esperado

✅ **ESCENARIO EXITOSO** si:
- App detecta jugadas interrumpidas al abrir
- Jugadas `sending` cambian a `pending` automáticamente
- Re-sincronización funciona correctamente
- No hay duplicados en servidor

---

## 📊 RESUMEN DE VALIDACIÓN

### Checklist de Escenarios

- [ ] **Escenario 1**: Flujo completo offline → online → sync ✅
- [ ] **Escenario 2**: Errores de sincronización (horario cerrado, límite) ✅
- [ ] **Escenario 3**: Modo offline forzado manual ✅
- [ ] **Escenario 4**: Cambio de día y limpieza automática ✅
- [ ] **Escenario 5**: Expiración de sesión 24h ✅
- [ ] **Escenario 6**: Interrupción y recuperación ✅

### Criterios de Aceptación

✅ **SISTEMA APROBADO** si:
1. Todos los 6 escenarios principales pasan
2. No hay crashes inesperados
3. Logs son consistentes y claros
4. Estados de jugadas actualizan correctamente
5. Sincronización no crea duplicados
6. Limpieza de día funciona automáticamente
7. Errores se manejan y muestran correctamente

### Casos de Falla

❌ **SISTEMA RECHAZADO** si:
- Crash durante sincronización
- Jugadas duplicadas en servidor
- Pérdida de datos sin advertencia
- Estados inconsistentes en SQLite
- Banner no aparece/desaparece correctamente
- Limpieza de día no ejecuta

---

## 🐛 Problemas Conocidos y Soluciones

### Problema 1: Banner se superpone con notificaciones
**Solución**: Ya corregido - top: 40px

### Problema 2: Sincronización lenta con muchas jugadas
**Solución**: Delay de 100ms puede aumentarse a 200ms si es necesario

### Problema 3: Fecha del sistema afecta tests
**Solución**: Siempre restaurar fecha correcta después de cada test

### Problema 4: Logs no visibles en dispositivo físico
**Solución**: 
- Android: `adb logcat *:S ReactNative:V ReactNativeJS:V`
- iOS: Usar Xcode console

---

## 📝 Reporte de Bugs

Si encuentras algún problema durante el testing, documenta:

1. **Escenario**: Número y nombre
2. **Paso**: Número específico donde ocurrió
3. **Comportamiento esperado**: Qué debería pasar
4. **Comportamiento observado**: Qué pasó realmente
5. **Logs**: Copiar logs relevantes de consola
6. **Screenshots**: Si es posible
7. **Dispositivo**: Modelo, OS, versión de app
8. **Reproducible**: Sí/No - Pasos para reproducir

---

## ✅ FASE 13 COMPLETADA

**Estado**: ⏳ PENDIENTE DE EJECUCIÓN

**Próximos pasos**:
1. Ejecutar todos los escenarios en dispositivo físico
2. Documentar resultados
3. Corregir bugs encontrados
4. Re-ejecutar tests fallidos
5. Aprobar sistema para producción

**Estimación total de testing**: 60-80 minutos

---

**Fecha de creación**: 5 de diciembre de 2025
**Última actualización**: 5 de diciembre de 2025
**Responsable**: Equipo de desarrollo
**Estado del proyecto**: 12/13 fases completadas → Ahora 13/13 con documento de testing
