import React, { useState, useEffect, useMemo } from 'react';
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

const CapacityModal = ({ isVisible, onClose, selectedLottery, capacityData = [], loading=false, error=null, filters, getScheduleLabel, playTypeLabels }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('capacity'); // 'capacity' | 'numeric'

  useEffect(()=>{ if(!isVisible){ setSearchTerm(''); setSortBy('capacity'); } },[isVisible]);

  const filteredRaw = useMemo(()=>{
    const { lotteries=[], schedules={}, playTypes=[] } = filters || {};
    return capacityData.filter(row => {
      if(lotteries.length && !lotteries.includes(row.loteriaId)) return false;
      if(playTypes.length && !playTypes.includes(row.jugada)) return false;
      // Para horario: requiere que la lotería tenga un horario elegido si se proporcionó
      const selectedForLottery = schedules[row.loteriaId];
      if(selectedForLottery && String(selectedForLottery) !== String(row.horarioId)) return false;
      return true;
    });
  },[capacityData, filters]);

  // Filtrar por búsqueda
  const filteredData = filteredRaw.filter(item => item.numero?.includes?.(searchTerm) || item.numero?.toString().includes(searchTerm));

  // Ordenar datos
  const sortedData = [...filteredData].sort((a,b)=>{
    if(sortBy==='capacity') return b.porcentaje - a.porcentaje;
    return parseInt(a.numero) - parseInt(b.numero);
  });

  const getCapacityColor = (pct) => pct>=80? '#E74C3C' : pct>=60? '#F39C12' : pct>=40? '#F1C40F' : '#27AE60';

  const renderCapacityItem = ({ item }) => (
    <View style={styles.capacityItem}>
      <View style={styles.numberContainer}><Text style={styles.numberText}>{item.numero}</Text></View>
      <View style={styles.capacityInfo}>
        <View style={styles.capacityBar}>
          <View style={[styles.capacityFill,{width:`${item.porcentaje}%`,backgroundColor:getCapacityColor(item.porcentaje)}]} />
        </View>
        <Text style={styles.capacityText}>${item.usado.toLocaleString()} / ${item.limite?.toLocaleString?.()||'—'}</Text>
        <Text style={styles.metaText}>{item.loteriaNombre} · {item.horarioNombre} · {playTypeLabels[item.jugada]||item.jugada}</Text>
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
            <Text style={styles.title}>Capacidad {filters?.lotteries?.length>1? '(Múltiples Loterías)':''}</Text>
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
          {loading ? (
            <Text style={styles.loadingText}>Cargando...</Text>
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <FlatList
              data={sortedData}
              keyExtractor={(item,idx) => item.loteriaId+"-"+item.horarioId+"-"+item.jugada+"-"+item.numero+"-"+idx}
              renderItem={renderCapacityItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}
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
  metaText: {
    fontSize: 10,
    color: '#7F8C8D'
  },
  loadingText: { textAlign:'center', marginTop:20, color:'#2C3E50' },
  errorText: { textAlign:'center', marginTop:20, color:'#E74C3C' },
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
