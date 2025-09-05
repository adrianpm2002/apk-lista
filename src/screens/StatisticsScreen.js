import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import TopBar from '../components/TopBar';
import KPICard from '../components/KPICard';
import DataTable from '../components/DataTable';
import StatisticsChart from '../components/StatisticsChart';
import useStatisticsClean from '../hooks/useStatisticsClean';

const StatisticsScreen = ({ navigation }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  
  const { 
    data,
    loading, 
    error, 
    refresh 
  } = useStatisticsClean(selectedPeriod);

  return (
    <View style={styles.container}>
      <TopBar 
        title="📊 Estadísticas" 
        showMenuButton={true}
        navigation={navigation}
      />
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingSection}>
            <Text style={styles.loadingText}>📊 Cargando estadísticas...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorSection}>
            <Text style={styles.errorText}>❌ Error: {error}</Text>
          </View>
        ) : (
          <>
            {/* Filtros de período */}
            <View style={styles.filterContainer}>
              <TouchableOpacity 
                style={[styles.filterButton, selectedPeriod === 'today' && styles.filterButtonActive]}
                onPress={() => setSelectedPeriod('today')}
              >
                <Text style={[styles.filterText, selectedPeriod === 'today' && styles.filterTextActive]}>
                  Hoy
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterButton, selectedPeriod === 'week' && styles.filterButtonActive]}
                onPress={() => setSelectedPeriod('week')}
              >
                <Text style={[styles.filterText, selectedPeriod === 'week' && styles.filterTextActive]}>
                  7 días
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterButton, selectedPeriod === 'month' && styles.filterButtonActive]}
                onPress={() => setSelectedPeriod('month')}
              >
                <Text style={[styles.filterText, selectedPeriod === 'month' && styles.filterTextActive]}>
                  30 días
                </Text>
              </TouchableOpacity>
            </View>

            {/* KPI Cards */}
            <View style={styles.kpiContainer}>
              <KPICard
                title="Total Jugadas"
                value={data?.dailyStats?.totalPlays || 0}
                icon="🎯"
                format="number"
                backgroundColor="#e3f2fd"
                textColor="#1976d2"
              />
              <KPICard
                title="Total Ventas"
                value={data?.dailyStats?.totalBets || 0}
                icon="💰"
                format="currency"
                backgroundColor="#e8f5e8"
                textColor="#388e3c"
              />
            </View>
            
            <View style={styles.kpiContainer}>
              <KPICard
                title="Promedio por Jugada"
                value={data?.dailyStats?.avgBetAmount || 0}
                icon="📊"
                format="currency"
                backgroundColor="#fff3e0"
                textColor="#f57c00"
              />
              <KPICard
                title="Total Premios"
                value={data?.dailyStats?.totalPrizes || 0}
                icon="🏆"
                format="currency"
                backgroundColor="#fce4ec"
                textColor="#c2185b"
              />
            </View>
            
            {/* Gráfico de estadísticas */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📊 Ganancias y Pérdidas Diarias</Text>
            </View>
            
            <StatisticsChart
              data={data?.profitLossData || []}
              type="profit-loss"
              title="Ganancias/Pérdidas por Día"
              height={300}
            />
            
            {/* Título de sección */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📈 Resumen por Lotería</Text>
            </View>
            
            {/* Tabla de datos */}
            <DataTable
              data={data?.tableData || []}
              columns={[
                { key: 'lottery', title: 'Lotería', width: '30%' },
                { key: 'plays', title: 'Jugadas', width: '20%' },
                { key: 'amount', title: 'Monto', width: '25%', format: 'currency' },
                { key: 'profit', title: 'Ganancia', width: '25%', format: 'currency' },
              ]}
              maxHeight={300}
            />
            
            {/* Resumen adicional */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>💼 Resumen Financiero</Text>
            </View>
            
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Apostado:</Text>
                <Text style={styles.summaryValue}>
                  ${(data?.dailyStats?.totalBets || 0).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Premios:</Text>
                <Text style={styles.summaryValue}>
                  ${(data?.dailyStats?.totalPrizes || 0).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Comisiones:</Text>
                <Text style={styles.summaryValue}>
                  ${(data?.dailyStats?.totalCommissions || 0).toLocaleString()}
                </Text>
              </View>
              
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Ganancia Neta:</Text>
                <Text style={[
                  styles.summaryValueTotal,
                  { color: (data?.dailyStats?.netProfit || 0) >= 0 ? '#4CAF50' : '#F44336' }
                ]}>
                  ${(data?.dailyStats?.netProfit || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </>
        )}
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
  },
  contentContainer: {
    padding: 20,
    paddingTop: 70,
  },
  kpiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  loadingSection: {
    backgroundColor: '#ffffff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingText: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: '500',
  },
  errorSection: {
    backgroundColor: '#f8d7da',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorText: {
    fontSize: 16,
    color: '#721c24',
    textAlign: 'center',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007bff',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  summaryContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#007bff',
    paddingTop: 12,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#495057',
    fontWeight: '500',
  },
  summaryLabelTotal: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '600',
  },
  summaryValueTotal: {
    fontSize: 18,
    fontWeight: '700',
  },
});

export default StatisticsScreen;
