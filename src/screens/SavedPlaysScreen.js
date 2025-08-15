import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseClient';

const ITEMS_PER_PAGE = 20;

const getPlayTypeLabel = (playType) => ({
  fijo:'Fijo', corrido:'Corrido', posicion:'Posición', parle:'Parlé', centena:'Centena', tripleta:'Tripleta'
}[playType] || playType);

const SavedPlaysScreen = ({ navigation, route }) => {
  const isDarkMode = route?.params?.isDarkMode || false;
  const [savedPlays, setSavedPlays] = useState([]);
  const [filteredPlays, setFilteredPlays] = useState([]);
  const [displayedPlays, setDisplayedPlays] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedLotteryFilter, setSelectedLotteryFilter] = useState('all');
  const [selectedScheduleFilter, setSelectedScheduleFilter] = useState('all');
  const [showOnlyWinners, setShowOnlyWinners] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Nuevos estados para UI compacta
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);

  const loadSavedPlays = async () => {
    try {
      setIsLoading(true);
      // Traer solo jugadas del día (comparar fecha)
      const { data, error } = await supabase
        .from('jugada')
        .select('id, id_horario, jugada, numeros, monto_unitario, monto_total, created_at, nota, horario:horario(id,nombre,loteria:loteria(id,nombre)))')
        .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
        .lt('created_at', new Date(new Date().setHours(24,0,0,0)).toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data||[]).map(r=> ({
        id: r.id,
        lottery: r.horario?.loteria?.nombre || 'Lotería',
        schedule: r.horario?.nombre || 'Horario',
        playType: r.jugada,
        numbers: r.numeros,
        amount: r.monto_unitario,
        total: r.monto_total,
        note: r.nota,
        hasPrize: false,
        prize: 'desconocido',
        result: 'no disponible',
        timestamp: new Date(r.created_at)
      }));
      setSavedPlays(mapped);
    } catch(e){ console.error('Error cargando jugadas del día:', e.message); }
    finally { setIsLoading(false); }
  };

  useFocusEffect(useCallback(()=> { loadSavedPlays(); },[]));

  useEffect(()=> {
    let filtered = [...savedPlays];
    if(searchText.trim()) {
      const t = searchText.toLowerCase();
      filtered = filtered.filter(play => play.lottery.toLowerCase().includes(t) || play.note.toLowerCase().includes(t) || play.numbers.includes(searchText));
    }
    if(selectedLotteryFilter !== 'all') filtered = filtered.filter(p=> p.lottery === selectedLotteryFilter);
    if(selectedScheduleFilter !== 'all') filtered = filtered.filter(p=> p.schedule === selectedScheduleFilter);
    if(showOnlyWinners) filtered = filtered.filter(p=> p.hasPrize);
    setFilteredPlays(filtered);
    setCurrentPage(0);
    setHasMoreData(filtered.length > ITEMS_PER_PAGE);
    setDisplayedPlays(filtered.slice(0, ITEMS_PER_PAGE));
  },[savedPlays, searchText, selectedLotteryFilter, selectedScheduleFilter, showOnlyWinners]);

  const loadMoreData = () => {
    if(isLoadingMore || !hasMoreData) return;
    setIsLoadingMore(true);
    setTimeout(()=> {
      const nextPage = currentPage + 1;
      const start = nextPage * ITEMS_PER_PAGE;
      const nextData = filteredPlays.slice(start, start + ITEMS_PER_PAGE);
      if(nextData.length){
        setDisplayedPlays(prev=>[...prev, ...nextData]);
        setCurrentPage(nextPage);
        setHasMoreData(start + ITEMS_PER_PAGE < filteredPlays.length);
      } else {
        setHasMoreData(false);
      }
      setIsLoadingMore(false);
    },200);
  };

  const onRefresh = async () => { setIsRefreshing(true); await loadSavedPlays(); setIsRefreshing(false); };

  const getTotals = () => {
    const totalRecogido = filteredPlays.filter(p=>p.hasPrize).reduce((s,p)=> s + (typeof p.prize==='number'? p.prize:0),0);
    const pendientePago = filteredPlays.filter(p=> !p.hasPrize && p.result==='no disponible').reduce((s,p)=> s + p.total,0);
    return { totalRecogido, pendientePago };
  };
  const { totalRecogido, pendientePago } = getTotals();

  const formatTime = ts => ts.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});

  const renderFilterButton = (value, current, setter, label) => (
    <Pressable style={[styles.filterButton, value===current && styles.filterButtonActive, isDarkMode && styles.filterButtonDark, value===current && isDarkMode && styles.filterButtonActiveDark]} onPress={()=> setter(value)}>
      <Text style={[styles.filterButtonText, isDarkMode && styles.filterButtonTextDark, value===current && styles.filterButtonTextActive]}>{label}</Text>
    </Pressable>
  );

  const renderPlayItem = ({ item }) => (
    <View style={[styles.playCard, isDarkMode && styles.playCardDark]}>
      <View style={styles.rowBetween}>
  <Text style={[styles.lotteryName, isDarkMode && styles.lotteryNameDark]}>{item.lottery}</Text>
        <Text style={[styles.resultBadge, isDarkMode && styles.resultBadgeDark]}>{item.result}</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.note, isDarkMode && styles.noteDark]} numberOfLines={1}>{item.note}</Text>
        <Text style={[styles.playType, isDarkMode && styles.playTypeDark]}>{getPlayTypeLabel(item.playType)}</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.numbers, isDarkMode && styles.numbersDark]}>{item.numbers}</Text>
  <Text style={[styles.amount, isDarkMode && styles.amountDark]}>${item.amount} × {item.numbers.split(',').filter(Boolean).length} = ${item.total}</Text>
      </View>
      <View style={styles.rowBetween}>
        <Text style={[styles.prize, item.hasPrize && styles.prizeWinner]}>{item.hasPrize ? `🏆 $${item.prize}` : '⏳ PENDIENTE'}</Text>
        <Text style={[styles.timestamp, isDarkMode && styles.timestampDark]}>{formatTime(item.timestamp)} - {item.schedule}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Header compacto */}
      <View style={styles.header}> 
        <Pressable style={styles.backBtn} onPress={()=> navigation.goBack()}><Text style={styles.backTxt}>←</Text></Pressable>
        <Text style={[styles.title, isDarkMode && styles.titleDark]} numberOfLines={1}>Jugadas Guardadas</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={()=> setSearchVisible(v=> !v)}>
            <Text style={[styles.iconTxt, searchVisible && styles.iconActive]}>🔍</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={()=> setFiltersVisible(v=> !v)}>
            <Text style={[styles.iconTxt, filtersVisible && styles.iconActive]}>⚙️</Text>
          </Pressable>
        </View>
      </View>
      {searchVisible && (
        <TextInput
          style={[styles.searchInput, isDarkMode && styles.searchInputDark]}
          placeholder="Buscar números / nota / lotería..."
          placeholderTextColor={isDarkMode ? '#7F8C8D':'#95A5A6'}
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
        />
      )}
      {filtersVisible && (
        <View style={[styles.filtersPanel, isDarkMode && styles.filtersPanelDark]}>
          <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Loterías</Text>
          <View style={styles.chipsRow}>
            {renderFilterButton('all', selectedLotteryFilter, setSelectedLotteryFilter,'Todas')}
            {renderFilterButton('Georgia', selectedLotteryFilter, setSelectedLotteryFilter,'Georgia')}
            {renderFilterButton('Florida', selectedLotteryFilter, setSelectedLotteryFilter,'Florida')}
            {renderFilterButton('New York', selectedLotteryFilter, setSelectedLotteryFilter,'New York')}
          </View>
          <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Horarios</Text>
          <View style={styles.chipsRow}>
            {renderFilterButton('all', selectedScheduleFilter, setSelectedScheduleFilter,'Todos')}
            {renderFilterButton('mediodia', selectedScheduleFilter, setSelectedScheduleFilter,'Mediodía')}
            {renderFilterButton('noche', selectedScheduleFilter, setSelectedScheduleFilter,'Noche')}
          </View>
          <View style={styles.inlineTotals}>
            <Text style={[styles.totalText, isDarkMode && styles.totalTextDark]}>Recogido: ${totalRecogido}</Text>
            <Text style={[styles.totalText, isDarkMode && styles.totalTextDark]}>Pendiente: ${pendientePago}</Text>
            <Pressable style={[styles.prizeFilterButton, showOnlyWinners && styles.prizeFilterButtonActive]} onPress={()=> setShowOnlyWinners(p=>!p)}>
              <Text style={styles.prizeFilterText}>{showOnlyWinners? '🏆 Ganadores':'🎯 Todos'}</Text>
            </Pressable>
          </View>
        </View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}><Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>Cargando...</Text></View>
      ) : (
        <FlatList
          data={displayedPlays}
            keyExtractor={item=> item.id.toString()}
          renderItem={renderPlayItem}
          style={styles.list}
          onEndReached={loadMoreData}
          onEndReachedThreshold={0.15}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListFooterComponent={hasMoreData ? (isLoadingMore ? <Text style={styles.footer}>Cargando más...</Text> : null) : <Text style={styles.footer}>No hay más</Text> }
          ListEmptyComponent={<Text style={styles.empty}>Sin jugadas</Text>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#FFFFFF', padding:12 },
  containerDark:{ backgroundColor:'#1B262C' },
  header:{ flexDirection:'row', alignItems:'center', marginBottom:6 },
  backBtn:{ padding:6, marginRight:8 },
  backTxt:{ fontSize:22, fontWeight:'600', color:'#2C3E50' },
  title:{ fontSize:16, fontWeight:'700', color:'#2C3E50', flex:1 },
  titleDark:{ color:'#ECF0F1' },
  headerActions:{ flexDirection:'row', alignItems:'center' },
  iconBtn:{ padding:6, marginLeft:4, borderRadius:6 },
  iconTxt:{ fontSize:18 },
  iconActive:{ textDecorationLine:'underline' },
  searchInput:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#B8D4A8', borderRadius:8, paddingHorizontal:10, paddingVertical:6, fontSize:13, color:'#2D5016', marginBottom:6 },
  searchInputDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E', color:'#ECF0F1' },
  filtersPanel:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#E1E8E3', borderRadius:10, padding:8, marginBottom:6 },
  filtersPanelDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  panelLabel:{ fontSize:11, fontWeight:'700', color:'#2D5016', marginTop:4, marginBottom:4 },
  panelLabelDark:{ color:'#ECF0F1' },
  chipsRow:{ flexDirection:'row', flexWrap:'wrap', marginBottom:4 },
  filterButton:{ backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#B8D4A8', borderRadius:20, paddingHorizontal:10, paddingVertical:4, marginRight:6, marginBottom:6 },
  filterButtonDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  filterButtonActive:{ backgroundColor:'#E8F5E8', borderColor:'#27AE60' },
  filterButtonActiveDark:{ backgroundColor:'#5D6D7E', borderColor:'#27AE60' },
  filterButtonText:{ fontSize:11, color:'#2D5016', fontWeight:'500' },
  filterButtonTextDark:{ color:'#ECF0F1' },
  filterButtonTextActive:{ fontWeight:'700', color:'#27AE60' },
  inlineTotals:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:4 },
  totalsRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#F8F9FA', borderRadius:8, padding:10, marginBottom:8 },
  totalText:{ fontSize:12, fontWeight:'600', color:'#2D5016' },
  totalTextDark:{ color:'#ECF0F1' },
  prizeFilterButton:{ backgroundColor:'#F39C12', paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  prizeFilterButtonActive:{ backgroundColor:'#27AE60' },
  prizeFilterText:{ color:'#FFFFFF', fontSize:10, fontWeight:'600' },
  list:{ flex:1 },
  playCard:{ backgroundColor:'#F8F9FA', borderRadius:8, padding:10, marginBottom:8, borderWidth:1, borderColor:'#E8F1E4' },
  playCardDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  rowBetween:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  lotteryName:{ fontSize:14, fontWeight:'700', color:'#2D5016' },
  lotteryNameDark:{ color:'#ECF0F1' },
  resultBadge:{ backgroundColor:'#E8F5E8', borderColor:'#27AE60', borderWidth:1, borderRadius:12, paddingHorizontal:8, paddingVertical:2, fontSize:11, fontWeight:'600', color:'#27AE60' },
  resultBadgeDark:{ backgroundColor:'#2C3E50', borderColor:'#27AE60', color:'#27AE60' },
  note:{ fontSize:12, color:'#5D6D7E', flex:1, marginRight:8 },
  noteDark:{ color:'#BDC3C7' },
  playType:{ fontSize:12, fontWeight:'600', color:'#8E44AD', backgroundColor:'#F4ECF7', paddingHorizontal:6, paddingVertical:2, borderRadius:4 },
  playTypeDark:{ color:'#BB8FCE', backgroundColor:'#5D6D7E' },
  numbers:{ fontSize:14, fontWeight:'600', color:'#2D5016', flex:1 },
  numbersDark:{ color:'#ECF0F1' },
  amount:{ fontSize:12, fontWeight:'600', color:'#27AE60' },
  amountDark:{ color:'#58D68D' },
  prize:{ fontSize:12, fontWeight:'600', color:'#7F8C8D' },
  prizeWinner:{ color:'#2E86C1' },
  timestamp:{ fontSize:10, color:'#7F8C8D', fontStyle:'italic' },
  timestampDark:{ color:'#BDC3C7' },
  loadingContainer:{ flex:1, justifyContent:'center', alignItems:'center', paddingVertical:20 },
  loadingText:{ fontSize:16, color:'#7F8C8D', fontStyle:'italic' },
  loadingTextDark:{ color:'#BDC3C7' },
  footer:{ textAlign:'center', paddingVertical:12, fontSize:12, color:'#7F8C8D' },
  empty:{ textAlign:'center', marginTop:40, fontSize:14, color:'#7F8C8D', fontStyle:'italic' }
});

export default SavedPlaysScreen;
