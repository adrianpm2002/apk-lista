import { Platform } from 'react-native';

// Solo importar SQLite en móvil
let SQLite = null;
if (Platform.OS !== 'web') {
  SQLite = require('react-native-sqlite-storage');
  SQLite.DEBUG(true); // 🔍 DEBUG ACTIVADO para diagnosticar problemas
  SQLite.enablePromise(true);
}

const DB_NAME = 'statistics.db';
const DB_VERSION = 1;
const CACHE_REFRESH_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutos
const CACHE_DAYS = 30; // Cachear últimos 30 días

let dbInstance = null;

// ========================================
// INICIALIZACIÓN Y CONFIGURACIÓN
// ========================================

/**
 * Obtiene o crea instancia de base de datos
 */
const getDatabase = async () => {
  // Guard: SQLite solo disponible en móvil
  if (Platform.OS === 'web' || !SQLite) {
    console.warn('[SQLiteCache] SQLite not available on web platform');
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

    // Verificar/crear tablas
    await initializeTables(db);
    
    dbInstance = db;
    return db;
  } catch (error) {
    console.error('[SQLiteCache] Error opening database:', error);
    throw error;
  }
};

/**
 * Inicializar tablas y metadata
 */
const initializeTables = async (db) => {
  try {
    // Verificar versión de la base de datos
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
      // Ejecutar migraciones
      await runMigrations(db, currentVersion, DB_VERSION);
      
      // Actualizar versión
      await db.executeSql(
        "INSERT OR REPLACE INTO db_metadata (key, value) VALUES ('version', ?)",
        [DB_VERSION.toString()]
      );
    }

    return true;
  } catch (error) {
    console.error('[SQLiteCache] Error initializing tables:', error);
    throw error;
  }
};

/**
 * Ejecutar migraciones de base de datos
 */
const runMigrations = async (db, fromVersion, toVersion) => {
  console.log(`[SQLiteCache] Running migrations from v${fromVersion} to v${toVersion}`);

  if (fromVersion < 1 && toVersion >= 1) {
    // Migración v1: Crear tablas iniciales
    await createTablesV1(db);
  }

  // Futuras migraciones se agregarían aquí:
  // if (fromVersion < 2 && toVersion >= 2) { ... }
};

/**
 * Crear tablas versión 1
 */
const createTablesV1 = async (db) => {
  // Tabla para Listeros
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS listero_plays (
      id_jugada TEXT PRIMARY KEY,
      fecha_jugada TEXT NOT NULL,
      id_listero TEXT NOT NULL,
      id_colector TEXT,
      id_banco TEXT,
      id_loteria TEXT,
      id_horario TEXT,
      id_resultado TEXT,
      id_precio TEXT,
      listero_username TEXT,
      colector_username TEXT,
      tipo_jugada TEXT,
      numeros_jugados TEXT,
      monto_unitario REAL,
      monto_total REAL,
      nota TEXT,
      nombre_loteria TEXT,
      nombre_horario TEXT,
      resultado TEXT,
      numeros_ganadores TEXT,
      numeros_ganadores_jugada TEXT,
      monto_a_pagar REAL,
      hora_inicio TEXT,
      hora_fin TEXT,
      configuracion_precio TEXT,
      regular REAL,
      limitado REAL,
      numeros_limitados_por_horario TEXT,
      pct_listero REAL,
      pct_colector REAL,
      ganancia_listero REAL,
      ganancia_colector REAL,
      balance_listero REAL,
      balance_colector REAL,
      estado_horario TEXT,
      cached_at INTEGER NOT NULL,
      user_id TEXT NOT NULL
    )
  `);

  // Índices para listero_plays
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_listero_fecha 
    ON listero_plays(fecha_jugada DESC)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_listero_user_fecha 
    ON listero_plays(user_id, fecha_jugada DESC)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_listero_loteria 
    ON listero_plays(nombre_loteria)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_listero_horario 
    ON listero_plays(nombre_horario)
  `);

  // Tabla para Collectors
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS collector_plays (
      id_jugada TEXT PRIMARY KEY,
      fecha_jugada TEXT NOT NULL,
      id_listero TEXT NOT NULL,
      id_colector TEXT NOT NULL,
      id_banco TEXT,
      id_loteria TEXT,
      id_horario TEXT,
      id_resultado TEXT,
      id_precio TEXT,
      listero_username TEXT,
      colector_username TEXT,
      tipo_jugada TEXT,
      numeros_jugados TEXT,
      monto_unitario REAL,
      monto_total REAL,
      nota TEXT,
      nombre_loteria TEXT,
      nombre_horario TEXT,
      resultado TEXT,
      numeros_ganadores TEXT,
      numeros_ganadores_jugada TEXT,
      monto_a_pagar REAL,
      hora_inicio TEXT,
      hora_fin TEXT,
      configuracion_precio TEXT,
      regular REAL,
      limitado REAL,
      numeros_limitados_por_horario TEXT,
      pct_listero REAL,
      pct_colector REAL,
      ganancia_listero REAL,
      ganancia_colector REAL,
      balance_listero REAL,
      balance_colector REAL,
      estado_horario TEXT,
      cached_at INTEGER NOT NULL,
      user_id TEXT NOT NULL
    )
  `);

  // Índices para collector_plays
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_collector_fecha 
    ON collector_plays(fecha_jugada DESC)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_collector_user_fecha 
    ON collector_plays(user_id, fecha_jugada DESC)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_collector_listero 
    ON collector_plays(id_listero)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_collector_loteria 
    ON collector_plays(nombre_loteria)
  `);

  // Tabla para Admin
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS admin_plays (
      id_jugada TEXT PRIMARY KEY,
      fecha_jugada TEXT NOT NULL,
      id_listero TEXT NOT NULL,
      id_colector TEXT NOT NULL,
      id_banco TEXT NOT NULL,
      id_loteria TEXT,
      id_horario TEXT,
      id_resultado TEXT,
      id_precio TEXT,
      listero_username TEXT,
      colector_username TEXT,
      tipo_jugada TEXT,
      numeros_jugados TEXT,
      monto_unitario REAL,
      monto_total REAL,
      nota TEXT,
      nombre_loteria TEXT,
      nombre_horario TEXT,
      resultado TEXT,
      numeros_ganadores TEXT,
      numeros_ganadores_jugada TEXT,
      monto_a_pagar REAL,
      hora_inicio TEXT,
      hora_fin TEXT,
      configuracion_precio TEXT,
      regular REAL,
      limitado REAL,
      numeros_limitados_por_horario TEXT,
      pct_listero REAL,
      pct_colector REAL,
      ganancia_listero REAL,
      ganancia_colector REAL,
      balance_listero REAL,
      balance_colector REAL,
      estado_horario TEXT,
      cached_at INTEGER NOT NULL,
      user_id TEXT NOT NULL
    )
  `);

  // Índices para admin_plays
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_admin_fecha 
    ON admin_plays(fecha_jugada DESC)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_admin_user_fecha 
    ON admin_plays(user_id, fecha_jugada DESC)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_admin_colector 
    ON admin_plays(id_colector)
  `);
  await db.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_admin_loteria 
    ON admin_plays(nombre_loteria)
  `);

  // Tabla de metadata por usuario (último refresh, etc.)
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS cache_metadata (
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, role, key)
    )
  `);

  console.log('[SQLiteCache] Tables created successfully (v1)');
};

// ========================================
// OPERACIONES DE CACHÉ
// ========================================

/**
 * Obtener el nombre de tabla según el rol
 */
const getTableName = (role) => {
  switch (role) {
    case 'listero':
      return 'listero_plays';
    case 'collector':
    case 'colector':
      return 'collector_plays';
    case 'admin':
      return 'admin_plays';
    default:
      throw new Error(`[SQLiteCache] Invalid role: ${role}`);
  }
};

/**
 * Guardar jugadas en caché
 * 🔧 FIX CRÍTICO: Procesamiento en lotes para evitar saturación de SQLite
 */
export const savePlaysToCache = async (userId, role, plays) => {
  // Guard: Retornar vacío en web
  if (Platform.OS === 'web' || !SQLite) {
    return { success: true, saved: 0 };
  }

  if (!userId || !role || !plays || plays.length === 0) {
    return { success: false, saved: 0 };
  }

  try {
    const db = await getDatabase();
    if (!db) return { success: false, saved: 0 };
    
    const tableName = getTableName(role);
    const now = Date.now();

    // 🔧 FIX: Dividir en lotes de 100 registros para evitar saturar SQLite
    const BATCH_SIZE = 100;
    const batches = [];
    
    for (let i = 0; i < plays.length; i += BATCH_SIZE) {
      batches.push(plays.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`[SQLiteCache] � Procesando ${plays.length} jugadas en ${batches.length} lotes de ${BATCH_SIZE}`);
    
    let totalSaved = 0;
    let totalErrors = 0;
    
    // Procesar cada lote secuencialmente
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`[SQLiteCache] 🔄 Lote ${batchIndex + 1}/${batches.length}: ${batch.length} jugadas`);
      
      // Procesar este lote y esperar a que termine
      const batchResult = await new Promise((resolve) => {
        let savedCount = 0;
        let errorCount = 0;
        let processedCount = 0;
        const batchSize = batch.length;
        
        db.transaction(
          (tx) => {
            batch.forEach((play) => {
              try {
                // Convertir arrays a JSON strings si existen
                const numeros_ganadores = Array.isArray(play.numeros_ganadores) 
                  ? JSON.stringify(play.numeros_ganadores) 
                  : play.numeros_ganadores;
                
                const numeros_ganadores_jugada = Array.isArray(play.numeros_ganadores_jugada)
                  ? JSON.stringify(play.numeros_ganadores_jugada)
                  : play.numeros_ganadores_jugada;

                const numeros_limitados_por_horario = Array.isArray(play.numeros_limitados_por_horario)
                  ? JSON.stringify(play.numeros_limitados_por_horario)
                  : play.numeros_limitados_por_horario;

                const configuracion_precio = typeof play.configuracion_precio === 'object'
                  ? JSON.stringify(play.configuracion_precio)
                  : play.configuracion_precio;

                // 🎯 FIX: Redondear y validar valores decimales (no NaN, no Infinity)
                const roundTo2 = (value) => {
                  const num = parseFloat(value);
                  return (!isNaN(num) && isFinite(num)) ? parseFloat(num.toFixed(2)) : 0;
                };

                tx.executeSql(
                  `INSERT OR REPLACE INTO ${tableName} (
                    id_jugada, fecha_jugada, id_listero, id_colector, id_banco,
                    id_loteria, id_horario, id_resultado, id_precio,
                    listero_username, colector_username, tipo_jugada, numeros_jugados,
                    monto_unitario, monto_total, nota, nombre_loteria, nombre_horario,
                    resultado, numeros_ganadores, numeros_ganadores_jugada, monto_a_pagar,
                    hora_inicio, hora_fin, configuracion_precio, regular, limitado,
                    numeros_limitados_por_horario, pct_listero, pct_colector,
                    ganancia_listero, ganancia_colector, balance_listero, balance_colector,
                    estado_horario, cached_at, user_id
                  ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                  )`,
                  [
                    play.id_jugada,
                    play.fecha_jugada,
                    play.id_listero,
                    play.id_colector || null,
                    play.id_banco || null,
                    play.id_loteria || null,
                    play.id_horario || null,
                    play.id_resultado || null,
                    play.id_precio || null,
                    play.listero_username || null,
                    play.colector_username || null,
                    play.tipo_jugada || null,
                    play.numeros_jugados || null,
                    roundTo2(play.monto_unitario),
                    roundTo2(play.monto_total),
                    play.nota || null,
                    play.nombre_loteria || null,
                    play.nombre_horario || null,
                    play.resultado || null,
                    numeros_ganadores,
                    numeros_ganadores_jugada,
                    roundTo2(play.monto_a_pagar),
                    play.hora_inicio || null,
                    play.hora_fin || null,
                    configuracion_precio,
                    roundTo2(play.regular),
                    roundTo2(play.limitado),
                    numeros_limitados_por_horario,
                    roundTo2(play.pct_listero),
                    roundTo2(play.pct_colector),
                    roundTo2(play.ganancia_listero),
                    roundTo2(play.ganancia_colector),
                    roundTo2(play.balance_listero),
                    roundTo2(play.balance_colector),
                    play.estado_horario || null,
                    now,
                    userId
                  ],
                  () => {
                    // Success callback
                    savedCount++;
                    processedCount++;
                    // Si terminamos este lote, resolver
                    if (processedCount === batchSize) {
                      resolve({ saved: savedCount, errors: errorCount });
                    }
                  },
                  (tx, error) => {
                    // Error callback
                    errorCount++;
                    processedCount++;
                    console.warn(`[SQLiteCache] Error en jugada ${play.id_jugada}:`, error.message);
                    // Si terminamos este lote, resolver
                    if (processedCount === batchSize) {
                      resolve({ saved: savedCount, errors: errorCount });
                    }
                    return false; // Continuar transacción
                  }
                );
              } catch (error) {
                errorCount++;
                processedCount++;
                console.warn('[SQLiteCache] Error preparando jugada:', error.message);
                if (processedCount === batchSize) {
                  resolve({ saved: savedCount, errors: errorCount });
                }
              }
            });
          },
          (error) => {
            // Error en la transacción del lote
            console.error(`[SQLiteCache] ❌ Error en lote ${batchIndex + 1}:`, error.message);
            resolve({ saved: 0, errors: batchSize });
          }
        );
      });
      
      totalSaved += batchResult.saved;
      totalErrors += batchResult.errors;
      
      console.log(`[SQLiteCache] ✅ Lote ${batchIndex + 1} completado: ${batchResult.saved}/${batch.length} guardadas`);
      
      // Pequeña pausa entre lotes (50ms) para no saturar SQLite
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`[SQLiteCache] 🎉 GUARDADO COMPLETADO: ${totalSaved}/${plays.length} jugadas (${totalErrors} errores)`);
    
    // Verificación inmediata: contar directamente en la tabla
    try {
      const [countResult] = await db.executeSql(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE user_id = ?`,
        [userId]
      );
      const actualCount = countResult.rows.item(0).count;
      console.log(`[SQLiteCache] 🔍 VERIFICACIÓN INMEDIATA (COUNT): ${actualCount} registros en tabla ${tableName}`);
      
      if (actualCount === 0 && totalSaved > 0) {
        console.error(`[SQLiteCache] ⚠️ ERROR CRÍTICO: Se guardaron ${totalSaved} pero COUNT devuelve 0`);
        console.error(`[SQLiteCache] 🔧 Posibles causas: transacción fallida, userId incorrecto, tabla incorrecta`);
      } else if (actualCount !== totalSaved) {
        console.warn(`[SQLiteCache] ⚠️ DISCREPANCIA: Guardados=${totalSaved}, COUNT=${actualCount}`);
      } else {
        console.log(`[SQLiteCache] ✅ ÉXITO: COUNT coincide con guardados (${actualCount})`);
      }
    } catch (countError) {
      console.error('[SQLiteCache] ❌ Error en COUNT verification:', countError.message);
    }
    
    // Verificación secundaria: leer usando readPlaysFromCache
    try {
      const verification = await readPlaysFromCache(userId, role, {});
      console.log(`[SQLiteCache] 🔍 VERIFICACIÓN SECUNDARIA (READ): ${verification.length} jugadas en caché`);
      
      if (verification.length === 0 && totalSaved > 0) {
        console.error(`[SQLiteCache] ⚠️ ADVERTENCIA: READ devuelve 0 pero COUNT puede diferir`);
      }
    } catch (verifyError) {
      console.warn('[SQLiteCache] Error en READ verification:', verifyError.message);
    }
    
    return { success: true, saved: totalSaved, failed: totalErrors };
    
  } catch (error) {
    console.error('[SQLiteCache] Error in savePlaysToCache:', error);
    return { success: false, saved: 0, error: error.message };
  }
};

/**
 * Leer jugadas del caché con filtros
 */
export const readPlaysFromCache = async (userId, role, filters = {}) => {
  // Guard: Retornar vacío en web
  if (Platform.OS === 'web' || !SQLite) {
    return [];
  }

  if (!userId || !role) {
    return [];
  }

  try {
    const db = await getDatabase();
    if (!db) return [];
    
    const tableName = getTableName(role);
    
    const { startDate, endDate, loteria, horario } = filters;

    let query = `SELECT * FROM ${tableName} WHERE user_id = ?`;
    const params = [userId];

    // Filtro por fecha
    if (startDate) {
      query += ` AND fecha_jugada >= ?`;
      const startStr = formatDateForSQL(startDate);
      params.push(startStr);
      console.log(`[SQLiteCache] 🔍 Filtro startDate: ${startStr}`);
    }
    if (endDate) {
      query += ` AND fecha_jugada <= ?`;
      const endStr = formatDateForSQL(endDate);
      params.push(endStr);
      console.log(`[SQLiteCache] 🔍 Filtro endDate: ${endStr}`);
    }

    // Filtro por lotería
    if (loteria && loteria !== 'all') {
      query += ` AND nombre_loteria = ?`;
      params.push(loteria);
    }

    // Filtro por horario
    if (horario && horario !== 'all') {
      query += ` AND nombre_horario = ?`;
      params.push(horario);
    }

    query += ` ORDER BY fecha_jugada DESC`;

    console.log(`[SQLiteCache] 📊 Query: ${query}`);
    console.log(`[SQLiteCache] 📊 Params:`, params);

    const [results] = await db.executeSql(query, params);
    
    const plays = [];
    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      
      // Parsear JSON strings de vuelta a arrays/objects
      try {
        row.numeros_ganadores = row.numeros_ganadores ? JSON.parse(row.numeros_ganadores) : null;
      } catch (e) {
        row.numeros_ganadores = row.numeros_ganadores;
      }

      try {
        row.numeros_ganadores_jugada = row.numeros_ganadores_jugada ? JSON.parse(row.numeros_ganadores_jugada) : null;
      } catch (e) {
        row.numeros_ganadores_jugada = row.numeros_ganadores_jugada;
      }

      try {
        row.numeros_limitados_por_horario = row.numeros_limitados_por_horario ? JSON.parse(row.numeros_limitados_por_horario) : null;
      } catch (e) {
        row.numeros_limitados_por_horario = row.numeros_limitados_por_horario;
      }

      try {
        row.configuracion_precio = row.configuracion_precio ? JSON.parse(row.configuracion_precio) : null;
      } catch (e) {
        row.configuracion_precio = row.configuracion_precio;
      }

      plays.push(row);
    }

    console.log(`[SQLiteCache] Read ${plays.length} plays from ${tableName}`);
    return plays;
  } catch (error) {
    console.error('[SQLiteCache] Error reading from cache:', error);
    return [];
  }
};

/**
 * Verificar si necesita actualización incremental
 */
export const needsIncrementalUpdate = async (userId, role) => {
  // Guard: En web siempre retornar false (no actualizar)
  if (Platform.OS === 'web' || !SQLite) {
    return false;
  }

  try {
    const db = await getDatabase();
    if (!db) return false;
    
    const [results] = await db.executeSql(
      `SELECT value, updated_at FROM cache_metadata 
       WHERE user_id = ? AND role = ? AND key = 'last_incremental_update'`,
      [userId, role]
    );

    if (results.rows.length === 0) {
      return true; // Primera vez, necesita actualización
    }

    const lastUpdate = parseInt(results.rows.item(0).updated_at);
    const now = Date.now();
    const diff = now - lastUpdate;

    return diff >= CACHE_REFRESH_THRESHOLD_MS;
  } catch (error) {
    console.error('[SQLiteCache] Error checking incremental update:', error);
    return true; // En caso de error, asumir que necesita actualización
  }
};

/**
 * Actualizar timestamp de última actualización incremental
 */
export const updateIncrementalTimestamp = async (userId, role) => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    return true;
  }

  try {
    const db = await getDatabase();
    if (!db) return false;
    
    const now = Date.now();

    await db.executeSql(
      `INSERT OR REPLACE INTO cache_metadata (user_id, role, key, value, updated_at)
       VALUES (?, ?, 'last_incremental_update', ?, ?)`,
      [userId, role, now.toString(), now]
    );

    console.log(`[SQLiteCache] Updated incremental timestamp for ${role}`);
    return true;
  } catch (error) {
    console.error('[SQLiteCache] Error updating timestamp:', error);
    return false;
  }
};

/**
 * Limpiar registros antiguos (> 30 días)
 */
export const cleanOldRecords = async (userId, role) => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    return 0;
  }

  try {
    const db = await getDatabase();
    if (!db) return 0;
    
    const tableName = getTableName(role);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CACHE_DAYS);
    const cutoffStr = formatDateForSQL(cutoffDate);

    const [result] = await db.executeSql(
      `DELETE FROM ${tableName} WHERE user_id = ? AND fecha_jugada < ?`,
      [userId, cutoffStr]
    );

    const deleted = result.rowsAffected || 0;
    if (deleted > 0) {
      console.log(`[SQLiteCache] Deleted ${deleted} old records from ${tableName}`);
    }

    return deleted;
  } catch (error) {
    console.error('[SQLiteCache] Error cleaning old records:', error);
    return 0;
  }
};

/**
 * Borrar todo el caché de un usuario (logout)
 */
export const clearUserCache = async (userId) => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    return true;
  }

  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.transaction(async (tx) => {
      await tx.executeSql('DELETE FROM listero_plays WHERE user_id = ?', [userId]);
      await tx.executeSql('DELETE FROM collector_plays WHERE user_id = ?', [userId]);
      await tx.executeSql('DELETE FROM admin_plays WHERE user_id = ?', [userId]);
      await tx.executeSql('DELETE FROM cache_metadata WHERE user_id = ?', [userId]);
    });

    console.log(`[SQLiteCache] Cleared all cache for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[SQLiteCache] Error clearing user cache:', error);
    return false;
  }
};

/**
 * Borrar TODA la base de datos (para troubleshooting)
 */
export const clearAllCache = async () => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    return true;
  }

  try {
    const db = await getDatabase();
    if (!db) return false;

    await db.transaction(async (tx) => {
      await tx.executeSql('DELETE FROM listero_plays');
      await tx.executeSql('DELETE FROM collector_plays');
      await tx.executeSql('DELETE FROM admin_plays');
      await tx.executeSql('DELETE FROM cache_metadata');
    });

    console.log('[SQLiteCache] Cleared ALL cache');
    return true;
  } catch (error) {
    console.error('[SQLiteCache] Error clearing all cache:', error);
    return false;
  }
};

/**
 * Obtener estadísticas del caché
 */
export const getCacheStats = async (userId, role) => {
  // Guard: En web retornar vacío
  if (Platform.OS === 'web' || !SQLite) {
    return { count: 0, oldest: null, newest: null, tableName: null };
  }

  try {
    const db = await getDatabase();
    if (!db) return { count: 0, oldest: null, newest: null, tableName: null };
    
    const tableName = getTableName(role);

    const [countResult] = await db.executeSql(
      `SELECT COUNT(*) as count FROM ${tableName} WHERE user_id = ?`,
      [userId]
    );

    const [dateRangeResult] = await db.executeSql(
      `SELECT MIN(fecha_jugada) as oldest, MAX(fecha_jugada) as newest 
       FROM ${tableName} WHERE user_id = ?`,
      [userId]
    );

    const count = countResult.rows.item(0).count;
    const oldest = dateRangeResult.rows.item(0).oldest;
    const newest = dateRangeResult.rows.item(0).newest;

    return {
      count,
      oldest,
      newest,
      tableName
    };
  } catch (error) {
    console.error('[SQLiteCache] Error getting cache stats:', error);
    return { count: 0, oldest: null, newest: null, tableName: null };
  }
};

// ========================================
// UTILIDADES
// ========================================

/**
 * Formatear fecha para Supabase/SQL en formato timestamp LOCAL (NO UTC)
 * Supabase usa: "YYYY-MM-DD HH:MM:SS.mmmmmm" (timestamp sin timezone)
 * NO usar toISOString() porque agrega "Z" y convierte a UTC
 */
const formatDateForSQL = (date) => {
  if (typeof date === 'string') return date;
  
  // Convertir a timestamp local en formato Supabase
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  // Formato: "2025-10-15 16:34:10.952"
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

/**
 * Formatear fecha para operaciones de DB (inserts/deletes)
 * Debe ser idéntico a formatDateForSQL para consistencia
 */
const formatDateForDB = (date) => {
  if (typeof date === 'string') return date;
  
  // Convertir a timestamp local en formato Supabase
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  
  // Formato: "2025-10-15 16:34:10.952"
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
};

/**
 * Eliminar jugadas de un rango de fechas específico
 * Útil para reemplazar datos de HOY, AYER, o un período específico
 */
export const deletePlaysByDateRange = async (userId, role, startDate, endDate) => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    console.log('[SQLiteCache] deletePlaysByDateRange: Running on web, skipping');
    return;
  }

  try {
    const db = await getDatabase();
    if (!db) {
      console.error('[SQLiteCache] deletePlaysByDateRange: No database');
      return;
    }

    const tableName = getTableName(role);
    const startStr = formatDateForDB(startDate);
    const endStr = formatDateForDB(endDate);

    console.log(`[SQLiteCache] 🗑️ Eliminando jugadas del ${startStr} al ${endStr} en ${tableName}`);

    await db.executeSql(
      `DELETE FROM ${tableName} 
       WHERE user_id = ? 
       AND fecha_jugada >= ? 
       AND fecha_jugada <= ?`,
      [userId, startStr, endStr]
    );

    console.log('[SQLiteCache] ✅ Jugadas eliminadas exitosamente');
  } catch (error) {
    console.error('[SQLiteCache] ❌ Error eliminando jugadas por rango:', error);
    throw error;
  }
};

/**
 * Reemplazar jugadas de un rango de fechas específico
 * 1. Elimina las jugadas existentes del rango
 * 2. Inserta las nuevas jugadas
 * 3. Actualiza metadata
 */
export const replacePlaysByDateRange = async (userId, role, plays, startDate, endDate) => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    console.log('[SQLiteCache] replacePlaysByDateRange: Running on web, skipping');
    return;
  }

  try {
    console.log(`[SQLiteCache] 🔄 Reemplazando jugadas del ${startDate.toLocaleDateString()} al ${endDate.toLocaleDateString()}`);
    
    // Paso 1: Eliminar jugadas existentes del rango
    await deletePlaysByDateRange(userId, role, startDate, endDate);

    // Paso 2: Insertar nuevas jugadas (si hay)
    if (plays && plays.length > 0) {
      await savePlaysToCache(userId, role, plays);
      console.log(`[SQLiteCache] ✅ ${plays.length} jugadas reemplazadas exitosamente`);
    } else {
      console.log('[SQLiteCache] ℹ️ No hay jugadas nuevas para insertar (rango vacío)');
      // Aún así actualizar metadata para registrar que este rango fue consultado
      await updateIncrementalTimestamp(userId, role);
    }
  } catch (error) {
    console.error('[SQLiteCache] ❌ Error reemplazando jugadas:', error);
    throw error;
  }
};

/**
 * Cierra la base de datos
 */
export const closeDatabase = async () => {
  // Guard: En web no hacer nada
  if (Platform.OS === 'web' || !SQLite) {
    return;
  }

  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      console.log('[SQLiteCache] Database closed');
    } catch (error) {
      console.error('[SQLiteCache] Error closing database:', error);
    }
  }
};

/**
 * 🔍 DEBUG: Verificar integridad de la base de datos
 */
export const debugDatabase = async () => {
  if (Platform.OS === 'web' || !SQLite) {
    console.log('[SQLiteCache] DEBUG: Running on web, no SQLite');
    return;
  }

  try {
    const db = await getDatabase();
    if (!db) {
      console.log('[SQLiteCache] DEBUG: No database instance');
      return;
    }
    
    console.log('[SQLiteCache] ==================== DEBUG DATABASE ====================');
    
    // Verificar tablas
    const [tables] = await db.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    
    console.log('[SQLiteCache] DEBUG: Tables found:', tables.rows.length);
    for (let i = 0; i < tables.rows.length; i++) {
      const tableName = tables.rows.item(i).name;
      
      // No contar tablas del sistema
      if (tableName.startsWith('sqlite_')) continue;
      
      const [count] = await db.executeSql(`SELECT COUNT(*) as cnt FROM ${tableName}`);
      const rowCount = count.rows.item(0).cnt;
      console.log(`[SQLiteCache] DEBUG: Table "${tableName}" has ${rowCount} rows`);
      
      // Si la tabla tiene datos, mostrar el registro más reciente
      if (rowCount > 0) {
        const [recent] = await db.executeSql(
          `SELECT fecha_jugada, cached_at FROM ${tableName} ORDER BY cached_at DESC LIMIT 1`
        );
        const recentPlay = recent.rows.item(0);
        console.log(`[SQLiteCache] DEBUG:   └─ Most recent: fecha_jugada=${recentPlay.fecha_jugada}, cached_at=${recentPlay.cached_at}`);
      }
    }
    
    // Verificar espacio en disco
    const [pragma] = await db.executeSql('PRAGMA page_count');
    const [pageSize] = await db.executeSql('PRAGMA page_size');
    const totalSize = pragma.rows.item(0).page_count * pageSize.rows.item(0).page_size;
    console.log('[SQLiteCache] DEBUG: Database size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
    
    // Verificar metadata
    const [metadata] = await db.executeSql('SELECT * FROM cache_metadata');
    console.log('[SQLiteCache] DEBUG: Metadata entries:', metadata.rows.length);
    for (let i = 0; i < metadata.rows.length; i++) {
      const meta = metadata.rows.item(i);
      console.log(`[SQLiteCache] DEBUG:   └─ User ${meta.user_id} (${meta.role}): oldest=${meta.oldest_date}, newest=${meta.newest_date}, last_incremental=${meta.last_incremental_fetch}`);
    }
    
    console.log('[SQLiteCache] =========================================================');
    
  } catch (error) {
    console.error('[SQLiteCache] DEBUG ERROR:', error);
  }
};

// Exportar constantes útiles
export const CACHE_CONSTANTS = {
  REFRESH_THRESHOLD_MS: CACHE_REFRESH_THRESHOLD_MS,
  CACHE_DAYS,
  DB_VERSION
};
