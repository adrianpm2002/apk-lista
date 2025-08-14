import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import useStatistics from '../hooks/useStatistics';
import StatisticsChart from '../components/StatisticsChart';
import DataTable from '../components/DataTable';
import DateTimePickerWrapper from '../components/DateTimePickerWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';

const { width: screenWidth } = Dimensions.get('window');

const StatisticsScreen = ({ navigation, isDarkMode = false, onToggleDarkMode, onModeVisibilityChange }) => {
  // Estados para filtros
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('start');
  
  // Estados para modales
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Estados para datos
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('charts');

  // Estados para sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Hook de estadísticas
  const {
    kpiData,
    chartData,
    tableData,
    lotteries,
    schedules,
    loading,
    error,
    loadAllStats,
    applyFilters,
    exportToCSV,
    clearData,
  } = useStatistics();

  // Opciones de períodos
  const periodOptions = [
    { label: 'Hoy', value: 'today' },
    { label: 'Ayer', value: 'yesterday' },
    { label: 'Esta semana', value: 'week' },
    { label: 'Este mes', value: 'month' },
    { label: 'Mes pasado', value: 'lastMonth' },
    { label: 'Últimos 7 días', value: 'last7days' },
    { label: 'Últimos 30 días', value: 'last30days' },
    { label: 'Personalizado', value: 'custom' },
  ];

  // Tabs de navegación
  const tabs = [
    { id: 'charts', title: 'Gráficos', icon: '📈' },
    { id: 'details', title: 'Detalles', icon: '📋' },
  ];

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Obtener rol del usuario para la sidebar
  useEffect(() => {
    const fetchUserRole = async () => {
      const { supabase } = await import('../supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (data) {
          setUserRole(data.role);
        }
      }
    };

    fetchUserRole();
  }, []);

  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      applyPeriodFilter(selectedPeriod);
    }
  }, [selectedPeriod, selectedLottery, selectedSchedule]);

  const loadInitialData = async () => {
    try {
      await loadAllStats();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las estadísticas iniciales');
    }
  };

  // Aplicar filtro de período
  const applyPeriodFilter = (period) => {
    const now = new Date();
    let start, end;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'week':
        const startOfWeek = now.getDate() - now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), startOfWeek);
        end = new Date();
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last7days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        end = new Date();
        break;
      case 'last30days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        end = new Date();
        break;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
    
    applyFilters({
      startDate: start,
      endDate: end,
      lotteryId: selectedLottery === 'all' ? null : selectedLottery,
      scheduleId: selectedSchedule === 'all' ? null : selectedSchedule,
    });
  };

  // Aplicar filtros personalizados
  const applyCustomFilters = () => {
    applyFilters({
      startDate,
      endDate,
      lotteryId: selectedLottery === 'all' ? null : selectedLottery,
      scheduleId: selectedSchedule === 'all' ? null : selectedSchedule,
    });
    setShowFiltersModal(false);
  };

  // Manejar refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllStats();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron actualizar las estadísticas');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Manejar exportación
  const handleExport = async (format) => {
    try {
      setShowExportModal(false);
      const success = await exportToCSV(format);
      if (success) {
        Alert.alert('Éxito', 'Datos exportados correctamente');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron exportar los datos');
    }
  };

  // Manejar selección de fecha
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

  // Renderizar header con filtros y sidebar toggle
  const renderHeader = () => (
    <View style={[styles.header, isDarkMode && styles.headerDark]}>
      <SideBarToggle onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
      
      <View style={styles.headerControls}>
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Estadísticas
        </Text>
        
        <TouchableOpacity
          style={[styles.filterButton, isDarkMode && styles.filterButtonDark]}
          onPress={() => setShowFiltersModal(true)}
        >
          <Text style={[styles.filterButtonText, isDarkMode && styles.filterButtonTextDark]}>
            🔍 Filtros
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.exportButton, isDarkMode && styles.exportButtonDark]}
          onPress={() => setShowExportModal(true)}
        >
          <Text style={styles.exportButtonText}>📤 Exportar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizar tabs de navegación
  const renderTabs = () => (
    <View style={[styles.tabsContainer, isDarkMode && styles.tabsContainerDark]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab,
              activeTab === tab.id && isDarkMode && styles.activeTabDark,
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText,
              isDarkMode && styles.tabTextDark,
            ]}>
              {tab.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Renderizar contenido del tab de resumen

  // Renderizar contenido del tab de gráficos
  const renderChartsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Gráfico de barras por lotería */}
      {chartData.byLottery && chartData.byLottery.length > 0 && (
        <StatisticsChart
          type="bar"
          data={chartData.byLottery}
          title="Apuestas por Lotería"
          isDarkMode={isDarkMode}
        />
      )}

      {/* Gráfico circular de distribución */}
      {chartData.distribution && chartData.distribution.length > 0 && (
        <StatisticsChart
          type="pie"
          data={chartData.distribution}
          title="Distribución de Ganancias"
          isDarkMode={isDarkMode}
        />
      )}

      {/* Gráfico de comisiones */}
      {chartData.commissions && chartData.commissions.length > 0 && (
        <StatisticsChart
          type="line"
          data={chartData.commissions}
          title="Comisiones Generadas"
          isDarkMode={isDarkMode}
        />
      )}
    </ScrollView>
  );

  // Renderizar contenido del tab de detalles
  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Tabla de jugadas detalladas */}
      {tableData.plays && tableData.plays.length > 0 && (
        <DataTable
          title="Jugadas Detalladas"
          data={tableData.plays}
          columns={[
            { key: 'date', title: 'Fecha', type: 'date', flex: 1 },
            { key: 'lottery_name', title: 'Lotería', flex: 1.2 },
            { key: 'schedule_name', title: 'Horario', flex: 1 },
            { key: 'numbers', title: 'Números', flex: 1.5 },
            { key: 'amount', title: 'Monto', type: 'currency', flex: 1 },
            { key: 'commission', title: 'Comisión', type: 'currency', flex: 1 },
          ]}
          isDarkMode={isDarkMode}
          maxHeight={400}
        />
      )}

      {/* Tabla de resumen por horario */}
      {tableData.bySchedule && tableData.bySchedule.length > 0 && (
        <DataTable
          title="Resumen por Horario"
          data={tableData.bySchedule}
          columns={[
            { key: 'schedule_name', title: 'Horario', flex: 1.5 },
            { key: 'total_plays', title: 'Jugadas', type: 'number', flex: 1 },
            { key: 'total_amount', title: 'Monto', type: 'currency', flex: 1.2 },
            { key: 'total_commission', title: 'Comisión', type: 'currency', flex: 1.2 },
            { key: 'net_profit', title: 'Ganancia', type: 'currency', flex: 1.2 },
          ]}
          isDarkMode={isDarkMode}
        />
      )}
    </ScrollView>
  );

  // Renderizar contenido del tab de reportes

  // Renderizar modal de filtros
  const renderFiltersModal = () => (
    <Modal
      visible={showFiltersModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFiltersModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
          <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
            🔍 Filtros de Estadísticas
          </Text>

          {/* Selector de período */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
              Período:
            </Text>
            <View style={[styles.pickerContainer, isDarkMode && styles.pickerContainerDark]}>
              <Picker
                selectedValue={selectedPeriod}
                onValueChange={setSelectedPeriod}
                style={[styles.picker, isDarkMode && styles.pickerDark]}
              >
                {periodOptions.map(option => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Selectores de fecha para período personalizado */}
          {selectedPeriod === 'custom' && (
            <View style={styles.dateSection}>
              <TouchableOpacity
                style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
                onPress={() => {
                  setDatePickerType('start');
                  setShowDatePicker(true);
                }}
              >
                <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                  Desde: {startDate.toLocaleDateString()}
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
                  Hasta: {endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Selector de lotería */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
              Lotería:
            </Text>
            <View style={[styles.pickerContainer, isDarkMode && styles.pickerContainerDark]}>
              <Picker
                selectedValue={selectedLottery}
                onValueChange={setSelectedLottery}
                style={[styles.picker, isDarkMode && styles.pickerDark]}
              >
                <Picker.Item label="Todas las loterías" value="all" />
                {lotteries.map(lottery => (
                  <Picker.Item
                    key={lottery.id}
                    label={lottery.name}
                    value={lottery.id.toString()}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Selector de horario */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>
              Horario:
            </Text>
            <View style={[styles.pickerContainer, isDarkMode && styles.pickerContainerDark]}>
              <Picker
                selectedValue={selectedSchedule}
                onValueChange={setSelectedSchedule}
                style={[styles.picker, isDarkMode && styles.pickerDark]}
              >
                <Picker.Item label="Todos los horarios" value="all" />
                {schedules.map(schedule => (
                  <Picker.Item
                    key={schedule.id}
                    label={schedule.name}
                    value={schedule.id.toString()}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Botones de acción */}
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
              onPress={() => setShowFiltersModal(false)}
            >
              <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>
                Cancelar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={applyCustomFilters}
            >
              <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Renderizar modal de exportación
  const renderExportModal = () => (
    <Modal
      visible={showExportModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowExportModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.exportModalContent, isDarkMode && styles.modalContentDark]}>
          <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
            📤 Exportar Datos
          </Text>

          <TouchableOpacity
            style={styles.exportOption}
            onPress={() => handleExport('csv')}
          >
            <Text style={[styles.exportOptionText, isDarkMode && styles.exportOptionTextDark]}>
              📄 Exportar a CSV
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportOption}
            onPress={() => handleExport('excel')}
          >
            <Text style={[styles.exportOptionText, isDarkMode && styles.exportOptionTextDark]}>
              📊 Exportar a Excel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
            onPress={() => setShowExportModal(false)}
          >
            <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Renderizar contenido según el tab activo
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'charts':
        return renderChartsTab();
      case 'details':
        return renderDetailsTab();
      default:
        return renderChartsTab();
    }
  };

  if (error) {
    return (
      <View style={[styles.errorContainer, isDarkMode && styles.errorContainerDark]}>
        <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>
          ❌ Error al cargar estadísticas
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
          <Text style={styles.retryButtonText}>🔄 Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {renderHeader()}
      {renderTabs()}
      
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        {renderActiveTabContent()}
      </ScrollView>

      {/* Modales */}
      {renderFiltersModal()}
      {renderExportModal()}

      {/* DatePicker */}
      {showDatePicker && (
        <DateTimePickerWrapper
          value={datePickerType === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
  headerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginRight: 16,
  },
  headerTitleDark: {
    color: '#ecf0f1',
  },
  sidebarButton: {
    // Sin margen para que esté pegado al borde izquierdo
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  filterButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  filterButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  filterButtonText: {
    color: '#495057',
    fontWeight: '500',
  },
  filterButtonTextDark: {
    color: '#ecf0f1',
  },
  exportButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonDark: {
    backgroundColor: '#229954',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginTop: 100,
  },
  tabsContainerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#27AE60',
  },
  activeTabDark: {
    borderBottomColor: '#2ecc71',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  tabTextDark: {
    color: '#adb5bd',
  },
  activeTabText: {
    color: '#27AE60',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitleDark: {
    color: '#ecf0f1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    minWidth: screenWidth - 40,
  },
  modalContentDark: {
    backgroundColor: '#2c3e50',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalTitleDark: {
    color: '#ecf0f1',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 8,
  },
  filterLabelDark: {
    color: '#ecf0f1',
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  pickerContainerDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  picker: {
    height: 50,
  },
  pickerDark: {
    color: '#ecf0f1',
  },
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginHorizontal: 4,
  },
  dateButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  dateButtonText: {
    color: '#495057',
    textAlign: 'center',
  },
  dateButtonTextDark: {
    color: '#ecf0f1',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  cancelButtonText: {
    color: '#6c757d',
    textAlign: 'center',
    fontWeight: '500',
  },
  cancelButtonTextDark: {
    color: '#adb5bd',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#27AE60',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  applyButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  exportModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 250,
  },
  exportOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  exportOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  exportOptionTextDark: {
    color: '#ecf0f1',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorTextDark: {
    color: '#e74c3c',
  },
  retryButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default StatisticsScreen;
