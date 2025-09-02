import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, TextInput, RefreshControl, Modal, Platform, BackHandler, Alert } from 'react-native';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { supabase } from '../supabaseClient';
import { useFocusEffect } from '@react-navigation/native';
import { useCache } from '../contexts/CacheContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import ScreenWrapper from '../components/ScreenWrapper';
import { createShadowStyle } from '../utils/shadowUtils';
import DropdownPicker from '../components/DropdownPicker';

const LimitNumberScreen = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  return (
    <ScreenWrapper>
      <LimitNumberContent
        navigation={navigation}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    </ScreenWrapper>
  );
};

const LimitNumberContent = ({ navigation, isDarkMode, onToggleDarkMode }) => {
  const { cache, userRole: cacheUserRole, updateCacheData } = useCache();
  const { refreshing: cacheRefreshing, onRefresh: cacheOnRefresh } = usePullToRefresh('numberLimits');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [role, setRole] = useState(null);

  // Estados de modales
  const [limitedNumberModalVisible, setLimitedNumberModalVisible] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);

  // Datos locales (placeholder). Cada ítem: { id, number, limit }
  const [limitarNumero, setLimitarNumero] = useState([]); // no usado por ahora (lado izquierdo = formulario)
  const [numerosLimitados, setNumerosLimitados] = useState([]); // lista derecha

  // Datos de contexto
  const [bankId, setBankId] = useState(null);
  const [lotteries, setLotteries] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [jugadas, setJugadas] = useState([]);

  // Selecciones
  const [selectedLottery, setSelectedLottery] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedJugada, setSelectedJugada] = useState(null);

  // Estados UI
  const [loadingJugadas, setLoadingJugadas] = useState(false);
  const [loadingNumeros, setLoadingNumeros] = useState(false);
  const [creating, setCreating] = useState(false);
  // Filtros globales
  const [filterLotteryId, setFilterLotteryId] = useState(null); // null = todas
  const [filterJugadaKey, setFilterJugadaKey] = useState(null); // null = todas
  const [filtersVisible, setFiltersVisible] = useState(false);
  // Jugadas activas globales para filtros y validación
  const [activeJugadas, setActiveJugadas] = useState([]); // [{jugada}]
  const activeJugadasSet = new Set(activeJugadas.map(j=>j.jugada));

  // Panel derecho (limite_numero) estados separados
  const [selectedLottery2, setSelectedLottery2] = useState(null);
  const [schedules2, setSchedules2] = useState([]);
  const [selectedSchedule2, setSelectedSchedule2] = useState(null);
  const [jugadas2, setJugadas2] = useState([]);
  const [selectedJugada2, setSelectedJugada2] = useState(null);
  const [tempNumber2, setTempNumber2] = useState('');
  const [tempLimit2, setTempLimit2] = useState('');
  const [creating2, setCreating2] = useState(false);
  const [limitesNumeros, setLimitesNumeros] = useState([]);
  const [loadingLimites, setLoadingLimites] = useState(false);
  const [statusMsg2, setStatusMsg2] = useState(null);

  // Form states para modales
  const [tempNumber, setTempNumber] = useState('');
  const [tempLimit, setTempLimit] = useState('');
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'error'|'ok', text }

  const resetForm = () => {
    setTempNumber('');
    setTempLimit('');
  };

  const openModal = (modalType) => {
    resetForm();
    if (modalType === 'left') {
      setLimitedNumberModalVisible(true);
    } else {
      setLimitModalVisible(true);
    }
  };

  const closeModal = (modalType) => {
    if (modalType === 'left') {
      setLimitedNumberModalVisible(false);
    } else {
      setLimitModalVisible(false);
    }
    resetForm();
  };

  const addItem = (panel) => {
    if (!/^\d+$/.test(tempNumber)) return; // número inválido
    if (!tempLimit || isNaN(parseFloat(tempLimit)) || parseFloat(tempLimit) <= 0) return; // límite inválido
    const item = { id: Date.now(), number: tempNumber, limit: parseFloat(tempLimit) };
    if (panel === 'left') {
      setLimitarNumero(prev => [item, ...prev]);
    } else {
      setNumerosLimitados(prev => [item, ...prev]);
    }
    resetForm();
    setLimitedNumberModalVisible(false);
    setLimitModalVisible(false);
  };

  const renderItem = ({ item }) => (
    <View style={[styles.item, isDarkMode && styles.itemDark]}>
      <Text style={[styles.itemNumber, isDarkMode && styles.itemNumberDark]}>#{item.number}</Text>
      <Text style={[styles.itemLimit, isDarkMode && styles.itemLimitDark]}>Límite: {item.limit}</Text>
    </View>
  );

  // Cargar rol para mostrar opciones del sidebar
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase
            .from('profiles')
            .select('role, id_banco')
            .eq('id', user.id)
            .single();
          if (data?.role) {
            setRole(data.role);
            const bId = data.role === 'admin' ? user.id : data.id_banco;
            setBankId(bId);
          }
        }
      } catch (e) {
        // silencioso
      }
    };
    fetchRole();
  }, []);

  // Cargar loterías
  useEffect(() => {
    const loadLotteries = async () => {
      if (!bankId) return;
      try {
        const { data, error } = await supabase
          .from('loteria')
          .select('id, nombre')
          .eq('id_banco', bankId)
          .order('nombre');
        if (!error) setLotteries(data || []);
      } catch {}
    };
    loadLotteries();
  }, [bankId]);

  const handleSelectLottery = async (lot) => {
    setSelectedLottery(lot);
    setSelectedSchedule(null);
    setSelectedJugada(null);
    setSchedules([]);
    setJugadas([]);
    if (lot) {
      try {
        const { data } = await supabase
          .from('horario')
          .select('id, nombre')
          .eq('id_loteria', lot.id)
          .order('nombre');
        setSchedules(data || []);
      } catch {}
    }
  };

  const handleSelectSchedule = async (sch) => {
    setSelectedSchedule(sch);
    setSelectedJugada(null);
    setJugadas([]);
    if (sch && bankId) {
      setLoadingJugadas(true);
      try {
        const { data, error } = await supabase
          .from('jugadas_activas')
          .select('jugadas')
          .eq('id_banco', bankId)
          .maybeSingle();
        if (!error) {
          const jugadasJson = data?.jugadas || {};
          const activeList = Object.entries(jugadasJson)
            .filter(([,v]) => v)
            .map(([k]) => ({ id: k, jugada: k }))
            .sort((a,b)=> JUGADA_ORDER.indexOf(a.jugada)-JUGADA_ORDER.indexOf(b.jugada));
          setJugadas(activeList);
        }
      } catch {}
      setLoadingJugadas(false);
    }
  };

  const DIGIT_RULES = { fijo:2, corrido:2, posicion:2, parle:4, centena:3, tripleta:6 };
  const JUGADA_ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];

  // Formatear número mostrado con ceros a la izquierda
  const formatNumberDisplay = (raw, jugadaKey) => {
    const len = DIGIT_RULES[jugadaKey] || 2;
    return raw.toString().padStart(len, '0');
  };

  // Cargar lista de números limitados - siempre hacer fetch para datos actualizados
  const loadNumerosLimitados = async (forceRefresh = false) => {
    if (!bankId) return;
    
    setLoadingNumeros(true);
    try {
      let query = supabase
        .from('numero_limitado')
        .select('id, numero, id_horario, jugada, horario: id_horario (nombre, loteria: id_loteria (nombre))')
        .eq('id_banco', bankId)
        .order('numero', { ascending: true });
      const { data, error } = await query;
      if (error) {
        console.error('[numero_limitado] Error consulta principal:', error);
        return;
      }
      const rows = (data || []).map(r => ({ ...r, jugadaKey: r.jugada }));
      const sorted = rows.slice().sort((a,b)=> {
        const numDiff = (a.numero||0)-(b.numero||0);
        if (numDiff !== 0) return numDiff;
        const ja = a.jugadaKey || '';
        const jb = b.jugadaKey || '';
        const ia = JUGADA_ORDER.indexOf(ja);
        const ib = JUGADA_ORDER.indexOf(jb);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
      setNumerosLimitados(sorted);
    } catch (e) {
      console.error('[numero_limitado] Excepción:', e);
    }
    setLoadingNumeros(false);
  };

  useEffect(() => { loadNumerosLimitados(true); }, [bankId]);
  useEffect(() => { loadLimitesNumeros(true); }, [bankId]);

  // Cargar jugadas activas globales
  const loadActives = useCallback(async () => {
    if(!bankId) return;
    try {
      const { data, error } = await supabase
        .from('jugadas_activas')
        .select('jugadas')
        .eq('id_banco', bankId)
        .maybeSingle();
      if (!error) {
        const jugadasJson = data?.jugadas || {};
        const activeList = Object.entries(jugadasJson)
          .filter(([,v]) => v)
          .map(([k]) => ({ jugada: k }))
          .sort((a,b)=> JUGADA_ORDER.indexOf(a.jugada)-JUGADA_ORDER.indexOf(b.jugada));
        setActiveJugadas(activeList);
      }
    } catch {}
  }, [bankId]);

  useEffect(()=> { loadActives(); }, [loadActives]);

  // Refresco al enfocar la pantalla para que el estado (jugadas activas/inactivas) sea inmediato
  useFocusEffect(
    useCallback(() => {
      if (bankId) {
        loadActives();
        loadNumerosLimitados(true);
        loadLimitesNumeros(true);
      }
    }, [bankId, loadActives])
  );

  // ========== ANDROID BACK HANDLER ==========
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Cerrar Aplicación',
          '¿Estás seguro de que quieres salir?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', onPress: () => BackHandler.exitApp() }
          ]
        );
        return true; // Prevenir navegación hacia atrás
      });

      return () => backHandler.remove();
    }
  }, []);

  const creatingDisabled = !selectedLottery || !selectedSchedule || !selectedJugada || tempNumber.length === 0;

  const handleCreateLimitedNumber = async () => {
    if (creatingDisabled) return;
    const jugadaKey = selectedJugada.jugada;
    const expected = DIGIT_RULES[jugadaKey] || 2;
    const padded = tempNumber.padStart(expected, '0');
    if (padded.length !== expected) return;
    // Almacenar como entero (leading zeros se pierden al guardar)
    const numericValue = parseInt(padded, 10);
    setStatusMsg(null);
    // Verificar duplicado: mismo horario, misma jugada, mismo número
    try {
      const { data: dupData, error: dupError } = await supabase
        .from('numero_limitado')
        .select('id')
        .eq('id_banco', bankId)
  .eq('id_horario', selectedSchedule.id)
  .eq('jugada', selectedJugada.jugada)
        .eq('numero', numericValue)
        .limit(1);
      if (!dupError && dupData && dupData.length > 0) {
        setStatusMsg({ type: 'error', text: 'Ya existe ese número para esa jugada y horario.' });
        return;
      }
    } catch {}
    // Validación de conflicto smallint para tripleta 6 dígitos
    setCreating(true);
    try {
      const { error } = await supabase.from('numero_limitado').insert({
        id_banco: bankId,
        id_horario: selectedSchedule.id,
        jugada: selectedJugada.jugada,
        numero: numericValue,
        created_at: new Date().toISOString()
      });
      if (!error) {
        resetForm();
        setLimitedNumberModalVisible(false);
        await loadNumerosLimitados(true);
        setStatusMsg({ type: 'ok', text: 'Número limitado guardado.' });
        setTimeout(()=> setStatusMsg(null), 2500);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (item) => {
    try {
      const { error } = await supabase.from('numero_limitado').delete().eq('id', item.id);
      if (!error) {
        await loadNumerosLimitados(true);
      }
    } catch {}
  };

  // ---------- Panel derecho: limite_numero ----------
  const handleSelectLottery2 = async (lot) => {
    setSelectedLottery2(lot);
    setSelectedSchedule2(null);
    setSelectedJugada2(null);
    setSchedules2([]);
    setJugadas2([]);
    if(lot){
      try {
        const { data } = await supabase
          .from('horario')
          .select('id, nombre')
          .eq('id_loteria', lot.id)
          .order('nombre');
        setSchedules2(data||[]);
      } catch {}
    }
  };

  const handleSelectSchedule2 = async (sch) => {
    setSelectedSchedule2(sch);
    setSelectedJugada2(null);
    setJugadas2([]);
    if(sch && bankId){
      try {
        const { data, error } = await supabase
          .from('jugadas_activas')
          .select('jugadas')
          .eq('id_banco', bankId)
          .maybeSingle();
        if (!error) {
          const jugadasJson = data?.jugadas || {};
          const activeList = Object.entries(jugadasJson)
            .filter(([,v]) => v)
            .map(([k]) => ({ id: k, jugada: k }))
            .sort((a,b)=> JUGADA_ORDER.indexOf(a.jugada)-JUGADA_ORDER.indexOf(b.jugada));
          setJugadas2(activeList);
        }
      } catch {}
    }
  };

  const loadLimitesNumeros = async (forceRefresh = false) => {
    if(!bankId) return;
    
    setLoadingLimites(true);
    try {
      const { data, error } = await supabase
        .from('limite_numero')
        .select('id, numero, limite, id_horario, jugada, horario: id_horario (nombre, loteria: id_loteria (nombre))')
        .eq('id_banco', bankId)
        .order('numero', { ascending:true });
      if (error) {
        console.error('[limite_numero] Error consulta principal:', error);
        return;
      }
      const rows = (data || []).map(r => ({ ...r, jugadaKey: r.jugada }));
      const sorted = rows.slice().sort((a,b)=> {
        const numDiff = (a.numero||0)-(b.numero||0);
        if(numDiff!==0) return numDiff;
        const ja=a.jugadaKey||''; const jb=b.jugadaKey||'';
        const ia=JUGADA_ORDER.indexOf(ja); const ib=JUGADA_ORDER.indexOf(jb);
        return (ia===-1?999:ia)-(ib===-1?999:ib);
      });
      setLimitesNumeros(sorted);
    } catch (e) {
      console.error('[limite_numero] Excepción:', e);
    }
    setLoadingLimites(false);
  };

  const creatingDisabled2 = !selectedLottery2 || !selectedSchedule2 || !selectedJugada2 || tempNumber2.length===0 || !tempLimit2;

  const handleCreateLimiteNumero = async () => {
    if(creatingDisabled2) return;
    const jugadaKey = selectedJugada2.jugada;
    const expected = DIGIT_RULES[jugadaKey] || 2;
    const padded = tempNumber2.padStart(expected,'0');
    const numericValue = parseInt(padded,10);
    setStatusMsg2(null);
    // Duplicado
    try {
      const { data: dup, error: dupErr } = await supabase
        .from('limite_numero')
        .select('id')
        .eq('id_banco', bankId)
  .eq('id_horario', selectedSchedule2.id)
  .eq('jugada', selectedJugada2.jugada)
        .eq('numero', numericValue)
        .limit(1);
      if(!dupErr && dup && dup.length>0){
        setStatusMsg2({type:'error', text:'Ya existe ese límite para esa jugada/horario.'});
        return;
      }
    } catch {}
    setCreating2(true);
    try {
      const { error } = await supabase.from('limite_numero').insert({
        id_banco: bankId,
        id_horario: selectedSchedule2.id,
        jugada: selectedJugada2.jugada,
        numero: numericValue,
        limite: parseInt(tempLimit2,10),
        created_at: new Date().toISOString()
      });
      if(!error){
        setTempNumber2(''); setTempLimit2(''); setSelectedJugada2(null);
        setLimitModalVisible(false);
        await loadLimitesNumeros(true);
        setStatusMsg2({type:'ok', text:'Límite guardado.'});
        setTimeout(()=> setStatusMsg2(null), 2500);
      }
    } finally { setCreating2(false); }
  };

  const handleDeleteLimite = async (item) => {
    try {
      const { error } = await supabase.from('limite_numero').delete().eq('id', item.id);
      if(!error) {
        await loadLimitesNumeros(true);
      }
    } catch {}
  };

  // Filtrado derivado
  const filteredNumerosLimitados = numerosLimitados.filter(item => {
    if (filterLotteryId && item.horario?.loteria?.nombre) {
      // Necesitamos id, pero sólo tenemos nombre en la selección anidada; el id de lotería no fue seleccionado.
      // Alternativa: comparar por nombre (suponiendo único por banco).
      const lotName = lotteries.find(l=> l.id===filterLotteryId)?.nombre;
      if (lotName && item.horario?.loteria?.nombre !== lotName) return false;
    }
    if (filterJugadaKey && item.jugadaKey !== filterJugadaKey) return false;
    return true;
  });
  const filteredLimitesNumeros = limitesNumeros.filter(item => {
    if (filterLotteryId && item.horario?.loteria?.nombre) {
      const lotName = lotteries.find(l=> l.id===filterLotteryId)?.nombre;
      if (lotName && item.horario?.loteria?.nombre !== lotName) return false;
    }
    if (filterJugadaKey && item.jugadaKey !== filterJugadaKey) return false;
    return true;
  });

  // Preparar opciones para dropdowns
  const prepareLotteryOptions = () => {
    return lotteries.map(l => ({ label: l.nombre, value: l.id, data: l }));
  };

  const prepareScheduleOptions = (selectedLot) => {
    if (!selectedLot) return [];
    const schedulesList = selectedLot === selectedLottery ? schedules : schedules2;
    return schedulesList.map(s => ({ label: s.nombre, value: s.id, data: s }));
  };

  const prepareJugadaOptions = (selectedSch, isModal2 = false) => {
    if (!selectedSch) return [];
    const jugadasList = isModal2 ? jugadas2 : jugadas;
    return jugadasList.map(j => ({ label: j.jugada, value: j.id, data: j }));
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.header, isDarkMode && styles.headerDark]}>
        <SideBarToggle inline onToggle={() => setSidebarVisible(!sidebarVisible)} style={styles.sidebarButton} />
        <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>Límites</Text>
        <TouchableOpacity style={styles.filterToggleBtn} onPress={()=> setFiltersVisible(v=>!v)}>
          <Text style={styles.filterToggleText}>🔍 Filtros</Text>
        </TouchableOpacity>
      </View>

      {filtersVisible && (
        <View style={[styles.filtersPopover, isDarkMode && styles.filtersPopoverDark]}>
          <View style={[styles.filterBox, isDarkMode && styles.selectorBoxDark]}>
            <TouchableOpacity style={[styles.filterChip, filterLotteryId===null && styles.filterChipActive]} onPress={()=> setFilterLotteryId(null)}>
              <Text style={[styles.filterChipText, filterLotteryId===null && styles.filterChipTextActive]}>Todas Loterías</Text>
            </TouchableOpacity>
            {lotteries.map(l => (
              <TouchableOpacity key={l.id} style={[styles.filterChip, filterLotteryId===l.id && styles.filterChipActive]} onPress={()=> setFilterLotteryId(prev => prev===l.id? null : l.id)}>
                <Text style={[styles.filterChipText, filterLotteryId===l.id && styles.filterChipTextActive]}>{l.nombre}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.filterBox, isDarkMode && styles.selectorBoxDark]}>
            <TouchableOpacity style={[styles.filterChip, filterJugadaKey===null && styles.filterChipActive]} onPress={()=> setFilterJugadaKey(null)}>
              <Text style={[styles.filterChipText, filterJugadaKey===null && styles.filterChipTextActive]}>Todas Jugadas</Text>
            </TouchableOpacity>
            {activeJugadas.map(j => (
              <TouchableOpacity key={j.jugada} style={[styles.filterChip, filterJugadaKey===j.jugada && styles.filterChipActive]} onPress={()=> setFilterJugadaKey(prev => prev===j.jugada? null : j.jugada)}>
                <Text style={[styles.filterChipText, filterJugadaKey===j.jugada && styles.filterChipTextActive]}>{j.jugada}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.panelsRow}>
        {/* Panel Números limitados (ahora a la izquierda) */}
        <View style={[styles.panel, isDarkMode && styles.panelDark]}>
          <View style={styles.panelHeaderRow}>
            <Text style={[styles.panelTitle, isDarkMode && styles.panelTitleDark]}>Números limitados</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => openModal('left')}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listBody}>
            {loadingNumeros ? (
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>Cargando...</Text>
            ) : numerosLimitados.length === 0 ? (
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>vacio</Text>
            ) : (
              <FlatList
                data={filteredNumerosLimitados}
                keyExtractor={i => i.id.toString()}
                refreshControl={
                  <RefreshControl
                    refreshing={cacheUserRole === 'admin' ? cacheRefreshing : false}
                    onRefresh={cacheUserRole === 'admin' ? cacheOnRefresh : undefined}
                    colors={['#27AE60']}
                    tintColor="#27AE60"
                  />
                }
                renderItem={({item}) => (
                  <View style={[styles.item, isDarkMode && styles.itemDark, styles.itemRow]}> 
                    <View style={styles.itemContent}>
          <Text style={[styles.itemNumber, isDarkMode && styles.itemNumberDark, !activeJugadasSet.has(item.jugadaKey) && styles.inactiveJugada]}>
                        {(item.horario?.loteria?.nombre || '') + (item.horario?.loteria?.nombre ? ' - ' : '') + (item.horario?.nombre || '')}
                      </Text>
          <Text style={[styles.itemLimit, isDarkMode && styles.itemLimitDark, !activeJugadasSet.has(item.jugadaKey) && styles.inactiveJugada]}>
                        {formatNumberDisplay(item.numero, item.jugadaKey)} {item.jugadaKey ? `(${item.jugadaKey})` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                      <Text style={styles.deleteBtnText}>X</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>

        {/* Panel Limite de números (derecha) */}
        <View style={[styles.panel, isDarkMode && styles.panelDark]}>
          <View style={styles.panelHeaderRow}>
            <Text style={[styles.panelTitle, isDarkMode && styles.panelTitleDark]}>Limite de números</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => openModal('right')}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.listBody}>
            {loadingLimites ? (
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>Cargando...</Text>
            ) : filteredLimitesNumeros.length === 0 ? (
              <Text style={[styles.emptyText, isDarkMode && styles.emptyTextDark]}>vacio</Text>
            ) : (
              <FlatList
                data={filteredLimitesNumeros}
                keyExtractor={i=> i.id.toString()}
                refreshControl={
                  <RefreshControl
                    refreshing={cacheUserRole === 'admin' ? cacheRefreshing : false}
                    onRefresh={cacheUserRole === 'admin' ? cacheOnRefresh : undefined}
                    colors={['#27AE60']}
                    tintColor="#27AE60"
                  />
                }
                renderItem={({item}) => (
                  <View style={[styles.item, isDarkMode && styles.itemDark, styles.itemRow]}>
                    <View style={styles.itemContent}>
                      <Text style={[styles.itemNumber, isDarkMode && styles.itemNumberDark, !activeJugadasSet.has(item.jugadaKey) && styles.inactiveJugada]}>
                        {(item.horario?.loteria?.nombre || '') + (item.horario?.loteria?.nombre ? ' - ' : '') + (item.horario?.nombre || '')}
                      </Text>
                      <Text style={[styles.itemLimit, isDarkMode && styles.itemLimitDark, !activeJugadasSet.has(item.jugadaKey) && styles.inactiveJugada]}>
                        {String(item.numero).padStart((DIGIT_RULES[item.jugadaKey]||2),'0')} {item.jugadaKey? `(${item.jugadaKey})`: ''}  Límite: {item.limite}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.deleteBtn} onPress={()=> handleDeleteLimite(item)}>
                      <Text style={styles.deleteBtnText}>X</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </View>

      {/* Modal para números limitados */}
      {limitedNumberModalVisible && (
        <Modal
          visible={true}
          transparent={true}
          onRequestClose={() => closeModal('left')}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                Números Limitados
              </Text>
              <TouchableOpacity onPress={() => closeModal('left')}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.selectorRow}>
              <View style={styles.selectorColumn}>
                <DropdownPicker
                  label="Lotería"
                  value={selectedLottery?.nombre}
                  onSelect={(item) => handleSelectLottery(item.data)}
                  options={prepareLotteryOptions()}
                  placeholder="Seleccionar lotería..."
                />
              </View>
              <View style={styles.selectorColumn}>
                <DropdownPicker
                  label="Horario"
                  value={selectedSchedule?.nombre}
                  onSelect={(item) => handleSelectSchedule(item.data)}
                  options={prepareScheduleOptions(selectedLottery)}
                  placeholder={selectedLottery ? "Seleccionar horario..." : "Selecciona lotería"}
                  disabled={!selectedLottery}
                />
              </View>
            </View>
            
            <View style={styles.selectorRow}>
              <View style={[styles.selectorColumn, { flex: 1 }] }>
                <DropdownPicker
                  label="Jugada"
                  value={selectedJugada?.jugada}
                  onSelect={(item) => setSelectedJugada(item.data)}
                  options={prepareJugadaOptions(selectedSchedule)}
                  placeholder={selectedSchedule ? (loadingJugadas ? "Cargando..." : "Seleccionar jugada...") : "Selecciona horario"}
                  disabled={!selectedSchedule || loadingJugadas}
                />
              </View>
              <View style={[styles.selectorColumn, { flex: 1 }]}>
                <Text style={styles.selectorLabel}>Número</Text>
                <TextInput
                  placeholder={selectedJugada ? '0'.repeat(DIGIT_RULES[selectedJugada.jugada] || 2) : '000'}
                  placeholderTextColor="#95a5a6"
                  value={tempNumber}
                  onChangeText={t => {
                    const clean = t.replace(/[^0-9]/g,'');
                    const maxLen = selectedJugada ? (DIGIT_RULES[selectedJugada.jugada] || 2) : 6;
                    setTempNumber(clean.slice(0, maxLen));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, isDarkMode && styles.inputDark]}
                />
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => closeModal('left')}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                disabled={creatingDisabled || creating} 
                style={[styles.modalButton, styles.saveButton, (creatingDisabled||creating) && styles.saveBtnDisabled]} 
                onPress={handleCreateLimitedNumber}
              >
                <Text style={styles.modalButtonText}>{creating ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
            
            {selectedJugada && tempNumber.length>0 && (
              <Text style={styles.previewText}>Previsualización: {formatNumberDisplay(tempNumber, selectedJugada.jugada)}</Text>
            )}
            {statusMsg && (
              <Text style={[styles.statusMsg, statusMsg.type==='error' ? styles.statusError : styles.statusOk]}>{statusMsg.text}</Text>
            )}
          </View>
        </View>
        </Modal>
      )}

      {/* Modal para límite de números */}
      {limitModalVisible && (
        <Modal
          visible={true}
          transparent={true}
          onRequestClose={() => closeModal('right')}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDarkMode && styles.modalContentDark]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && styles.modalTitleDark]}>
                Límite de Números
              </Text>
              <TouchableOpacity onPress={() => closeModal('right')}>
                <Text style={styles.modalCloseButton}>×</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.selectorRow}>
              <View style={styles.selectorColumn}>
                <DropdownPicker
                  label="Lotería"
                  value={selectedLottery2?.nombre}
                  onSelect={(item) => handleSelectLottery2(item.data)}
                  options={prepareLotteryOptions()}
                  placeholder="Seleccionar lotería..."
                />
              </View>
              <View style={styles.selectorColumn}>
                <DropdownPicker
                  label="Horario"
                  value={selectedSchedule2?.nombre}
                  onSelect={(item) => handleSelectSchedule2(item.data)}
                  options={prepareScheduleOptions(selectedLottery2)}
                  placeholder={selectedLottery2 ? "Seleccionar horario..." : "Selecciona lotería"}
                  disabled={!selectedLottery2}
                />
              </View>
            </View>
            
            <View style={styles.selectorRow}>
              <View style={[styles.selectorColumn,{flex:1}]}> 
                <DropdownPicker
                  label="Jugada"
                  value={selectedJugada2?.jugada}
                  onSelect={(item) => setSelectedJugada2(item.data)}
                  options={prepareJugadaOptions(selectedSchedule2, true)}
                  placeholder={selectedSchedule2 ? "Seleccionar jugada..." : "Selecciona horario"}
                  disabled={!selectedSchedule2}
                />
              </View>
              <View style={[styles.selectorColumn,{flex:1}]}> 
                <Text style={styles.selectorLabel}>Número</Text>
                <TextInput
                  placeholder={selectedJugada2 ? '0'.repeat(DIGIT_RULES[selectedJugada2.jugada]||2) : '000'}
                  placeholderTextColor="#95a5a6"
                  value={tempNumber2}
                  onChangeText={t=>{
                    const clean=t.replace(/[^0-9]/g,'');
                    const maxLen = selectedJugada2 ? (DIGIT_RULES[selectedJugada2.jugada]||2) : 6;
                    setTempNumber2(clean.slice(0,maxLen));
                  }}
                  keyboardType="numeric"
                  style={[styles.input, isDarkMode && styles.inputDark]}
                />
              </View>
              <View style={[styles.selectorColumn,{flex:1}]}> 
                <Text style={styles.selectorLabel}>Límite</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor="#95a5a6"
                  value={tempLimit2}
                  onChangeText={t=> setTempLimit2(t.replace(/[^0-9]/g,''))}
                  keyboardType="numeric"
                  style={[styles.input, isDarkMode && styles.inputDark]}
                />
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => closeModal('right')}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                disabled={creatingDisabled2 || creating2} 
                style={[styles.modalButton, styles.saveButton, (creatingDisabled2||creating2) && styles.saveBtnDisabled]} 
                onPress={handleCreateLimiteNumero}
              >
                <Text style={styles.modalButtonText}>{creating2? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
            
            {selectedJugada2 && tempNumber2.length>0 && (
              <Text style={styles.previewText}>Previsualización: {tempNumber2.padStart((DIGIT_RULES[selectedJugada2.jugada]||2),'0')}</Text>
            )}
            {statusMsg2 && (
              <Text style={[styles.statusMsg, statusMsg2.type==='error'? styles.statusError: styles.statusOk]}>{statusMsg2.text}</Text>
            )}
          </View>
        </View>
        </Modal>
      )}

      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        role={role}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FDF5' },
  containerDark: { backgroundColor: '#1a252f' },
  header: {
    height: 90,
    backgroundColor: '#F8F9FA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.08,
      radius: 3,
      elevation: 3,
    }),
  },
  sidebarButton: {
    marginRight: 12,
    marginLeft: 4,
    marginTop: 2,
  },
  headerDark: { backgroundColor: '#2c3e50', borderBottomColor: '#34495e' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#2C3E50', fontSize: 18, fontWeight: '600', marginRight: 44 },
  headerTitleDark: { color: '#ecf0f1' },
  panelsRow: { flexDirection: 'row', flex: 1, padding: 16, gap: 14 },
  panel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    ...createShadowStyle({
      color: '#000',
      offsetY: 2,
      opacity: 0.06,
      radius: 5,
      elevation: 2,
    }),
  },
  panelDark: { backgroundColor: '#2c3e50' },
  panelHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: Platform.OS === 'android' ? 16 : 12,
    paddingHorizontal: Platform.OS === 'android' ? 4 : 0,
  },
  panelTitle: { fontSize: 18, fontWeight: '600', color: '#2C3E50' },
  panelTitleDark: { color: '#ecf0f1' },
  addBtn: { 
    backgroundColor: '#27ae60', 
    width: Platform.OS === 'android' ? 48 : 42, 
    height: Platform.OS === 'android' ? 48 : 42, 
    borderRadius: Platform.OS === 'android' ? 16 : 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    ...(Platform.OS === 'android' && { marginLeft: -8 }),
    ...createShadowStyle(2),
  },
  addBtnText: { 
    color: '#fff', 
    fontSize: Platform.OS === 'android' ? 28 : 26, 
    fontWeight: '700', 
    marginTop: -3 
  },
  inlineForm: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f4f6f7', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, fontSize: 14, color: '#2c3e50' },
  inputDark: { backgroundColor: '#34495e', color: '#ecf0f1' },
  saveBtn: { backgroundColor: '#2980b9', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  saveBtnDisabled: { backgroundColor: '#95a5a6' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  selectorRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  selectorColumn: { flex: 1 },
  selectorLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, color: '#2c3e50' },
  selectorBox: { backgroundColor: '#f4f6f7', borderRadius: 10, padding: 6, flexDirection: 'row', flexWrap: 'wrap', minHeight: 44 },
  selectorBoxDark: { backgroundColor: '#34495e' },
  selectorOption: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e9ecef', borderRadius: 8, margin: 4 },
  selectorOptionActive: { backgroundColor: '#27ae60' },
  selectorOptionText: { fontSize: 12, color: '#2c3e50', fontWeight: '500' },
  selectorOptionTextActive: { color: '#fff' },
  filterBox: { flexDirection:'row', flexWrap:'wrap', backgroundColor:'#f4f6f7', borderRadius:10, padding:6, marginBottom:8 },
  filterChip: { paddingHorizontal:10, paddingVertical:6, backgroundColor:'#e9ecef', borderRadius:8, margin:4 },
  filterChipActive: { backgroundColor:'#27ae60' },
  filterChipText: { fontSize:11, color:'#2c3e50', fontWeight:'500' },
  filterChipTextActive: { color:'#fff' },
  filterToggleBtn: { paddingHorizontal:14, paddingVertical:8, backgroundColor:'#27ae60', borderRadius:10, marginBottom:8 },
  filterToggleText: { color:'#fff', fontWeight:'600', fontSize:12 },
  filtersPopover: { backgroundColor:'#ffffff', padding:12, borderBottomWidth:1, borderColor:'#e0e0e0' },
  filtersPopoverDark: { backgroundColor:'#2c3e50', borderColor:'#34495e' },
  selectorEmpty: { fontSize: 12, fontStyle: 'italic', color: '#7f8c8d', margin: 4 },
  selectorHint: { fontSize: 12, color: '#95a5a6', margin: 4 },
  previewText: { fontSize: 12, color: '#2c3e50', marginTop: 6, fontStyle: 'italic' },
  warningText: { fontSize: 10, color: '#e67e22', marginTop: 4 },
  statusMsg: { marginTop:6, fontSize:12, fontWeight:'600' },
  statusError: { color:'#c0392b' },
  statusOk: { color:'#27ae60' },
  listBody: { flex: 1 },
  emptyText: { fontSize: 14, fontStyle: 'italic', color: '#7f8c8d' },
  emptyTextDark: { color: '#bdc3c7' },
  // Ítems más compactos para ver más registros por pantalla
  item: { backgroundColor: '#f8f9fa', borderRadius: 8, padding: 8, marginBottom: 6, borderLeftWidth: 4, borderLeftColor: '#27ae60' },
  itemDark: { backgroundColor: '#34495e' },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemContent: { flex: 1, paddingRight: 8 },
  itemNumber: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  itemNumberDark: { color: '#ecf0f1' },
  itemLimit: { fontSize: 12, marginTop: 2, color: '#34495e' },
  itemLimitDark: { color: '#bdc3c7' },
  inactiveJugada: { color:'#c0392b' },
  deleteBtn: { backgroundColor:'#c0392b', paddingHorizontal:10, paddingVertical:6, borderRadius:6 },
  deleteBtnText: { color:'#fff', fontSize:9, fontWeight:'700' },
  
  // Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalContentDark: {
    backgroundColor: '#2c3e50',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalTitleDark: {
    color: '#ecf0f1',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#95a5a6',
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 10,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
  },
  saveButton: {
    backgroundColor: '#27ae60',
  },
  modalButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default LimitNumberScreen;
