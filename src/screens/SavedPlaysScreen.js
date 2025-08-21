import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, ScrollView, RefreshControl, Alert, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseClient';

const ITEMS_PER_PAGE = 20;

const getPlayTypeLabel = (playType) => ({
  fijo:'Fijo', corrido:'Corrido', posicion:'Posición', parle:'Parle', centena:'Centena', tripleta:'Tripleta'
}[playType] || playType);

const SavedPlaysScreen = ({ navigation, route }) => {
  const isDarkMode = route?.params?.isDarkMode || false;
  const originMode = route?.params?.originMode || 'Visual';
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
  // Estados dinámicos de filtros
  const [lotteryOptions, setLotteryOptions] = useState([]); // {id,name}
  const [scheduleOptions, setScheduleOptions] = useState([]); // {id,name}
  const [playTypeOptions, setPlayTypeOptions] = useState([]); // {value,label}
  const [selectedPlayTypeFilter, setSelectedPlayTypeFilter] = useState('all');
  // Estados de edición / selección
  const [editingPlay, setEditingPlay] = useState(null);
  const editBannerOpacity = useRef(new Animated.Value(0)).current;
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loadSavedPlays = async () => {
    try {
      setIsLoading(true);
      // Construir rango local del día (00:00:00 a 23:59:59.999) SIN convertir a UTC para columnas timestamp without time zone
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const y = now.getFullYear();
      const m = pad(now.getMonth() + 1);
      const d = pad(now.getDate());
      const startStr = `${y}-${m}-${d} 00:00:00`; // inicio día local
      const endStr = `${y}-${m}-${d} 23:59:59.999`; // fin día local
      // NOTA: Antes se usaba toISOString() (UTC) lo que desplazaba el inicio a las 04:00 para UTC-4 y omitía jugadas tempranas.
      const { data, error } = await supabase
        .from('jugada')
        .select('id, id_horario, jugada, numeros, monto_unitario, monto_total, created_at, nota, horario:horario(id,nombre,hora_inicio,hora_fin,loteria:loteria(id,nombre)))')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data||[]).map(r=> ({
        id: r.id,
        lottery: r.horario?.loteria?.nombre || 'Lotería',
        lotteryId: r.horario?.loteria?.id || 'unknown',
        schedule: r.horario?.nombre || 'Horario',
        scheduleId: r.horario?.id || 'unknown',
        scheduleStart: r.horario?.hora_inicio || null,
        scheduleEnd: r.horario?.hora_fin || null,
        playType: r.jugada,
        numbers: r.numeros,
        amount: r.monto_unitario,
        total: r.monto_total,
        note: r.nota || '',
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

  // Derivar opciones dinámicas cada vez que cambian las jugadas cargadas
  useEffect(()=> {
    const uniqueBy = (arr, key) => {
      const seen = new Set();
      return arr.filter(i=> { if(seen.has(i[key])) return false; seen.add(i[key]); return true; });
    };
    const lotOpts = uniqueBy(savedPlays.filter(p=> p.lotteryId !== 'unknown'), 'lotteryId')
      .map(p=> ({ id:p.lotteryId, name:p.lottery }))
      .sort((a,b)=> a.name.localeCompare(b.name));
    setLotteryOptions(lotOpts);
    // Horarios dependen de la lotería seleccionada
    const schedulePool = selectedLotteryFilter==='all' ? savedPlays : savedPlays.filter(p=> p.lotteryId===selectedLotteryFilter);
    const schOpts = uniqueBy(schedulePool.filter(p=> p.scheduleId !== 'unknown'), 'scheduleId')
      .map(p=> ({ id:p.scheduleId, name:p.schedule }))
      .sort((a,b)=> a.name.localeCompare(b.name));
    setScheduleOptions(schOpts);
    // Tipos de jugada activos
    const playTypesSet = Array.from(new Set(savedPlays.map(p=> p.playType)));
    setPlayTypeOptions(playTypesSet.map(pt=> ({ value:pt, label:getPlayTypeLabel(pt) })));
  },[savedPlays, selectedLotteryFilter]);

  // Reset horario al cambiar lotería
  useEffect(()=> { setSelectedScheduleFilter('all'); }, [selectedLotteryFilter]);

  useEffect(()=> {
    let filtered = [...savedPlays];
    if(searchText.trim()) {
      const t = searchText.toLowerCase();
      filtered = filtered.filter(play => play.lottery.toLowerCase().includes(t) || play.note.toLowerCase().includes(t) || play.numbers.includes(searchText));
    }
    if(selectedLotteryFilter !== 'all') filtered = filtered.filter(p=> p.lotteryId === selectedLotteryFilter);
    if(selectedScheduleFilter !== 'all') filtered = filtered.filter(p=> p.scheduleId === selectedScheduleFilter);
    if(selectedPlayTypeFilter !== 'all') filtered = filtered.filter(p=> p.playType === selectedPlayTypeFilter);
    if(showOnlyWinners) filtered = filtered.filter(p=> p.hasPrize);
    setFilteredPlays(filtered);
    setCurrentPage(0);
    setHasMoreData(filtered.length > ITEMS_PER_PAGE);
    setDisplayedPlays(filtered.slice(0, ITEMS_PER_PAGE));
  },[savedPlays, searchText, selectedLotteryFilter, selectedScheduleFilter, selectedPlayTypeFilter, showOnlyWinners]);

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

  // Totales: Recogido = suma de monto_total de TODAS las jugadas del día (sin filtrar)
  // Pendiente = suma de las jugadas (filtradas) cuyo resultado no está disponible
  const totalRecogido = savedPlays.reduce((s,p)=> s + (p.total || 0), 0);
  const pendientePago = filteredPlays.filter(p=> p.result==='no disponible').reduce((s,p)=> s + (p.total || 0),0);

  const formatTime = ts => ts.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});

  const renderFilterButton = (value, current, setter, label) => (
    <Pressable style={[styles.filterButton, value===current && styles.filterButtonActive, isDarkMode && styles.filterButtonDark, value===current && isDarkMode && styles.filterButtonActiveDark]} onPress={()=> setter(value)}>
      <Text style={[styles.filterButtonText, isDarkMode && styles.filterButtonTextDark, value===current && styles.filterButtonTextActive]}>{label}</Text>
    </Pressable>
  );

  const confirm = (title, message, onYes) => {
    if(Platform.OS === 'web') {
      if(window.confirm(`${title}\n\n${message}`)) onYes();
    } else {
      Alert.alert(title, message, [
        { text:'Cancelar', style:'cancel' },
        { text:'Sí', style:'destructive', onPress:onYes }
      ]);
    }
  };

  const renderPlayItem = ({ item }) => (
    <Pressable
      style={[styles.playCard, isDarkMode && styles.playCardDark, selectedIds.has(item.id) && styles.playCardSelected]}
      onLongPress={() => {
        setSelectionMode(true);
        setSelectedIds(prev => { const next=new Set(prev); next.add(item.id); return next; });
      }}
      onPress={() => {
        if(selectionMode){
          setSelectedIds(prev=>{
            const next=new Set(prev);
            if(next.has(item.id)) next.delete(item.id); else next.add(item.id);
            if(next.size===0) setSelectionMode(false);
            return next;
          });
        }
      }}
    >
      <View style={styles.topRow}>
        {selectionMode && (
          <Pressable
            style={[styles.selectCornerBtn, selectedIds.has(item.id) && styles.selectCornerBtnActive]}
            onPress={()=> setSelectedIds(prev=>{ const next=new Set(prev); if(next.has(item.id)) next.delete(item.id); else next.add(item.id); if(next.size===0) setSelectionMode(false); return next; })}
          >
            <Text style={[styles.selectCornerTxt, selectedIds.has(item.id) && styles.selectCornerTxtActive]}>{selectedIds.has(item.id)? '✔':'○'}</Text>
          </Pressable>
        )}
  <View style={styles.topLeft}>
          <View style={styles.lotteryLine}>
            <Text style={[styles.lotteryName, isDarkMode && styles.lotteryNameDark]} numberOfLines={1}>{item.lottery}</Text>
            <Text style={[styles.scheduleTag, isDarkMode && styles.scheduleTagDark]} numberOfLines={1}>{item.schedule}</Text>
            <Text style={[styles.playTypeInline, isDarkMode && styles.playTypeInlineDark]}>{getPlayTypeLabel(item.playType)}</Text>
          </View>
          <View style={styles.namePriceInline}>
            {!!item.note && (
              <Text style={[styles.noteStronger, isDarkMode && styles.noteStrongerDark]} numberOfLines={1}>{(item.note || '').toUpperCase()}</Text>
            )}
            <Text style={[styles.priceCalc, isDarkMode && styles.priceCalcDark]}>${item.amount} × {item.numbers.split(',').filter(Boolean).length} = ${item.total}</Text>
          </View>
        </View>
        <View style={styles.resultBox}>
          <Text
            style={[
              styles.resultLabel,
              isDarkMode && styles.resultLabelDark,
              item.result === 'no disponible' && styles.resultUnavailable,
              item.result === 'no disponible' && isDarkMode && styles.resultUnavailableDark
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Resultado: {item.result}
          </Text>
          {!item.hasPrize && <Text style={[styles.pendingText, styles.pendingUnderResult]}>⏳ Pendiente</Text>}
          <Pressable style={styles.editUnderPendingBtn} onPress={()=> {
            // Validar horario
            const isOpen = (()=> {
              const hi = item.scheduleStart; const hf = item.scheduleEnd; if(!hi || !hf) return true; // si faltan datos permitir
              const now = new Date();
              const [shi,smi] = hi.split(':');
              const [shf,smf] = hf.split(':');
              const start = parseInt(shi,10)*60 + parseInt(smi||'0',10);
              const end = parseInt(shf,10)*60 + parseInt(smf||'0',10);
              const current = now.getHours()*60 + now.getMinutes();
              if(start === end) return true; // 24h
              if(end > start) return current >= start && current < end; // mismo día
              return current >= start || current < end; // cruza medianoche
            })();
            if(!isOpen){
              if(Platform.OS === 'web') { window.alert('No se puede editar porque esta lotería está cerrada'); }
              else { Alert.alert('Cerrada','No se puede editar porque esta lotería está cerrada'); }
              return;
            }
            const targetMode = originMode === 'Texto' ? 'Texto' : 'Visual';
            const msg = originMode === 'Texto' ? '¿Abrir esta jugada en modo Texto para editarla?' : '¿Abrir esta jugada en modo Visual para editarla?';
            confirm('Editar', msg, ()=> { setEditingPlay(item); navigation.navigate('MainApp', { editPayload: item, originMode: targetMode }); });
          }}>
            <Text style={styles.editUnderPendingTxt}>Editar</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.numbersRow}>
        {(() => {
          const parts = item.numbers.split(',').map(n=> n.trim()).filter(Boolean);
          const counts = parts.reduce((acc,n)=> (acc[n]=(acc[n]||0)+1, acc), {});
          return (
            <Text style={[styles.numbers, isDarkMode && styles.numbersDark]}>
              {parts.map((n,i)=> (
                <Text key={i}>
                  {counts[n]>1 ? <Text style={styles.dupNumber}>{n}</Text> : n}
                  {i < parts.length-1 ? ', ' : ''}
                </Text>
              ))}
            </Text>
          );
        })()}
      </View>
      <View style={styles.statusRow}>
        <Text style={[styles.timestamp, isDarkMode && styles.timestampDark]}>{formatTime(item.timestamp)}</Text>
      </View>
    </Pressable>
  );

  const handleDeleteSelected = () => {
    if(selectedIds.size===0) return;
    // Validar que todas las seleccionadas estén en horarios abiertos
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();
    const isOpen = (hi,hf) => {
      if(!hi || !hf) return true;
      const [shi,smi] = hi.split(':');
      const [shf,smf] = hf.split(':');
      const start = parseInt(shi,10)*60 + parseInt(smi||'0',10);
      const end = parseInt(shf,10)*60 + parseInt(smf||'0',10);
      if(start === end) return true;
      if(end > start) return nowMin >= start && nowMin < end;
      return nowMin >= start || nowMin < end; // cruza medianoche
    };
    const closed = savedPlays.filter(p=> selectedIds.has(p.id) && !isOpen(p.scheduleStart, p.scheduleEnd));
    if(closed.length){
      if(Platform.OS==='web') window.alert('No se pueden eliminar porque alguna lotería está cerrada');
      else Alert.alert('Cerrada','No se pueden eliminar porque alguna lotería está cerrada');
      return;
    }
    const proceed = async () => {
      try {
        const idsArray = Array.from(selectedIds);
        const { error } = await supabase.from('jugada').delete().in('id', idsArray);
        if(error) throw error;
        setSavedPlays(prev=> prev.filter(p=> !selectedIds.has(p.id)));
        setSelectedIds(new Set());
        setSelectionMode(false);
      } catch(e){ console.error('Error eliminando jugadas', e.message); }
    };
    if(Platform.OS === 'web'){
      if(window.confirm(`Eliminar ${selectedIds.size} jugada(s)?`)) proceed();
    } else {
      Alert.alert('Eliminar', `¿Eliminar ${selectedIds.size} jugada(s) seleccionadas?`, [
        { text:'Cancelar', style:'cancel' },
        { text:'Eliminar', style:'destructive', onPress: proceed }
      ]);
    }
  };

  useEffect(()=>{
    if(editingPlay){
      editBannerOpacity.setValue(0);
      Animated.timing(editBannerOpacity,{ toValue:1, duration:250, useNativeDriver:true }).start();
    }
  }, [editingPlay]);

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
            <Text style={[styles.iconTxt, filtersVisible && styles.iconActive]}>🎛️</Text>
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
            {lotteryOptions.map(l=> renderFilterButton(l.id, selectedLotteryFilter, setSelectedLotteryFilter, l.name))}
          </View>
          <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Horarios</Text>
          <View style={styles.chipsRow}>
            {renderFilterButton('all', selectedScheduleFilter, setSelectedScheduleFilter,'Todos')}
            {scheduleOptions.map(h=> renderFilterButton(h.id, selectedScheduleFilter, setSelectedScheduleFilter, h.name))}
          </View>
          <Text style={[styles.panelLabel, isDarkMode && styles.panelLabelDark]}>Tipo de Jugada</Text>
            <View style={styles.chipsRow}>
              {renderFilterButton('all', selectedPlayTypeFilter, setSelectedPlayTypeFilter,'Todas')}
              {playTypeOptions.map(pt=> renderFilterButton(pt.value, selectedPlayTypeFilter, setSelectedPlayTypeFilter, pt.label))}
            </View>
        </View>
      )}
      <View style={[styles.inlineTotalsOutside, isDarkMode && styles.inlineTotalsOutsideDark]}>
        {selectionMode && (
          <Pressable style={styles.bulkDeleteBtn} onPress={handleDeleteSelected}>
            <Text style={styles.bulkDeleteTxt}>Eliminar ({selectedIds.size})</Text>
          </Pressable>
        )}
        <View style={styles.totalsFlexGroup}>
          <Text style={[styles.totalText, isDarkMode && styles.totalTextDark]}>Recogido: ${totalRecogido}</Text>
          <Text style={[styles.totalText, isDarkMode && styles.totalTextDark]}>Pendiente: ${pendientePago}</Text>
        </View>
        <Pressable style={[styles.prizeFilterButton, showOnlyWinners && styles.prizeFilterButtonActive]} onPress={()=> setShowOnlyWinners(p=>!p)}>
          <Text style={styles.prizeFilterText}>{showOnlyWinners? '🏆 Ganadores':'🎯 Todos'}</Text>
        </Pressable>
      </View>
      {editingPlay && (
        <Animated.View style={[styles.editBanner, { opacity: editBannerOpacity, backgroundColor:'#F9E79F', borderColor:'#D4AC0D', borderWidth:1, paddingVertical:12, paddingHorizontal:14, borderRadius:10, flexDirection:'row', alignItems:'center' }] }>
          <Text style={[styles.editBannerText, { fontSize:16, fontWeight:'800', color:'#5C4B00', flex:1 }]}>Editando jugada</Text>
          <Pressable onPress={()=> {
            Animated.timing(editBannerOpacity,{ toValue:0, duration:200, useNativeDriver:true }).start(({finished})=> { if(finished) setEditingPlay(null); });
          }} style={{ backgroundColor:'#D4AC0D', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
            <Text style={{ fontSize:13, fontWeight:'700', color:'#FFFFFF' }}>Cancelar</Text>
          </Pressable>
        </Animated.View>
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
  inlineTotalsOutside:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#F1F4F0', borderWidth:1, borderColor:'#E1E8E3', borderRadius:8, paddingHorizontal:10, paddingVertical:6, marginBottom:6 },
  inlineTotalsOutsideDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  totalsFlexGroup:{ flex:1, flexDirection:'row', justifyContent:'center', gap:14 },
  list:{ flex:1 },
  playCard:{ backgroundColor:'#F8F9FA', borderRadius:8, padding:6, marginBottom:6, borderWidth:1, borderColor:'#E8F1E4' },
  playCardDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  playCardSelected:{ borderColor:'#F1C40F', backgroundColor:'#FFF9E6' },
  rowBetween:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:2 },
  lotteryName:{ fontSize:14, fontWeight:'700', color:'#2D5016' },
  lotteryNameDark:{ color:'#ECF0F1' },
  firstRowWrap:{ flexDirection:'row', flexWrap:'wrap', alignItems:'center', marginBottom:4 },
  scheduleTag:{ marginLeft:6, fontSize:11, fontWeight:'600', color:'#1B4F72', backgroundColor:'#EAF2F8', paddingHorizontal:6, paddingVertical:2, borderRadius:4 },
  scheduleTagDark:{ backgroundColor:'#2C3E50', color:'#AED6F1' },
  playTypeInline:{ marginLeft:6, fontSize:11, fontWeight:'600', color:'#8E44AD', backgroundColor:'#F4ECF7', paddingHorizontal:6, paddingVertical:2, borderRadius:4 },
  playTypeInlineDark:{ backgroundColor:'#5D6D7E', color:'#D2B4DE' },
  noteStronger:{ marginLeft:0, fontSize:13, fontWeight:'700', color:'#0B6B32', maxWidth:150 },
  noteStrongerDark:{ color:'#F0F3F4' },
  topRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 },
  topLeft:{ flex:1, paddingRight:6 },
  lotteryLine:{ flexDirection:'row', flexWrap:'wrap', alignItems:'center' },
  resultText:{ fontSize:10, fontWeight:'600', color:'#2C3E50', textAlign:'right', maxWidth:90, textTransform:'lowercase' },
  resultTextDark:{ color:'#ECF0F1' },
  resultBox:{ alignItems:'flex-end', maxWidth:180 },
  resultLabel:{ fontSize:11, fontWeight:'700', color:'#1F2D3A', backgroundColor:'#EAF4FF', paddingHorizontal:6, paddingVertical:3, borderRadius:6, textAlign:'right' },
  resultLabelDark:{ backgroundColor:'#2C3E50', color:'#D6EAF8' },
  resultUnavailable:{ backgroundColor:'transparent', color:'#566573' },
  resultUnavailableDark:{ backgroundColor:'transparent', color:'#BDC3C7' },
  pendingUnderResult:{ marginTop:2 },
  namePriceRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  namePriceInline:{ flexDirection:'row', alignItems:'center', marginTop:2 },
  priceCalc:{ fontSize:12, fontWeight:'600', color:'#1E8449', marginLeft:6, flexShrink:1 },
  priceCalcDark:{ color:'#58D68D' },
  numbersRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:4 },
  totalInline:{ fontSize:11, fontWeight:'600', color:'#27AE60', marginLeft:8 },
  totalInlineDark:{ color:'#58D68D' },
  statusRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' },
  resultColumn:{ flexDirection:'column', alignItems:'flex-start' },
  resultBadge:{ backgroundColor:'#E8F5E8', borderColor:'#27AE60', borderWidth:1, borderRadius:12, paddingHorizontal:8, paddingVertical:2, fontSize:11, fontWeight:'600', color:'#27AE60' },
  resultBadgeDark:{ backgroundColor:'#2C3E50', borderColor:'#27AE60', color:'#27AE60' },
  pendingText:{ fontSize:10, fontWeight:'600', color:'#7F8C8D', marginTop:2 },
  pendingTextHidden:{ opacity:0 },
  rightInfo:{ alignItems:'flex-end' },
  note:{ fontSize:11, color:'#5D6D7E', flex:1, marginRight:6 },
  noteDark:{ color:'#BDC3C7' },
  playType:{ fontSize:11, fontWeight:'600', color:'#8E44AD', backgroundColor:'#F4ECF7', paddingHorizontal:5, paddingVertical:1, borderRadius:4 },
  playTypeDark:{ color:'#BB8FCE', backgroundColor:'#5D6D7E' },
  numbers:{ fontSize:14, fontWeight:'700', color:'#2D5016', flex:1 },
  numbersDark:{ color:'#ECF0F1' },
  dupNumber:{ backgroundColor:'#FFE878', borderRadius:4, paddingHorizontal:3, paddingVertical:1, fontWeight:'700', color:'#5C4B00' },
  amount:{ fontSize:11, fontWeight:'600', color:'#27AE60' },
  amountDark:{ color:'#58D68D' },
  prize:{ fontSize:11, fontWeight:'600', color:'#7F8C8D' },
  prizeWinner:{ color:'#2E86C1' },
  timestamp:{ fontSize:9, color:'#7F8C8D', fontStyle:'italic' },
  timestampDark:{ color:'#BDC3C7' },
  inlineActionBtn:{ backgroundColor:'#E8F5E8', borderRadius:6, paddingHorizontal:6, paddingVertical:4, marginRight:6, borderWidth:1, borderColor:'#B8D4A8' },
  inlineSelectBtn:{ backgroundColor:'#FFF4D6', borderColor:'#F1C40F' },
  inlineActionTxt:{ fontSize:12, fontWeight:'700', color:'#2D5016' },
  selectCornerBtn:{ position:'absolute', left:2, top:2, width:16, height:16, borderRadius:8, borderWidth:1, borderColor:'rgba(231,76,60,0.6)', backgroundColor:'rgba(231,76,60,0.15)', alignItems:'center', justifyContent:'center', zIndex:10 },
  selectCornerBtnActive:{ backgroundColor:'rgba(231,76,60,0.85)', borderColor:'#C0392B' },
  selectCornerTxt:{ fontSize:9, fontWeight:'700', color:'#C0392B' },
  selectCornerTxtActive:{ color:'#FFFFFF' },
  editUnderPendingBtn:{ marginTop:4, backgroundColor:'#3498DB', paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  editUnderPendingTxt:{ fontSize:11, fontWeight:'700', color:'#FFFFFF' },
  bulkDeleteBtn:{ backgroundColor:'#E74C3C', paddingHorizontal:10, paddingVertical:4, borderRadius:6, marginRight:10 },
  bulkDeleteTxt:{ color:'#FFFFFF', fontSize:11, fontWeight:'700' },
  editBanner:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#F4D03F', paddingHorizontal:10, paddingVertical:6, borderRadius:8, marginBottom:6 },
  editBannerText:{ fontSize:11, fontWeight:'600', color:'#5C4B00', flex:1, marginRight:10 },
  editBannerClose:{ fontSize:12, fontWeight:'700', color:'#5C4B00' },
  loadingContainer:{ flex:1, justifyContent:'center', alignItems:'center', paddingVertical:20 },
  loadingText:{ fontSize:16, color:'#7F8C8D', fontStyle:'italic' },
  loadingTextDark:{ color:'#BDC3C7' },
  footer:{ textAlign:'center', paddingVertical:12, fontSize:12, color:'#7F8C8D' },
  empty:{ textAlign:'center', marginTop:40, fontSize:14, color:'#7F8C8D', fontStyle:'italic' }
});

export default SavedPlaysScreen;
