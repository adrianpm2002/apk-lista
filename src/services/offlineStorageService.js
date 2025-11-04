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
      last_sync TEXT NOT NULL
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
      created_at TEXT NOT NULL,
      last_sync TEXT NOT NULL
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
// ========================================
// JUGADAS OFFLINE
// ========================================

/**
 * Guardar jugada offline para sincronizar después
 * @param {Object} playData - Datos de la jugada
 */
export const savePlayOffline = async (playData) => {
  try {
    const db = await getDatabase();
    if (!db) {
      console.log('[OfflineStorage] DB not available, cannot save play');
      return false;
    }

    const {
      id_loteria,
      id_horario,
      tipo_jugada,
      numeros,
      monto_unitario,
      monto_total,
      user_id,
      id_banco
    } = playData;

    await db.executeSql(
      `INSERT INTO offline_plays 
       (id_loteria, id_horario, tipo_jugada, numeros, monto_unitario, monto_total, 
        user_id, id_banco, pending, synced, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, datetime('now'))`,
      [
        id_loteria,
        id_horario,
        tipo_jugada,
        numeros, // Puede ser string "12,34,56" o único "12"
        monto_unitario,
        monto_total,
        user_id,
        id_banco
      ]
    );

    await addLog('info', 'Jugada guardada offline', {
      tipo_jugada,
      numeros,
      monto_total
    });

    console.log('[OfflineStorage] ✅ Jugada guardada offline:', tipo_jugada, numeros);
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error saving play offline:', error);
    await addLog('error', 'Error guardando jugada offline', {
      error: error.message,
      playData
    });
    return false;
  }
};

/**
 * Obtener jugadas pendientes de sincronizar
 * @returns {Array} Jugadas con pending=true
 */
export const getPendingPlays = async () => {
  try {
    const db = await getDatabase();
    if (!db) return [];

    const [result] = await db.executeSql(
      `SELECT * FROM offline_plays WHERE pending = 1 ORDER BY created_at ASC`
    );

    const plays = [];
    for (let i = 0; i < result.rows.length; i++) {
      plays.push(result.rows.item(i));
    }

    console.log(`[OfflineStorage] 📋 ${plays.length} jugadas pendientes`);
    return plays;
  } catch (error) {
    console.error('[OfflineStorage] Error getting pending plays:', error);
    return [];
  }
};

/**
 * Marcar jugada como sincronizada
 * @param {number} play_id - ID de la jugada offline
 */
export const markPlayAsSynced = async (play_id) => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.executeSql(
      `UPDATE offline_plays 
       SET pending = 0, synced = 1, sync_timestamp = datetime('now') 
       WHERE id = ?`,
      [play_id]
    );

    console.log(`[OfflineStorage] ✅ Jugada ${play_id} marcada como sincronizada`);
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error marking play as synced:', error);
    return false;
  }
};

/**
 * Eliminar jugada offline
 * @param {number} play_id - ID de la jugada offline
 */
export const deleteOfflinePlay = async (play_id) => {
  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.executeSql(`DELETE FROM offline_plays WHERE id = ?`, [play_id]);

    console.log(`[OfflineStorage] 🗑️ Jugada ${play_id} eliminada`);
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error deleting play:', error);
    return false;
  }
};

// ========================================
// LOTERÍAS Y HORARIOS OFFLINE
// ========================================

/**
 * Guardar loterías en SQLite para uso offline
 * @param {Array} lotteries - Array de loterías desde Supabase
 * @param {number} id_banco - ID del banco (opcional, para filtrar)
 */
export const saveLotteries = async (lotteries, id_banco = null) => {
  try {
    const db = await getDatabase();
    if (!db) {
      console.log('[OfflineStorage] DB not available, skipping lottery save');
      return false;
    }

    if (!Array.isArray(lotteries) || lotteries.length === 0) {
      console.log('[OfflineStorage] No lotteries to save');
      return false;
    }

    // Limpiar loterías anteriores del banco (si se especifica)
    if (id_banco) {
      await db.executeSql('DELETE FROM offline_lotteries WHERE id_banco = ?', [id_banco]);
    } else {
      await db.executeSql('DELETE FROM offline_lotteries');
    }

    // Insertar loterías
    for (const lottery of lotteries) {
      await db.executeSql(
        `INSERT INTO offline_lotteries 
         (id_loteria, nombre, id_banco, activo, fecha_sync) 
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [
          lottery.id_loteria,
          lottery.nombre,
          lottery.id_banco,
          lottery.activo ? 1 : 0
        ]
      );
    }

    await addLog('info', 'Loterías guardadas offline', { 
      count: lotteries.length,
      id_banco 
    });
    console.log(`[OfflineStorage] ✅ ${lotteries.length} loterías guardadas`);
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error saving lotteries:', error);
    await addLog('error', 'Error guardando loterías', { error: error.message });
    return false;
  }
};

/**
 * Obtener loterías guardadas offline
 * @param {number} id_banco - ID del banco (opcional)
 */
export const getLotteries = async (id_banco = null) => {
  try {
    const db = await getDatabase();
    if (!db) return [];

    let query = 'SELECT * FROM offline_lotteries WHERE activo = 1';
    const params = [];

    if (id_banco) {
      query += ' AND id_banco = ?';
      params.push(id_banco);
    }

    query += ' ORDER BY nombre';

    const [result] = await db.executeSql(query, params);
    
    const lotteries = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      lotteries.push({
        id_loteria: row.id_loteria,
        nombre: row.nombre,
        id_banco: row.id_banco,
        activo: row.activo === 1,
        fecha_sync: row.fecha_sync
      });
    }

    console.log(`[OfflineStorage] 📋 ${lotteries.length} loterías obtenidas offline`);
    return lotteries;
  } catch (error) {
    console.error('[OfflineStorage] Error getting lotteries:', error);
    return [];
  }
};

/**
 * Guardar horarios en SQLite para uso offline
 * @param {Array} schedules - Array de horarios desde Supabase
 */
export const saveSchedules = async (schedules) => {
  try {
    const db = await getDatabase();
    if (!db) {
      console.log('[OfflineStorage] DB not available, skipping schedules save');
      return false;
    }

    if (!Array.isArray(schedules) || schedules.length === 0) {
      console.log('[OfflineStorage] No schedules to save');
      return false;
    }

    // Limpiar horarios anteriores
    await db.executeSql('DELETE FROM offline_schedules');

    // Insertar horarios
    for (const schedule of schedules) {
      await db.executeSql(
        `INSERT INTO offline_schedules 
         (id_horario, id_loteria, hora_cierre, activo, fecha_sync) 
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [
          schedule.id_horario,
          schedule.id_loteria,
          schedule.hora_cierre,
          schedule.activo ? 1 : 0
        ]
      );
    }

    await addLog('info', 'Horarios guardados offline', { count: schedules.length });
    console.log(`[OfflineStorage] ✅ ${schedules.length} horarios guardados`);
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error saving schedules:', error);
    await addLog('error', 'Error guardando horarios', { error: error.message });
    return false;
  }
};

/**
 * Obtener horarios guardados offline para una lotería
 * @param {number} id_loteria - ID de la lotería
 */
export const getSchedules = async (id_loteria = null) => {
  try {
    const db = await getDatabase();
    if (!db) return [];

    let query = 'SELECT * FROM offline_schedules WHERE activo = 1';
    const params = [];

    if (id_loteria) {
      query += ' AND id_loteria = ?';
      params.push(id_loteria);
    }

    query += ' ORDER BY hora_cierre';

    const [result] = await db.executeSql(query, params);
    
    const schedules = [];
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i);
      schedules.push({
        id_horario: row.id_horario,
        id_loteria: row.id_loteria,
        hora_cierre: row.hora_cierre,
        activo: row.activo === 1,
        fecha_sync: row.fecha_sync
      });
    }

    console.log(`[OfflineStorage] ⏰ ${schedules.length} horarios obtenidos offline`);
    return schedules;
  } catch (error) {
    console.error('[OfflineStorage] Error getting schedules:', error);
    return [];
  }
};

// ========================================
// CREDENCIALES OFFLINE
// ========================================

/**
 * Hash simple para contraseñas (no usar en producción real)
 * En producción usar bcrypt o similar
 */
const hashPassword = (password) => {
  // Simple hash - en producción usar bcrypt
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

/**
 * Guardar credenciales del usuario para login offline
 * @param {Object} credentials - { user_id, username, password, email, profile }
 */
export const saveCredentials = async (credentials) => {
  try {
    const db = await getDatabase();
    if (!db) {
      console.log('[OfflineStorage] DB not available, skipping credential save');
      return false;
    }

    const { user_id, username, password, email, profile } = credentials;
    const hashedPassword = hashPassword(password);

    await db.executeSql(
      `INSERT OR REPLACE INTO offline_credentials 
       (user_id, username, password_hash, email, profile_data, last_login, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        user_id,
        username,
        hashedPassword,
        email,
        JSON.stringify(profile),
      ]
    );

    await addLog('info', 'Credenciales guardadas para offline', { user_id, username });
    console.log('[OfflineStorage] ✅ Credentials saved for offline login:', username);
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error saving credentials:', error);
    await addLog('error', 'Error guardando credenciales', { error: error.message });
    return false;
  }
};

/**
 * Obtener credenciales guardadas por username
 * @param {string} username - Nombre de usuario
 */
export const getCredentialsByUsername = async (username) => {
  try {
    const db = await getDatabase();
    if (!db) return null;

    const [result] = await db.executeSql(
      `SELECT * FROM offline_credentials WHERE username = ?`,
      [username]
    );

    if (result.rows.length > 0) {
      const row = result.rows.item(0);
      return {
        user_id: row.user_id,
        username: row.username,
        password_hash: row.password_hash,
        email: row.email,
        profile: JSON.parse(row.profile_data || '{}'),
        last_login: row.last_login,
      };
    }

    return null;
  } catch (error) {
    console.error('[OfflineStorage] Error getting credentials:', error);
    return null;
  }
};

/**
 * Validar contraseña contra hash guardado
 * @param {string} password - Contraseña a validar
 * @param {string} storedHash - Hash guardado
 */
export const validatePassword = (password, storedHash) => {
  const inputHash = hashPassword(password);
  return inputHash === storedHash;
};

/**
 * Obtener credenciales por user_id (legacy)
 */
export const getCredentials = async (user_id) => {
  try {
    const db = await getDatabase();
    if (!db) return null;

    const [result] = await db.executeSql(
      `SELECT * FROM offline_credentials WHERE user_id = ?`,
      [user_id]
    );

    if (result.rows.length > 0) {
      const row = result.rows.item(0);
      return {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        profile: JSON.parse(row.profile_data || '{}'),
        last_login: row.last_login,
      };
    }

    return null;
  } catch (error) {
    console.error('[OfflineStorage] Error getting credentials:', error);
    await addLog('error', 'Error obteniendo credenciales', { user_id, error: error.message });
    return null;
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

export default {
  initOfflineDB,
  addLog,
  getLogs,
  clearLogs,
  insertTestRecord,
  readTestRecords,
  getConfig,
  setConfig,
  // Credenciales
  saveCredentials,
  getCredentials,
  getCredentialsByUsername,
  validatePassword,
  // Jugadas offline
  savePlayOffline,
  getPendingPlays,
  markPlayAsSynced,
  deleteOfflinePlay,
  // Loterías y horarios
  saveLotteries,
  getLotteries,
  saveSchedules,
  getSchedules,
};
