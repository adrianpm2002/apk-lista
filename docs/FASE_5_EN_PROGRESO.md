# 🚀 FASE 5: CACHÉ DE LOTERÍAS Y HORARIOS

**Fecha de inicio:** 19 de noviembre de 2025  
**Estado:** 🔄 EN PROGRESO

---

## 🎯 OBJETIVOS

Implementar sistema de caché local en SQLite para:
1. **Loterías** del banco del usuario
2. **Horarios** de cada lotería
3. **Sincronización automática** cada hora
4. **Servir datos offline** desde caché

---

## 📋 PASOS A IMPLEMENTAR

### ✅ **Paso 5.1 - Funciones de caché en offlineStorageService.js**

**Funciones a crear:**

#### 1. `saveLotteries(lotteries)`
```javascript
/**
 * Guardar loterías en SQLite
 * @param {Array} lotteries - Array de objetos lotería
 * @returns {Promise<boolean>}
 */
```
- INSERT/REPLACE en tabla `offline_lotteries`
- Guardar: id, nombre, id_banco, tipo, activo
- Timestamp de guardado

#### 2. `getLotteries(id_banco)`
```javascript
/**
 * Obtener loterías del caché
 * @param {number} id_banco - ID del banco
 * @returns {Promise<Array>}
 */
```
- SELECT por id_banco
- ORDER BY nombre

#### 3. `saveSchedules(schedules)`
```javascript
/**
 * Guardar horarios en SQLite
 * @param {Array} schedules - Array de objetos horario
 * @returns {Promise<boolean>}
 */
```
- INSERT/REPLACE en tabla `offline_schedules`
- Guardar: id, nombre, hora_inicio, hora_fin, id_loteria
- Timestamp de guardado

#### 4. `getSchedules(id_loteria)`
```javascript
/**
 * Obtener horarios de una lotería
 * @param {number} id_loteria - ID de la lotería
 * @returns {Promise<Array>}
 */
```
- SELECT por id_loteria
- ORDER BY hora_inicio

#### 5. `getLastCacheUpdate()`
```javascript
/**
 * Obtener timestamp de última actualización del caché
 * @returns {Promise<number|null>}
 */
```
- SELECT from offline_config
- Key: 'last_cache_update'

---

### 🔄 **Paso 5.2 - Background sync en backgroundTaskService.js**

**Función a crear:**

#### `syncOfflineCache()`
```javascript
/**
 * Sincronizar caché de loterías y horarios
 * Ejecutar cada hora en background
 */
```

**Lógica:**
1. Verificar conexión
2. Si offline: Skip
3. Si online:
   - Fetch loterías del banco del usuario
   - Save en SQLite
   - Para cada lotería:
     - Fetch horarios
     - Save en SQLite
   - Guardar timestamp en config
   - Log de operación

**Trigger:**
- Cada 1 hora (background task)
- Manual desde UI (testing panel)
- Al login online exitoso

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### Tabla: `offline_lotteries`

```sql
CREATE TABLE IF NOT EXISTS offline_lotteries (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  id_banco INTEGER NOT NULL,
  tipo TEXT,
  activo INTEGER DEFAULT 1,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Índices:**
```sql
CREATE INDEX IF NOT EXISTS idx_offline_lotteries_banco 
ON offline_lotteries(id_banco);
```

---

### Tabla: `offline_schedules`

```sql
CREATE TABLE IF NOT EXISTS offline_schedules (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fin TEXT NOT NULL,
  id_loteria INTEGER NOT NULL,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_loteria) REFERENCES offline_lotteries(id)
)
```

**Índices:**
```sql
CREATE INDEX IF NOT EXISTS idx_offline_schedules_loteria 
ON offline_schedules(id_loteria);
```

---

## 🧪 TESTING

### Test 1: Guardar y recuperar loterías
```javascript
// En OfflineTestingPanel
async testSaveLotteries() {
  const mockLotteries = [
    { id: 1, nombre: 'Lotería Nacional', id_banco: 123, tipo: 'normal' },
    { id: 2, nombre: 'Loteka', id_banco: 123, tipo: 'normal' }
  ];
  
  await OfflineStorage.saveLotteries(mockLotteries);
  const cached = await OfflineStorage.getLotteries(123);
  
  Alert.alert('Test Loterías', 
    `Guardadas: 2\nRecuperadas: ${cached.length}`);
}
```

### Test 2: Guardar y recuperar horarios
```javascript
async testSaveSchedules() {
  const mockSchedules = [
    { id: 1, nombre: 'Matutino', hora_inicio: '10:00', hora_fin: '12:00', id_loteria: 1 },
    { id: 2, nombre: 'Vespertino', hora_inicio: '15:00', hora_fin: '17:00', id_loteria: 1 }
  ];
  
  await OfflineStorage.saveSchedules(mockSchedules);
  const cached = await OfflineStorage.getSchedules(1);
  
  Alert.alert('Test Horarios', 
    `Guardados: 2\nRecuperados: ${cached.length}`);
}
```

### Test 3: Sincronización manual
```javascript
async testSyncCache() {
  // Llamar syncOfflineCache()
  // Mostrar progreso
  // Mostrar resultado (cantidad guardada)
}
```

---

## 📱 PANTALLAS AFECTADAS

### Pantallas que usan loterías:
- ✅ `VisualModeScreen.js`
- ✅ `TextModeScreen.js`
- ✅ `TextMode2Screen.js`
- ✅ `VaultModeScreen.js`
- ✅ `InsertResultsScreen.js`
- ✅ `ManageLotteriesScreen.js`
- ✅ `limitNumero.js`

**Cambio requerido:**
```javascript
// ANTES
const { data: lots } = await supabase
  .from('loteria')
  .select('id,nombre')
  .eq('id_banco', bankId);

// DESPUÉS
const isOffline = !isConnected;
let lots;

if (isOffline) {
  // Usar caché
  lots = await OfflineStorage.getLotteries(bankId);
} else {
  // Fetch online
  const { data } = await supabase
    .from('loteria')
    .select('id,nombre')
    .eq('id_banco', bankId);
  lots = data;
}
```

---

## 🔄 INTEGRACIÓN CON OFFLINE CONTEXT

Agregar al `OfflineContext.js`:

```javascript
// Estado
const [cacheLastUpdate, setCacheLastUpdate] = useState(null);

// Función
const refreshCache = async () => {
  if (!isOnline) {
    Alert.alert('Offline', 'No se puede actualizar caché sin conexión');
    return;
  }
  
  await syncOfflineCache();
  const timestamp = await OfflineStorage.getLastCacheUpdate();
  setCacheLastUpdate(timestamp);
};
```

---

## 📊 MÉTRICAS DE ÉXITO

- [  ] Loterías se guardan correctamente en SQLite
- [  ] Horarios se guardan correctamente en SQLite
- [  ] Pantallas cargan datos desde caché cuando offline
- [  ] Sincronización automática funciona cada hora
- [  ] Timestamp de última actualización se muestra en UI
- [  ] Botón de sincronización manual funciona
- [  ] Logs de operaciones se guardan

---

## 🎯 ENTREGABLES

1. **Código:**
   - ✅ Funciones CRUD en `offlineStorageService.js`
   - ✅ Función `syncOfflineCache()` en `backgroundTaskService.js`
   - ✅ Integración en pantallas de jugadas
   - ✅ Tests en `OfflineTestingPanel.js`

2. **Base de datos:**
   - ✅ Tablas `offline_lotteries` y `offline_schedules`
   - ✅ Índices para performance

3. **Documentación:**
   - ✅ Este documento actualizado con resultados
   - ✅ Commits con mensajes descriptivos

---

## 🚦 ESTADO ACTUAL

**Iniciando Paso 5.1...**

**Próximo:** Crear funciones en `offlineStorageService.js`

---

**Preparado por:** GitHub Copilot  
**Última actualización:** 19 nov 2025
