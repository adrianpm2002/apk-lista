import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import StatisticsChart from '../components/StatisticsChart';
import CollectorDataTable from '../components/CollectorDataTable';
import DateTimePickerWrapper from '../components/DateTimePickerWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { getDailyStatsForCollector, getPlaysDetailsForCollector, getTotalRecogidoHistoricoCollector, getTotalPagadoHistoricoCollector } from '../services/collectorStatsService';

const { width: screenWidth } = Dimensions.get('window');

const CollectorStatisticsScreen = ({ navigation, collectorId = 1, isDarkMode = false, onToggleDarkMode, onModeVisibilityChange }) => {
  // Estados para filtros
  const [selectedPeriod, setSelectedPeriod] = useState('last7days');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [selectedListero, setSelectedListero] = useState('all');
  const [lotterySchedules, setLotterySchedules] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('start');
  
  // Estados para modales
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Estados para datos
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('charts');
  const [chartHeight, setChartHeight] = useState(240);
  const [dailySeries, setDailySeries] = useState([]);
  const [detailRows, setDetailRows] = useState({});
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [totalPagadoHistorico, setTotalPagadoHistorico] = useState(0);
  const [expandedListeros, setExpandedListeros] = useState(new Set());

  // Estado del sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    loadData();
    loadHistoricalTotals();
  }, [selectedPeriod, startDate, endDate, collectorId]);

  useEffect(() => {
    if (activeTab === 'details') {
      loadDetailsData();
    }
  }, [activeTab, selectedLottery, selectedSchedule, selectedListero]);

  const loadData = async () => {
    try {
      const { start, end } = getDateRange();
      
      const dailyStats = await getDailyStatsForCollector(collectorId, start.toISOString(), end.toISOString());
      setDailySeries(dailyStats);
    } catch (error) {
      console.error('Error loading collector stats:', error);
      Alert.alert('Error', 'No se pudieron cargar las estadísticas');
    }
  };

  const loadDetailsData = async () => {
    try {
      const { start, end } = getDateRange();
      
      const details = await getPlaysDetailsForCollector(collectorId, start.toISOString(), end.toISOString(), {
        lottery: selectedLottery !== 'all' ? selectedLottery : null,
        schedule: selectedSchedule !== 'all' ? selectedSchedule : null,
        listero: selectedListero !== 'all' ? selectedListero : null
      });
      setDetailRows(details);
    } catch (error) {
      console.error('Error loading collector details:', error);
      Alert.alert('Error', 'No se pudieron cargar los detalles');
    }
  };

  const loadHistoricalTotals = async () => {
    try {
      const [totalRec, totalPag] = await Promise.all([
        getTotalRecogidoHistoricoCollector(collectorId),
        getTotalPagadoHistoricoCollector(collectorId)
      ]);
      setTotalHistorico(totalRec);
      setTotalPagadoHistorico(totalPag);
    } catch (error) {
      console.error('Error loading historical totals:', error);
    }
  };

  const getDateRange = () => {
    const end = new Date();
    let start = new Date();
    
    switch (selectedPeriod) {
      case 'last7days':
        start.setDate(end.getDate() - 7);
        break;
      case 'last30days':
        start.setDate(end.getDate() - 30);
        break;
      case 'custom':
        start = startDate;
        end = endDate;
        break;
    }
    
    return { start, end };
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadHistoricalTotals();
    if (activeTab === 'details') {
      await loadDetailsData();
    }
    setRefreshing(false);
  };

  const toggleListero = (listeroId) => {
    const newExpanded = new Set(expandedListeros);
    if (newExpanded.has(listeroId)) {
      newExpanded.delete(listeroId);
    } else {
      newExpanded.add(listeroId);
    }
    setExpandedListeros(newExpanded);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerType === 'start') {
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const totalRecogido = dailySeries.reduce((sum, day) => sum + day.totalRecogido, 0);
  const totalPagado = dailySeries.reduce((sum, day) => sum + day.totalPagado, 0);
  const balance = totalRecogido - totalPagado;

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <SideBarToggle onPress={() => setSidebarVisible(true)} />
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, isDarkMode && styles.darkText]}>
            Estadísticas del Collector
          </Text>
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setFiltersVisible(true)}
          >
            <Text style={styles.filterButtonText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
            <Text style={styles.summaryLabel}>Total Recogido</Text>
            <Text style={styles.summaryValue}>
              ${totalRecogido.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
            <Text style={styles.summaryLabel}>Total Pagado</Text>
            <Text style={styles.summaryValue}>
              ${totalPagado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.summaryCard, { 
            backgroundColor: balance >= 0 ? '#E8F5E8' : '#FFEBEE' 
          }]}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={[styles.summaryValue, { 
              color: balance >= 0 ? '#2E7D32' : '#C62828' 
            }]}>
              ${balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Historical Totals */}
        <View style={styles.historicalContainer}>
          <Text style={[styles.historicalTitle, isDarkMode && styles.darkText]}>
            Totales Históricos
          </Text>
          <View style={styles.historicalRow}>
            <Text style={[styles.historicalLabel, isDarkMode && styles.darkText]}>
              Total Recogido Histórico: 
            </Text>
            <Text style={[styles.historicalValue, isDarkMode && styles.darkText]}>
              ${totalHistorico.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.historicalRow}>
            <Text style={[styles.historicalLabel, isDarkMode && styles.darkText]}>
              Total Pagado Histórico: 
            </Text>
            <Text style={[styles.historicalValue, isDarkMode && styles.darkText]}>
              ${totalPagadoHistorico.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.historicalRow}>
            <Text style={[styles.historicalLabel, isDarkMode && styles.darkText]}>
              Balance Histórico: 
            </Text>
            <Text style={[styles.historicalValue, { 
              color: (totalHistorico - totalPagadoHistorico) >= 0 ? '#2E7D32' : '#C62828' 
            }]}>
              ${(totalHistorico - totalPagadoHistorico).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'charts' && styles.activeTab]}
            onPress={() => setActiveTab('charts')}
          >
            <Text style={[styles.tabText, activeTab === 'charts' && styles.activeTabText]}>
              Gráficos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'details' && styles.activeTab]}
            onPress={() => setActiveTab('details')}
          >
            <Text style={[styles.tabText, activeTab === 'details' && styles.activeTabText]}>
              Detalles
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'charts' ? (
          <View style={styles.chartContainer}>
            <View style={styles.chartControls}>
              <TouchableOpacity
                style={styles.chartSizeButton}
                onPress={() => setChartHeight(chartHeight === 240 ? 400 : 240)}
              >
                <Text style={styles.chartSizeButtonText}>
                  {chartHeight === 240 ? 'Grande' : 'Pequeño'}
                </Text>
              </TouchableOpacity>
            </View>
            <StatisticsChart
              data={dailySeries}
              height={chartHeight}
              isDarkMode={isDarkMode}
            />
          </View>
        ) : (
          <CollectorDataTable
            data={detailRows}
            expandedListeros={expandedListeros}
            onToggleListero={toggleListero}
            isDarkMode={isDarkMode}
          />
        )}
      </ScrollView>

      {/* Sidebar */}
      <SideBar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />

      {/* Filters Modal */}
      <Modal visible={filtersVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkModalContent]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Filtros</Text>
            
            <Text style={[styles.filterLabel, isDarkMode && styles.darkText]}>Período:</Text>
            <Picker
              selectedValue={selectedPeriod}
              onValueChange={setSelectedPeriod}
              style={[styles.picker, isDarkMode && styles.darkPicker]}
            >
              <Picker.Item label="Últimos 7 días" value="last7days" />
              <Picker.Item label="Últimos 30 días" value="last30days" />
              <Picker.Item label="Personalizado" value="custom" />
            </Picker>

            {selectedPeriod === 'custom' && (
              <View style={styles.datePickerContainer}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setDatePickerType('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.dateButtonText}>
                    Inicio: {startDate.toLocaleDateString('es-DO')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setDatePickerType('end');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={styles.dateButtonText}>
                    Fin: {endDate.toLocaleDateString('es-DO')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.filterLabel, isDarkMode && styles.darkText]}>Lotería:</Text>
            <Picker
              selectedValue={selectedLottery}
              onValueChange={setSelectedLottery}
              style={[styles.picker, isDarkMode && styles.darkPicker]}
            >
              <Picker.Item label="Todas" value="all" />
              <Picker.Item label="Lotería Nacional" value="nacional" />
              <Picker.Item label="Leidsa" value="leidsa" />
            </Picker>

            <Text style={[styles.filterLabel, isDarkMode && styles.darkText]}>Horario:</Text>
            <Picker
              selectedValue={selectedSchedule}
              onValueChange={setSelectedSchedule}
              style={[styles.picker, isDarkMode && styles.darkPicker]}
            >
              <Picker.Item label="Todos" value="all" />
              <Picker.Item label="Matutino" value="matutino" />
              <Picker.Item label="Vespertino" value="vespertino" />
              <Picker.Item label="Nocturno" value="nocturno" />
            </Picker>

            <Text style={[styles.filterLabel, isDarkMode && styles.darkText]}>Listero:</Text>
            <Picker
              selectedValue={selectedListero}
              onValueChange={setSelectedListero}
              style={[styles.picker, isDarkMode && styles.darkPicker]}
            >
              <Picker.Item label="Todos" value="all" />
              <Picker.Item label="Juan Pérez" value="1" />
              <Picker.Item label="María García" value="2" />
              <Picker.Item label="Carlos López" value="3" />
            </Picker>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setFiltersVisible(false);
                  loadData();
                  if (activeTab === 'details') {
                    loadDetailsData();
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Aplicar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setFiltersVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      <DateTimePickerWrapper
        isVisible={showDatePicker}
        value={datePickerType === 'start' ? startDate : endDate}
        onChange={handleDateChange}
        onCancel={() => setShowDatePicker(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  darkContainer: {
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  darkText: {
    color: '#FFF',
  },
  filterButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  historicalContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 12,
  },
  historicalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  historicalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historicalLabel: {
    fontSize: 12,
    color: '#666',
  },
  historicalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
  chartContainer: {
    padding: 16,
  },
  chartControls: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  chartSizeButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chartSizeButtonText: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  darkModalContent: {
    backgroundColor: '#1E1E1E',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  picker: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  darkPicker: {
    backgroundColor: '#333',
    color: '#FFF',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  dateButton: {
    backgroundColor: '#E3F2FD',
    padding: 10,
    borderRadius: 8,
    flex: 0.48,
  },
  dateButtonText: {
    textAlign: 'center',
    color: '#1976D2',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});

export default CollectorStatisticsScreen;
