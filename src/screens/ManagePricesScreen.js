import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  Switch, 
  TouchableOpacity 
} from 'react-native';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';

const ManagePricesScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [currentBankId, setCurrentBankId] = useState(null);
  
  // Estados para tipos de jugada disponibles
  const [availablePlayTypes] = useState([
    { id: 'fijo', label: 'Fijo', enabled: true },
    { id: 'corrido', label: 'Corrido', enabled: true },
    { id: 'posicion', label: 'Posición', enabled: true },
    { id: 'parle', label: 'Parlé', enabled: true },
    { id: 'centena', label: 'Centena', enabled: true },
    { id: 'tripleta', label: 'Tripleta', enabled: true },
  ]);
  
  const [enabledPlayTypes, setEnabledPlayTypes] = useState({
    fijo: true,
    corrido: true,
    posicion: true,
    parle: true,
    centena: true,
    tripleta: true,
  });

  // Estados para precios de ganancias (por cada peso jugado)
  const [winningPrices, setWinningPrices] = useState({
    fijo: { regular: '70', limited: '65' },
    corrido: { regular: '50', limited: '45' },
    posicion: { regular: '80', limited: '75' },
    parle: { regular: '800', limited: '750' },
    centena: { regular: '350', limited: '320' },
    tripleta: { regular: '4500', limited: '4000' },
  });

  // Estados para límites de números
  const [globalLimit, setGlobalLimit] = useState('');
  const [specificLimits, setSpecificLimits] = useState([
    { number: '', limit: '', id: Date.now() }
  ]);

  useEffect(() => {
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
          setCurrentBankId(data.role === 'admin' ? user.id : data.id_banco);
        } else {
          console.error('Error cargando rol:', error);
        }
      }
    };

    fetchUserRole();
    loadSavedConfiguration();
  }, []);

  const loadSavedConfiguration = async () => {
    // Aquí cargarías la configuración guardada desde la base de datos
    // Por ahora usando valores por defecto
  };

  const toggleAllPlayTypes = (enable) => {
    const newState = {};
    availablePlayTypes.forEach(type => {
      newState[type.id] = enable;
    });
    setEnabledPlayTypes(newState);
  };

  const togglePlayType = (typeId) => {
    setEnabledPlayTypes(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }));
  };

  const updateWinningPrice = (playType, priceType, value) => {
    setWinningPrices(prev => ({
      ...prev,
      [playType]: {
        ...prev[playType],
        [priceType]: value
      }
    }));
  };

  const addSpecificLimit = () => {
    setSpecificLimits(prev => [
      ...prev,
      { number: '', limit: '', id: Date.now() }
    ]);
  };

  const removeSpecificLimit = (id) => {
    setSpecificLimits(prev => prev.filter(item => item.id !== id));
  };

  const updateSpecificLimit = (id, field, value) => {
    setSpecificLimits(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const saveConfiguration = async () => {
    try {
      // Validar datos
      if (!globalLimit || isNaN(globalLimit)) {
        Alert.alert('Error', 'El límite global debe ser un número válido');
        return;
      }

      // Validar precios de ganancias
      for (const [playType, prices] of Object.entries(winningPrices)) {
        if (enabledPlayTypes[playType]) {
          if (!prices.regular || isNaN(prices.regular)) {
            Alert.alert('Error', `Precio regular para ${playType} debe ser un número válido`);
            return;
          }
          if (!prices.limited || isNaN(prices.limited)) {
            Alert.alert('Error', `Precio limitado para ${playType} debe ser un número válido`);
            return;
          }
        }
      }

      // Validar límites específicos
      for (const limit of specificLimits) {
        if (limit.number && (!limit.limit || isNaN(limit.limit))) {
          Alert.alert('Error', `El límite para el número ${limit.number} debe ser un número válido`);
          return;
        }
        if (limit.limit && (!limit.number || limit.number.length !== 2)) {
          Alert.alert('Error', `El número ${limit.number} debe tener exactamente 2 dígitos`);
          return;
        }
      }

      const configuration = {
        enabled_play_types: enabledPlayTypes,
        winning_prices: winningPrices,
        global_limit: parseInt(globalLimit),
        specific_limits: specificLimits.filter(item => item.number && item.limit),
        updated_at: new Date().toISOString()
      };

      // Aquí guardarías en la base de datos
      // const { error } = await supabase.from('price_configuration').upsert(configuration);
      
      Alert.alert('Éxito', 'Configuración guardada correctamente');
      console.log('Configuración guardada:', configuration);

    } catch (error) {
      console.error('Error al guardar configuración:', error);
      Alert.alert('Error', 'No se pudo guardar la configuración');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header personalizado */}
      <View style={styles.customHeader}>
        <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={styles.headerTitle}>Configurar Precios</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Sección: Tipos de Jugada */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipos de Jugada Disponibles</Text>
          
          {/* Botones Seleccionar/Deseleccionar Todas */}
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.selectButton, styles.selectAllButton]} 
              onPress={() => toggleAllPlayTypes(true)}
            >
              <Text style={styles.selectButtonText}>Seleccionar Todas</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.selectButton, styles.deselectAllButton]} 
              onPress={() => toggleAllPlayTypes(false)}
            >
              <Text style={styles.selectButtonText}>Deseleccionar Todas</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de tipos de jugada */}
          {availablePlayTypes.map(playType => (
            <View key={playType.id} style={styles.playTypeItem}>
              <Text style={styles.playTypeLabel}>{playType.label}</Text>
              <Switch
                value={enabledPlayTypes[playType.id]}
                onValueChange={() => togglePlayType(playType.id)}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={enabledPlayTypes[playType.id] ? '#f5dd4b' : '#f4f3f4'}
              />
            </View>
          ))}
        </View>

        {/* Sección: Precios de Ganancia */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Precios de Ganancia (por cada peso jugado)</Text>
          
          {availablePlayTypes.map(playType => (
            enabledPlayTypes[playType.id] && (
              <View key={playType.id} style={styles.priceGroup}>
                <Text style={styles.priceGroupTitle}>{playType.label}</Text>
                
                <View style={styles.priceRow}>
                  <View style={styles.priceField}>
                    <Text style={styles.priceLabel}>Precio Regular</Text>
                    <InputField
                      value={winningPrices[playType.id].regular}
                      onChangeText={(value) => updateWinningPrice(playType.id, 'regular', value)}
                      placeholder="0"
                      keyboardType="numeric"
                      style={styles.priceInput}
                    />
                  </View>
                  
                  <View style={styles.priceField}>
                    <Text style={styles.priceLabel}>Precio Limitado</Text>
                    <InputField
                      value={winningPrices[playType.id].limited}
                      onChangeText={(value) => updateWinningPrice(playType.id, 'limited', value)}
                      placeholder="0"
                      keyboardType="numeric"
                      style={styles.priceInput}
                    />
                  </View>
                </View>
              </View>
            )
          ))}
        </View>

        

        {/* Botón Guardar */}
        <ActionButton
          title="Guardar Configuración"
          onPress={saveConfiguration}
          variant="success"
          size="medium"
          style={styles.saveButton}
        />

      </ScrollView>

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
  customHeader: {
    height: 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    marginTop: 100,
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
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectAllButton: {
    backgroundColor: '#27AE60',
  },
  deselectAllButton: {
    backgroundColor: '#E74C3C',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
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
  priceInput: {
    marginBottom: 0,
  },
  limitGroup: {
    marginBottom: 20,
  },
  limitGroupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  specificLimitRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  numberField: {
    flex: 1,
    marginRight: 8,
  },
  limitField: {
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: '#E74C3C',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  saveButton: {
    marginTop: 20,
    marginBottom: 40,
  },
});
