# 🧪 FASE 11: SIDEBAR - MODO OFFLINE - GUÍA DE PRUEBAS

## ✅ Resumen de Implementación

### Archivos Modificados
- ✅ `src/components/SideBar.js` - Agregado indicador de modo offline y verificada opción de navegación

### Funcionalidades Implementadas

#### 11.1 - Indicador de Modo Offline
- Banner naranja que aparece en el sidebar cuando no hay conexión
- Muestra icono 📴 y texto "Modo Offline"
- Solo visible cuando `isOnline === false`

#### 11.2 - Opción de Registro Offline
- Ya existía previamente para rol `listero`
- Badge azul muestra número de jugadas pendientes
- Navega a `OfflinePlayRegistryScreen`

## 📋 PRUEBAS OBLIGATORIAS

### **Prueba 11.1: Ver Indicador Offline en Sidebar**

**Objetivo**: Verificar que aparezca el banner naranja cuando no hay conexión

**Pasos**:
1. Abrir app con WiFi activado
2. Abrir sidebar (menú hamburguesa)
3. **Verificar**: NO debe aparecer indicador naranja
4. Cerrar sidebar
5. Desactivar WiFi/datos móviles
6. Abrir sidebar nuevamente

**Resultado Esperado**:
- ✅ Banner naranja aparece debajo del header
- ✅ Icono: 📴
- ✅ Texto: "Modo Offline"
- ✅ Color de fondo: #FF9800 (naranja)
- ✅ Banner con bordes redondeados
- ✅ Banner entre el header y las opciones del menú

---

### **Prueba 11.2: Indicador Desaparece al Reconectar**

**Objetivo**: Verificar que el indicador se oculte al recuperar conexión

**Pasos**:
1. Estar offline con sidebar abierto (indicador naranja visible)
2. Activar WiFi/datos móviles
3. Esperar 2-3 segundos (conexión detectada)

**Resultado Esperado**:
- ✅ Banner naranja desaparece automáticamente
- ✅ Sidebar vuelve a su estado normal (sin indicador)

---

### **Prueba 11.3: Navegar a Registro Offline desde Sidebar**

**Objetivo**: Verificar navegación y badge de pendientes

**Pre-requisito**: Rol `listero` y tener 2+ jugadas pendientes

**Pasos**:
1. Crear 2 jugadas offline (sin sincronizar)
2. Abrir sidebar
3. Buscar opción "📱 Registro Offline"
4. **Verificar badge**: Debe mostrar "2" en badge azul
5. Presionar la opción

**Resultado Esperado**:
- ✅ Opción visible: "📱 Registro Offline"
- ✅ Badge azul con número "2" visible a la derecha
- ✅ Al presionar: sidebar se cierra
- ✅ Navega a OfflinePlayRegistryScreen
- ✅ Pantalla muestra las 2 jugadas pendientes

---

### **Prueba 11.4: Badge Actualiza Dinámicamente**

**Objetivo**: Verificar que el badge refleje el número correcto de pendientes

**Pasos**:
1. Sin jugadas pendientes, abrir sidebar
2. **Verificar**: Badge NO visible en "Registro Offline"
3. Cerrar sidebar
4. Crear 1 jugada offline
5. Abrir sidebar nuevamente
6. **Verificar**: Badge muestra "1"
7. Cerrar sidebar, crear 2 jugadas más (total 3)
8. Abrir sidebar
9. **Verificar**: Badge muestra "3"
10. Sincronizar todas las jugadas
11. Abrir sidebar
12. **Verificar**: Badge desaparece (o muestra "0")

**Resultado Esperado**:
- ✅ Badge aparece solo cuando hay pendientes
- ✅ Número correcto en cada apertura
- ✅ Badge desaparece cuando pendientes = 0

---

### **Prueba 11.5: Indicador Offline + Badge Juntos**

**Objetivo**: Verificar que ambos elementos coexistan correctamente

**Pasos**:
1. Estar online, crear 3 jugadas offline
2. Abrir sidebar → **Verificar**: Badge "3" visible, NO indicador naranja
3. Cerrar sidebar
4. Desconectar WiFi
5. Abrir sidebar

**Resultado Esperado**:
- ✅ Indicador naranja "📴 Modo Offline" visible arriba
- ✅ Badge "3" visible en opción "Registro Offline"
- ✅ Ambos elementos visibles simultáneamente
- ✅ No hay superposición ni problemas de layout

---

### **Prueba 11.6: Sidebar en Rol Admin**

**Objetivo**: Verificar que admin NO vea opción de Registro Offline

**Pre-requisito**: Iniciar sesión como admin

**Pasos**:
1. Login como admin
2. Abrir sidebar
3. Revisar opciones disponibles

**Resultado Esperado**:
- ✅ Indicador naranja aparece si está offline
- ✅ Opción "Registro Offline" NO visible (solo para listeros)
- ✅ Opciones de admin visibles: Estadísticas, Resultados, Usuarios, Loterías, etc.

---

### **Prueba 11.7: Sidebar en Rol Collector**

**Objetivo**: Verificar que collector NO vea opción de Registro Offline

**Pre-requisito**: Iniciar sesión como collector

**Pasos**:
1. Login como collector
2. Abrir sidebar
3. Revisar opciones disponibles

**Resultado Esperado**:
- ✅ Indicador naranja aparece si está offline
- ✅ Opción "Registro Offline" NO visible
- ✅ Solo opciones de collector: Estadísticas, Resultados, Usuarios, Configuración

---

### **Prueba 11.8: Ciclo Completo Sidebar**

**Objetivo**: Probar flujo completo desde sidebar

**Pasos**:
1. Estar offline, abrir sidebar
   - ✅ Indicador naranja visible
2. Crear 5 jugadas offline (sidebar cerrado)
3. Abrir sidebar
   - ✅ Badge muestra "5"
4. Presionar "Registro Offline"
   - ✅ Navega correctamente
5. Presionar "Enviar Todo"
   - ❌ Error (sin conexión)
6. Volver atrás (sidebar todavía tiene badge "5")
7. Reconectar WiFi
8. Abrir sidebar
   - ✅ Indicador naranja desaparece
   - ✅ Badge sigue mostrando "5"
9. Presionar "Registro Offline"
10. Presionar "Enviar Todo" → Sincronizar exitosamente
11. Volver atrás, abrir sidebar
    - ✅ Badge desaparece (o muestra "0")

---

## 🐛 Problemas Conocidos y Soluciones

### Problema 1: Indicador no aparece al desconectar
**Síntomas**: Banner naranja no se muestra estando offline
**Causas posibles**:
- OfflineContext no disponible
- isOnline no actualizado
**Solución**: Verificar que ConnectionService esté funcionando

### Problema 2: Badge no actualiza
**Síntomas**: Número de pendientes incorrecto o no cambia
**Causas posibles**:
- pendingPlays no se recarga en OfflineContext
- SideBar no re-renderiza
**Solución**: Verificar que loadPendingPlays() se llame después de crear/sincronizar jugadas

### Problema 3: Opción no visible para listero
**Síntomas**: "Registro Offline" no aparece en sidebar
**Causas posibles**:
- Rol no es 'listero'
- roleOptionsMap no incluye la opción
**Solución**: Verificar rol del usuario y configuración de opciones

### Problema 4: Navegación falla
**Síntomas**: Error al presionar "Registro Offline"
**Causas posibles**:
- Ruta no registrada en AppNavigator
- navigation prop no pasado correctamente
**Solución**: Verificar que la ruta 'OfflinePlayRegistry' exista

---

## ✅ Checklist Final

Antes de marcar FASE 11 como completa, verificar:

- [ ] Prueba 11.1 ✅ (Indicador visible offline)
- [ ] Prueba 11.2 ✅ (Indicador desaparece online)
- [ ] Prueba 11.3 ✅ (Navegación funciona)
- [ ] Prueba 11.4 ✅ (Badge actualiza dinámicamente)
- [ ] Prueba 11.5 ✅ (Indicador + Badge juntos)
- [ ] Prueba 11.6 ✅ (Admin no ve opción)
- [ ] Prueba 11.7 ✅ (Collector no ve opción)
- [ ] Prueba 11.8 ✅ (Ciclo completo)

---

## 📊 Diseño Visual del Indicador

```
┌─────────────────────────────────┐
│  🎲 Cloud              ✕         │  ← Header
├─────────────────────────────────┤
│  📴  Modo Offline                │  ← NUEVO: Indicador (naranja)
├─────────────────────────────────┤
│  🎮  Inicio                   ▶  │
│  📱  Registro Offline   [3]   ▶  │  ← Badge azul con número
│  📈  Estadísticas             ▶  │
│  🎯  Resultados               ▶  │
│  ⚙️  Configuración            ▶  │
│                                  │
│                                  │
└─────────────────────────────────┘
│  🚪  Cerrar Sesión               │  ← Footer
└─────────────────────────────────┘
```

---

## 🎨 Estilos Implementados

### Indicador Offline
```javascript
offlineIndicator: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FF9800',  // Naranja
  paddingVertical: 8,
  paddingHorizontal: 16,
  marginHorizontal: 16,
  marginTop: 12,
  marginBottom: 8,
  borderRadius: 8,
}
```

### Badge de Pendientes
```javascript
badge: {
  backgroundColor: '#2196F3',  // Azul
  borderRadius: 10,
  minWidth: 20,
  height: 20,
  paddingHorizontal: 6,
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 8,
}
```

---

## 🎯 Estado Actual

**FASE 11**: ✅ IMPLEMENTADA - Pendiente de pruebas

**Archivos Modificados**:
- ✅ `src/components/SideBar.js` - Indicador offline y badge verificados

**Componentes Verificados**:
- ✅ Indicador de modo offline (condicional)
- ✅ Opción de navegación (ya existía)
- ✅ Badge de pendientes (ya existía)
- ✅ Navegación a OfflinePlayRegistry (ya existía)

**Siguiente Fase**: FASE 12 - Optimizaciones y Pulido

---

## 📝 Notas Técnicas

### Condición de Visibilidad
```javascript
{offlineContext && !offlineContext.isOnline && (
  <View style={styles.offlineIndicator}>
    <Text style={styles.offlineIcon}>📴</Text>
    <Text style={styles.offlineText}>Modo Offline</Text>
  </View>
)}
```

### Cálculo de Pendientes
```javascript
const pendingPlays = offlineContext?.pendingPlays || [];
const pendingCount = pendingPlays.filter(p => p.status === 'pending').length;
```

### Opciones por Rol
- **listero**: Incluye opción con `badge: true`
- **admin/collector**: NO incluye opción de Registro Offline
- Badge solo visible cuando `pendingCount > 0`

