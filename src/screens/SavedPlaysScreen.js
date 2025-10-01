import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Animated } from 'react-native';
import { View, Text, StyleSheet, Pressable, FlatList, TextInput, ScrollView, RefreshControl, Alert, Platform, Clipboard } from 'react-native';
import FeedbackBanner from '../components/FeedbackBanner';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { canonicalParle } from '../utils/prizeCalculator';

const ITEMS_PER_PAGE = 20;

const getPlayTypeLabel = (playType) => ({
  fijo:'Fijo', corrido:'Corrido', posicion:'Posición', parle:'Parle', centena:'Centena', tripleta:'Tripleta'
}[playType] || playType);

const SavedPlaysScreen = ({ navigation, route }) => {
  // Formatea dinero con exactamente 2 decimales
  const formatMoneyCompact = (n) => {
    return Number(n || 0).toFixed(2);
  };
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
  
  // Estados para modo Santiago
  const [modoSantiago, setModoSantiago] = useState(false);
  const [porcentajeSantiago, setPorcentajeSantiago] = useState(100);
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
  const [copiedBanner, setCopiedBanner] = useState(false);

  const loadSavedPlays = async () => {
    try {
      setIsLoading(true);
      
      // Obtener el ID del usuario actual para filtrar solo sus jugadas
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      // Usar la nueva view v_registro_diario (ya filtrada por día actual en la BD)
      const { data, error } = await supabase
        .from('v_registro_diario')
        .select('*')
        .eq('id_listero', userId)
        .order('fecha_jugada', { ascending: false });
        
      if (error) throw error;
      
      // Mapear los datos de la view al formato esperado por la UI
      const mapped = (data || []).map(r => {
        // Extraer hora en formato AM/PM
        const timestamp = new Date(r.fecha_jugada);
        
        // Calcular monto total (cantidad de números × monto unitario)
        const numbersCount = (r.numeros_jugados || '').split(',').filter(Boolean).length;
        const calculatedTotal = Number((r.monto_unitario * numbersCount).toFixed(2));
        
        // Determinar estado del resultado
        const hasResult = r.resultado !== null && r.resultado !== undefined;
        const hasWin = hasResult && r.numeros_ganadores_jugada && r.numeros_ganadores_jugada.length > 0;
        
        // Crear set de números ganadores para resaltado
        const winningTokens = new Set(r.numeros_ganadores_jugada || []);
        
        return {
          id: r.id_jugada,
          lottery: r.nombre_loteria || 'Lotería',
          lotteryId: r.id_loteria || 'unknown',
          schedule: r.nombre_horario || 'Horario',
          scheduleId: r.id_horario || 'unknown',
          scheduleStart: r.hora_inicio || null,
          scheduleEnd: r.hora_fin || null,
          playType: r.tipo_jugada,
          numbers: r.numeros_jugados,
          amount: r.monto_unitario,
          total: calculatedTotal,
          note: r.nota || '',
          hasPrize: hasWin,
          prize: hasResult ? (hasWin ? 'bingo' : 'no cogió premio') : 'pendiente',
          payAmount: r.monto_a_pagar || 0,
          result: hasResult ? r.resultado : 'no disponible',
          timestamp: timestamp,
          winningTokens: winningTokens
        };
      });
      
      setSavedPlays(mapped);
    } catch(e) { 
      console.error('Error loading saved plays:', e);
    } finally { 
      setIsLoading(false); 
    }
  };

  // Función para cargar el modo Santiago del banco
  const loadModoSantiago = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return;

      // Obtener el banco del listero actual
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

  useFocusEffect(useCallback(()=> { 
    loadSavedPlays(); 
    loadModoSantiago();
  },[]));

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
  // Pagado = suma de premios pagados del día (todas las jugadas de hoy con resultado; las perdidas aportan 0)
  const totalPagadoDia = savedPlays.reduce((s,p)=> s + (p.payAmount || 0), 0);

  const formatTime = ts => ts.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit',hour12:true});

  const renderFilterButton = (value, current, setter, label) => (
    <Pressable style={[styles.filterButton, value===current && styles.filterButtonActive]} onPress={()=> setter(value)}>
      <Text style={[styles.filterButtonText, value===current && styles.filterButtonTextActive]}>{label}</Text>
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
      style={[styles.playCard, selectedIds.has(item.id) && styles.playCardSelected]}
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
            <Text style={styles.lotteryName} numberOfLines={1}>{item.lottery}</Text>
            <Text style={styles.scheduleTag} numberOfLines={1}>{item.schedule}</Text>
            <Text style={styles.playTypeInline}>{getPlayTypeLabel(item.playType)}</Text>
          </View>
          <View style={styles.namePriceInline}>
            {!!item.note && (
              <Text style={styles.noteStronger} numberOfLines={1}>{(item.note || '').toUpperCase()}</Text>
            )}
            <Text style={styles.priceCalc}>${item.amount.toFixed(2)} × {item.numbers.split(',').filter(Boolean).length} = ${item.total.toFixed(2)}</Text>
            {modoSantiago && item.total > 0 && (
              <Text style={[styles.priceCalc, styles.santiagoText]}>
                {porcentajeSantiago}%: ${(item.total * (porcentajeSantiago / 100)).toFixed(2)}
              </Text>
            )}
          </View>
        </View>
  <View style={styles.resultBox}>
          <Text
            style={[
              styles.resultLabel,
              item.result === 'no disponible' && styles.resultUnavailable
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Resultado: {item.result}
          </Text>
          {item.result === 'no disponible' && (
            <Text style={[styles.pendingText, styles.pendingUnderResult]}>⏳ Pendiente</Text>
          )}
          {item.result !== 'no disponible' && (
            <Text style={[
              styles.pendingText,
              styles.pendingUnderResult,
              item.hasPrize ? styles.winText : styles.loseText,
              item.hasPrize && styles.winEmphasis
            ]}>
              {item.hasPrize ? `🏆 bingo · $${formatMoneyCompact(item.payAmount)}` : 'no cogió premio'}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.numbersRow}>
        {(() => {
          const parts = item.numbers.split(',').map(n=> n.trim()).filter(Boolean);
          const counts = parts.reduce((acc,n)=> (acc[n]=(acc[n]||0)+1, acc), {});
          
          // Para parles, también contar duplicados canónicos (1049 == 4910)
          if (item.playType === 'parle') {
            const canonicalCounts = {};
            parts.forEach(n => {
              if (n.length === 4) {
                const canonical = canonicalParle(n);
                canonicalCounts[canonical] = (canonicalCounts[canonical] || 0) + 1;
              }
            });
            // Marcar números duplicados canónicos
            parts.forEach(n => {
              if (n.length === 4) {
                const canonical = canonicalParle(n);
                if (canonicalCounts[canonical] > 1) {
                  counts[n] = Math.max(counts[n] || 1, 2); // Marcar como duplicado
                }
              }
            });
          }
          
          const winningSet = item.winningTokens || new Set();
          
          // Función para normalizar números según el tipo de jugada
          const normalizeNumber = (num, playType) => {
            const digits = num.replace(/[^0-9]/g, '');
            switch(playType) {
              case 'fijo':
              case 'corrido':
                return digits.padStart(2, '0');
              case 'centena':
                return digits.padStart(3, '0');
              case 'parle':
                return digits.padStart(4, '0');
              case 'tripleta':
                return digits.padStart(6, '0');
              default:
                return digits;
            }
          };
          
          return (
            <Text style={styles.numbers}>
              {parts.map((n,i)=> {
                const normalizedN = normalizeNumber(n.trim(), item.playType);
                return (
                  <Text key={i}>
                    {winningSet.has(normalizedN)
                      ? <Text style={styles.winningNumber}>{n}</Text>
                      : (counts[n]>1 ? <Text style={styles.dupNumber}>{n}</Text> : n)
                    }
                    {i < parts.length-1 ? ', ' : ''}
                  </Text>
                );
              })}
            </Text>
          );
        })()}
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          {/* Copiar */}
          <Pressable
            style={styles.copyUnderPendingBtn}
            onPress={async ()=>{
              try {
                // Formato simplificado como modo texto 2.0: "números con monto"
                const numbers = item.numbers;
                const amount = item.amount;
                const text = `${numbers} con ${amount}`;
                if(Platform.OS==='web' && navigator.clipboard?.writeText){
                  await navigator.clipboard.writeText(text);
                } else {
                  Clipboard.setString(text);
                }
                setCopiedBanner(true);
              } catch(e){}
            }}
          >
            <Text style={styles.copyUnderPendingTxt}>Copiar</Text>
          </Pressable>
          {/* Editar */}
          {originMode !== 'Vault' && (
            <Pressable style={styles.editUnderPendingBtn} onPress={()=> {
              const isOpen = (()=> {
                const hi = item.scheduleStart; const hf = item.scheduleEnd; if(!hi || !hf) return true;
                const now = new Date();
                const [shi,smi] = hi.split(':');
                const [shf,smf] = hf.split(':');
                const start = parseInt(shi,10)*60 + parseInt(smi||'0',10);
                const end = parseInt(shf,10)*60 + parseInt(smf||'0',10);
                const current = now.getHours()*60 + now.getMinutes();
                if(start === end) return true;
                if(end > start) return current >= start && current < end;
                return current >= start || current < end;
              })();
              if(!isOpen){
                if(Platform.OS === 'web') { window.alert('No se puede editar porque esta lotería está cerrada'); }
                else { Alert.alert('Cerrada','No se puede editar porque esta lotería está cerrada'); }
                return;
              }
              const targetMode = originMode === 'Texto' ? 'Texto' : (originMode === 'Texto2' ? 'Texto2' : 'Visual');
              const msg = targetMode === 'Texto' ? '¿Abrir esta jugada en modo Texto para editarla?' : (targetMode==='Texto2' ? '¿Abrir esta jugada en modo Texto 2.0 para editarla?' : '¿Abrir esta jugada en modo Visual para editarla?');
              // Serializar el timestamp para evitar warnings de navegación
              const serializableItem = { ...item, timestamp: item.timestamp.toISOString() };
              confirm('Editar', msg, ()=> { setEditingPlay(item); navigation.navigate('MainApp', { editPayload: serializableItem, originMode: targetMode }); });
            }}>
              <Text style={styles.editUnderPendingTxt}>Editar</Text>
            </Pressable>
          )}
        </View>
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
      } catch(e){ }
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
      Animated.timing(editBannerOpacity,{ toValue:1, duration:250, useNativeDriver:false }).start();
    }
  }, [editingPlay]);

  return (
    <View style={styles.container}>
      {copiedBanner && (
        <FeedbackBanner
          type="success"
          message="Copiado"
          onClose={()=> setCopiedBanner(false)}
          autoHideMs={2000}
        />
      )}
      {/* Header compacto */}
      <View style={styles.header}> 
        <Pressable style={styles.backBtn} onPress={()=> navigation.goBack()}><Text style={styles.backTxt}>←</Text></Pressable>
        <Text style={styles.title} numberOfLines={1}>Jugadas Guardadas</Text>
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
          style={styles.searchInput}
          placeholder="Buscar números / nota / lotería..."
          placeholderTextColor={'#95A5A6'}
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
        />
      )}
      {filtersVisible && (
        <View style={styles.filtersPanel}>
          <Text style={styles.panelLabel}>Loterías</Text>
          <View style={styles.chipsRow}>
            {renderFilterButton('all', selectedLotteryFilter, setSelectedLotteryFilter,'Todas')}
            {lotteryOptions.map(l=> <View key={l.id}>{renderFilterButton(l.id, selectedLotteryFilter, setSelectedLotteryFilter, l.name)}</View>)}
          </View>
          <Text style={styles.panelLabel}>Horarios</Text>
          <View style={styles.chipsRow}>
            {renderFilterButton('all', selectedScheduleFilter, setSelectedScheduleFilter,'Todos')}
            {scheduleOptions.map(h=> <View key={h.id}>{renderFilterButton(h.id, selectedScheduleFilter, setSelectedScheduleFilter, h.name)}</View>)}
          </View>
          <Text style={styles.panelLabel}>Tipo de Jugada</Text>
            <View style={styles.chipsRow}>
              {renderFilterButton('all', selectedPlayTypeFilter, setSelectedPlayTypeFilter,'Todas')}
              {playTypeOptions.map(pt=> <View key={pt.value}>{renderFilterButton(pt.value, selectedPlayTypeFilter, setSelectedPlayTypeFilter, pt.label)}</View>)}
            </View>
        </View>
      )}
      <View style={styles.inlineTotalsOutside}>
        {selectionMode && (
          <Pressable style={styles.bulkDeleteBtn} onPress={handleDeleteSelected}>
            <Text style={styles.bulkDeleteTxt}>Eliminar ({selectedIds.size})</Text>
          </Pressable>
        )}
        <View style={styles.totalsFlexGroup}>
          <Text style={styles.totalText}>Recogido: ${totalRecogido.toFixed(2)}</Text>
          {modoSantiago && totalRecogido > 0 && (
            <Text style={[styles.totalText, styles.santiagoText]}>
              {porcentajeSantiago}%: ${(totalRecogido * (porcentajeSantiago / 100)).toFixed(2)}
            </Text>
          )}
          <Text style={styles.totalText}>Pagado: ${totalPagadoDia.toFixed(2)}</Text>
          <Text style={styles.totalText}>Pendiente: ${pendientePago.toFixed(2)}</Text>
          {modoSantiago && pendientePago > 0 && (
            <Text style={[styles.totalText, styles.santiagoText]}>
              {porcentajeSantiago}%: ${(pendientePago * (porcentajeSantiago / 100)).toFixed(2)}
            </Text>
          )}
        </View>
        <Pressable style={[styles.prizeFilterButton, showOnlyWinners && styles.prizeFilterButtonActive]} onPress={()=> setShowOnlyWinners(p=>!p)}>
          <Text style={styles.prizeFilterText}>{showOnlyWinners? '🏆 Ganadores':'🎯 Todos'}</Text>
        </Pressable>
      </View>
      {editingPlay && (
        <Animated.View style={[styles.editBanner, { opacity: editBannerOpacity, backgroundColor:'#F9E79F', borderColor:'#D4AC0D', borderWidth:1, paddingVertical:12, paddingHorizontal:14, borderRadius:10, flexDirection:'row', alignItems:'center' }] }>
          <Text style={[styles.editBannerText, { fontSize:16, fontWeight:'800', color:'#5C4B00', flex:1 }]}>Editando jugada</Text>
          <Pressable onPress={()=> {
            Animated.timing(editBannerOpacity,{ toValue:0, duration:200, useNativeDriver:false }).start(({finished})=> { if(finished) setEditingPlay(null); });
          }} style={{ backgroundColor:'#D4AC0D', paddingVertical:6, paddingHorizontal:10, borderRadius:8 }}>
            <Text style={{ fontSize:13, fontWeight:'700', color:'#FFFFFF' }}>Cancelar</Text>
          </Pressable>
        </Animated.View>
      )}
      {isLoading ? (
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>Cargando...</Text></View>
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
  container:{ flex:1, backgroundColor:'#FFFFFF', padding:12, paddingTop:50 },
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
  santiagoText:{ color:'#8B4513', fontWeight:'700' },
  totalTextDark:{ color:'#ECF0F1' },
  prizeFilterButton:{ backgroundColor:'#F39C12', paddingHorizontal:10, paddingVertical:4, borderRadius:6 },
  prizeFilterButtonActive:{ backgroundColor:'#27AE60' },
  prizeFilterText:{ color:'#FFFFFF', fontSize:10, fontWeight:'600' },
  inlineTotalsOutside:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#F1F4F0', borderWidth:1, borderColor:'#E1E8E3', borderRadius:8, paddingHorizontal:10, paddingVertical:6, marginBottom:6 },
  inlineTotalsOutsideDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  totalsFlexGroup:{ flex:1, flexDirection:'row', flexWrap:'wrap', justifyContent:'center', gap:14 },
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
  topRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:0 },
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
  namePriceInline:{ flexDirection:'row', alignItems:'center', marginTop:0 },
  priceCalc:{ fontSize:12, fontWeight:'600', color:'#1E8449', marginLeft:6, flexShrink:1 },
  priceCalcDark:{ color:'#58D68D' },
  numbersRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginTop:-2, marginBottom:2 },
  totalInline:{ fontSize:11, fontWeight:'600', color:'#27AE60', marginLeft:8 },
  totalInlineDark:{ color:'#58D68D' },
  statusRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' },
  resultColumn:{ flexDirection:'column', alignItems:'flex-start' },
  resultBadge:{ backgroundColor:'#E8F5E8', borderColor:'#27AE60', borderWidth:1, borderRadius:12, paddingHorizontal:8, paddingVertical:2, fontSize:11, fontWeight:'600', color:'#27AE60' },
  resultBadgeDark:{ backgroundColor:'#2C3E50', borderColor:'#27AE60', color:'#27AE60' },
  pendingText:{ fontSize:10, fontWeight:'600', color:'#7F8C8D', marginTop:2 },
  winText:{ color:'#1E8449' },
  winEmphasis:{ fontSize:12.5 },
  loseText:{ color:'#7F8C8D' },
  pendingTextHidden:{ opacity:0 },
  rightInfo:{ alignItems:'flex-end' },
  note:{ fontSize:11, color:'#5D6D7E', flex:1, marginRight:6 },
  noteDark:{ color:'#BDC3C7' },
  playType:{ fontSize:11, fontWeight:'600', color:'#8E44AD', backgroundColor:'#F4ECF7', paddingHorizontal:5, paddingVertical:1, borderRadius:4 },
  playTypeDark:{ color:'#BB8FCE', backgroundColor:'#5D6D7E' },
  numbers:{ fontSize:14, fontWeight:'700', color:'#2D5016', flex:1, lineHeight:16 },
  numbersDark:{ color:'#ECF0F1' },
  dupNumber:{ backgroundColor:'#FFE878', borderRadius:3, paddingHorizontal:2, paddingVertical:0.5, fontWeight:'600', color:'#5C4B00', fontSize:12 },
  winningNumber:{ color:'#1E8449', fontWeight:'800' },
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
  copyUnderPendingBtn:{ marginTop:6, backgroundColor:'#ECF0F1', paddingHorizontal:10, paddingVertical:4, borderRadius:6, borderWidth:1, borderColor:'#D5DBDB' },
  copyUnderPendingTxt:{ fontSize:11, fontWeight:'700', color:'#2C3E50' },
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
