import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { createShadowStyle } from '../utils/shadowUtils';

const CollectorDataTable = ({ data, expandedListeros, onToggleListero }) => {
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
        <Text style={styles.emptyText}>
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
        
        // Suma de balance_listero de todas las loterías
        const totalBalanceListero = listeroData.plays.reduce((sum, play) => sum + (Number(play.balance_listero) || 0), 0);

        return (
          <View key={listeroId} style={styles.listeroGroup}>
            <TouchableOpacity
              style={styles.listeroHeader}
              onPress={() => onToggleListero(listeroId)}
            >
              <View style={styles.listeroInfo}>
                <Text style={styles.listeroName}>
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
                    backgroundColor: totalBalanceListero >= 0 ? '#E3F2FD' : '#FFF3E0' 
                  }]}>
                    <Text style={[styles.chipText, { 
                      color: totalBalanceListero >= 0 ? '#1565C0' : '#EF6C00' 
                    }]}>
                      Bal. Listero: ${formatCurrency(totalBalanceListero)}
                    </Text>
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
              <Text style={styles.expandIcon}>
                {expandedListeros.has(listeroId) ? '▼' : '▶'}
              </Text>
            </TouchableOpacity>

            {expandedListeros.has(listeroId) && (
              <View style={styles.playsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                      <Text style={[styles.headerCell, styles.timeColumn]}>
                        Hora
                      </Text>
                      <Text style={[styles.headerCell, styles.numbersColumn]}>
                        Números
                      </Text>
                      <Text style={[styles.headerCell, styles.amountColumn]}>
                        Total
                      </Text>
                      <Text style={[styles.headerCell, styles.resultColumn]}>
                        Resultado
                      </Text>
                      <Text style={[styles.headerCell, styles.payColumn]}>
                        Pagado
                      </Text>
                      <Text style={[styles.headerCell, styles.lotteryColumn]}>
                        Lotería
                      </Text>
                      <Text style={[styles.headerCell, styles.scheduleColumn]}>
                        Horario
                      </Text>
                    </View>

                    {/* Table Rows */}
                    {listeroData.plays.map((play) => {
                      const { time } = formatDateTime(play.created_at);
                      
                      return (
                        <View 
                          key={play.id} 
                          style={styles.tableRow}
                        >
                          <Text style={[styles.cell, styles.timeColumn]}>
                            {time}
                          </Text>
                          <View style={[styles.cell, styles.numbersColumn]}>
                            <Text style={styles.numbersText}>
                              {play.numeros}
                            </Text>
                          </View>
                          <Text style={[styles.cell, styles.amountColumn]}>
                            ${formatCurrency(play.monto_total)}
                          </Text>
                          <Text style={[styles.cell, styles.resultColumn]}>
                            {play.resultado}
                          </Text>
                          <Text style={[styles.cell, styles.payColumn]}>
                            {play.pago_calculado > 0 
                              ? `$${formatCurrency(play.pago_calculado)}`
                              : 'Sin premio'
                            }
                          </Text>
                          <Text style={[styles.cell, styles.lotteryColumn]}>
                            {play.loteria}
                          </Text>
                          <Text style={[styles.cell, styles.scheduleColumn]}>
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
  listeroGroup: {
    marginBottom: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    ...createShadowStyle({
      color: '#000',
      offsetY: 1,
      opacity: 0.2,
      radius: 2,
      elevation: 2,
    }),
  },
  listeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
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
  headerCell: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
    textAlign: 'center',
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cell: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    paddingVertical: 4,
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
