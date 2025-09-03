/*
 * ListeroStatisticsScreen.js
 * 
 * Pantalla de estadísticas para usuarios listero.
 * Implementa filtrado por banco - solo muestra loterías y horarios del banco del usuario.
 * 
 * Características:
 * - Carga automática de loterías del banco desde Supabase
 * - Filtros dinámicos por lotería y horario
 * - Datos mock filtrados por loterías disponibles en el banco
 * - Estados de carga y mensajes informativos cuando no hay datos
 * - Exportación a CSV y PDF
 * 
 * TODO: Reemplazar datos mock con consultas reales a Supabase para obtener jugadas del banco
 */

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import StatisticsChart from '../components/StatisticsChart';
import GroupedAccordionTable from '../components/GroupedAccordionTable';
import DropdownPicker from '../components/DropdownPicker';
import { supabase } from '../supabaseClient';
import { last7DaysSummary, groupByLottery, groupBySchedule, quickKPIs, mockPlays, exportCSV, exportPDF } from '../utils/statisticsUtils';

const { width: screenWidth } = Dimensions.get('window');

export default function ListeroStatisticsScreen({ isDarkMode=false }){
  const [range, setRange] = useState('last7'); // 'last7' | 'last30' | 'custom'
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [chartHeight, setChartHeight] = useState(240);

  // Estados para datos reales
  const [bankId, setBankId] = useState(null);
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [realPlays, setRealPlays] = useState([]);
  const [loading, setLoading] = useState(true);

    // Datos base usando currentPlays filtrados
  const series7 = useMemo(() => {
    if (currentPlays.length === 0) return [];
    const byDay = new Map();
    currentPlays.forEach(p => {
      if (!byDay.has(p.date)) byDay.set(p.date, { date: p.date, collected: 0, paid: 0, net: 0 });
      const d = byDay.get(p.date);
      d.collected += Number(p.collected || 0);
      d.paid += Number(p.paid || 0);
      d.net = d.collected - d.paid;
    });
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [currentPlays]);

  const groupedByLottery = useMemo(() => {
    if (currentPlays.length === 0) return [];
    const groups = new Map();
    currentPlays.forEach(p => {
      if (!groups.has(p.lottery)) groups.set(p.lottery, { id: p.lottery, title: p.lottery, rows: [] });
      groups.get(p.lottery).rows.push(p);
    });
    return Array.from(groups.values());
  }, [currentPlays]);

  const groupedBySchedule = useMemo(() => {
    if (currentPlays.length === 0) return [];
    const groups = new Map();
    currentPlays.forEach(p => {
      if (!groups.has(p.schedule)) groups.set(p.schedule, { id: p.schedule, title: p.schedule, rows: [] });
      groups.get(p.schedule).rows.push(p);
    });
    return Array.from(groups.values());
  }, [currentPlays]);

  const kpis = useMemo(() => {
    if (currentPlays.length === 0) return { collected: 0, paid: 0, net: 0 };
    const collected = currentPlays.reduce((s, p) => s + (p.collected || 0), 0);
    const paid = currentPlays.reduce((s, p) => s + (p.paid || 0), 0);
    const net = collected - paid;
    return { collected, paid, net };
  }, [currentPlays]);

  // Cargar bankId del usuario
  useEffect(() => {
    const loadBankId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: profile } = await supabase.from('profiles').select('role,id_banco').eq('id', user.id).single();
        if (!profile) return;
        
        const bId = profile.role === 'admin' ? user.id : profile.id_banco;
        setBankId(bId);
      } catch (e) {
        console.error('Error loading bankId:', e);
      }
    };
    loadBankId();
  }, []);

  // Cargar loterías y horarios del banco
  useEffect(() => {
    if (!bankId) return;
    
    const loadLotteriesAndSchedules = async () => {
      try {
        console.log('🎰 [ListeroStats] Cargando loterías para bankId:', bankId);
        
        // Cargar loterías del banco
        const { data: lotteryData } = await supabase
          .from('loteria')
          .select('id,nombre')
          .eq('id_banco', bankId)
          .order('nombre');
        
        console.log('📋 [ListeroStats] Loterías cargadas:', lotteryData);
        
        if (lotteryData) {
          const lotteryOptions = [
            { label: 'Todas las loterías', value: 'all' },
            ...lotteryData.map(l => ({ label: l.nombre, value: l.nombre })) // Usar nombre en lugar de ID
          ];
          console.log('🎯 [ListeroStats] Opciones de lotería generadas:', lotteryOptions);
          setLotteries(lotteryOptions);
        }

        // Cargar horarios únicos de las loterías del banco
        const { data: scheduleData } = await supabase
          .from('horario')
          .select('id,nombre')
          .in('id_loteria', lotteryData?.map(l => l.id) || [])
          .order('nombre');
        
        console.log('⏰ [ListeroStats] Horarios cargados:', scheduleData);
        
        if (scheduleData) {
          const scheduleOptions = [
            { label: 'Todos los horarios', value: 'all' },
            ...scheduleData.map(s => ({ label: s.nombre, value: s.nombre })) // Usar nombre en lugar de ID
          ];
          console.log('🕐 [ListeroStats] Opciones de horario generadas:', scheduleOptions);
          setSchedules(scheduleOptions);
        }

        setLoading(false);
        console.log('✅ [ListeroStats] Carga completada');
      } catch (e) {
        console.error('❌ [ListeroStats] Error loading lotteries and schedules:', e);
        setLoading(false);
      }
    };
    
    loadLotteriesAndSchedules();
  }, [bankId]);

  // Generar datos mock dinámicos basados en las loterías del banco
  const generateMockDataForBank = useMemo(() => {
    console.log('🎲 [ListeroStats] Generando datos mock. Loading:', loading, 'Lotteries length:', lotteries.length);
    console.log('🎲 [ListeroStats] Lotteries disponibles:', lotteries);
    
    if (loading || lotteries.length <= 1) {
      console.log('⏳ [ListeroStats] No se pueden generar datos - loading o sin loterías');
      return [];
    }
    
    const bankLotteries = lotteries.filter(l => l.value !== 'all');
    console.log('🎯 [ListeroStats] Loterías del banco para mock:', bankLotteries);
    
    const scheduleNames = ['Matutino', 'Vespertino', 'Nocturno'];
    const mockData = [];
    let id = 1;
    
    // Generar jugadas para cada lotería del banco
    bankLotteries.forEach(lottery => {
      console.log('🎰 [ListeroStats] Generando datos para lotería:', lottery.label);
      scheduleNames.forEach(schedule => {
        // Generar 2-3 jugadas por combinación lotería-horario
        for (let i = 0; i < Math.floor(Math.random() * 2) + 2; i++) {
          const dayOffset = Math.floor(Math.random() * 7); // Últimos 7 días
          const date = new Date();
          date.setDate(date.getDate() - dayOffset);
          const dateStr = date.toISOString().split('T')[0];
          
          const numbers = Array.from({length: Math.floor(Math.random() * 3) + 1}, () => 
            String(Math.floor(Math.random() * 100)).padStart(2, '0')
          ).join(',');
          
          const amount = (Math.floor(Math.random() * 10) + 1) * 50; // 50-500
          const collected = amount * (Math.random() * 2 + 1); // 1x-3x del monto
          const paid = Math.random() > 0.8 ? collected * (Math.random() * 3 + 1) : 0; // 20% chance de ganar
          const result = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
          
          mockData.push({
            id: id++,
            date: dateStr,
            lottery: lottery.label, // Usar el nombre real de la lotería
            schedule,
            numbers,
            amount,
            paid,
            collected,
            result,
            note: paid > 0 ? 'Ganador' : ''
          });
        }
      });
    });
    
    const sortedData = mockData.sort((a, b) => b.date.localeCompare(a.date)); // Más recientes primero
    console.log('📊 [ListeroStats] Datos mock generados:', sortedData.length, 'jugadas');
    console.log('📋 [ListeroStats] Loterías en datos mock:', [...new Set(sortedData.map(d => d.lottery))]);
    return sortedData;
  }, [lotteries, loading]);

  // Usar datos mock generados dinámicamente en lugar de datos hardcodeados
  const currentPlays = useMemo(() => {
    console.log('🎮 [ListeroStats] Calculando currentPlays. Loading:', loading, 'Lotteries length:', lotteries.length);
    if (loading || lotteries.length === 0) {
      console.log('⏳ [ListeroStats] currentPlays vacío - loading o sin loterías');
      return [];
    }
    console.log('✅ [ListeroStats] currentPlays usando datos generados:', generateMockDataForBank.length, 'jugadas');
    return generateMockDataForBank;
  }, [loading, lotteries, generateMockDataForBank]);

  // Validar que los dropdowns solo muestren opciones si hay datos válidos
  const validLotteryOptions = useMemo(() => {
    console.log('🎯 [ListeroStats] Validando opciones de lotería. Loading:', loading, 'Lotteries:', lotteries.length);
    if (loading) return [{ label: 'Cargando...', value: 'loading' }];
    if (lotteries.length <= 1) return [{ label: 'No hay loterías disponibles', value: 'none' }];
    console.log('✅ [ListeroStats] Opciones válidas de lotería:', lotteries);
    return lotteries;
  }, [loading, lotteries]);

  const validScheduleOptions = useMemo(() => {
    console.log('🕐 [ListeroStats] Validando opciones de horario. Loading:', loading, 'Schedules:', schedules.length);
    if (loading) return [{ label: 'Cargando...', value: 'loading' }];
    if (schedules.length <= 1) return [{ label: 'No hay horarios disponibles', value: 'none' }];
    console.log('✅ [ListeroStats] Opciones válidas de horario:', schedules);
    return schedules;
  }, [loading, schedules]);

  const collectedVsPaidDatasets = [
    { key:'collected', label:'Recogido', color:'rgba(39,174,96,1)' },
    { key:'paid', label:'Pagado', color:'rgba(231,76,60,1)' },
  ];

  const columns = [
    { key:'date', title:'Fecha', type:'date', flex:1.2 },
    { key:'lottery', title:'Lotería', flex:1.2 },
    { key:'schedule', title:'Horario', flex:1 },
    { key:'numbers', title:'Números', flex:1.5 },
    { key:'amount', title:'Monto', type:'currency', flex:1 },
    { key:'collected', title:'Recogido', type:'currency', flex:1 },
    { key:'paid', title:'Pagado', type:'currency', flex:1 },
    { key:'result', title:'Resultado', flex:1 },
    { key:'note', title:'Nota', flex:1 },
  ];

  const filterPlays = useMemo(() => rows => {
    const filtered = rows.filter(r =>
      (selectedLottery === 'all' || r.lottery === selectedLottery) &&
      (selectedSchedule === 'all' || r.schedule === selectedSchedule)
    );
    console.log('🔍 [ListeroStats] Filtro aplicado. Entrada:', rows.length, 'Salida:', filtered.length);
    console.log('🎯 [ListeroStats] Filtros activos - Lotería:', selectedLottery, 'Horario:', selectedSchedule);
    if (filtered.length > 0) {
      console.log('📋 [ListeroStats] Loterías en datos filtrados:', [...new Set(filtered.map(r => r.lottery))]);
    }
    return filtered;
  }, [selectedLottery, selectedSchedule]);

  const filteredGroupsLottery = useMemo(() => {
    return groupedByLottery.map(g => ({ ...g, rows: filterPlays(g.rows) }));
  }, [groupedByLottery, selectedLottery, selectedSchedule]);

  const filteredGroupsSchedule = useMemo(() => {
    return groupedBySchedule.map(g => ({ ...g, rows: filterPlays(g.rows) }));
  }, [groupedBySchedule, selectedLottery, selectedSchedule]);

  // Preparar opciones para dropdowns - Estas líneas ya no se necesitan, usamos validLotteryOptions y validScheduleOptions
  // const lotteryOptions = lotteries.length > 0 ? lotteries : [{ label: 'Cargando...', value: 'loading' }];
  // const scheduleOptions = schedules.length > 0 ? schedules : [{ label: 'Cargando...', value: 'loading' }];

  return (
    <ScrollView style={[styles.container, isDarkMode && styles.containerDark]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>
            Cargando estadísticas...
          </Text>
        </View>
      ) : (
        <>
          {/* KPIs */}
          <View style={styles.kpisRow}>
            <View style={[styles.kpiCard, isDarkMode && styles.kpiCardDark]}>
              <Text style={[styles.kpiTitle, isDarkMode && styles.kpiTitleDark]}>Total recogido</Text>
              <Text style={[styles.kpiVal, styles.kpiGreen]}>${kpis.collected.toFixed(1)}</Text>
            </View>
            <View style={[styles.kpiCard, isDarkMode && styles.kpiCardDark]}>
              <Text style={[styles.kpiTitle, isDarkMode && styles.kpiTitleDark]}>Total pagado</Text>
              <Text style={[styles.kpiVal, styles.kpiRed]}>${kpis.paid.toFixed(1)}</Text>
            </View>
            <View style={[styles.kpiCard, isDarkMode && styles.kpiCardDark]}>
              <Text style={[styles.kpiTitle, isDarkMode && styles.kpiTitleDark]}>Balance neto</Text>
              <Text style={[styles.kpiVal, (kpis.net>=0? styles.kpiGreen:styles.kpiRed)]}>${kpis.net.toFixed(1)}</Text>
            </View>
          </View>

      {/* Controles */}
      <View style={styles.controlsRow}>
        <View style={styles.segments}>
          {['last7','last30','custom'].map(v=> (
            <TouchableOpacity key={v} style={[styles.segmentBtn, range===v && styles.segmentBtnActive]} onPress={()=> setRange(v)}>
              <Text style={[styles.segmentTxt, range===v && styles.segmentTxtActive]}>{v==='last7'?'Últ. 7': v==='last30'?'Últ. 30':'Personalizado'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.sizeBtns}>
          <TouchableOpacity style={styles.sizeBtn} onPress={()=> setChartHeight(h=> Math.max(160, h-40))}><Text style={styles.sizeTxt}>−</Text></TouchableOpacity>
          <TouchableOpacity style={styles.sizeBtn} onPress={()=> setChartHeight(h=> Math.min(480, h+40))}><Text style={styles.sizeTxt}>＋</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection:'row' }}>
          <TouchableOpacity style={styles.exportBtn} onPress={async ()=>{ const { csv } = await exportCSV(filterPlays(currentPlays)); console.log(csv?.slice(0,120)+'...'); }}>
            <Text style={styles.exportTxt}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={async ()=>{ await exportPDF('Resumen listero'); }}>
            <Text style={styles.exportTxt}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        <View style={styles.filterContainer}>
          <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Lotería:</Text>
          <DropdownPicker
            items={validLotteryOptions}
            value={selectedLottery}
            onChangeValue={(value) => setSelectedLottery(value)}
            placeholder="Seleccionar lotería"
            isDarkMode={isDarkMode}
            style={styles.filterDropdown}
            disabled={loading || validLotteryOptions[0]?.value === 'none'}
          />
        </View>
        <View style={styles.filterContainer}>
          <Text style={[styles.filterLabel, isDarkMode && styles.filterLabelDark]}>Horario:</Text>
          <DropdownPicker
            items={validScheduleOptions}
            value={selectedSchedule}
            onChangeValue={(value) => setSelectedSchedule(value)}
            placeholder="Seleccionar horario"
            isDarkMode={isDarkMode}
            style={styles.filterDropdown}
            disabled={loading || validScheduleOptions[0]?.value === 'none'}
          />
        </View>
      </View>

      {/* Gráfico: Recogido vs Pagado (últimos 7) */}
      <StatisticsChart
        type="line"
        title="Recogido vs Pagado (diario)"
        data={series7}
        datasetsOverride={collectedVsPaidDatasets}
        isDarkMode={isDarkMode}
        height={chartHeight}
      />

      {/* Barras por Lotería */}
      <StatisticsChart
        type="bar"
        title="Recogido por Lotería"
        data={groupedByLottery.map(g=> ({ name:g.title, value:g.rows.reduce((s,r)=> s + (r.collected||0), 0) }))}
        isDarkMode={isDarkMode}
        height={chartHeight}
      />

      {/* Barras por Horario */}
      <StatisticsChart
        type="bar"
        title="Recogido por Horario"
        data={groupedBySchedule.map(g=> ({ name:g.title, value:g.rows.reduce((s,r)=> s + (r.collected||0), 0) }))}
        isDarkMode={isDarkMode}
        height={chartHeight}
      />

      {/* Agrupados por Lotería */}
      <GroupedAccordionTable
        title="Jugadas por Lotería"
        groups={filteredGroupsLottery}
        columns={columns}
        isDarkMode={isDarkMode}
        defaultExpanded={false}
      />

      {/* Agrupados por Horario */}
      <GroupedAccordionTable
        title="Jugadas por Horario"
        groups={filteredGroupsSchedule}
        columns={columns}
        isDarkMode={isDarkMode}
        defaultExpanded={false}
      />
      
      {currentPlays.length === 0 && !loading && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>
            {lotteries.length <= 1 
              ? "No hay loterías configuradas para este banco" 
              : "No hay datos de jugadas disponibles para los filtros seleccionados"
            }
          </Text>
          {lotteries.length <= 1 && (
            <Text style={[styles.emptySubtext, isDarkMode && styles.emptyTextDark]}>
              Contacte al administrador para configurar las loterías del banco
            </Text>
          )}
        </View>
      )}
      </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#f5f6f7' },
  containerDark: { backgroundColor:'#22303c' },
  kpisRow: { flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginHorizontal:8 },
  kpiCard: { flexBasis:'32%', backgroundColor:'#fff', borderRadius:12, padding:12, marginVertical:6, elevation:2 },
  kpiCardDark: { backgroundColor:'#34495e' },
  kpiTitle: { fontSize:13, color:'#6c757d' },
  kpiTitleDark: { color:'#bdc3c7' },
  kpiVal: { fontSize:18, fontWeight:'800', marginTop:4 },
  kpiGreen: { color:'#27AE60' },
  kpiRed: { color:'#e74c3c' },
  controlsRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', margin:8 },
  segments: { flexDirection:'row', backgroundColor:'#ecf0f1', borderRadius:8, overflow:'hidden' },
  segmentBtn: { paddingHorizontal:10, paddingVertical:6 },
  segmentBtnActive: { backgroundColor:'#27AE60' },
  segmentTxt: { color:'#2c3e50' },
  segmentTxtActive: { color:'#fff', fontWeight:'700' },
  sizeBtns: { flexDirection:'row' },
  sizeBtn: { width:36, height:36, borderRadius:8, backgroundColor:'#ecf0f1', alignItems:'center', justifyContent:'center', marginHorizontal:4 },
  sizeTxt: { fontSize:18, fontWeight:'800', color:'#2c3e50' },
  exportBtn: { paddingHorizontal:10, paddingVertical:8, backgroundColor:'#2c3e50', borderRadius:8, marginLeft:8 },
  exportTxt: { color:'#fff', fontWeight:'700' },
  filtersRow: { flexDirection:'row', justifyContent:'space-between', marginHorizontal:8, marginVertical:8 },
  filterContainer: { flex:1, marginHorizontal:4 },
  filterLabel: { fontSize:14, fontWeight:'600', color:'#2c3e50', marginBottom:4 },
  filterLabelDark: { color:'#ecf0f1' },
  filterDropdown: { minHeight:40 },
  loadingContainer: { flex:1, justifyContent:'center', alignItems:'center', padding:40 },
  loadingText: { fontSize:16, color:'#6c757d' },
  loadingTextDark: { color:'#bdc3c7' },
  emptyContainer: { padding:40, alignItems:'center' },
  emptyText: { fontSize:16, color:'#6c757d', textAlign:'center' },
  emptyTextDark: { color:'#bdc3c7' },
  emptySubtext: { fontSize:14, color:'#95a5a6', textAlign:'center', marginTop:8 },
});
