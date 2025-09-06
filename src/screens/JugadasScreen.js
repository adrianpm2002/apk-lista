import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Switch, RefreshControl } from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { createShadowStyle } from '../utils/shadowUtils';

const JugadasScreen = ({ navigation, onModeVisibilityChange }) => {
  // Mover el estado sidebarVisible aquí para evitar re-mounts
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  const handleModeVisibilityChange = useCallback((modes) => {
    if (onModeVisibilityChange) onModeVisibilityChange(modes);
  }, [onModeVisibilityChange]);
  
  return (
    <JugadasContent
      navigation={navigation}
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
  onModeVisibilityChange,
  sidebarVisible,
  setSidebarVisible 
}) => {
  // Estados locales
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingTypes, setUpdatingTypes] = useState(new Set());
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  
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

  // ========== FETCH FUNCTIONS ==========
  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (profile) {
        setUserRole(profile.role);
        const bankId = profile.role === 'admin' ? user.id : profile.id_banco;
        setCurrentBankId(bankId);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  // Efecto para cargar datos al montar
  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Cargar jugadas activas cuando tengamos bankId
  useEffect(() => {
    if (currentBankId) {
      fetchJugadasActivas(currentBankId).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [currentBankId]);

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
    if (!currentBankId) {
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
  }, [enabledPlayTypes, currentBankId, jugadasRecordId]); // useCallback con las dependencias necesarias

  const handleRefresh = async () => {
    if (!currentBankId) return;
    
    setRefreshing(true);
    try {
      await fetchJugadasActivas(currentBankId);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
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
            refreshing={refreshing}
            onRefresh={handleRefresh}
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
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
}, (prevProps, nextProps) => {
  // Comparador personalizado para React.memo - solo re-render si hay cambios importantes
  const isEqual = (
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
