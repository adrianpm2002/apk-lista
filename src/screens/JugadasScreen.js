import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Switch, RefreshControl } from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const JugadasScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <JugadasContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const DEFAULT_JUGADAS_JSON = {
  fijo: true,
  corrido: true,
  posicion: true,
  parle: true,
  centena: true,
  tripleta: true,
};

const JugadasContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const { cache, userRole: cacheUserRole, currentBankId: cacheBankId } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('activePlayTypes');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [updatingTypes, setUpdatingTypes] = useState(new Set());
  
  // Estados para tipos de jugada disponibles
  const [availablePlayTypes] = useState([
    { id: 'fijo', label: 'Fijo', enabled: true },
    { id: 'corrido', label: 'Corrido', enabled: true },
    { id: 'posicion', label: 'Posición', enabled: true },
    { id: 'parle', label: 'Parle', enabled: true },
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

  // Efecto para cargar jugadas activas cuando cambia el banco
  useEffect(() => {
    if (currentBankId) {
      fetchJugadasActivas(currentBankId);
    }
  }, [currentBankId]);

  // Carga inicial basada en caché o propiedades
  useEffect(() => {
    setUserRole(cacheUserRole);
    setCurrentBankId(cacheBankId);
  }, [cacheUserRole, cacheBankId]);

  useEffect(() => { initializeScreen(); }, []);

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('usuarios')
          .select('rol')
          .eq('id', user.id)
          .single();
        if (error) {
          console.error('Error obteniendo rol de usuario:', error);
        } else {
          setUserRole(data.rol);
        }
      }
    } catch (error) {
      console.error('Error en fetchUserRole:', error);
    }
  };

  const fetchJugadasActivas = async (bankId) => {
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
      console.error('Error en fetchJugadasActivas:', error);
    }
  };

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
        await fetchJugadasActivas(currentBankId);
        recordId = jugadasRecordId; // estado se actualizará dentro de fetchJugadasActivas
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
    } finally {
      setUpdatingTypes(prev => { const n = new Set(prev); n.delete(typeId); return n; });
    }
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
        <Text style={styles.headerTitle}>Jugadas</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={cacheRefreshing}
            onRefresh={cacheOnRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        
        {/* Sección: Tipos de Jugada */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipos de Jugada Disponibles</Text>
          
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

      </ScrollView>

      {/* Sidebar */}
      <SideBar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    ...createShadowStyle(2),
  },
  sidebarButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...createShadowStyle(1),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
  },
  playTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f4',
  },
  playTypeLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
};

export default JugadasScreen;
