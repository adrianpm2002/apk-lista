import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

const { width: screenWidth } = Dimensions.get('window');

const StatisticsChart = ({
  type = 'line',
  data,
  title,
  isDarkMode = false,
  height = 220,
  showGrid = true,
  showLabels = true,
  animated = true
}) => {
  // Configuración de colores para gráficos
  const chartConfig = {
    backgroundColor: isDarkMode ? '#2c3e50' : '#ffffff',
    backgroundGradientFrom: isDarkMode ? '#2c3e50' : '#ffffff',
    backgroundGradientTo: isDarkMode ? '#34495e' : '#f8f9fa',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
    labelColor: (opacity = 1) => isDarkMode ? `rgba(236, 240, 241, ${opacity})` : `rgba(44, 62, 80, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#27AE60',
    },
    propsForBackgroundLines: {
      strokeDasharray: showGrid ? '5,5' : '0,0',
      stroke: isDarkMode ? '#34495e' : '#ecf0f1',
      strokeWidth: 1,
    },
    propsForLabels: {
      fontSize: 12,
      fontWeight: '500',
    },
  };

  // Configuración específica para gráficos de línea
  const lineChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
    strokeWidth: 3,
    useShadowColorFromDataset: false,
  };

  // Configuración específica para gráficos de barras
  const barChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
    barPercentage: 0.7,
    categoryPercentage: 0.8,
  };

  // Configuración específica para gráficos circulares
  const pieChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(155, 89, 182, ${opacity})`,
  };

  // Colores para gráfico circular
  const pieColors = [
    '#27AE60', // Verde principal
    '#3498db', // Azul
    '#f39c12', // Naranja
    '#e74c3c', // Rojo
    '#9b59b6', // Morado
    '#1abc9c', // Turquesa
    '#34495e', // Gris oscuro
    '#e67e22', // Naranja oscuro
  ];

  // Formatear datos según el tipo de gráfico
  const getFormattedData = () => {
    if (!data || !data.length) {
      return getEmptyData();
    }

    switch (type) {
      case 'line':
        return formatLineData();
      case 'bar':
        return formatBarData();
      case 'pie':
        return formatPieData();
      default:
        return getEmptyData();
    }
  };

  // Datos vacíos para mostrar cuando no hay información
  const getEmptyData = () => {
    switch (type) {
      case 'line':
        return {
          labels: ['Sin datos'],
          datasets: [{
            data: [0],
            color: (opacity = 1) => `rgba(149, 165, 166, ${opacity})`,
            strokeWidth: 2,
          }]
        };
      case 'bar':
        return {
          labels: ['Sin datos'],
          datasets: [{
            data: [0],
            color: (opacity = 1) => `rgba(149, 165, 166, ${opacity})`,
          }]
        };
      case 'pie':
        return [
          {
            name: 'Sin datos',
            population: 1,
            color: '#95a5a6',
            legendFontColor: isDarkMode ? '#ecf0f1' : '#2c3e50',
            legendFontSize: 12,
          }
        ];
      default:
        return null;
    }
  };

  // Formatear datos para gráfico de líneas
  const formatLineData = () => {
    const labels = data.map(item => {
      if (item.date) {
        const date = new Date(item.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }
      return item.label || '';
    }).slice(-10); // Últimos 10 puntos para mejor visualización

    const datasets = [];

    // Dataset principal (ingresos/apuestas)
    if (data[0]?.total_bets !== undefined) {
      datasets.push({
        data: data.map(item => parseFloat(item.total_bets) || 0).slice(-10),
        color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
        strokeWidth: 3,
      });
    }

    // Dataset secundario (ganancias)
    if (data[0]?.net_profit !== undefined) {
      datasets.push({
        data: data.map(item => parseFloat(item.net_profit) || 0).slice(-10),
        color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
        strokeWidth: 3,
      });
    }

    return {
      labels,
      datasets: datasets.length > 0 ? datasets : [{
        data: [0],
        color: (opacity = 1) => `rgba(149, 165, 166, ${opacity})`,
        strokeWidth: 2,
      }],
      legend: datasets.length > 1 ? ['Apuestas', 'Ganancias'] : undefined,
    };
  };

  // Formatear datos para gráfico de barras
  const formatBarData = () => {
    const labels = data.map(item => 
      item.name || item.lottery_name || item.schedule_name || item.label || ''
    ).slice(0, 8); // Máximo 8 barras para mejor visualización

    return {
      labels,
      datasets: [{
        data: data.map(item => 
          parseFloat(item.total_bets) || 
          parseFloat(item.total_volume) || 
          parseFloat(item.value) || 0
        ).slice(0, 8),
        color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
      }]
    };
  };

  // Formatear datos para gráfico circular
  const formatPieData = () => {
    return data.map((item, index) => ({
      name: item.name || item.lottery_name || item.schedule_name || `Item ${index + 1}`,
      population: parseFloat(item.total_bets) || parseFloat(item.value) || 0,
      color: pieColors[index % pieColors.length],
      legendFontColor: isDarkMode ? '#ecf0f1' : '#2c3e50',
      legendFontSize: 12,
    })).slice(0, 6); // Máximo 6 segmentos para mejor visualización
  };

  // Renderizar el gráfico según el tipo
  const renderChart = () => {
    const formattedData = getFormattedData();
    const chartWidth = screenWidth - 40; // 20px margin en cada lado

    switch (type) {
      case 'line':
        return (
          <LineChart
            data={formattedData}
            width={chartWidth}
            height={height}
            chartConfig={lineChartConfig}
            bezier={animated}
            style={styles.chart}
            withDots={true}
            withShadow={false}
            withScrollableDot={false}
            withInnerLines={showGrid}
            withOuterLines={showLabels}
            withHorizontalLabels={showLabels}
            withVerticalLabels={showLabels}
            fromZero={true}
          />
        );

      case 'bar':
        return (
          <BarChart
            data={formattedData}
            width={chartWidth}
            height={height}
            chartConfig={barChartConfig}
            style={styles.chart}
            withInnerLines={showGrid}
            withHorizontalLabels={showLabels}
            withVerticalLabels={showLabels}
            fromZero={true}
            showBarTops={false}
            flatColor={true}
          />
        );

      case 'pie':
        return (
          <PieChart
            data={formattedData}
            width={chartWidth}
            height={height}
            chartConfig={pieChartConfig}
            style={styles.chart}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            center={[10, 10]}
            absolute={false}
            hasLegend={true}
          />
        );

      default:
        return (
          <View style={[styles.noDataContainer, { height }]}>
            <Text style={[styles.noDataText, isDarkMode && styles.noDataTextDark]}>
              Tipo de gráfico no soportado
            </Text>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {title && (
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>
          {title}
        </Text>
      )}
      
      <View style={styles.chartContainer}>
        {data && data.length > 0 ? (
          renderChart()
        ) : (
          <View style={[styles.noDataContainer, { height }]}>
            <Text style={[styles.noDataText, isDarkMode && styles.noDataTextDark]}>
              📊 No hay datos disponibles
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerDark: {
    backgroundColor: '#34495e',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  titleDark: {
    color: '#ecf0f1',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  noDataContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#dee2e6',
  },
  noDataText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  noDataTextDark: {
    color: '#adb5bd',
  },
});

export default StatisticsChart;
