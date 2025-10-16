# 🔍 Búsqueda de Números Canónicos - Implementación Completada

## 📋 Resumen de Cambios

Se implementó un sistema de búsqueda inteligente que reconoce las formas canónicas de **Parle** (4 dígitos) y **Tripleta** (6 dígitos) en las pantallas de capacidad del banco y del listero.

---

## 🎯 Funcionalidades Implementadas

### **1. Búsqueda Canónica de Parle (4 dígitos)**
- **Problema:** Parle `1234` es lo mismo que `3412` (inversión de pares)
- **Solución:** Si buscas `3412`, también encuentra `1234`
- **Permutaciones:** 2 variantes (AB|CD → AB|CD y CD|AB)

**Ejemplo:**
```
Vista muestra: 1234
Usuario busca: 3412
✅ Resultado: ENCONTRADO
```

### **2. Búsqueda Canónica de Tripleta (6 dígitos)**
- **Problema:** Tripleta `123456` tiene 6 formas equivalentes (permutaciones de 3 pares)
- **Solución:** Si buscas cualquiera de las 6 formas, encuentra el número canónico
- **Permutaciones:** 6 variantes (12-34-56 en todas sus ordenaciones)

**Ejemplo:**
```
Vista muestra: 123456
Usuario busca: 563412
✅ Resultado: ENCONTRADO

Todas estas búsquedas encuentran 123456:
- 123456 ✓
- 125634 ✓
- 341256 ✓
- 345612 ✓
- 561234 ✓
- 563412 ✓
```

### **3. Búsqueda Exacta para Otros Casos**
- **Fijo/Corrido (2 dígitos):** Búsqueda exacta, `05` ≠ `50`
- **Centena (3 dígitos):** Búsqueda exacta
- **Otros:** Búsqueda exacta

### **4. Validación de Input**
- ✅ **Solo números:** No permite letras, espacios ni símbolos
- ✅ **Teclado numérico:** Automáticamente en móviles
- ✅ **Sanitización:** Caracteres no numéricos se eliminan automáticamente

---

## 📁 Archivos Modificados

### **1. Nuevo archivo: `src/utils/numberSearchUtils.js`**
Utilidad centralizada con 3 funciones exportadas:

```javascript
// Genera todas las variantes canónicas de un número
generateNumberVariants(searchTerm)

// Verifica si un número coincide considerando variantes
matchesSearchTerm(numero, searchTerm)

// Formatea input permitiendo solo números
formatNumberInput(text)
```

### **2. Modificado: `src/screens/BankCapacityScreen.js`**
- ✅ Import de utilidades
- ✅ Filtro actualizado con `matchesSearchTerm()`
- ✅ Input sanitizado con `formatNumberInput()`
- ✅ Teclado numérico (`keyboardType="numeric"`)

### **3. Modificado: `src/components/CapacityModal.js`**
- ✅ Import de utilidades
- ✅ Filtro actualizado con `matchesSearchTerm()`
- ✅ Input sanitizado con `formatNumberInput()`

### **4. Nuevo archivo: `src/utils/__tests__/numberSearchUtils.test.js`**
Suite de pruebas con 7 casos de prueba (todas pasadas ✅)

---

## 🧪 Pruebas Ejecutadas

```
✅ Test 1: Parle - 2 variantes generadas correctamente
✅ Test 2: Tripleta - 6 variantes generadas correctamente
✅ Test 3: Búsqueda de parle alternativo (3412 → 1234)
✅ Test 4: Búsqueda de tripleta alternativa (563412 → 123456)
✅ Test 5: Búsqueda exacta de fijo (05 ≠ 50)
✅ Test 6: Sanitización de input (12a34-56 → 123456)
✅ Test 7: Todas las permutaciones de tripleta funcionan
```

---

## 🎮 Uso para el Usuario

### **Pantalla: Capacidad del Banco**
1. Presionar el ícono de búsqueda 🔍
2. Escribir el número (solo se permiten dígitos)
3. Para **Parle:** Escribir cualquiera de las 2 formas (ej: `1234` o `3412`)
4. Para **Tripleta:** Escribir cualquiera de las 6 formas (ej: `123456`, `563412`, etc.)
5. Para **Fijo/Corrido/Centena:** Búsqueda exacta

### **Modal: Capacidad del Listero**
- Funciona exactamente igual que la pantalla del banco
- Búsqueda habilitada en el modal de capacidades

---

## 🔧 Lógica Técnica

### **Algoritmo de Permutaciones**

**Parle (4 dígitos):**
```javascript
Input: "1234"
Pares: ["12", "34"]
Variantes: ["1234", "3412"]
```

**Tripleta (6 dígitos):**
```javascript
Input: "123456"
Pares: ["12", "34", "56"]
Variantes:
  - p1+p2+p3 = "123456"
  - p1+p3+p2 = "125634"
  - p2+p1+p3 = "341256"
  - p2+p3+p1 = "345612"
  - p3+p1+p2 = "561234"
  - p3+p2+p1 = "563412"
```

### **Flujo de Búsqueda**
```
Usuario escribe "3412"
    ↓
formatNumberInput() → "3412" (limpia caracteres no numéricos)
    ↓
generateNumberVariants("3412") → ["3412", "1234"]
    ↓
matchesSearchTerm(numeroEnVista, "3412")
    ↓
¿numeroEnVista === "3412" O numeroEnVista === "1234"?
    ↓
✅ SÍ → Mostrar resultado
```

---

## ✅ Estado Final

- ✅ Búsqueda canónica de Parle implementada
- ✅ Búsqueda canónica de Tripleta implementada
- ✅ Input sanitizado (solo números)
- ✅ Pruebas unitarias pasadas
- ✅ Sin errores de compilación
- ✅ Aplicado en ambas pantallas (banco y listero)

---

## 📝 Notas Importantes

1. **La vista ya devuelve números canónicos:** Se asume que `v_capacidades` ya guarda los números en su forma canónica (menor permutación)

2. **Búsqueda exacta:** Solo busca coincidencias exactas, no parciales. Si escribes `12`, busca exactamente `12`, no números que contengan `12`

3. **Performance:** Las permutaciones se generan on-the-fly sin impacto en rendimiento (máximo 6 permutaciones)

4. **Extensible:** Si en el futuro hay nuevos tipos de jugadas con formas canónicas, solo hay que actualizar `generateNumberVariants()`

---

## 🚀 Para Ejecutar Pruebas

```bash
cd "c:\Users\Adrian\Documents\React Native\apk-lista-clean"
node src/utils/__tests__/numberSearchUtils.test.js
```

**Resultado esperado:** Todos los tests en verde ✅

---

**Implementación completada exitosamente** 🎉
