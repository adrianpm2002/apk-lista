import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const CollectorDataTable = ({ data, expandedListeros, onToggleListero, isDarkMode }) => {
  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString('es-DO'),
      time: date.toLocaleTimeString('es-DO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    };
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString('es-DO', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  };

  if (!data || Object.keys(data).length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, isDarkMode && styles.darkText]}>
          No hay datos disponibles para el período seleccionado
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {Object.entries(data).map(([listeroId, listeroData]) => {
        const totalJugadas = listeroData.plays.length;
        const totalRecogidoListero = listeroData.plays.reduce((sum, play) => sum + play.monto_total, 0);
        const totalPagadoListero = listeroData.plays.reduce((sum, play) => sum + play.pago_calculado, 0);
        const balanceListero = totalRecogidoListero - totalPagadoListero;

        return (
          <View key={listeroId} style={[styles.listeroGroup, isDarkMode && styles.darkListeroGroup]}>
            <TouchableOpacity
              style={[styles.listeroHeader, isDarkMode && styles.darkListeroHeader]}
              onPress={() => onToggleListero(listeroId)}
            >
              <View style={styles.listeroInfo}>
                <Text style={[styles.listeroName, isDarkMode && styles.darkText]}>
                  {listeroData.listero}
                </Text>
                <View style={styles.listeroStats}>
                  <View style={styles.statChip}>
                    <Text style={styles.chipText}>Jugadas: {totalJugadas}</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.chipText}>Recogido: ${formatCurrency(totalRecogidoListero)}</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={styles.chipText}>Pagado: ${formatCurrency(totalPagadoListero)}</Text>
                  </View>
                  <View style={[styles.statChip, { 
                    backgroundColor: balanceListero >= 0 ? '#E8F5E8' : '#FFEBEE' 
                  }]}>
                    <Text style={[styles.chipText, { 
                      color: balanceListero >= 0 ? '#2E7D32' : '#C62828' 
                    }]}>
                      Balance: ${formatCurrency(balanceListero)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.expandIcon, isDarkMode && styles.darkText]}>
                {expandedListeros.has(listeroId) ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedListeros.has(listeroId) && (
              <View style={styles.playsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Table Header */}
                    <View style={[styles.tableHeader, isDarkMode && styles.darkTableHeader]}>
                      <Text style={[styles.headerCell, styles.timeColumn, isDarkMode && styles.darkHeaderText]}>
                        Hora
                      </Text>
                      <Text style={[styles.headerCell, styles.numbersColumn, isDarkMode && styles.darkHeaderText]}>
                        Números
                      </Text>
                      <Text style={[styles.headerCell, styles.amountColumn, isDarkMode && styles.darkHeaderText]}>
                        Total
                      </Text>
                      <Text style={[styles.headerCell, styles.resultColumn, isDarkMode && styles.darkHeaderText]}>
                        Resultado
                      </Text>
                      <Text style={[styles.headerCell, styles.payColumn, isDarkMode && styles.darkHeaderText]}>
                        Pagado
                      </Text>
                      <Text style={[styles.headerCell, styles.lotteryColumn, isDarkMode && styles.darkHeaderText]}>
                        Lotería
                      </Text>
                      <Text style={[styles.headerCell, styles.scheduleColumn, isDarkMode && styles.darkHeaderText]}>
                        Horario
                      </Text>
                    </View>

                    {/* Table Rows */}
                    {listeroData.plays.map((play) => {
                      const { time } = formatDateTime(play.created_at);
                      
                      return (
                        <View 
                          key={play.id} 
                          style={[styles.tableRow, isDarkMode && styles.darkTableRow]}
                        >
                          <Text style={[styles.cell, styles.timeColumn, isDarkMode && styles.darkCellText]}>
                            {time}
                          </Text>
                          <View style={[styles.cell, styles.numbersColumn]}>
                            <Text style={[styles.numbersText, isDarkMode && styles.darkCellText]}>
                              {play.numeros}
                            </Text>
                          </View>
                          <Text style={[styles.cell, styles.amountColumn, isDarkMode && styles.darkCellText]}>
                            ${formatCurrency(play.monto_total)}
                          </Text>
                          <Text style={[styles.cell, styles.resultColumn, isDarkMode && styles.darkCellText]}>
                            {play.resultado}
                          </Text>
                          <Text style={[styles.cell, styles.payColumn, isDarkMode && styles.darkCellText]}>
                            {play.pago_calculado > 0 
                              ? `$${formatCurrency(play.pago_calculado)}`
                              : 'Sin premio'
                            }
                          </Text>
                          <Text style={[styles.cell, styles.lotteryColumn, isDarkMode && styles.darkCellText]}>
                            {play.loteria}
                          </Text>
                          <Text style={[styles.cell, styles.scheduleColumn, isDarkMode && styles.darkCellText]}>
                            {play.horario}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  darkText: {
    color: '#FFF',
  },
  listeroGroup: {
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  darkListeroGroup: {
    backgroundColor: '#1E1E1E',
  },
  listeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
  },
  darkListeroHeader: {
    backgroundColor: '#2A2A2A',
  },
  listeroInfo: {
    flex: 1,
  },
  listeroName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  listeroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statChip: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 11,
    color: '#1976D2',
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  playsContainer: {
    padding: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  darkTableHeader: {
    backgroundColor: '#1E3A8A',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
    paddingVertical: 4,
  },
  darkHeaderText: {
    color: '#FFF',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  darkTableRow: {
    borderBottomColor: '#333',
  },
  cell: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    paddingVertical: 4,
  },
  darkCellText: {
    color: '#FFF',
  },
  timeColumn: {
    width: 70,
  },
  numbersColumn: {
    width: 120,
    alignItems: 'flex-start',
  },
  numbersText: {
    fontSize: 12,
    color: '#333',
    flexWrap: 'wrap',
    textAlign: 'left',
  },
  amountColumn: {
    width: 80,
  },
  resultColumn: {
    width: 80,
  },
  payColumn: {
    width: 90,
  },
  lotteryColumn: {
    width: 80,
  },
  scheduleColumn: {
    width: 70,
  },
});

export default CollectorDataTable;
