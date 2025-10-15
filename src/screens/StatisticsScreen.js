import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import useStatistics from '../hooks/useStatistics';
import { supabase } from '../supabaseClient';
import StatisticsChart from '../components/StatisticsChart';
import SideBarWrapper, { SideBarToggle } from '../components/SideBarWrapper';
import ScreenWrapper from '../components/ScreenWrapper';
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
  // Estado local para usuario (listeros y colectores)
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // Para listeros y colectores - estadísticas simplificadas
  
  // Cargar bankId del usuario y perfil completo (consolidado)
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return;
        }
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (error || !profile) {
          return;
        }
        
        if (profile.role !== 'listero' && profile.role !== 'colector' && profile.role !== 'collector' && profile.role !== 'admin') {
          return;
        }
        
        setCurrentUserId(user.id);
        
      } catch (e) {
      }
    };
    
    loadUserProfile();
  }, []);
  
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [lotterySchedules, setLotterySchedules] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('charts');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [groupedData, setGroupedData] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  
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

  // Hook de estadísticas
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
    // Nuevas propiedades para colectores
    userRole,
  } = useStatistics();

  // Opciones de períodos
  const periodOptions = [
    { label: 'Hoy', value: 'today' },
    { label: 'Ayer', value: 'yesterday' },
    { label: 'Mes pasado', value: 'lastMonth' },
    { label: 'Últimos 7 días', value: 'last7days' },
  { label: 'Este mes', value: 'last30days' },
  ];

  // Tabs de navegación
  const tabs = [
    { id: 'charts', title: 'Gráficos', icon: '📈' },
    { id: 'details', title: 'Detalles', icon: '📋' },
  ];

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
    loadModoSantiago();
    applyPeriodFilter('today');
  }, []);

  useEffect(() => {
    if (currentUserId) {
      applyPeriodFilter(selectedPeriod);
    }
  }, [currentUserId]);

  // ✅ Verificación de userId disponible (solo para logging/debug)
  useEffect(() => {
    if (currentUserId && userRole === 'listero') {
      console.log('[StatisticsScreen] 👤 UserId disponible, caché se cargará bajo demanda');
    }
  }, [currentUserId, userRole]);

  useEffect(() => {
    if (userRole && (userRole === 'collector' || userRole === 'colector' || userRole === 'admin')) {
      loadAllStats();
    }
  }, [userRole]);

  // ELIMINADO: Monitor de userRole innecesario que solo tenía un console.log comentado
  // useEffect(() => {
  //   if (userRole) {
  //     // console.log('🔄 [StatisticsScreen] UserRole changed to:', userRole, '(for sidebar)');
  //   }
  // }, [userRole]);

  useEffect(() => {
    if (userRole === 'admin' && tableData && tableData.plays) {
      setGroupedData(tableData.plays);
    }
  }, [userRole, tableData]);

  useEffect(() => {
    if (selectedPeriod !== 'custom' && currentUserId) {
      applyPeriodFilter(selectedPeriod);
    }
  }, [selectedPeriod, selectedLottery, selectedSchedule]);

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

  const applyPeriodFilter = (period) => {
    // Verificar que userId esté disponible antes de filtrar
    if (!currentUserId) {
      console.log('[StatisticsScreen] ⏸️ applyPeriodFilter: No hay userId, saltando...');
      return;
    }

    const filterParams = {
      period: period
    };
    
    setSelectedPeriod(period);
    applyFilters(filterParams);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Reaplicar el período actual para recalcular start/end y sincronizar filtros
      await applyPeriodFilter(selectedPeriod);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron actualizar las estadísticas');
    } finally {
      setRefreshing(false);
    }
  }, [selectedPeriod]);

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
      { label: 'Este mes', value: 'last30days' },
      { label: 'Mes pasado', value: 'lastMonth' },
    ];

    // Preparar opciones de lotería (sin "Todas")
    const lotteryOptions = (lotteries || []).map(lot => ({ label: lot.nombre, value: lot.id }));

    // Preparar opciones de horario (sin "Todos")
    const scheduleOptions = (lotterySchedules || []).map(sch => ({ label: sch.nombre, value: sch.id }));

    return (
      <View style={styles.inlineFiltersWrapper}>
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
          setter(value);
          applyPeriodFilter(value);
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
  { label: 'Este mes', value: 'last30days' },
      { label: 'Mes pasado', value: 'lastMonth' },
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
      'lastMonth': 'Ganancias vs Pérdidas (Mes pasado)',
      'last7days': 'Ganancias vs Pérdidas (Últimos 7 días)',
      'last30days': 'Ganancias vs Pérdidas (Últimos 30 días)',
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
        
        // Agrupar jugadas por fecha y calcular balance diario
        const dailyBalanceMap = new Map();
        
        tableData.plays.forEach(play => {
          // Validar que created_at exista y sea una fecha válida
          if (!play.created_at) {
            return; // Saltar esta jugada si no tiene fecha
          }
          
          const playDate = new Date(play.created_at);
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
          dayData.bruto += Number(play.bruto || 0);
          dayData.pagado += Number(play.premio || 0);
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
              // Calcular totales del período desde tableData.plays (datos reales)
              const playsInPeriod = tableData?.plays || [];
              
              const totalBruto = playsInPeriod.reduce((sum, play) => sum + (Number(play.bruto) || 0), 0);
              const totalGananciaListero = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_listero) || 0), 0);
              const totalPagado = playsInPeriod.reduce((sum, play) => sum + (Number(play.premio) || 0), 0);
              const totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_listero) || 0), 0); // Usar balance_listero real
              
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
        
        {/* Gráfico de Balance basado en datos reales por día */}
        {allPlays && allPlays.length > 0 && (()=>{
          const fmtShort = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
          
          // Agrupar jugadas por fecha y calcular balance diario
          const dailyBalanceMap = new Map();
          
          allPlays.forEach(play => {
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
          
          // Para un solo día, asegurar que el gráfico tenga contexto
          if (series.length === 1) {
            // Agregar contexto al gráfico para un solo punto
          }
          
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
                // Calcular totales del período desde allPlays (datos reales)
                const playsInPeriod = allPlays || [];
                
                const totalBruto = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
                const totalPagado = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
                
                let totalGanancia = 0;
                let totalBalance = 0;
                
                if (userRole === 'collector' || userRole === 'colector') {
                  totalGanancia = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
                  totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
                } else if (userRole === 'admin') {
                  totalGanancia = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
                  totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
                }
                
                return (
                  <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginHorizontal:8, marginTop:16 }}>
                    <View style={{ flexBasis:'31%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                      <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Bruto')}</Text>
                      <Text style={{ fontSize:16, fontWeight:'800', color:'#27AE60' }}>{formatSantiagoMoney(totalBruto)}</Text>
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
                );
              })()}
            </View>
          );
        })()}
        
        {/* Mensaje cuando no hay datos */}
        {(!allPlays || allPlays.length === 0) && (
          <View style={[styles.kpiCard, { backgroundColor: '#f8f9fa' }]}>
            <Text style={[styles.kpiTitle, { color: '#333333' }]}>
              📊 Sin Datos
            </Text>
            <Text style={[styles.kpiValue, { color: '#666666' }]}>
              No hay datos para mostrar en el período seleccionado
            </Text>
          </View>
        )}
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
              const d = new Date(play.created_at || Date.now());
              return isNaN(d.getTime()) ? Date.now() : d.getTime();
            })(),
            time: play.time || (() => {
              const d = new Date(play.created_at || Date.now());
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

        // Agrupar por fecha + lotería + horario + resultado
        const map = new Map();
        
        // Filtrar registros con fechas válidas antes de procesarlos
        const validPlays = tableData.plays.filter(r => r.created_at);
        
        for(const r of validPlays) {
          const dayKey = dayKeyOf(r.created_at);
          const dayLabel = dayLabelOf(r.created_at);
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
              totalBalance: 0,          // Suma de balance_listero
              totalPagado: 0            // Suma de premios pagados
            });
          }
          
          const group = map.get(key);
          
          // Acumular totales
          group.totalGananciaListero += Number(r.ganancia_listero || 0);
          group.totalRecogido += Number(r.bruto || 0);
          group.totalBalance += Number(r.balance_listero || 0);
          group.totalPagado += Number(r.premio || 0);
          
          // Agregar jugada individual
          group.plays.push({
            time: timeStr(r.created_at),
            ts: (() => {
              const d = new Date(r.created_at);
              return isNaN(d.getTime()) ? 0 : d.getTime();
            })(),
            nota: r.nota || '',
            jugada: r.play_type || '',
            numeros: r.numeros || r.numeros_jugados || '',
            bruto: Number(r.bruto || 0),
            ganancia: Number(r.ganancia_listero || 0),
            pagado: Number(r.premio || 0),
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
    const collectorData = tableData?.plays || [];
    
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
    const adminData = tableData?.plays || [];
    
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
      
      <View style={styles.content}>
        {renderActiveTabContent()}
      </View>

      {renderExportModal()}

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
});

export default StatisticsScreen;

