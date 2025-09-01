import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCache } from '../contexts/CacheContext';

const CacheStatusIndicator = ({ isDarkMode = false, showDetails = false }) => {
  const { cache, userRole, currentBankId } = useCache();
  
  if (!showDetails) {
    return null; // Solo mostrar en modo debug
  }

  // Si no hay datos del usuario, mostrar estado de "no autenticado"
  if (!userRole && !currentBankId) {
    return (
      <View style={[styles.container, isDarkMode && styles.containerDark]}>
        <Text style={[styles.title, isDarkMode && styles.textDark]}>
          Cache Status (Not Authenticated)
        </Text>
        <Text style={[styles.text, isDarkMode && styles.textDark]}>
          Waiting for login...
        </Text>
      </View>
    );
  }

  const getStatusColor = (data) => {
    if (data === null) return '#E74C3C'; // Rojo - no cargado
    if (data === undefined) return '#F39C12'; // Naranja - indefinido
    if (Array.isArray(data) && data.length === 0) return '#F39C12'; // Naranja - vacío
    return '#27AE60'; // Verde - con datos
  };

  const cacheItems = [
    { label: 'Statistics', data: cache.statistics },
    { label: 'Results', data: cache.todayResults },
    { label: 'Users', data: cache.users },
    { label: 'Lotteries', data: cache.lotteries },
    { label: 'Prices', data: cache.prices },
    { label: 'Limits', data: cache.numberLimits },
  ];

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <Text style={[styles.title, isDarkMode && styles.textDark]}>
        Cache Status
      </Text>
      
      <View style={styles.userInfo}>
        <Text style={[styles.text, isDarkMode && styles.textDark]}>
          Role: {userRole || 'None'} | Bank: {currentBankId || 'None'}
        </Text>
        <Text style={[styles.text, isDarkMode && styles.textDark]}>
          Loading: {cache.isLoading ? 'Yes' : 'No'}
        </Text>
      </View>

      <View style={styles.itemsContainer}>
        {cacheItems.map((item, index) => (
          <View key={index} style={styles.item}>
            <View 
              style={[
                styles.indicator, 
                { backgroundColor: getStatusColor(item.data) }
              ]} 
            />
            <Text style={[styles.itemText, isDarkMode && styles.textDark]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
    borderRadius: 8,
    minWidth: 200,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  containerDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderColor: '#333',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  textDark: {
    color: '#ECF0F1',
  },
  userInfo: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  text: {
    fontSize: 10,
    color: '#2C3E50',
  },
  itemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  itemText: {
    fontSize: 10,
    color: '#2C3E50',
  },
});

export default CacheStatusIndicator;
