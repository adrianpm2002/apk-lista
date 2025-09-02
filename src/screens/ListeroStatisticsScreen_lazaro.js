import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import StatisticsChart from '../components/StatisticsChart';
import GroupedAccordionTable from '../components/GroupedAccordionTable';
import { last7DaysSummary, groupByLottery, groupBySchedule, quickKPIs, mockPlays, exportCSV, exportPDF } from '../utils/statisticsUtils';

const { width: screenWidth } = Dimensions.get('window');

export default function ListeroStatisticsScreen({ isDarkMode=false }){
  const [range, setRange] = useState('last7'); // 'last7' | 'last30' | 'custom'
  const [selectedLottery, setSelectedLottery] = useState('all');
  const [selectedSchedule, setSelectedSchedule] = useState('all');
  const [chartHeight, setChartHeight] = useState(240);

  // Datos base mock
  const kpis = useMemo(()=> quickKPIs(), []);
  const series7 = useMemo(()=> last7DaysSummary(), []);
  const groupedByLottery = useMemo(()=> groupByLottery(), []);
  const groupedBySchedule = useMemo(()=> groupBySchedule(), []);

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

  const filterPlays = (rows) => rows.filter(r =>
    (selectedLottery==='all' || r.lottery===selectedLottery) &&
    (selectedSchedule==='all' || r.schedule===selectedSchedule)
  );

  const filteredGroupsLottery = useMemo(()=> {
    const groups = groupByLottery();
    return groups.map(g=> ({ ...g, rows: filterPlays(g.rows) }));
  }, [selectedLottery, selectedSchedule]);

  const filteredGroupsSchedule = useMemo(()=> {
    const groups = groupBySchedule();
    return groups.map(g=> ({ ...g, rows: filterPlays(g.rows) }));
  }, [selectedLottery, selectedSchedule]);

  return (
    <ScrollView style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* KPIs */}
      <View style={styles.kpisRow}>
        <View style={[styles.kpiCard, isDarkMode && styles.kpiCardDark]}>
          <Text style={[styles.kpiTitle, isDarkMode && styles.kpiTitleDark]}>Total recogido</Text>
          <Text style={[styles.kpiVal, styles.kpiGreen]}>${Math.round(kpis.collected).toLocaleString('es-DO')}</Text>
        </View>
        <View style={[styles.kpiCard, isDarkMode && styles.kpiCardDark]}>
          <Text style={[styles.kpiTitle, isDarkMode && styles.kpiTitleDark]}>Total pagado</Text>
          <Text style={[styles.kpiVal, styles.kpiRed]}>${Math.round(kpis.paid).toLocaleString('es-DO')}</Text>
        </View>
        <View style={[styles.kpiCard, isDarkMode && styles.kpiCardDark]}>
          <Text style={[styles.kpiTitle, isDarkMode && styles.kpiTitleDark]}>Balance neto</Text>
          <Text style={[styles.kpiVal, (kpis.net>=0? styles.kpiGreen:styles.kpiRed)]}>${Math.round(kpis.net).toLocaleString('es-DO')}</Text>
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
          <TouchableOpacity style={styles.exportBtn} onPress={async ()=>{ const { csv } = await exportCSV(filterPlays(mockPlays)); console.log(csv?.slice(0,120)+'...'); }}>
            <Text style={styles.exportTxt}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={async ()=>{ await exportPDF('Resumen listero'); }}>
            <Text style={styles.exportTxt}>PDF</Text>
          </TouchableOpacity>
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
});
