import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, ActivityIndicator, Switch, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../supabaseClient';
import { useAuthContext } from '../contexts/AuthContext';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

/**
 * Obtener timestamp en hora local (NO UTC)
 * Supabase está configurado para trabajar con hora local
 */
const getLocalTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

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
    
    const totalBruto = jugadas.reduce((sum, jugada) => sum + (Number(jugada.bruto) || 0), 0);
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
            groupData.jugadas.map((jugada, index) => {
              const isBote = jugada.isBote || (jugada.nota || '').toLowerCase() === 'bote';
              
              return (
                <View key={index} style={[
                  styles.playCard, 
                  index % 2 === 0 && styles.evenPlayCard,
                  isBote && styles.boteCard
                ]}>
                  <View style={styles.playHeader}>
                    <Text style={styles.playTime}>
                      {jugada.time || formatTime(jugada.ts || jugada.created_at || Date.now())}
                    </Text>
                    <Text style={[styles.playType, isBote && styles.boteType]}>
                      {isBote ? '🎁 BOTE' : jugada.jugada}
                    </Text>
                  </View>
                  
                  <View style={styles.playDetails}>
                    {!isBote && jugada.numeros && (
                      <Text style={styles.playNumbers}>📝 {jugada.numeros}</Text>
                    )}
                    {jugada.nota && !isBote && (
                      <Text style={styles.playNote}>💬 {jugada.nota}</Text>
                    )}
                    {isBote && (
                      <Text style={styles.boteDescription}>Pago de bote asociado a este resultado</Text>
                    )}
                  </View>
                  
                  <View style={styles.playAmounts}>
                    {!isBote && (
                      <Text style={styles.amountItem}>
                        💰 Total: {formatMoney(jugada.bruto)}
                      </Text>
                    )}
                    {jugada.ganancia !== undefined && (
                      <Text style={styles.amountItem}>
                        📈 Ganancia: {formatMoney(jugada.ganancia)}
                      </Text>
                    )}
                    {jugada.pagado !== 0 && (
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
              );
            })
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
  
  // Estados para loterías y jugadas por lotería
  const [lotteries, setLotteries] = useState([]); // Lista de loterías del banco
  const [expandedLottery, setExpandedLottery] = useState(null); // Lotería expandida para mostrar jugadas
  
  // Estados para tipos de jugada disponibles
  const [availablePlayTypes] = useState([
    { id: 'fijo', label: 'Fijo', enabled: true },
    { id: 'corrido', label: 'Corrido', enabled: true },
    { id: 'parle', label: 'Parle', enabled: true },
    { id: 'centena', label: 'Centena', enabled: true },
    { id: 'tripleta', label: 'Tripleta', enabled: true },
  ]);
  
  // Estado de jugadas activas por lotería: { lotteryId: { fijo: true, corrido: false, ... } }
  const [enabledPlayTypesByLottery, setEnabledPlayTypesByLottery] = useState({});
  const [jugadasRecordId, setJugadasRecordId] = useState(null); // id de la fila en jugadas_activas

  // Obtener usuario del contexto (funciona online y offline)
  const { user: authUser } = useAuthContext();
  
  // ========== FETCH FUNCTIONS ==========
  const fetchUserProfile = async () => {
    try {
      if (!authUser) return;

      // Si el usuario tiene rol (offline), usarlo directamente
      if (authUser.role) {
        setUserRole(authUser.role);
        const bankId = authUser.role === 'admin' ? (authUser.userId || authUser.id) : (authUser.bankId || authUser.id_banco);
        setCurrentBankId(bankId);
        return;
      }

      // Si no tiene rol (online), consultar Supabase
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, id_banco')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (profile) {
        setUserRole(profile.role);
        const bankId = profile.role === 'admin' ? authUser.id : profile.id_banco;
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

  // Cargar loterías y jugadas activas cuando tengamos bankId
  useEffect(() => {
    if (currentBankId) {
      Promise.all([
        fetchLotteries(currentBankId),
        fetchJugadasActivas(currentBankId)
      ]).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [currentBankId]);

  // Función para cargar las loterías del banco
  const fetchLotteries = useCallback(async (bankId) => {
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bankId)
        .order('nombre');
      
      if (error) {
        console.error('Error fetching lotteries:', error);
        return;
      }
      
      setLotteries(data || []);
    } catch (error) {
      console.error('Error fetching lotteries:', error);
    }
  }, []);

  const fetchJugadasActivas = useCallback(async (bankId) => {
    try {
      // Traer el registro de jugadas activas para este banco
      const { data: rows, error } = await supabase
        .from('jugadas_activas')
        .select('id, jugadas, created_at')
        .eq('id_banco', bankId)
        .order('created_at', { ascending: true });
        
      if (error) {
        // Si la tabla no existe, inicializar estado vacío
        if (error.code === '42P01') {
          setEnabledPlayTypesByLottery({});
          setJugadasRecordId(null);
          return;
        }
        
        // Si no hay datos (PGRST116), continúa para crear registro
        if (error.code !== 'PGRST116') {
          return;
        }
      }
      
      if (!rows || rows.length === 0) {
        // No existe registro: inicializar estado vacío
        setEnabledPlayTypesByLottery({});
        setJugadasRecordId(null);
        return;
      }

      // Usar el primer registro encontrado (debería ser único por banco)
      const baseRow = rows[0];
      setJugadasRecordId(baseRow.id);
      
      // El nuevo formato es: { lotteryId: { fijo: true, corrido: false, ... } }
      const jugadas = baseRow.jugadas || {};
      
      // Formato nuevo: ya está por lotería
      setEnabledPlayTypesByLottery(jugadas);
      
    } catch (error) {
      setEnabledPlayTypesByLottery({});
      setJugadasRecordId(null);
    }
  }, []); // useCallback sin dependencias porque usa setters directamente

  const togglePlayTypeForLottery = useCallback(async (lotteryId, typeId) => {
    if (!currentBankId || !lotteryId) {
      return;
    }
    
    const currentLotteryJugadas = enabledPlayTypesByLottery[lotteryId] || {};
    const prevVal = currentLotteryJugadas[typeId] || false;
    const newValue = !prevVal;
    
    // Actualizar estado local inmediatamente
    setEnabledPlayTypesByLottery(prev => ({
      ...prev,
      [lotteryId]: {
        ...currentLotteryJugadas,
        [typeId]: newValue
      }
    }));
    setUpdatingTypes(prev => new Set(prev).add(`${lotteryId}_${typeId}`));
    
    try {
      // Si no hay registro, crear uno
      if (!jugadasRecordId) {
        const now = getLocalTimestamp();
        const newJugadas = {
          [lotteryId]: {
            ...currentLotteryJugadas,
            [typeId]: newValue
          }
        };
        
        const { data: inserted, error: insErr } = await supabase
          .from('jugadas_activas')
          .insert({ 
            id_banco: currentBankId, 
            created_at: now, 
            jugadas: newJugadas 
          })
          .select('id')
          .single();
          
        if (!insErr && inserted) {
          setJugadasRecordId(inserted.id);
        }
        return;
      }
      
      // Actualizar el registro existente
      const updatedJugadas = {
        ...enabledPlayTypesByLottery,
        [lotteryId]: {
          ...currentLotteryJugadas,
          [typeId]: newValue
        }
      };
      
      const { error: updErr } = await supabase
        .from('jugadas_activas')
        .update({ jugadas: updatedJugadas })
        .eq('id', jugadasRecordId);
        
      if (updErr && updErr.code !== '42P01') {
        throw updErr;
      }
      
    } catch (e) {
      // Revertir el cambio en caso de error
      setEnabledPlayTypesByLottery(prev => ({
        ...prev,
        [lotteryId]: {
          ...currentLotteryJugadas,
          [typeId]: prevVal
        }
      }));
    } finally {
      setUpdatingTypes(prev => { 
        const n = new Set(prev); 
        n.delete(`${lotteryId}_${typeId}`); 
        return n; 
      });
    }
  }, [enabledPlayTypesByLottery, currentBankId, jugadasRecordId]); // useCallback con las dependencias necesarias

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
        
        {/* Sección: Configuración por Lotería */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jugadas Activas por Lotería</Text>
          
          {lotteries.length === 0 ? (
            <Text style={styles.emptyText}>No hay loterías disponibles para este banco</Text>
          ) : (
            lotteries.map(lottery => (
              <View key={lottery.id} style={styles.lotteryContainer}>
                {/* Header de la lotería */}
                <TouchableOpacity 
                  style={styles.lotteryHeader}
                  onPress={() => setExpandedLottery(expandedLottery === lottery.id ? null : lottery.id)}
                >
                  <Text style={styles.lotteryName}>{lottery.nombre}</Text>
                  <Text style={styles.expandIcon}>
                    {expandedLottery === lottery.id ? '▼' : '▶'}
                  </Text>
                </TouchableOpacity>
                
                {/* Contenido expandible */}
                {expandedLottery === lottery.id && (
                  <View style={styles.lotteryContent}>
                    {availablePlayTypes.map(playType => {
                      const lotteryJugadas = enabledPlayTypesByLottery[lottery.id] || {};
                      const isEnabled = lotteryJugadas[playType.id] || false;
                      const isUpdating = updatingTypes.has(`${lottery.id}_${playType.id}`);
                      
                      return (
                        <View key={playType.id} style={styles.playTypeItem}>
                          <Text style={styles.playTypeLabel}>{playType.label}</Text>
                          <Switch
                            value={isEnabled}
                            disabled={isUpdating}
                            onValueChange={() => togglePlayTypeForLottery(lottery.id, playType.id)}
                            trackColor={{ false: '#767577', true: '#81b0ff' }}
                            thumbColor={isEnabled ? '#f5dd4b' : '#f4f3f4'}
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
          )}
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
  boteCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  boteType: {
    color: '#ff9800',
    fontWeight: 'bold',
  },
  boteDescription: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
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
  // Estilos para el nuevo layout por loterías
  lotteryContainer: {
    backgroundColor: '#fff',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    ...createShadowStyle(1),
  },
  lotteryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  lotteryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  expandIcon: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: 'bold',
  },
  lotteryContent: {
    padding: 16,
  },
};

export default JugadasScreen;
