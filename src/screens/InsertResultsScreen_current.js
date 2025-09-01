import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, Pressable, TextInput, Platform, RefreshControl } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ActionButton from '../components/ActionButton';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useFocusEffect } from '@react-navigation/native';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

const InsertResultsScreen = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper 
      navigation={navigation}
      isDarkMode={isDarkMode}
      onToggleDarkMode={onToggleDarkMode}
      onModeVisibilityChange={onModeVisibilityChange}
    >
      <InsertResultsContent 
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const InsertResultsContent = ({ navigation, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  const { cache, userRole: cacheUserRole, currentBankId: cacheBankId, updateCacheData, fetchTodayResults, fetchLotteries, fetchSchedules } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('todayResults');
  
  // DEBUG: Para encontrar el problema del punto
  console.log('=== DEBUG CACHE ===');
  console.log('cache.lotteries:', JSON.stringify(cache.lotteries));
  console.log('cacheUserRole:', JSON.stringify(cacheUserRole));
  
  // Estados básicos
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Componente mínimo para detectar el problema
  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <Text style={styles.headerTitle}>DEBUG - Resultados</Text>
      </View>
      <ScrollView style={styles.content}>
        <Text style={styles.debugText}>Modo debug activo</Text>
        <Text style={styles.debugText}>UserRole: {JSON.stringify(cacheUserRole)}</Text>
        <Text style={styles.debugText}>Lotteries: {JSON.stringify(cache.lotteries?.length)}</Text>
        
        {/* Probar cada componente individualmente */}
        <Text style={styles.debugText}>Fin de debug</Text>
      </ScrollView>
    </View>
  );
};

export default InsertResultsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  customHeader: {
    height: 100,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  debugText: {
    fontSize: 16,
    marginVertical: 8,
    color: '#333',
  },
});
