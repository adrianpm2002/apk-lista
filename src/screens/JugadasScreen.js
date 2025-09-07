import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Switch, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

// Componente para mostrar registro de jugadas en modo solo lectura
const PlaysRecordView = ({ navigation, groupData, title, sidebarVisible, setSidebarVisible }) => {
  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return `$${num.toLocaleString('es-DO', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatTime = (timestamp) => {
    try {
      let date;
      
      // Manejar diferentes formatos de timestamp
      if (!timestamp) {
        return 'Hora no disponible';
      }
      
      if (typeof timestamp === 'string') {
        // Si es una cadena, intentar parsearlo
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Si es un número, usarlo directamente
        date = new Date(timestamp);
      } else {
        return 'Hora no disponible';
      }
      
      // Verificar si la fecha es válida
      if (isNaN(date.getTime())) {
        return 'Hora no disponible';
      }
      
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formateando tiempo:', error);
      return 'Hora no disponible';
    }
  };

  // Volver a la pantalla anterior
  const handleBack = () => {
    navigation.goBack();
  };

  // Calcular totales
  const calcularTotales = () => {
    const jugadas = groupData.jugadas || [];
    
    const totalBruto = jugadas.reduce((sum, jugada) => sum + (Number(jugada.bruto) || Number(jugada.total) || 0), 0);
    const totalPremios = jugadas.reduce((sum, jugada) => sum + (Number(jugada.pagado) || 0), 0);
    const totalGanancia = jugadas.reduce((sum, jugada) => sum + (Number(jugada.ganancia) || 0), 0);
    const totalBalance = jugadas.reduce((sum, jugada) => sum + (Number(jugada.balance) || 0), 0);
    
    return {
      bruto: totalBruto,
      premios: totalPremios,
      ganancia: totalGanancia,
      balance: totalBalance
    };
  };

  const totales = calcularTotales();

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.recordHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.recordTitle}>{title}</Text>
        </View>

        <View style={styles.groupInfo}>
          <Text style={styles.groupInfoText}>
            📅 {groupData.fecha} | 🎲 {groupData.loteria} | ⏰ {groupData.horario}
          </Text>
          
          <View style={styles.resultAndTotalsContainer}>
            {groupData.resultado && (
              <Text style={styles.resultText}>🎯 Resultado: {groupData.resultado}</Text>
            )}
            
            <View style={styles.totalsContainer}>
              <Text style={styles.totalItem}>
                💰 Total Bruto: {formatMoney(totales.bruto)}
              </Text>
              <Text style={styles.totalItem}>
                🏆 Total Premios: {formatMoney(totales.premios)}
              </Text>
              {totales.ganancia > 0 && (
                <Text style={styles.totalItem}>
                  📈 Total Ganancia: {formatMoney(totales.ganancia)}
                </Text>
              )}
              <Text style={[
                styles.totalItem,
                totales.balance >= 0 ? styles.positiveBalance : styles.negativeBalance
              ]}>
                📊 Balance Total: {formatMoney(totales.balance)}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {groupData.jugadas && groupData.jugadas.length > 0 ? (
            groupData.jugadas.map((jugada, index) => (
              <View key={index} style={[styles.playCard, index % 2 === 0 && styles.evenPlayCard]}>
                <View style={styles.playHeader}>
                  <Text style={styles.playTime}>
                    {jugada.time || formatTime(jugada.ts || jugada.created_at || Date.now())}
                  </Text>
                  <Text style={styles.playType}>{jugada.jugada}</Text>
                </View>
                
                <View style={styles.playDetails}>
                  <Text style={styles.playNumbers}>📝 {jugada.numeros}</Text>
                  {jugada.nota && (
                    <Text style={styles.playNote}>💬 {jugada.nota}</Text>
                  )}
                </View>
                
                <View style={styles.playAmounts}>
                  <Text style={styles.amountItem}>
                    💰 Total: {formatMoney(jugada.bruto || jugada.total)}
                  </Text>
                  {jugada.ganancia !== undefined && (
                    <Text style={styles.amountItem}>
                      📈 Ganancia: {formatMoney(jugada.ganancia)}
                    </Text>
                  )}
                  {jugada.pagado > 0 && (
                    <Text style={styles.amountItem}>
                      🏆 Premio: {formatMoney(jugada.pagado)}
                    </Text>
                  )}
                  <Text style={[
                    styles.amountItem,
                    (jugada.balance || 0) >= 0 ? styles.positiveBalance : styles.negativeBalance
                  ]}>
                    📊 Balance: {formatMoney(jugada.balance || 0)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyMessage}>No hay jugadas para mostrar</Text>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

const JugadasScreen = ({ navigation, onModeVisibilityChange, route }) => {
  // Mover el estado sidebarVisible aquí para evitar re-mounts
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Verificar si estamos en modo solo lectura
  const isReadOnlyMode = route?.params?.readOnlyMode || false;
  const groupData = route?.params?.groupData || null;
  const recordTitle = route?.params?.title || 'Registro de Jugadas';
  
  const handleModeVisibilityChange = useCallback((modes) => {
    if (onModeVisibilityChange) onModeVisibilityChange(modes);
  }, [onModeVisibilityChange]);
  
  // Si estamos en modo solo lectura, mostrar el componente de registro
  if (isReadOnlyMode && groupData) {
    return (
      <PlaysRecordView 
        navigation={navigation}
        groupData={groupData}
        title={recordTitle}
        sidebarVisible={sidebarVisible}
        setSidebarVisible={setSidebarVisible}
      />
    );
  }
  
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
        role="admin"
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
    paddingTop: 50,
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
    marginTop: 40,
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
  // Estilos para PlaysRecordView
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    ...createShadowStyle(2),
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3498db',
    borderRadius: 6,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  groupInfo: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    ...createShadowStyle(1),
  },
  groupInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  groupInfoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  playsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  playsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  playCard: {
    backgroundColor: '#fff',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    ...createShadowStyle(1),
  },
  playCardEven: {
    backgroundColor: '#f8f9fa',
  },
  playHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  playTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
  },
  playType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  playContent: {
    gap: 8,
  },
  playNote: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
  },
  playNumbers: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  playAmounts: {
    marginTop: 8,
    gap: 4,
  },
  playAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#27ae60',
  },
  playEarnings: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f39c12',
  },
  playPrize: {
    fontSize: 14,
    fontWeight: '600',
  },
  prizePaid: {
    color: '#27ae60',
  },
  prizeNone: {
    color: '#95a5a6',
  },
  playBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  positiveBalance: {
    color: '#27ae60',
  },
  negativeBalance: {
    color: '#e74c3c',
  },
  // Estilos para PlaysRecordView
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20, // Reducido de 50 a 20
    paddingBottom: 8, // Reducido de 16 a 8
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#3498db',
    borderRadius: 8,
    marginRight: 16,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recordTitle: {
    fontSize: 16, // Reducido de 18 a 16
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  groupInfo: {
    padding: 12, // Reducido de 16 a 12
    backgroundColor: '#ecf0f1',
    marginBottom: 4, // Reducido de 8 a 4
  },
  groupInfoText: {
    fontSize: 13, // Reducido de 14 a 13
    color: '#2c3e50',
    marginBottom: 6, // Reducido de 8 a 6
  },
  resultAndTotalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultText: {
    fontSize: 13, // Reducido de 14 a 13
    color: '#e74c3c',
    fontWeight: '600',
    flex: 1,
  },
  totalsContainer: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  totalItem: {
    fontSize: 11, // Reducido de 12 a 11
    color: '#2c3e50',
    fontWeight: '600',
    marginBottom: 1, // Reducido de 2 a 1
    textAlign: 'right',
  },
  playCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e8ed',
  },
  evenPlayCard: {
    backgroundColor: '#f8f9fa',
  },
  playHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playTime: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  playType: {
    fontSize: 12,
    color: '#3498db',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  playDetails: {
    marginBottom: 8,
  },
  playNumbers: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  playNote: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    marginTop: 4,
  },
  playAmounts: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 8,
  },
  amountItem: {
    fontSize: 12,
    color: '#2c3e50',
    marginBottom: 2,
  },
  emptyMessage: {
    textAlign: 'center',
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 32,
    fontStyle: 'italic',
  },
};

export default JugadasScreen;
