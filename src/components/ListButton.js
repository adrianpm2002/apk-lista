import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';

const ListButton = ({ onOptionSelect, isDarkMode = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [savedPlays, setSavedPlays] = useState([]);
  const [filteredPlays, setFilteredPlays] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedLotteryFilter, setSelectedLotteryFilter] = useState('all');
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState('all');
  const [showOnlyWinners, setShowOnlyWinners] = useState(false);
  const [selectedPlays, setSelectedPlays] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Datos simulados de jugadas guardadas (normalmente vendrían de una base de datos)
  const mockSavedPlays = [
    {
      id: 1,
      lottery: 'Georgia',
      schedule: 'mediodia',
      playType: 'fijo',
      numbers: '12, 34, 56',
      amount: 100,
      total: 300,
      note: 'Números de la suerte',
      timestamp: new Date('2025-01-13T12:00:00'),
      result: '12',
      prize: 5000,
      hasPrize: true
    },
    {
      id: 2,
      lottery: 'Florida',
      schedule: 'noche',
      playType: 'corrido',
      numbers: '78, 90',
      amount: 50,
      total: 100,
      note: 'Jugada especial',
      timestamp: new Date('2025-01-13T18:00:00'),
      result: 'no disponible',
      prize: 'desconocido',
      hasPrize: false
    },
    {
      id: 3,
      lottery: 'New York',
      schedule: 'mediodia',
      playType: 'parle',
      numbers: '23, 45',
      amount: 75,
      total: 150,
      note: 'Combinación ganadora',
      timestamp: new Date('2025-01-12T12:30:00'),
      result: '23',
      prize: 3750,
      hasPrize: true
    },
    {
      id: 4,
      lottery: 'Georgia',
      schedule: 'noche',
      playType: 'centena',
      numbers: '123, 456',
      amount: 25,
      total: 50,
      note: 'Prueba centena',
      timestamp: new Date('2025-01-12T19:15:00'),
      result: 'no disponible',
      prize: 'desconocido',
      hasPrize: false
    }
  ];

  useEffect(() => {
    // Simular carga de datos desde base de datos
    setSavedPlays(mockSavedPlays.sort((a, b) => b.timestamp - a.timestamp));
  }, []);

  useEffect(() => {
    // Filtrar jugadas según criterios seleccionados
    let filtered = [...savedPlays];

    // Filtro por texto de búsqueda
    if (searchText.trim()) {
      filtered = filtered.filter(play => 
        play.lottery.toLowerCase().includes(searchText.toLowerCase()) ||
        play.note.toLowerCase().includes(searchText.toLowerCase()) ||
        play.numbers.includes(searchText)
      );
    }

    // Filtro por lotería
    if (selectedLotteryFilter !== 'all') {
      filtered = filtered.filter(play => play.lottery === selectedLotteryFilter);
    }

    // Filtro por horario
    if (selectedScheduleFilter !== 'all') {
      filtered = filtered.filter(play => play.schedule === selectedScheduleFilter);
    }

    // Filtro solo ganadores
    if (showOnlyWinners) {
      filtered = filtered.filter(play => play.hasPrize);
    }

    setFilteredPlays(filtered);
  }, [savedPlays, searchText, selectedLotteryFilter, selectedScheduleFilter, showOnlyWinners]);

  // Calcular totales
  const getTotals = () => {
    const totalRecogido = filteredPlays
      .filter(play => play.hasPrize)
      .reduce((sum, play) => sum + (typeof play.prize === 'number' ? play.prize : 0), 0);
    
    const pendientePago = filteredPlays
      .filter(play => !play.hasPrize && play.result === 'no disponible')
      .reduce((sum, play) => sum + play.total, 0);

    return { totalRecogido, pendientePago };
  };

  const { totalRecogido, pendientePago } = getTotals();

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    return timestamp.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getPlayTypeLabel = (playType) => {
    const labels = {
      'fijo': 'Fijo',
      'corrido': 'Corrido',
      'posicion': 'Posición',
      'parle': 'Parlé',
      'centena': 'Centena',
      'tripleta': 'Tripleta'
    };
    return labels[playType] || playType;
  };

  const handlePlayPress = (playId) => {
    if (isSelectionMode) {
      togglePlaySelection(playId);
    }
  };

  const handlePlayLongPress = (playId) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedPlays(new Set([playId]));
    }
  };

  const togglePlaySelection = (playId) => {
    const newSelection = new Set(selectedPlays);
    if (newSelection.has(playId)) {
      newSelection.delete(playId);
    } else {
      newSelection.add(playId);
    }
    setSelectedPlays(newSelection);
    
    // Si no hay elementos seleccionados, salir del modo selección
    if (newSelection.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleDeleteSelected = () => {
    Alert.alert(
      'Eliminar jugadas',
      `¿Estás seguro de que quieres eliminar ${selectedPlays.size} jugada(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSavedPlays(prev => prev.filter(play => !selectedPlays.has(play.id)));
            setSelectedPlays(new Set());
            setIsSelectionMode(false);
          }
        }
      ]
    );
  };

  const handleDeleteSingle = (playId) => {
    Alert.alert(
      'Eliminar jugada',
      '¿Estás seguro de que quieres eliminar esta jugada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSavedPlays(prev => prev.filter(play => play.id !== playId));
          }
        }
      ]
    );
  };

  const cancelSelection = () => {
    setSelectedPlays(new Set());
    setIsSelectionMode(false);
  };

  const renderPlayItem = ({ item }) => (
    <Pressable
      style={[
        styles.playCard, 
        isDarkMode && styles.playCardDark,
        selectedPlays.has(item.id) && styles.playCardSelected,
        selectedPlays.has(item.id) && isDarkMode && styles.playCardSelectedDark
      ]}
      onPress={() => handlePlayPress(item.id)}
      onLongPress={() => handlePlayLongPress(item.id)}
    >
      {/* Indicador de selección */}
      {isSelectionMode && (
        <View style={styles.selectionIndicator}>
          <View style={[
            styles.selectionCheckbox,
            selectedPlays.has(item.id) && styles.selectionCheckboxSelected,
            isDarkMode && styles.selectionCheckboxDark
          ]}>
            {selectedPlays.has(item.id) && (
              <Text style={styles.selectionCheckmark}>✓</Text>
            )}
          </View>
        </View>
      )}

      {/* Botón de eliminar individual */}
      {!isSelectionMode && (
        <Pressable
          style={[styles.deleteButton, isDarkMode && styles.deleteButtonDark]}
          onPress={() => handleDeleteSingle(item.id)}
        >
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </Pressable>
      )}

      {/* Primera fila: Lotería y Resultado juntos */}
      <View style={styles.headerRow}>
        <View style={styles.lotteryResultContainer}>
          <Text style={[styles.lotteryName, isDarkMode && styles.lotteryNameDark]}>
            {item.lottery}
          </Text>
          <Text style={[styles.resultBadge, isDarkMode && styles.resultBadgeDark]}>
            {item.result}
          </Text>
        </View>
      </View>

      {/* Segunda fila: Nota y Tipo de jugada */}
      <View style={styles.infoRow}>
        <Text style={[styles.note, isDarkMode && styles.noteDark]} numberOfLines={1}>
          {item.note}
        </Text>
        <Text style={[styles.playType, isDarkMode && styles.playTypeDark]}>
          {getPlayTypeLabel(item.playType)}
        </Text>
      </View>

      {/* Tercera fila: Números, Monto y Total */}
      <View style={styles.numbersRow}>
        <Text style={[styles.numbers, isDarkMode && styles.numbersDark]}>
          {item.numbers}
        </Text>
        <View style={styles.amountContainer}>
          <Text style={[styles.amount, isDarkMode && styles.amountDark]}>
            ${item.amount} × {item.numbers.split(',').length} = ${item.total}
          </Text>
        </View>
      </View>

      {/* Cuarta fila: Premio mejorado */}
      <View style={styles.prizeRow}>
        <View style={[
          styles.prizeContainer,
          item.hasPrize && styles.prizeContainerWinner,
          isDarkMode && styles.prizeContainerDark,
          item.hasPrize && isDarkMode && styles.prizeContainerWinnerDark
        ]}>
          <Text style={[styles.prizeIcon]}>
            {item.hasPrize ? '🏆' : '⏳'}
          </Text>
          <Text style={[
            styles.prizeText, 
            isDarkMode && styles.prizeTextDark,
            item.hasPrize && styles.prizeTextWinner
          ]}>
            {item.hasPrize ? 'GANADOR' : 'PENDIENTE'}
          </Text>
          <Text style={[
            styles.prizeValue, 
            isDarkMode && styles.prizeValueDark,
            item.hasPrize && styles.prizeValueWinner
          ]}>
            {typeof item.prize === 'number' ? `$${item.prize}` : item.prize}
          </Text>
        </View>
        <View style={styles.timeContainer}>
          <Text style={[styles.timestamp, isDarkMode && styles.timestampDark]}>
            {formatTime(item.timestamp)} - {item.schedule}
          </Text>
        </View>
      </View>
    </Pressable>
  );

  const renderFilterButton = (value, currentValue, onPress, label) => (
    <Pressable
      style={[
        styles.filterButton,
        value === currentValue && styles.filterButtonActive,
        isDarkMode && styles.filterButtonDark,
        value === currentValue && isDarkMode && styles.filterButtonActiveDark
      ]}
      onPress={() => onPress(value)}
    >
      <Text style={[
        styles.filterButtonText,
        value === currentValue && styles.filterButtonTextActive,
        isDarkMode && styles.filterButtonTextDark
      ]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isDarkMode && styles.buttonDark
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.buttonIcon}>📄</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, isDarkMode && styles.modalDark]}>
            {/* Barra superior con filtros y totales */}
            <View style={styles.topBar}>
              {!isSelectionMode ? (
                <>
                  <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                    Jugadas Guardadas
                  </Text>
                  
                  {/* Barra de búsqueda */}
                  <TextInput
                    style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
                    placeholder="Buscar..."
                    placeholderTextColor={isDarkMode ? '#7F8C8D' : '#95A5A6'}
                    value={searchText}
                    onChangeText={setSearchText}
                  />

                  {/* Filtros por lotería */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
                    {renderFilterButton('all', selectedLotteryFilter, setSelectedLotteryFilter, 'Todas')}
                    {renderFilterButton('Georgia', selectedLotteryFilter, setSelectedLotteryFilter, 'Georgia')}
                    {renderFilterButton('Florida', selectedLotteryFilter, setSelectedLotteryFilter, 'Florida')}
                    {renderFilterButton('New York', selectedLotteryFilter, setSelectedLotteryFilter, 'New York')}
                  </ScrollView>
                </>
              ) : (
                <>
                  {/* Barra de selección múltiple */}
                  <View style={styles.selectionBar}>
                    <Text style={[styles.selectionTitle, isDarkMode && styles.selectionTitleDark]}>
                      {selectedPlays.size} jugada(s) seleccionada(s)
                    </Text>
                    <View style={styles.selectionActions}>
                      <Pressable
                        style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
                        onPress={cancelSelection}
                      >
                        <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>
                          Cancelar
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.deleteSelectedButton, isDarkMode && styles.deleteSelectedButtonDark]}
                        onPress={handleDeleteSelected}
                      >
                        <Text style={styles.deleteSelectedButtonText}>
                          🗑️ Eliminar ({selectedPlays.size})
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )}

              {/* Filtros por horario - Solo mostrar si no estamos en modo selección */}
              {!isSelectionMode && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
                    {renderFilterButton('all', selectedScheduleFilter, setSelectedScheduleFilter, 'Todos')}
                    {renderFilterButton('mediodia', selectedScheduleFilter, setSelectedScheduleFilter, 'Mediodía')}
                    {renderFilterButton('noche', selectedScheduleFilter, setSelectedScheduleFilter, 'Noche')}
                  </ScrollView>

                  {/* Totales y filtro de premios */}
                  <View style={styles.totalsRow}>
                    <Text style={[styles.totalText, isDarkMode && styles.totalTextDark]}>
                      Recogido: ${totalRecogido}
                    </Text>
                    <Text style={[styles.totalText, isDarkMode && styles.totalTextDark]}>
                      Pendiente: ${pendientePago}
                    </Text>
                    <Pressable
                      style={[
                        styles.prizeFilterButton,
                        showOnlyWinners && styles.prizeFilterButtonActive,
                        isDarkMode && styles.prizeFilterButtonDark,
                        showOnlyWinners && isDarkMode && styles.prizeFilterButtonActiveDark
                      ]}
                      onPress={() => setShowOnlyWinners(!showOnlyWinners)}
                    >
                      <Text style={styles.prizeFilterIcon}>
                        {showOnlyWinners ? '🏆' : '🎯'}
                      </Text>
                      <Text style={[
                        styles.prizeFilterText,
                        showOnlyWinners && styles.prizeFilterTextActive,
                        isDarkMode && styles.prizeFilterTextDark
                      ]}>
                        {showOnlyWinners ? 'Solo Ganadores' : 'Mostrar Todo'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            {/* Lista de jugadas */}
            <FlatList
              data={filteredPlays}
              renderItem={renderPlayItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.playsList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
                  No hay jugadas que coincidan con los filtros
                </Text>
              }
            />

            {/* Botón cerrar */}
            <Pressable
              style={[styles.closeButton, isDarkMode && styles.closeButtonDark]}
              onPress={() => {
                setIsVisible(false);
                // Cancelar selección al cerrar
                setSelectedPlays(new Set());
                setIsSelectionMode(false);
              }}
            >
              <Text style={[styles.closeButtonText, isDarkMode && styles.closeButtonTextDark]}>
                Cerrar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    width: '95%',
    height: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  modalDark: {
    backgroundColor: '#2C3E50',
  },
  topBar: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D5016',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalTitleDark: {
    color: '#ECF0F1',
  },
  searchInput: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#2D5016',
    marginBottom: 12,
  },
  searchInputDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
    color: '#ECF0F1',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filterButton: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  filterButtonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  filterButtonActive: {
    backgroundColor: '#E8F5E8',
    borderColor: '#27AE60',
  },
  filterButtonActiveDark: {
    backgroundColor: '#5D6D7E',
    borderColor: '#27AE60',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '500',
  },
  filterButtonTextDark: {
    color: '#ECF0F1',
  },
  filterButtonTextActive: {
    fontWeight: '700',
    color: '#27AE60',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  totalText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
  },
  totalTextDark: {
    color: '#ECF0F1',
  },
  prizeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F39C12',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E67E22',
  },
  prizeFilterButtonDark: {
    backgroundColor: '#E67E22',
    borderColor: '#D35400',
  },
  prizeFilterButtonActive: {
    backgroundColor: '#27AE60',
    borderColor: '#229954',
  },
  prizeFilterButtonActiveDark: {
    backgroundColor: '#229954',
    borderColor: '#1E8449',
  },
  prizeFilterIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  prizeFilterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  prizeFilterTextDark: {
    color: '#FFFFFF',
  },
  prizeFilterTextActive: {
    color: '#FFFFFF',
  },
  playsList: {
    flex: 1,
    marginBottom: 16,
  },
  playCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8F1E4',
  },
  playCardDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  lotteryResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lotteryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D5016',
    marginRight: 8,
  },
  lotteryNameDark: {
    color: '#ECF0F1',
  },
  resultBadge: {
    backgroundColor: '#E8F5E8',
    borderColor: '#27AE60',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#27AE60',
  },
  resultBadgeDark: {
    backgroundColor: '#2C3E50',
    borderColor: '#27AE60',
    color: '#27AE60',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  note: {
    fontSize: 12,
    color: '#5D6D7E',
    flex: 1,
    marginRight: 8,
  },
  noteDark: {
    color: '#BDC3C7',
  },
  playType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E44AD',
    backgroundColor: '#F4ECF7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  playTypeDark: {
    color: '#BB8FCE',
    backgroundColor: '#5D6D7E',
  },
  numbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  numbers: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5016',
    flex: 1,
  },
  numbersDark: {
    color: '#ECF0F1',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#27AE60',
  },
  amountDark: {
    color: '#58D68D',
  },
  prizeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 10,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  timestampDark: {
    color: '#BDC3C7',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#7F8C8D',
    marginTop: 40,
    fontStyle: 'italic',
  },
  emptyTextDark: {
    color: '#BDC3C7',
  },
  closeButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C0392B',
  },
  closeButtonDark: {
    backgroundColor: '#C0392B',
    borderColor: '#A93226',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButtonTextDark: {
    color: '#FFFFFF',
  },
  // Estilos para selección múltiple
  playCardSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  playCardSelectedDark: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1,
  },
  selectionCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#BDC3C7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCheckboxDark: {
    backgroundColor: '#34495E',
    borderColor: '#7F8C8D',
  },
  selectionCheckboxSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  selectionCheckmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  selectionTitleDark: {
    color: '#ECF0F1',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#95A5A6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cancelButtonDark: {
    backgroundColor: '#7F8C8D',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButtonTextDark: {
    color: '#FFFFFF',
  },
  deleteSelectedButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteSelectedButtonDark: {
    backgroundColor: '#C0392B',
  },
  deleteSelectedButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#E74C3C',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  deleteButtonDark: {
    backgroundColor: '#C0392B',
  },
  deleteButtonText: {
    fontSize: 14,
  },
  // Estilos mejorados para premio
  prizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  prizeContainerDark: {
    backgroundColor: '#2C3E50',
    borderColor: '#34495E',
  },
  prizeContainerWinner: {
    backgroundColor: '#D4E6F1',
    borderColor: '#5DADE2',
  },
  prizeContainerWinnerDark: {
    backgroundColor: '#1B4F72',
    borderColor: '#3498DB',
  },
  prizeIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  prizeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7F8C8D',
    marginRight: 6,
  },
  prizeTextDark: {
    color: '#BDC3C7',
  },
  prizeTextWinner: {
    color: '#2E86C1',
  },
  prizeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C3E50',
  },
  prizeValueDark: {
    color: '#ECF0F1',
  },
  prizeValueWinner: {
    color: '#1B4F72',
  },
});

export default ListButton;
