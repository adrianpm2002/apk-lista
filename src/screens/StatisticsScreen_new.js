import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SideBar } from '../components/SideBar';
import { TopBar } from '../components/TopBar';
import { KPICard } from '../components/KPICard';
import { StatisticsChart } from '../components/StatisticsChart';
import { DataTable } from '../components/DataTable';
import useStatisticsClean from '../hooks/useStatisticsClean';

const { width: screenWidth } = Dimensions.get('window');

/**
 * NUEVA PANTALLA DE ESTADÍSTICAS - LIMPIA Y SIMPLE
 * ================================================
 * - Diseño moderno y minimalista
 * - Datos reales de la base de datos
 * - Fallback a datos de ejemplo si no hay datos reales
 * - Carga rápida y eficiente
 * - Interfaz responsive
 */
const StatisticsScreen = () => {
  // Estados de UI
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('today'); // 'today', 'week', 'month'

  // Hook para datos de estadísticas
  const { loading, error, data, refresh } = useStatisticsClean(selectedPeriod);
  const { dailyStats, chartData, tableData } = data;

  // Función de actualización
  const onRefresh = () => {
    refresh();
  };

  // Renderizar KPIs principales
  const renderKPIs = () => (
    <View style={styles.kpiContainer}>
      <View style={styles.kpiRow}>
        <KPICard
          title="Apostado"
          value={dailyStats?.totalBets || 0}
          format="currency"
          color="#27AE60"
          icon="💰"
          style={styles.kpiCard}
        />
        <KPICard
          title="Premios"
          value={dailyStats?.totalPrizes || 0}
          format="currency"
          color="#E74C3C"
          icon="🏆"
          style={styles.kpiCard}
        />
      </View>
      <View style={styles.kpiRow}>
        <KPICard
          title="Comisiones"
          value={dailyStats?.totalCommissions || 0}
          format="currency"
          color="#3498DB"
          icon="💼"
          style={styles.kpiCard}
        />
        <KPICard
          title="Ganancia"
          value={dailyStats?.netProfit || 0}
          format="currency"
          color="#9B59B6"
          icon="📈"
          style={styles.kpiCard}
        />
      </View>
      <View style={styles.kpiRow}>
        <KPICard
          title="Jugadas"
          value={dailyStats?.totalPlays || 0}
          format="number"
          color="#F39C12"
          icon="🎯"
          style={styles.kpiCard}
        />
        <KPICard
          title="Promedio"
          value={dailyStats?.avgBetAmount || 0}
          format="currency"
          color="#1ABC9C"
          icon="📊"
          style={styles.kpiCard}
        />
      </View>
    </View>
  );

  // Renderizar filtros de período
  const renderPeriodFilters = () => (
    <View style={styles.periodContainer}>
      {[
        { key: 'today', label: 'Hoy', icon: '📅' },
        { key: 'week', label: 'Semana', icon: '📊' },
        { key: 'month', label: 'Mes', icon: '🗓️' }
      ].map((period) => (
        <TouchableOpacity
          key={period.key}
          style={[
            styles.periodButton,
            selectedPeriod === period.key && styles.periodButtonActive
          ]}
          onPress={() => setSelectedPeriod(period.key)}
        >
          <Text style={styles.periodIcon}>{period.icon}</Text>
          <Text style={[
            styles.periodText,
            selectedPeriod === period.key && styles.periodTextActive
          ]}>
            {period.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Renderizar gráfico
  const renderChart = () => (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>📈 Tendencia de 7 días</Text>
      <StatisticsChart 
        data={chartData}
        height={200}
        showLegend={true}
      />
    </View>
  );

  // Renderizar tabla
  const renderTable = () => (
    <View style={styles.tableContainer}>
      <Text style={styles.sectionTitle}>🎲 Por Lotería</Text>
      <DataTable 
        data={tableData}
        columns={[
          { key: 'lottery', title: 'Lotería', width: '30%' },
          { key: 'plays', title: 'Jugadas', width: '15%', align: 'center' },
          { key: 'amount', title: 'Apostado', width: '20%', format: 'currency' },
          { key: 'prizes', title: 'Premios', width: '20%', format: 'currency' },
          { key: 'profit', title: 'Ganancia', width: '15%', format: 'currency' }
        ]}
      />
    </View>
  );

  // Renderizar estado de carga
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#27AE60" />
        <Text style={styles.loadingText}>Cargando estadísticas...</Text>
      </View>
    );
  }

  // Renderizar estado de error
  if (error && !dailyStats) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* TopBar */}
      <TopBar 
        title="Estadísticas"
        onMenuPress={() => setSidebarVisible(true)}
      />

      {/* Sidebar */}
      {sidebarVisible && (
        <SideBar 
          visible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
        />
      )}

      {/* Contenido principal */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        {/* Filtros de período */}
        {renderPeriodFilters()}

        {/* KPIs principales */}
        {renderKPIs()}

        {/* Gráfico de tendencias */}
        {renderChart()}

        {/* Tabla por lotería */}
        {renderTable()}

        {/* Espaciado final */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    marginTop: 70, // Espacio para el TopBar
  },
  
  // Estados de carga y error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
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
    fontSize: 16,
  },

  // Filtros de período
  periodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  periodButton: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    minWidth: 80,
  },
  periodButtonActive: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  periodIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  periodText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // KPIs
  kpiContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    marginHorizontal: 4,
  },

  // Secciones
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  chartContainer: {
    backgroundColor: '#fff',
    marginVertical: 8,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tableContainer: {
    backgroundColor: '#fff',
    marginVertical: 8,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bottomSpacer: {
    height: 20,
  },
});

export default StatisticsScreen;
