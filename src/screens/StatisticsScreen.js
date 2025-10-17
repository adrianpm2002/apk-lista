import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import useStatistics from '../hooks/useStatistics';
import { supabase } from '../supabaseClient';
import StatisticsChart from '../components/StatisticsChart';
import SideBarWrapper, { SideBarToggle } from '../components/SideBarWrapper';
import ScreenWrapper from '../components/ScreenWrapper';
import DateTimePickerWrapper from '../components/DateTimePickerWrapper';
import { createShadowStyle } from '../utils/shadowUtils';

// Importación condicional para exportación PDF
let exportPdfModule;
try {
  if (Platform.OS === 'web') {
    exportPdfModule = require('../utils/pdfExport.web');
  } else {
    exportPdfModule = require('../utils/pdfExport.native');
  }

} catch (error) {
  exportPdfModule = null;
}

const { width: screenWidth } = Dimensions.get('window');

// Helper function para color coding de balances
const getBalanceTextStyle = (balance, baseStyle) => {
  const balanceValue = Number(balance) || 0;
  const color = balanceValue >= 0 ? '#2E7D32' : '#D32F2F'; // Verde para positivo, rojo para negativo
  return [baseStyle, { color }];
};

const StatisticsScreen = ({ navigation, onModeVisibilityChange }) => {
  
  return (
    <ScreenWrapper>
      <StatisticsContent
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const StatisticsContent = ({ navigation, onModeVisibilityChange }) => {
  // Estado local para usuario y rol
  const [currentUserId, setCurrentUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  
  // Cargar perfil del usuario y validar rol
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          Alert.alert(
            'Error de conexión',
            'No se pudo verificar tu rol. Por favor, inicia sesión nuevamente.',
            [{ text: 'OK', onPress: () => navigation.replace('Login') }]
          );
          return;
        }
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (error || !profile || !profile.role) {
          Alert.alert(
            'Error de conexión',
            'No se pudo verificar tu rol. Por favor, inicia sesión nuevamente.',
            [{ text: 'OK', onPress: () => navigation.replace('Login') }]
          );
          return;
        }
        
        // Validar que el rol sea válido (admin, collector, listero)
        const validRoles = ['admin', 'collector', 'colector', 'listero'];
        if (!validRoles.includes(profile.role)) {
          Alert.alert(
            'Error de conexión',
            'Rol de usuario no válido. Por favor, inicia sesión nuevamente.',
            [{ text: 'OK', onPress: () => navigation.replace('Login') }]
          );
          return;
        }
        
        setUserRole(profile.role);
        setCurrentUserId(user.id);
        
      } catch (e) {
        Alert.alert(
          'Error de conexión',
          'No se pudo verificar tu rol. Por favor, inicia sesión nuevamente.',
          [{ text: 'OK', onPress: () => navigation.replace('Login') }]
        );
      }
    };
    
    loadUserProfile();
  }, []);
  
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [selectedLotteryDetails, setSelectedLotteryDetails] = useState('all'); // Filtro específico para la tabla de detalles (listero)
  const [selectedLotteryCollector, setSelectedLotteryCollector] = useState('all'); // Filtro específico para collector/admin
  const [lotterySchedules, setLotterySchedules] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('charts');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false); // Modo oscuro (desactivado por defecto)
  const [showLotteryModal, setShowLotteryModal] = useState(false); // Modal para seleccionar lotería (listero)
  const [showLotteryModalCollector, setShowLotteryModalCollector] = useState(false); // Modal para seleccionar lotería (collector/admin)
  
  // Estados para filtro de fecha personalizada
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  
  // Estados para rango de fechas actual (para filtros)
  const [currentStartDate, setCurrentStartDate] = useState(null);
  const [currentEndDate, setCurrentEndDate] = useState(null);
  
  // Estados para modo Santiago
  const [modoSantiago, setModoSantiago] = useState(false);
  const [porcentajeSantiago, setPorcentajeSantiago] = useState(100);

  // Función para formatear montos con decimales
  const formatMoney = (amount) => {
    const num = Number(amount) || 0;
    return `$${num.toLocaleString('es-DO', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  // Funciones auxiliares para modo Santiago
  const getSantiagoHeader = (originalText) => {
    if (!modoSantiago) return originalText;
    return `${originalText}(${porcentajeSantiago}%)`;
  };

  const getSantiagoValue = (amount) => {
    if (!modoSantiago) return amount;
    return Number(amount) * (porcentajeSantiago / 100);
  };

  const formatSantiagoMoney = (amount) => {
    return formatMoney(getSantiagoValue(amount));
  };

  // Función para cargar el modo Santiago del banco
  const loadModoSantiago = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return;

      // Obtener el banco del usuario actual
      const { data: profile } = await supabase
        .from('profiles')
        .select('id_banco')
        .eq('id', userId)
        .single();

      if (profile?.id_banco) {
        // Obtener configuración del banco
        const { data: bankProfile } = await supabase
          .from('profiles')
          .select('modo_santiago, porciento')
          .eq('id', profile.id_banco)
          .single();

        if (bankProfile) {
          setModoSantiago(bankProfile.modo_santiago || false);
          setPorcentajeSantiago(bankProfile.porciento || 100);
        }
      }
    } catch (error) {
      console.error('Error loading modo Santiago:', error);
    }
  };

  // Hook de estadísticas (userRole ya no viene del hook, se obtiene arriba)
  const {
    kpiData,
    chartData,
    tableData,
    lotteries,
    schedules,
    loading,
    error,
    loadAllStats,
    loadPlaysData,
    applyFilters,
    clearData,
  } = useStatistics();
  
  console.log('[StatisticsScreen] 📦 Received from useStatistics - tableData:', tableData?.plays?.length || 0, 'plays');
  
  // ✅ OPTIMIZADO: groupedData ahora usa useMemo para evitar recalcular en cada render
  // DEBE estar DESPUÉS de useStatistics para que tableData esté definido
  const groupedData = useMemo(() => {
    console.log('[StatisticsScreen] 🔄 Recalculating groupedData - userRole:', userRole, 'tableData plays:', tableData?.plays?.length || 0);
    
    // Retornar datos para TODOS los roles, no solo admin
    if (tableData && tableData.plays && tableData.plays.length > 0) {
      console.log('[StatisticsScreen] ✅ Returning', tableData.plays.length, 'plays for role:', userRole);
      console.log('[StatisticsScreen] 📊 Sample play data:', tableData.plays[0]); // Ver estructura del primer registro
      return tableData.plays;
    }
    
    console.log('[StatisticsScreen] ⚠️ Returning empty array - no data available');
    return [];
  }, [userRole, tableData]);

  // Opciones de períodos
  const periodOptions = [
    { label: 'Hoy', value: 'today' },
    { label: 'Ayer', value: 'yesterday' },
    { label: 'Últimos 7 días', value: 'last7days' },
    { label: 'Últimos 30 días', value: 'last30days' },
    { label: 'Personalizado', value: 'custom' },
  ];

  // Tabs de navegación
  const tabs = [
    { id: 'charts', title: 'Gráficos', icon: '📈' },
    { id: 'details', title: 'Detalles', icon: '📋' },
  ];

  // ✅ CONSOLIDADO: Cargar datos iniciales solo cuando userId y userRole estén disponibles
  useEffect(() => {
    console.log('[StatisticsScreen] Initialization effect - currentUserId:', currentUserId, 'userRole:', userRole);
    
    if (currentUserId && userRole) {
      console.log('[StatisticsScreen] 🚀 Initializing statistics...');
      const initialize = async () => {
        console.log('[StatisticsScreen] Loading modo Santiago...');
        await loadModoSantiago();
        console.log('[StatisticsScreen] Applying period filter: today');
        await applyPeriodFilter('today');
        console.log('[StatisticsScreen] ✅ Initialization complete');
      };
      initialize();
    }
  }, [currentUserId, userRole]);

  // ✅ OPTIMIZADO: Actualizar datos agrupados para admin con useMemo (ver abajo)

  // ❌ ELIMINADO: useEffect que causaba renderizado duplicado
  // Razón: Al cambiar selectedLottery/selectedSchedule re-aplicaba filtro automáticamente
  // Nuevo comportamiento: Usuario aplica filtros manualmente cuando sea necesario
  // Los datos de "Hoy" se cargan automáticamente al iniciar, otros períodos bajo demanda

  const loadInitialData = async () => {
    try {
      await loadAllStats();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las estadísticas iniciales');
    }
  };

  // ❌ ELIMINADO: Carga progresiva automática
  // Razón: Solo se cachean 7 días para evitar QuotaExceededError
  // Períodos largos (mes/mes pasado) se cargan bajo demanda desde Supabase sin caché

  const applyPeriodFilter = async (period, customStart = null, customEnd = null, forceRefresh = false) => {
    console.log('[StatisticsScreen] 📅 applyPeriodFilter called - period:', period, 'forceRefresh:', forceRefresh);
    
    // Verificar que userId esté disponible antes de filtrar
    if (!currentUserId) {
      console.log('[StatisticsScreen] ⚠️ Skipping - no currentUserId');
      return;
    }

    // Validación crítica: si es custom, DEBE tener fechas
    if (period === 'custom' && (!customStart || !customEnd)) {
      console.error('[StatisticsScreen] applyPeriodFilter: período custom sin fechas válidas');
      Alert.alert('Error', 'Debe seleccionar fechas de inicio y fin');
      return;
    }

    // Convertir el período a fechas
    let startDate, endDate;
    
    if (period === 'custom' && customStart && customEnd) {
      startDate = customStart;
      endDate = customEnd;
      console.log('[StatisticsScreen] Custom period:', startDate, 'to', endDate);
    } else {
      // Calcular fechas según el período
      const now = new Date();
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      switch (period) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          console.log('[StatisticsScreen] Period: TODAY');
          break;
          
        case 'yesterday':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          console.log('[StatisticsScreen] Period: YESTERDAY');
          break;
          
        case 'last7days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 6);
          startDate.setHours(0, 0, 0, 0);
          console.log('[StatisticsScreen] Period: LAST 7 DAYS');
          break;
          
        case 'last30days':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 29);
          startDate.setHours(0, 0, 0, 0);
          console.log('[StatisticsScreen] Period: LAST 30 DAYS');
          break;
          
        default:
          // Por defecto, hoy
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          console.log('[StatisticsScreen] Period: DEFAULT (today)');
      }
    }
    
    console.log('[StatisticsScreen] Date range calculated:', startDate, 'to', endDate);
    setSelectedPeriod(period);
    
    // Guardar las fechas actuales para usar en filtros de la UI
    setCurrentStartDate(startDate);
    setCurrentEndDate(endDate);
    
    // Pasar fechas concretas al hook
    console.log('[StatisticsScreen] Calling applyFilters...');
    await applyFilters({
      startDate,
      endDate,
      forceRefresh
    });
    console.log('[StatisticsScreen] ✅ applyPeriodFilter complete');
  };

  // Cargar rango personalizado directamente desde Supabase (fuera del cache)
  const loadCustomRangeFromSupabase = async (startDate, endDate) => {
    try {
      // Validación de parámetros
      if (!startDate || !endDate) {
        console.error('[StatisticsScreen] loadCustomRangeFromSupabase: fechas inválidas', { startDate, endDate });
        Alert.alert('Error', 'Las fechas seleccionadas no son válidas');
        return;
      }

      // Formatear fechas para consulta (formato SQL estándar)
      const startStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
      const endStr = endDate.toISOString().split('T')[0] + ' 23:59:59';

      let query = supabase
        .from('v_estadisticas')
        .select('*')
        .gte('fecha_jugada', startStr)
        .lte('fecha_jugada', endStr)
        .order('fecha_jugada', { ascending: false });

      // Aplicar filtro según rol
      if (userRole === 'admin' || userRole === 'banco') {
        query = query.eq('id_banco', currentUserId);
      } else if (userRole === 'collector' || userRole === 'colector') {
        query = query.eq('id_colector', currentUserId);
      } else if (userRole === 'listero') {
        query = query.eq('id_listero', currentUserId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Aplicar filtros locales con los datos obtenidos
      const filterParams = {
        period: 'custom',
        customStartDate: startDate,
        customEndDate: endDate,
        directData: data // Pasar los datos directamente
      };

      await applyFilters(filterParams);
    } catch (error) {
      console.error('Error al cargar rango personalizado:', error);
      Alert.alert('Error', 'No se pudieron cargar las estadísticas del rango seleccionado');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Reaplicar el período actual con forceRefresh=true para ignorar caché
      await applyPeriodFilter(selectedPeriod, null, null, true);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron actualizar las estadísticas');
    } finally {
      setRefreshing(false);
    }
  }, [selectedPeriod, currentUserId]);

  const handleExport = async (format) => {
    try {
      setShowExportModal(false);
      
      if (format === 'pdf') {
        const success = await exportDetailsToPDF();
        
        if (success) {
          Alert.alert('Éxito', 'PDF exportado correctamente');
        } else {
          Alert.alert('Error', 'No se pudo generar el PDF');
        }
      }
    } catch (error) {
      Alert.alert('Error', `No se pudieron exportar los datos: ${error.message}`);
    }
  };

  // ===== Export helpers (Web) =====
  const groupDetailsForExport = () => {
    // Validar que tableData sea un array
    if (!tableData || !Array.isArray(tableData)) {
      return [];
    }
    
    if (tableData.length === 0) {
      return [];
    }
    
    // Reutilizar misma agrupación base que en pantalla
    const dayKeyOf = (ts)=>{ 
      const d=new Date(ts); 
      if (isNaN(d.getTime())) return 0; // Manejar fecha inválida
      d.setHours(0,0,0,0); 
      return d.getTime(); 
    };
    const dayLabelOf = (ts)=>{ 
      const d=new Date(ts); 
      if (isNaN(d.getTime())) return 'Fecha inválida'; // Manejar fecha inválida
      return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); 
    };
    const timeStr = (ts)=> {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return 'Hora inválida'; // Manejar fecha inválida
      return d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit', hour12: true});
    };
    const inferCollected = (row)=>{
      const mt = row.monto_total;
      if(mt!=null && mt!==undefined) return Number(mt)||0;
      const count = String(row.numeros || row.numeros_jugados || '').split(',').map(s=>s.trim()).filter(Boolean).length;
      return (Number(row.monto_unitario)||0)*count;
    };
    const map = new Map();
    

    
    // Filtrar registros con fechas válidas antes de procesarlos
    const validRecords = tableData.filter(r => r.created_at);
    
    for(const r of validRecords){
      const dayKey = dayKeyOf(r.created_at);
      const dayLabel = dayLabelOf(r.created_at);
      const lot = r.lottery_name || 'Lotería';
      const sch = r.schedule_name || 'Horario';
      const key = `${dayKey}|${lot}|${sch}`;
      if(!map.has(key)) map.set(key, { key, dayKey, dayLabel, lottery: lot, schedule: sch, plays: [], totalRecogido:0, totalPagado:0, resultado: r.resultado || null });
      const g = map.get(key);
      const collected = inferCollected(r);
      g.totalRecogido += collected;
      g.totalPagado += Number(r.pago_calculado||0);
      if (!g.resultado && r.resultado) g.resultado = r.resultado;
      g.plays.push({
        ts: (() => {
          const d = new Date(r.created_at);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        })(),
        time: timeStr(r.created_at),
        nota: r.nota,
        jugada: r.jugada,
        numeros: r.numeros || r.numeros_jugados,
        total: collected,
        pagado: Number(r.pago_calculado||0),
      });
    }
    const groups = Array.from(map.values()).sort((a,b)=> (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));
    groups.forEach(g=> g.plays.sort((a,b)=> b.ts - a.ts));
    
    return groups;
  };

  const exportDetailsToPDF = async () => {
    try{
      const groups = groupDetailsForExport();
      
      const style = `
        <style>
          body{ font-family: Arial, sans-serif; }
          h2{ margin: 6px 0; font-size:14px; }
          table{ width:100%; border-collapse: collapse; margin-bottom: 12px; }
          th, td{ border:1px solid #ccc; padding:6px; font-size: 11px; text-align:left; }
          thead{ background:#f3f3f3; }
          .meta{ color:#333; margin-bottom:4px; }
        </style>`;
      const sections = groups.map(g=>{
        const header = `<div class="meta"><strong>${g.dayLabel}</strong> · ${g.lottery} · ${g.schedule} · Resultado: ${g.resultado || 'no disponible'}</div>`;
        const rows = g.plays.map(p=> `<tr>
            <td>${p.time}</td>
            <td>${(p.nota||'')}</td>
            <td>${(p.jugada||'')}</td>
            <td>${(p.numeros || p.numeros_jugados || '').replace(/</g,'&lt;')}</td>
            <td>${formatSantiagoMoney(p.bruto)}</td>
            <td>${p.pagado>0? formatMoney(p.pagado) : 'Sin premio'}</td>
          </tr>`).join('');
        return `${header}
          <table>
            <thead><tr><th>Hora</th><th>Nota</th><th>Jugada</th><th>Números</th><th>Total</th><th>Pagado</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      }).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>${style}</head><body>
        <h2>Detalles de Jugadas</h2>
        ${sections}
      </body></html>`;
      
      // Verificar que el módulo esté disponible
      if (!exportPdfModule || !exportPdfModule.exportPdf) {
        throw new Error('Módulo de exportación no disponible');
      }
      
      // Usar el módulo de exportación según la plataforma
      const ok = await exportPdfModule.exportPdf(html);
      return !!ok;
    }catch(e){ 
      return false; 
    }
  };

  // Renderizar header con sidebar toggle
  const renderHeader = () => (
    <View style={styles.header}>
      <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
      
      <View style={styles.headerControls}>
        <Text style={styles.headerTitle}>
          {(userRole === 'colector' || userRole === 'collector') ? 'Estadísticas Colector' : 
           userRole === 'admin' ? 'Estadísticas Banco' : 'Estadísticas'}
        </Text>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => setShowExportModal(true)}
        >
          <Text style={styles.exportButtonText}>📤 Exportar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizar tabs de navegación con filtros a la derecha
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <View style={styles.tabsRowContainer}>
        {/* Pestañas a la izquierda */}
        <View style={styles.tabsLeftSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map(tab => (
              <React.Fragment key={tab.id}>
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeTab === tab.id && styles.activeTab,
                  ]}
                  onPress={() => {
                    setActiveTab(tab.id);
                    // El filtro de fecha se mantiene igual para ambas pestañas
                  }}
                >
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text style={[
                    styles.tabText,
                    activeTab === tab.id && styles.activeTabText,
                  ]}>
                    {tab.title}
                  </Text>
                </TouchableOpacity>

                {tab.id === 'details' && (
                  <View></View>
                )}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>

        {/* Filtros a la derecha */}
        <View style={styles.tabsRightSection}>
          {renderCompactFilters()}
        </View>
      </View>
    </View>
  );

  // Renderizar contenido del tab de resumen

  // Filtros compactos para la línea de pestañas
  const renderCompactFilters = () => {
    const firstRowOptions = [
      { label: 'Hoy', value: 'today' },
      { label: 'Ayer', value: 'yesterday' },
      { label: '7d', value: 'last7days' },
    ];

    const secondRowOptions = [
      { label: 'Últimos 30 días', value: 'last30days' },
      { label: 'Personalizado', value: 'custom' },
    ];

    // Preparar opciones de lotería (sin "Todas")
    const lotteryOptions = (lotteries || []).map(lot => ({ label: lot.nombre, value: lot.id }));

    // Preparar opciones de horario (sin "Todos")
    const scheduleOptions = (lotterySchedules || []).map(sch => ({ label: sch.nombre, value: sch.id }));

    // Obtener loterías únicas del cache para listero en tabs de gráficos y detalles
    const uniqueLotteriesListero = (userRole === 'listero' && (activeTab === 'charts' || activeTab === 'details') && tableData?.plays) 
      ? [...new Set(tableData.plays.map(r => r.loteria || r.nombre_loteria || 'Lotería'))].sort()
      : [];
      
    // Obtener loterías únicas para collector/admin en tabs de gráficos y detalles
    let uniqueLotteriesCollector = [];
    if ((userRole === 'collector' || userRole === 'admin') && (activeTab === 'charts' || activeTab === 'details') && tableData?.plays) {
      let allPlays = [];
      if (userRole === 'collector' || userRole === 'colector') {
        // Para colector, los datos vienen agrupados por listero
        const collectorData = tableData.plays || [];
        collectorData.forEach(listero => {
          if (listero.plays && Array.isArray(listero.plays)) {
            allPlays = allPlays.concat(listero.plays);
          }
        });
      } else if (userRole === 'admin') {
        const adminData = tableData.plays || [];
        adminData.forEach(colector => {
          if (colector.listeros && Array.isArray(colector.listeros)) {
            colector.listeros.forEach(listero => {
              if (listero.plays && Array.isArray(listero.plays)) {
                allPlays = allPlays.concat(listero.plays);
              }
            });
          }
        });
      }
      uniqueLotteriesCollector = [...new Set(allPlays.map(r => r.loteria || r.nombre_loteria || 'Lotería'))].sort();
    }

    return (
      <View style={styles.inlineFiltersWrapper}>
        {/* Fila 0: Filtro de Loterías (para listero en gráficos y detalles) */}
        {uniqueLotteriesListero.length > 0 && (
          <View style={[styles.inlineFiltersRow, { marginBottom: 6, alignItems: 'center' }]}>
            <TouchableOpacity
              style={styles.lotterySelector}
              onPress={() => setShowLotteryModal(true)}
            >
              <Text style={styles.lotterySelectorText} numberOfLines={1}>
                {selectedLotteryDetails === 'all' ? 'Todas' : selectedLotteryDetails}
              </Text>
              <Text style={styles.lotterySelectorIcon}>▼</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Fila 0: Filtro de Loterías (para collector/admin en gráficos y detalles) */}
        {uniqueLotteriesCollector.length > 0 && (
          <View style={[styles.inlineFiltersRow, { marginBottom: 6, alignItems: 'center' }]}>
            <TouchableOpacity
              style={styles.lotterySelector}
              onPress={() => setShowLotteryModalCollector(true)}
            >
              <Text style={styles.lotterySelectorText} numberOfLines={1}>
                {selectedLotteryCollector === 'all' ? 'Todas' : selectedLotteryCollector}
              </Text>
              <Text style={styles.lotterySelectorIcon}>▼</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Primera fila: Filtros de período básicos */}
        <View style={styles.inlineFiltersRow}>
          {firstRowOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.inlineFilterChipSmall,
                selectedPeriod === opt.value && styles.inlineFilterChipActive,
              ]}
              onPress={() => {
                setSelectedPeriod(opt.value);
                applyPeriodFilter(opt.value);
              }}
            >
              <Text style={[
                styles.inlineFilterChipTextSmall,
                selectedPeriod === opt.value && styles.inlineFilterChipTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Segunda fila: Períodos largos, lotería y horario */}
        <View style={styles.inlineFiltersRow}>
          {/* Períodos de mes */}
          {secondRowOptions.map(opt => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.inlineFilterChipSmall,
                selectedPeriod === opt.value && styles.inlineFilterChipActive,
              ]}
              onPress={() => {
                if (opt.value === 'custom') {
                  setCustomModalVisible(true);
                } else {
                  setSelectedPeriod(opt.value);
                  applyPeriodFilter(opt.value);
                }
              }}
            >
              <Text style={[
                styles.inlineFilterChipTextSmall,
                selectedPeriod === opt.value && styles.inlineFilterChipTextActive,
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Filtro de Lotería */}
          {lotteryOptions.slice(0, 3).map(opt => (
            <TouchableOpacity
              key={`lottery-${opt.value}`}
              style={[
                styles.inlineFilterChipSmall,
                selectedLottery === opt.value && styles.inlineFilterChipActive,
              ]}
              onPress={() => {
                setSelectedLottery(opt.value);
                applyPeriodFilter(selectedPeriod);
              }}
            >
              <Text style={[
                styles.inlineFilterChipTextSmall,
                selectedLottery === opt.value && styles.inlineFilterChipTextActive,
              ]}>
                {opt.label.length > 6 ? opt.label.substring(0, 6) + '...' : opt.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Filtro de Horario (solo si hay lotería específica seleccionada) */}
          {selectedLottery !== 'all' && scheduleOptions.slice(0, 2).map(opt => (
            <TouchableOpacity
              key={`schedule-${opt.value}`}
              style={[
                styles.inlineFilterChipSmall,
                selectedSchedule === opt.value && styles.inlineFilterChipActive,
              ]}
              onPress={() => {
                setSelectedSchedule(opt.value);
                applyPeriodFilter(selectedPeriod);
              }}
            >
              <Text style={[
                styles.inlineFilterChipTextSmall,
                selectedSchedule === opt.value && styles.inlineFilterChipTextActive,
              ]}>
                {opt.label.length > 5 ? opt.label.substring(0, 5) + '...' : opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Filtros completos siempre visibles (mantener para expandir si es necesario)
  const renderInlineFilters = () => {
    const renderChip = (value, current, setter, label) => (
      <TouchableOpacity
        key={`${label}-${value}`}
        style={[
          styles.filterChipCompact,
          current === value && styles.filterChipCompactActive,
        ]}
        onPress={() => {
          if (value === 'custom') {
            setCustomModalVisible(true);
          } else {
            setter(value);
            applyPeriodFilter(value);
          }
        }}
      >
        <Text style={[
          styles.filterChipCompactText,
          current === value && styles.filterChipCompactTextActive,
        ]}>{label}</Text>
      </TouchableOpacity>
    );

    // Opciones de filtros más comunes
    const compactPeriodOptions = [
      { label: 'Hoy', value: 'today' },
      { label: 'Ayer', value: 'yesterday' },
      { label: '7 días', value: 'last7days' },
      { label: '30 días', value: 'last30days' },
      { label: 'Personalizado', value: 'custom' },
    ];

    return (
      <View style={styles.compactFiltersPanel}>
        <View style={styles.filtersContainer}>
          {compactPeriodOptions.map(opt => renderChip(opt.value, selectedPeriod, setSelectedPeriod, opt.label))}
        </View>
      </View>
    );
  };

  // Función para generar título dinámico del gráfico
  const getChartTitle = () => {
    const titleMap = {
      'today': 'Ganancias vs Pérdidas (Hoy)',
      'yesterday': 'Ganancias vs Pérdidas (Ayer)',
      'last7days': 'Ganancias vs Pérdidas (Últimos 7 días)',
      'last30days': 'Ganancias vs Pérdidas (Últimos 30 días)',
      'custom': 'Ganancias vs Pérdidas (Personalizado)',
    };
    return titleMap[selectedPeriod] || 'Ganancias vs Pérdidas';
  };

  // Renderizar contenido del tab de gráficos
  const renderChartsTab = () => {
    // Para collector y admin, usar datos agrupados
    if (userRole === 'collector' || userRole === 'admin') {
      return renderRoleBasedChartsTab();
    }
    
    // Para listero, mostrar la vista original
    return renderListeroChartsTab();
  };

  // Vista de gráficos para listero (vista original)
  const renderListeroChartsTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#27AE60']}
          tintColor="#27AE60"
        />
      }
    >
      {/* Gráfico de Balance basado en datos reales */}
      {tableData?.plays && tableData.plays.length > 0 && (()=>{
        const fmtShort = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        
        // Filtrar jugadas por lotería seleccionada Y por período de fechas
        const filteredPlays = tableData.plays.filter(play => {
          // Filtro de lotería
          if (selectedLotteryDetails !== 'all') {
            const playLottery = play.loteria || play.nombre_loteria || 'Lotería';
            if (playLottery !== selectedLotteryDetails) {
              return false;
            }
          }
          
          // Filtro de período de fechas
          if (currentStartDate && currentEndDate && play.fecha_jugada) {
            const playDate = new Date(play.fecha_jugada);
            if (isNaN(playDate.getTime())) {
              return false; // Saltar jugadas con fecha inválida
            }
            // Comparar solo las fechas (sin hora)
            const playDateOnly = new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate());
            const startDateOnly = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), currentStartDate.getDate());
            const endDateOnly = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth(), currentEndDate.getDate());
            
            if (playDateOnly < startDateOnly || playDateOnly > endDateOnly) {
              return false;
            }
          }
          
          return true;
        });
        
        // Agrupar jugadas por fecha y calcular balance diario
        const dailyBalanceMap = new Map();
        
        filteredPlays.forEach(play => {
          // Validar que fecha_jugada exista y sea una fecha válida
          if (!play.fecha_jugada) {
            return; // Saltar esta jugada si no tiene fecha
          }
          
          const playDate = new Date(play.fecha_jugada);
          if (isNaN(playDate.getTime())) {
            return; // Saltar esta jugada si la fecha es inválida
          }
          
          // Usar fecha local en lugar de UTC
          const year = playDate.getFullYear();
          const month = String(playDate.getMonth() + 1).padStart(2, '0');
          const day = String(playDate.getDate()).padStart(2, '0');
          const dateKey = `${year}-${month}-${day}`; // YYYY-MM-DD en fecha local
          
          if (!dailyBalanceMap.has(dateKey)) {
            dailyBalanceMap.set(dateKey, {
              date: dateKey,
              d: new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate()),
              bruto: 0,
              pagado: 0,
              balance: 0
            });
          }
          
          const dayData = dailyBalanceMap.get(dateKey);
          dayData.bruto += Number(play.monto_total || 0);
          dayData.pagado += Number(play.monto_a_pagar || 0);
          dayData.balance += Number(play.balance_listero || 0); // Usar balance_listero real
        });
        
        // Convertir a array y ordenar por fecha
        const dailyData = Array.from(dailyBalanceMap.values())
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Determinar la agrupación según el número de días
        let displayData = dailyData;
        let labelFormat = fmtShort;
        
        if (dailyData.length > 30) {
          // Para más de 30 días, agrupar por semanas
          const weeklyMap = new Map();
          dailyData.forEach(day => {
            const date = new Date(day.date);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay()); // Inicio de semana (domingo)
            // Usar fecha local en lugar de UTC
            const year = weekStart.getFullYear();
            const month = String(weekStart.getMonth() + 1).padStart(2, '0');
            const dayStr = String(weekStart.getDate()).padStart(2, '0');
            const weekKey = `${year}-${month}-${dayStr}`;
            
            if (!weeklyMap.has(weekKey)) {
              weeklyMap.set(weekKey, {
                date: weekKey,
                d: weekStart,
                bruto: 0,
                pagado: 0,
                balance: 0
              });
            }
            
            const weekData = weeklyMap.get(weekKey);
            weekData.bruto += day.bruto;
            weekData.pagado += day.pagado;
            weekData.balance += day.balance;
          });
          
          displayData = Array.from(weeklyMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          labelFormat = (dt) => `Sem ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
          
        } else if (dailyData.length > 14) {
          // Para más de 14 días, tomar solo los últimos 14
          displayData = dailyData.slice(-14);
        } else if (dailyData.length > 7) {
          // Para más de 7 días, tomar todos pero máximo 14
          displayData = dailyData;
        } else {
          // Para 7 días o menos, mostrar todos
          displayData = dailyData;
        }
        
        // Crear serie para el gráfico (solo balance)
        const series = displayData.map(day => ({
          date: day.date,
          profit: day.balance, // El gráfico usa 'profit' pero mostramos balance
          label: labelFormat(day.d)
        }));
        
        return (
          <View>
            <StatisticsChart
              type="profitLoss"
              title="Balance Diario"
              data={series}
              height={260}
            />
            {/* KPIs del período debajo del gráfico */}
            {(() => {
              // Calcular totales del período desde datos filtrados
              const playsInPeriod = filteredPlays || [];
              
              const totalBruto = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
              const totalGananciaListero = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_listero) || 0), 0);
              const totalPagado = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
              const totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_listero) || 0), 0); // Usar balance_listero real
              // Cálculo Limpio: Bruto - Ganancia Listero
              const totalLimpio = totalBruto - totalGananciaListero;
              
              return (
                <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginHorizontal:8, marginTop:16 }}>
                  <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                    <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Bruto')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#27AE60' }}>{formatSantiagoMoney(totalBruto)}</Text>
                  </View>
                  <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                    <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Ganancia')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#f39c12' }}>{formatSantiagoMoney(totalGananciaListero)}</Text>
                  </View>
                  <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                    <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Limpio')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#3498db' }}>{formatSantiagoMoney(totalLimpio)}</Text>
                  </View>
                  <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                    <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Premio')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#9b59b6' }}>{formatSantiagoMoney(totalPagado)}</Text>
                  </View>
                  <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                    <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Balance')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'800', color: getSantiagoValue(totalBalance)>=0? '#27AE60':'#e74c3c' }}>{formatSantiagoMoney(totalBalance)}</Text>
                  </View>
                </View>
              );
            })()}
          </View>
        );
      })()}
    </ScrollView>
  );

  // Vista de gráficos para collector y admin (ahora usa balance diario como listero)
  const renderRoleBasedChartsTab = () => {
    // Para collector y admin, usar directamente tableData.plays del hook
    let allPlays = [];
    if (userRole === 'collector' || userRole === 'colector') {
      // Para colector, los datos vienen agrupados por listero, necesitamos extraer las jugadas individuales
      const collectorData = tableData?.plays || [];
      collectorData.forEach(listero => {
        if (listero.plays && Array.isArray(listero.plays)) {
          allPlays = allPlays.concat(listero.plays);
        }
      });
    } else if (userRole === 'admin') {
      // Para admin, extraer todas las jugadas de la estructura jerárquica
      const adminData = tableData?.plays || [];
      adminData.forEach(colector => {
        if (colector.listeros && Array.isArray(colector.listeros)) {
          colector.listeros.forEach(listero => {
            if (listero.plays && Array.isArray(listero.plays)) {
              allPlays = allPlays.concat(listero.plays);
            }
          });
        }
      });
    }
    
    // Filtrar jugadas por lotería seleccionada Y por período de fechas
    const filteredPlays = allPlays.filter(play => {
      // Filtro de lotería
      if (selectedLotteryCollector !== 'all') {
        const playLottery = play.loteria || play.nombre_loteria || 'Lotería';
        if (playLottery !== selectedLotteryCollector) {
          return false;
        }
      }
      
      // Filtro de período de fechas
      if (currentStartDate && currentEndDate && play.fecha_jugada) {
        const playDate = new Date(play.fecha_jugada);
        if (isNaN(playDate.getTime())) {
          return false; // Saltar jugadas con fecha inválida
        }
        // Comparar solo las fechas (sin hora)
        const playDateOnly = new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate());
        const startDateOnly = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), currentStartDate.getDate());
        const endDateOnly = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth(), currentEndDate.getDate());
        
        if (playDateOnly < startDateOnly || playDateOnly > endDateOnly) {
          return false;
        }
      }
      
      return true;
    });

    return (
      <ScrollView
        style={styles.tabContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        {/* KPIs principales del hook - ocultar para colectores y admin */}
        {kpiData && kpiData.length > 0 && userRole !== 'collector' && userRole !== 'colector' && userRole !== 'admin' && (
          <View style={styles.kpiGrid}>
            {kpiData.map((kpi, index) => (
              <View key={index} style={styles.kpiCard}>
                <Text style={styles.kpiIcon}>{kpi.icon}</Text>
                <Text style={styles.kpiTitle}>{kpi.title}</Text>
                <Text style={styles.kpiValue}>{kpi.formattedValue}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* KPIs y Gráfico para collector y admin */}
        {(userRole === 'collector' || userRole === 'colector' || userRole === 'admin') && (() => {
          // Calcular totales del período desde filteredPlays (datos filtrados por período)
          const playsInPeriod = filteredPlays || [];
          
          const totalBruto = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
          const totalPagado = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
          const totalGananciaListero = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_listero) || 0), 0);
          
          let totalGanancia = 0;
          let totalBalance = 0;
          
          if (userRole === 'collector' || userRole === 'colector') {
            totalGanancia = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
            totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
          } else if (userRole === 'admin') {
            totalGanancia = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
            totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
          }
          
          // Cálculo Limpio: Bruto - Ganancia Listero (para todos los roles)
          const totalLimpio = totalBruto - totalGananciaListero;
          
          return (
            <>
              {/* Gráfico de Balance Diario - PRIMERO */}
              {(() => {
                const fmtShort = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
                
                // Agrupar jugadas por fecha y calcular balance diario
                const dailyBalanceMap = new Map();
                
                playsInPeriod.forEach(play => {
            // Validar que fecha_jugada exista y sea una fecha válida
            if (!play.fecha_jugada) {
              return; // Saltar esta jugada si no tiene fecha
            }
            
            const playDate = new Date(play.fecha_jugada);
            if (isNaN(playDate.getTime())) {
              return; // Saltar esta jugada si la fecha es inválida
            }
            
            // Debug: Log para ver las fechas que se están procesando
            // Usar fecha local en lugar de UTC para evitar problemas de zona horaria
            const year = playDate.getFullYear();
            const month = String(playDate.getMonth() + 1).padStart(2, '0');
            const day = String(playDate.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`; // YYYY-MM-DD en fecha local
            
            if (!dailyBalanceMap.has(dateKey)) {
              dailyBalanceMap.set(dateKey, {
                date: dateKey,
                d: new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate()),
                bruto: 0,
                pagado: 0,
                ganancia: 0,
                balance: 0,
                playCount: 0 // Para debuggear
              });
            }
            
            const dayData = dailyBalanceMap.get(dateKey);
            dayData.bruto += Number(play.monto_total || 0); // CORREGIDO: usar monto_total
            dayData.pagado += Number(play.monto_a_pagar || 0); // CORREGIDO: usar monto_a_pagar
            dayData.playCount++; // Para debuggear
            
            // Agregar ganancia según el rol
            if (userRole === 'collector') {
              dayData.ganancia += Number(play.ganancia_colector || 0);
              dayData.balance += Number(play.balance_colector || 0); // Usar balance_colector real
            } else if (userRole === 'admin') {
              dayData.ganancia += Number(play.ganancia_colector || 0); // Para admin, usar ganancia_colector
              dayData.balance += Number(play.balance_colector || 0); // Para admin, usar balance_colector (que es el balance del banco)
            }
          });
          
          // Convertir a array y ordenar por fecha
          const dailyData = Array.from(dailyBalanceMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          
          // Determinar la agrupación según el número de días
          let displayData = dailyData;
          let labelFormat = fmtShort;
          
          if (dailyData.length > 30) {
            // Para más de 30 días, agrupar por semanas
            const weeklyMap = new Map();
            dailyData.forEach(day => {
              const date = new Date(day.date);
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay()); // Inicio de semana (domingo)
              // Usar fecha local en lugar de UTC
              const year = weekStart.getFullYear();
              const month = String(weekStart.getMonth() + 1).padStart(2, '0');
              const dayStr = String(weekStart.getDate()).padStart(2, '0');
              const weekKey = `${year}-${month}-${dayStr}`;
              
              if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, {
                  date: weekKey,
                  d: weekStart,
                  bruto: 0,
                  pagado: 0,
                  ganancia: 0,
                  balance: 0
                });
              }
              
              const weekData = weeklyMap.get(weekKey);
              weekData.bruto += day.bruto;
              weekData.pagado += day.pagado;
              weekData.ganancia += day.ganancia;
              weekData.balance += day.balance;
            });
            
            displayData = Array.from(weeklyMap.values())
              .sort((a, b) => new Date(a.date) - new Date(b.date));
            labelFormat = (dt) => `Sem ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
            
          } else if (dailyData.length > 14) {
            // Para más de 14 días, tomar solo los últimos 14
            displayData = dailyData.slice(-14);
          } else if (dailyData.length > 7) {
            // Para más de 7 días, tomar todos pero máximo 14
            displayData = dailyData;
          } else {
            // Para 7 días o menos, mostrar todos
            displayData = dailyData;
          }
          
          // Crear serie para el gráfico (solo balance)
          const series = displayData.map(day => ({
            date: day.date,
            profit: day.balance, // El gráfico usa 'profit' pero mostramos balance
            label: labelFormat(day.d)
          }));
          
          return (
            <View>
              <StatisticsChart
                type="profitLoss"
                title="Balance Diario"
                data={series}
                height={260}
              />
            </View>
          );
        })()}
              
              {/* KPIs debajo del gráfico */}
              <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginHorizontal:8, marginTop:16, marginBottom:8 }}>
                <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                  <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Bruto')}</Text>
                  <Text style={{ fontSize:16, fontWeight:'800', color:'#27AE60' }}>{formatSantiagoMoney(totalBruto)}</Text>
                </View>
                
                <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                  <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Limpio')}</Text>
                  <Text style={{ fontSize:16, fontWeight:'800', color:'#3498db' }}>{formatSantiagoMoney(totalLimpio)}</Text>
                </View>
                
                {(userRole === 'collector' || userRole === 'colector') && (
                  <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                    <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Ganancia')}</Text>
                    <Text style={{ fontSize:16, fontWeight:'800', color:'#f39c12' }}>{formatSantiagoMoney(totalGanancia)}</Text>
                  </View>
                )}
                
                <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                  <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Balance')}</Text>
                  <Text style={{ fontSize:16, fontWeight:'800', color: getSantiagoValue(totalBalance)>=0? '#27AE60':'#e74c3c' }}>{formatSantiagoMoney(totalBalance)}</Text>
                </View>
              </View>
            </>
          );
        })()}
      </ScrollView>
    );
  };

  // Función para navegar al registro de jugadas en modo solo lectura
  const navigateToPlaysRecord = (groupData) => {
    try {
      // Preparar datos para el registro de jugadas
      const playsRecordParams = {
        readOnlyMode: true,
        groupData: {
          fecha: groupData.dayLabel,
          loteria: groupData.lottery,
          horario: groupData.schedule,
          resultado: groupData.resultado,
          jugadas: (groupData.plays || []).map(play => ({
            ts: play.ts || (() => {
              const d = new Date(play.fecha_jugada || Date.now());
              return isNaN(d.getTime()) ? Date.now() : d.getTime();
            })(),
            time: play.time || (() => {
              const d = new Date(play.fecha_jugada || Date.now());
              return isNaN(d.getTime()) ? 'Hora inválida' : d.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              });
            })(),
            nota: play.nota || '',
            jugada: play.jugada || play.play_type || '',
            numeros: play.numeros || play.numeros_jugados || '',
            bruto: Number(play.bruto || play.monto_total || 0),
            ganancia: Number(play.ganancia || play.ganancia_listero || play.ganancia_colector || 0),
            pagado: Number(play.pagado || play.monto_a_pagar || 0),
            balance: Number(play.balance || play.balance_listero || play.balance_colector || play.balance_banco || 0)
          }))
        },
        title: `${groupData.dayLabel} - ${groupData.lottery} - ${groupData.schedule}`
      };
      
      // Navegar a la pantalla de jugadas con los parámetros
      navigation.navigate('Jugadas', playsRecordParams);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir el registro de jugadas');
    }
  };

  // Renderizar contenido del tab de detalles
  const renderDetailsTab = () => {
    // Para collector y admin, mostrar desplegables de agrupación
    if (userRole === 'collector' || userRole === 'admin') {
      return renderRoleBasedDetailsTab();
    }
    
    // Para listero, mostrar la vista original
    return renderListeroDetailsTab();
  };

  // Vista de detalles para listero (vista original)
  const renderListeroDetailsTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#27AE60']}
          tintColor="#27AE60"
        />
      }
    >
      {(()=>{
        if(!tableData?.plays || tableData.plays.length === 0) return (
          <Text style={[styles.empty, { marginTop: 16 }]}>
            Sin jugadas en el período seleccionado
          </Text>
        );

        const dayKeyOf = (ts) => { 
          const d = new Date(ts); 
          if (isNaN(d.getTime())) return 0;
          d.setHours(0,0,0,0); 
          return d.getTime(); 
        };
        
        const dayLabelOf = (ts) => { 
          const d = new Date(ts); 
          return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); 
        };
        
        const timeStr = (ts) => new Date(ts).toLocaleTimeString('es-ES', {
          hour:'2-digit', 
          minute:'2-digit', 
          hour12: true
        });
        
        const fmt = (n) => {
          const num = Number(n) || 0;
          return `$${num.toLocaleString('es-DO', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          })}`;
        };

        // Obtener loterías únicas del cache para el filtro
        const uniqueLotteries = [...new Set(tableData.plays.map(r => r.loteria || r.nombre_loteria || 'Lotería'))].sort();

        // Agrupar por fecha + lotería + horario + resultado
        const map = new Map();
        
        // Filtrar registros con fechas válidas Y por lotería seleccionada Y por período
        const validPlays = tableData.plays.filter(r => {
          if (!r.fecha_jugada) return false;
          
          // Aplicar filtro de lotería
          if (selectedLotteryDetails !== 'all') {
            const playLottery = r.loteria || r.nombre_loteria || 'Lotería';
            if (playLottery !== selectedLotteryDetails) return false;
          }
          
          // Aplicar filtro de período de fechas
          if (currentStartDate && currentEndDate) {
            const playDate = new Date(r.fecha_jugada);
            if (isNaN(playDate.getTime())) return false;
            
            const playDateOnly = new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate());
            const startDateOnly = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), currentStartDate.getDate());
            const endDateOnly = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth(), currentEndDate.getDate());
            
            if (playDateOnly < startDateOnly || playDateOnly > endDateOnly) {
              return false;
            }
          }
          
          return true;
        });
        
        for(const r of validPlays) {
          const dayKey = dayKeyOf(r.fecha_jugada);
          const dayLabel = dayLabelOf(r.fecha_jugada);
          const lottery = r.loteria || r.nombre_loteria || 'Lotería';
          const schedule = r.horario || r.nombre_horario || 'Horario';
          const resultado = r.resultado || null;
          
          const key = `${dayKey}|${lottery}|${schedule}|${resultado || 'sin_resultado'}`;
          
          if(!map.has(key)) {
            map.set(key, { 
              key, 
              dayKey, 
              dayLabel, 
              lottery, 
              schedule, 
              resultado,
              plays: [], 
              totalGananciaListero: 0,  // Suma de ganancia_listero
              totalRecogido: 0,         // Suma de bruto
              totalLimpio: 0,           // Suma de limpio (bruto - ganancia)
              totalBalance: 0,          // Suma de balance_listero
              totalPagado: 0            // Suma de premios pagados
            });
          }
          
          const group = map.get(key);
          
          // Acumular totales
          const bruto = Number(r.monto_total || 0);
          const ganancia = Number(r.ganancia_listero || 0);
          group.totalGananciaListero += ganancia;
          group.totalRecogido += bruto;
          group.totalLimpio += (bruto - ganancia);  // Limpio = Bruto - Ganancia
          group.totalBalance += Number(r.balance_listero || 0);
          group.totalPagado += Number(r.monto_a_pagar || 0);
          
          // Agregar jugada individual
          group.plays.push({
            time: timeStr(r.fecha_jugada),
            ts: (() => {
              const d = new Date(r.fecha_jugada);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            })(),
            nota: r.nota || '',
            jugada: r.tipo_jugada || '',
            numeros: r.numeros || r.numeros_jugados || '',
            bruto: Number(r.monto_total || 0),
            ganancia: Number(r.ganancia_listero || 0),
            pagado: Number(r.monto_a_pagar || 0),
            balance: Number(r.balance_listero || 0)
          });
        }
        
        let groups = Array.from(map.values())
          .sort((a,b) => (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));

        groups.forEach(g => {
          g.plays.sort((a,b) => b.ts - a.ts);
        });

        const expanded = expandedGroups;
        const toggle = (key)=> setExpandedGroups(prev=>{ const next=new Set(prev); if(next.has(key)) next.delete(key); else next.add(key); return next; });

        return (
          <View style={{ paddingHorizontal:8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
              <View style={styles.excelTable}>
                <View style={styles.excelHeaderRow}>
                  <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
                  <Text style={[styles.excelHeaderCell, { width: 70 }]}>Fecha</Text>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>Lotería</Text>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>Horario</Text>
                  <Text style={[styles.excelHeaderCell, { width: 70 }]}>Resultado</Text>
                  <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Bruto')}</Text>
                  <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Limpio')}</Text>
                  <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Ganancia')}</Text>
                  <Text style={[styles.excelHeaderCell, { width: 100 }]}>Premio</Text>
                  <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Balance')}</Text>
                </View>
                
                {groups.map((g, groupIndex) => {
                  const open = expanded.has(g.key);
                  const balance = g.totalBalance;
                  
                  return (
                    <View key={g.key}>
                      <TouchableOpacity 
                        style={[styles.excelDataRow, groupIndex % 2 === 0 && styles.excelRowEven]}
                        onPress={() => navigateToPlaysRecord(g)}
                      >
                        <View style={[styles.excelCellContainer, { width: 30 }]}>
                          <Text style={[styles.excelCell, styles.chevronCell]}>
                            👁️
                          </Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 70 }]}>
                          <Text style={styles.excelCell} numberOfLines={2}>{g.dayLabel}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={styles.excelCell} numberOfLines={2}>{g.lottery}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={styles.excelCell} numberOfLines={2}>{g.schedule}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 70 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>
                            {g.resultado || 'N/A'}
                          </Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 100 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalRecogido)}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 100 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalLimpio)}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 100 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalGananciaListero)}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 100 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>{fmt(g.totalPagado)}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 100 }]}>
                          <Text style={getBalanceTextStyle(getSantiagoValue(balance), styles.excelCell)} numberOfLines={1}>
                            {formatSantiagoMoney(balance)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );
      })()}
    </ScrollView>
  );

  // Vista de detalles para collector y admin con desplegables
  const renderRoleBasedDetailsTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#27AE60']}
          tintColor="#27AE60"
        />
      }
    >
      {/* Desplegable principal según el rol */}
      {userRole === 'collector' && renderCollectorExpandableTable()}
      {userRole === 'admin' && renderAdminExpandableTable()}
      
      {/* Ya no se necesita renderGroupDetails porque cada rol maneja su propia vista */}
    </ScrollView>
  );

  // Nueva tabla expandible para collector (SEGUNDA CAPA - agrupa por lotería y horario)
  const renderCollectorExpandableTable = () => {
    // Para colectores, usar directamente los datos agrupados del hook (ya vienen agrupados por listero)
    let collectorData = tableData?.plays || [];
    
    // Aplicar filtros de lotería y período
    collectorData = collectorData.map(listero => {
      // Filtrar las jugadas del listero por lotería Y período
      const filteredPlays = (listero.plays || []).filter(play => {
        // Filtro de lotería
        if (selectedLotteryCollector !== 'all') {
          const playLottery = play.loteria || play.nombre_loteria || 'Lotería';
          if (playLottery !== selectedLotteryCollector) {
            return false;
          }
        }
        
        // Filtro de período de fechas
        if (currentStartDate && currentEndDate && play.fecha_jugada) {
          const playDate = new Date(play.fecha_jugada);
          if (isNaN(playDate.getTime())) {
            return false;
          }
          const playDateOnly = new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate());
          const startDateOnly = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), currentStartDate.getDate());
          const endDateOnly = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth(), currentEndDate.getDate());
          
          if (playDateOnly < startDateOnly || playDateOnly > endDateOnly) {
            return false;
          }
        }
        
        return true;
      });
      
      // Recalcular totales basados en las jugadas filtradas
      const totals = {
        total_bruto: 0,
        total_premio: 0,
        total_ganancia_listero: 0,
        total_ganancia_colector: 0,
        balance_colector: 0
      };
      
      filteredPlays.forEach(play => {
        totals.total_bruto += Number(play.monto_total || 0);
        totals.total_premio += Number(play.monto_a_pagar || 0);
        totals.total_ganancia_listero += Number(play.ganancia_listero || 0);
        totals.total_ganancia_colector += Number(play.ganancia_colector || 0);
        totals.balance_colector += Number(play.balance_colector || 0);
      });
      
      return {
        ...listero,
        plays: filteredPlays,
        ...totals
      };
    }).filter(listero => listero.plays.length > 0); // Solo mantener listeros con jugadas
    
    if (!collectorData || collectorData.length === 0) {
      return (
        <Text style={[styles.empty, { marginTop: 16 }]}>
          Sin datos para mostrar en el período seleccionado
        </Text>
      );
    }

    // Definir expanded y toggle para esta función
    const expanded = expandedGroups;
    const toggle = (key) => setExpandedGroups(prev => { 
      const next = new Set(prev); 
      if (next.has(key)) next.delete(key); 
      else next.add(key); 
      return next; 
    });

    const fmt = (n) => {
      const num = Number(n) || 0;
      return `$${num.toLocaleString('es-DO', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    // AGRUPAR PRIMERO POR LISTEROS, LUEGO POR LOTERÍA/HORARIO DENTRO DE CADA LISTERO
    return (
      <View style={{ paddingHorizontal: 4, marginTop: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
          <View style={styles.excelTable}>
            <View style={styles.excelHeaderRow}>
              <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>Listero</Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Bruto')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Limpio')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Gan. Listeros')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Gan. Colector')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>Premios</Text>
              <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Balance')}</Text>
            </View>
            
            {collectorData.map((listero, listeroIndex) => {
              const listeroKey = `listero_${listero.id}`;
              const openListero = expanded.has(listeroKey);
              
              return (
                <View key={listeroKey}>
                  <TouchableOpacity 
                    style={[styles.excelDataRow, listeroIndex % 2 === 0 && styles.excelRowEven]}
                    onPress={() => toggle(listeroKey)}
                  >
                    <View style={[styles.excelCellContainer, { width: 30 }]}>
                      <Text style={[styles.excelCell, styles.chevronCell]}>
                        {openListero ? '▼' : '▶'}
                      </Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={2}>{listero.listero_name}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(listero.total_bruto)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>
                        {formatSantiagoMoney(listero.total_bruto - listero.total_ganancia_listero)}
                      </Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 110 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(listero.total_ganancia_listero)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 110 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(listero.total_ganancia_colector)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{fmt(listero.total_premio)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 110 }]}>
                      <Text style={getBalanceTextStyle(getSantiagoValue(listero.balance_colector), styles.excelCell)} numberOfLines={1}>
                        {formatSantiagoMoney(listero.balance_colector)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  {openListero && (
                    <View style={[styles.expandedContent, { backgroundColor: '#F1F3F4' }]}>
                      {renderGroupedPlaysTable(listero.plays || [])}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Desplegable para collector (agrupa por listero)
  const renderCollectorDropdown = () => (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>
        Listeros
      </Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedGroup}
          onValueChange={setSelectedGroup}
          style={styles.picker}
        >
          <Picker.Item label="Seleccionar listero..." value="" />
          {groupedData.map(item => (
            <Picker.Item 
              key={item.id_listero} 
              label={`${item.listero_username} - Bruto: ${formatSantiagoMoney(item.bruto_total)} - Ganancia: ${formatSantiagoMoney(item.ganancia_colector_total)} - Balance: ${formatSantiagoMoney(item.balance_colector_total)}`}
              value={String(item.id_listero)}
            />
          ))}
        </Picker>
      </View>
    </View>
  );

  // Nueva tabla expandible para admin (agrupa por colector → listero)
  // Nueva tabla expandible para admin (TRES CAPAS - agrupa por colector -> listero -> lotería/horario)
  const renderAdminExpandableTable = () => {
    // Para admin, usar directamente los datos agrupados por colector del hook
    let adminData = tableData?.plays || [];
    
    // Aplicar filtros de lotería y período
    adminData = adminData.map(colector => {
      // Filtrar listeros que tengan jugadas de la lotería seleccionada y período
      const filteredListeros = (colector.listeros || []).map(listero => {
        // Filtrar jugadas del listero por lotería Y período
        const filteredPlays = (listero.plays || []).filter(play => {
          // Filtro de lotería
          if (selectedLotteryCollector !== 'all') {
            const playLottery = play.loteria || play.nombre_loteria || 'Lotería';
            if (playLottery !== selectedLotteryCollector) {
              return false;
            }
          }
          
          // Filtro de período de fechas
          if (currentStartDate && currentEndDate && play.fecha_jugada) {
            const playDate = new Date(play.fecha_jugada);
            if (isNaN(playDate.getTime())) {
              return false;
            }
            const playDateOnly = new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate());
            const startDateOnly = new Date(currentStartDate.getFullYear(), currentStartDate.getMonth(), currentStartDate.getDate());
            const endDateOnly = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth(), currentEndDate.getDate());
            
            if (playDateOnly < startDateOnly || playDateOnly > endDateOnly) {
              return false;
            }
          }
          
          return true;
        });
        
        // Recalcular totales del listero
        const totals = {
          total_bruto: 0,
          total_premio: 0,
          total_ganancia_listero: 0,
          total_ganancia_colector: 0,
          balance_colector: 0
        };
        
        filteredPlays.forEach(play => {
          totals.total_bruto += Number(play.monto_total || 0);
          totals.total_premio += Number(play.monto_a_pagar || 0);
          totals.total_ganancia_listero += Number(play.ganancia_listero || 0);
          totals.total_ganancia_colector += Number(play.ganancia_colector || 0);
          totals.balance_colector += Number(play.balance_colector || 0);
        });
        
        return {
          ...listero,
          plays: filteredPlays,
          ...totals
        };
      }).filter(listero => listero.plays.length > 0); // Solo mantener listeros con jugadas
      
      // Recalcular totales del colector
      const colectorTotals = {
        total_bruto: 0,
        total_premio: 0,
        total_ganancia_listero: 0,
        total_ganancia_colector: 0,
        balance_colector: 0
      };
      
      filteredListeros.forEach(listero => {
        colectorTotals.total_bruto += Number(listero.total_bruto || 0);
        colectorTotals.total_premio += Number(listero.total_premio || 0);
        colectorTotals.total_ganancia_listero += Number(listero.total_ganancia_listero || 0);
        colectorTotals.total_ganancia_colector += Number(listero.total_ganancia_colector || 0);
        colectorTotals.balance_colector += Number(listero.balance_colector || 0);
      });
      
      return {
        ...colector,
        listeros: filteredListeros,
        ...colectorTotals
      };
    }).filter(colector => colector.listeros.length > 0); // Solo mantener colectores con listeros
    
    if (!adminData || adminData.length === 0) {
      return (
        <Text style={[styles.empty, { marginTop: 16 }]}>
          Sin datos de colectores para mostrar
        </Text>
      );
    }

    const fmt = (n) => {
      const num = Number(n) || 0;
      return `$${num.toLocaleString('es-DO', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    const expanded = expandedGroups;
    const toggle = (key) => setExpandedGroups(prev => { 
      const next = new Set(prev); 
      if(next.has(key)) next.delete(key); 
      else next.add(key); 
      return next; 
    });

    return (
      <View style={{ paddingHorizontal: 4, marginTop: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
          <View style={styles.excelTable}>
            <View style={styles.excelHeaderRow}>
              <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>Colector</Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Bruto')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Limpio')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Gan. Colector')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 100 }]}>Premios</Text>
              <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Balance')}</Text>
            </View>
            
            {adminData.map((colector, colectorIndex) => {
              const colectorKey = `colector_${colector.id}`;
              const openColector = expanded.has(colectorKey);
              
              return (
                <View key={colectorKey}>
                  <TouchableOpacity 
                    style={[styles.excelDataRow, colectorIndex % 2 === 0 && styles.excelRowEven]}
                    onPress={() => toggle(colectorKey)}
                  >
                    <View style={[styles.excelCellContainer, { width: 30 }]}>
                      <Text style={[styles.excelCell, styles.chevronCell]}>
                        {openColector ? '▼' : '▶'}
                      </Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={2}>{colector.collector_name}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(colector.total_bruto)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>
                        {formatSantiagoMoney((colector.total_bruto || 0) - (colector.total_ganancia_listero || 0))}
                      </Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 110 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(colector.total_ganancia_colector)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 100 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{fmt(colector.total_premio)}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 110 }]}>
                      <Text style={getBalanceTextStyle(getSantiagoValue(colector.balance_colector), styles.excelCell)} numberOfLines={1}>
                        {formatSantiagoMoney(colector.balance_colector)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Contenido expandido - listeros del colector */}
                  {openColector && (
                    <View style={styles.expandedContent}>
                      {/* Sub-header para listeros */}
                      <View style={[styles.excelHeaderRow, styles.subHeader]}>
                        <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>Listero</Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Bruto')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Limpio')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Gan. Listero')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>Premios</Text>
                        <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Bal. Listero')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Bal. Colector')}</Text>
                      </View>
                      
                      {/* Filas de listeros expandibles */}
                      {(colector.listeros || []).map((listero, listeroIndex) => {
                        const listeroKey = `${colectorKey}_listero_${listero.id}`;
                        const openListero = expanded.has(listeroKey);
                        
                        return (
                          <View key={listeroKey}>
                            {/* Fila del listero (clickeable) */}
                            <TouchableOpacity 
                              style={[styles.excelDataRow, styles.detailRow, listeroIndex % 2 === 0 && styles.excelRowEven]}
                              onPress={() => toggle(listeroKey)}
                            >
                              <View style={[styles.excelCellContainer, { width: 30 }]}>
                                <Text style={[styles.excelCell, styles.chevronCell]}>
                                  {openListero ? '▼' : '▶'}
                                </Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 100 }]}>
                                <Text style={styles.excelCell} numberOfLines={2}>{listero.listero_name}</Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 100 }]}>
                                <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(listero.total_bruto)}</Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 100 }]}>
                                <Text style={styles.excelCell} numberOfLines={1}>
                                  {formatSantiagoMoney((listero.total_bruto || 0) - (listero.total_ganancia_listero || 0))}
                                </Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 110 }]}>
                                <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(listero.total_ganancia_listero)}</Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 100 }]}>
                                <Text style={styles.excelCell} numberOfLines={1}>{fmt(listero.total_premio)}</Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 110 }]}>
                                <Text style={getBalanceTextStyle(getSantiagoValue(listero.balance_listero), styles.excelCell)} numberOfLines={1}>
                                  {formatSantiagoMoney(listero.balance_listero)}
                                </Text>
                              </View>
                              <View style={[styles.excelCellContainer, { width: 110 }]}>
                                <Text style={getBalanceTextStyle(getSantiagoValue(listero.balance_colector), styles.excelCell)} numberOfLines={1}>
                                  {formatSantiagoMoney(listero.balance_colector)}
                                </Text>
                              </View>
                            </TouchableOpacity>
                            
                            {/* Contenido expandido - grupos de fecha/lotería/horario */}
                            {openListero && (
                              <View style={[styles.expandedContent, { backgroundColor: '#F1F3F4' }]}>
                                {renderGroupedPlaysTable(listero.plays || [])}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Desplegables para admin (agrupa por colector)
  const renderAdminDropdowns = () => (
    <View style={styles.dropdownContainer}>
      <Text style={styles.dropdownLabel}>
        Colectores
      </Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedGroup}
          onValueChange={setSelectedGroup}
          style={styles.picker}
        >
          <Picker.Item label="Seleccionar colector..." value="" />
          {groupedData.map(item => (
            <Picker.Item 
              key={item.id_colector} 
              label={`${item.colector_username} - Bruto: ${formatSantiagoMoney(item.bruto_total)} - Balance: ${formatSantiagoMoney(item.balance_banco_total)}`}
              value={String(item.id_colector)}
            />
          ))}
        </Picker>
      </View>
    </View>
  );

  // Renderizar detalles del grupo seleccionado
  const renderGroupDetails = () => {
    let playsData = [];
    
    if (userRole === 'collector') {
      const selectedData = groupedData.find(item => String(item.id_listero) === selectedGroup);
      playsData = selectedData?.plays || [];
    } else if (userRole === 'admin') {
      const selectedData = groupedData.find(item => String(item.id_colector) === selectedGroup);
      playsData = selectedData?.plays || [];
    }

    if (!playsData.length) {
      return (
        <Text style={[styles.empty, { marginTop: 16 }]}>
          Sin jugadas para mostrar
        </Text>
      );
    }

    // Usar la misma lógica de agrupación que para listero, pero con los datos filtrados
    return renderGroupedPlaysTable(playsData);
  };

  // Función auxiliar para renderizar tabla de jugadas agrupadas
  const renderGroupedPlaysTable = (plays) => {
    // Helpers para formateo
    const dayKeyOf = (ts) => { 
      const d = new Date(ts); 
      if (isNaN(d.getTime())) return 0; // Manejar fecha inválida
      d.setHours(0,0,0,0); 
      return d.getTime(); 
    };
    
    const dayLabelOf = (ts) => { 
      const d = new Date(ts); 
      return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); 
    };
    
    const timeStr = (ts) => new Date(ts).toLocaleTimeString('es-ES', {
      hour:'2-digit', 
      minute:'2-digit', 
      hour12: true
    });
    
    const fmt = (n) => {
      const num = Number(n) || 0;
      return `$${num.toLocaleString('es-DO', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    // Agrupar por fecha + lotería + horario + resultado
    const map = new Map();
    
    // Filtrar registros con fechas válidas antes de procesarlos
    const validPlays = plays.filter(r => r.fecha_jugada || r.created_at);
    
    for(const r of validPlays) {
      // Usar fecha_jugada como campo principal de fecha (de v_estadisticas)
      const fechaJugada = r.fecha_jugada || r.created_at;
      const dayKey = dayKeyOf(fechaJugada);
      const dayLabel = dayLabelOf(fechaJugada);
      const lottery = r.loteria || r.nombre_loteria || 'Lotería';
      const schedule = r.horario || r.nombre_horario || 'Horario';
      const resultado = r.resultado || null;
      
      const key = `${dayKey}|${lottery}|${schedule}|${resultado || 'sin_resultado'}`;
      
      if(!map.has(key)) {
        map.set(key, { 
          key, 
          dayKey, 
          dayLabel, 
          lottery, 
          schedule, 
          resultado,
          plays: [], 
          totalGanancia: 0,
          totalGananciaListero: 0,
          totalGananciaColector: 0,
          totalRecogido: 0,
          totalBalance: 0,
          totalBalanceListero: 0,
          totalBalanceColector: 0,
          totalPagado: 0
        });
      }
      
      const group = map.get(key);
      
      // Acumular totales según el rol - USAR CAMPOS CORRECTOS DE v_estadisticas
      if (userRole === 'collector') {
        group.totalGanancia += Number(r.ganancia_colector || 0);
        group.totalGananciaListero += Number(r.ganancia_listero || 0);
        group.totalGananciaColector += Number(r.ganancia_colector || 0);
        group.totalBalance += Number(r.balance_colector || 0);
        group.totalBalanceListero += Number(r.balance_listero || 0);
        group.totalBalanceColector += Number(r.balance_colector || 0);
      } else if (userRole === 'admin') {
        // Para admin, usar los mismos campos que colector
        group.totalGanancia += Number(r.ganancia_colector || 0);
        group.totalGananciaListero += Number(r.ganancia_listero || 0);
        group.totalGananciaColector += Number(r.ganancia_colector || 0);
        group.totalBalance += Number(r.balance_colector || 0);
        group.totalBalanceListero += Number(r.balance_listero || 0);
        group.totalBalanceColector += Number(r.balance_colector || 0);
      } else {
        // Para listeros, usar balance_listero
        group.totalBalance += Number(r.balance_listero || 0);
      }
      
      group.totalRecogido += Number(r.monto_total || 0); // CORREGIDO: usar monto_total
      group.totalPagado += Number(r.monto_a_pagar || 0); // CORREGIDO: usar monto_a_pagar
      
      // Agregar jugada individual - USAR CAMPOS CORRECTOS
      group.plays.push({
        time: timeStr(fechaJugada), // Usar la fecha correcta
        ts: (() => {
          const d = new Date(fechaJugada);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        })(),
        jugada: r.tipo_jugada || '', // CORREGIDO: usar tipo_jugada
        numeros: r.numeros_jugados || '', // CORREGIDO: usar numeros_jugados
        bruto: Number(r.monto_total || 0), // CORREGIDO: usar monto_total
        ganancia: userRole === 'collector' ? Number(r.ganancia_colector || 0) : 0,
        gananciaListero: Number(r.ganancia_listero || 0),
        gananciaColector: Number(r.ganancia_colector || 0),
        pagado: Number(r.monto_a_pagar || 0), // CORREGIDO: usar monto_a_pagar
        balance: userRole === 'collector' ? Number(r.balance_colector || 0) : 
                userRole === 'admin' ? Number(r.balance_colector || 0) : 
                Number(r.balance_listero || 0),
        balanceListero: Number(r.balance_listero || 0),
        balanceColector: Number(r.balance_colector || 0)
      });
    }
    
    // Ordenar grupos
    let groups = Array.from(map.values())
      .sort((a,b) => (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));

    // Ordenar jugadas dentro de cada grupo
    groups.forEach(g => {
      g.plays.sort((a,b) => b.ts - a.ts);
    });

    const expanded = expandedGroups;
    const toggle = (key)=> setExpandedGroups(prev=>{ const next=new Set(prev); if(next.has(key)) next.delete(key); else next.add(key); return next; });

    return (
      <View style={{ paddingHorizontal:4, marginTop: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
          <View style={styles.excelTable}>
            {/* Header de la tabla principal estilo Excel */}
            <View style={styles.excelHeaderRow}>
              <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
              <Text style={[styles.excelHeaderCell, { width: 70 }]}>Fecha</Text>
              <Text style={[styles.excelHeaderCell, { width: 70 }]}>Lotería</Text>
              <Text style={[styles.excelHeaderCell, { width: 70 }]}>Horario</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>Resultado</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bruto')}</Text>
              {(userRole === 'collector' || userRole === 'admin') && (
                <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Limpio')}</Text>
              )}
              {(userRole === 'collector' || userRole === 'admin') ? (
                <>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Gan. Listero')}</Text>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Gan. Colector')}</Text>
                </>
              ) : (
                <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Ganancia')}</Text>
              )}
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{(userRole === 'collector' || userRole === 'admin') ? 'Premio' : 'Pagado'}</Text>
              {userRole === 'collector' ? (
                <>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bal. Listero')}</Text>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bal. Colector')}</Text>
                </>
              ) : userRole === 'admin' ? (
                <>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bal. Listero')}</Text>
                  <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bal. Colector')}</Text>
                </>
              ) : (
                <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Balance')}</Text>
              )}
            </View>
            
            {/* Filas de grupos expandibles */}
            {groups.map((g, groupIndex) => {
              const balance = g.totalBalance; // Usar el balance correcto según el rol
              
              return (
                <View key={g.key}>
                  {/* Fila principal del grupo (clickeable para ir al registro) */}
                  <TouchableOpacity 
                    style={[styles.excelDataRow, groupIndex % 2 === 0 && styles.excelRowEven]}
                    onPress={() => navigateToPlaysRecord(g)}
                  >
                    <View style={[styles.excelCellContainer, { width: 30 }]}>
                      <Text style={[styles.excelCell, styles.chevronCell]}>
                        👁️
                      </Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 70 }]}>
                      <Text style={styles.excelCell} numberOfLines={2}>{g.dayLabel}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 70 }]}>
                      <Text style={styles.excelCell} numberOfLines={2}>{g.lottery}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 70 }]}>
                      <Text style={styles.excelCell} numberOfLines={2}>{g.schedule}</Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 80 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>
                        {g.resultado || 'N/A'}
                      </Text>
                    </View>
                    <View style={[styles.excelCellContainer, { width: 80 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalRecogido)}</Text>
                    </View>
                    {(userRole === 'collector' || userRole === 'admin') && (
                      <View style={[styles.excelCellContainer, { width: 80 }]}>
                        <Text style={styles.excelCell} numberOfLines={1}>
                          {formatSantiagoMoney(g.totalRecogido - (g.totalGananciaListero || 0))}
                        </Text>
                      </View>
                    )}
                    {(userRole === 'collector' || userRole === 'admin') ? (
                      <>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalGananciaListero || 0)}</Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalGananciaColector || 0)}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.excelCellContainer, { width: 80 }]}>
                        <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalGanancia)}</Text>
                      </View>
                    )}
                    <View style={[styles.excelCellContainer, { width: 80 }]}>
                      <Text style={styles.excelCell} numberOfLines={1}>{fmt(g.totalPagado)}</Text>
                    </View>
                    {userRole === 'collector' ? (
                      <>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={getBalanceTextStyle(getSantiagoValue(g.totalBalanceListero), styles.excelCell)} numberOfLines={1}>
                            {formatSantiagoMoney(g.totalBalanceListero || 0)}
                          </Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={getBalanceTextStyle(getSantiagoValue(g.totalBalanceColector), styles.excelCell)} numberOfLines={1}>
                            {formatSantiagoMoney(g.totalBalanceColector || 0)}
                          </Text>
                        </View>
                      </>
                    ) : userRole === 'admin' ? (
                      <>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={getBalanceTextStyle(getSantiagoValue(g.totalBalanceListero), styles.excelCell)} numberOfLines={1}>
                            {formatSantiagoMoney(g.totalBalanceListero || 0)}
                          </Text>
                        </View>
                        <View style={[styles.excelCellContainer, { width: 80 }]}>
                          <Text style={getBalanceTextStyle(getSantiagoValue(g.totalBalanceColector), styles.excelCell)} numberOfLines={1}>
                            {formatSantiagoMoney(g.totalBalanceColector || 0)}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={[styles.excelCellContainer, { width: 80 }]}>
                        <Text style={getBalanceTextStyle(getSantiagoValue(balance), styles.excelCell)} numberOfLines={1}>
                          {formatSantiagoMoney(balance)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Renderizar contenido del tab de reportes

  // Modal de filtros eliminado; ahora se usan filtros inline

  // Renderizar modal de exportación
  const renderExportModal = () => (
    <Modal
      visible={showExportModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowExportModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.exportModalContent}>
          <Text style={styles.modalTitle}>
            📤 Exportar Datos
          </Text>

          <TouchableOpacity
            style={styles.exportOption}
            onPress={() => handleExport('pdf')}
          >
            <Text style={styles.exportOptionText}>
              🖨️ Exportar a PDF
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowExportModal(false)}
          >
            <Text style={styles.cancelButtonText}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Renderizar modal de selección de lotería
  const renderLotteryModal = () => {
    const uniqueLotteries = (userRole === 'listero' && (activeTab === 'charts' || activeTab === 'details') && tableData?.plays) 
      ? [...new Set(tableData.plays.map(r => r.loteria || r.nombre_loteria || 'Lotería'))].sort()
      : [];

    if (uniqueLotteries.length === 0) return null;

    return (
      <Modal
        visible={showLotteryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLotteryModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLotteryModal(false)}
        >
          <View style={styles.lotteryModalContent}>
            <Text style={styles.modalTitle}>Seleccionar Lotería</Text>
            
            <ScrollView style={styles.lotteryList}>
              <TouchableOpacity
                style={[
                  styles.lotteryOption,
                  selectedLotteryDetails === 'all' && styles.lotteryOptionSelected
                ]}
                onPress={() => {
                  setSelectedLotteryDetails('all');
                  setShowLotteryModal(false);
                }}
              >
                <Text style={[
                  styles.lotteryOptionText,
                  selectedLotteryDetails === 'all' && styles.lotteryOptionTextSelected
                ]}>
                  Todas
                </Text>
                {selectedLotteryDetails === 'all' && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>

              {uniqueLotteries.map(lottery => (
                <TouchableOpacity
                  key={`lottery-modal-${lottery}`}
                  style={[
                    styles.lotteryOption,
                    selectedLotteryDetails === lottery && styles.lotteryOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedLotteryDetails(lottery);
                    setShowLotteryModal(false);
                  }}
                >
                  <Text style={[
                    styles.lotteryOptionText,
                    selectedLotteryDetails === lottery && styles.lotteryOptionTextSelected
                  ]}>
                    {lottery}
                  </Text>
                  {selectedLotteryDetails === lottery && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowLotteryModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Renderizar modal de selección de lotería para collector/admin
  const renderLotteryModalCollector = () => {
    let allPlays = [];
    if (userRole === 'collector' || userRole === 'colector') {
      const collectorData = tableData?.plays || [];
      collectorData.forEach(listero => {
        if (listero.plays && Array.isArray(listero.plays)) {
          allPlays = allPlays.concat(listero.plays);
        }
      });
    } else if (userRole === 'admin') {
      const adminData = tableData?.plays || [];
      adminData.forEach(colector => {
        if (colector.listeros && Array.isArray(colector.listeros)) {
          colector.listeros.forEach(listero => {
            if (listero.plays && Array.isArray(listero.plays)) {
              allPlays = allPlays.concat(listero.plays);
            }
          });
        }
      });
    }
    
    const uniqueLotteries = [...new Set(allPlays.map(r => r.loteria || r.nombre_loteria || 'Lotería'))].sort();

    if (uniqueLotteries.length === 0) return null;

    return (
      <Modal
        visible={showLotteryModalCollector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLotteryModalCollector(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLotteryModalCollector(false)}
        >
          <View style={styles.lotteryModalContent}>
            <Text style={styles.modalTitle}>Seleccionar Lotería</Text>
            
            <ScrollView style={styles.lotteryList}>
              <TouchableOpacity
                style={[
                  styles.lotteryOption,
                  selectedLotteryCollector === 'all' && styles.lotteryOptionSelected
                ]}
                onPress={() => {
                  setSelectedLotteryCollector('all');
                  setShowLotteryModalCollector(false);
                }}
              >
                <Text style={[
                  styles.lotteryOptionText,
                  selectedLotteryCollector === 'all' && styles.lotteryOptionTextSelected
                ]}>
                  Todas
                </Text>
                {selectedLotteryCollector === 'all' && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>

              {uniqueLotteries.map(lottery => (
                <TouchableOpacity
                  key={`lottery-modal-collector-${lottery}`}
                  style={[
                    styles.lotteryOption,
                    selectedLotteryCollector === lottery && styles.lotteryOptionSelected
                  ]}
                  onPress={() => {
                    setSelectedLotteryCollector(lottery);
                    setShowLotteryModalCollector(false);
                  }}
                >
                  <Text style={[
                    styles.lotteryOptionText,
                    selectedLotteryCollector === lottery && styles.lotteryOptionTextSelected
                  ]}>
                    {lottery}
                  </Text>
                  {selectedLotteryCollector === lottery && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowLotteryModalCollector(false)}
            >
              <Text style={styles.cancelButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Renderizar modal de fecha personalizada
  const renderCustomDateModal = () => {
    const handleApplyCustomDates = async () => {
      try {
        // Validar que las fechas existan
        if (!customStartDate || !customEndDate) {
          Alert.alert('Error', 'Debe seleccionar ambas fechas');
          return;
        }

        // Crear nuevas instancias de Date para evitar mutación
        const normalizedStart = new Date(customStartDate.getTime());
        normalizedStart.setHours(0, 0, 0, 0);
        
        const normalizedEnd = new Date(customEndDate.getTime());
        normalizedEnd.setHours(23, 59, 59, 999);

        // Validar que la fecha de inicio no sea mayor que la fecha de fin
        if (normalizedStart > normalizedEnd) {
          Alert.alert('Error', 'La fecha de inicio no puede ser mayor que la fecha de fin');
          return;
        }

        // Verificar si el rango está dentro de los últimos 30 días (29 días atrás + hoy = 30 días)
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 29);
        thirtyDaysAgo.setHours(0, 0, 0, 0);

        const isWithinCache = normalizedStart >= thirtyDaysAgo && normalizedEnd <= today;

        // Cerrar modal ANTES de cargar para mejor UX
        setCustomModalVisible(false);

        // Aplicar filtro personalizado
        setSelectedPeriod('custom');

        if (isWithinCache) {
          // Usar filtrado local del cache (pasamos fechas normalizadas)
          await applyPeriodFilter('custom', normalizedStart, normalizedEnd);
        } else {
          // Consultar Supabase directamente (pasamos fechas normalizadas)
          await loadCustomRangeFromSupabase(normalizedStart, normalizedEnd);
        }
      } catch (error) {
        console.error('[StatisticsScreen] Error en handleApplyCustomDates:', error);
        Alert.alert('Error', 'No se pudo aplicar el filtro personalizado. Intenta de nuevo.');
      }
    };

    return (
      <Modal
        visible={customModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCustomModalVisible(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.lotteryModalContent}>
              <Text style={styles.modalTitle}>Seleccionar Rango de Fechas</Text>
              
              <View style={styles.datePickerContainer}>
                <Text style={styles.dateLabel}>Fecha de Inicio:</Text>
                <DateTimePickerWrapper
                  value={customStartDate}
                  onChange={(date) => setCustomStartDate(date)}
                  maximumDate={new Date()}
                />
              </View>

              <View style={styles.datePickerContainer}>
                <Text style={styles.dateLabel}>Fecha de Fin:</Text>
                <DateTimePickerWrapper
                  value={customEndDate}
                  onChange={(date) => setCustomEndDate(date)}
                  maximumDate={new Date()}
                />
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={handleApplyCustomDates}
                >
                  <Text style={styles.applyButtonText}>Aplicar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setCustomModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Renderizar contenido según el tab activo
  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'charts':
        return renderChartsTab();
      case 'details':
        return renderDetailsTab();
      default:
        return renderChartsTab();
    }
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          ❌ Error al cargar estadísticas
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
          <Text style={styles.retryButtonText}>🔄 Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderTabs()}
      
      {/* Banner de carga superior compacto - Sincronizado con estado del hook */}
      {loading && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#27AE60" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      )}
      
      <View style={styles.content}>
        {renderActiveTabContent()}
      </View>

      {renderExportModal()}
      {renderLotteryModal()}
      {renderLotteryModalCollector()}
      {renderCustomDateModal()}

      <SideBarWrapper
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // Banner de carga superior (compacto y profesional)
  loadingBanner: {
    position: 'absolute',
    top: 60,
    left: '50%',
    transform: [{ translateX: '-50%' }],
    backgroundColor: '#E8F8F5',
    borderWidth: 1,
    borderColor: '#27AE60',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  loadingText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  
  filtersPanel:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#E1E8E3', borderRadius:10, padding:8, margin:8 },
  filtersPanelDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  
  // Estilos para filtros compactos siempre visibles
  compactFiltersPanel: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  filtersScrollView: {
    flexGrow: 0,
  },
  filtersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterChipCompact: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 4, // Agregar margen inferior para cuando se envuelvan
  },
  filterChipCompactActive: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  filterChipCompactText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  filterChipCompactTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  lotterySelector: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  lotterySelectorText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
    flex: 1,
  },
  lotterySelectorIcon: {
    fontSize: 12,
    color: '#6c757d',
    marginLeft: 8,
  },
  lotteryModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 20,
    maxHeight: '70%',
    ...createShadowStyle(8),
  },
  lotteryList: {
    maxHeight: 400,
  },
  lotteryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  lotteryOptionSelected: {
    backgroundColor: '#e8f5e9',
  },
  lotteryOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  lotteryOptionTextSelected: {
    color: '#27AE60',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 20,
    color: '#27AE60',
    fontWeight: 'bold',
  },
  customDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  compactDateButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
  },
  compactDateButtonText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
    textAlign: 'center',
  },
  dateRangeSeparator: {
    color: '#6c757d',
    marginHorizontal: 8,
    fontSize: 14,
  },
  
  panelLabel:{ fontSize:11, fontWeight:'700', color:'#2D5016', marginTop:4, marginBottom:4 },
  panelLabelDark:{ color:'#ECF0F1' },
  chipsRow:{ flexDirection:'row', flexWrap:'wrap', marginBottom:6 },
  filterChip:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#B8D4A8', borderRadius:20, paddingHorizontal:10, paddingVertical:6, marginRight:6, marginBottom:6 },
  filterChipDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  filterChipActive:{ backgroundColor:'#E8F5E8', borderColor:'#27AE60' },
  filterChipActiveDark:{ backgroundColor:'#5D6D7E', borderColor:'#27AE60' },
  filterChipText:{ fontSize:12, color:'#2D5016', fontWeight:'500' },
  filterChipTextDark:{ color:'#ECF0F1' },
  filterChipTextActive:{ fontWeight:'700', color:'#27AE60' },
  dateSection:{ flexDirection:'row', alignItems:'center', gap:8, marginTop:6 },
  dateSectionCompact:{ flexDirection:'row', alignItems:'center', marginTop:6 },
  dateButton:{ backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#E1E8E3', borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  dateButtonDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  dateButtonText:{ color:'#2C3E50', fontWeight:'600' },
  dateButtonTextDark:{ color:'#ECF0F1' },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  containerDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 70,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 1000,
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.1,
      radius: 2,
      elevation: 4,
    }),
  },
  headerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginRight: 16,
  },
  headerTitleDark: {
    color: '#ecf0f1',
  },
  sidebarButton: {
    marginLeft: 4,
    marginBottom: 4,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  filterButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  filterButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  filterButtonText: {
    color: '#495057',
    fontWeight: '500',
  },
  filterButtonTextDark: {
    color: '#ecf0f1',
  },
  exportButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonDark: {
    backgroundColor: '#229954',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginTop: 110,
  },
  tabsContainerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  tabsRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  tabsLeftSection: {
    flex: 1,
  },
  tabsRightSection: {
    flexShrink: 0,
  },
  inlineFiltersWrapper: {
    flexGrow: 1, // Permitir que crezca para usar más espacio
  },
  inlineFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2, // Reducido de 4 a 2
  },
  inlineFiltersContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap', // Permitir que se envuelvan a la siguiente línea
  },
  inlineFilterChip: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4, // Agregar margen inferior para cuando se envuelvan
  },
  inlineFilterChipSmall: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 4, // Reducido de 6 a 4
    paddingVertical: 1, // Reducido de 2 a 1
    marginRight: 2, // Reducido de 4 a 2
    marginBottom: 1, // Reducido de 2 a 1
    minWidth: 36, // Reducido de 40 a 36
  },
  inlineFilterChipActive: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
  },
  inlineFilterChipText: {
    fontSize: 10,
    color: '#6c757d',
    fontWeight: '500',
  },
  inlineFilterChipTextSmall: {
    fontSize: 9,
    color: '#6c757d',
    fontWeight: '500',
    textAlign: 'center',
  },
  inlineFilterChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#27AE60',
  },
  activeTabDark: {
    borderBottomColor: '#2ecc71',
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '500',
  },
  tabTextDark: {
    color: '#adb5bd',
  },
  activeTabText: {
    color: '#27AE60',
    fontWeight: '600',
  },
  // Totales mostrados junto al tab de "Detalles"
  detailsTotalsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    marginLeft: 8,
  },
  detailsTotalsLeftCol: {
    flexDirection: 'column',
    marginRight: 8,
    gap: 6,
  },
  detailsTotalText: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  detailsTotalTextDark: {
    color: '#ecf0f1',
  },
  // Chips para totales en el encabezado
  detailsTotalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  detailsTotalChipCollected: {
    backgroundColor: '#eaf7f0',
    borderWidth: 1,
    borderColor: '#cfe9da',
  },
  detailsTotalChipCollectedDark: {
    backgroundColor: '#20382b',
    borderColor: '#1a2e24',
  },
  detailsTotalChipPaid: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f5c6c3',
  },
  detailsTotalChipPaidDark: {
    backgroundColor: '#3a1f1d',
    borderColor: '#2f1917',
  },
  // Chip neutral reutilizable para Recogido/Pagado al lado de Detalles
  detailsTotalChipNeutral: {
    backgroundColor: '#ECF0F1',
    borderWidth: 1,
    borderColor: '#D6DBDF',
  },
  detailsTotalChipNeutralDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  detailsTotalTextCollected: {
    color: '#27AE60',
    fontWeight: '700',
    fontSize: 12,
  },
  detailsTotalTextCollectedDark: {
    color: '#2ecc71',
  },
  detailsTotalTextPaid: {
    color: '#e74c3c',
    fontWeight: '700',
    fontSize: 12,
  },
  detailsTotalTextPaidDark: {
    color: '#ff6b6b',
  },
  detailsTotalChipBalancePos: {
    backgroundColor: '#eaf7f0',
    borderWidth: 1,
    borderColor: '#cfe9da',
  },
  detailsTotalChipBalancePosDark: {
    backgroundColor: '#20382b',
    borderColor: '#1a2e24',
  },
  detailsTotalChipBalanceNeg: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: '#f5c6c3',
  },
  detailsTotalChipBalanceNegDark: {
    backgroundColor: '#3a1f1d',
    borderColor: '#2f1917',
  },
  detailsTotalTextBalance: {
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitleDark: {
    color: '#ecf0f1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxHeight: '80%',
    minWidth: screenWidth - 40,
  },
  modalContentDark: {
    backgroundColor: '#2c3e50',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalTitleDark: {
    color: '#ecf0f1',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 8,
  },
  filterLabelDark: {
    color: '#ecf0f1',
  },
  pickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  pickerContainerDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  picker: {
    height: 50,
  },
  pickerDark: {
    color: '#ecf0f1',
  },
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginHorizontal: 4,
  },
  dateButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  dateButtonText: {
    color: '#495057',
    textAlign: 'center',
  },
  dateButtonTextDark: {
    color: '#ecf0f1',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonDark: {
    backgroundColor: '#34495e',
    borderColor: '#34495e',
  },
  cancelButtonText: {
    color: '#6c757d',
    textAlign: 'center',
    fontWeight: '500',
  },
  cancelButtonTextDark: {
    color: '#adb5bd',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#27AE60',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  applyButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  exportModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 250,
  },
  exportOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  exportOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  exportOptionTextDark: {
    color: '#ecf0f1',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorContainerDark: {
    backgroundColor: '#1a1a1a',
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorTextDark: {
    color: '#e74c3c',
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
  },
  // Estilos tabla agrupada
  groupCard:{ backgroundColor:'#FFFFFF', borderRadius:10, borderWidth:1, borderColor:'#E1E8E3', marginHorizontal:8, marginBottom:10, overflow:'hidden' },
  groupCardDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  groupHeader:{ flexDirection:'row', alignItems:'flex-start', padding:10 },
  groupChevron:{ width:18, textAlign:'center', marginRight:6, color:'#2C3E50' },
  groupTitle:{ fontSize:13, fontWeight:'800', color:'#2C3E50', marginBottom:6 },
  groupTitleDark:{ color:'#ECF0F1' },
  groupTotalsRow:{ flexDirection:'row', flexWrap:'wrap', gap:6 },
  groupChip:{ fontSize:11, fontWeight:'700', paddingHorizontal:8, paddingVertical:4, borderRadius:14 },
  collectedChip:{ backgroundColor:'#EAF7F0', color:'#27AE60', borderWidth:1, borderColor:'#CFE9DA' },
  paidChip:{ backgroundColor:'#FDECEA', color:'#E74C3C', borderWidth:1, borderColor:'#F5C6C3' },
  balancePosChip:{ backgroundColor:'#EAF7F0', color:'#27AE60', borderWidth:1, borderColor:'#CFE9DA' },
  balanceNegChip:{ backgroundColor:'#FDECEA', color:'#E74C3C', borderWidth:1, borderColor:'#F5C6C3' },
  countChip:{ fontSize:11, fontWeight:'700', backgroundColor:'#ECF0F1', color:'#2C3E50', paddingHorizontal:8, paddingVertical:4, borderRadius:14 },
  playsTable:{ paddingHorizontal:10, paddingBottom:10 },
  playsHeaderRow:{ flexDirection:'row', paddingVertical:6, borderTopWidth:1, borderBottomWidth:1, borderColor:'#E1E8E3', backgroundColor:'#F8F9FA', marginTop:6 },
  playsHeaderCell:{ fontSize:11, fontWeight:'800', color:'#2C3E50' },
  playsRow:{ flexDirection:'row', alignItems:'flex-start', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F0F3F4' },
  playsRowAlt:{ backgroundColor:'#FBFCFC' },
  playsCell:{ fontSize:11.5, color:'#2C3E50', paddingRight:6 },
  
  // Estilos para tarjetas compactas
  compactGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  compactGroupCardDark: {
    backgroundColor: '#34495E',
  },
  compactGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  compactGroupChevron: {
    fontSize: 12,
    color: '#27AE60',
    marginRight: 8,
    width: 15,
  },
  compactGroupTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  compactGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2C3E50',
    flex: 1,
  },
  compactGroupTitleDark: {
    color: '#ECF0F1',
  },
  compactResultChip: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#E8F5E8',
    color: '#27AE60',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CFE9DA',
  },
  compactResultChipDark: {
    backgroundColor: '#2C3E50',
    color: '#27AE60',
    borderColor: '#27AE60',
  },
  compactStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactStatChip: {
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: '#F8F9FA',
    color: '#6C757D',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 2,
  },
  compactCollectedChip: {
    backgroundColor: '#EAF7F0',
    color: '#27AE60',
  },
  compactBalancePosChip: {
    backgroundColor: '#EAF7F0',
    color: '#27AE60',
  },
  compactBalanceNegChip: {
    backgroundColor: '#FDECEA',
    color: '#E74C3C',
  },
  
  // Estilos para tabla estilo Excel
  tableContainer: {
    marginTop: 8,
    marginHorizontal: 4,
  },
  excelTable: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  excelHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 2,
    borderBottomColor: '#9CA3AF',
    minHeight: 30, // Reducido de altura por defecto
  },
  excelHeaderCell: {
    padding: 6, // Reducido de 8 a 6
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
    textAlign: 'center',
  },
  excelDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: 32, // Reducido de 36 a 32
  },
  excelRowEven: {
    backgroundColor: '#F9FAFB',
  },
  excelCellContainer: {
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    minHeight: 32, // Reducido de 36 a 32 para que coincida
  },
  excelCell: {
    fontSize: 11,
    color: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'center',
  },
  cellScrollView: {
    flex: 1,
  },
  earningsCell: {
    color: '#27AE60',
    fontWeight: '600',
  },
  positiveBalance: {
    color: '#27AE60',
    fontWeight: '600',
  },
  negativeBalance: {
    color: '#E74C3C',
    fontWeight: '600',
  },
  // Nuevos estilos para la tabla expandible
  chevronCell: {
    color: '#27AE60',
    fontWeight: '700',
    fontSize: 12,
  },
  resultCell: {
    color: '#27AE60',
    fontWeight: '600',
  },
  expandedContent: {
    backgroundColor: '#F8F9FA',
    marginTop: -1, // Superponer ligeramente para eliminar cualquier gap
    paddingTop: 0, // Sin padding superior
    borderTopWidth: 0, // Sin borde superior para que se vea continuo
  },
  subHeader: {
    backgroundColor: '#E9ECEF',
  },
  detailRow: {
    backgroundColor: '#FFFFFF',
  },
  // Estilos para ganancias del listero
  compactEarningsChip: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
    color: '#1976D2',
  },
  
  // Estilos para dropdowns
  dropdownContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dropdownLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  dropdownLabelDark: {
    color: '#ecf0f1',
  },
  dropdown: {
    marginVertical: 8,
  },
  filterSection: {
    marginBottom: 16,
  },
  datePickerContainer: {
    marginVertical: 12,
    width: '100%',
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
});

export default StatisticsScreen;



