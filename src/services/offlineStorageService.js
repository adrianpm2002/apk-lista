import { Platform } from 'react-native';

// Solo importar SQLite en móvil
let SQLite = null;
if (Platform.OS !== 'web') {
  SQLite = require('react-native-sqlite-storage');
  SQLite.DEBUG(true);
  SQLite.enablePromise(true);
}

const DB_NAME = 'offline.db';
const DB_VERSION = 1;

let dbInstance = null;

// ========================================
// INICIALIZACIÓN Y CONFIGURACIÓN
// ========================================

/**
 * Obtiene o crea instancia de base de datos offline
 */
const getDatabase = async () => {
  if (Platform.OS === 'web' || !SQLite) {
    console.log('[OfflineStorage] ⚠️ SQLite not available on web platform - Offline mode disabled');
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  try {
    const db = await SQLite.openDatabase({
      name: DB_NAME,
      location: 'default',
    });

    await initializeTables(db);
    
    dbInstance = db;
    console.log('[OfflineStorage] Database initialized successfully');
    return db;
  } catch (error) {
    console.error('[OfflineStorage] Error opening database:', error);
    throw error;
  }
};

/**
 * Inicializar todas las tablas necesarias
 */
const initializeTables = async (db) => {
  try {
    // Tabla de metadata para versiones
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS db_metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    // Obtener versión actual
    const [metaResult] = await db.executeSql(
      "SELECT value FROM db_metadata WHERE key = 'version'"
    );

    const currentVersion = metaResult.rows.length > 0 
      ? parseInt(metaResult.rows.item(0).value) 
      : 0;

    if (currentVersion < DB_VERSION) {
      await runMigrations(db, currentVersion, DB_VERSION);
      
      await db.executeSql(
        "INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', ?)",
        [DB_VERSION.toString()]
      );
    }

    console.log('[OfflineStorage] Tables initialized successfully');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error initializing tables:', error);
    throw error;
  }
};

/**
 * Ejecutar migraciones de base de datos
 */
const runMigrations = async (db, fromVersion, toVersion) => {
  console.log(`[OfflineStorage] Running migrations from v${fromVersion} to v${toVersion}`);

  if (fromVersion < 1 && toVersion >= 1) {
    // Migración v1: Crear todas las tablas
    await createInitialSchema(db);
  }
};

/**
 * Crear esquema inicial de la base de datos
 */
const createInitialSchema = async (db) => {
  console.log('[OfflineStorage] Creating initial schema...');

  // Tabla de jugadas offline
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_listero TEXT NOT NULL,
      id_horario TEXT NOT NULL,
      jugada TEXT NOT NULL,
      numeros TEXT NOT NULL,
      monto_unitario REAL NOT NULL,
      monto_total REAL,
      nota TEXT,
      comando TEXT,
      id_cliente TEXT,
      created_at TEXT NOT NULL,
      created_from TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      sync_attempts INTEGER DEFAULT 0,
      last_sync_attempt TEXT
    )
  `);

  // Tabla de loterías cacheadas
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_lotteries (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      creada_en TEXT NOT NULL,
      id_banco TEXT NOT NULL,
      cached_at TEXT,
      updated_at TEXT
    )
  `);

  // Tabla de horarios cacheados
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_schedules (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      id_loteria TEXT NOT NULL,
      cached_at TEXT,
      updated_at TEXT
    )
  `);

  // Tabla de credenciales encriptadas
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE NOT NULL,
      encrypted_data TEXT NOT NULL,
      role TEXT NOT NULL,
      id_banco TEXT,
      last_login TEXT NOT NULL,
      session_expires TEXT NOT NULL
    )
  `);

  // Tabla de configuración
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Tabla de logs para debugging
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      timestamp TEXT NOT NULL
    )
  `);

  // Tabla de caché de estadísticas
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_stats_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      data TEXT NOT NULL,
      last_sync TEXT NOT NULL
    )
  `);

  // Crear índices para optimizar consultas
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_plays_status ON offline_plays(status)
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_plays_created ON offline_plays(created_at)
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_schedules_loteria ON offline_schedules(id_loteria)
  `);

  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON offline_logs(timestamp DESC)
  `);

  console.log('[OfflineStorage] Initial schema created successfully');
};

// ========================================
// FUNCIONES DE LOGS
// ========================================

/**
 * Agregar log
 */
export const addLog = async (level, message, data = null) => {
  try {
    const db = await getDatabase();
    if (!db) return;

    const timestamp = new Date().toISOString();
    const dataStr = data ? JSON.stringify(data) : null;

    await db.executeSql(
      `INSERT INTO offline_logs (level, message, data, timestamp) VALUES (?, ?, ?, ?)`,
      [level, message, dataStr, timestamp]
    );

    console.log(`[OfflineStorage][${level}] ${message}`, data || '');
  } catch (error) {
    console.error('[OfflineStorage] Error adding log:', error);
  }
};

/**
 * Obtener logs con paginación
 */
export const getLogs = async (limit = 100, offset = 0) => {
  try {
    const db = await getDatabase();
    if (!db) return [];

    const [result] = await db.executeSql(
      `SELECT * FROM offline_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const logs = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      logs.push({
        ...row,
        data: row.data ? JSON.parse(row.data) : null,
      });
    }

    return logs;
  } catch (error) {
    console.error('[OfflineStorage] Error getting logs:', error);
    return [];
  }
};

/**
 * Limpiar logs antiguos
 */
export const clearLogs = async () => {
  try {
    const db = await getDatabase();
    if (!db) return;

    await db.executeSql(`DELETE FROM offline_logs`);
    console.log('[OfflineStorage] Logs cleared');
  } catch (error) {
    console.error('[OfflineStorage] Error clearing logs:', error);
  }
};

// ========================================
// FUNCIONES DE TESTING
// ========================================

/**
 * Insertar registro de prueba
 */
export const insertTestRecord = async () => {
  try {
    const db = await getDatabase();
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const testData = {
      key: 'test_key_' + Date.now(),
      value: 'Test value from offlineStorageService'
    };

    await db.executeSql(
      `INSERT INTO offline_config (key, value) VALUES (?, ?)`,
      [testData.key, testData.value]
    );

    await addLog('INFO', 'Test record inserted', testData);

    return { success: true, data: testData };
  } catch (error) {
    console.error('[OfflineStorage] Error inserting test record:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Leer registros de prueba
 */
export const readTestRecords = async () => {
  try {
    const db = await getDatabase();
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    const [result] = await db.executeSql(
      `SELECT * FROM offline_config WHERE key LIKE 'test_key_%' ORDER BY key DESC LIMIT 10`
    );

    const records = [];
    for (let i = 0; i < result.rows.length; i++) {
      records.push(result.rows.item(i));
    }

    await addLog('INFO', 'Test records read', { count: records.length });

    return { success: true, data: records };
  } catch (error) {
    console.error('[OfflineStorage] Error reading test records:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Inicializar base de datos (llamar al inicio de la app)
 */
export const initOfflineDB = async () => {
  try {
    console.log('[OfflineStorage] 🔄 Attempting to initialize offline database...');
    const db = await getDatabase();
    
    if (!db) {
      console.log('[OfflineStorage] ⚠️ Database initialization skipped (not available on this platform)');
      return false;
    }
    
    await addLog('INFO', 'Offline database initialized');
    console.log('[OfflineStorage] ✅ Database initialized successfully');
    console.log('[OfflineStorage] ✅ Tables initialized successfully');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] ❌ Error initializing offline DB:', error);
    return false;
  }
};

// ========================================
// FUNCIONES PLACEHOLDER (implementar en fases siguientes)
// ========================================

// Jugadas
export const savePlayOffline = async (playData) => {
  await addLog('TODO', 'savePlayOffline not implemented yet', playData);
  throw new Error('Not implemented yet');
};

export const getPendingPlays = async () => {
  try {
    const db = await getDatabase();
    if (!db) return [];

    const [result] = await db.executeSql(
      `SELECT * FROM offline_plays ORDER BY created_at ASC`
    );

    const plays = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      plays.push({
        ...row,
        numeros: JSON.parse(row.numeros),
        created_at: new Date(row.created_at),
      });
    }

    return plays;
  } catch (error) {
    console.error('[OfflineStorage] Error getting pending plays:', error);
    return [];
  }
};

// =================================================================
// LOTERÍAS - FASE 5
// =================================================================

/**
 * Guardar loterías en caché offline
 * @param {Array} lotteries - Array de objetos lotería desde Supabase
 * @returns {Promise<boolean>} true si se guardó correctamente
 */
export const saveLotteries = async (lotteries) => {
  try {
    if (!Array.isArray(lotteries) || lotteries.length === 0) {
      console.log('[OfflineStorage] saveLotteries: Array vacío');
      return false;
    }

    console.log(`[OfflineStorage] Guardando ${lotteries.length} loterías en caché...`);
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return false;
    }

    // Guardar todas las loterías secuencialmente
    for (const lottery of lotteries) {
      console.log(`[OfflineStorage] Guardando lotería: ${lottery.nombre} (${lottery.id})`);
      console.log(`[OfflineStorage] Datos completos:`, JSON.stringify(lottery));
      
      await db.executeSql(
        `INSERT OR REPLACE INTO offline_lotteries 
         (id, nombre, creada_en, id_banco, cached_at, updated_at) 
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          lottery.id,
          lottery.nombre,
          lottery.creada_en,
          lottery.id_banco
        ]
      );
      
      console.log(`[OfflineStorage] ✅ Lotería guardada: ${lottery.nombre}`);
    }

    console.log(`[OfflineStorage] ✅ ${lotteries.length} loterías guardadas en caché`);
    await addLog('INFO', 'Loterías guardadas en caché', { count: lotteries.length });
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error guardando loterías:', error);
    await addLog('ERROR', 'Error guardando loterías', { error: error.message });
    return false;
  }
};

/**
 * Obtener loterías del caché offline
 * @param {number} id_banco - ID del banco
 * @returns {Promise<Array>} Array de loterías
 */
export const getLotteries = async (id_banco) => {
  try {
    console.log(`[OfflineStorage] Obteniendo loterías del caché para banco: ${id_banco}`);
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return [];
    }

    const query = id_banco
      ? `SELECT * FROM offline_lotteries WHERE id_banco = ? ORDER BY nombre ASC`
      : `SELECT * FROM offline_lotteries ORDER BY nombre ASC`;
    
    const params = id_banco ? [id_banco] : [];
    const [result] = await db.executeSql(query, params);

    const lotteries = [];
    for (let i = 0; i < result.rows.length; i++) {
      lotteries.push(result.rows.item(i));
    }

    console.log(`[OfflineStorage] ✅ ${lotteries.length} loterías encontradas en caché`);
    return lotteries;
  } catch (error) {
    console.error('[OfflineStorage] Error obteniendo loterías:', error);
    await addLog('ERROR', 'Error obteniendo loterías del caché', { error: error.message });
    return [];
  }
};

// =================================================================
// HORARIOS - FASE 5
// =================================================================

/**
 * Guardar horarios en caché offline
 * @param {Array} schedules - Array de objetos horario desde Supabase
 * @returns {Promise<boolean>} true si se guardó correctamente
 */
export const saveSchedules = async (schedules) => {
  try {
    if (!Array.isArray(schedules) || schedules.length === 0) {
      console.log('[OfflineStorage] saveSchedules: Array vacío');
      return false;
    }

    console.log(`[OfflineStorage] Guardando ${schedules.length} horarios en caché...`);
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return false;
    }

    // Guardar todos los horarios secuencialmente
    for (const schedule of schedules) {
      console.log(`[OfflineStorage] Guardando horario: ${schedule.nombre} (${schedule.id})`);
      
      await db.executeSql(
        `INSERT OR REPLACE INTO offline_schedules 
         (id, nombre, hora_inicio, hora_fin, id_loteria, cached_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          schedule.id,
          schedule.nombre,
          schedule.hora_inicio,
          schedule.hora_fin,
          schedule.id_loteria
        ]
      );
      
      console.log(`[OfflineStorage] ✅ Horario guardado: ${schedule.nombre}`);
    }

    console.log(`[OfflineStorage] ✅ ${schedules.length} horarios guardados en caché`);
    await addLog('INFO', 'Horarios guardados en caché', { count: schedules.length });
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error guardando horarios:', error);
    await addLog('ERROR', 'Error guardando horarios', { error: error.message });
    return false;
  }
};

/**
 * Obtener horarios del caché offline para una lotería
 * @param {number} id_loteria - ID de la lotería
 * @returns {Promise<Array>} Array de horarios
 */
export const getSchedules = async (id_loteria) => {
  try {
    console.log(`[OfflineStorage] Obteniendo horarios del caché para lotería: ${id_loteria}`);
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return [];
    }

    const query = id_loteria
      ? `SELECT * FROM offline_schedules WHERE id_loteria = ? ORDER BY hora_inicio ASC`
      : `SELECT * FROM offline_schedules ORDER BY hora_inicio ASC`;
    
    const params = id_loteria ? [id_loteria] : [];
    const [result] = await db.executeSql(query, params);

    const schedules = [];
    for (let i = 0; i < result.rows.length; i++) {
      schedules.push(result.rows.item(i));
    }

    console.log(`[OfflineStorage] ✅ ${schedules.length} horarios encontrados en caché`);
    return schedules;
  } catch (error) {
    console.error('[OfflineStorage] Error obteniendo horarios:', error);
    await addLog('ERROR', 'Error obteniendo horarios del caché', { error: error.message });
    return [];
  }
};

/**
 * Obtener timestamp de última actualización del caché
 * @param {string} type - Tipo de caché ('lotteries' o 'schedules')
 * @returns {Promise<number|null>} Timestamp en milisegundos o null
 */
export const getLastCacheUpdate = async (type) => {
  try {
    const value = await getConfig(`cache_update_${type}`);
    return value ? parseInt(value) : null;
  } catch (error) {
    console.error(`[OfflineStorage] Error obteniendo cache_update_${type}:`, error);
    return null;
  }
};

/**
 * Guardar timestamp de última actualización del caché
 * @param {string} type - Tipo de caché ('lotteries' o 'schedules')
 * @param {number} timestamp - Timestamp en milisegundos (Date.now())
 * @returns {Promise<boolean>} true si se guardó correctamente
 */
export const setLastCacheUpdate = async (type, timestamp) => {
  try {
    await setConfig(`cache_update_${type}`, timestamp.toString());
    console.log(`[OfflineStorage] ✅ Timestamp de ${type} actualizado:`, new Date(timestamp).toISOString());
    return true;
  } catch (error) {
    console.error(`[OfflineStorage] Error guardando cache_update_${type}:`, error);
    return false;
  }
};

// =================================================================
// JUGADAS OFFLINE - FASE 6
// =================================================================

/**
 * Guardar jugada offline en SQLite
 * @param {Object} playData - Datos de la jugada
 * @returns {Promise<Object>} { success, id?, error? }
 */
export const saveOfflinePlay = async (playData) => {
  try {
    console.log('[OfflineStorage] Guardando jugada offline...', playData);
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return { success: false, error: 'Base de datos no disponible' };
    }

    // Validar datos requeridos
    if (!playData.user_id) {
      console.error('[OfflineStorage] user_id es requerido');
      return { success: false, error: 'user_id es requerido' };
    }
    if (!playData.id_horario) {
      console.error('[OfflineStorage] id_horario es requerido');
      return { success: false, error: 'id_horario es requerido' };
    }
    if (!playData.numeros && !playData.jugada) {
      console.error('[OfflineStorage] numeros o jugada son requeridos');
      return { success: false, error: 'numeros o jugada son requeridos' };
    }

    return new Promise((resolve, reject) => {
      db.transaction(
        (tx) => {
          tx.executeSql(
            `INSERT INTO offline_plays (
              id_listero, id_horario, jugada, numeros, 
              monto_unitario, monto_total, nota, comando, id_cliente,
              created_at, created_from, status, last_error, sync_attempts, last_sync_attempt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              playData.user_id,
              playData.id_horario,
              playData.jugada || playData.numeros, // usar jugada si existe, sino numeros
              playData.numeros,
              playData.monto_unitario,
              playData.monto_total,
              playData.nota || `${playData.nombre_loteria || 'Lotería'} - ${playData.nombre_horario || 'Horario'}`,
              playData.comando || null,
              playData.id_cliente || null,
              playData.created_at || new Date().toISOString(),
              'offline', // created_from
              playData.status || 'pending',
              playData.last_error || null,
              playData.sync_attempts || 0,
              null, // last_sync_attempt
            ],
            (tx, result) => {
              const playId = result.insertId;
              console.log(`[OfflineStorage] ✅ Jugada offline guardada con ID: ${playId}`);
              resolve({ success: true, id: playId });
            },
            (tx, error) => {
              console.error('[OfflineStorage] Error SQL guardando jugada:', error);
              // Cambiar reject por resolve para mantener consistencia
              resolve({ success: false, error: error.message });
            }
          );
        },
        (error) => {
          // Error en la transacción completa
          console.error('[OfflineStorage] Error en transacción:', error);
          resolve({ success: false, error: error.message });
        },
        () => {
          // Success callback de la transacción
          console.log('[OfflineStorage] Transacción completada');
        }
      );
    });
  } catch (error) {
    console.error('[OfflineStorage] Error guardando jugada offline:', error);
    return { success: false, error: error.message };
  }
};

// =================================================================
// CREDENCIALES - FASE 4
// =================================================================
/**
 * Guardar credenciales encriptadas en SQLite
 * @param {Object} credentials - { user_id, encrypted_data, role, id_banco, last_login, session_expires }
 */
export const saveCredentials = async (credentials) => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    const {
      user_id,
      encrypted_data,
      role,
      id_banco,
      last_login,
      session_expires
    } = credentials;

    await db.executeSql(
      `INSERT OR REPLACE INTO offline_credentials 
       (user_id, encrypted_data, role, id_banco, last_login, session_expires) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, encrypted_data, role, id_banco || null, last_login, session_expires]
    );

    await addLog('INFO', 'Credentials saved', { user_id, role });
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error saving credentials:', error);
    await addLog('ERROR', 'Failed to save credentials', { error: error.message });
    return false;
  }
};

/**
 * Obtener credenciales guardadas de un usuario
 * @param {string} user_id - ID del usuario
 * @returns {Promise<Object|null>} Credenciales o null si no existen
 */
export const getCredentials = async (user_id = null) => {
  try {
    const db = await getDatabase();
    if (!db) return null;

    let query, params;
    
    if (user_id) {
      // Buscar por user_id específico
      query = 'SELECT * FROM offline_credentials WHERE user_id = ?';
      params = [user_id];
    } else {
      // Obtener las credenciales más recientes
      query = 'SELECT * FROM offline_credentials ORDER BY id DESC LIMIT 1';
      params = [];
    }

    const [result] = await db.executeSql(query, params);

    if (result.rows.length > 0) {
      const row = result.rows.item(0);
      
      // Parsear encrypted_data para obtener username
      let username = null;
      try {
        const encryptedData = JSON.parse(row.encrypted_data);
        username = encryptedData.username;
      } catch (e) {
        console.warn('[OfflineStorage] Could not parse encrypted_data for username');
      }
      
      return {
        user_id: row.user_id,
        encrypted_data: row.encrypted_data,
        username: username,
        role: row.role,
        id_banco: row.id_banco,
        last_login: row.last_login,
        session_expires: row.session_expires,
      };
    }

    return null;
  } catch (error) {
    console.error('[OfflineStorage] Error getting credentials:', error);
    await addLog('ERROR', 'Failed to get credentials', { user_id, error: error.message });
    return null;
  }
};

/**
 * Obtener credenciales por nombre de usuario
 * Busca en el JSON de encrypted_data
 * @param {string} username - Nombre de usuario a buscar
 * @returns {Promise<Object|null>} Credenciales del usuario o null
 */
export const getCredentialsByUsername = async (username) => {
  try {
    console.log('[OfflineStorage] Buscando credenciales para username:', username);
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return null;
    }

    // Obtener todas las credenciales (normalmente solo hay 1)
    const [result] = await db.executeSql(
      'SELECT * FROM offline_credentials ORDER BY id DESC LIMIT 10'
    );

    console.log('[OfflineStorage] Credenciales encontradas en BD:', result.rows.length);

    // Buscar la que coincida con el username
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      try {
        const encryptedData = JSON.parse(row.encrypted_data);
        console.log('[OfflineStorage] Verificando username:', encryptedData.username);
        
        if (encryptedData.username === username) {
          console.log('[OfflineStorage] ✅ Credenciales encontradas para', username);
          return {
            user_id: row.user_id,
            encrypted_data: row.encrypted_data,
            username: encryptedData.username,
            role: row.role,
            id_banco: row.id_banco,
            last_login: row.last_login,
            session_expires: row.session_expires,
          };
        }
      } catch (e) {
        console.warn('[OfflineStorage] Error parseando encrypted_data:', e.message);
      }
    }

    console.log('[OfflineStorage] ❌ No se encontraron credenciales para', username);
    return null;
  } catch (error) {
    console.error('[OfflineStorage] Error buscando credenciales por username:', error);
    await addLog('ERROR', 'Failed to get credentials by username', { username, error: error.message });
    return null;
  }
};

/**
 * Eliminar credenciales de un usuario
 * @param {string} user_id - ID del usuario
 */
export const deleteCredentials = async (user_id) => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.executeSql(
      `DELETE FROM offline_credentials WHERE user_id = ?`,
      [user_id]
    );

    await addLog('INFO', 'Credentials deleted', { user_id });
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error deleting credentials:', error);
    return false;
  }
};

/**
 * Eliminar TODAS las credenciales offline (sin filtro)
 * @returns {Promise<boolean>} true si se eliminaron correctamente
 */
export const deleteAllCredentials = async () => {
  try {
    console.log('[OfflineStorage] Eliminando TODAS las credenciales offline...');
    const db = await getDatabase();
    if (!db) {
      console.error('[OfflineStorage] Base de datos no disponible');
      return false;
    }

    await db.executeSql('DELETE FROM offline_credentials');
    console.log('[OfflineStorage] ✅ Todas las credenciales eliminadas');

    await addLog('INFO', 'All credentials deleted', {});
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error deleting all credentials:', error);
    return false;
  }
};

/**
 * Verificar si existen credenciales guardadas
 * @returns {Promise<boolean>} true si hay credenciales
 */
export const hasStoredCredentials = async () => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    const [result] = await db.executeSql(
      `SELECT COUNT(*) as count FROM offline_credentials`
    );

    return result.rows.item(0).count > 0;
  } catch (error) {
    console.error('[OfflineStorage] Error checking credentials:', error);
    return false;
  }
};

/**
 * Obtener timestamp del último login guardado
 */
export const getLastLoginTimestamp = async () => {
  try {
    const value = await getConfig('last_login_timestamp');
    return value ? parseInt(value) : null;
  } catch (error) {
    console.error('[OfflineStorage] Error getting last login timestamp:', error);
    return null;
  }
};

/**
 * Guardar timestamp del último login
 */
export const setLastLoginTimestamp = async (timestamp) => {
  try {
    await setConfig('last_login_timestamp', timestamp.toString());
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error setting last login timestamp:', error);
    return false;
  }
};

/**
 * Obtener valor de configuración (alias para compatibilidad)
 */
export const getConfigValue = async (key) => {
  return await getConfig(key);
};

/**
 * Establecer valor de configuración (alias para compatibilidad)
 */
export const setConfigValue = async (key, value) => {
  return await setConfig(key, value);
};

/**
 * Limpiar todas las jugadas offline
 */
export const clearAllOfflinePlays = async () => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.executeSql('DELETE FROM offline_plays');
    await addLog('INFO', 'All offline plays cleared');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error clearing offline plays:', error);
    return false;
  }
};

// Configuración
export const getConfig = async (key) => {
  try {
    const db = await getDatabase();
    if (!db) return null;

    const [result] = await db.executeSql(
      `SELECT value FROM offline_config WHERE key = ?`,
      [key]
    );

    if (result.rows.length > 0) {
      return result.rows.item(0).value;
    }
    return null;
  } catch (error) {
    console.error('[OfflineStorage] Error getting config:', error);
    return null;
  }
};

export const setConfig = async (key, value) => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.executeSql(
      `INSERT OR REPLACE INTO offline_config (key, value) VALUES (?, ?)`,
      [key, value]
    );

    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error setting config:', error);
    return false;
  }
};

/**
 * Actualiza el timestamp de expiración de sesión
 * Útil para testing (forzar expiración)
 */
export const updateSessionExpiry = async (newExpiry) => {
  const db = await getDatabase();
  if (!db) return;

  try {
    await db.executeSql(
      'UPDATE offline_credentials SET session_expires = ? WHERE id = (SELECT MAX(id) FROM offline_credentials)',
      [newExpiry.toString()]
    );
    console.log('[OfflineStorage] Session expiry updated to:', new Date(newExpiry).toLocaleString());
  } catch (error) {
    console.error('[OfflineStorage] Error updating session expiry:', error);
    throw error;
  }
};

/**
 * Obtiene información general de la base de datos
 * Para panel de testing
 */
export const getDatabaseInfo = async () => {
  const db = await getDatabase();
  if (!db) {
    return {
      credentials: 0,
      logs: 0,
      pendingPlays: 0,
      lotteries: 0,
      schedules: 0,
    };
  }

  try {
    const info = {};

    // Contar credenciales
    const [credResult] = await db.executeSql(
      'SELECT COUNT(*) as count FROM offline_credentials'
    );
    info.credentials = credResult.rows.item(0).count;

    // Contar logs
    const [logsResult] = await db.executeSql(
      'SELECT COUNT(*) as count FROM offline_logs'
    );
    info.logs = logsResult.rows.item(0).count;

    // Contar jugadas pendientes
    const [playsResult] = await db.executeSql(
      "SELECT COUNT(*) as count FROM offline_plays WHERE status = 'pending'"
    );
    info.pendingPlays = playsResult.rows.item(0).count;

    // Contar loterías
    const [lotteriesResult] = await db.executeSql(
      'SELECT COUNT(*) as count FROM offline_lotteries'
    );
    info.lotteries = lotteriesResult.rows.item(0).count;

    // Contar horarios
    const [schedulesResult] = await db.executeSql(
      'SELECT COUNT(*) as count FROM offline_schedules'
    );
    info.schedules = schedulesResult.rows.item(0).count;

    return info;
  } catch (error) {
    console.error('[OfflineStorage] Error getting database info:', error);
    throw error;
  }
};

export default {
  initOfflineDB,
  addLog,
  getLogs,
  clearLogs,
  insertTestRecord,
  readTestRecords,
  getConfig,
  setConfig,
  getConfigValue,
  setConfigValue,
  getLastLoginTimestamp,
  setLastLoginTimestamp,
  clearAllOfflinePlays,
  // Credenciales - FASE 4
  saveCredentials,
  getCredentials,
  deleteCredentials,
  deleteAllCredentials,
  hasStoredCredentials,
  updateSessionExpiry,
  getDatabaseInfo,
  getCredentialsByUsername,
  // Loterías y Horarios - FASE 5
  saveLotteries,
  getLotteries,
  saveSchedules,
  getSchedules,
  getLastCacheUpdate,
  setLastCacheUpdate,
  // Jugadas offline - FASE 6 (placeholder)
  savePlayOffline,
  getPendingPlays,
};
