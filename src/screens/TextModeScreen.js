import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
// PlaysInputField removido para modo texto avanzado (acepta letras/comandos)
import MoneyInputField from '../components/MoneyInputField';
import ActionButton from '../components/ActionButton';
import HammerButton from '../components/HammerButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
import useUserRole from '../hooks/useUserRole';
// InfoButton general sustituido por versión específica de modo texto
import TextModeInfoButton from '../components/TextModeInfoButton';
import InfoButton from '../components/InfoButton'; // (si aún se usa en otro lugar)
import { parseTextMode } from '../utils/textModeParser';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { t } from '../utils/i18n';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { supabase } from '../supabaseClient';
import { useOffline } from '../context/OfflineContext';

const TextModeScreen = ({ navigation, route, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]); // valores id lotería (máx 3 como visual)
  const [selectedSchedules, setSelectedSchedules] = useState({}); // { lotteryId: scheduleId }
  const [plays, setPlays] = useState(''); // texto crudo con comandos
  const [note, setNote] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0); // no se usa directamente ahora, se mantiene por compatibilidad
  const [total, setTotal] = useState(0); // total global mostrado (todas las loterías)
  const [parsedInstructions, setParsedInstructions] = useState([]); // [{playType, numbers:[...], amountEach, totalPerLottery}]
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // Candado oculto en este modo
  const [parseErrors, setParseErrors] = useState([]); // [{line,message}]
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false); // si falta algún horario
  const [playsError, setPlaysError] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const [limitViolations, setLimitViolations] = useState([]); // [{numero, jugada, permitido, usado}]
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  // Datos dinámicos
  const [lotteries, setLotteries] = useState([]); // {label,value}
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // {lotteryId:[{label,value}]}
  const [bankId, setBankId] = useState(null);
  const [userId, setUserId] = useState(null);
  const loadingRef = useRef(false);
  // Feedback de inserción
  const [insertFeedback, setInsertFeedback] = useState(null); // {success, fail, duplicates:[]}
  const feedbackTimerRef = useRef(null);

  // Hook para enviar jugadas al almacenamiento
  const { submitPlayWithConfirmation } = usePlaySubmission();
  const { offlineMode, addToQueue, getQueue, clearFromQueue } = useOffline();

  // Cargar contexto de usuario (bankId)
  useEffect(()=>{
    const loadContext = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;
        setUserId(user.id);
        const { data: profile } = await supabase.from('profiles').select('role,id_banco').eq('id', user.id).maybeSingle();
        if(!profile) return;
        const bId = profile.role === 'admin' ? user.id : profile.id_banco;
        setBankId(bId);
      } catch(e){ /* ignore */ }
    };
    loadContext();
  },[]);

  // Cargar loterías del banco
  useEffect(()=>{
    if(!bankId) return;
    let cancelled=false;
    const loadLots = async () => {
      try {
        const { data: lots } = await supabase.from('loteria').select('id,nombre').eq('id_banco', bankId).order('nombre');
        if(cancelled) return;
        setLotteries((lots||[]).map(l=> ({ label:l.nombre, value:l.id })));
      } catch(e){ /* ignore */ }
    };
    loadLots();
    return ()=>{ cancelled=true; };
  },[bankId]);

  // Cargar horarios abiertos para TODAS las loterías del banco (como modo visual) y filtrar abiertas
  useEffect(()=>{
    if(!bankId || lotteries.length===0) { setScheduleOptionsMap({}); return; }
    let cancelled=false;
    const loadAllSchedules = async () => {
      try {
        const lotIds = lotteries.map(l=> l.value);
        const { data: rows } = await supabase
          .from('horario')
          .select('id,nombre,id_loteria,hora_inicio,hora_fin')
          .in('id_loteria', lotIds)
          .order('nombre');
        if(cancelled) return;
        const now = new Date();
        const nowMin = now.getHours()*60 + now.getMinutes();
        const isOpen = (hi,hf)=>{
          if(!hi||!hf) return false;
          const [shi,smi]=hi.split(':');
          const [shf,smf]=hf.split(':');
          const start = parseInt(shi,10)*60 + parseInt(smi||'0',10);
          const end = parseInt(shf,10)*60 + parseInt(smf||'0',10);
          if(start===end) return true;
          if(end>start) return nowMin>=start && nowMin<end;
          return (nowMin>=start) || (nowMin<end);
        };
        const grouped={};
        (rows||[]).filter(r=> isOpen(r.hora_inicio,r.hora_fin)).forEach(r=>{
          if(!grouped[r.id_loteria]) grouped[r.id_loteria]=[];
          grouped[r.id_loteria].push({ label:r.nombre, value:r.id });
        });
        setScheduleOptionsMap(grouped);
        // Podar horarios seleccionados para loterías removidas o cerradas
        setSelectedSchedules(prev=>{
          const next={...prev};
            Object.keys(next).forEach(k=>{ if(!grouped[k] || !grouped[k].some(o=> o.value===next[k])) delete next[k]; });
          return next;
        });
      } catch(e){ /* ignore */ }
    };
    loadAllSchedules();
    return ()=>{ cancelled=true; };
  },[bankId, lotteries]);

  // Auto-ocultar feedback
  useEffect(()=>{
    if(insertFeedback && insertFeedback.fail===0){
      feedbackTimerRef.current && clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(()=> setInsertFeedback(null), 3000);
    }
    return ()=> { feedbackTimerRef.current && clearTimeout(feedbackTimerRef.current); };
  },[insertFeedback]);

  const getLotteryLabel = (value) => lotteries.find(l=> l.value===value)?.label || value;
  const getScheduleLabel = (lotteryValue, scheduleValue) => (scheduleOptionsMap[lotteryValue]||[]).find(s=> s.value===scheduleValue)?.label || scheduleValue || '';

  // Parser delegado a util
  useEffect(()=>{
    const { instructions, errors, perLotterySum } = parseTextMode(plays, { isLocked });
    setParsedInstructions(instructions);
    setTotal(perLotterySum * (selectedLotteries.length||1));
    setParseErrors(errors);
    setPlaysError(errors.length>0);
  }, [plays, isLocked, selectedLotteries]);

  const handleClear = () => {
  setSelectedLotteries([]);
  setSelectedSchedules({});
  setPlays('');
  setNote('');
  setCalculatedAmount(0);
  setTotal(0);
  setParsedInstructions([]);
    setShowFieldErrors(false);
    setLotteryError(false); setScheduleError(false); setPlaysError(false); setNoteError(false); setLotteryErrorMessage('');
    setInsertFeedback(null);
  };

  // Validación unificada similar al modo visual (simplificada)
  const validateForm = () => {
    let hasErrors=false;
    setLotteryError(false); setScheduleError(false); setPlaysError(false); setNoteError(false); setLotteryErrorMessage('');
    if(!selectedLotteries.length){ setLotteryError(true); setLotteryErrorMessage(t('errors.selectLottery')); hasErrors=true; }
    // Falta algún horario
    const missingSchedules = selectedLotteries.filter(lv => !selectedSchedules[lv]);
    if(missingSchedules.length){ setScheduleError(true); hasErrors=true; }
  if(!plays.trim()){ setPlaysError(true); hasErrors=true; }
    if(!note.trim()){ setNoteError(true); hasErrors=true; }
    if(!hasErrors){
      // Verificar números incompletos (tomamos longitud por primera jugada inferida a partir de longitud del primer token)
      const tokens = plays.split(/[,\s;]+/).map(t=>t.trim()).filter(Boolean);
      if(tokens.length){
        const firstDigits = tokens[0].replace(/[^0-9]/g,'');
        let expectedLen = firstDigits.length; // heurística
        if(expectedLen<2) expectedLen=2; if(expectedLen>6) expectedLen=6;
        const partial = tokens.some(tok=>{ const d=tok.replace(/[^0-9]/g,''); return d.length>0 && d.length!==expectedLen; });
        if(partial){ setPlaysError(true); hasErrors=true; }
      }
    }
    if(hasErrors) setShowFieldErrors(true);
    return !hasErrors;
  };

  const handleVerify = () => {
    // Validar campos requeridos
    if (!selectedLotteries.length || !selectedSchedule || !plays) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }
    
    const playList = plays.split(',').filter(play => play.trim() !== '');
    alert(`Verificación:\nLotería: ${selectedLotteries.join(', ')}\nHorario: ${selectedSchedule}\nJugadas: ${playList.length}\nMonto: $${calculatedAmount.toFixed(2)}`);
  };

  const handleInsert = async () => {
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setPlaysError(false);
    setNoteError(false);
    setLotteryErrorMessage('');
  setLimitViolations([]);

    // Validar campos requeridos
    let hasErrors = !validateForm();

    // Validación de límites (simplificada para modo texto: cada jugada vale 1 unidad)
    if (!hasErrors) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let specificLimits = null;
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', user.id).maybeSingle();
            specificLimits = profile?.limite_especifico || null;
        }
        const horarios = selectedSchedule ? [selectedSchedule] : [];
        if (horarios.length) {
          const { data: limitRows } = await supabase
            .from('limite_numero')
            .select('numero, limite, jugada, id_horario')
            .in('id_horario', horarios);
          const { data: usedRows } = await supabase
            .from('numero_limitado')
            .select('numero, limite, jugada, id_horario')
            .in('id_horario', horarios);
          const limitMap = new Map();
          (limitRows||[]).forEach(r=>{
            limitMap.set(r.id_horario+"|"+r.jugada+"|"+r.numero, r.limite);
          });
          const usedMap = new Map();
            (usedRows||[]).forEach(r=>{
              const k = r.id_horario+"|"+r.jugada+"|"+r.numero;
              usedMap.set(k, (usedMap.get(k)||0)+(r.limite||0));
            });
          const playList = plays.split(',').map(p=>p.trim()).filter(Boolean);
          const numbers = playList.map(p=>p.replace(/[^0-9]/g,''));
          const violations = [];
          numbers.forEach(numRaw=>{
            const numInt = parseInt(numRaw,10);
            // Jugadas base asumidas: fijo,corrido,posicion,parle,centena,tripleta si hay limites específicos
            const jugadas = specificLimits ? Object.keys(specificLimits) : [];
            jugadas.forEach(j=>{
              horarios.forEach(h=>{
                const key = h+"|"+j+"|"+numInt;
                const byNumber = limitMap.get(key);
                const specific = specificLimits && specificLimits[j];
                let effective;
                if (byNumber !== undefined && specific !== undefined) effective = Math.min(byNumber, specific); else if (byNumber !== undefined) effective = byNumber; else if (specific !== undefined) effective = specific; else return;
                const used = usedMap.get(key) || 0;
                const amt = 1; // cada jugada vale 1 en este modo
                if ((used + amt) > effective) {
                  violations.push({ numero:numRaw, jugada:j, permitido:effective, usado:used });
                }
              });
            });
          });
          if (violations.length) {
            setLimitViolations(violations);
            hasErrors = true;
          }
        }
      } catch(e) { /* silencioso */ }
    }

  if (hasErrors) {
      // Quitar errores después de 3 segundos
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setPlaysError(false);
    setNoteError(false);
        setLotteryErrorMessage('');
  setLimitViolations([]);
      }, 3000);
      return;
    }

  // Usar instrucciones parseadas
  if(!parsedInstructions.length){ setPlaysError(true); return; }
    
    try {
  // Crear un objeto de jugada para cada lotería seleccionada
  const playsToSave = [];
      
      for (const lottery of selectedLotteries) {
        for(const instr of parsedInstructions){
          const playData = {
            lottery: lottery,
            schedule: selectedSchedules[lottery],
            playType: instr.playType,
            numbers: instr.numbers, // array
            note: note.trim(),
            amount: instr.amountEach,
            total: instr.totalPerLottery
          };
          playsToSave.push(playData);
        }
      }
      
      if (offlineMode) {
        let enq = 0;
        for (const p of playsToSave) {
          // Map to DB row payload to align with Visual
          const payload = {
            id_listero: null, // se establecerá en el servidor por RLS o podemos setear userId si disponible
            id_horario: p.schedule,
            jugada: p.playType,
            numeros: Array.isArray(p.numbers) ? p.numbers.join(',') : String(p.numbers || ''),
            nota: p.note || 'Sin nombre',
            monto_unitario: p.amount || 0,
            monto_total: p.total || 0,
          };
          const res = await addToQueue({ type: 'jugada', payload });
          if (res.ok) enq += 1;
        }
        setInsertFeedback({ success: enq, fail: playsToSave.length - enq, duplicates: [], edit: false });
        Alert.alert('Modo Offline', `Jugadas guardadas localmente (${enq}).`);
      } else {
        // Usar Promise.all para guardar todas las jugadas
        const results = await Promise.all(
          playsToSave.map(async playData => {
            try { await submitPlayWithConfirmation(playData); return { ok:true }; }
            catch(e){ return { ok:false, error:e }; }
          })
        );
        const success = results.filter(r=>r.ok).length;
        const fail = results.length - success;
        setInsertFeedback({ success, fail, duplicates:[], edit:false });
      }
      
      // Solo limpiar plays, note y montos - mantener lotería y horario
      setPlays('');
  setNote('');
  setCalculatedAmount(0);
  setTotal(0);
  setParsedInstructions([]);
      
    } catch (error) {
      console.error('Error al guardar las jugadas:', error);
      alert('Error al guardar las jugadas. Inténtalo de nuevo.');
    }
  };

  // Triggered manual sync similar to Visual screen
  useEffect(() => {
    const trig = route?.params?.triggerSync;
    if (!trig) return;
    (async () => {
      try {
        const q = await getQueue();
        const sentIds = [];
        for (const item of q) {
          try {
            const { error } = await supabase.from('jugada').insert(item.payload).select('id').single();
            if (!error) sentIds.push(item.__id);
          } catch {}
        }
        if (sentIds.length) await clearFromQueue(sentIds);
      } catch {}
    })();
  }, [route?.params?.triggerSync]);

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

  const toggleLock = () => { /* Candado no visible aquí */ };

  const { role: userRole } = useUserRole();
  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.headerFloating} pointerEvents="box-none">
        <View style={styles.inlineHeaderRow} pointerEvents="box-none">
          <SideBarToggle inline onToggle={toggleSidebar} />
          <View style={styles.modeSelectorWrapper}>
            <ModeSelector 
              currentMode={currentMode}
              onModeChange={onModeChange}
              isDarkMode={isDarkMode}
              visibleModes={visibleModes || { visual: true, text: true }}
            />
          </View>
          <View style={styles.rightButtonsGroup} pointerEvents="box-none">
            <PricingInfoButton />
            <NotificationsButton role={userRole || 'listero'} />
          </View>
        </View>
  {/* Modo Offline movido al contenido para no superponer el header */}
  {/* Eliminado InfoButton general flotante en favor de botón en barra inferior */}
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {offlineMode && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>Modo Offline</Text>
          </View>
        )}
        {/* Row 1: Lotería */}
        <MultiSelectDropdown
          label={t('common.lottery')}
          selectedValues={selectedLotteries}
          onSelect={(vals)=>{
            // Limitar a 3 como en modo visual
            let next = vals.length>3 ? vals.slice(0,3) : vals;
            setSelectedLotteries(next);
          }}
          options={lotteries}
          placeholder={t('placeholders.selectLotteries')}
          isDarkMode={isDarkMode}
          hasError={lotteryError || (showFieldErrors && !selectedLotteries.length)}
          errorMessage={lotteryErrorMessage}
        />

        {/* Horarios (ocultos hasta seleccionar loterías). Uno por lotería */}
        {selectedLotteries.length>0 && (
          <View style={styles.dynamicSchedulesRow}>
            {selectedLotteries.map(lv => {
              const count = selectedLotteries.length;
              const widthPct = count===1 ? '100%' : count===2 ? '48%' : '31.5%';
              const currentVal = selectedSchedules[lv] ? getScheduleLabel(lv, selectedSchedules[lv]) : '';
              return (
                <View key={lv} style={[styles.schedulePickerDynamic,{ width: widthPct }]}> 
                  <DropdownPicker
                    label={`${t('common.schedule')} ${getLotteryLabel(lv)}`}
                    value={currentVal}
                    onSelect={(item) => setSelectedSchedules(prev => ({ ...prev, [lv]: item.value || item }))}
                    options={scheduleOptionsMap[lv] || []}
                    placeholder={(scheduleOptionsMap[lv]||[]).length ? t('placeholders.selectSchedule') : t('placeholders.noSchedules')}
                    hasError={scheduleError && showFieldErrors && !selectedSchedules[lv]}
                  />
                </View>
              );
            })}
          </View>
        )}

  {/* Input crudo de comandos (acepta letras y números) */}
        <InputField
          label={t('common.numbers')}
          value={plays}
          onChangeText={(txt)=> { setPlays(txt); if(showFieldErrors){ /* no quitar bordes aún */ }}}
          placeholder="" // sin placeholder
          multiline={true}
          showPasteButton={true}
          pasteButtonOverlay={true}
          showClearButtonOverlay={true}
          onClear={()=> setPlays('')}
          hasError={showFieldErrors && (playsError || !plays.trim())}
        />
  {/* Se eliminan botones superiores duplicados */}
  {parsedInstructions.length>0 && (
          <View style={{ marginTop:4, marginBottom:4 }}>
            {parsedInstructions.slice(0,5).map((i,idx)=>(
              <Text key={idx} style={{ fontSize:11 }}>
                <Text style={{ color:'#2D5016', fontWeight:'600' }}>{i.playType.toUpperCase()}</Text>
                {' '}
                {i.numbers.map((n,ni)=>{
                  const isDup = i.duplicates.includes(n);
                  return (
                    <Text key={ni} style={{ color: isDup ? '#D4A300' : '#2D5016', fontWeight: isDup ? '700':'400' }}>
                      {n}{ni < i.numbers.length-1 ? ',' : ''}
                    </Text>
                  );
                })}
                {' '}x {i.amountEach} = {i.totalPerLottery}
              </Text>
            ))}
            {parsedInstructions.length>5 && <Text style={{ fontSize:11, color:'#2D5016' }}>+{parsedInstructions.length-5} más...</Text>}
            {/* Mensaje global de duplicados */}
            {parsedInstructions.some(i=> i.duplicates && i.duplicates.length) && (
              <Text style={{ fontSize:11, color:'#D4A300', marginTop:2 }}>
                Duplicados: {Array.from(new Set(parsedInstructions.flatMap(i=> i.duplicates || []))).length}
              </Text>
            )}
            {playsError && (
              <View style={{ marginTop:4 }}>
                {parseErrors.slice(0,4).map((e,i)=>(
                  <Text key={i} style={{ fontSize:11, color:'#C0392B' }}>Línea {e.line}: {e.message}</Text>
                ))}
                {parseErrors.length>4 && <Text style={{ fontSize:11, color:'#C0392B' }}>+{parseErrors.length-4} errores más...</Text>}
              </View>
            )}
          </View>
        )}
        {limitViolations.length > 0 && (
          <View style={{ marginTop:8, backgroundColor:'#fff5f5', borderWidth:1, borderColor:'#ffc9c9', padding:8, borderRadius:6 }}>
            {limitViolations.slice(0,5).map((v,idx)=>(
              <Text key={idx} style={{ color:'#c92a2a', fontSize:12 }}>
                Número {v.numero} ({v.jugada}) excede límite: usado {v.usado} + intento {'>'} permitido {v.permitido}
              </Text>
            ))}
            {limitViolations.length>5 && (
              <Text style={{ color:'#c92a2a', fontSize:12, marginTop:2 }}>+{limitViolations.length-5} más...</Text>
            )}
          </View>
        )}

        {/* Row 4: Nota y Total */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label={t('common.note')}
              value={note}
              onChangeText={setNote}
              placeholder=""
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
              hasError={noteError || (showFieldErrors && !note.trim())}
            />
          </View>
          <View style={styles.halfWidth}>
            <MoneyInputField
              label={t('common.total')}
              value={total.toString()}
              editable={false}
              placeholder="$0"
              style={styles.fieldContainer}
              inputStyle={styles.unifiedInput}
            />
          </View>
        </View>

        {/* Barra de herramientas inferior: Candado (izq), Martillo, Lista, Info (der) */}
        <View style={[styles.toolsContainer,{ justifyContent:'space-between', paddingHorizontal:4 }]}> 
          <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
            <Pressable onPress={()=> setIsLocked(l=> !l)} style={[styles.lockButton, isLocked && styles.lockButtonActive]}>
              <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
            </Pressable>
            <HammerButton onOptionSelect={(option) => console.log('Hammer option:', option)} />
            <ListButton onOptionSelect={(option) => console.log('List option:', option)} />
          </View>
          <TextModeInfoButton />
        </View>

        {/* Row 5: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.clear')}
              onPress={handleClear}
              variant="danger"
              size="small"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.verify')}
              onPress={handleVerify}
              variant="warning"
              size="small"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.insert')}
              onPress={handleInsert}
              variant="success"
              size="small"
            />
          </View>
        </View>
      </ScrollView>
      
      {insertFeedback && (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>Insertadas: {insertFeedback.success}  Fallos: {insertFeedback.fail}</Text>
          <Pressable onPress={()=> setInsertFeedback(null)} style={styles.feedbackClose}><Text style={styles.feedbackCloseTxt}>✕</Text></Pressable>
        </View>
      )}

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
    backgroundColor: '#f0f8ff',
  },
  containerDark: {
    backgroundColor: '#2c3e50',
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 3000,
  paddingTop: 8,
  paddingBottom: 8,
  paddingHorizontal: 12,
  backgroundColor: 'rgba(255,255,255,0.96)',
  borderBottomWidth: 1,
  borderBottomColor: '#E2E6EA',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 4,
  elevation: 4,
  },
  inlineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingTop: 0,
  },
  rightButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  modeSelectorWrapper: { marginLeft: 8 },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 120,
  },
  offlineBanner: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E8',
    borderColor: '#27AE60',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  offlineBannerText: {
    color: '#1E8449',
    fontWeight: '800',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  threeColumnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 6,
  },
  schedulesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  scheduleCol: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  dynamicSchedulesRow:{
    flexDirection:'row',
    flexWrap:'wrap',
    alignItems:'flex-start',
    gap:8,
    marginBottom:8,
  },
  schedulePickerDynamic:{
    // width set inline dynamically
  },
  halfWidth: {
    flex: 1,
  },
  thirdWidth: {
    flex: 1,
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
  lockButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 6,
  },
  actionButton: {
    flex: 1,
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
  feedbackBanner: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width:0, height:2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 4000,
  },
  feedbackText:{ flex:1, fontSize:13, fontWeight:'600', color:'#2D5016' },
  feedbackClose:{ marginLeft:10, padding:4 },
  feedbackCloseTxt:{ fontSize:14, fontWeight:'700', color:'#C0392B' },
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
    shadowOffset: { width:0, height:2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  lockButtonActive: {
    backgroundColor: '#FFE4B5',
    borderColor: '#D4AF37',
  },
  lockIcon: { fontSize:18 },
  inlineToolBtn:{
    backgroundColor:'#E8F5E8',
    borderWidth:1,
    borderColor:'#B8D4A8',
    borderRadius:6,
    paddingHorizontal:10,
    paddingVertical:8,
  },
  inlineToolBtnActive:{ backgroundColor:'#FFE4B5', borderColor:'#D4AF37' },
  inlineToolBtnTxt:{ fontSize:14, fontWeight:'600', color:'#2D5016' },
});

export default TextModeScreen;
