import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
} from 'react-native';

const CapacityModal = ({ isVisible, onClose, selectedLottery }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('capacity'); // 'capacity' o 'numeric'
  const [capacityData, setCapacityData] = useState([]);

  // Datos simulados - en producción vendrían de la API
  const mockCapacityData = [
    { number: '05', used: 0, total: 2000, percentage: 0 },
    { number: '12', used: 800, total: 1500, percentage: 53.3 },
    { number: '23', used: 1200, total: 2000, percentage: 60 },
    { number: '34', used: 1800, total: 2000, percentage: 90 },
    { number: '45', used: 500, total: 1000, percentage: 50 },
    { number: '56', used: 1500, total: 2000, percentage: 75 },
    { number: '67', used: 300, total: 800, percentage: 37.5 },
    { number: '78', used: 1900, total: 2000, percentage: 95 },
    { number: '89', used: 600, total: 1200, percentage: 50 },
    { number: '90', used: 700, total: 1000, percentage: 70 },
  ];

  useEffect(() => {
    // Filtrar solo números que tienen jugadas (used > 0)
    const activeNumbers = mockCapacityData.filter(item => item.used > 0);
    setCapacityData(activeNumbers);
  }, []);

  // Filtrar por búsqueda
  const filteredData = capacityData.filter(item =>
    item.number.includes(searchTerm)
  );

  // Ordenar datos
  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'capacity') {
      return b.percentage - a.percentage; // Mayor a menor capacidad
    } else {
      return parseInt(a.number) - parseInt(b.number); // Orden numérico
    }
  });

  const getCapacityColor = (percentage) => {
    if (percentage >= 80) return '#E74C3C'; // Rojo - Casi lleno
    if (percentage >= 60) return '#F39C12'; // Naranja - Medio lleno
    if (percentage >= 40) return '#F1C40F'; // Amarillo - Poco lleno
    return '#27AE60'; // Verde - Disponible
  };

  const renderCapacityItem = ({ item }) => (
    <View style={styles.capacityItem}>
      <View style={styles.numberContainer}>
        <Text style={styles.numberText}>{item.number}</Text>
      </View>
      
      <View style={styles.capacityInfo}>
        <View style={styles.capacityBar}>
          <View 
            style={[
              styles.capacityFill, 
              { 
                width: `${item.percentage}%`,
                backgroundColor: getCapacityColor(item.percentage)
              }
            ]} 
          />
        </View>
        <Text style={styles.capacityText}>
          ${item.used.toLocaleString()} / ${item.total.toLocaleString()}
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Capacidad de: {selectedLottery || 'No seleccionada'}
            </Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Buscador */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar número..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              keyboardType="number-pad"
            />
          </View>

          {/* Botones de ordenamiento */}
          <View style={styles.sortContainer}>
            <Pressable
              style={[
                styles.sortButton,
                sortBy === 'capacity' && styles.sortButtonActive
              ]}
              onPress={() => setSortBy('capacity')}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === 'capacity' && styles.sortButtonTextActive
              ]}>
                Por Capacidad
              </Text>
            </Pressable>
            
            <Pressable
              style={[
                styles.sortButton,
                sortBy === 'numeric' && styles.sortButtonActive
              ]}
              onPress={() => setSortBy('numeric')}
            >
              <Text style={[
                styles.sortButtonText,
                sortBy === 'numeric' && styles.sortButtonTextActive
              ]}>
                Orden Numérico
              </Text>
            </Pressable>
          </View>

          {/* Lista de capacidades */}
          <FlatList
            data={sortedData}
            keyExtractor={(item) => item.number}
            renderItem={renderCapacityItem}
            style={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    height: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    marginBottom: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D5DBDB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  sortContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#D5DBDB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#3498DB',
    borderColor: '#3498DB',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  list: {
    flex: 1,
  },
  capacityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  numberContainer: {
    width: 40,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ECF0F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  numberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  capacityInfo: {
    flex: 1,
  },
  capacityBar: {
    height: 6,
    backgroundColor: '#ECF0F1',
    borderRadius: 3,
    marginBottom: 3,
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    borderRadius: 3,
  },
  capacityText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#5D6D7E',
    marginBottom: 2,
  },
  footer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#5D6D7E',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#95A5A6',
  },
});

export default CapacityModal;
