# ✅ Verificación del Sistema de Precios del Listero

## 🔧 Cambios Implementados

### 1. Correcciones en ListerPricesScreen.js

✅ **Corregido valor del DropdownPicker en modal de asignación**
- Antes usaba `priceNameById()` directamente como value
- Ahora busca correctamente en `priceOptions` por ID

✅ **Reseteo de assignPriceId**
- Se limpia al abrir el modal de asignación
- Se limpia después de asignar exitosamente
- Funciona tanto para un cliente como para "Aplicar a todos"

✅ **Validación de entrada numérica**
- Solo permite números y un punto decimal
- Previene múltiples puntos decimales
- Limpia caracteres no válidos automáticamente

### 2. Optimización en priceService.js

✅ **Simplificación de consulta OR en fetchPriceConfigsForListero**
- Antes: `.or(\`and(id_listero.eq...),and(id_listero.is.null...)\`)`
- Ahora: `.eq('id_banco', bankId).or(\`id_listero.eq.${listeroId},id_listero.is.null\`)`
- Más eficiente y legible

---

## 📋 Checklist de Verificación

### Pre-requisitos (Base de Datos)

- [ ] **Script SQL ejecutado en Supabase**
  - Archivo: `scripts/db/add_id_listero_to_precio.sql`
  - Agrega columna `id_listero` a tabla `precio`
  - Crea índices necesarios
  - Establece restricción UNIQUE

- [ ] **Verificar estructura de tabla precio**
  ```sql
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_name = 'precio';
  ```
  Debe incluir:
  - `id` (uuid)
  - `nombre` (text)
  - `precios` (jsonb)
  - `id_banco` (uuid)
  - `id_listero` (uuid, nullable)
  - `id_loteria` (uuid)

- [ ] **Verificar permisos RLS en Supabase**
  Los listeros necesitan poder:
  - `SELECT` en precio donde `id_banco` = su banco
  - `INSERT` en precio con su propio `id_listero`
  - `UPDATE` en precio donde `id_listero` = su id

### Pre-requisitos (Datos)

- [ ] **Perfil del listero completo**
  - Campo `id_banco` debe tener valor
  - Campo `role` debe ser 'listero'

- [ ] **Loterías existentes**
  - Al menos una lotería asociada al banco
  - Verificar: tabla `loteria` con `id_banco`

- [ ] **Jugadas activas configuradas**
  - Tabla `jugadas_activas` debe tener entrada para el banco
  - Campo `jugadas` debe tener formato: `{ lotteryId: { fijo: true, corrido: true, ... } }`

- [ ] **Clientes del listero**
  - Tabla `profiles` con `role` = 'client'
  - Campo `lister_id` = id del listero

---

## 🧪 Pruebas Manuales

### A. Crear Precio

1. Iniciar sesión como listero
2. Navegar a "Precios de Clientes"
3. **Seleccionar lotería** del dropdown
4. Ingresar **nombre** (ej: "Precio Día")
5. **Llenar precios** para jugadas activas
   - Regular: valor base
   - Limitado: valor cuando el número está limitado
6. Presionar **"Guardar"**
7. ✅ Verificar:
   - Mensaje "Éxito, Precio guardado"
   - Aparece en sección "Precios del listero"
   - Formulario se resetea

### B. Editar Precio

1. En lista de "Precios del listero"
2. Presionar **"Editar"** en un precio existente
3. Modificar valores
4. Presionar **"Actualizar"**
5. ✅ Verificar:
   - Mensaje de éxito
   - Cambios reflejados en la lista

### C. Asignar a Cliente Individual

1. En sección "Asignar a clientes"
2. Presionar **"Asignar"** junto a un cliente
3. Seleccionar precio del dropdown
4. Presionar **"Aplicar"**
5. ✅ Verificar:
   - Mensaje "Precio asignado"
   - Campo "Precio" del cliente muestra el nuevo precio

### D. Asignar a Todos los Clientes

1. Presionar **"Aplicar a todos"**
2. Seleccionar precio del dropdown
3. Presionar **"Aplicar"**
4. ✅ Verificar:
   - Todos los clientes muestran el mismo precio

---

## ⚙️ Validaciones Implementadas

### Entrada de Datos
- ✅ Lotería es obligatoria
- ✅ Nombre es obligatorio
- ✅ Al menos un precio para una jugada es obligatorio
- ✅ Solo números y un punto decimal en campos de precio
- ✅ No permite múltiples puntos decimales

### Manejo de Errores
- ✅ Detecta si falta columna `id_listero` (mensaje claro)
- ✅ Muestra errores de red
- ✅ Valida antes de guardar
- ✅ Valida antes de asignar

### Estados de UI
- ✅ Loading inicial (cargando datos)
- ✅ Saving (guardando precio)
- ✅ Assigning (asignando a clientes)
- ✅ Botones deshabilitados durante operaciones

### Filtrado y Alcance
- ✅ Precios del listero (scope: 'listero')
- ✅ Precios del banco (scope: 'banco')
- ✅ Ambos disponibles para asignar
- ✅ Solo el listero puede editar sus propios precios

---

## 🐛 Errores Comunes y Soluciones

### Error: "La columna 'id_listero' no existe"
**Causa:** No se ejecutó el script SQL de migración
**Solución:**
1. Abrir Supabase SQL Editor
2. Copiar contenido de `scripts/db/add_id_listero_to_precio.sql`
3. Ejecutar el script
4. Verificar que se creó la columna

### Error: "Permission denied for table precio"
**Causa:** Políticas RLS no configuradas correctamente
**Solución:**
1. Verificar políticas en Supabase Dashboard
2. Crear política SELECT para listeros:
   ```sql
   CREATE POLICY "Listeros pueden ver precios de su banco"
   ON precio FOR SELECT
   TO authenticated
   USING (
     id_banco IN (
       SELECT id_banco FROM profiles 
       WHERE id = auth.uid() AND role = 'listero'
     )
   );
   ```

### Error: "No se encontró id_banco en el perfil"
**Causa:** Perfil del listero incompleto
**Solución:**
1. Verificar tabla `profiles`
2. Asignar `id_banco` al listero
3. Reiniciar sesión

### No aparecen loterías en dropdown
**Causa:** No hay loterías creadas para el banco
**Solución:**
1. Verificar tabla `loteria`
2. Crear loterías con `id_banco` correspondiente

### No aparecen jugadas activas
**Causa:** No están configuradas en `jugadas_activas`
**Solución:**
1. Verificar tabla `jugadas_activas`
2. Asegurar formato correcto:
   ```json
   {
     "lottery-id-1": {
       "fijo": true,
       "corrido": true,
       "posicion": false
     }
   }
   ```

### No aparecen clientes
**Causa:** Clientes no están asignados al listero
**Solución:**
1. Verificar tabla `profiles`
2. Campo `lister_id` debe ser el id del listero
3. Campo `role` debe ser 'client'

---

## 🎯 Funcionalidad Esperada

### Flujo Completo

```
1. Listero crea precio para una lotería
   ↓
2. Sistema guarda con id_listero
   ↓
3. Precio aparece en lista del listero
   ↓
4. Listero asigna precio a cliente(s)
   ↓
5. Cliente.id_precio → precio.id
   ↓
6. Sistema usa ese precio en jugadas
```

### Interacción con Otros Módulos

- **JugadasScreen**: Lee `profiles.id_precio` del cliente
- **PlaySubmission**: Calcula pago usando precio asignado
- **Statistics**: Agrupa por precio para análisis

---

## 📊 Consultas Útiles para Verificar

### Ver precios del listero
```sql
SELECT p.*, l.nombre as loteria_nombre
FROM precio p
JOIN loteria l ON p.id_loteria = l.id
WHERE p.id_listero = 'tu-listero-id'
ORDER BY p.created_at DESC;
```

### Ver clientes con precios asignados
```sql
SELECT 
  pr.id,
  pr.username,
  pr.id_precio,
  pc.nombre as precio_nombre
FROM profiles pr
LEFT JOIN precio pc ON pr.id_precio = pc.id
WHERE pr.lister_id = 'tu-listero-id'
  AND pr.role = 'client';
```

### Verificar estructura de precios
```sql
SELECT nombre, precios
FROM precio
WHERE id_listero = 'tu-listero-id'
LIMIT 5;
```

---

## ✨ Estado Actual

**Código:**
- ✅ Sin errores de sintaxis
- ✅ Validaciones implementadas
- ✅ Manejo de errores robusto
- ✅ UI responsive

**Próximo Paso:**
- Ejecutar pruebas manuales descritas arriba
- Verificar que la migración SQL fue ejecutada
- Confirmar que los datos están correctamente configurados

---

**Fecha:** 27 de diciembre de 2025
**Archivos Modificados:**
- `src/screens/ListerPricesScreen.js`
- `src/services/priceService.js`
