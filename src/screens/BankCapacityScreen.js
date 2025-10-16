import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';
import { supabase } from '../supabaseClient';
import { matchesSearchTerm, formatNumberInput } from '../utils/numberSearchUtils';

const BankCapacityScreen = ({ navigation }) => {
  const [currentBankId, setCurrentBankId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  const [capacityData, setCapacityData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('capacity');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [lotteryFilter, setLotteryFilter] = useState(null);
  const [scheduleFilter, setScheduleFilter] = useState(null);
  const [playTypeFilter, setPlayTypeFilter] = useState(null);
  const [boteFilter, setBoteFilter] = useState('');

  // Labels para tipos de jugada
  const playTypeLabels = {
    'fijo': 'Fijo',
    'corrido': 'Corrido',
    'parle': 'Parlé',
    'centena': 'Centena',
    'tripleta': 'Tripleta'
  };

  // Función para cargar capacidades del banco
  const fetchBankCapacities = useCallback(async () => {
    if (!currentBankId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('v_capacidades_banco')
        .select('*')
        .eq('id_banco', currentBankId);
      
      if (fetchError) throw fetchError;
      
      // Mapear datos a la estructura esperada
      const mappedData = (data || []).map(item => ({
        loteriaId: String(item.id_loteria),
        loteriaNombre: item.nombre_loteria,
        horarioId: item.id_horario,
        horarioNombre: item.nombre_horario,
        jugada: item.jugada,
        numero: item.numero,
        usado: item.used_today_banco || 0,
        abierto: true
      }));
      
      setCapacityData(mappedData);
    } catch (e) {
      setError(e.message || 'Error cargando capacidad del banco');
      console.error('Error fetching bank capacities:', e);
    } finally {
      setLoading(false);
    }
  }, [currentBankId]);

  useEffect(() => {
    if (currentBankId) {
      fetchBankCapacities();
    }
  }, [currentBankId, fetchBankCapacities]);

  // Obtener rol del usuario y bank ID
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('role, id_banco')
            .eq('id', user.id)
            .single();

          if (data && !error) {
            setUserRole(data.role);
            // Si es admin (banco), su propio ID es el banco ID, si es colector usa id_banco
            const bankId = data.role === 'admin' ? user.id : data.id_banco;
            setCurrentBankId(bankId);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  const lotteryOptions = useMemo(() => {
    const map = new Map();
    capacityData.forEach(r => {
      if (r.loteriaId) map.set(r.loteriaId, r.loteriaNombre);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [capacityData]);

  const scheduleOptions = useMemo(() => {
    const map = new Map();
    capacityData.forEach(r => {
      if (!lotteryFilter || lotteryFilter === r.loteriaId) {
        const key = r.horarioId + "|" + r.horarioNombre;
        map.set(key, { id: r.horarioId, label: r.horarioNombre });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [capacityData, lotteryFilter]);

  const playTypeOptions = useMemo(() => {
    const set = new Set();
    capacityData.forEach(r => {
      if ((!lotteryFilter || lotteryFilter === r.loteriaId) &&
          (!scheduleFilter || scheduleFilter === r.horarioId)) {
        set.add(r.jugada);
      }
    });
    return Array.from(set).map(jugada => ({ id: jugada, label: playTypeLabels[jugada] || jugada }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [capacityData, lotteryFilter, scheduleFilter]);

  const internallyFiltered = useMemo(() => capacityData.filter(r => {
    if (lotteryFilter && lotteryFilter !== r.loteriaId) return false;
    if (scheduleFilter && scheduleFilter !== r.horarioId) return false;
    if (playTypeFilter && playTypeFilter !== r.jugada) return false;
    return true;
  }), [capacityData, lotteryFilter, scheduleFilter, playTypeFilter]);

  const filteredData = internallyFiltered.filter(item => {
    // Filtro de búsqueda con soporte para variantes canónicas (parle 4 dígitos, tripleta 6 dígitos)
    if (searchTerm && !matchesSearchTerm(item.numero, searchTerm)) return false;
    
    // Filtro de bote: solo mostrar números que exceden el bote
    if (boteFilter) {
      const boteAmount = parseFloat(boteFilter);
      if (!isNaN(boteAmount) && item.usado <= boteAmount) return false;
    }
    
    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'capacity') return b.usado - a.usado; // Ordenar por cantidad usada
    return parseInt(a.numero) - parseInt(b.numero);
  });

  const handleBack = () => {
    navigation.goBack();
  };

  const renderCapacityItem = ({ item }) => {
    // Calcular el monto a mostrar (excedente si hay filtro bote, usado si no)
    let displayAmount = item.usado;
    if (boteFilter) {
      const boteAmount = parseFloat(boteFilter);
      if (!isNaN(boteAmount)) {
        displayAmount = item.usado - boteAmount;
      }
    }
    
    return (
      <View style={styles.capacityItem}>
        <View style={styles.numberContainer}>
          <Text style={styles.numberText}>{item.numero}</Text>
        </View>
        <View style={styles.capacityInfo}>
          <Text style={styles.capacityText}>
            ${displayAmount.toFixed(2)}
          </Text>
          <Text style={styles.metaText}>
            <Text style={styles.metaStrong}>{item.loteriaNombre}</Text>
            {' · '}
            <Text style={styles.metaStrong}>{item.horarioNombre}</Text>
            {' · '}
            <Text style={styles.metaJug}>{(playTypeLabels[item.jugada] || item.jugada).toUpperCase()}</Text>
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </Pressable>
            <Text style={styles.title}>Capacidad del Banco</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#27AE60" />
            <Text style={styles.loadingText}>Cargando capacidades...</Text>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Volver</Text>
            </Pressable>
            <Text style={styles.title}>Capacidad del Banco</Text>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={fetchBankCapacities} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </Pressable>
          </View>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </Pressable>
          <Text style={styles.title}>Capacidad del Banco</Text>
        </View>

        <View style={styles.toolbarRow}>
          <Pressable style={styles.iconButton} onPress={() => setShowSearch(s => !s)}>
            <Text style={styles.iconButtonText}>🔍</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setShowFilters(f => !f)}>
            <Text style={styles.iconButtonText}>⚙️</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={fetchBankCapacities}>
            <Text style={styles.iconButtonText}>🔄</Text>
          </Pressable>
        </View>

        {showSearch && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar número..."
              value={searchTerm}
              onChangeText={text => setSearchTerm(formatNumberInput(text))}
              placeholderTextColor="#95A5A6"
              keyboardType="numeric"
            />
          </View>
        )}

        {/* Filtro de Bote */}
        <View style={styles.boteContainer}>
          <Text style={styles.boteLabel}>Filtro Bote:</Text>
          <TextInput
            style={styles.boteInput}
            placeholder="$0.00"
            value={boteFilter}
            onChangeText={text => {
              // Solo permitir números y punto decimal
              let clean = text.replace(/[^\d.]/g, '');
              const parts = clean.split('.');
              if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
              if (parts[1]) clean = parts[0] + '.' + parts[1].slice(0, 2);
              setBoteFilter(clean);
            }}
            keyboardType="numeric"
            placeholderTextColor="#95A5A6"
          />
          {boteFilter && (
            <Pressable 
              style={styles.clearBoteButton}
              onPress={() => setBoteFilter('')}
            >
              <Text style={styles.clearBoteText}>✕</Text>
            </Pressable>
          )}
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            {/* Loterías */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Lotería:</Text>
              <View style={styles.chipsWrap}>
                <Pressable 
                  onPress={() => { setLotteryFilter(null); setScheduleFilter(null); }} 
                  style={[styles.filterChip, !lotteryFilter && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, !lotteryFilter && styles.filterChipTextActive]}>
                    Todas
                  </Text>
                </Pressable>
                {lotteryOptions.map(opt => {
                  const active = lotteryFilter === opt.id;
                  return (
                    <Pressable 
                      key={opt.id} 
                      onPress={() => { 
                        setLotteryFilter(active ? null : opt.id); 
                        setScheduleFilter(null); 
                      }} 
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Horarios */}
            {lotteryFilter && (
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Horario:</Text>
                <View style={styles.chipsWrap}>
                  <Pressable 
                    onPress={() => setScheduleFilter(null)} 
                    style={[styles.filterChip, !scheduleFilter && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, !scheduleFilter && styles.filterChipTextActive]}>
                      Todos
                    </Text>
                  </Pressable>
                  {scheduleOptions.map(opt => {
                    const active = scheduleFilter === opt.id;
                    return (
                      <Pressable 
                        key={opt.id} 
                        onPress={() => setScheduleFilter(active ? null : opt.id)} 
                        style={[styles.filterChip, active && styles.filterChipActive]}
                      >
                        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Tipos de jugada */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Tipo:</Text>
              <View style={styles.chipsWrap}>
                <Pressable 
                  onPress={() => setPlayTypeFilter(null)} 
                  style={[styles.filterChip, !playTypeFilter && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, !playTypeFilter && styles.filterChipTextActive]}>
                    Todos
                  </Text>
                </Pressable>
                {playTypeOptions.map(opt => {
                  const active = playTypeFilter === opt.id;
                  return (
                    <Pressable 
                      key={opt.id} 
                      onPress={() => setPlayTypeFilter(active ? null : opt.id)} 
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Ordenar por:</Text>
          <Pressable 
            onPress={() => setSortBy('capacity')} 
            style={[styles.sortButton, sortBy === 'capacity' && styles.sortButtonActive]}
          >
            <Text style={[styles.sortButtonText, sortBy === 'capacity' && styles.sortButtonTextActive]}>
              Capacidad
            </Text>
          </Pressable>
          <Pressable 
            onPress={() => setSortBy('number')} 
            style={[styles.sortButton, sortBy === 'number' && styles.sortButtonActive]}
          >
            <Text style={[styles.sortButtonText, sortBy === 'number' && styles.sortButtonTextActive]}>
              Número
            </Text>
          </Pressable>
        </View>

        {sortedData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchTerm ? 'No se encontraron números' : 'Ningún número con capacidad usada'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={sortedData}
            renderItem={renderCapacityItem}
            keyExtractor={(item, index) => `${item.loteriaId}-${item.horarioId}-${item.jugada}-${item.numero}-${index}`}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    ...createShadowStyle(1),
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3498DB',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toolbarRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  iconButtonText: {
    fontSize: 16,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  boteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  boteLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginRight: 12,
  },
  boteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#DEE2E6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  clearBoteButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    backgroundColor: '#E74C3C',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBoteText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  filtersPanel: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
  },
  filterChipActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#495057',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#495057',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#DEE2E6',
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#495057',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  capacityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    ...createShadowStyle(1),
  },
  numberContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#3498DB',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  capacityInfo: {
    flex: 1,
  },
  capacityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  metaStrong: {
    fontWeight: '600',
    color: '#495057',
  },
  metaJug: {
    fontWeight: '700',
    color: '#3498DB',
  },
});

export default BankCapacityScreen;
