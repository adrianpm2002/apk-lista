import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  trendValue, 
  color = '#27AE60', 
  isDarkMode = false 
}) => {
  // Formatear valores monetarios
  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return '$0.00';
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Formatear números enteros
  const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('en-US');
  };

  // Formatear porcentajes
  const formatPercentage = (percent) => {
    if (typeof percent !== 'number') return '0%';
    return `${percent.toFixed(1)}%`;
  };

  // Determinar formato basado en el valor
  const getFormattedValue = () => {
    if (typeof value === 'string') return value;
    
    // Si contiene símbolo de moneda o es un monto
    if (title.toLowerCase().includes('total') || 
        title.toLowerCase().includes('ganancia') || 
        title.toLowerCase().includes('comision') ||
        title.toLowerCase().includes('premio')) {
      return formatCurrency(value);
    }
    
    // Si es porcentaje
    if (title.toLowerCase().includes('margen') || 
        title.toLowerCase().includes('porcentaje') ||
        title.toLowerCase().includes('%')) {
      return formatPercentage(value);
    }
    
    // Números enteros (conteos)
    return formatNumber(value);
  };

  // Obtener color de tendencia
  const getTrendColor = () => {
    if (!trend || !trendValue) return '#95a5a6';
    
    // Para métricas donde más alto es mejor (ingresos, ganancia)
    const positiveMetrics = ['total', 'ganancia', 'ingreso', 'margen'];
    const isPositiveMetric = positiveMetrics.some(metric => 
      title.toLowerCase().includes(metric)
    );
    
    if (isPositiveMetric) {
      return trend === 'up' ? '#27ae60' : trend === 'down' ? '#e74c3c' : '#95a5a6';
    } else {
      // Para métricas donde más bajo es mejor (premios, comisiones)
      return trend === 'up' ? '#e74c3c' : trend === 'down' ? '#27ae60' : '#95a5a6';
    }
  };

  // Obtener icono de tendencia
  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
      default: return '';
    }
  };

  return (
    <View style={[
      styles.container, 
      isDarkMode && styles.containerDark,
      { borderLeftColor: color }
    ]}>
      {/* Header con icono y título */}
      <View style={styles.header}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
        )}
        <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={2}>
          {title}
        </Text>
      </View>

      {/* Valor principal */}
      <View style={styles.valueContainer}>
        <Text style={[styles.value, isDarkMode && styles.valueDark, { color: color }]}>
          {getFormattedValue()}
        </Text>
      </View>

      {/* Información adicional */}
      <View style={styles.footer}>
        {subtitle && (
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
            {subtitle}
          </Text>
        )}
        
        {trend && trendValue !== undefined && (
          <View style={styles.trendContainer}>
            <Text style={[styles.trendIcon, { color: getTrendColor() }]}>
              {getTrendIcon()}
            </Text>
            <Text style={[styles.trendValue, { color: getTrendColor() }]}>
              {Math.abs(trendValue).toFixed(1)}%
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
    margin: 6,
    flex: 1,
    minWidth: 150,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerDark: {
    backgroundColor: '#34495e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    lineHeight: 18,
  },
  titleDark: {
    color: '#ecf0f1',
  },
  valueContainer: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#27AE60',
    letterSpacing: -0.5,
  },
  valueDark: {
    // Color se establece dinámicamente
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    flex: 1,
    fontSize: 12,
    color: '#7f8c8d',
    marginRight: 8,
  },
  subtitleDark: {
    color: '#bdc3c7',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendIcon: {
    fontSize: 14,
    marginRight: 4,
    fontWeight: 'bold',
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default KPICard;
