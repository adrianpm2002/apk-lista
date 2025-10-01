import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
import MoneyInputField from '../components/MoneyInputField';
import { supabase } from '../supabaseClient';
import { SideBar, SideBarToggle } from '../components/SideBar';
import ModeSelector from '../components/ModeSelector';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
import BatteryButton from '../components/BatteryButton';
import ListButton from '../components/ListButton';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';
import { validateScheduleById } from '../utils/scheduleValidator';
import FeedbackBanner from '../components/FeedbackBanner';

const VaultModeScreen = ({ navigation, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);


  // Estados para loterías, horarios y nota (con lógica real de VisualModeScreen)
  const [selectedLotteries, setSelectedLotteries] = useState([]); // values de loterías
  const [selectedSchedules, setSelectedSchedules] = useState({}); // { lotteryValue: scheduleValue }
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // { lotteryValue: [{label,value}] }
  const [lotteries, setLotteries] = useState([]); // opciones de loterías
  const [note, setNote] = useState('');
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [bankId, setBankId] = useState(null);
  
  // Estados para modo Santiago
  const [modoSantiago, setModoSantiago] = useState(false);
  const [porcentajeSantiago, setPorcentajeSantiago] = useState(100);
  
  // Estado para total
  const [totalGeneral, setTotalGeneral] = useState(0);



  // Cargar banco (id_banco) y luego loterías
  React.useEffect(() => {
    const loadContext = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('role,id_banco').eq('id', user.id).single();
        if (!profile) return;
        const bId = profile.role === 'admin' ? user.id : profile.id_banco;
        setBankId(bId);
      } catch (e) { /* silencioso */ }
    };
    loadContext();
  }, []);

  // Cargar loterías cuando tengamos bankId
  React.useEffect(() => {
    if (!bankId) return;
    const loadData = async () => {
      try {
        const { data: lots } = await supabase.from('loteria').select('id,nombre').eq('id_banco', bankId).order('nombre');
        setLotteries((lots || []).map(l => ({ label: l.nombre, value: l.id })));
        
        // Cargar configuración de modo Santiago del banco
        const { data: bankProfile } = await supabase
          .from('profiles')
          .select('modo_santiago, porciento')
          .eq('id', bankId)
          .single();
        
        if (bankProfile) {
          setModoSantiago(bankProfile.modo_santiago || false);
          setPorcentajeSantiago(bankProfile.porciento || 100);
        }
      } catch (e) { /* ignore */ }
    };
    loadData();
  }, [bankId]);

  // Cargar horarios de todas las loterías del banco
  React.useEffect(() => {
    if (!bankId || lotteries.length === 0) return;
    let cancelled = false;
    const loadAllSchedules = async () => {
      try {
        const lotIds = lotteries.map(l => l.value);
        const { data: rows } = await supabase
          .from('horario')
          .select('id,nombre,id_loteria,hora_inicio,hora_fin')
          .in('id_loteria', lotIds)
          .order('nombre');
        if (cancelled) return;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const isOpen = (hi, hf) => {
          if (!hi || !hf) return false;
          const [shi, smi] = hi.split(':');
          const [shf, smf] = hf.split(':');
          const start = parseInt(shi, 10) * 60 + parseInt(smi || '0', 10);
          const end = parseInt(shf, 10) * 60 + parseInt(smf || '0', 10);
          if (start === end) return true;
          if (end > start) return nowMinutes >= start && nowMinutes < end;
          return (nowMinutes >= start) || (nowMinutes < end);
        };
        const grouped = {};
        (rows || [])
          .filter(r => isOpen(r.hora_inicio, r.hora_fin))
          .forEach(r => {
            const key = r.id_loteria;
            if (!grouped[key]) grouped[key] = [];
            const horaInicio = r.hora_inicio ? r.hora_inicio.substring(0, 5) : '';
            const horaFin = r.hora_fin ? r.hora_fin.substring(0, 5) : '';
            const labelConHoras = horaInicio && horaFin ? `${r.nombre} (${horaInicio} - ${horaFin})` : r.nombre;
            grouped[key].push({ label: labelConHoras, value: r.id });
          });
        setScheduleOptionsMap(grouped);
        setSelectedSchedules(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(lv => { if (!grouped[lv] || !grouped[lv].some(o => o.value === next[lv])) delete next[lv]; });
          return next;
        });
      } catch (e) { /* ignore */ }
    };
    loadAllSchedules();
    return () => { cancelled = true; };
  }, [bankId, lotteries]);

  // Handler para selección de loterías (máx 3)
  const handleSelectLotteries = (values) => {
    let next = values;
    if (values.length > 3) next = values.slice(0, 3);
    // Podar horarios de loterías deseleccionadas
    setSelectedSchedules(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => { if (!next.includes(k)) delete updated[k]; });
      // Para cada lotería nueva, seleccionar automáticamente el primer horario disponible
      next.forEach(lotteryId => {
        if (!updated[lotteryId]) {
          const availableSchedules = scheduleOptionsMap[lotteryId] || [];
          if (availableSchedules.length > 0) updated[lotteryId] = availableSchedules[0].value;
        }
      });
      return updated;
    });
    setSelectedLotteries(next);
  };

  // Loterías que actualmente carecen de horario (para marcar error individual)
  const missingScheduleSet = new Set(scheduleError ? selectedLotteries.filter(lv => !selectedSchedules[lv]) : []);
  
  // Función para obtener etiqueta del horario
  const getScheduleLabel = (scheduleId) => {
    for (const lotteryId in scheduleOptionsMap) {
      const schedules = scheduleOptionsMap[lotteryId] || [];
      const schedule = schedules.find(s => s.value === scheduleId);
      if (schedule) return schedule.label;
    }
    return '';
  };
  
  // Estados para los inputs de fijos y corridos
  const [numero, setNumero] = useState('');
  const [fijo, setFijo] = useState('');
  const [corrido, setCorrido] = useState('');
  
  // Estados para parles
  const [parleInput, setParleInput] = useState('');
  const [precioParle, setPrecioParle] = useState('');
  const [candadoAbierto, setCandadoAbierto] = useState(true); // true = abierto (precio total), false = cerrado (precio individual)
  
  // Estados para centenas
  const [centenaNumero, setCentenaNumero] = useState('');
  const [centenaPrecio, setCentenaPrecio] = useState('');
  
  // Estados para almacenar las jugadas
  const [jugadasFijosYCorridos, setJugadasFijosYCorridos] = useState([]);
  const [jugadasParles, setJugadasParles] = useState([]);
  const [jugadasCentenas, setJugadasCentenas] = useState([]);
  const [nextId, setNextId] = useState(1); // Contador para IDs únicos
  
  // Estados para manejar errores y estados de jugadas
  const [jugadasConError, setJugadasConError] = useState(new Set());
  
  // Estados para manejo de inserción y feedback
  const [isInserting, setIsInserting] = useState(false);
  const [insertFeedback, setInsertFeedback] = useState(null);
  const [limitViolations, setLimitViolations] = useState([]);
  const [userId, setUserId] = useState(null);
  
  // Cargar userId
  React.useEffect(() => {
    const loadUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setUserId(user.id);
      } catch (e) { /* silencioso */ }
    };
    loadUserId();
  }, []);

  // Calcular total automáticamente cuando cambien las jugadas
  React.useEffect(() => {
    let total = 0;
    
    // Sumar fijos y corridos
    jugadasFijosYCorridos.forEach(jugada => {
      if (jugada.fijo) total += parseFloat(jugada.fijo) || 0;
      if (jugada.corrido) total += parseFloat(jugada.corrido) || 0;
    });
    
    // Sumar parles
    jugadasParles.forEach(jugada => {
      total += jugada.precioTotal || 0;
    });
    
    // Sumar centenas
    jugadasCentenas.forEach(jugada => {
      total += parseFloat(jugada.precio) || 0;
    });
    
    setTotalGeneral(total * (selectedLotteries.length || 1));
  }, [jugadasFijosYCorridos, jugadasParles, jugadasCentenas, selectedLotteries.length]);
  
  // Función para limpiar completamente la pantalla
  const limpiarPantalla = () => {
    setJugadasFijosYCorridos([]);
    setJugadasParles([]);
    setJugadasCentenas([]);
    setNote('');
    setSelectedLotteries([]);
    setSelectedSchedules({});
    setJugadasConError(new Set());
    setInsertFeedback(null);
    setLimitViolations([]);
    setLotteryError(false);
    setScheduleError(false);
    setShowFieldErrors(false);
    setNumero('');
    setFijo('');
    setCorrido('');
    setParleInput('');
    setPrecioParle('');
    setCentenaNumero('');
    setCentenaPrecio('');
  };
  
  // Función para agregar una jugada de fijos y corridos
  const agregarJugada = () => {
    // Extraer todos los números de dos dígitos
    const numerosArray = (numero.match(/\d{2}/g) || []);
    if (numerosArray.length > 0 && (fijo || corrido)) {
      const nuevasJugadas = numerosArray.map(num => ({
        id: nextId + numerosArray.indexOf(num), // ID único
        numero: num,
        fijo: fijo || '',
        corrido: corrido || ''
      }));
      setJugadasFijosYCorridos([...jugadasFijosYCorridos, ...nuevasJugadas]);
      setNextId(nextId + numerosArray.length);
      // Limpiar inputs
      setNumero('');
      setFijo('');
      setCorrido('');
    }
  };
  
  // Función para manejar el input de parles (auto-espaciado cada 2 dígitos)
  const manejarParleInput = (text) => {
    // Eliminar espacios y caracteres no numéricos
    const numeros = text.replace(/\D/g, '');
    
    // Agregar espacios cada 4 dígitos
    const numerosConEspacios = numeros.replace(/(.{4})/g, '$1 ').trim();
    
    setParleInput(numerosConEspacios);
  };
  
  // Función para agregar parles
  const agregarParle = () => {
    if (parleInput && precioParle) {
      // Extraer números individuales (cada grupo de 4 dígitos)
      const numerosArray = (parleInput.replace(/\D/g, '').match(/.{4}/g) || []);
      if (numerosArray.length > 0) {
        const precio = parseFloat(precioParle);
        // Lógica corregida: candado abierto = precio individual, candado cerrado = precio total
        const nuevasJugadas = numerosArray.map(num => ({
          id: nextId + numerosArray.indexOf(num), // ID único
          numeros: [num],
          precioIndividual: candadoAbierto ? precio : precio / numerosArray.length,
          precioTotal: candadoAbierto ? precio * numerosArray.length : precio,
          esPrecioTotal: !candadoAbierto
        }));
        setJugadasParles([...jugadasParles, ...nuevasJugadas]);
        setNextId(nextId + numerosArray.length);
        // Limpiar inputs
        setParleInput('');
        setPrecioParle('');
      }
    }
  };
  
  // Función para manejar el input de centenas (auto-salto después de 3 dígitos)
  const manejarCentenaNumero = (text) => {
    const numeros = text.replace(/\D/g, '');
    if (numeros.length <= 3) {
      setCentenaNumero(numeros);
    }
  };
  
  // Función para agregar centenas
  const agregarCentena = () => {
    // Extraer todos los números de tres dígitos
    const numerosArray = (centenaNumero.replace(/\D/g, '').match(/.{3}/g) || []);
    if (numerosArray.length > 0 && centenaPrecio) {
      const nuevasCentenas = numerosArray.map(num => ({
        id: nextId + numerosArray.indexOf(num), // ID único
        numero: num,
        precio: centenaPrecio
      }));
      setJugadasCentenas([...jugadasCentenas, ...nuevasCentenas]);
      setNextId(nextId + numerosArray.length);
      // Limpiar inputs
      setCentenaNumero('');
      setCentenaPrecio('');
    }
  };
  
  // Función para enviar jugadas
  const enviarJugadas = async () => {
    if (isInserting) return; // prevenir doble toque
    
    // Limpiar feedback previo
    setInsertFeedback(null);
    setLimitViolations([]);
    
    // Validar que el horario seleccionado sigue abierto
    const selectedLottery = selectedLotteries[0];
    const selectedScheduleId = selectedSchedules[selectedLottery];
    
    if (selectedScheduleId) {
      const isOpen = await validateScheduleById(selectedScheduleId);
      if (!isOpen) {
        Alert.alert(
          'Horario Cerrado', 
          'El horario seleccionado ya está cerrado. Por favor, selecciona un horario abierto para enviar jugadas.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setShowFieldErrors(false);
    setLotteryErrorMessage('');

    // Validar campos requeridos
    let hasErrors = false;

    if (!selectedLotteries.length) {
      setLotteryError(true);
      setLotteryErrorMessage('Debe seleccionar al menos una lotería');
      hasErrors = true;
    }

    // Validar que cada lotería seleccionada tenga un horario asignado
    const missingSchedules = selectedLotteries.filter(lv => !selectedSchedules[lv]);
    if (missingSchedules.length > 0) {
      setScheduleError(true);
      hasErrors = true;
    }

    // Validar que haya jugadas para enviar
    const totalJugadas = jugadasFijosYCorridos.length + jugadasParles.length + jugadasCentenas.length;
    if (totalJugadas === 0) {
      Alert.alert('Error', 'No hay jugadas para enviar');
      hasErrors = true;
    }

    if (hasErrors) {
      setShowFieldErrors(true);
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setLotteryErrorMessage('');
        setShowFieldErrors(false);
      }, 3000);
      return;
    }

    // Preparar payloads para inserción
    const payloads = [];
    
    selectedLotteries.forEach(lv => {
      const id_horario = selectedSchedules[lv];
      
      // Agregar jugadas de fijos y corridos
      jugadasFijosYCorridos.forEach(jugada => {
        if (jugada.fijo && parseFloat(jugada.fijo) > 0) {
          payloads.push({
            id_listero: userId,
            id_horario,
            jugada: 'fijo',
            numeros: jugada.numero,
            nota: note?.trim() || null,
            monto_unitario: parseFloat(jugada.fijo),
            monto_total: parseFloat(jugada.fijo)
          });
        }
        if (jugada.corrido && parseFloat(jugada.corrido) > 0) {
          payloads.push({
            id_listero: userId,
            id_horario,
            jugada: 'corrido',
            numeros: jugada.numero,
            nota: note?.trim() || null,
            monto_unitario: parseFloat(jugada.corrido),
            monto_total: parseFloat(jugada.corrido)
          });
        }
      });
      
      // Agregar jugadas de parles
      jugadasParles.forEach(jugada => {
        payloads.push({
          id_listero: userId,
          id_horario,
          jugada: 'parle',
          numeros: jugada.numeros.join(','),
          nota: note?.trim() || null,
          monto_unitario: jugada.precioIndividual,
          monto_total: jugada.precioTotal
        });
      });
      
      // Agregar jugadas de centenas
      jugadasCentenas.forEach(jugada => {
        payloads.push({
          id_listero: userId,
          id_horario,
          jugada: 'centena',
          numeros: jugada.numero,
          nota: note?.trim() || null,
          monto_unitario: parseFloat(jugada.precio),
          monto_total: parseFloat(jugada.precio)
        });
      });
    });

    if (!payloads.length) return;

    // Validar que todos los horarios seleccionados siguen abiertos
    const uniqueScheduleIds = [...new Set(payloads.map(p => p.id_horario))];
    for (const scheduleId of uniqueScheduleIds) {
      if (scheduleId) {
        const isOpen = await validateScheduleById(scheduleId);
        if (!isOpen) {
          Alert.alert(
            'Horario Cerrado', 
            'Uno o más horarios seleccionados ya están cerrados. Por favor, selecciona horarios abiertos para enviar jugadas.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
    }

    // Solo verificación de límites (duplicados manejados por BD)
    const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
    const ctx = await fetchLimitsContext(horarios, userId);
    
    const tempInstructions = payloads.map(p=> ({ 
      playType: p.jugada, 
      numbers: p.numeros.split(',').filter(Boolean), 
      amountEach: p.monto_unitario 
    }));
    
    const violations = checkInstructionsLimits(tempInstructions, horarios, ctx);
    if(violations.length){
      setLimitViolations(violations);
      setInsertFeedback({ 
        type: 'error',
        message: `Se encontraron ${violations.length} violación(es) de límites. Revisa las restricciones.`
      });
      return;
    }
    
    // Inserción usando batch (más eficiente)
    setIsInserting(true);
    
    try {
        // Intentar batch insert primero
        const { data: insertedData, error: batchError } = await supabase
          .from('jugada')
          .insert(payloads)
          .select('id');
        
        if (batchError) {
          // Si batch falla, usar inserción secuencial para manejar duplicados
          console.warn('Batch insert failed, trying sequential:', batchError);
          const successes = [];
          const failures = [];
          
          for(const p of payloads){
            const { data, error } = await supabase.from('jugada').insert({
              id_listero: p.id_listero,
              id_horario: p.id_horario,
              jugada: p.jugada,
              numeros: p.numeros,
              nota: p.nota,
              monto_unitario: p.monto_unitario,
              monto_total: p.monto_total
            }).select('id').single();
            
            if(error){
              const isDuplicate = error.message?.includes('Jugada duplicada') || 
                                 error.message?.includes('duplicada') || 
                                 error.code === '23505';
              failures.push({ p, error, isDuplicate });
            } else {
              successes.push(data.id);
            }
          }
          
          if(failures.length === 0){
            // ¡ÉXITO TOTAL! Limpiar toda la pantalla automáticamente
            setJugadasFijosYCorridos([]);
            setJugadasParles([]);
            setJugadasCentenas([]);
            setNote('');
            setNumero('');
            setFijo('');
            setCorrido('');
            setParleInput('');
            setPrecioParle('');
            setCentenaNumero('');
            setCentenaPrecio('');
            setJugadasConError(new Set());
            setShowFieldErrors(false);
            
            setInsertFeedback({ 
              type: 'success',
              message: `${payloads.length} jugada(s) enviada(s) exitosamente.`
            });
          } else {
            // Hubo algunos errores - extraer mensajes del servidor
            const serverErrors = failures.map(f => f.error.message).filter(Boolean);
            const duplicateFails = failures.filter(f=>f.isDuplicate);
            setInsertFeedback({ 
              type: 'warning',
              message: `${successes.length} exitosa(s), ${failures.length} fallida(s)${duplicateFails.length ? ` (${duplicateFails.length} duplicada(s))` : ''}.`,
              serverError: serverErrors.length ? serverErrors.join(' | ') : undefined
            });
          }
        } else {
          // Batch exitoso - limpiar pantalla automáticamente
          setJugadasFijosYCorridos([]);
          setJugadasParles([]);
          setJugadasCentenas([]);
          setNote('');
          setNumero('');
          setFijo('');
          setCorrido('');
          setParleInput('');
          setPrecioParle('');
          setCentenaNumero('');
          setCentenaPrecio('');
          setJugadasConError(new Set());
          setShowFieldErrors(false);
          
          setInsertFeedback({ 
            type: 'success',
            message: `${payloads.length} jugada(s) enviada(s) exitosamente.`
          });
        }
        
      } catch(err){
        console.error('Error general insertando jugadas', err);
        setInsertFeedback({ 
          type: 'error',
          message: 'Error inesperado al enviar jugadas. Intenta nuevamente.'
        });
      } finally { 
        setIsInserting(false); 
      }
  };

  return (
  <View style={[styles.container, { minHeight: '100vh' }]}> 
      {/* Barra de navegación superior */}
      <View style={styles.headerFloating} pointerEvents="box-none">
        <View style={styles.inlineHeaderRow} pointerEvents="box-none">
          <SideBarToggle inline onToggle={() => setSidebarVisible(s => !s)} />
          <View style={styles.modeSelectorWrapper}>
            <ModeSelector 
              currentMode={currentMode || 'Vault'} 
              onModeChange={onModeChange} 
              visibleModes={visibleModes} 
            />
          </View>
          <View style={styles.rightButtonsGroup} pointerEvents="box-none">
            <PricingInfoButton />
            {/* <NotificationsButton /> */}
          </View>
        </View>
      </View>

  <ScrollView
    style={{ flex: 1, marginTop: 100 }}
    contentContainerStyle={{ flexGrow: 1 }}
    keyboardShouldPersistTaps="handled"
  >
      {/* Controles de lotería, horario y nota (idénticos a VisualModeScreen, ahora dentro del ScrollView) */}
      <View style={{ paddingHorizontal: 8, marginTop: 10, marginBottom: 3 }}>
        <MultiSelectDropdown
          label="Loterías"
          selectedValues={selectedLotteries}
          onSelect={handleSelectLotteries}
          options={lotteries}
          placeholder="Seleccionar loterías"
          hasError={lotteryError}
          errorMessage={lotteryErrorMessage}
          style={{ minHeight: 36, fontSize: 13 }}
        />
        {selectedLotteries.length > 0 && (
          <View style={{ flexDirection: selectedLotteries.length === 1 ? 'row' : 'column', alignItems: 'flex-start', gap: 6, marginTop: 6 }}>
            {/* Horarios */}
            <View style={{ flexDirection: 'row', flex: selectedLotteries.length === 1 ? 1 : undefined, gap: 6 }}>
              {selectedLotteries.map(lv => (
                <View key={lv} style={{ minWidth: 110, maxWidth: 150, marginRight: 4, marginBottom: 4 }}>
                  <DropdownPicker
                    label={''}
                    value={selectedSchedules[lv] && (scheduleOptionsMap[lv]?.find(s=>s.value===selectedSchedules[lv])?.label || selectedSchedules[lv])}
                    onSelect={item => setSelectedSchedules(prev => ({ ...prev, [lv]: item.value || item }))}
                    options={scheduleOptionsMap[lv] || []}
                    placeholder={scheduleOptionsMap[lv]? 'Horario':'Sin horarios'}
                    hasError={missingScheduleSet.has(lv)}
                    style={{ minHeight: 32, fontSize: 13 }}
                  />
                </View>
              ))}
            </View>
            {/* Nota */}
            {selectedLotteries.length === 1 ? (
              <View style={{ flex: 1, minWidth: 80, maxWidth: 120, marginLeft: 4 }}>
                <InputField
                  label={''}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nota"
                  inputStyle={{ minHeight: 32, fontSize: 13, paddingHorizontal: 6 }}
                  hasError={showFieldErrors && !note.trim()}
                  style={{ marginTop: 0, marginBottom: 0 }}
                />
              </View>
            ) : (
              <View style={{ width: '100%', marginTop: 4 }}>
                <InputField
                  label={''}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Nota"
                  inputStyle={{ minHeight: 32, fontSize: 13, paddingHorizontal: 6 }}
                  hasError={showFieldErrors && !note.trim()}
                  style={{ marginTop: 0, marginBottom: 0 }}
                />
              </View>
            )}
          </View>
        )}
      </View>
        <View style={styles.gridContainer}>
          {/* Las tres columnas sin encabezados separados, ocupando todo el ancho */}
          <View style={styles.contentRow}>
            <View style={styles.cell}>
              {/* Título dentro de la lista */}
              <Text style={styles.headerTextInside}>
                Fijos y corridos
              </Text>
              {/* Mostrar jugadas de fijos y corridos */}
              {jugadasFijosYCorridos.map((jugada, index) => (
                <View key={`fijo-${index}`} style={styles.jugadaContainer}>
                  <Text style={styles.numeroText}>
                    {jugada.numero}
                  </Text>
                  <View style={styles.circleContainer}>
                    <View style={styles.circle}>
                      <Text style={styles.circleText}>
                        {jugada.fijo ? `$${jugada.fijo}` : ''}
                      </Text>
                    </View>
                    <View style={styles.circle}>
                      <Text style={styles.circleText}>
                        {jugada.corrido ? `$${jugada.corrido}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              {/* Inputs para agregar números dentro de la lista */}
              <View style={styles.inputContainerInsideList}>
                <TextInput
                  style={styles.input}
                  placeholder="#"
                  placeholderTextColor="#7f8c8d"
                  value={numero}
                  onChangeText={text => {
                    // Solo dígitos, máximo 20 caracteres
                    let clean = text.replace(/\D/g, '').slice(0, 20);
                    // Insertar espacio cada dos dígitos
                    let formatted = clean.replace(/(.{2})/g, '$1 ').trim();
                    setNumero(formatted);
                  }}
                  keyboardType="numeric"
                  maxLength={29} // 20 dígitos + 9 espacios
                />
                <TextInput
                  style={styles.input}
                  placeholder="$"
                  placeholderTextColor="#7f8c8d"
                  value={fijo}
                  onChangeText={text => {
                    let clean = text.replace(/[^\d.,]/g, '').replace(/,/g, '.');
                    const parts = clean.split('.');
                    if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
                    if (parts[1]) clean = parts[0] + '.' + parts[1].slice(0, 2);
                    setFijo(clean);
                  }}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder="$"
                  placeholderTextColor="#7f8c8d"
                  value={corrido}
                  onChangeText={text => {
                    let clean = text.replace(/[^\d.,]/g, '').replace(/,/g, '.');
                    const parts = clean.split('.');
                    if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
                    if (parts[1]) clean = parts[0] + '.' + parts[1].slice(0, 2);
                    setCorrido(clean);
                  }}
                  keyboardType="numeric"
                />
                <TouchableOpacity 
                  style={styles.addButton}
                  onPress={agregarJugada}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.cell}>
              {/* Título dentro de la lista */}
              <Text style={styles.headerTextInside}>
                Parles
              </Text>
              {/* Mostrar jugadas de parles uno al lado del otro como fijos y corridos */}
              {jugadasParles.map((jugada, index) => (
                <View key={`parle-${index}`} style={styles.jugadaContainer}>
                  <Text style={styles.numeroText}>
                    {jugada.numeros[0]}
                  </Text>
                  <View style={styles.circleContainer}>
                    <View style={styles.circleOutline}>
                      <Text style={styles.circleOutlineText}>
                        ${jugada.precioIndividual}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              {/* Inputs para agregar parles dentro de la lista */}
              <View style={styles.inputContainerInsideList}>
                <View style={{ flexDirection: 'column', alignItems: 'center', width: '100%', gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="#"
                    placeholderTextColor="#7f8c8d"
                    value={parleInput}
                    onChangeText={text => {
                      // Solo dígitos, máximo 20 caracteres
                      let clean = text.replace(/\D/g, '').slice(0, 20);
                      // Insertar espacio cada 4 dígitos
                      let formatted = clean.replace(/(.{4})/g, '$1 ').trim();
                      setParleInput(formatted);
                    }}
                    keyboardType="numeric"
                    maxLength={24} // 20 dígitos + 4 espacios
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="$"
                    placeholderTextColor="#7f8c8d"
                    value={precioParle}
                    onChangeText={text => {
                      let clean = text.replace(/[^\d.,]/g, '').replace(/,/g, '.');
                      const parts = clean.split('.');
                      if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
                      if (parts[1]) clean = parts[0] + '.' + parts[1].slice(0, 2);
                      setPrecioParle(clean);
                    }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    style={styles.candadoButton}
                    onPress={() => setCandadoAbierto(!candadoAbierto)}
                  >
                    <Text style={styles.candadoText}>
                      {candadoAbierto ? '🔓' : '🔒'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.candadoLabel}>
                    {candadoAbierto ? 'Precio individual' : 'Precio total'}
                  </Text>
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={agregarParle}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.cell}>
              {/* Título dentro de la lista */}
              <Text style={styles.headerTextInside}>
                Centenas
              </Text>
              {/* Mostrar jugadas de centenas */}
              {jugadasCentenas.map((jugada, index) => {
                const precioNum = Number(jugada.precio);
                const precioStr = Number.isInteger(precioNum) ? precioNum.toString() : precioNum.toFixed(2);
                return (
                  <View key={`centena-${index}`} style={styles.centenaContainer}>
                    <Text style={styles.numeroCentenaText}>
                      {jugada.numero}
                    </Text>
                    <View style={styles.circleOutline}>
                      <Text style={styles.circleOutlineText}>
                        ${precioStr}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {/* Inputs para agregar centenas dentro de la lista */}
              <View style={styles.inputContainerInsideList}>
                <View style={{ flexDirection: 'column', alignItems: 'center', width: '100%', gap: 8 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="#"
                    placeholderTextColor="#7f8c8d"
                    value={centenaNumero}
                    onChangeText={text => {
                      // Solo dígitos, máximo 18 caracteres (6 centenas)
                      let clean = text.replace(/\D/g, '').slice(0, 18);
                      // Insertar espacio cada 3 dígitos
                      let formatted = clean.replace(/(.{3})/g, '$1 ').trim();
                      setCentenaNumero(formatted);
                    }}
                    keyboardType="numeric"
                    maxLength={23} // 18 dígitos + 5 espacios
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="$"
                    placeholderTextColor="#7f8c8d"
                    value={centenaPrecio}
                    onChangeText={text => {
                      let clean = text.replace(/[^\d.,]/g, '').replace(/,/g, '.');
                      const parts = clean.split('.');
                      if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');
                      if (parts[1]) clean = parts[0] + '.' + parts[1].slice(0, 2);
                      setCentenaPrecio(clean);
                    }}
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    style={styles.addButton}
                    onPress={agregarCentena}
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          {/* Eliminadas View vacías de inputs debajo de las listas */}
        </View>
        
        {/* Sección de totales */}
        {totalGeneral > 0 && (
          <View style={styles.totalsSection}>
            {/* Mostrar monto por lotería si hay 2 o más loterías seleccionadas */}
            {selectedLotteries.length >= 2 && (
              <MoneyInputField
                label={'Monto por Lotería'}
                value={Math.round(totalGeneral / (selectedLotteries.length || 1)).toString()}
                editable={false}
                placeholder="$0"
                style={styles.totalField}
              />
            )}
            <MoneyInputField
              label={'Total General'}
              value={totalGeneral.toString()}
              editable={false}
              placeholder="$0"
              style={styles.totalField}
            />
            {/* Total modo Santiago */}
            {modoSantiago && (
              <MoneyInputField
                label={`Total Santiago (${porcentajeSantiago}%)`}
                value={Math.round(totalGeneral * (porcentajeSantiago / 100)).toString()}
                editable={false}
                placeholder="$0"
                style={[styles.totalField, { backgroundColor: '#FFE4B5' }]}
              />
            )}
          </View>
        )}
        
        {/* Botones de acción */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={limpiarPantalla}
          >
            <Text style={styles.actionButtonText}>
              Borrar
            </Text>
          </TouchableOpacity>
          {/* Botón de batería */}
          <BatteryButton
            bankId={bankId}
            selectedLotteries={selectedLotteries}
            selectedSchedules={selectedSchedules}
            selectedPlayTypes={[]}
            lotteryOptions={lotteries}
            scheduleOptionsMap={scheduleOptionsMap}
            getScheduleLabel={getScheduleLabel}
            playTypeLabels={{ fijo:'fijo', corrido:'corrido', centena:'centena', parle:'parle', tripleta:'tripleta' }}
            animationProps={{ scaleFrom:0.9, duration:180 }}
          />
          {/* Botón de registros diarios */}
          <ListButton currentMode={currentMode} onOptionSelect={(option) => {}} />
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              styles.sendButton,
              isInserting && styles.disabledButton
            ]}
            onPress={enviarJugadas}
            disabled={isInserting}
          >
            <Text style={styles.actionButtonText}>
              {isInserting ? 'Insertando...' : 'Enviar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      {/* Banner de feedback para inserción */}
      {limitViolations.length > 0 && (
        <FeedbackBanner
          type="blocked"
          message="Límites excedidos"
          details={limitViolations.slice(0,10).map(v=> {
            const usado = v.usado || 0;
            const intento = v.intento || 0;
            const total = usado + intento;
            const exceso = total - v.permitido;
            return `${v.numero} (${v.jugada}): excede ${exceso}`;
          })}
          onClose={()=> setLimitViolations([])}
          style={{ top:70 }}
        />
      )}
      {insertFeedback && (
        <FeedbackBanner
          type={insertFeedback.type}
          message={insertFeedback.message}
          details={insertFeedback.serverError ? [`Servidor: ${insertFeedback.serverError}`] : undefined}
          onClose={() => {
            setInsertFeedback(null);
            setLimitViolations([]);
          }}
          style={{ top: limitViolations.length? 120:70 }}
        />
      )}
      
      <SideBar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        onOptionSelect={() => {}}
        isDarkMode={isDarkMode}
        navigation={navigation}
        onModeVisibilityChange={onModeVisibilityChange}
        visibleModes={visibleModes}
        role="listero"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f8ff',
    minHeight: '100vh',
  },
  containerDark: { 
    backgroundColor: '#2c3e50' 
  },
  headerFloating: { 
    position: 'absolute', 
    top: 40, 
    left: 0, 
    right: 0, 
    flexDirection: 'row', 
    justifyContent: 'flex-start', 
    alignItems: 'flex-start', 
    zIndex: 3000, 
    paddingTop: 12, 
    paddingBottom: 10, 
    paddingHorizontal: 20, 
    backgroundColor: 'rgba(255,255,255,0.96)', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E6EA', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.12, 
    shadowRadius: 4, 
    elevation: 4 
  },
  inlineHeaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    flex: 1, 
    paddingTop: 0, 
    minHeight: 44 
  },
  rightButtonsGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginLeft: 'auto', 
    flexWrap: 'wrap' 
  },
  modeSelectorWrapper: { 
    marginLeft: 6, 
    flexShrink: 1 
  },
  gridContainer: {
    flex: 1,
    paddingTop: 5,
    paddingHorizontal: 0,
    paddingBottom: 0,
    marginBottom: 0, // Eliminar margen inferior
  },
  contentRow: {
    flex: 3, // Mayor espacio para mostrar jugadas
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputRow: {
    flex: 2, // Espacio para inputs
    flexDirection: 'row',
  },
  headerTextInside: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E6EA',
    width: '100%',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    marginBottom: 10,
  },
  cell: {
    flex: 1,
    backgroundColor: '#ffffff',
    marginHorizontal: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderRightWidth: 1,
    borderRightColor: '#E2E6EA',
    justifyContent: 'flex-start',
    alignItems: 'center',
    minHeight: 100,
    padding: 10,
  },
  cellDark: {
    backgroundColor: '#34495e',
    borderColor: '#4a6278',
  },
  cellText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  cellTextDark: {
    color: '#ecf0f1',
  },
  // Estilos para inputs
  inputContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  inputContainerInsideList: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  input: {
    width: '90%',
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E6EA',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  // inputDark eliminado
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#3498db',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  // addButtonDark eliminado
  addButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Estilos para mostrar jugadas
  jugadaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
    justifyContent: 'space-between',
  },
  numeroText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  circleContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  circle: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6, // Permite que el círculo se estire horizontalmente
  },
  circleText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Estilos para parles
  parleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  numerosParleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 3,
  },
  numeroParleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  circleOutline: {
    minWidth: 32,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  circleOutlineText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  parleInput: {
    height: 45,
  },
  precioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '90%',
    gap: 8,
  },
  precioInput: {
    flex: 1,
    height: 40,
  },
  candadoButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ecf0f1',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  candadoText: {
    fontSize: 16,
  },
  candadoLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Estilos para header con inputs transparentes
  headerInputsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  headerInputsHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transparentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
    backgroundColor: 'transparent',
  },
  headerCandadoButton: {
    width: 25,
    height: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerCandadoText: {
    fontSize: 14,
  },
  // Estilos para inputs horizontales
  parleInputsHorizontal: {
    flexDirection: 'row',
    width: '90%',
    gap: 8,
    marginBottom: 8,
  },
  centenaInputsHorizontal: {
    flexDirection: 'row',
    width: '90%',
    gap: 8,
    marginBottom: 8,
  },
  inputHorizontal: {
    flex: 1,
    height: 40,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  candadoSection: {
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  // Estilos para centenas
  centenaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
    justifyContent: 'space-between',
  },
  numeroCentenaText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
  },
  // Estilos para estados de jugadas
  jugadaSeleccionada: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
    borderWidth: 2,
  },
  textoError: {
    color: '#f44336',
  },
  textoEnviado: {
    color: '#4caf50',
  },
  circleError: {
    borderColor: '#f44336',
  },
  circleEnviado: {
    borderColor: '#4caf50',
  },
  // Estilos para botones de acción
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 0, // Sin padding vertical
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    marginTop: 0, // Sin margen superior
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  sendButton: {
    backgroundColor: '#28a745',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  totalsSection: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  totalField: {
    marginBottom: 8,
  },
});

export default VaultModeScreen;