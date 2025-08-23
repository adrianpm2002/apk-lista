import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import useStatistics from '../hooks/useStatistics';
import StatisticsChart from '../components/StatisticsChart';
import DataTable from '../components/DataTable';
import DateTimePickerWrapper from '../components/DateTimePickerWrapper';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { getDailyStats, getPlaysDetails, getTotalRecogidoHistorico, getTotalPagadoHistorico } from '../services/listeroStatsService';

const { width: screenWidth } = Dimensions.get('window');

const StatisticsScreen = ({ navigation, isDarkMode = false, onToggleDarkMode, onModeVisibilityChange }) => {
  // Estados para filtros
  const [selectedPeriod, setSelectedPeriod] = useState('last7days');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [lotterySchedules, setLotterySchedules] = useState([]); // horarios de la lotería seleccionada
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState('start');
  
  // Estados para modales
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  
  // Estados para datos
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('charts');
  const [chartHeight, setChartHeight] = useState(240);
  const [dailySeries, setDailySeries] = useState([]);
  // Eliminado: series por horario
  const [detailRows, setDetailRows] = useState([]);
  const [totalHistorico, setTotalHistorico] = useState(0);
  const [totalPagadoHistorico, setTotalPagadoHistorico] = useState(0);
  // Estado de expansión para grupos en Detalles (debe estar a nivel de componente para mantener el orden de hooks)
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  // Búsqueda en detalles
  const [detailsSearchVisible, setDetailsSearchVisible] = useState(false);
  const [detailsSearchQuery, setDetailsSearchQuery] = useState('');

  // Estados para sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);

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
    applyFilters,
    exportToCSV,
    clearData,
  } = useStatistics();

  // Opciones de períodos
  const periodOptions = [
    { label: 'Hoy', value: 'today' },
    { label: 'Ayer', value: 'yesterday' },
    { label: 'Esta semana', value: 'week' },
    { label: 'Este mes', value: 'month' },
    { label: 'Mes pasado', value: 'lastMonth' },
    { label: 'Últimos 7 días', value: 'last7days' },
    { label: 'Últimos 30 días', value: 'last30days' },
    { label: 'Personalizado', value: 'custom' },
  ];

  // Tabs de navegación
  const tabs = [
    { id: 'charts', title: 'Gráficos', icon: '📈' },
    { id: 'details', title: 'Detalles', icon: '📋' },
  ];

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Obtener rol del usuario para la sidebar
  useEffect(() => {
    const fetchUserRole = async () => {
      const { supabase } = await import('../supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (data) {
          setUserRole(data.role);
        }
      }
    };

    fetchUserRole();
  }, []);

  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      applyPeriodFilter(selectedPeriod);
    }
  }, [selectedPeriod, selectedLottery, selectedSchedule]);

  // Cargar horarios de la lotería seleccionada
  useEffect(() => {
    let cancelled = false;
    const loadSchedulesForLottery = async () => {
      try {
        // Resetear selección de horario al cambiar lotería
        setSelectedSchedule('all');
        if (selectedLottery === 'all') {
          setLotterySchedules([]);
          return;
        }
        const { supabase } = await import('../supabaseClient');
        const { data, error } = await supabase
          .from('horario')
          .select('id, nombre')
          .eq('id_loteria', selectedLottery)
          .order('nombre', { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          const mapped = (data || []).map(h => ({ id: String(h.id), name: h.nombre }));
          setLotterySchedules(mapped);
        }
      } catch (e) {
        if (!cancelled) setLotterySchedules([]);
      }
    };
    loadSchedulesForLottery();
    return () => { cancelled = true; };
  }, [selectedLottery]);

  const loadInitialData = async () => {
    try {
      await loadAllStats();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las estadísticas iniciales');
    }
  };

  // Aplicar filtro de período
  const applyPeriodFilter = (period) => {
    const now = new Date();
    let start, end;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        break;
      case 'week':
        const startOfWeek = now.getDate() - now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), startOfWeek);
        end = new Date();
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date();
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        break;
      case 'last7days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        end = new Date();
        break;
      case 'last30days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        end = new Date();
        break;
      default:
        return;
    }

  setStartDate(start);
  setEndDate(end);
  // Si se cambia la lotería a 'all', limpiar horario
  if(selectedLottery === 'all' && selectedSchedule !== 'all') setSelectedSchedule('all');
    
    applyFilters({
      startDate: start,
      endDate: end,
      lotteryId: selectedLottery === 'all' ? null : selectedLottery,
      scheduleId: selectedSchedule === 'all' ? null : selectedSchedule,
    });
    // Cargar nuevas series desde servicio real
    void loadServiceData(start, end);
  };

  // Aplicar filtros personalizados
  const applyCustomFilters = () => {
    if(selectedLottery === 'all' && selectedSchedule !== 'all') setSelectedSchedule('all');
    applyFilters({
      startDate,
      endDate,
      lotteryId: selectedLottery === 'all' ? null : selectedLottery,
      scheduleId: selectedSchedule === 'all' ? null : selectedSchedule,
    });
    void loadServiceData(startDate, endDate);
  // noop: modal eliminado
  };

  // Manejar refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllStats();
      await loadServiceData(startDate, endDate);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron actualizar las estadísticas');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadServiceData = async (start, end) => {
    try{
      const { supabase } = await import('../supabaseClient');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const listeroId = user.id;
      const lotteryId = selectedLottery === 'all' ? null : selectedLottery;
      const scheduleId = selectedSchedule === 'all' ? null : selectedSchedule;
      const isTodayPeriod = selectedPeriod === 'today';
      const includeToday = isTodayPeriod; // solo incluir hoy explícitamente
      const onlyClosedToday = isTodayPeriod; // y solo loterías cerradas
      
      const [daily, details, totalHist, totalPaidHist] = await Promise.all([
        getDailyStats(listeroId, { from:start, to:end, lotteryId, scheduleId, includeToday, onlyClosedToday }),
        getPlaysDetails(listeroId, { from:start, to:end, lotteryId, scheduleId, includeToday, onlyClosedToday }),
        getTotalRecogidoHistorico(listeroId, { excludeToday: true }),
        getTotalPagadoHistorico(listeroId, { excludeToday: true }),
      ]);
  
      setDailySeries(daily);
      setDetailRows(details);
      setTotalHistorico(totalHist);
      setTotalPagadoHistorico(totalPaidHist);
    }catch(e){ /* silencioso */ }
  };

  // Manejar exportación
  const handleExport = async (format) => {
    try {
      setShowExportModal(false);
      let success = false;
      if (format === 'pdf') {
        success = await exportDetailsToPDF();
      } else if (format === 'excel' || format === 'xlsx') {
        success = await exportDetailsToCSV('xlsx');
      } else {
        success = await exportDetailsToCSV('csv');
      }
      if (success) {
        Alert.alert('Éxito', 'Datos exportados correctamente');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron exportar los datos');
    }
  };

  // ===== Export helpers (Web) =====
  const groupDetailsForExport = () => {
    // Reutilizar misma agrupación base que en pantalla
    const dayKeyOf = (ts)=>{ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
    const dayLabelOf = (ts)=>{ const d=new Date(ts); return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); };
    const timeStr = (ts)=> new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
    const inferCollected = (row)=>{
      const mt = row.monto_total;
      if(mt!=null && mt!==undefined) return Number(mt)||0;
      const count = String(row.numeros||'').split(',').map(s=>s.trim()).filter(Boolean).length;
      return (Number(row.monto_unitario)||0)*count;
    };
    const map = new Map();
    for(const r of detailRows){
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
        ts: new Date(r.created_at).getTime(),
        time: timeStr(r.created_at),
        nota: r.nota,
        jugada: r.jugada,
        numeros: r.numeros,
        total: collected,
        pagado: Number(r.pago_calculado||0),
      });
    }
    const groups = Array.from(map.values()).sort((a,b)=> (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));
    groups.forEach(g=> g.plays.sort((a,b)=> b.ts - a.ts));
    return groups;
  };

  const buildCSV = () => {
    const groups = groupDetailsForExport();
    const sep = ',';
    const esc = (v)=> '"' + String(v ?? '').replace(/"/g,'""') + '"';
    const rows = [];
    rows.push(['Fecha','Lotería','Horario','Resultado','Hora','Nota','Jugada','Números','Total','Pagado'].map(esc).join(sep));
    groups.forEach(g=>{
      g.plays.forEach(p=>{
        rows.push([
          g.dayLabel,
          g.lottery,
          g.schedule,
          g.resultado || 'no disponible',
          p.time,
          p.nota || '',
          p.jugada || '',
          p.numeros || '',
          Math.round(p.total),
          p.pagado > 0 ? Math.round(p.pagado) : 'Sin premio',
        ].map(esc).join(sep));
      });
    });
    return rows.join('\n');
  };

  const exportDetailsToCSV = async (kind='csv') => {
    try{
      const content = buildCSV();
      const ext = kind==='xlsx' ? 'xlsx' : 'csv';
      const name = `detalles_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.${ext}`;
      if (typeof document !== 'undefined'){
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = name; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        return true;
      }
      return false;
    }catch(e){ return false; }
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
            <td>${(p.numeros||'').replace(/</g,'&lt;')}</td>
            <td>${Math.round(p.total).toLocaleString('es-DO')}</td>
            <td>${p.pagado>0? Math.round(p.pagado).toLocaleString('es-DO') : 'Sin premio'}</td>
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
      if (typeof window !== 'undefined'){
        const w = window.open('', '_blank');
        if (w){ w.document.open(); w.document.write(html); w.document.close(); w.focus(); w.print(); }
        return true;
      }
      return false;
    }catch(e){ return false; }
  };

  // Manejar selección de fecha
  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      if (datePickerType === 'start') {
        setStartDate(selectedDate);
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  // Renderizar header con filtros y sidebar toggle
  const contentRef = useRef(null);
  const renderHeader = () => (
    <View style={[styles.header, isDarkMode && styles.headerDark]}>
  <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
      
      <View style={styles.headerControls}>
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>
          Estadísticas
        </Text>
        
        <TouchableOpacity
          style={[styles.filterButton, isDarkMode && styles.filterButtonDark]}
          onPress={() => setFiltersVisible(v=>{
            const next = !v; 
            if(next){ setTimeout(()=> contentRef.current?.scrollTo({ y: 0, animated: true }), 0); }
            return next;
          })}
        >
          <Text style={[styles.filterButtonText, isDarkMode && styles.filterButtonTextDark]}>
            🔍 Filtros
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.exportButton, isDarkMode && styles.exportButtonDark]}
          onPress={() => setShowExportModal(true)}
        >
          <Text style={styles.exportButtonText}>📤 Exportar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Renderizar tabs de navegación
  const renderTabs = () => (
    <View style={[styles.tabsContainer, isDarkMode && styles.tabsContainerDark]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {tabs.map(tab => (
          <React.Fragment key={tab.id}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === tab.id && styles.activeTab,
                activeTab === tab.id && isDarkMode && styles.activeTabDark,
              ]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
                isDarkMode && styles.tabTextDark,
              ]}>
                {tab.title}
              </Text>
            </TouchableOpacity>

            {tab.id === 'details' && (
              <View style={styles.detailsTotalsContainer}>
                <View style={styles.detailsTotalsLeftCol}>
                  <View style={[styles.detailsTotalChip, styles.detailsTotalChipNeutral, isDarkMode && styles.detailsTotalChipNeutralDark]}>
                    <Text style={[styles.detailsTotalText, isDarkMode && styles.detailsTotalTextDark]}>
                      Recogido: ${Math.round(totalHistorico).toLocaleString('es-DO')}
                    </Text>
                  </View>
                  <View style={[styles.detailsTotalChip, styles.detailsTotalChipNeutral, isDarkMode && styles.detailsTotalChipNeutralDark]}>
                    <Text style={[styles.detailsTotalText, isDarkMode && styles.detailsTotalTextDark]}>
                      Pagado: ${Math.round(totalPagadoHistorico).toLocaleString('es-DO')}
                    </Text>
                  </View>
                </View>
                {Number.isFinite(totalHistorico) && Number.isFinite(totalPagadoHistorico) && (
                  (()=>{
                    const balance = Math.round((totalHistorico || 0) - (totalPagadoHistorico || 0));
                    const positive = balance >= 0;
                    return (
                      <View style={[
                        styles.detailsTotalChip,
                        positive ? styles.detailsTotalChipBalancePos : styles.detailsTotalChipBalanceNeg,
                        isDarkMode && (positive ? styles.detailsTotalChipBalancePosDark : styles.detailsTotalChipBalanceNegDark),
                      ]}>
                        <Text style={[styles.detailsTotalTextBalance, { color: positive ? '#27AE60' : '#e74c3c' }]}>
                          Balance: ${balance.toLocaleString('es-DO')}
                        </Text>
                      </View>
                    );
                  })()
                )}
              </View>
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );

  // Renderizar contenido del tab de resumen

  // Panel de filtros inline
  const renderInlineFilters = () => {
    const renderChip = (value, current, setter, label) => (
      <TouchableOpacity
        key={`${label}-${value}`}
        style={[
          styles.filterChip,
          isDarkMode && styles.filterChipDark,
          current === value && styles.filterChipActive,
          current === value && isDarkMode && styles.filterChipActiveDark,
        ]}
        onPress={() => setter(value)}
      >
        <Text style={[
          styles.filterChipText,
          isDarkMode && styles.filterChipTextDark,
          current === value && styles.filterChipTextActive,
        ]}>{label}</Text>
      </TouchableOpacity>
    );

    return (
      <View style={[styles.filtersPanel, isDarkMode && styles.filtersPanelDark]}>
        {/* Selector de período (chips) */}
        <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Período</Text>
        <View style={styles.chipsRow}>
          {periodOptions.map(opt => renderChip(opt.value, selectedPeriod, setSelectedPeriod, opt.label))}
        </View>

        {/* Rango personalizado */}
        {selectedPeriod === 'custom' && (
          <View style={styles.dateSectionCompact}>
            <TouchableOpacity
              style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
              onPress={() => { setDatePickerType('start'); setShowDatePicker(true); }}
            >
              <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                Desde: {startDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dateButton, isDarkMode && styles.dateButtonDark]}
              onPress={() => { setDatePickerType('end'); setShowDatePicker(true); }}
            >
              <Text style={[styles.dateButtonText, isDarkMode && styles.dateButtonTextDark]}>
                Hasta: {endDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={applyCustomFilters}>
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Lotería (chips) */}
        <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Lotería</Text>
        <View style={styles.chipsRow}>
          {renderChip('all', selectedLottery, setSelectedLottery, 'Todas')}
          {lotteries.map(l => renderChip(l.id.toString(), selectedLottery, setSelectedLottery, l.name))}
        </View>

        {/* Horario (chips) - solo si hay lotería específica */}
    {selectedLottery !== 'all' && (
          <>
            <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Horario</Text>
            <View style={styles.chipsRow}>
              {renderChip('all', selectedSchedule, setSelectedSchedule, 'Todos')}
      {lotterySchedules.map(h => renderChip(h.id, selectedSchedule, setSelectedSchedule, h.name))}
            </View>
          </>
        )}
      </View>
    );
  };

  // Renderizar contenido del tab de gráficos
  const renderChartsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* KPIs del período (suma) */}
      {dailySeries.length > 0 && (()=>{
        const sum = (arr, key) => arr.reduce((acc, it) => acc + (Number(it[key]) || 0), 0);
        const collected = sum(dailySeries, 'total_recogido');
        const paid = sum(dailySeries, 'total_pagado');
        const net = collected - paid;
        return (
          <View style={{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginHorizontal:8 }}>
            <View style={{ flexBasis:'32%', backgroundColor:'#fff', borderRadius:12, padding:12, marginVertical:6 }}>
              <Text style={{ color:'#6c757d' }}>Recogido (período)</Text>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#27AE60' }}>${Math.round(collected).toLocaleString('es-DO')}</Text>
            </View>
            <View style={{ flexBasis:'32%', backgroundColor:'#fff', borderRadius:12, padding:12, marginVertical:6 }}>
              <Text style={{ color:'#6c757d' }}>Pagado (período)</Text>
              <Text style={{ fontSize:18, fontWeight:'800', color:'#e74c3c' }}>${Math.round(paid).toLocaleString('es-DO')}</Text>
            </View>
            <View style={{ flexBasis:'32%', backgroundColor:'#fff', borderRadius:12, padding:12, marginVertical:6 }}>
              <Text style={{ color:'#6c757d' }}>Balance (período)</Text>
              <Text style={{ fontSize:18, fontWeight:'800', color: net>=0? '#27AE60':'#e74c3c' }}>${Math.round(net).toLocaleString('es-DO')}</Text>
            </View>
          </View>
        );
      })()}

  {/* Profit/Loss: línea base con barras arriba/abajo por día del período */}
      {dailySeries.length > 0 && (()=>{
        const toStr = (dt)=>{
          const y=dt.getFullYear(); const m=String(dt.getMonth()+1).padStart(2,'0'); const d=String(dt.getDate()).padStart(2,'0');
          return `${y}-${m}-${d}`;
        };
        const fmtShort = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        const plMap = new Map(dailySeries.map(x=> [x.day, Number(x.total_recogido) - Number(x.total_pagado)]));
        const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        const days=[]; const cur=new Date(start);
        while(cur<=end){ days.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
        // construir serie diaria completa
        const daily = days.map(d=> ({ date: toStr(d), d, profit: plMap.get(toStr(d)) ?? 0 }));
        // si el rango es pequeño, mantener últimos 7 días máximo
        if(daily.length > 7 && selectedPeriod === 'last7days') {
          const last7 = daily.slice(-7);
          const series = last7.map(x=> ({ date: x.date, profit: x.profit, label: fmtShort(x.d) }));
          return (
            <StatisticsChart
              type="profitLoss"
              title="Ganancias vs Pérdidas (día a día)"
              data={series}
              isDarkMode={isDarkMode}
              height={260}
            />
          );
        }
        // agregar agregación por rangos para no saturar
        const maxBars = 14; // objetivo: ~14 barras
        const bucketSize = Math.max(1, Math.ceil(daily.length / maxBars));
        const buckets = [];
        for(let i=0; i<daily.length; i+=bucketSize){
          const chunk = daily.slice(i, i+bucketSize);
          const profit = chunk.reduce((s, x)=> s + (x.profit||0), 0);
          const first = chunk[0]?.d; const last = chunk[chunk.length-1]?.d || first;
          const label = chunk.length===1 ? fmtShort(first) : `${fmtShort(first)}-${fmtShort(last)}`;
          buckets.push({ profit, label, date: chunk[0]?.date });
        }
        const series = buckets;
        return (
          <StatisticsChart
            type="profitLoss"
            title="Ganancias vs Pérdidas (día a día)"
            data={series}
            isDarkMode={isDarkMode}
            height={260}
          />
        );
      })()}
  {/* Gráfico de barras por lotería */}

  {/* Línea general y otros gráficos omitidos para evitar duplicación */}
    </ScrollView>
  );

  // Renderizar contenido del tab de detalles
  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent}>
      {(()=>{
        if(!detailRows || detailRows.length===0) return (
          <Text style={[styles.empty, { marginTop: 16 }]}>
            Sin jugadas en el período seleccionado
          </Text>
        );

  // Helpers
  const dayKeyOf = (ts)=>{ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); };
  const dayLabelOf = (ts)=>{ const d=new Date(ts); return d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric' }); };
        const timeStr = (ts)=> new Date(ts).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
        const inferCollected = (row)=>{
          const mt = row.monto_total;
          if(mt!=null && mt!==undefined) return Number(mt)||0;
          const count = String(row.numeros||'').split(',').map(s=>s.trim()).filter(Boolean).length;
          return (Number(row.monto_unitario)||0)*count;
        };
        const fmt = (n)=> `$${Math.round(Number(n)||0).toLocaleString('es-DO')}`;

        // Agrupar por día + lotería + horario
        const map = new Map();
        for(const r of detailRows){
          const dayKey = dayKeyOf(r.created_at);
          const dayLabel = dayLabelOf(r.created_at);
          const lot = r.lottery_name || 'Lotería';
          const sch = r.schedule_name || 'Horario';
          const key = `${dayKey}|${lot}|${sch}`;
          if(!map.has(key)) map.set(key, { key, dayKey, dayLabel, lottery: lot, schedule: sch, plays: [], totalRecogido:0, totalPagado:0, resultado: undefined });
          const g = map.get(key);
          const collected = inferCollected(r);
          g.totalRecogido += collected;
          g.totalPagado += Number(r.pago_calculado||0);
          if (!g.resultado && r.resultado) {
            g.resultado = r.resultado;
          }
          g.plays.push({
            time: timeStr(r.created_at),
            ts: new Date(r.created_at).getTime(),
            nota: r.nota,
            jugada: r.jugada,
            numeros: r.numeros,
            total: collected,
            pagado: Number(r.pago_calculado||0),
          });
        }
        let groups = Array.from(map.values())
          // Orden: fecha descendente (más nueva primero), luego lotería y horario asc
          .sort((a,b)=> (b.dayKey - a.dayKey) || a.lottery.localeCompare(b.lottery) || a.schedule.localeCompare(b.schedule));

    // Filtro por búsqueda (solo nota o jugada)
        if (detailsSearchQuery && detailsSearchQuery.trim().length > 0) {
          const q = detailsSearchQuery.trim().toLowerCase();
          groups = groups.map(g => {
            const plays = g.plays.filter(p =>
      (p.nota && String(p.nota).toLowerCase().includes(q)) ||
      (p.jugada && String(p.jugada).toLowerCase().includes(q))
            ).sort((a,b)=> b.ts - a.ts);
            return { ...g, plays, totalRecogido: plays.reduce((s,x)=>s+x.total,0), totalPagado: plays.reduce((s,x)=>s+x.pagado,0) };
          }).filter(g => g.plays.length > 0);
        }

        // Asegurar orden de jugadas dentro de cada grupo cuando no hay filtro
        if (!detailsSearchQuery || detailsSearchQuery.trim().length === 0) {
          groups.forEach(g => { g.plays.sort((a,b)=> b.ts - a.ts); });
        }

  // Usar estado top-level para expandir/colapsar grupos
  const expanded = expandedGroups;
  const toggle = (key)=> setExpandedGroups(prev=>{ const next=new Set(prev); if(next.has(key)) next.delete(key); else next.add(key); return next; });

        return (
          <View style={{ paddingHorizontal:8 }}>
            <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:4, marginBottom: 6 }}>
              {detailsSearchVisible && (
                <TextInput
                  placeholder="Buscar por nota o jugada"
                  placeholderTextColor={isDarkMode ? '#95A5A6' : '#6c757d'}
                  value={detailsSearchQuery}
                  onChangeText={setDetailsSearchQuery}
                  style={{
                    flex: 1,
                    backgroundColor: isDarkMode ? '#2C3E50' : '#FFFFFF',
                    color: isDarkMode ? '#ECF0F1' : '#2C3E50',
                    borderWidth: 1,
                    borderColor: isDarkMode ? '#5D6D7E' : '#E1E8E3',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    marginRight: 8,
                  }}
                />
              )}
              <TouchableOpacity
                style={[styles.filterButton, { paddingVertical:6, paddingHorizontal:12 }]}
                onPress={() => setDetailsSearchVisible(v => !v)}
              >
                <Text style={styles.filterButtonText}>🔎 Buscar</Text>
              </TouchableOpacity>
            </View>
            {groups.map(g=>{
              const open = expanded.has(g.key);
              const balance = Math.round(g.totalRecogido - g.totalPagado);
              return (
                <View key={g.key} style={[styles.groupCard, isDarkMode && styles.groupCardDark]}>
                  <TouchableOpacity style={styles.groupHeader} onPress={()=> toggle(g.key)}>
                    <Text style={styles.groupChevron}>{open? '▼':'▶'}</Text>
                    <View style={{ flex:1 }}>
                      <Text style={[styles.groupTitle, isDarkMode && styles.groupTitleDark]}>
                        {g.dayLabel} · {g.lottery} · {g.schedule}
                        {` · Resultado: ${g.resultado ? g.resultado : 'no disponible'}`}
                      </Text>
                      <View style={styles.groupTotalsRow}>
                        <Text style={styles.countChip}>Jugadas: {g.plays.length}</Text>
                        <Text style={[styles.groupChip, styles.countChip]}>Recogido: {fmt(g.totalRecogido)}</Text>
                        <Text style={[styles.groupChip, styles.countChip]}>Pagado: {fmt(g.totalPagado)}</Text>
                        <Text style={[styles.groupChip, balance>=0? styles.balancePosChip: styles.balanceNegChip]}>Balance: {fmt(balance)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {open && (
                    <View style={styles.playsTable}>
                      <View style={styles.playsHeaderRow}>
                        <Text style={[styles.playsHeaderCell,{flex:0.8}]}>Hora</Text>
                        <Text style={[styles.playsHeaderCell,{flex:1.2}]}>Nota</Text>
                        <Text style={[styles.playsHeaderCell,{flex:1.2}]}>Jugada</Text>
                        <Text style={[styles.playsHeaderCell,{flex:2}]}>Números</Text>
                        <Text style={[styles.playsHeaderCell,{flex:1}]}>Total</Text>
                        <Text style={[styles.playsHeaderCell,{flex:1}]}>Pagado</Text>
                      </View>
                      {g.plays.map((p,idx)=> (
                        <View key={idx} style={[styles.playsRow, idx%2===0? styles.playsRowAlt:null]}>
                          <Text style={[styles.playsCell,{flex:0.8}]}>{p.time}</Text>
                          <Text style={[styles.playsCell,{flex:1.2}]} numberOfLines={1}>{p.nota}</Text>
                          <Text style={[styles.playsCell,{flex:1.2}]} numberOfLines={1}>{p.jugada}</Text>
                          <Text style={[styles.playsCell,{flex:2, flexWrap:'wrap', minWidth:0}]}>{p.numeros}</Text>
                          <Text style={[styles.playsCell,{flex:1}]}>{fmt(p.total)}</Text>
                          <Text style={[styles.playsCell,{flex:1}]}> {p.pagado > 0 ? fmt(p.pagado) : 'Sin premio'}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })()}
    </ScrollView>
  );

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
        <View style={[styles.exportModalContent, isDarkMode && styles.modalContentDark]}>
          <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
            📤 Exportar Datos
          </Text>

          <TouchableOpacity
            style={styles.exportOption}
            onPress={() => handleExport('csv')}
          >
            <Text style={[styles.exportOptionText, isDarkMode && styles.exportOptionTextDark]}>
              📄 Exportar a CSV
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportOption}
            onPress={() => handleExport('excel')}
          >
            <Text style={[styles.exportOptionText, isDarkMode && styles.exportOptionTextDark]}>
              📊 Exportar a Excel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportOption}
            onPress={() => handleExport('pdf')}
          >
            <Text style={[styles.exportOptionText, isDarkMode && styles.exportOptionTextDark]}>
              🖨️ Exportar a PDF
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark]}
            onPress={() => setShowExportModal(false)}
          >
            <Text style={[styles.cancelButtonText, isDarkMode && styles.cancelButtonTextDark]}>
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
      <View style={[styles.errorContainer, isDarkMode && styles.errorContainerDark]}>
        <Text style={[styles.errorText, isDarkMode && styles.errorTextDark]}>
          ❌ Error al cargar estadísticas
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
          <Text style={styles.retryButtonText}>🔄 Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {renderHeader()}
      {renderTabs()}
      
      <ScrollView
        ref={contentRef}
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#27AE60']}
            tintColor="#27AE60"
          />
        }
      >
        {filtersVisible && renderInlineFilters()}
        {renderActiveTabContent()}
      </ScrollView>

  {/* Modal de exportación */}
  {renderExportModal()}

      {/* DatePicker */}
      {showDatePicker && (
        <DateTimePickerWrapper
          value={datePickerType === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onModeVisibilityChange={onModeVisibilityChange}
        role={userRole}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  filtersPanel:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#E1E8E3', borderRadius:10, padding:8, margin:8 },
  filtersPanelDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 100,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
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
    marginTop: 100,
  },
  tabsContainerDark: {
    backgroundColor: '#2c3e50',
    borderBottomColor: '#34495e',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    fontSize: 20,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
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
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
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
});

export default StatisticsScreen;
