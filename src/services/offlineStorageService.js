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
    console.warn('[OfflineStorage] SQLite not available on web platform');
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
    await getDatabase();
    await addLog('INFO', 'Offline database initialized');
    return true;
  } catch (error) {
    console.error('[OfflineStorage] Error initializing offline DB:', error);
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
  await addLog('TODO', 'getPendingPlays not implemented yet');
  return [];
};

// Loterías
export const saveLotteries = async (lotteries) => {
  await addLog('TODO', 'saveLotteries not implemented yet', { count: lotteries?.length });
  throw new Error('Not implemented yet');
};

export const getLotteries = async (id_banco) => {
  await addLog('TODO', 'getLotteries not implemented yet', { id_banco });
  return [];
};

// Horarios
export const saveSchedules = async (schedules) => {
  await addLog('TODO', 'saveSchedules not implemented yet', { count: schedules?.length });
  throw new Error('Not implemented yet');
};

export const getSchedules = async (id_loteria) => {
  await addLog('TODO', 'getSchedules not implemented yet', { id_loteria });
  return [];
};

// Credenciales
export const saveCredentials = async (credentials) => {
  await addLog('TODO', 'saveCredentials not implemented yet');
  throw new Error('Not implemented yet');
};

export const getCredentials = async (user_id) => {
  await addLog('TODO', 'getCredentials not implemented yet', { user_id });
  return null;
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
  // Placeholders
  savePlayOffline,
  getPendingPlays,
  saveLotteries,
  getLotteries,
  saveSchedules,
  getSchedules,
  saveCredentials,
  getCredentials,
};
