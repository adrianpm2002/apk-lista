import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Switch, RefreshControl } from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { createShadowStyle } from '../utils/shadowUtils';

const JugadasScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  // Mover el estado sidebarVisible aquí para evitar re-mounts
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Usar useCallback para estabilizar las funciones
  const handleToggleDarkMode = useCallback(() => {
    if (onToggleDarkMode) onToggleDarkMode();
  }, [onToggleDarkMode]);
  
  const handleModeVisibilityChange = useCallback((modes) => {
    if (onModeVisibilityChange) onModeVisibilityChange(modes);
  }, [onModeVisibilityChange]);
  
  return (
    <JugadasContent
      navigation={navigation}
      isDarkMode={isDarkMode}
      onToggleDarkMode={handleToggleDarkMode}
      onModeVisibilityChange={handleModeVisibilityChange}
      sidebarVisible={sidebarVisible}
      setSidebarVisible={setSidebarVisible}
    />
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

const JugadasContent = React.memo(({ 
  navigation, 
  isDarkMode, 
  onToggleDarkMode, 
  onModeVisibilityChange,
  sidebarVisible,
  setSidebarVisible 
}) => {
  const { cache, userRole: cacheUserRole, currentBankId: cacheBankId } = useCache();
  
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('activePlayTypes');
  
  // Inicializar con cache si está disponible, sino mostrar loading
  const [loading, setLoading] = useState(!cache.activePlayTypes);
  
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

  // Efecto para cargar jugadas activas desde cache primero
  useEffect(() => {
    if (cacheBankId) {
      // Si tenemos datos en cache, usarlos inmediatamente
      if (cache.activePlayTypes) {
        setEnabledPlayTypes(cache.activePlayTypes);
        setLoading(false);
      } else {
        // Solo mostrar loading si no hay cache disponible
        setLoading(true);
        fetchJugadasActivas(cacheBankId).finally(() => {
          setLoading(false);
        });
      }
    } else {
      setLoading(false);
    }
  }, [cacheBankId, cache.activePlayTypes]);

  // Carga inicial basada en caché o propiedades
  useEffect(() => {
    // No necesitamos setters locales, usamos directamente cacheUserRole y cacheBankId
  }, [cacheUserRole, cacheBankId]);

  const initializeScreen = async () => {
    try {
      // El userRole y currentBankId vienen del cache, no necesitamos fetch adicional
      // El loading se maneja en el useEffect de cacheBankId
    } catch (error) {
      console.error('Error inicializando pantalla:', error);
      Alert.alert('Error', 'No se pudo cargar la información del usuario');
    }
  };

  const fetchJugadasActivas = useCallback(async (bankId) => {
    try {
      // Traer TODAS las filas (si hubiera duplicadas) para este banco
      const { data: rows, error } = await supabase
        .from('jugadas_activas')
        .select('id, jugadas, created_at')
        .eq('id_banco', bankId)
        .order('created_at', { ascending: true });
        
      if (error) {
        // Si la tabla no existe, usar valores por defecto
        if (error.code === '42P01') {
          setEnabledPlayTypes(DEFAULT_JUGADAS_JSON);
          setJugadasRecordId(null);
          return;
        }
        
        // Si no hay datos (PGRST116), continúa para crear registro
        if (error.code !== 'PGRST116') {
          return;
        }
      }
      
      if (!rows || rows.length === 0) {
        // No existe fila: crear una
        const now = new Date().toISOString();
        
        const { data: inserted, error: insErr } = await supabase
          .from('jugadas_activas')
          .insert({ 
            id_banco: bankId, 
            created_at: now, 
            jugadas: DEFAULT_JUGADAS_JSON 
          })
          .select('id, jugadas')
          .single();
          
        if (insErr) {
          // Si la tabla no existe, usar valores por defecto
          if (insErr.code === '42P01') {
            setEnabledPlayTypes(DEFAULT_JUGADAS_JSON);
            setJugadasRecordId(null);
            return;
          }
          
          // En caso de otros errores, usar valores por defecto localmente
          setEnabledPlayTypes(DEFAULT_JUGADAS_JSON);
          setJugadasRecordId(null);
          return;
        }
        
        setJugadasRecordId(inserted.id);
        setEnabledPlayTypes(inserted.jugadas || DEFAULT_JUGADAS_JSON);
        return;
      }
      // Si hay más de una fila, consolidar y eliminar duplicadas
      let baseRow = rows[0]; // más antigua (por orden ascendente)
      
      if (rows.length > 1) {
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
          if (!updErr) {
            baseRow = { ...baseRow, jugadas: consolidated };
          }
        }
        
        // Eliminar filas sobrantes (todas excepto baseRow)
        const duplicateIds = rows.slice(1).map(r => r.id);
        if (duplicateIds.length > 0) {
          await supabase
            .from('jugadas_activas')
            .delete()
            .in('id', duplicateIds);
        }
      }
      
      // Usar la fila base resultante
      setJugadasRecordId(baseRow.id);
      const merged = { ...DEFAULT_JUGADAS_JSON, ...(baseRow.jugadas || {}) };
      setEnabledPlayTypes(merged);
      
    } catch (error) {
      setEnabledPlayTypes(DEFAULT_JUGADAS_JSON);
      setJugadasRecordId(null);
    }
  }, []); // useCallback sin dependencias porque usa setters directamente

  const togglePlayType = useCallback(async (typeId) => {
    if (!cacheBankId) {
      return;
    }
    
    const prevVal = enabledPlayTypes[typeId];
    const newValue = !prevVal;
    
    // Actualizar estado local inmediatamente (esto no debería causar re-mount)
    setEnabledPlayTypes(prev => {
      return { ...prev, [typeId]: newValue };
    });
    setUpdatingTypes(prev => new Set(prev).add(typeId));
    
    try {
      // Usar el recordId actual sin refrescar datos
      const recordId = jugadasRecordId;
      
      if (!recordId) {
        return; // Mantener el cambio solo en el estado local
      }
      
      // Crear la nueva configuración basada en el estado actual más el cambio
      const updatedJugadas = { ...enabledPlayTypes, [typeId]: newValue };
      
      const { error: updErr } = await supabase
        .from('jugadas_activas')
        .update({ jugadas: updatedJugadas })
        .eq('id', recordId);
        
      if (updErr) {
        if (updErr.code === '42P01') {
          return; // Mantener el cambio solo en el estado local
        }
        throw updErr;
      }
      
    } catch (e) {
      // Revertir el cambio en caso de error
      setEnabledPlayTypes(prev => ({ ...prev, [typeId]: prevVal }));
    } finally {
      setUpdatingTypes(prev => { 
        const n = new Set(prev); 
        n.delete(typeId); 
        return n; 
      });
    }
  }, [enabledPlayTypes, cacheBankId, jugadasRecordId]); // useCallback con las dependencias necesarias

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
        <SideBarToggle 
          inline 
          onToggle={() => {
            setSidebarVisible(!sidebarVisible);
          }} 
          style={styles.sidebarButton} 
        />
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
      <SideBar 
        isVisible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
        role={cacheUserRole}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Comparador personalizado para React.memo - solo re-render si hay cambios importantes
  const isEqual = (
    prevProps.isDarkMode === nextProps.isDarkMode &&
    prevProps.sidebarVisible === nextProps.sidebarVisible &&
    prevProps.navigation.isFocused === nextProps.navigation.isFocused
    // Ignoramos las funciones porque pueden cambiar referencia pero funcionalmente son iguales
  );
  return isEqual;
});

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
    marginTop: 20,
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
