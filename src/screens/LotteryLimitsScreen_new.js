import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  SafeAreaView, 
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const LotteryLimitsScreen = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  return (
    <ScreenWrapper>
      <LotteryLimitsContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    </ScreenWrapper>
  );
};

const LotteryLimitsContent = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState(null);
  const [bankId, setBankId] = useState(null);
  
  // Estados principales
  const [lotteries, setLotteries] = useState([]);
  const [activeJugadas, setActiveJugadas] = useState({});
  
  // Estados del modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [currentLimits, setCurrentLimits] = useState({});
  const [limitsRecordId, setLimitsRecordId] = useState(null);

  // Orden de jugadas para mostrar
  const JUGADA_ORDER = ['fijo', 'corrido', 'posicion', 'parle', 'centena', 'tripleta'];

  // Cargar rol y bankId
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('role, id_banco')
            .eq('id', user.id)
            .single();
          if (data?.role) {
            setRole(data.role);
            const bId = data.role === 'admin' ? user.id : data.id_banco;
            setBankId(bId);
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, []);

  // Cargar loterías cuando tenemos bankId
  useEffect(() => {
    if (bankId) {
      loadLotteries();
      loadActiveJugadas();
    }
  }, [bankId]);

  const loadLotteries = async () => {
    if (!bankId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('loteria')
        .select('id, nombre')
        .eq('id_banco', bankId)
        .order('nombre');
      
      if (!error) {
        setLotteries(data || []);
      }
    } catch (error) {
      console.error('Error loading lotteries:', error);
    }
    setLoading(false);
  };

  const loadActiveJugadas = async () => {
    if (!bankId) return;
    
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bankId)
        .single();
      
      if (!error && data?.jugadas) {
        setActiveJugadas(data.jugadas);
      }
    } catch (error) {
      console.error('Error loading active jugadas:', error);
    }
  };

  const openEditModal = async (lottery) => {
    setSelectedLottery(lottery);
    await loadLotteryLimits(lottery.id);
    setModalVisible(true);
  };

  const loadLotteryLimits = async (lotteryId) => {
    try {
      const { data, error } = await supabase
        .from('limite_loteria')
        .select('id, limites')
        .eq('id_loteria', lotteryId)
        .single();
      
      if (!error && data) {
        setLimitsRecordId(data.id);
        setCurrentLimits(data.limites || {});
      } else {
        // No existe registro, preparar para crear uno nuevo
        setLimitsRecordId(null);
        setCurrentLimits({});
      }
    } catch (error) {
      console.error('Error loading lottery limits:', error);
      setLimitsRecordId(null);
      setCurrentLimits({});
    }
  };

  const handleLimitChange = (jugada, value) => {
    setCurrentLimits(prev => ({
      ...prev,
      [jugada]: value
    }));
  };

  const saveLimits = async () => {
    if (!selectedLottery) return;
    
    setSaving(true);
    try {
      // Convertir valores a números y filtrar vacíos
      const processedLimits = {};
      Object.entries(currentLimits).forEach(([jugada, value]) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue > 0) {
          processedLimits[jugada] = numValue;
        }
      });

      if (limitsRecordId) {
        // Actualizar registro existente
        const { error } = await supabase
          .from('limite_loteria')
          .update({ limites: processedLimits })
          .eq('id', limitsRecordId);
        
        if (error) throw error;
      } else {
        // Crear nuevo registro
        const { data, error } = await supabase
          .from('limite_loteria')
          .insert({
            id_loteria: selectedLottery.id,
            limites: processedLimits
          })
          .select('id')
          .single();
        
        if (error) throw error;
        setLimitsRecordId(data.id);
      }
      
      Alert.alert('Éxito', 'Límites guardados correctamente');
      setModalVisible(false);
    } catch (error) {
      console.error('Error saving limits:', error);
      Alert.alert('Error', 'No se pudieron guardar los límites');
    }
    setSaving(false);
  };

  const renderLotteryItem = ({ item }) => (
    <View style={[styles.lotteryItem, isDarkMode && styles.lotteryItemDark]}>
      <Text style={[styles.lotteryName, isDarkMode && styles.lotteryNameDark]}>
        {item.nombre}
      </Text>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => openEditModal(item)}
      >
        <Text style={styles.editButtonText}>Editar Límites</Text>
      </TouchableOpacity>
    </View>
  );

  const getActiveJugadasList = () => {
    return JUGADA_ORDER.filter(jugada => activeJugadas[jugada] === true);
  };

  const renderLimitInput = (jugada) => (
    <View key={jugada} style={styles.limitInputRow}>
      <Text style={[styles.limitLabel, isDarkMode && styles.limitLabelDark]}>
        {jugada.charAt(0).toUpperCase() + jugada.slice(1)}:
      </Text>
      <TextInput
        style={[styles.limitInput, isDarkMode && styles.limitInputDark]}
        value={currentLimits[jugada]?.toString() || ''}
        onChangeText={(value) => handleLimitChange(jugada, value)}
        placeholder="0.00"
        placeholderTextColor="#95a5a6"
        keyboardType="numeric"
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <SideBarToggle 
          inline 
          onToggle={() => setSidebarVisible(!sidebarVisible)} 
          style={styles.sidebarButton} 
        />
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Límites de Loterías
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2D5016" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Cargando loterías...
          </Text>
        </View>
      ) : (
        <FlatList
          data={lotteries}
          renderItem={renderLotteryItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal de edición de límites */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                Límites - {selectedLottery?.nombre}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {getActiveJugadasList().length > 0 ? (
                getActiveJugadasList().map(renderLimitInput)
              ) : (
                <Text style={[styles.noJugadasText, isDarkMode && styles.noJugadasTextDark]}>
                  No hay jugadas activas configuradas
                </Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={saveLimits}
                disabled={saving}
              >
                <Text style={styles.modalButtonText}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        role={role}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5'
  },
  containerDark: {
    backgroundColor: '#1a252f'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E8',
    ...createShadowStyle(0, 2, '#000000', 0.1, 4)
  },
  headerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e'
  },
  sidebarButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5016',
    flex: 1,
    textAlign: 'center',
    marginRight: 40
  },
  headerTitleDark: {
    color: '#E8F5E8'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2D5016'
  },
  loadingTextDark: {
    color: '#E8F5E8'
  },
  list: {
    flex: 1
  },
  listContent: {
    padding: 20
  },
  lotteryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...createShadowStyle(0, 2, '#000000', 0.1, 4)
  },
  lotteryItemDark: {
    backgroundColor: '#2c3e50'
  },
  lotteryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D5016',
    flex: 1
  },
  lotteryNameDark: {
    color: '#E8F5E8'
  },
  editButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    ...createShadowStyle(0, 4, '#000000', 0.3, 8)
  },
  modalContentDark: {
    backgroundColor: '#2c3e50'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E8'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D5016',
    flex: 1
  },
  modalTitleDark: {
    color: '#E8F5E8'
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#95a5a6',
    fontWeight: 'bold',
    padding: 5
  },
  modalBody: {
    padding: 20,
    maxHeight: 400
  },
  limitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  limitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D5016',
    width: 100,
    marginRight: 15
  },
  limitLabelDark: {
    color: '#E8F5E8'
  },
  limitInput: {
    flex: 1,
    backgroundColor: '#F8FDF5',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2D5016'
  },
  limitInputDark: {
    backgroundColor: '#34495e',
    borderColor: '#4a6741',
    color: '#E8F5E8'
  },
  noJugadasText: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
    paddingVertical: 40
  },
  noJugadasTextDark: {
    color: '#bdc3c7'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5
  },
  cancelButton: {
    backgroundColor: '#e74c3c'
  },
  saveButton: {
    backgroundColor: '#4CAF50'
  },
  saveButtonDisabled: {
    backgroundColor: '#95a5a6'
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});

export default LotteryLimitsScreen;
