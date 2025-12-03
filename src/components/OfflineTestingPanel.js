import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useConnection } from '../hooks/useConnection';
import { useOffline } from '../contexts/OfflineContext';
import * as OfflineStorage from '../services/offlineStorageService';
import { authService } from '../services/authService';
import { supabase } from '../supabaseClient';

/**
 * Panel de Testing para funcionalidades offline
 */
const OfflineTestingPanel = ({ inline = false, allowWeb = false, onClose }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { isOnline, isChecking } = useConnection();
  
  // Usar useOffline de forma segura (puede no estar disponible en LoginScreen)
  let offlineContext = null;
  try {
    offlineContext = useOffline();
  } catch (error) {
    console.log('[OfflineTestingPanel] OfflineContext no disponible (probablemente en LoginScreen)');
  }
  
  const isOfflineModeEnabled = offlineContext?.isOfflineModeEnabled || false;
  const toggleOfflineMode = offlineContext?.toggleOfflineMode || (() => {
    Alert.alert('Error', 'Contexto offline no disponible. Inicia sesión primero.');
  });
  const contextIsOnline = offlineContext?.isOnline ?? true;

  // No mostrar en web a menos que se permita explícitamente
  if (Platform.OS === 'web' && !allowWeb) {
    return null;
  }

  const handleOpenPanel = () => {
    console.log('[OfflineTestingPanel] Opening panel...');
    setModalVisible(true);
  };

  const handleClosePanel = () => {
    setModalVisible(false);
    if (onClose) onClose();
  };

  // ============================================
  // PRUEBAS FASE 4: LOGIN OFFLINE
  // ============================================

  const testCheckStoredCredentials = async () => {
    try {
      const hasCredentials = await OfflineStorage.hasStoredCredentials();
      
      if (hasCredentials) {
        // Mostrar más detalles
        const credentials = await OfflineStorage.getCredentials();
        if (credentials) {
          Alert.alert(
            '✅ Credenciales Guardadas',
            `Usuario: ${credentials.username || 'N/A'}\n` +
            `User ID: ${credentials.user_id || 'N/A'}\n` +
            `Rol: ${credentials.role || 'N/A'}\n` +
            `ID Banco: ${credentials.id_banco || 'N/A'}\n` +
            `Último Login: ${credentials.last_login ? new Date(parseInt(credentials.last_login)).toLocaleString() : 'N/A'}`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('✅ Credenciales Guardadas', 'Existen pero no se pudieron leer');
        }
      } else {
        Alert.alert('❌ Sin Credenciales', 'No hay credenciales guardadas. Haz login online primero.');
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo verificar: ${error.message}`);
    }
  };

  const testValidateOfflineSession = async () => {
    try {
      const result = await authService.validateOfflineSession();
      
      if (result.valid) {
        const expiresIn = Math.floor((result.expiresAt - Date.now()) / (1000 * 60 * 60));
        Alert.alert(
          '✅ Sesión Válida',
          `La sesión es válida (<24h)\n\n` +
          `Expira en: ${expiresIn} horas\n` +
          `Fecha de expiración: ${new Date(result.expiresAt).toLocaleString()}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Sesión Expirada',
          result.error || 'La sesión ha expirado (>24h) o no existe',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo validar: ${error.message}`);
    }
  };

  const testClearCredentials = async () => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar todas las credenciales guardadas?\n\nEsto cerrará tu sesión offline.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[TestingPanel] Solicitando eliminar TODAS las credenciales...');
              const result = await OfflineStorage.deleteAllCredentials();
              if (result) {
                console.log('[TestingPanel] ✅ Credenciales eliminadas exitosamente');
                Alert.alert('Éxito', '✅ Credenciales eliminadas correctamente');
              } else {
                console.error('[TestingPanel] ❌ deleteAllCredentials retornó false');
                Alert.alert('Error', 'No se pudieron eliminar las credenciales');
              }
            } catch (error) {
              console.error('[TestingPanel] Error al eliminar:', error);
              Alert.alert('Error', `No se pudo eliminar: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const testViewLastLogin = async () => {
    try {
      const credentials = await OfflineStorage.getCredentials();
      
      if (credentials && credentials.last_login) {
        const timestamp = parseInt(credentials.last_login);
        const date = new Date(timestamp);
        const hoursAgo = ((Date.now() - timestamp) / (1000 * 60 * 60)).toFixed(1);
        const daysAgo = ((Date.now() - timestamp) / (1000 * 60 * 60 * 24)).toFixed(2);
        
        Alert.alert(
          '📅 Último Login',
          `Fecha: ${date.toLocaleDateString()}\n` +
          `Hora: ${date.toLocaleTimeString()}\n\n` +
          `Hace: ${hoursAgo} horas\n` +
          `(${daysAgo} días)`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Info', '❌ No hay registro de último login');
      }
    } catch (error) {
      Alert.alert('Error', `No se pudo obtener: ${error.message}`);
    }
  };

  const testEncryption = async () => {
    try {
      const { encryptPassword, decryptPassword } = require('../services/encryptionService');
      const testPassword = 'MiPassword123!';
      
      // Encriptar
      const encrypted = await encryptPassword(testPassword);
      
      // Desencriptar
      const decrypted = await decryptPassword(encrypted);
      
      const success = decrypted === testPassword;
      
      Alert.alert(
        success ? '✅ Encriptación OK' : '❌ Error de Encriptación',
        `Original: ${testPassword}\n` +
        `Encriptado: ${encrypted.substring(0, 30)}...\n` +
        `Desencriptado: ${decrypted}\n\n` +
        `Estado: ${success ? 'CORRECTO' : 'FALLÓ'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', `Prueba de encriptación falló: ${error.message}`);
    }
  };

  const testForceExpireSession = async () => {
    Alert.alert(
      'Confirmar',
      '¿Forzar expiración de sesión?\n\nEsto hará que la sesión aparezca como expirada (útil para testing).',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expirar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Cambiar session_expires a hace 25 horas
              const expiredTime = Date.now() - (25 * 60 * 60 * 1000);
              await OfflineStorage.updateSessionExpiry(expiredTime);
              Alert.alert('Éxito', '✅ Sesión marcada como expirada. Prueba validar sesión ahora.');
            } catch (error) {
              Alert.alert('Error', `No se pudo expirar: ${error.message}`);
            }
          }
        }
      ]
    );
  };

  const testDatabaseInfo = async () => {
    try {
      const info = await OfflineStorage.getDatabaseInfo();
      
      Alert.alert(
        '🗄️ Info de Base de Datos',
        `Credenciales: ${info.credentials || 0}\n` +
        `Logs: ${info.logs || 0}\n` +
        `Jugadas pendientes: ${info.pendingPlays || 0}\n` +
        `Loterías en caché: ${info.lotteries || 0}\n` +
        `Horarios en caché: ${info.schedules || 0}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', `No se pudo obtener info: ${error.message}`);
    }
  };

  const testInsertFakeCredentials = async () => {
    Alert.alert(
      'Insertar Credenciales de Prueba',
      '¿Insertar credenciales fake para testing?\n\nEsto te permitirá probar las funcionalidades offline sin necesidad de hacer login online.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Insertar',
          onPress: async () => {
            try {
              // Datos de prueba
              const testUsername = 'test_user';
              const testPassword = 'test123';
              
              // Contraseña "encriptada" fake (solo para testing de visualización)
              // NO usar expo-crypto aquí porque puede fallar, solo string simple
              const fakeEncryptedPassword = 'FAKE_ENCRYPTED_' + testPassword;
              
              const now = Date.now();
              const expiresAt = now + (24 * 60 * 60 * 1000); // 24 horas
              
              console.log('[TestingPanel] Insertando credenciales de prueba...');
              
              // Guardar en SQLite
              await OfflineStorage.saveCredentials({
                user_id: 999,
                encrypted_data: JSON.stringify({
                  username: testUsername,
                  password: fakeEncryptedPassword,
                }),
                role: 'listero',
                id_banco: 1,
                last_login: now.toString(),
                session_expires: expiresAt.toString(),
              });
              
              console.log('[TestingPanel] ✅ Credenciales de prueba insertadas');
              
              Alert.alert(
                '✅ Credenciales Insertadas',
                `Usuario: ${testUsername}\n` +
                `Contraseña: ${testPassword}\n` +
                `Rol: listero\n` +
                `ID Banco: 1\n\n` +
                `Ahora puedes probar:\n` +
                `- Ver Credenciales\n` +
                `- Validar Sesión\n` +
                `- Ver Último Login\n` +
                `- Info de BD\n\n` +
                `NOTA: Login Offline NO funcionará\n` +
                `con estas credenciales fake (solo\n` +
                `para probar visualización de datos)`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('[TestingPanel] Error al insertar credenciales:', error);
              Alert.alert('Error', `No se pudo insertar: ${error.message}\n\nStack: ${error.stack}`);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // PRUEBAS GENERALES
  // ============================================

  const testViewLogs = async () => {
    try {
      const logs = await OfflineStorage.getLogs(10);
      if (logs.length === 0) {
        Alert.alert('Logs', 'No hay logs registrados');
        return;
      }
      
      const logText = logs.map(log => 
        `[${log.level}] ${log.message}\n${log.created_at}`
      ).join('\n\n');
      
      Alert.alert('Últimos 10 Logs', logText, [{ text: 'OK' }]);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const testClearLogs = async () => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar todos los logs?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await OfflineStorage.clearLogs();
              Alert.alert('Éxito', 'Logs eliminados');
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          }
        }
      ]
    );
  };

  // ============================================
  // PRUEBAS FASE 6: JUGADAS OFFLINE
  // ============================================

  /**
   * FASE 6: Test para crear jugada offline de prueba
   */
  const testCreateOfflinePlay = async () => {
    try {
      // Obtener usuario actual desde supabase directamente
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'No hay usuario autenticado');
        return;
      }

      // Obtener loterías y horarios del caché
      const lotteries = await OfflineStorage.getLotteries(null);
      const schedules = await OfflineStorage.getSchedules(null);

      if (!lotteries || lotteries.length === 0) {
        Alert.alert(
          'Caché vacío',
          'No hay loterías en caché.\n\n¿Deseas sincronizar el caché ahora?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sincronizar', onPress: testSyncCache }
          ]
        );
        return;
      }

      if (!schedules || schedules.length === 0) {
        Alert.alert(
          'Caché vacío',
          'No hay horarios en caché.\n\n¿Deseas sincronizar el caché ahora?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Sincronizar', onPress: testSyncCache }
          ]
        );
        return;
      }

      // Tomar primera lotería y primer horario para la prueba
      const loteria = lotteries[0];
      const horario = schedules[0];

      // Calcular monto total
      const numeros = '12,34,56,78';
      const numerosArray = numeros.split(',');
      const montoUnitario = 10;
      const montoTotal = montoUnitario * numerosArray.length; // 10 * 4 = 40

      // Datos de prueba completos
      const playData = {
        user_id: user.id,
        id_horario: horario.id,
        jugada: numeros,
        numeros: numeros,
        tipo_jugada: 'fijo', // Tipo de jugada para pruebas
        monto_unitario: montoUnitario,
        monto_total: montoTotal,
        nota: 'Jugada de prueba offline',
        comando: null,
        id_cliente: null,
        nombre_loteria: loteria.nombre,
        nombre_horario: horario.nombre,
        status: 'pending',
        sync_attempts: 0,
        last_error: null,
        created_at: new Date().toISOString(),
      };

      // Guardar jugada offline directamente usando el servicio
      // NO usar el hook aquí porque no estamos en el contexto de React
      const result = await OfflineStorage.saveOfflinePlay(playData);

      // Validación defensiva
      if (!result) {
        Alert.alert('Error', '❌ El servicio no devolvió ningún resultado');
        return;
      }

      if (result.success) {
        // Validación: asegurarse de que el ID existe
        if (!result.id) {
          Alert.alert('Advertencia', '✅ Jugada guardada pero sin ID retornado');
          return;
        }

        Alert.alert(
          '✅ Jugada Guardada Offline',
          `ID: ${result.id}\n` +
          `Números: ${playData.numeros}\n` +
          `Cantidad: ${numerosArray.length} números\n` +
          `Monto unitario: RD$${playData.monto_unitario}\n` +
          `Monto total: RD$${playData.monto_total}\n\n` +
          `Lotería: ${playData.nombre_loteria}\n` +
          `Horario: ${playData.nombre_horario}\n\n` +
          `Status: ${playData.status}`
        );
      } else {
        Alert.alert('Error', `❌ ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 6.2: Activar/Desactivar Modo Offline Manual
   */
  const testToggleOfflineMode = async () => {
    try {
      await toggleOfflineMode();
      const newState = !isOfflineModeEnabled;
      Alert.alert(
        newState ? '🔴 Modo Offline Activado' : '🟢 Modo Online Activado',
        newState 
          ? 'Todas las jugadas se guardarán localmente en SQLite hasta que desactives este modo.'
          : 'Las jugadas se enviarán normalmente a Supabase cuando haya conexión.'
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 6.2: Ver todas las jugadas pendientes offline
   */
  const testViewPendingPlays = async () => {
    try {
      const plays = await OfflineStorage.getPendingPlays();
      
      if (!plays || plays.length === 0) {
        Alert.alert('📭 Sin Jugadas Pendientes', 'No hay jugadas offline guardadas.');
        return;
      }

      let message = `Total: ${plays.length} jugada(s)\n\n`;
      
      for (let i = 0; i < Math.min(plays.length, 5); i++) {
        const play = plays[i];
        const numeros = Array.isArray(play.numeros) ? play.numeros.join(', ') : play.numeros;
        message += `#${play.id} - ${play.nota || 'Sin nota'}\n`;
        message += `Números: ${numeros}\n`;
        message += `Monto: RD$${play.monto_total}\n`;
        message += `Status: ${play.status}\n`;
        message += `Fecha: ${new Date(play.created_at).toLocaleString()}\n\n`;
      }

      if (plays.length > 5) {
        message += `... y ${plays.length - 5} más`;
      }

      Alert.alert('📋 Jugadas Pendientes Offline', message);
    } catch (error) {
      console.error('[testViewPendingPlays] Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 6.2: Limpiar todas las jugadas offline
   */
  const testClearPendingPlays = async () => {
    try {
      // Primero contar cuántas jugadas hay
      const plays = await OfflineStorage.getPendingPlays();
      
      if (!plays || plays.length === 0) {
        Alert.alert('Info', 'No hay jugadas offline para limpiar');
        return;
      }

      Alert.alert(
        '⚠️ Confirmar',
        `¿Eliminar ${plays.length} jugada(s) pendiente(s)?\n\n⚠️ Esta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await OfflineStorage.clearAllOfflinePlays();
                if (result) {
                  Alert.alert('✅ Limpiado', `${plays.length} jugada(s) eliminada(s)`);
                } else {
                  Alert.alert('Error', 'No se pudieron eliminar las jugadas');
                }
              } catch (error) {
                console.error('[testClearPendingPlays] Error al eliminar:', error);
                Alert.alert('Error', `No se pudo eliminar: ${error.message}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[testClearPendingPlays] Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 6: Sincronizar jugadas offline con Supabase
   */
  const testSyncPlaysToSupabase = async () => {
    try {
      // Obtener jugadas pendientes
      const plays = await OfflineStorage.getPendingPlays();
      
      if (!plays || plays.length === 0) {
        Alert.alert('Info', 'No hay jugadas pendientes para sincronizar');
        return;
      }

      Alert.alert(
        '🔄 Sincronizar Jugadas',
        `Se encontraron ${plays.length} jugada(s) pendiente(s).\n\n¿Deseas sincronizarlas con el servidor?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Sincronizar',
            onPress: async () => {
              try {
                let successful = 0;
                let failed = 0;
                const errors = [];

                for (const play of plays) {
                  try {
                    // Insertar en Supabase
                    const { data, error } = await supabase
                      .from('jugada')
                      .insert({
                        id_listero: play.id_listero,
                        id_horario: play.id_horario,
                        jugada: play.tipo_jugada || play.jugada,
                        numeros: play.numeros,
                        monto_unitario: play.monto_unitario,
                        monto_total: play.monto_total,
                        nota: play.nota,
                        comando: play.comando,
                        id_cliente: play.id_cliente,
                        created_at: play.created_at,
                      });

                    if (error) {
                      console.error(`[Sync] Error en jugada ${play.id}:`, error);
                      failed++;
                      errors.push(`Jugada ${play.id}: ${error.message}`);
                    } else {
                      successful++;
                      console.log(`[Sync] ✅ Jugada ${play.id} sincronizada`);
                      
                      // Marcar como sincronizada en SQLite (opcional)
                      // Puedes implementar una función updatePlayStatus si quieres
                    }
                  } catch (err) {
                    console.error(`[Sync] Exception en jugada ${play.id}:`, err);
                    failed++;
                    errors.push(`Jugada ${play.id}: ${err.message}`);
                  }
                }

                const message = 
                  `✅ Sincronización completada\n\n` +
                  `Total procesadas: ${plays.length}\n` +
                  `Exitosas: ${successful}\n` +
                  `Fallidas: ${failed}` +
                  (errors.length > 0 ? `\n\nErrores:\n${errors.slice(0, 3).join('\n')}` : '');

                Alert.alert('Sincronización', message);
              } catch (error) {
                console.error('[testSyncPlaysToSupabase] Error:', error);
                Alert.alert('Error', `No se pudo sincronizar: ${error.message}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('[testSyncPlaysToSupabase] Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test de sincronización de caché
   */
  const testSyncCache = async () => {
    try {
      Alert.alert('Sincronizando...', 'Descargando loterías y horarios del servidor');
      
      const backgroundTask = require('../services/backgroundTaskService');
      const result = await backgroundTask.syncOfflineCache();
      
      if (result.success) {
        Alert.alert(
          'Éxito',
          `✅ Caché sincronizado\n\n` +
          `Loterías: ${result.lotteries}\n` +
          `Horarios: ${result.schedules}\n\n` +
          `Timestamp: ${new Date(result.timestamp).toLocaleString()}`
        );
      } else {
        Alert.alert('Error', `❌ ${result.error}`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test para ver loterías cacheadas
   */
  const testViewCachedLotteries = async () => {
    try {
      // Llamar sin parámetro para obtener todas las loterías
      const lotteries = await OfflineStorage.getLotteries(null);
      const lastUpdate = await OfflineStorage.getLastCacheUpdate('lotteries');
      
      // DEBUG: Ver qué datos realmente vienen
      console.log('[TestPanel] Loterías obtenidas:', JSON.stringify(lotteries, null, 2));
      
      if (!lotteries || lotteries.length === 0) {
        Alert.alert('Sin datos', 'No hay loterías en caché.\n\nPrimero sincroniza el caché.');
        return;
      }

      const lastUpdateStr = lastUpdate 
        ? new Date(lastUpdate).toLocaleString() 
        : 'Nunca';

      const lotteriesStr = lotteries
        .map(lot => {
          console.log('[TestPanel] Lotería:', lot);
          return `• ${lot.nombre || 'Sin nombre'} (ID: ${lot.id})`;
        })
        .join('\n');

      Alert.alert(
        'Loterías en Caché',
        `Total: ${lotteries.length}\n` +
        `Última actualización: ${lastUpdateStr}\n\n` +
        `${lotteriesStr}`
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test para ver horarios cacheados
   */
  const testViewCachedSchedules = async () => {
    try {
      // Llamar sin parámetro para obtener todos los horarios
      const schedules = await OfflineStorage.getSchedules(null);
      const lastUpdate = await OfflineStorage.getLastCacheUpdate('schedules');
      
      // DEBUG: Ver qué datos realmente vienen
      console.log('[TestPanel] Horarios obtenidos:', JSON.stringify(schedules, null, 2));
      
      if (!schedules || schedules.length === 0) {
        Alert.alert('Sin datos', 'No hay horarios en caché.\n\nPrimero sincroniza el caché.');
        return;
      }

      const lastUpdateStr = lastUpdate 
        ? new Date(lastUpdate).toLocaleString() 
        : 'Nunca';

      // Agrupar por lotería
      const byLottery = schedules.reduce((acc, sch) => {
        console.log('[TestPanel] Horario:', sch);
        const lotId = sch.id_loteria;
        if (!acc[lotId]) acc[lotId] = [];
        acc[lotId].push(sch);
        return acc;
      }, {});

      const schedulesStr = Object.entries(byLottery)
        .map(([lotId, scheds]) => {
          const times = scheds
            .map(s => `${s.nombre || s.hora_inicio} (${s.hora_inicio}-${s.hora_fin})`)
            .join('\n  ');
          return `Lotería ${lotId}:\n  ${times}`;
        })
        .join('\n\n');

      Alert.alert(
        'Horarios en Caché',
        `Total: ${schedules.length}\n` +
        `Última actualización: ${lastUpdateStr}\n\n` +
        `${schedulesStr}`,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  /**
   * FASE 5: Test para ver datos RAW del caché (debug)
   */
  const testViewRawCacheData = async () => {
    try {
      const lotteries = await OfflineStorage.getLotteries(null);
      const schedules = await OfflineStorage.getSchedules(null);
      
      if ((!lotteries || lotteries.length === 0) && (!schedules || schedules.length === 0)) {
        Alert.alert('Sin datos', 'No hay datos en caché.\n\nPrimero sincroniza el caché.');
        return;
      }

      let message = '📊 DATOS RAW DEL CACHÉ:\n\n';
      
      if (lotteries && lotteries.length > 0) {
        message += `🎰 LOTERÍAS (${lotteries.length}):\n`;
        message += `Columnas: ${Object.keys(lotteries[0]).join(', ')}\n\n`;
        
        lotteries.forEach((lot, idx) => {
          message += `--- Lotería ${idx + 1} ---\n`;
          Object.entries(lot).forEach(([key, value]) => {
            message += `  ${key}: ${value}\n`;
          });
          message += '\n';
        });
      }

      if (schedules && schedules.length > 0) {
        message += `⏰ HORARIOS (${schedules.length}):\n`;
        message += `Columnas: ${Object.keys(schedules[0]).join(', ')}\n\n`;
        
        schedules.forEach((sch, idx) => {
          message += `--- Horario ${idx + 1} ---\n`;
          Object.entries(sch).forEach(([key, value]) => {
            message += `  ${key}: ${value}\n`;
          });
          message += '\n';
        });
      }

      Alert.alert(
        '🔍 Datos RAW del Caché',
        message,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <>
      {/* Botón inline - MÁS VISIBLE */}
      {inline && (
        <Pressable
          style={({ pressed }) => [
            styles.inlineButton,
            pressed && styles.inlineButtonPressed
          ]}
          onPress={handleOpenPanel}
        >
          <Text style={styles.inlineButtonText}>🧪 Testing</Text>
        </Pressable>
      )}

      {/* Modal del panel */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePanel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {console.log('[OfflineTestingPanel] Modal visible:', modalVisible)}
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>🔧 Panel de Testing Offline</Text>
              <Pressable onPress={handleClosePanel} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            {/* Advertencia para Web */}
            {Platform.OS === 'web' && (
              <View style={styles.warningBanner}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Plataforma Web Detectada</Text>
                  <Text style={styles.warningText}>
                    SQLite no está disponible en Web. El modo offline solo funciona en dispositivos móviles (Android/iOS).
                  </Text>
                </View>
              </View>
            )}

            {/* Estado de conexión */}
            <View style={styles.statusSection}>
              <Text style={styles.sectionTitle}>Estado de Conexión</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Conexión:</Text>
                <Text style={[styles.statusValue, isOnline ? styles.online : styles.offline]}>
                  {isChecking ? '⏳ Verificando...' : (isOnline ? '🟢 Online' : '🔴 Offline')}
                </Text>
              </View>
            </View>

            {/* Contenido scrolleable */}
            <ScrollView 
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
            >
              {/* FASE 6: Jugadas Offline */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎮 FASE 6: Jugadas Offline</Text>

                <TestButton 
                  title={isOfflineModeEnabled ? "🟢 Desactivar Modo Offline" : "🔴 Activar Modo Offline"}
                  onPress={testToggleOfflineMode}
                />

                <TestButton 
                  title="🧪 Crear Jugada Offline de Prueba"
                  onPress={testCreateOfflinePlay}
                />

                <TestButton 
                  title="📋 Ver Jugadas Pendientes Offline"
                  onPress={testViewPendingPlays}
                />

                <TestButton 
                  title="🗑️ Limpiar Jugadas Offline"
                  onPress={testClearPendingPlays}
                />

                <TestButton 
                  title="🔄 Sincronizar Jugadas con Servidor"
                  onPress={testSyncPlaysToSupabase}
                />
              </View>

              {/* FASE 5: Caché */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎰 FASE 5: Caché Offline</Text>
                
                <TestButton 
                  title="🔄 Sincronizar Caché (Loterías + Horarios)"
                  onPress={testSyncCache}
                />
              </View>

              {/* Base de Datos */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🗄️ Base de Datos</Text>
                
                <TestButton 
                  title="📊 Ver Info de BD"
                  onPress={testDatabaseInfo}
                />
              </View>

              {/* Información */}
              <View style={styles.infoSection}>
                <Text style={styles.infoText}>
                  ℹ️ Panel de testing para funcionalidades offline.
                </Text>
                <Text style={styles.infoText}>
                  Use las pruebas para verificar funcionalidades offline.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

// Componente auxiliar para botones de prueba
const TestButton = ({ title, onPress, danger = false }) => (
  <Pressable
    style={({ pressed }) => [
      styles.testButton,
      danger && styles.testButtonDanger,
      pressed && styles.testButtonPressed
    ]}
    onPress={onPress}
  >
    <Text style={[styles.testButtonText, danger && styles.testButtonTextDanger]}>
      {title}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  // Botón inline - MÁS VISIBLE
  inlineButton: {
    backgroundColor: '#9b59b6', // Morado para destacar
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#8e44ad',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inlineButtonPressed: {
    backgroundColor: '#8e44ad',
    transform: [{ scale: 0.98 }],
  },
  inlineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center', // Centrado vertical
    alignItems: 'center', // Centrado horizontal
    padding: 20, // Padding para evitar que toque los bordes
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    height: '85%', // Usar height en lugar de maxHeight
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20, // Agregado padding superior
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2c3e50',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#7f8c8d',
    fontWeight: '600',
  },

  // Estado
  statusSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  statusLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  online: {
    color: '#27ae60',
  },
  offline: {
    color: '#e74c3c',
  },

  // Contenido
  scrollContent: {
    flex: 1, // Usar flex: 1 para ocupar todo el espacio disponible
  },
  scrollContentContainer: {
    paddingBottom: 120, // Aumentado para ver contenido completo al final
    paddingTop: 5, // Pequeño padding superior
    flexGrow: 1, // Permitir que el contenido crezca
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },

  // Botones de prueba
  testButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  testButtonDanger: {
    backgroundColor: '#e74c3c',
  },
  testButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  testButtonTextDanger: {
    color: '#fff',
  },

  // Info
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 5,
    lineHeight: 18,
  },
  helperText: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 5,
    marginLeft: 10,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  // Badge de advertencia Web
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },

  // Badge de estado online/offline
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  statusOnline: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  statusOffline: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2c3e50',
  },
});

export default OfflineTestingPanel;
