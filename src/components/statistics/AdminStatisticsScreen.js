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
import useAdminStatistics from '../../hooks/useAdminStatistics';
import { supabase } from '../../supabaseClient';
import StatisticsChart from '../../components/StatisticsChart';
import SideBarWrapper, { SideBarToggle } from '../../components/SideBarWrapper';
import ScreenWrapper from '../../components/ScreenWrapper';
import { createShadowStyle } from '../../utils/shadowUtils';

// Importación condicional para exportación PDF
let exportPdfModule;
try {
  if (Platform.OS === 'web') {
    exportPdfModule = require('../../utils/pdfExport.web');
  } else {
    exportPdfModule = require('../../utils/pdfExport.native');
  }
} catch (error) {
  exportPdfModule = null;
}

const { width: screenWidth } = Dimensions.get('window');

// Helper function para color coding de balances
const getBalanceTextStyle = (balance, baseStyle) => {
  const balanceValue = Number(balance) || 0;
  const color = balanceValue >= 0 ? '#2E7D32' : '#D32F2F';
  return [baseStyle, { color }];
};

const AdminStatisticsScreen = ({ navigation, onModeVisibilityChange }) => {
  return (
    <ScreenWrapper>
      <AdminStatisticsContent
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
      />
    </ScreenWrapper>
  );
};

const AdminStatisticsContent = ({ navigation, onModeVisibilityChange }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('charts');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id_banco')
        .eq('id', userId)
        .single();

      if (profile?.id_banco) {
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

  // Hook de estadísticas para admin
  const {
    kpiData,
    chartData,
    tableData,
    lotteries,
    schedules,
    loading,
    error,
    loadAllStats,
    applyFilters,
  } = useAdminStatistics();

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
    loadAllStats();
  }, []);

  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      applyPeriodFilter(selectedPeriod);
    }
  }, [selectedPeriod]);

  const loadInitialData = async () => {
    try {
      await loadAllStats();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las estadísticas iniciales');
    }
  };

  const applyPeriodFilter = (period) => {
    const filterParams = {
      period: period
    };
    
    setSelectedPeriod(period);
    applyFilters(filterParams);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
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
        <h2>Detalles de Jugadas - Banco</h2>
        ${sections}
      </body></html>`;
      
      if (!exportPdfModule || !exportPdfModule.exportPdf) {
        throw new Error('Módulo de exportación no disponible');
      }
      
      const ok = await exportPdfModule.exportPdf(html);
      return !!ok;
    }catch(e){ 
      return false; 
    }
  };

  const groupDetailsForExport = () => {
    if (!tableData || !Array.isArray(tableData)) {
      return [];
    }
    
    if (tableData.length === 0) {
      return [];
    }

    // Extraer todas las jugadas de la estructura jerárquica de admin
    let allPlays = [];
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

    const dayKeyOf = (ts)=>{ 
      const d=new Date(ts); 
      if (isNaN(d.getTime())) return 0;
      d.setHours(0,0,0,0); 
      return d.getTime(); 
    };
    const dayLabelOf = (ts)=>{ 
      const d=new Date(ts); 
      if (isNaN(d.getTime())) return 'Fecha inválida';
      return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); 
    };
    const timeStr = (ts)=> {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return 'Hora inválida';
      return d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit', hour12: true});
    };

    const map = new Map();
    const validRecords = allPlays.filter(r => r.fecha_jugada);
    
    for(const r of validRecords){
      const dayKey = dayKeyOf(r.fecha_jugada);
      const dayLabel = dayLabelOf(r.fecha_jugada);
      const lot = r.loteria || 'Lotería';
      const sch = r.horario || 'Horario';
      const key = `${dayKey}|${lot}|${sch}`;
      if(!map.has(key)) map.set(key, { key, dayKey, dayLabel, lottery: lot, schedule: sch, plays: [], totalRecogido:0, totalPagado:0, resultado: r.resultado || null });
      const g = map.get(key);
      const collected = Number(r.monto_total || 0);
      g.totalRecogido += collected;
      g.totalPagado += Number(r.monto_a_pagar||0);
      if (!g.resultado && r.resultado) g.resultado = r.resultado;
      g.plays.push({
        ts: (() => {
          const d = new Date(r.fecha_jugada);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        })(),
        time: timeStr(r.fecha_jugada),
        nota: r.nota || '',
        jugada: r.tipo_jugada || '',
        numeros: r.numeros_jugados || '',
        bruto: collected,
        pagado: Number(r.monto_a_pagar||0),
      });
    }
    const groups = Array.from(map.values()).sort((a,b)=> (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));
    groups.forEach(g=> g.plays.sort((a,b)=> b.ts - a.ts));
    
    return groups;
  };

  // Renderizar header
  const renderHeader = () => (
    <View style={styles.header}>
      <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
      
      <View style={styles.headerControls}>
        <Text style={styles.headerTitle}>Estadísticas Banco</Text>
        
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() => setShowExportModal(true)}
        >
          <Text style={styles.exportButtonText}>📤 Exportar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizar tabs
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <View style={styles.tabsRowContainer}>
        <View style={styles.tabsLeftSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && styles.activeTab,
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[
                  styles.tabText,
                  activeTab === tab.id && styles.activeTabText,
                ]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.tabsRightSection}>
          {renderCompactFilters()}
        </View>
      </View>
    </View>
  );

  // Filtros compactos
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

    return (
      <View style={styles.inlineFiltersWrapper}>
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

        <View style={styles.inlineFiltersRow}>
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
        </View>
      </View>
    );
  };

  // Función para navegar al registro de jugadas
  const navigateToPlaysRecord = (groupData) => {
    try {
      const playsRecordParams = {
        readOnlyMode: true,
        groupData: {
          fecha: groupData.dayLabel,
          loteria: groupData.lottery,
          horario: groupData.schedule,
          resultado: groupData.resultado,
          jugadas: (groupData.plays || []).map(play => ({
            ts: play.ts || Date.now(),
            time: play.time || '',
            nota: play.nota || '',
            jugada: play.jugada || play.tipo_jugada || '',
            numeros: play.numeros || play.numeros_jugados || '',
            bruto: Number(play.bruto || play.monto_total || 0),
            ganancia: Number(play.ganancia_colector || 0),
            pagado: Number(play.pagado || play.monto_a_pagar || 0),
            balance: Number(play.balance_colector || 0)
          }))
        },
        title: `${groupData.dayLabel} - ${groupData.lottery} - ${groupData.schedule}`
      };
      
      navigation.navigate('Jugadas', playsRecordParams);
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir el registro de jugadas');
    }
  };

  // Renderizar contenido del tab de gráficos
  const renderChartsTab = () => {
    let allPlays = [];
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
        {allPlays && allPlays.length > 0 && (()=>{
          const fmtShort = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
          
          const dailyBalanceMap = new Map();
          
          allPlays.forEach(play => {
            if (!play.fecha_jugada) {
              return;
            }
            
            const playDate = new Date(play.fecha_jugada);
            if (isNaN(playDate.getTime())) {
              return;
            }
            
            const year = playDate.getFullYear();
            const month = String(playDate.getMonth() + 1).padStart(2, '0');
            const day = String(playDate.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            
            if (!dailyBalanceMap.has(dateKey)) {
              dailyBalanceMap.set(dateKey, {
                date: dateKey,
                d: new Date(playDate.getFullYear(), playDate.getMonth(), playDate.getDate()),
                bruto: 0,
                pagado: 0,
                ganancia: 0,
                balance: 0
              });
            }
            
            const dayData = dailyBalanceMap.get(dateKey);
            dayData.bruto += Number(play.monto_total || 0);
            dayData.pagado += Number(play.monto_a_pagar || 0);
            dayData.ganancia += Number(play.ganancia_colector || 0);
            dayData.balance += Number(play.balance_colector || 0);
          });
          
          const dailyData = Array.from(dailyBalanceMap.values())
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          
          let displayData = dailyData;
          let labelFormat = fmtShort;
          
          if (dailyData.length > 30) {
            const weeklyMap = new Map();
            dailyData.forEach(day => {
              const date = new Date(day.date);
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
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
            displayData = dailyData.slice(-14);
          }
          
          const series = displayData.map(day => ({
            date: day.date,
            profit: day.balance,
            label: labelFormat(day.d)
          }));
          
          return (
            <View>
              <StatisticsChart
                type="profitLoss"
                title="Balance Diario del Banco"
                data={series}
                height={260}
              />
              {(() => {
                const playsInPeriod = allPlays || [];
                
                const totalBruto = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_total) || 0), 0);
                const totalPagado = playsInPeriod.reduce((sum, play) => sum + (Number(play.monto_a_pagar) || 0), 0);
                const totalGanancia = playsInPeriod.reduce((sum, play) => sum + (Number(play.ganancia_colector) || 0), 0);
                const totalBalance = playsInPeriod.reduce((sum, play) => sum + (Number(play.balance_colector) || 0), 0);
                
                return (
                  <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginHorizontal:8, marginTop:16 }}>
                    <View style={{ flexBasis:'24%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                      <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Bruto')}</Text>
                      <Text style={{ fontSize:16, fontWeight:'800', color:'#27AE60' }}>{formatSantiagoMoney(totalBruto)}</Text>
                    </View>
                    <View style={{ flexBasis:'24%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                      <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Ganancia')}</Text>
                      <Text style={{ fontSize:16, fontWeight:'800', color:'#f39c12' }}>{formatSantiagoMoney(totalGanancia)}</Text>
                    </View>
                    <View style={{ flexBasis:'24%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                      <Text style={{ color: '#6c757d', fontSize: 12 }}>Premios</Text>
                      <Text style={{ fontSize:16, fontWeight:'800', color:'#e74c3c' }}>{formatMoney(totalPagado)}</Text>
                    </View>
                    <View style={{ flexBasis:'24%', backgroundColor: '#fff', borderRadius:12, padding:12, marginVertical:6 }}>
                      <Text style={{ color: '#6c757d', fontSize: 12 }}>{getSantiagoHeader('Balance')}</Text>
                      <Text style={{ fontSize:16, fontWeight:'800', color: getSantiagoValue(totalBalance)>=0? '#27AE60':'#e74c3c' }}>{formatSantiagoMoney(totalBalance)}</Text>
                    </View>
                  </View>
                );
              })()}
            </View>
          );
        })()}
        
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

  // Renderizar contenido del tab de detalles
  const renderDetailsTab = () => (
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
      {renderAdminExpandableTable()}
    </ScrollView>
  );

  // Tabla expandible para admin
  const renderAdminExpandableTable = () => {
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
                  
                  {openColector && (
                    <View style={styles.expandedContent}>
                      <View style={[styles.excelHeaderRow, styles.subHeader]}>
                        <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>Listero</Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>{getSantiagoHeader('Bruto')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Gan. Listero')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 100 }]}>Premios</Text>
                        <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Bal. Listero')}</Text>
                        <Text style={[styles.excelHeaderCell, { width: 110 }]}>{getSantiagoHeader('Bal. Colector')}</Text>
                      </View>
                      
                      {(colector.listeros || []).map((listero, listeroIndex) => {
                        const listeroKey = `${colectorKey}_listero_${listero.id}`;
                        const openListero = expanded.has(listeroKey);
                        
                        return (
                          <View key={listeroKey}>
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

  // Tabla de jugadas agrupadas
  const renderGroupedPlaysTable = (plays) => {
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
    
    const fmt = (n) => {
      const num = Number(n) || 0;
      return `$${num.toLocaleString('es-DO', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    };

    const map = new Map();
    const validPlays = plays.filter(r => r.fecha_jugada || r.created_at);
    
    for(const r of validPlays) {
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
          totalGananciaListero: 0,
          totalGananciaColector: 0,
          totalRecogido: 0,
          totalBalanceListero: 0,
          totalBalanceColector: 0,
          totalPagado: 0
        });
      }
      
      const group = map.get(key);
      
      group.totalGananciaListero += Number(r.ganancia_listero || 0);
      group.totalGananciaColector += Number(r.ganancia_colector || 0);
      group.totalBalanceListero += Number(r.balance_listero || 0);
      group.totalBalanceColector += Number(r.balance_colector || 0);
      group.totalRecogido += Number(r.monto_total || 0);
      group.totalPagado += Number(r.monto_a_pagar || 0);
    }
    
    let groups = Array.from(map.values())
      .sort((a,b) => (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));

    const expanded = expandedGroups;

    return (
      <View style={{ paddingHorizontal:4, marginTop: 2 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableContainer}>
          <View style={styles.excelTable}>
            <View style={styles.excelHeaderRow}>
              <Text style={[styles.excelHeaderCell, { width: 30 }]}></Text>
              <Text style={[styles.excelHeaderCell, { width: 70 }]}>Fecha</Text>
              <Text style={[styles.excelHeaderCell, { width: 70 }]}>Lotería</Text>
              <Text style={[styles.excelHeaderCell, { width: 70 }]}>Horario</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>Resultado</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bruto')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Gan. Listero')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Gan. Colector')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>Premio</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bal. Listero')}</Text>
              <Text style={[styles.excelHeaderCell, { width: 80 }]}>{getSantiagoHeader('Bal. Colector')}</Text>
            </View>
            
            {groups.map((g, groupIndex) => (
              <TouchableOpacity 
                key={g.key}
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
                <View style={[styles.excelCellContainer, { width: 80 }]}>
                  <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalGananciaListero || 0)}</Text>
                </View>
                <View style={[styles.excelCellContainer, { width: 80 }]}>
                  <Text style={styles.excelCell} numberOfLines={1}>{formatSantiagoMoney(g.totalGananciaColector || 0)}</Text>
                </View>
                <View style={[styles.excelCellContainer, { width: 80 }]}>
                  <Text style={styles.excelCell} numberOfLines={1}>{fmt(g.totalPagado)}</Text>
                </View>
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
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // Modal de exportación
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
        role="admin"
      />
    </View>
  );
};

// Reutilizar los mismos estilos del archivo original
const styles = StyleSheet.create({
  // ... (copiar todos los estilos del archivo original StatisticsScreen.js)
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginRight: 16,
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
  exportButton: {
    backgroundColor: '#27AE60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
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
    flexGrow: 1,
  },
  inlineFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  inlineFilterChipSmall: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: 2,
    marginBottom: 1,
    minWidth: 36,
  },
  inlineFilterChipActive: {
    backgroundColor: '#27AE60',
    borderColor: '#27AE60',
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
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 11,
    color: '#6c757d',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#27AE60',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
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
  cancelButton: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cancelButtonText: {
    color: '#6c757d',
    textAlign: 'center',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
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
    minHeight: 30,
  },
  excelHeaderCell: {
    padding: 6,
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
    minHeight: 32,
  },
  excelRowEven: {
    backgroundColor: '#F9FAFB',
  },
  excelCellContainer: {
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    justifyContent: 'center',
    minHeight: 32,
  },
  excelCell: {
    fontSize: 11,
    color: '#374151',
    paddingHorizontal: 6,
    paddingVertical: 4,
    textAlign: 'center',
  },
  chevronCell: {
    color: '#27AE60',
    fontWeight: '700',
    fontSize: 12,
  },
  expandedContent: {
    backgroundColor: '#F8F9FA',
    marginTop: -1,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  subHeader: {
    backgroundColor: '#E9ECEF',
  },
  detailRow: {
    backgroundColor: '#FFFFFF',
  },
  empty: {
    textAlign: 'center',
    color: '#6c757d',
    fontStyle: 'italic',
    padding: 20,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
});

export default AdminStatisticsScreen;