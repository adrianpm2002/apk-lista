import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart, StackedBarChart } from 'react-native-chart-kit';
import Svg, { Line as SvgLine, Rect as SvgRect, Text as SvgText } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

const StatisticsChart = ({
  type = 'line',
  data,
  title,
  isDarkMode = false,
  height = 220,
  showGrid = true,
  showLabels = true,
  animated = true,
  // datasetsOverride: sólo para type='line' o 'bar'. Ej: [{ key:'collected', label:'Recogido', color:'rgba(39,174,96,1)' }, { key:'paid', label:'Pagado', color:'rgba(231,76,60,1)' }]
  datasetsOverride,
  // labelKey para eje X cuando no sea date. Por defecto usa item.label o formatea item.date
  labelKey,
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
      case 'stacked':
        return formatStackedData();
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
      case 'stacked':
        return {
          labels: ['Sin datos'],
          legend: ['Ganancia','Pérdida'],
          data: [[0,0]],
          barColors: ['#27AE60','#E74C3C']
        };
      default:
        return null;
    }
  };

  // Formatear datos para gráfico de líneas
  const formatLineData = () => {
    const labels = data.map(item => {
      if (item.date && !labelKey) {
        const date = new Date(item.date);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      }
      return (labelKey ? item[labelKey] : (item.label || '')) || '';
    }).slice(-10);

    let datasets = [];

    if (Array.isArray(datasetsOverride) && datasetsOverride.length) {
      datasets = datasetsOverride.map((ds) => ({
        data: data.map(item => parseFloat(item[ds.key]) || 0).slice(-10),
        color: (opacity = 1) => {
          if (ds.color) {
            try { return ds.color.replace(/,\s*1\)/, `,${opacity})`); } catch { return `rgba(39, 174, 96, ${opacity})`; }
          }
          return `rgba(39, 174, 96, ${opacity})`;
        },
        strokeWidth: 3,
      }));
    } else {
      if (data[0]?.total_bets !== undefined) {
        datasets.push({
          data: data.map(item => parseFloat(item.total_bets) || 0).slice(-10),
          color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
          strokeWidth: 3,
        });
      }
      if (data[0]?.net_profit !== undefined) {
        datasets.push({
          data: data.map(item => parseFloat(item.net_profit) || 0).slice(-10),
          color: (opacity = 1) => `rgba(52, 152, 219, ${opacity})`,
          strokeWidth: 3,
        });
      }
    }

    return {
      labels,
      datasets: datasets.length > 0 ? datasets : [{
        data: [0],
        color: (opacity = 1) => `rgba(149, 165, 166, ${opacity})`,
        strokeWidth: 2,
      }],
    };
  };

  // Formatear datos para gráfico de barras
  const formatBarData = () => {
    const labels = data.map(item => 
      item.name || item.lottery_name || item.schedule_name || item.label || ''
    ).slice(0, 8);

    let values;
    if (Array.isArray(datasetsOverride) && datasetsOverride.length) {
      const key = datasetsOverride[0].key;
      values = data.map(item => parseFloat(item[key]) || 0).slice(0, 8);
    } else {
      values = data.map(item => 
        parseFloat(item.total_bets) || 
        parseFloat(item.total_volume) || 
        parseFloat(item.value) || 0
      ).slice(0, 8);
    }

    return {
      labels,
      datasets: [{
        data: values,
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

  // Formatear datos para gráfico stacked (ganancia vs pérdida por día)
  const formatStackedData = () => {
    // data: [{ date:'YYYY-MM-DD', profit: number }]
    const labels = data.map(item => {
      const date = new Date(item.date || item.day || item.label);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });
    const profits = data.map(item => Number(item.profit || 0));
    const gains = profits.map(v => (v > 0 ? v : 0));
    const losses = profits.map(v => (v < 0 ? Math.abs(v) : 0));
    return {
      labels,
      legend: ['Ganancia', 'Pérdida'],
      data: gains.map((g, i) => [g, losses[i]]),
      barColors: ['#27AE60', '#E74C3C'],
    };
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
      case 'stacked':
        return (
          <StackedBarChart
            data={formattedData}
            width={chartWidth}
            height={height}
            chartConfig={barChartConfig}
            style={styles.chart}
            hideLegend={false}
          />
        );
      case 'profitLoss': {
        // Espera data: [{ date:'YYYY-MM-DD', profit:number }]
        const margin = { top: 16, right: 12, bottom: 26, left: 12 };
        const w = chartWidth;
        const h = height;
        const innerW = w - margin.left - margin.right;
        const innerH = h - margin.top - margin.bottom;
        const profits = (data || []).map(d => Number(d.profit || 0));
        const maxAbs = Math.max(1, ...profits.map(v => Math.abs(v)));
        const half = innerH / 2;
        const yZero = margin.top + half; // línea base
        const n = Math.max(1, data?.length || 1);
        const gap = 6; // separación entre barras
        const barW = Math.max(4, Math.floor((innerW - gap * (n - 1)) / n));
        const labels = (data || []).map(d => {
          if (d && typeof d.label === 'string' && d.label.length) return d.label;
          const dt = new Date(d?.date || d?.day || Date.now());
          if (isNaN(dt.getTime())) return '';
          return `${dt.getDate()}/${dt.getMonth() + 1}`;
        });
        const labelStep = Math.max(1, Math.ceil(n / 7)); // ~7 etiquetas visibles
        const fmtAmount = (v) => {
          const num = Math.round(Number(v) || 0);
          try { return num.toLocaleString('es-DO'); } catch { return String(num); }
        };
        return (
          <Svg width={w} height={h} style={styles.chart}>
            {/* Línea base */}
            <SvgLine x1={margin.left} y1={yZero} x2={w - margin.right} y2={yZero} stroke={isDarkMode ? '#95A5A6' : '#7F8C8D'} strokeWidth={1} />
            {/* Barras */}
            {profits.map((v, i) => {
              const x = margin.left + i * (barW + gap);
              const heightPx = Math.min(half, Math.abs(v) * (half / maxAbs));
              const color = v >= 0 ? '#27AE60' : '#E74C3C';
              const y = v >= 0 ? (yZero - heightPx) : yZero;
              const rectH = Math.max(2, heightPx);
              const cx = x + barW / 2;
              // Posicionar etiqueta: encima de barras verdes y debajo de barras rojas
              const labelYOffset = 4;
              const labelY = v >= 0
                ? Math.max(10, y - labelYOffset) // encima de la barra
                : Math.min(h - margin.bottom - 2, y + rectH + 12); // debajo de la barra
              return (
                <React.Fragment key={`grp-${i}`}>
                  <SvgRect x={x} y={y} width={barW} height={rectH} fill={color} rx={3} />
                  {/* Etiqueta de monto */}
                  <SvgText x={cx} y={labelY} fontSize={10} fontWeight="bold" fill={isDarkMode ? '#ECF0F1' : '#2C3E50'} textAnchor="middle">
                    {`${v >= 0 ? '' : '-'}$${fmtAmount(Math.abs(v))}`}
                  </SvgText>
                </React.Fragment>
              );
            })}
            {/* Etiquetas (dinámicas para no saturar) */}
            {labels.map((lb, i) => {
              if (!lb || i % labelStep !== 0) return null;
              const x = margin.left + i * (barW + gap) + barW / 2;
              return (
                <SvgText key={`lb-${i}`} x={x} y={h - 6} fontSize={10} fill={isDarkMode ? '#ECF0F1' : '#2C3E50'} textAnchor="middle">
                  {lb}
                </SvgText>
              );
            })}
          </Svg>
        );
      }

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
