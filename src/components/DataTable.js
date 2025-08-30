import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

const DataTable = ({
  data = [],
  columns = [],
  title,
  isDarkMode = false,
  maxHeight = 400,
  sortable = true,
  searchable = false,
  onRowPress,
  loading = false,
  emptyMessage = "No hay datos disponibles",
  showFooter = true,
  formatCurrency = true,
}) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Formatear valores monetarios
  const formatMoney = (value) => {
    if (!formatCurrency || value === null || value === undefined) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Formatear números
  const formatNumber = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return new Intl.NumberFormat('es-DO').format(num);
  };

  // Formatear fechas
  const formatDate = (value) => {
    if (!value) return value;
    try {
      const date = new Date(value);
      return date.toLocaleDateString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch (error) {
      return value;
    }
  };

  // Formatear valores según el tipo de columna
  const formatValue = (value, column) => {
    if (value === null || value === undefined) return '-';

    switch (column.type) {
      case 'currency':
        return formatMoney(value);
      case 'number':
        return formatNumber(value);
      case 'percentage':
        return `${parseFloat(value).toFixed(2)}%`;
      case 'date':
        return formatDate(value);
      case 'boolean':
        return value ? '✅' : '❌';
      default:
        return value;
    }
  };

  // Obtener valor para ordenamiento
  const getSortValue = (item, key) => {
    const value = item[key];
    if (value === null || value === undefined) return '';
    
    // Para números y monedas, convertir a número
    if (typeof value === 'string' && !isNaN(parseFloat(value))) {
      return parseFloat(value);
    }
    
    // Para fechas, convertir a timestamp
    if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      return new Date(value).getTime();
    }
    
    return value.toString().toLowerCase();
  };

  // Datos ordenados
  const sortedData = useMemo(() => {
    if (!sortConfig.key || !data.length) return data;

    return [...data].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  // Manejar clic en header para ordenar
  const handleSort = (key) => {
    if (!sortable) return;

    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Calcular totales para el footer
  const calculateTotals = () => {
    if (!showFooter || !data.length) return {};

    const totals = {};
    columns.forEach(column => {
      if (column.type === 'currency' || column.type === 'number') {
        const sum = data.reduce((acc, item) => {
          const value = parseFloat(item[column.key]) || 0;
          return acc + value;
        }, 0);
        totals[column.key] = sum;
      }
    });

    return totals;
  };

  const totals = calculateTotals();

  // Renderizar icono de ordenamiento
  const renderSortIcon = (columnKey) => {
    if (!sortable || sortConfig.key !== columnKey) {
      return <Text style={styles.sortIcon}>⬍</Text>;
    }

    return (
      <Text style={[styles.sortIcon, styles.activeSortIcon]}>
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </Text>
    );
  };

  // Renderizar header de la tabla
  const renderHeader = () => (
    <View style={[styles.row, styles.headerRow, isDarkMode && styles.headerRowDark]}>
      {columns.map(column => (
        <TouchableOpacity
          key={column.key}
          style={[styles.cell, styles.headerCell, { flex: column.flex || 1 }]}
          onPress={() => handleSort(column.key)}
          disabled={!sortable}
        >
          <Text style={[styles.headerText, isDarkMode && styles.headerTextDark]}>
            {column.title}
          </Text>
          {sortable && renderSortIcon(column.key)}
        </TouchableOpacity>
      ))}
    </View>
  );

  // Renderizar fila de datos
  const renderRow = (item, index) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.row,
        styles.dataRow,
        isDarkMode && styles.dataRowDark,
        index % 2 === 0 && styles.evenRow,
        index % 2 === 0 && isDarkMode && styles.evenRowDark,
      ]}
      onPress={() => onRowPress && onRowPress(item)}
      disabled={!onRowPress}
    >
      {columns.map(column => (
        <View key={column.key} style={[styles.cell, { flex: column.flex || 1 }]}>
          <Text 
            style={[
              styles.dataText, 
              isDarkMode && styles.dataTextDark,
              column.align === 'center' && styles.textCenter,
              column.align === 'right' && styles.textRight,
            ]}
            numberOfLines={2}
          >
            {formatValue(item[column.key], column)}
          </Text>
        </View>
      ))}
    </TouchableOpacity>
  );

  // Renderizar footer con totales
  const renderFooter = () => {
    if (!showFooter || Object.keys(totals).length === 0) return null;

    return (
      <View style={[styles.row, styles.footerRow, isDarkMode && styles.footerRowDark]}>
        {columns.map(column => (
          <View key={column.key} style={[styles.cell, { flex: column.flex || 1 }]}>
            <Text style={[styles.footerText, isDarkMode && styles.footerTextDark]}>
              {column.key === columns[0].key ? 'Total:' : 
               totals[column.key] !== undefined ? formatValue(totals[column.key], column) : '-'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Estado de carga
  if (loading) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {title && (
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            {title}
          </Text>
        )}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#27AE60" />
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Cargando datos...
          </Text>
        </View>
      </View>
    );
  }

  // Estado sin datos
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        {title && (
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            {title}
          </Text>
        )}
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
            📊 {emptyMessage}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {title && (
        <Text style={[styles.title, isDarkMode && styles.titleDark]}>
          {title}
        </Text>
      )}

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
      >
        <View style={styles.tableContainer}>
          {renderHeader()}
          
          <ScrollView 
            style={[styles.dataContainer, { maxHeight }]}
            showsVerticalScrollIndicator={true}
          >
            {sortedData.map((item, index) => renderRow(item, index))}
          </ScrollView>
          
          {renderFooter()}
        </View>
      </ScrollView>

      {/* Información adicional */}
      <View style={styles.infoContainer}>
        <Text style={[styles.infoText, isDarkMode && styles.infoTextDark]}>
          {data.length} registro{data.length !== 1 ? 's' : ''}
          {sortConfig.key && (
            <Text> • Ordenado por {columns.find(c => c.key === sortConfig.key)?.title}</Text>
          )}
        </Text>
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
  horizontalScroll: {
    maxWidth: '100%',
  },
  tableContainer: {
    minWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerRow: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerRowDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  dataRow: {
    minHeight: 48,
  },
  dataRowDark: {
    borderBottomColor: '#34495e',
  },
  evenRow: {
    backgroundColor: '#f8f9fa',
  },
  evenRowDark: {
    backgroundColor: '#2c3e50',
  },
  footerRow: {
    backgroundColor: '#e9ecef',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomWidth: 0,
  },
  footerRowDark: {
    backgroundColor: '#2c3e50',
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    flex: 1,
  },
  headerTextDark: {
    color: '#ecf0f1',
  },
  dataText: {
    fontSize: 13,
    color: '#212529',
  },
  dataTextDark: {
    color: '#ecf0f1',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
  },
  footerTextDark: {
    color: '#ecf0f1',
  },
  textCenter: {
    textAlign: 'center',
  },
  textRight: {
    textAlign: 'right',
  },
  sortIcon: {
    fontSize: 12,
    color: '#adb5bd',
    marginLeft: 4,
  },
  activeSortIcon: {
    color: '#27AE60',
  },
  dataContainer: {
    maxHeight: 400,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  loadingTextDark: {
    color: '#adb5bd',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#dee2e6',
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  emptyTextDark: {
    color: '#adb5bd',
  },
  infoContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  infoText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  infoTextDark: {
    color: '#adb5bd',
  },
});

export default DataTable;
