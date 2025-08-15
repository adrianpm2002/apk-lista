import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { supabase } from '../supabaseClient';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
import MoneyInputField from '../components/MoneyInputField';
import PlaysInputField from '../components/PlaysInputField';
import ActionButton from '../components/ActionButton';
import BatteryButton from '../components/BatteryButton';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
import { SideBar, SideBarToggle } from '../components/SideBar';

const VisualModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange }) => {
  
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]); // values de loterías (máx 3)
  const [selectedSchedules, setSelectedSchedules] = useState({}); // { lotteryValue: scheduleValue }
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // { lotteryValue: [{label,value}] }
  const [selectedPlayTypes, setSelectedPlayTypes] = useState([]); // multi jugadas activas
  const [plays, setPlays] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [total, setTotal] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false); // true si falta algún horario
  const [playTypeError, setPlayTypeError] = useState(false);
  const [playsError, setPlaysError] = useState(false);
  const [amountError, setAmountError] = useState(false);

  // Calcular total automáticamente basado en cantidad de números y monto
  useEffect(() => {
    if (plays.trim() && amount) {
      const amountNum = parseInt(amount.toString().replace(/[^0-9]/g, '')) || 0;
      
      if (isLocked) {
        // Cuando el candado está cerrado: Total = Monto (sin importar cantidad de números)
        setTotal(amountNum);
      } else {
        // Cuando el candado está abierto: Total = Cantidad de números × Monto
        const allNumbers = plays.match(/\d+/g) || [];
        const totalNumbers = allNumbers.length;
        const calculatedTotal = totalNumbers * amountNum;
        setTotal(calculatedTotal);
      }
    } else {
      setTotal(0);
    }
  }, [plays, amount, isLocked]); // Agregado isLocked a las dependencias

  // Datos para los dropdowns
  const [lotteries, setLotteries] = useState([]); // desde BD
  const [bankId, setBankId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isInserting, setIsInserting] = useState(false);
  const [playTypes, setPlayTypes] = useState([]); // jugadas activas dinámicas

  const PLAY_TYPE_LABELS = { fijo:'Fijo', corrido:'Corrido', posicion:'Posición', parle:'Parlé', centena:'Centena', tripleta:'Tripleta' };

  const getLotteryLabel = (value) => lotteries.find(l=>l.value===value)?.label || value;
  const getScheduleLabel = (lotteryValue, scheduleValue) => (scheduleOptionsMap[lotteryValue]||[]).find(s=>s.value===scheduleValue)?.label || scheduleValue;
  const getPlayTypeLabel = (v) => PLAY_TYPE_LABELS[v] || v;

  // Cargar banco (id_banco) y luego loterías + jugadas activas
  useEffect(()=>{
  const loadContext = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;
    setUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('role,id_banco').eq('id', user.id).single();
        if(!profile) return;
        const bId = profile.role === 'admin' ? user.id : profile.id_banco;
        setBankId(bId);
      } catch(e) { /* silencioso */ }
    };
    loadContext();
  },[]);

  // Cargar loterías y jugadas activas cuando tengamos bankId
  useEffect(()=>{
    if(!bankId) return;
    const loadData = async () => {
      try {
        const { data: lots } = await supabase.from('loteria').select('id,nombre').eq('id_banco', bankId).order('nombre');
        setLotteries((lots||[]).map(l=>({ label:l.nombre, value:l.id })));
        const { data: jugRow } = await supabase.from('jugadas_activas').select('jugadas').eq('id_banco', bankId).maybeSingle();
        const jugadasObj = jugRow?.jugadas || { fijo:true, corrido:true, posicion:true, parle:true, centena:true, tripleta:true };
        const enabled = Object.entries(jugadasObj)
          .filter(([,v])=>v)
          .map(([k])=>({ label: getPlayTypeLabel(k), value:k }));
        const order = ['fijo','corrido','posicion','parle','centena','tripleta'];
        const ordered = order
          .filter(k => enabled.some(e=> e.value===k))
          .map(k => enabled.find(e=> e.value===k));
        setPlayTypes(ordered);
      } catch(e){ /* ignore */ }
    };
    loadData();
  },[bankId]);

  // Cargar horarios de todas las loterías del banco en una sola consulta y agrupar
  useEffect(()=>{
    if(!bankId || lotteries.length===0) return;
    let cancelled = false;
    const loadAllSchedules = async () => {
      try {
        const lotIds = lotteries.map(l=> l.value); // UUID strings
        const { data: rows } = await supabase
          .from('horario')
          .select('id,nombre,id_loteria')
          .in('id_loteria', lotIds)
          .order('nombre');
        if(cancelled) return;
        const grouped = {}; (rows||[]).forEach(r=> {
          const key = r.id_loteria;
          if(!grouped[key]) grouped[key] = [];
          grouped[key].push({ label: r.nombre, value: r.id });
        });
        setScheduleOptionsMap(grouped);
        setSelectedSchedules(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(lv => { if(!grouped[lv] || !grouped[lv].some(o=>o.value===next[lv])) delete next[lv]; });
          return next;
        });
      } catch(e){ /* ignore */ }
    };
    loadAllSchedules();
    return ()=> { cancelled = true; };
  },[bankId, lotteries]);

  // (playTypes ahora proviene dinámicamente de la BD: estado playTypes)

  const handleInsert = async () => {
    if (isInserting) return; // prevenir doble toque
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setPlayTypeError(false);
    setPlaysError(false);
    setAmountError(false);
    setLotteryErrorMessage('');

    // Validar campos requeridos
    let hasErrors = false;

    if (!selectedLotteries.length) {
      setLotteryError(true);
      setLotteryErrorMessage('Selecciona una lotería');
      hasErrors = true;
    }

    // Validar que cada lotería seleccionada tenga un horario asignado
    const missingSchedules = selectedLotteries.filter(lv => !selectedSchedules[lv]);
    if (missingSchedules.length > 0) {
      setScheduleError(true);
      hasErrors = true;
    }

    if (!selectedPlayTypes.length) {
      setPlayTypeError(true);
      hasErrors = true;
    }

    if (!plays.trim()) {
      setPlaysError(true);
      hasErrors = true;
    }

    if (!amount || amount === '0') {
      setAmountError(true);
      hasErrors = true;
    }

    if (hasErrors) {
      // Quitar errores después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setPlayTypeError(false);
        setPlaysError(false);
        setAmountError(false);
        setLotteryErrorMessage('');
      }, 3000);
      return;
    }
    
    // Mantener orden EXACTO de entrada (el usuario ya no quiere orden ascendente)
    const numbersArrayRaw = plays
      .split(/[\s,;]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
    const numbersFormatted = numbersArrayRaw.join(',');

    let montoUnitario = parseInt(amount.toString().replace(/[^0-9]/g,'')) || 0;
    const montoTotal = total; // ya calculado según candado / números
    if (isLocked) {
      // Recalcular: monto_unitario = monto_total / cantidad de números jugados
      const numsCount = numbersFormatted ? numbersFormatted.split(',').filter(Boolean).length : 0;
      if (numsCount > 0) {
        montoUnitario = Math.floor(montoTotal / numsCount); // entero
      }
    }

    const payloads = [];
    selectedLotteries.forEach(lv => {
      const id_horario = selectedSchedules[lv];
      selectedPlayTypes.forEach(pt => {
        payloads.push({
          id_listero: userId,
          id_horario,
          jugada: pt,
          numeros: numbersFormatted,
          nota: note?.trim() || 'Sin nombre',
          monto_unitario: montoUnitario,
          monto_total: montoTotal,
        });
      });
    });

    if (!payloads.length) return;

    try {
      setIsInserting(true);
      const successes = [];
      const failures = [];
      // Inserción secuencial para confirmar cada una
      for (const p of payloads) {
        const { data, error } = await supabase.from('jugada').insert(p).select('id').single();
        if (error) failures.push({ p, error }); else successes.push(data.id);
      }
      if (failures.length === 0) {
        setPlays('');
        setAmount('');
        setNote('');
        setTotal(0);
      }
      console.log(`Jugadas insertadas: ${successes.length}/${payloads.length}`);
      if (failures.length) console.warn('Fallos insertando jugadas', failures.map(f=>f.error.message));
    } catch(err) {
      console.error('Error general insertando jugadas', err);
    } finally {
      setIsInserting(false);
    }
  };

  const handleClear = () => {
  setSelectedLotteries([]);
  setSelectedSchedules({});
  setSelectedPlayTypes([]);
    setPlays('');
    setAmount('');
    setNote('');
    setTotal(0);
  };

  const handleTopBarOption = (option) => {
    console.log('Sidebar option selected:', option);
  };

  const toggleSidebar = () => {
    console.log('toggleSidebar called, current state:', sidebarVisible);
    setSidebarVisible(!sidebarVisible);
    console.log('toggleSidebar new state will be:', !sidebarVisible);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
  };

  const handleLotteryError = (hasError, message = '') => {
    setLotteryError(hasError);
    setLotteryErrorMessage(message);
    if (hasError) {
      // Quitar el error después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setLotteryErrorMessage('');
      }, 3000);
    }
  };

  // Función para manejar opciones del HammerButton
  const handleHammerOption = (option) => {
    if (option.action === 'insert' && option.numbers) {
      // Agregar números al campo de jugadas
      const newPlays = plays ? `${plays}, ${option.numbers}` : option.numbers;
      setPlays(newPlays);
    }
  };

  // Manejo de selección de loterías (enforce máx 3)
  const handleSelectLotteries = (values) => {
    let next = values;
    if (values.length > 3) {
      // Mantener las primeras tres (orden de selección); asumimos values ya está en orden agregado
      next = values.slice(0,3);
    }
    // Podar horarios de loterías deseleccionadas
    setSelectedSchedules(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => { if (!next.includes(k)) delete updated[k]; });
      return updated;
    });
    setSelectedLotteries(next);
  };

  // Loterías que actualmente carecen de horario (para marcar error individual)
  const missingScheduleSet = new Set(scheduleError ? selectedLotteries.filter(lv => !selectedSchedules[lv]) : []);

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.toggleContainer}>
        <SideBarToggle onToggle={toggleSidebar} />
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Row 1: Lotería & Jugada */}
        <View style={styles.rowTwoCols}> 
          <View style={styles.colHalf}>
            <MultiSelectDropdown
              label="Lotería"
              selectedValues={selectedLotteries}
              onSelect={handleSelectLotteries}
              options={lotteries}
              placeholder="Seleccionar loterías"
              isDarkMode={isDarkMode}
              hasError={lotteryError}
              errorMessage={lotteryErrorMessage}
            />
          </View>
          <View style={styles.colHalf}>
            <MultiSelectDropdown
              label="Jugada"
              selectedValues={selectedPlayTypes}
              onSelect={(vals)=> {
                // Reglas NUEVAS permitidas:
                //  - fijo
                //  - corrido
                //  - centena
                //  - parle (exclusivo)
                //  - fijo + corrido
                //  - fijo + centena
                // Nada más.
                const valid = vals.filter(v => playTypes.some(pt => pt.value === v));
                const exclusive = ['parle','tripleta']; // parle exclusivo; tripleta se mantiene restringida si aparece
                const exclusiveChosen = valid.filter(v=> exclusive.includes(v)).pop();
                if (exclusiveChosen) { setSelectedPlayTypes([exclusiveChosen]); return; }
                let pool = Array.from(new Set(valid.filter(v => ['fijo','corrido','centena'].includes(v))));
                if (pool.length > 2) {
                  // Reducir a dupla válida o última selección
                  const last = [...valid].reverse().find(v=> pool.includes(v));
                  if (last === 'fijo') pool = ['fijo'];
                  else if (['corrido','centena'].includes(last)) pool = ['fijo', last];
                  else pool = [last];
                }
                if (pool.length === 2) {
                  const key = pool.slice().sort().join('|');
                  const allowed = ['corrido|fijo','centena|fijo'];
                  if (!allowed.includes(key)) {
                    const last = [...valid].reverse().find(v=> pool.includes(v));
                    pool = [last];
                  }
                }
                setSelectedPlayTypes(pool);
              }}
              options={playTypes}
              placeholder="Seleccionar jugadas"
              isDarkMode={isDarkMode}
              hasError={playTypeError}
              errorMessage={playTypeError ? 'Selecciona al menos una jugada' : ''}
            />
          </View>
        </View>

        {/* Row 2: Horarios dinámicos por lotería seleccionada + Jugada */}
        {selectedLotteries.length > 0 && (
          <View style={styles.dynamicSchedulesRow}>
            {selectedLotteries.map(lv => {
              const count = selectedLotteries.length;
              const widthPct = count===1 ? '100%' : count===2 ? '48%' : '31.5%';
              return (
                <View key={lv} style={[styles.schedulePickerDynamic,{ width: widthPct }]}> 
                  <DropdownPicker
                    label={`Horario ${getLotteryLabel(lv)}`}
                    value={selectedSchedules[lv] && getScheduleLabel(lv, selectedSchedules[lv])}
                    onSelect={(item) => setSelectedSchedules(prev => ({ ...prev, [lv]: item.value || item }))}
                    options={scheduleOptionsMap[lv] || []}
                    placeholder={scheduleOptionsMap[lv]? 'Seleccionar horario':'Sin horarios'}
                    hasError={missingScheduleSet.has(lv)}
                  />
                </View>
              );
            })}
          </View>
        )}
  {/* Selector de jugadas movido arriba junto a Lotería */}

        {/* Row 3: Jugadas */}
        <PlaysInputField
          label="Números"
          value={plays}
          onChangeText={setPlays}
          placeholder=""
          playType={selectedPlayTypes[0] || null}
          multiline={true}
          isDarkMode={isDarkMode}
          showPasteButton={true}
          pasteButtonOverlay={true}
          hasError={playsError}
        />

        {/* Row 4: Nota, Monto y Total */}
        <View style={styles.threeColumnRow}>
          <View style={styles.thirdWidth}>
            <InputField
              label="Nota"
              value={note}
              onChangeText={setNote}
              placeholder=""
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
          <View style={styles.thirdWidth}>
            <MoneyInputField
              label="Monto"
              value={amount}
              onChangeText={setAmount}
              placeholder="$0"
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
              hasError={amountError}
            />
          </View>
          <View style={styles.thirdWidth}>
            <MoneyInputField
              label="Total"
              value={total.toString()}
              editable={false}
              placeholder="$0"
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
        </View>

        {/* Row 5: Botones de herramientas */}
        <View style={styles.toolsContainer}>
          {selectedPlayTypes.length === 1 && selectedPlayTypes[0] === 'parle' && (
            <Pressable
              style={({ pressed }) => [
                styles.lockButton, 
                isLocked && styles.lockButtonActive,
                pressed && styles.lockButtonPressed
              ]}
              onPress={toggleLock}
            >
              <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
            </Pressable>
          )}
          
          <BatteryButton 
            onOptionSelect={(option) => console.log('Battery option:', option)}
            selectedLotteries={selectedLotteries}
            selectedSchedules={selectedSchedules}
            selectedPlayTypes={selectedPlayTypes}
            lotteryOptions={lotteries}
            scheduleOptionsMap={scheduleOptionsMap}
            getScheduleLabel={getScheduleLabel}
            playTypeLabels={PLAY_TYPE_LABELS}
            bankId={bankId}
            onLotteryError={handleLotteryError}
          />
          
          <HammerButton 
            onOptionSelect={handleHammerOption}
            isDarkMode={isDarkMode}
          />
          
          <ListButton 
            onOptionSelect={(option) => console.log('List option:', option)}
            isDarkMode={isDarkMode}
          />
          <PricingInfoButton />
          <NotificationsButton />
        </View>

        {/* Row 6: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title="Borrar"
              onPress={handleClear}
              variant="danger"
              size="medium"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title={isInserting ? 'Insertando...' : 'Insertar'}
              onPress={handleInsert}
              variant="success"
              size="medium"
              disabled={isInserting}
            />
          </View>
        </View>
      </ScrollView>
      
      <SideBar
        isVisible={sidebarVisible}
        onClose={closeSidebar}
        onOptionSelect={handleTopBarOption}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        role="listero"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FDF5',
  },
  toggleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 120,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 4,
  },
  halfWidth: {
    width: '48%',
  },
  thirdWidth: {
    flex: 1,
    marginHorizontal: 2,
  },
  fieldContainer: {
    marginBottom: 0, // Anular el marginBottom de los componentes internos
  },
  unifiedInput: {
    height: 40, // Altura más pequeña como tenía nota anteriormente
    minHeight: 40, // Sobrescribir cualquier minHeight interno
    maxHeight: 40, // Asegurar que no crezca más
    paddingHorizontal: 12,
    paddingVertical: 8, // Reducido también el padding vertical
    fontSize: 16,
    borderWidth: 1.5,
    borderRadius: 8,
    borderColor: '#D5DBDB',
    backgroundColor: '#FFFFFF',
    color: '#2C3E50',
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
    gap: 10,
  },
  lockButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#B8D4A8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2D5016',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  lockButtonActive: {
    backgroundColor: '#FFE4B5',
    borderColor: '#D4AF37',
  },
  lockIcon: {
    fontSize: 18,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  actionButton: {
    width: '48%',
  },
  lockButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  dynamicSchedulesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  schedulePickerWrap: {
    flexBasis: '48%',
  },
  dynamicSchedulesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 6,
  },
  schedulePickerDynamic: {
    minWidth: 100,
  },
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  colHalf: {
    flexBasis: '48%',
  },
});

export default VisualModeScreen;
