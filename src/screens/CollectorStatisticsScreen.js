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
import { useDarkMode } from '../contexts/DarkModeContext';
import { createCommonDarkStyles, createStatisticsDarkStyles, DarkTheme, LightTheme } from '../utils/darkModeStyles';

const { width: screenWidth } = Dimensions.get('window');

const CollectorStatisticsScreen = ({ navigation, collectorId = 1, onModeVisibilityChange }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  
  // Crear estilos adaptativos para modo oscuro
  const commonStyles = createCommonDarkStyles(isDarkMode);
  const statisticsStyles = createStatisticsDarkStyles(isDarkMode);
  
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
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <SideBarToggle onPress={() => setSidebarVisible(true)} />
      
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={[styles.header, isDarkMode && styles.headerDark]}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Estadísticas del Collector
          </Text>
          <TouchableOpacity 
            style={[styles.filterButton, isDarkMode && styles.filterButtonDark]}
            onPress={() => setFiltersVisible(true)}
          >
            <Text style={styles.filterButtonText}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={[styles.summaryCard, styles.summaryCardDark && isDarkMode, { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.summaryLabel, isDarkMode && styles.summaryLabelDark]}>Total Recogido</Text>
            <Text style={[styles.summaryValue, isDarkMode && styles.summaryValueDark]}>
              ${totalRecogido.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardDark && isDarkMode, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.summaryLabel, isDarkMode && styles.summaryLabelDark]}>Total Pagado</Text>
            <Text style={[styles.summaryValue, isDarkMode && styles.summaryValueDark]}>
              ${totalPagado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[styles.summaryCard, { 
            backgroundColor: balance >= 0 ? '#E8F5E8' : '#FFEBEE' 
          }, isDarkMode && styles.summaryCardDark]}>
            <Text style={[styles.summaryLabel, isDarkMode && styles.summaryLabelDark]}>Balance</Text>
            <Text style={[styles.summaryValue, { 
              color: balance >= 0 ? '#2E7D32' : '#C62828' 
            }]}>
              ${balance.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>

        {/* Historical Totals */}
        <View style={[styles.historicalContainer, isDarkMode && styles.historicalContainerDark]}>
          <Text style={[styles.historicalTitle, isDarkMode && styles.historicalTitleDark]}>
            Totales Históricos
          </Text>
          <View style={styles.historicalRow}>
            <Text style={[styles.historicalLabel, isDarkMode && styles.historicalLabelDark]}>
              Total Recogido Histórico: 
            </Text>
            <Text style={[styles.historicalValue, isDarkMode && styles.historicalValueDark]}>
              ${totalHistorico.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.historicalRow}>
            <Text style={[styles.historicalLabel, isDarkMode && styles.historicalLabelDark]}>
              Total Pagado Histórico: 
            </Text>
            <Text style={[styles.historicalValue, isDarkMode && styles.historicalValueDark]}>
              ${totalPagadoHistorico.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.historicalRow}>
            <Text style={[styles.historicalLabel, isDarkMode && styles.historicalLabelDark]}>
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
            style={[
              styles.tab, 
              isDarkMode && styles.tabDark,
              activeTab === 'charts' && styles.activeTab,
              activeTab === 'charts' && isDarkMode && styles.activeTabDark
            ]}
            onPress={() => setActiveTab('charts')}
          >
            <Text style={[
              styles.tabText, 
              isDarkMode && styles.tabTextDark,
              activeTab === 'charts' && styles.activeTabText
            ]}>
              Gráficos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab, 
              isDarkMode && styles.tabDark,
              activeTab === 'details' && styles.activeTab,
              activeTab === 'details' && isDarkMode && styles.activeTabDark
            ]}
            onPress={() => setActiveTab('details')}
          >
            <Text style={[
              styles.tabText, 
              isDarkMode && styles.tabTextDark,
              activeTab === 'details' && styles.activeTabText
            ]}>
              Detalles
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'charts' ? (
          <View style={[styles.chartContainer, isDarkMode && styles.chartContainerDark]}>
            <View style={styles.chartControls}>
              <TouchableOpacity
                style={[styles.chartSizeButton, isDarkMode && styles.chartSizeButtonDark]}
                onPress={() => setChartHeight(chartHeight === 240 ? 400 : 240)}
              >
                <Text style={[styles.chartSizeButtonText, isDarkMode && styles.chartSizeButtonTextDark]}>
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
        onToggleDarkMode={toggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />

      {/* Filters Modal */}
      <Modal visible={filtersVisible} transparent animationType="slide">
        <View style={[styles.modalOverlay, isDarkMode && styles.modalOverlayDark]}>
          <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>Filtros</Text>
            
            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Período:</Text>
            <Picker
              selectedValue={selectedPeriod}
              onValueChange={setSelectedPeriod}
              style={[styles.picker, isDarkMode && styles.pickerDark]}
            >
              <Picker.Item label="Últimos 7 días" value="last7days" />
              <Picker.Item label="Últimos 30 días" value="last30days" />
              <Picker.Item label="Personalizado" value="custom" />
            </Picker>

            {selectedPeriod === 'custom' && (
              <View style={styles.datePickerContainer}>
                <TouchableOpacity
                  style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
                  onPress={() => {
                    setDatePickerType('start');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                    Inicio: {startDate.toLocaleDateString('es-DO')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
                  onPress={() => {
                    setDatePickerType('end');
                    setShowDatePicker(true);
                  }}
                >
                  <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                    Fin: {endDate.toLocaleDateString('es-DO')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Lotería:</Text>
            <Picker
              selectedValue={selectedLottery}
              onValueChange={setSelectedLottery}
              style={[styles.picker, isDarkMode && styles.pickerDark]}
            >
              <Picker.Item label="Todas" value="all" />
              <Picker.Item label="Lotería Nacional" value="nacional" />
              <Picker.Item label="Leidsa" value="leidsa" />
            </Picker>

            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Horario:</Text>
            <Picker
              selectedValue={selectedSchedule}
              onValueChange={setSelectedSchedule}
              style={[styles.picker, isDarkMode && styles.pickerDark]}
            >
              <Picker.Item label="Todos" value="all" />
              <Picker.Item label="Matutino" value="matutino" />
              <Picker.Item label="Vespertino" value="vespertino" />
              <Picker.Item label="Nocturno" value="nocturno" />
            </Picker>

            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Listero:</Text>
            <Picker
              selectedValue={selectedListero}
              onValueChange={setSelectedListero}
              style={[styles.picker, isDarkMode && styles.pickerDark]}
            >
              <Picker.Item label="Todos" value="all" />
              <Picker.Item label="Juan Pérez" value="1" />
              <Picker.Item label="María García" value="2" />
              <Picker.Item label="Carlos López" value="3" />
            </Picker>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
                onPress={() => {
                  setFiltersVisible(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, isDarkMode && styles.modalButtonDark]}
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
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  titleDark: {
    color: '#ecf0f1',
  },
  filterButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterButtonDark: {
    backgroundColor: '#3498db',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  summaryCardDark: {
    backgroundColor: '#2c3e50',
    borderColor: '#34495e',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  summaryLabelDark: {
    color: '#bdc3c7',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  summaryValueDark: {
    color: '#ecf0f1',
  },
  historicalContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  historicalContainerDark: {
    backgroundColor: '#2c3e50',
    borderColor: '#34495e',
  },
  historicalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  historicalTitleDark: {
    color: '#ecf0f1',
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
  historicalLabelDark: {
    color: '#bdc3c7',
  },
  historicalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  historicalValueDark: {
    color: '#ecf0f1',
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
  tabDark: {
    backgroundColor: '#34495e',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  activeTabDark: {
    backgroundColor: '#3498db',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextDark: {
    color: '#bdc3c7',
  },
  activeTabText: {
    color: '#FFF',
    fontWeight: '600',
  },
  chartContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chartContainerDark: {
    backgroundColor: '#2c3e50',
    borderColor: '#34495e',
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
  chartSizeButtonDark: {
    backgroundColor: '#34495e',
  },
  chartSizeButtonText: {
    fontSize: 12,
    color: '#666',
  },
  chartSizeButtonTextDark: {
    color: '#bdc3c7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalOverlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalContentDark: {
    backgroundColor: '#2c3e50',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  modalTitleDark: {
    color: '#ecf0f1',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
    color: '#333',
  },
  filterLabelDark: {
    color: '#ecf0f1',
  },
  picker: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  pickerDark: {
    backgroundColor: '#34495e',
    color: '#ecf0f1',
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
  dateButtonDark: {
    backgroundColor: '#34495e',
  },
  dateButtonText: {
    textAlign: 'center',
    color: '#1976D2',
    fontWeight: '600',
  },
  dateButtonTextDark: {
    color: '#3498db',
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
  modalButtonDark: {
    backgroundColor: '#3498db',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  cancelButtonDark: {
    backgroundColor: '#7f8c8d',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});

export default CollectorStatisticsScreen;
