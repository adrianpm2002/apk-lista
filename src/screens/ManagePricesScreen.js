import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  Switch, 
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';

const ManagePricesScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // ya no se usa para botón global, pero se mantiene por si se agrega persistencia JSONB
  // fieldErrors removido (validaciones inline en modal)
  const [updatingTypes, setUpdatingTypes] = useState(new Set());
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [editingBatch, setEditingBatch] = useState(false); // si estamos modificando precios existentes
  
  // Estados para tipos de jugada disponibles
  const [availablePlayTypes] = useState([
    { id: 'fijo', label: 'Fijo', enabled: true },
    { id: 'corrido', label: 'Corrido', enabled: true },
    { id: 'posicion', label: 'Posición', enabled: true },
    { id: 'parle', label: 'Parlé', enabled: true },
    { id: 'centena', label: 'Centena', enabled: true },
    { id: 'tripleta', label: 'Tripleta', enabled: true },
  ]);
  
  // Estado de jugadas activas basado en la nueva estructura jsonb (una fila por banco)
  const [enabledPlayTypes, setEnabledPlayTypes] = useState({
    fijo: true,
    corrido: true,
    posicion: true,
    parle: true,
    centena: true,
    tripleta: true,
  });
  const [jugadasRecordId, setJugadasRecordId] = useState(null); // id de la fila en jugadas_activas

  // Estado de precios (se gestionará vía modal). Cada entrada representa un tipo de jugada y sus valores.
  const [winningPrices, setWinningPrices] = useState({
    fijo: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    corrido: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    posicion: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    parle: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    centena: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
    tripleta: { regular: '', limited: '', collectorPct: '', listeroPct: '' },
  });

  // Lista CRUD de precios guardados (por ahora en memoria hasta confirmar tabla destino)
  const [priceEntries, setPriceEntries] = useState([]); // mantiene última config para edición rápida
  const [priceConfigName, setPriceConfigName] = useState('');
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [priceConfigs, setPriceConfigs] = useState([]); // lista completa de configuraciones {id, nombre, created_at, precios}
  const [expandedConfigs, setExpandedConfigs] = useState(new Set()); // ids expandids
  const [modalError, setModalError] = useState('');
  const [modalFieldErrors, setModalFieldErrors] = useState({}); // { playType: { regular:true, limited:true, collectorPct:true, listeroPct:true } }
  const [editingConfigId, setEditingConfigId] = useState(null); // id de la configuración que se está editando (update), null = insert

  useEffect(() => { initializeScreen(); }, []);

  const refreshOnFocus = useCallback(async () => {
    if (currentBankId) {
      await loadSavedConfiguration(currentBankId);
      await loadPriceConfigs(currentBankId);
    }
  }, [currentBankId]);

  useFocusEffect(
    useCallback(() => {
      refreshOnFocus();
    }, [refreshOnFocus])
  );

  const initializeScreen = async () => {
    try {
      setLoading(true);
      await fetchUserRole();
    } catch (error) {
      console.error('Error inicializando pantalla:', error);
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserRole(data.role);
        // Si es admin (banco), su propio ID es el banco ID, si es colector usa id_banco
        const bankId = data.role === 'admin' ? user.id : data.id_banco;
        setCurrentBankId(bankId);
        
        // Solo los admins pueden acceder a esta pantalla
        if (data.role !== 'admin') {
          Alert.alert('Acceso Denegado', 'Solo los administradores pueden configurar precios');
          navigation.goBack();
          return;
        }
        
  // Cargar activación de jugadas y precios después de obtener el bankId
  await loadSavedConfiguration(bankId);
  await loadPriceConfigs(bankId);
      } else {
        console.error('Error cargando rol:', error);
        Alert.alert('Error', 'No se pudo cargar el perfil del usuario');
      }
    }
  };

  const DEFAULT_JUGADAS_JSON = { fijo:true, corrido:true, posicion:true, parle:true, centena:true, tripleta:true };

  const loadSavedConfiguration = async (bankId) => {
    try {
      console.log('[jugadas_activas] Cargando configuración (jsonb) para banco:', bankId);
      // Traer TODAS las filas (si hubiera duplicadas) para este banco
      const { data: rows, error } = await supabase
        .from('jugadas_activas')
        .select('id, jugadas, created_at')
        .eq('id_banco', bankId)
        .order('created_at', { ascending: true });
      if (error) {
        console.error('[jugadas_activas] Error cargando filas:', error);
        return;
      }
      if (!rows || rows.length === 0) {
        // No existe fila: crear una (nota: esto aún podría duplicar si se abre la pantalla en paralelo en 2 clientes sin constraint en DB)
        console.log('[jugadas_activas] No existe fila; creando por defecto');
        const now = new Date().toISOString();
        const { data: inserted, error: insErr } = await supabase
          .from('jugadas_activas')
          .insert({ id_banco: bankId, created_at: now, jugadas: DEFAULT_JUGADAS_JSON })
          .select('id, jugadas')
          .maybeSingle();
        if (insErr) {
          console.error('[jugadas_activas] Error creando fila:', insErr);
          return;
        }
        setJugadasRecordId(inserted.id);
        setEnabledPlayTypes(inserted.jugadas || DEFAULT_JUGADAS_JSON);
        return;
      }
      // Si hay más de una fila, consolidar y eliminar duplicadas
      let baseRow = rows[0]; // más antigua (por orden ascendente)
      if (rows.length > 1) {
        console.warn(`[jugadas_activas] Detectadas ${rows.length} filas duplicadas para banco ${bankId}. Consolidando...`);
        // Estrategia de consolidación: OR lógico (si alguna fila tiene true lo conservamos en true)
        const consolidated = { ...DEFAULT_JUGADAS_JSON };
        rows.forEach(r => {
          const jug = r.jugadas || {};
            Object.keys(consolidated).forEach(k => {
              if (jug[k] === true) consolidated[k] = true;
            });
        });
        // Actualizar la fila base con la consolidación (solo si difiere)
        const needsUpdate = Object.keys(consolidated).some(k => (baseRow.jugadas||{})[k] !== consolidated[k]);
        if (needsUpdate) {
          const { error: updErr } = await supabase
            .from('jugadas_activas')
            .update({ jugadas: consolidated })
            .eq('id', baseRow.id);
          if (updErr) console.error('[jugadas_activas] Error actualizando fila base tras consolidación:', updErr);
          else baseRow = { ...baseRow, jugadas: consolidated };
        }
        // Eliminar filas sobrantes (todas excepto baseRow)
        const duplicateIds = rows.slice(1).map(r => r.id);
        if (duplicateIds.length > 0) {
          const { error: delErr } = await supabase
            .from('jugadas_activas')
            .delete()
            .in('id', duplicateIds);
          if (delErr) console.error('[jugadas_activas] Error eliminando duplicadas:', delErr);
          else console.log('[jugadas_activas] Duplicadas eliminadas:', duplicateIds.length);
        }
      }
      // Usar la fila base resultante
      setJugadasRecordId(baseRow.id);
      const merged = { ...DEFAULT_JUGADAS_JSON, ...(baseRow.jugadas || {}) };
      setEnabledPlayTypes(merged);
    } catch (error) {
      console.error('Error en loadSavedConfiguration:', error);
    }
  };

  // Cargar última configuración de precios (tabla precio)
  const loadPriceConfigs = async (bankId) => {
    try {
      setLoadingPrices(true);
      const { data, error } = await supabase
        .from('precio')
        .select('id, precios, created_at, nombre')
        .eq('id_banco', bankId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error cargando configuraciones de precios:', error);
        return;
      }
      setPriceConfigs(data || []);
      // Prefill modal con la última config (más reciente)
      if (data && data.length > 0) {
        const latest = data[0];
        setPriceConfigName(latest.nombre || '');
        if (latest.precios) {
          const json = latest.precios;
            const newWinning = { ...winningPrices };
            const newEntries = [];
            Object.keys(json).forEach(key => {
              const obj = json[key] || {};
              if (newWinning[key]) {
                newWinning[key] = {
                  regular: obj.regular?.toString() || '',
                  limited: obj.limited?.toString() || '',
                  collectorPct: obj.collectorPct?.toString() || '',
                  listeroPct: obj.listeroPct?.toString() || ''
                };
              }
              const anyVal = ['regular','limited','collectorPct','listeroPct'].some(k => obj[k] !== undefined && obj[k] !== null && obj[k] !== '');
              if (anyVal) {
                newEntries.push({
                  id: key + '-' + Date.now(),
                  jugada: key,
                  regular: obj.regular ?? null,
                  limited: obj.limited ?? null,
                  collectorPct: obj.collectorPct ?? null,
                  listeroPct: obj.listeroPct ?? null,
                });
              }
            });
            setWinningPrices(newWinning);
            setPriceEntries(newEntries);
        }
      }
    } catch (e) {
      console.error('Excepción loadPriceConfigs:', e);
    } finally {
      setLoadingPrices(false);
    }
  };

  // Eliminado toggleAllPlayTypes: ya no se usan botones de seleccionar/deseleccionar todas

  const togglePlayType = async (typeId) => {
    if (!currentBankId) return;
    const prevVal = enabledPlayTypes[typeId];
    const newValue = !prevVal;
    setEnabledPlayTypes(prev => ({ ...prev, [typeId]: newValue }));
    setUpdatingTypes(prev => new Set(prev).add(typeId));
    try {
      // Asegurar fila existente
      let recordId = jugadasRecordId;
      if (!recordId) {
  // Reutilizamos lógica de carga para sanear duplicados si surgieron por carrera
  await loadSavedConfiguration(currentBankId);
  recordId = jugadasRecordId; // estado se actualizará dentro de loadSavedConfiguration
  if (!recordId) throw new Error('No se pudo obtener/crear fila jugadas_activas');
      }
      const updatedJugadas = { ...enabledPlayTypes, [typeId]: newValue };
      const { error: updErr } = await supabase
        .from('jugadas_activas')
        .update({ jugadas: updatedJugadas })
        .eq('id', recordId);
      if (updErr) throw updErr;
    } catch (e) {
      console.error('Error togglePlayType:', e);
      setEnabledPlayTypes(prev => ({ ...prev, [typeId]: prevVal }));
      Alert.alert('Error', e.message || 'No se pudo actualizar la jugada');
    } finally {
      setUpdatingTypes(prev => { const n = new Set(prev); n.delete(typeId); return n; });
    }
  };

  const updateWinningPrice = (playType, priceType, value) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    setWinningPrices(prev => ({
      ...prev,
      [playType]: { ...prev[playType], [priceType]: numericValue }
    }));
  };

  // saveConfiguration eliminado: cambios se aplican en tiempo real

  // CRUD local de precios (pendiente definir tabla para persistir). Cada guardado reemplaza/añade por jugada.
  const handleSavePricesBatch = async () => {
    console.log('== handleSavePricesBatch INICIO ==');
    console.log('currentBankId:', currentBankId);
    console.log('priceConfigName (entrada):', priceConfigName);
    console.log('winningPrices (estado completo):', JSON.stringify(winningPrices));
    console.log('enabledPlayTypes:', enabledPlayTypes);
  console.log('editingConfigId:', editingConfigId);
    // Validar que al menos un campo tenga valor
    const entries = [];
    setModalError('');
    setModalFieldErrors({});
    const fieldErrors = {};
    let hasAnyError = false;
    let percentError = false;
    availablePlayTypes.forEach(pt => {
      if (!enabledPlayTypes[pt.id]) return; // validar solo jugadas activas
      const w = winningPrices[pt.id];
      const req = ['regular','limited','collectorPct','listeroPct'];
      req.forEach(f => {
        if (w[f] === '' || w[f] === null || w[f] === undefined) {
          fieldErrors[pt.id] = fieldErrors[pt.id] || {}; fieldErrors[pt.id][f] = true; hasAnyError = true;
        }
      });
      // porcentajes
      ['collectorPct','listeroPct'].forEach(pctKey => {
        if (w[pctKey] !== '' && (isNaN(w[pctKey]) || parseInt(w[pctKey]) < 0 || parseInt(w[pctKey]) > 100)) {
          fieldErrors[pt.id] = fieldErrors[pt.id] || {}; fieldErrors[pt.id][pctKey] = true; hasAnyError = true; percentError = true;
        }
      });
      if (!fieldErrors[pt.id]) {
        entries.push({
          id: `${pt.id}-${Date.now()}`,
          jugada: pt.id,
          regular: w.regular || null,
          limited: w.limited || null,
          collectorPct: w.collectorPct || null,
          listeroPct: w.listeroPct || null,
        });
      }
    });
    if (hasAnyError) {
      setModalFieldErrors(fieldErrors);
      setModalError(percentError ? 'Corrige porcentajes (0-100) y completa todos los campos requeridos.' : 'Completa todos los campos para cada jugada activa.');
      console.log('Errores de validación', fieldErrors);
      return;
    }
    console.log('entries construidas:', entries);
    if (entries.length === 0) {
      Alert.alert('Sin datos', 'Ingresa algún valor antes de guardar');
      console.log('Abortando: ninguna entrada con valores');
      return;
    }
    setPriceEntries(prev => {
      // Si editingBatch, reemplazar valores existentes por jugada
      const filtered = prev.filter(p => !entries.some(e => e.jugada === p.jugada));
      return [...filtered, ...entries];
    });
    // Validar nombre
    if (!priceConfigName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa un nombre para la configuración');
      console.log('Abortando: nombre vacío');
      return;
    }

    // Construir objeto JSON para persistir
    const preciosJSON = {};
    entries.forEach(e => {
      preciosJSON[e.jugada] = {
        regular: e.regular ? Number(e.regular) : null,
        limited: e.limited ? Number(e.limited) : null,
        collectorPct: e.collectorPct ? Number(e.collectorPct) : null,
        listeroPct: e.listeroPct ? Number(e.listeroPct) : null,
      };
    });
    // Incluir jugadas previamente guardadas que no se editaron esta vez
    priceEntries.forEach(old => {
      if (!preciosJSON[old.jugada]) {
        preciosJSON[old.jugada] = {
          regular: old.regular ? Number(old.regular) : null,
          limited: old.limited ? Number(old.limited) : null,
          collectorPct: old.collectorPct ? Number(old.collectorPct) : null,
          listeroPct: old.listeroPct ? Number(old.listeroPct) : null,
        };
      }
    });
    console.log('preciosJSON final que se enviará:', JSON.stringify(preciosJSON));
    // Persistir en tabla precio (insert o update según editingConfigId)
    if (currentBankId) {
      try {
        if (editingConfigId) {
          console.log('Ejecutando UPDATE en tabla precio para id:', editingConfigId);
          const updatePayload = { 
            precios: preciosJSON, 
            nombre: priceConfigName.trim()
          };
          console.log('Payload update precio:', updatePayload);
            const { data: updateData, error: updateError } = await supabase
              .from('precio')
              .update(updatePayload)
              .eq('id', editingConfigId)
              .eq('id_banco', currentBankId)
              .select();
            if (updateError) {
              console.error('Error actualizando precios (updateError):', updateError);
              Alert.alert('Error', 'No se pudo actualizar la configuración de precios');
            } else {
              console.log('Update exitoso. Respuesta:', updateData);
              loadPriceConfigs(currentBankId);
            }
        } else {
          console.log('Ejecutando INSERT (nueva configuración) en tabla precio...');
          const payload = { 
            id_banco: currentBankId, 
            precios: preciosJSON, 
            nombre: priceConfigName.trim()
          }; // created_at removido: ahora la tabla tiene DEFAULT
          console.log('Payload insert precio:', payload);
          const { data: insertData, error: insertError } = await supabase
            .from('precio')
            .insert(payload)
            .select();
          if (insertError) {
            console.error('Error guardando precios (insertError):', insertError);
            Alert.alert('Error', 'No se pudo guardar la configuración de precios');
          } else {
            console.log('Insert exitoso. Respuesta:', insertData);
            loadPriceConfigs(currentBankId);
          }
        }
      } catch (err) {
        console.error('Excepción durante persistencia precio:', err);
        Alert.alert('Error', 'Excepción al guardar la configuración');
      }
    } else {
      console.log('Abortando: currentBankId no definido');
    }
    setPriceModalVisible(false);
    setEditingBatch(false);
    setEditingConfigId(null);
    console.log('== handleSavePricesBatch FIN ==');
  };

  const handleEditPrices = () => {
    // Prellenar winningPrices desde priceEntries
    const newPrices = { ...winningPrices };
    priceEntries.forEach(pe => {
      if (newPrices[pe.jugada]) {
        newPrices[pe.jugada] = {
          regular: pe.regular ? pe.regular.toString() : '',
          limited: pe.limited ? pe.limited.toString() : '',
          collectorPct: pe.collectorPct ? pe.collectorPct.toString() : '',
          listeroPct: pe.listeroPct ? pe.listeroPct.toString() : ''
        };
      }
    });
    setWinningPrices(newPrices);
    setEditingBatch(true);
    setPriceModalVisible(true);
  };

  const handleDeletePrice = (jugada) => {
    setPriceEntries(prev => prev.filter(p => p.jugada !== jugada));
  };

  const performConfigDeletion = async (configId) => {
    console.log('[DeleteConfig] Ejecutando performConfigDeletion para', configId);
    try {
      if (!currentBankId) {
        console.log('[DeleteConfig] Abort: bankId no definido');
        return;
      }
      const { data: authUserData } = await supabase.auth.getUser();
      console.log('[DeleteConfig] auth user id:', authUserData?.user?.id);
      const { data: preCheck, error: preCheckError } = await supabase
        .from('precio')
        .select('id, id_banco')
        .eq('id', configId)
        .maybeSingle();
      console.log('[DeleteConfig] PreCheck:', preCheck, 'error:', preCheckError);
      const { error: delError1, count: count1 } = await supabase
        .from('precio')
        .delete({ count: 'exact' })
        .eq('id', configId)
        .eq('id_banco', currentBankId);
      console.log('[DeleteConfig] Delete intento1 count:', count1, 'error:', delError1);
      if (!delError1 && count1 === 0) {
        const { error: delError2, count: count2 } = await supabase
          .from('precio')
          .delete({ count: 'exact' })
          .eq('id', configId);
        console.log('[DeleteConfig] Delete intento2 count:', count2, 'error:', delError2);
      }
      const { data: postCheck, error: postCheckError } = await supabase
        .from('precio')
        .select('id')
        .eq('id', configId)
        .maybeSingle();
      console.log('[DeleteConfig] PostCheck tras eliminar:', postCheck, 'error:', postCheckError);
      await loadPriceConfigs(currentBankId);
      setExpandedConfigs(prev => { const n = new Set(prev); n.delete(configId); return n; });
    } catch (e) {
      console.error('[DeleteConfig] Excepción performConfigDeletion:', e);
    }
  };

  const confirmDelete = async (message) => {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.confirm) {
          return window.confirm(message);
        }
      } catch (e) {
        console.warn('[DeleteConfig] window.confirm error, fallback true', e);
        return true; // fallback: permitir
      }
      return true;
    } else {
      return await new Promise(resolve => {
        Alert.alert('Confirmación', message, [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }
        ]);
      });
    }
  };

  const handleDeleteConfig = (configId) => {
    console.log('[DeleteConfig] Click botón eliminar configId:', configId);
    confirmDelete('¿Eliminar esta configuración definitivamente?')
      .then(ok => {
        if (ok) {
          performConfigDeletion(configId);
        } else {
          console.log('[DeleteConfig] Cancelado por usuario');
        }
      });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.loadingText}>Cargando configuración...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header personalizado */}
      <View style={styles.customHeader}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Configurar Precios</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Sección: Tipos de Jugada */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipos de Jugada Disponibles</Text>
          
          {/* Botones globales removidos para ahorrar espacio */}

          {/* Lista de tipos de jugada */}
          {availablePlayTypes.map(playType => (
            <View key={playType.id} style={styles.playTypeItem}>
              <Text style={styles.playTypeLabel}>{playType.label}</Text>
              <Switch
                value={enabledPlayTypes[playType.id]}
                disabled={updatingTypes.has(playType.id)}
                onValueChange={() => togglePlayType(playType.id)}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={enabledPlayTypes[playType.id] ? '#f5dd4b' : '#f4f3f4'}
              />
            </View>
          ))}
        </View>

        {/* Botón para abrir modal de precios */}
        <ActionButton
          title="Nueva Configuración de Precios"
          onPress={() => {
            setEditingBatch(false);
            setEditingConfigId(null);
            // Limpiar campos para nueva config
            const cleared = { ...winningPrices };
            Object.keys(cleared).forEach(k => {
              cleared[k] = { regular: '', limited: '', collectorPct: '', listeroPct: '' };
            });
            setWinningPrices(cleared);
            setPriceConfigName('');
            setPriceEntries([]);
            setPriceModalVisible(true);
          }}
          variant="primary"
          size="medium"
          style={{ marginBottom: 16 }}
        />

        {/* Listado de configuraciones guardadas (acordeón) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuraciones Guardadas</Text>
          {loadingPrices && <Text style={{ color: '#7f8c8d' }}>Cargando configuraciones...</Text>}
          {!loadingPrices && priceConfigs.length === 0 && (
            <Text style={{ color: '#7f8c8d' }}>No hay configuraciones guardadas aún.</Text>
          )}
          {priceConfigs.map(cfg => {
            const expanded = expandedConfigs.has(cfg.id);
            const toggle = () => {
              setExpandedConfigs(prev => {
                const n = new Set(prev);
                if (n.has(cfg.id)) n.delete(cfg.id); else n.add(cfg.id);
                return n;
              });
            };
            const precios = cfg.precios || {};
            const jugadasKeys = Object.keys(precios).filter(k => {
              const o = precios[k];
              return o && ['regular','limited','collectorPct','listeroPct'].some(field => o[field] !== null && o[field] !== undefined && o[field] !== '');
            });
            // Calcular discrepancias para colorear el nombre
            const configuredPlays = jugadasKeys;
            const activePlays = Object.keys(enabledPlayTypes).filter(k => enabledPlayTypes[k]);
            const missingActive = activePlays.filter(k => !configuredPlays.includes(k));
            const anyConfiguredInactive = configuredPlays.some(k => enabledPlayTypes[k] === false);
            const hasMismatch = missingActive.length > 0 || anyConfiguredInactive;
            return (
              <View key={cfg.id} style={styles.configItem}>
                <TouchableOpacity onPress={toggle} style={styles.configHeaderRow}>
                  <Text style={[styles.configName, hasMismatch && styles.configNameWarning]}>{cfg.nombre || 'Sin nombre'}</Text>
                  <Text style={styles.configArrow}>{expanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.configDetails}>
                    {jugadasKeys.length === 0 && (
                      <Text style={styles.configEmpty}>Sin jugadas configuradas.</Text>
                    )}
                    {(() => {
                      const allRows = [];
                      const activePlays = Object.keys(enabledPlayTypes).filter(k => enabledPlayTypes[k]);
                      const configuredPlays = jugadasKeys;
                      const missingActive = activePlays.filter(k => !configuredPlays.includes(k));
                      // Mostrar configuradas primero
                      configuredPlays.forEach(jk => {
                        const obj = precios[jk] || {};
                        const active = enabledPlayTypes[jk];
                        const hasAny = ['regular','limited','collectorPct','listeroPct'].some(f => obj[f] !== null && obj[f] !== undefined && obj[f] !== '');
                        const mismatchInactive = hasAny && !active;
                        const warning = mismatchInactive ? 'Configurada pero jugada actualmente desactivada' : null;
                        allRows.push(
                          <View key={jk} style={styles.detailRow}>
                            <Text style={[styles.detailText, mismatchInactive && styles.priceListTextWarning]}>
                              {jk} - Reg: {obj.regular ?? '—'}  Lim: {obj.limited ?? '—'}  Col%: {obj.collectorPct ?? '—'}  Lis%: {obj.listeroPct ?? '—'}
                            </Text>
                            {warning && <Text style={styles.priceMismatchNote}>{warning}</Text>}
                          </View>
                        );
                      });
                      // Luego las activas sin configuración
                      missingActive.forEach(mk => {
                        allRows.push(
                          <View key={mk} style={styles.detailRow}>
                            <Text style={[styles.detailText, styles.priceListTextWarning]}>
                              {mk} - Sin configuración
                            </Text>
                            <Text style={styles.priceMismatchNote}>Jugada activa sin valores configurados</Text>
                          </View>
                        );
                      });
                      return allRows;
                    })()}
                    <View style={styles.configActionsRow}>
                      <TouchableOpacity onPress={() => {
                        // Cargar esta config en modal para editar como nueva versión
                        const json = cfg.precios || {};
                        const newWinning = { ...winningPrices };
                        Object.keys(newWinning).forEach(k => {
                          const o = json[k] || {};
                          newWinning[k] = {
                            regular: o.regular?.toString() || '',
                            limited: o.limited?.toString() || '',
                            collectorPct: o.collectorPct?.toString() || '',
                            listeroPct: o.listeroPct?.toString() || ''
                          };
                        });
                        setWinningPrices(newWinning);
                        // reconstruir priceEntries para referencias locales
                        const newEntries = [];
                        Object.keys(json).forEach(k => {
                          const o = json[k] || {};
                          const anyVal = ['regular','limited','collectorPct','listeroPct'].some(f => o[f] !== null && o[f] !== undefined && o[f] !== '');
                          if (anyVal) {
                            newEntries.push({
                              id: k + '-' + Date.now(),
                              jugada: k,
                              regular: o.regular ?? null,
                              limited: o.limited ?? null,
                              collectorPct: o.collectorPct ?? null,
                              listeroPct: o.listeroPct ?? null,
                            });
                          }
                        });
                        setPriceEntries(newEntries);
                        setPriceConfigName(cfg.nombre || '');
                        setEditingBatch(true);
                        setEditingConfigId(cfg.id); // marcar para UPDATE
                        setPriceModalVisible(true);
                      }} style={styles.smallButtonPrimary}>
                        <Text style={styles.smallButtonText}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteConfig(cfg.id)} style={styles.smallButtonDanger}>
                        <Text style={styles.smallButtonText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
        {/* Eliminado botón Guardar: cambios de activación son en tiempo real */}

      </ScrollView>

      {/* Modal de precios */}
      {priceModalVisible && (
        <View style={styles.pricesModalOverlay}>
          <View style={styles.pricesModal}>
            <Text style={styles.pricesModalTitle}>{editingBatch ? 'Editar Precios' : 'Agregar Precios'}</Text>
            <ScrollView style={{ maxHeight: 470 }}>
              <View style={styles.modalPriceGroup}>
                <Text style={styles.modalPriceGroupTitle}>Nombre de la Configuración</Text>
                <InputField
                  value={priceConfigName}
                  onChangeText={setPriceConfigName}
                  placeholder="Ej: pagos_globales"
                  autoCapitalize="none"
                />
              </View>
              {availablePlayTypes.filter(pt => enabledPlayTypes[pt.id]).map(pt => (
                <View key={pt.id} style={styles.modalPriceGroup}>
                  <Text style={styles.modalPriceGroupTitle}>{pt.label}</Text>
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Regular</Text>
                      <InputField
                        value={winningPrices[pt.id].regular}
                        onChangeText={v => updateWinningPrice(pt.id, 'regular', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.regular}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>Limitado</Text>
                      <InputField
                        value={winningPrices[pt.id].limited}
                        onChangeText={v => updateWinningPrice(pt.id, 'limited', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.limited}
                      />
                    </View>
                  </View>
                  <View style={styles.modalRow}>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>% Colector</Text>
                      <InputField
                        value={winningPrices[pt.id].collectorPct}
                        onChangeText={v => updateWinningPrice(pt.id, 'collectorPct', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.collectorPct}
                      />
                    </View>
                    <View style={styles.modalField}>
                      <Text style={styles.modalLabel}>% Listero</Text>
                      <InputField
                        value={winningPrices[pt.id].listeroPct}
                        onChangeText={v => updateWinningPrice(pt.id, 'listeroPct', v)}
                        placeholder="0"
                        keyboardType="numeric"
                        hasError={!!modalFieldErrors[pt.id]?.listeroPct}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtonsRow}>
              <ActionButton
                title="Cerrar"
                onPress={() => { setPriceModalVisible(false); setEditingBatch(false); }}
                variant="secondary"
                size="small"
              />
              <ActionButton
                title={editingBatch ? 'Guardar Cambios' : 'Guardar'}
                onPress={handleSavePricesBatch}
                variant="success"
                size="small"
              />
            </View>
            {!!modalError && <Text style={styles.modalErrorText}>{modalError}</Text>}
          </View>
        </View>
      )}

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

export default ManagePricesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2C3E50',
  },
  customHeader: {
    height: 90,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  sidebarButton: {
    marginRight: 16,
    marginLeft: 4,
    marginTop: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
    textAlign: 'center',
    marginRight: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 90,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  // Estilos de botones globales eliminados
  playTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  playTypeLabel: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  priceGroup: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  priceGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceField: {
    flex: 1,
    marginHorizontal: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#34495E',
    marginBottom: 4,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#27AE60',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    marginBottom: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    borderColor: '#E74C3C',
    backgroundColor: '#FCF3F3',
  },
  errorInput: {
    color: '#E74C3C',
  },
  errorText: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 20,
    marginBottom: 40,
  },
  priceListItem: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  priceListRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  priceListText: {
    fontSize: 14,
    color: '#2C3E50'
  },
  priceListTextWarning: {
    color: '#c92a2a',
    fontWeight: '600'
  },
  priceMismatchNote: {
    fontSize: 11,
    color: '#c92a2a',
    marginTop: 2,
  },
  mismatchLegend: {
    fontSize: 11,
    color: '#c92a2a',
    marginTop: 8,
    fontStyle: 'italic'
  },
  configItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10
  },
  configHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  configName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2C3E50'
  },
  configNameWarning: {
    color: '#c92a2a'
  },
  configArrow: {
    fontSize: 14,
    color: '#34495E'
  },
  configDetails: {
    marginTop: 8,
    paddingLeft: 4
  },
  detailRow: {
    marginBottom: 4
  },
  detailText: {
    fontSize: 13,
    color: '#2C3E50'
  },
  configEmpty: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic'
  },
  configActionsRow: {
    flexDirection: 'row',
    marginTop: 8
  },
  smallButtonPrimary: {
    backgroundColor: '#3498db',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 8,
  },
  smallButtonDanger: {
    backgroundColor: '#e74c3c',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  pricesModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 2000,
  },
  pricesModal: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  pricesModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center'
  },
  modalPriceGroup: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 12,
  },
  modalPriceGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2C3E50'
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalField: { flex: 1, marginHorizontal: 4 },
  modalLabel: { fontSize: 13, color: '#34495E', marginBottom: 4 },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10
  },
  modalHint: {
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
    color: '#7f8c8d'
  },
  modalErrorText: {
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    color: '#c92a2a',
    fontWeight: '600'
  }
});
