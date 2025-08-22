import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
// PlaysInputField removido para modo texto avanzado (acepta letras/comandos)
import MoneyInputField from '../components/MoneyInputField';
import ActionButton from '../components/ActionButton';
import CleanerButton from '../components/CleanerButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
// InfoButton general sustituido por versión específica de modo texto
import TextModeInfoButton from '../components/TextModeInfoButton';
// Eliminamos CapacityModal directo; usaremos BatteryButton que lo incluye internamente
import BatteryButton from '../components/BatteryButton';
// import CapacityModal from '../components/CapacityModal';
import { parseTextMode2 } from '../utils/textModeParser2';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import FeedbackBanner from '../components/FeedbackBanner';
import { t } from '../utils/i18n';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { supabase } from '../supabaseClient';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';

const TextMode2Screen = ({ navigation, route, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]); // valores id lotería (máx 3 como visual)
  const [selectedSchedules, setSelectedSchedules] = useState({}); // { lotteryId: scheduleId }
  const [plays, setPlays] = useState(''); // texto crudo con comandos
  const [note, setNote] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0); // no se usa directamente ahora, se mantiene por compatibilidad
  const [total, setTotal] = useState(0); // total global mostrado (todas las loterías)
  const [parsedInstructions, setParsedInstructions] = useState([]); // [{playType, numbers:[...], amountEach, totalPerLottery}]
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [parseErrors, setParseErrors] = useState([]); // [{line,message}]
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false); // si falta algún horario
  const [playsError, setPlaysError] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const [limitViolations, setLimitViolations] = useState([]); // [{numero, jugada, permitido, usado}]
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  // Capacidades ahora manejadas por BatteryButton (se eliminan estados locales duplicados)

  // Lógica de capacidad eliminada (delegada a BatteryButton)

  // Datos dinámicos
  const [lotteries, setLotteries] = useState([]); // {label,value}
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // {lotteryId:[{label,value}]}
  // Cargar payload de edición si llega (desde SavedPlays) y estamos en modo texto
  useEffect(()=>{
    const payload = route?.params?.editPayload;
    if(payload && payload.id !== editingId){
      setEditingId(payload.id);
      setIsEditing(true);
      const lot = lotteries.find(l=> l.label === payload.lottery);
      if(lot){ setSelectedLotteries([lot.value]); }
      const scheduleSetter = () => {
        if(!lot) return;
        const schs = scheduleOptionsMap[lot.value] || [];
        const sch = schs.find(s=> s.label === payload.schedule);
        if(sch){ setSelectedSchedules(prev=> ({ ...prev, [lot.value]: sch.value })); }
      };
      scheduleSetter();
      setPlays(payload.numbers || '');
      setNote(payload.note || '');
      navigation?.setParams?.({ editPayload: undefined });
    }
  },[route?.params?.editPayload, lotteries, scheduleOptionsMap]);
  const [bankId, setBankId] = useState(null);
  const [userId, setUserId] = useState(null);
  const loadingRef = useRef(false);
  // Feedback de inserción
  const [insertFeedback, setInsertFeedback] = useState(null); // {success, fail, duplicates:[]}
  const [verifyFeedback, setVerifyFeedback] = useState(null); // { type:'success'|'error', message:string }
  const verifyTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const [editingMultiError, setEditingMultiError] = useState(false);

  // Hook para enviar jugadas al almacenamiento
  const { submitPlayWithConfirmation } = usePlaySubmission();

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

  useEffect(()=>{
    if(verifyFeedback){
      verifyTimerRef.current && clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = setTimeout(()=> setVerifyFeedback(null), 5000);
    }
    return ()=> { verifyTimerRef.current && clearTimeout(verifyTimerRef.current); };
  },[verifyFeedback]);

  // Monitorear multi-instrucción en edición
  useEffect(()=>{
    if(isEditing){
      if(parsedInstructions.length>1){
        setEditingMultiError(true);
        setPlaysError(true);
      } else {
        setEditingMultiError(false);
        if(parseErrors.length===0) setPlaysError(false);
      }
    } else {
      setEditingMultiError(false);
    }
  },[isEditing, parsedInstructions, parseErrors]);

  const getLotteryLabel = (value) => lotteries.find(l=> l.value===value)?.label || value;
  const getScheduleLabel = (lotteryValue, scheduleValue) => (scheduleOptionsMap[lotteryValue]||[]).find(s=> s.value===scheduleValue)?.label || scheduleValue || '';

  // Parser delegado a util
  useEffect(()=>{
    const { instructions, errors, perLotterySum } = parseTextMode2(plays);
    setParsedInstructions(instructions);
    setTotal(perLotterySum * (selectedLotteries.length||1));
    setParseErrors(errors);
    setPlaysError(errors.length>0);
  }, [plays, selectedLotteries]);

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
  const validateForm = (includeNote=true) => {
    let hasErrors=false;
    setLotteryError(false); setScheduleError(false); setPlaysError(false); setNoteError(false); setLotteryErrorMessage('');
    if(!selectedLotteries.length){ setLotteryError(true); setLotteryErrorMessage(t('errors.selectLottery')); hasErrors=true; }
    // Falta algún horario
    const missingSchedules = selectedLotteries.filter(lv => !selectedSchedules[lv]);
    if(missingSchedules.length){ setScheduleError(true); hasErrors=true; }
    if(!plays.trim()){ setPlaysError(true); hasErrors=true; }
    if(includeNote && !note.trim()){ setNoteError(true); hasErrors=true; }
    if(hasErrors) setShowFieldErrors(true);
    return !hasErrors;
  };

  const handleVerify = async () => {
    setVerifyFeedback(null);
  if(!note.trim()) setNoteError(true);
    // Reusar validación base
    const valid = validateForm(true);
    if(!valid){
  setVerifyFeedback({ type:'error', message:t('errors.requiredOrFix') });
      return;
    }
    if(isEditing && parsedInstructions.length>1){
  setVerifyFeedback({ type:'error', message:t('errors.singleInstructionEdit') });
      return;
    }
    if(parseErrors.length){
  setVerifyFeedback({ type:'error', message:`${t('errors.parse')}: ${parseErrors.length}` });
      return;
    }
    if(!parsedInstructions.length){
  setVerifyFeedback({ type:'error', message:t('errors.noValidInstructions') });
      return;
    }
    try {
      // Validaciones de límites reutilizando util canónico
      const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
      let violations=[];
      if(horarios.length){
        const { data: { user } } = await supabase.auth.getUser();
        const ctx = await fetchLimitsContext(horarios, user?.id);
        // Si estamos editando, restar el uso previo de la jugada en ese horario para no bloquear por capacidad
        if(isEditing && editingId){
          try {
            const { data: currentPlay } = await supabase
              .from('jugada')
              .select('id_horario,jugada,numeros,monto_unitario')
              .eq('id', editingId)
              .maybeSingle();
            if(currentPlay && horarios.includes(currentPlay.id_horario)){
              const prevNums = (currentPlay.numeros||'').split(',').map(s=>s.trim()).filter(Boolean);
              const toCanon = (pt,n)=> pt==='parle' && /^\d{4}$/.test(n) ? [n.slice(0,2),n.slice(2)].sort().join('') : n;
              prevNums.forEach(n => {
                const canon = toCanon(currentPlay.jugada, n);
                const key = currentPlay.id_horario+"|"+currentPlay.jugada+"|"+canon;
                if(ctx.usageMap.has(key)){
                  const after = (ctx.usageMap.get(key)||0) - (currentPlay.monto_unitario||0);
                  if(after>0) ctx.usageMap.set(key, after); else ctx.usageMap.delete(key);
                }
              });
            }
          } catch(_) { /* silencio */ }
        }
        violations = checkInstructionsLimits(parsedInstructions, horarios, ctx);
      }
      if(violations.length){
        setLimitViolations(violations);
        const first = violations.slice(0,3).map(v=> `${v.numero}(${v.jugada})`).join(', ');
        setVerifyFeedback({ type:'error', message:`${t('verify.limitViolations')}: ${violations.length}${violations.length? ' - '+first+(violations.length>3?'...':''):''}` });
        return;
      }
      // Resumen agregado sin listar números
      const summaryCounts = parsedInstructions.reduce((acc,i)=>{ acc[i.playType]=(acc[i.playType]||0)+i.numbers.length; return acc; },{});
      const parts = Object.keys(summaryCounts).map(pt=> `${pt}:${summaryCounts[pt]}`).join(' | ');
      // Duplicados únicos por clave canónica (por tipo)
      const dupDetails = (()=>{
        const toCanon = (pt,n)=> pt==='parle' && /^\d{4}$/.test(n) ? [n.slice(0,2),n.slice(2)].sort().join('') : n;
        const linesMap = new Map(); // key: pt|canon -> Set(lines)
        parsedInstructions.forEach(inst=>{
          inst.numbers.forEach(n=>{
            const k = `${inst.playType}|${toCanon(inst.playType, n)}`;
            linesMap.set(k, (linesMap.get(k)||new Set()).add(inst.line));
          });
        });
        // contar únicos con ocurrencia >1
        const counts = {};
        const examples = {};
        parsedInstructions.forEach(inst=>{
          inst.numbers.forEach(n=>{
            const canon = toCanon(inst.playType, n);
            const key = `${inst.playType}|${canon}`;
            counts[key] = (counts[key]||0)+1;
            if(!examples[key]) examples[key]=n; // guardar sample original
          });
        });
        const dupKeys = Object.keys(counts).filter(k=> counts[k]>1);
        if(!dupKeys.length) return '';
        const first = dupKeys.slice(0,3).map(k=>{
          const sample = examples[k];
          const ls = linesMap.get(k) ? Array.from(linesMap.get(k)).join('/') : '';
          return `${sample}(L${ls})`;
        }).join(', ');
        return ` | Duplicados: ${dupKeys.length}${dupKeys.length>3? ' ('+first+'...)':' ('+first+')'}`;
      })();
      setVerifyFeedback({ type:'success', message:`${t('verify.summaryPrefix')}: ${parts}. Total: ${total}${dupDetails}` });
    } catch(err){
      setVerifyFeedback({ type:'error', message:t('errors.verify') });
    }
  };

  const handleInsert = async () => {
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setPlaysError(false);
    setNoteError(false);
    setLotteryErrorMessage('');
  setLimitViolations([]);

    // Si estamos editando una jugada existente (solo soportamos edición de UNA jugada a la vez en modo texto)
    if(isEditing && editingId){
      const valid = validateForm(true);
      if(!valid || !parsedInstructions.length){ setPlaysError(true); return; }
  if(parsedInstructions.length>1){ setPlaysError(true); setVerifyFeedback({ type:'error', message:t('errors.editSingle') }); return; }
      const instr = parsedInstructions[0];
      try {
        const lottery = selectedLotteries[0];
        const newHorario = selectedSchedules[lottery];
        // Validación de límites para edición
        if(newHorario){
          const { data: { user } } = await supabase.auth.getUser();
          const ctx = await fetchLimitsContext([newHorario], user?.id);
          // Restar uso previo de la jugada actual para no duplicar consumo del límite
          try {
            const { data: currentPlay } = await supabase
              .from('jugada')
              .select('id_horario,jugada,numeros,monto_unitario')
              .eq('id', editingId)
              .maybeSingle();
            if(currentPlay && currentPlay.id_horario === newHorario){
              const prevNums = (currentPlay.numeros||'').split(',').map(s=>s.trim()).filter(Boolean);
              const toCanon = (pt,n)=> pt==='parle' && /^\d{4}$/.test(n) ? [n.slice(0,2),n.slice(2)].sort().join('') : n;
              prevNums.forEach(n => {
                const canon = toCanon(currentPlay.jugada, n);
                const key = newHorario+"|"+currentPlay.jugada+"|"+canon;
                if(ctx.usageMap.has(key)){
                  const after = (ctx.usageMap.get(key)||0) - (currentPlay.monto_unitario||0);
                  if(after>0) ctx.usageMap.set(key, after); else ctx.usageMap.delete(key);
                }
              });
            }
          } catch(_) { /* silencioso */ }
          const violations = checkInstructionsLimits([instr], [newHorario], ctx);
          if(violations.length){ setLimitViolations(violations); setInsertFeedback({ success:0, fail:1, edit:true, blocked:true }); return; }
        }
        // Recalcular total (ya está en parser) y ejecutar update
        const pad=(n)=> String(n).padStart(2,'0');
        const now=new Date();
        const tsLocal = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const updatePayload={ numeros: instr.numbers.join(','), nota: note.trim() || 'Sin nombre', monto_unitario: instr.amountEach, monto_total: instr.totalPerLottery, jugada: instr.playType };
        if(newHorario) updatePayload.id_horario = newHorario;
  const { error } = await supabase.from('jugada').update(updatePayload).eq('id', editingId);
        if(error) throw error;
        setInsertFeedback({ success:1, fail:0, duplicates:[], edit:true });
        setIsEditing(false); setEditingId(null);
        setPlays(''); setNote(''); setParsedInstructions([]); setTotal(0);
      } catch(e){
  console.error('Error al actualizar jugada:', e);
  setInsertFeedback({ success:0, fail:1, edit:true, serverError: e?.message || 'Error al actualizar' });
      }
      return;
    }

    // Validar campos requeridos
  let hasErrors = !validateForm(true);

    // Validación de capacidad (unificada con modo visual) usando uso del día en tabla jugada
    if (!hasErrors) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
        if(horarios.length && parsedInstructions.length){
          const ctx = await fetchLimitsContext(horarios, user?.id);
          const violations = checkInstructionsLimits(parsedInstructions, horarios, ctx);
          if(violations.length){ setLimitViolations(violations); hasErrors=true; setInsertFeedback({ success:0, fail:1, blocked:true }); }
        }
      } catch(e){ /* silencio */ }
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
  }, 5000);
      return;
    }

      // Usar instrucciones parseadas
      if(!parsedInstructions.length){ setPlaysError(true); return; }

      try {
    const playsToSave = [];
        for (const lottery of selectedLotteries) {
          for(const instr of parsedInstructions){
      let unit = instr.amountEach;
      let total = instr.totalPerLottery;
            playsToSave.push({
              lottery,
              schedule: selectedSchedules[lottery],
              playType: instr.playType,
              numbers: instr.numbers.join(','),
              note: note.trim(),
              amount: unit,
              total
            });
          }
        }
        let success=0; let fail=0; let blockedViolations=[]; let errMsgs=[];
        for(const playData of playsToSave){
          const result = await submitPlayWithConfirmation(playData);
          if(result.success) success++; else { 
            fail++; 
            if(result.limitViolations) blockedViolations = blockedViolations.concat(result.limitViolations);
            if(result.message) errMsgs.push(result.message);
          }
        }
        if(blockedViolations.length){
          setLimitViolations(blockedViolations.map(v=> ({ numero:v.number, jugada:v.limitType || v.jugada || '', permitido:v.limit, usado:v.current })));
        }
  setInsertFeedback({ success, fail, duplicates:[], edit:false, serverError: errMsgs.join(' | ') });
        if(success){
          setPlays(''); setNote(''); setCalculatedAmount(0); setTotal(0); setParsedInstructions([]);
        }
      } catch (error) {
        console.error('Error al guardar las jugadas:', error);
        alert('Error al guardar las jugadas. Inténtalo de nuevo.');
      }
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

  const toggleLock = () => {};

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
            <NotificationsButton />
          </View>
        </View>
  {/* Eliminado InfoButton general flotante en favor de botón en barra inferior */}
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          placeholder="Números / comandos"
          multiline={true}
          showPasteButton={true}
          pasteButtonOverlay={true}
          showClearButtonOverlay={true}
          onClear={()=> setPlays('')}
          hasError={showFieldErrors && (playsError || !plays.trim())}
        />
  {/* Se eliminan botones superiores duplicados */}
        {(plays.length>0) && (
          <View style={{ marginTop:4, marginBottom:4 }}>
            {/* Resumen agregado por tipo sin mostrar números */}
            {parsedInstructions.length>0 && (()=>{
              const byType = parsedInstructions.reduce((acc,i)=>{ acc[i.playType]=(acc[i.playType]||{ count:0, total:0 }); acc[i.playType].count += i.numbers.length; acc[i.playType].total += i.totalPerLottery; return acc; },{});
              const order=['fijo','corrido','parle','centena','tripleta'];
              const hasDup = parsedInstructions.some(i=> i.duplicates && i.duplicates.length);
              return order.filter(t=> byType[t]).map(t=> (
                <Text key={t} style={{ fontSize:11, color: hasDup ? '#D4A300':'#2D5016' }}>{t.toUpperCase()}: {byType[t].count} nums | Total: {byType[t].total}</Text>
              ));
            })()}
            {/* Duplicados solo cantidad */}
            {parsedInstructions.some(i=> i.duplicates && i.duplicates.length) && (()=>{
              const totalDup = parsedInstructions.reduce((acc,i)=> acc + (i.duplicates? i.duplicates.length:0),0);
              return (<Text style={{ fontSize:11, color:'#D4A300', marginTop:2 }}>{t('banner.duplicates')}: {totalDup}</Text>);
            })()}
            {/* Errores de parseo */}
            {parseErrors.length>0 && (
              <View style={{ marginTop:4 }}>
                {parseErrors.slice(0,4).map((e,i)=>(
                  <Text key={i} style={{ fontSize:11, color:'#C0392B' }}>Línea {e.line}: {e.message}</Text>
                ))}
                {parseErrors.length>4 && <Text style={{ fontSize:11, color:'#C0392B' }}>+{parseErrors.length-4} errores más...</Text>}
              </View>
            )}
          </View>
        )}
  {/* Limit violations visual removido (ahora solo en FeedbackBanner) */}

        {/* Row 4: Nota y Total */}
        <View style={styles.row}>
          <View style={styles.halfWidth}>
            <InputField
              label={t('common.note')}
              value={note}
              onChangeText={(v)=>{ setNote(v); if(v.trim()) setNoteError(false); }}
              placeholder="Nombre"
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

        {/* Barra de herramientas inferior: candado, capacidad, martillo, lista, info, registro (insert) */}
  <View style={[styles.toolsContainer,{ justifyContent:'center', flexWrap:'wrap', gap:12 }]}> 
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
          {/* Martillo oculto en Modo Texto 2.0 */}
          <ListButton currentMode={currentMode} onOptionSelect={(option) => console.log('List option:', option)} />
          <TextModeInfoButton icon="ℹ︎" mode="texto2" />
          <CleanerButton onInsert={(formatted)=>{
            setPlays(prev => {
              if(!prev.trim()) return formatted; // vacío => reemplaza
              return prev + (prev.endsWith('\n') ? '' : '\n') + formatted; // agrega con salto
            });
          }} />
        </View>

        {/* Row 5: Botones de acción */}
        <View style={[styles.actionRow,{ justifyContent:'center' }]}>
          <View style={styles.actionButton}><ActionButton title={t('actions.clear')} onPress={handleClear} variant="danger" size="small" /></View>
          <View style={styles.actionButton}><ActionButton title={t('actions.verify')} onPress={handleVerify} variant="warning" size="small" /></View>
          <View style={styles.actionButton}><ActionButton title={t('actions.insert')} onPress={handleInsert} variant="success" size="small" /></View>
        </View>
      </ScrollView>
      
      {verifyFeedback && (
        <FeedbackBanner 
          type={verifyFeedback.type==='success' ? 'success' : 'error'}
          message={verifyFeedback.message}
          onClose={()=> setVerifyFeedback(null)}
          style={{ top:70 }}
        />
      )}
      {isEditing && !verifyFeedback && (
        <View style={[styles.editBanner, editingMultiError && styles.editBannerError]}>
          <Text style={[styles.editBannerTxt, editingMultiError && styles.editBannerTxtError]}>
            {editingMultiError ? t('edit.modeHintError') : t('edit.modeHint')}
          </Text>
          <Pressable onPress={()=> { setIsEditing(false); setEditingId(null); }} style={styles.editBannerClose}> 
            <Text style={[styles.editBannerCloseTxt]}>Cancelar</Text>
          </Pressable>
        </View>
      )}
      {insertFeedback && (
        <FeedbackBanner
          type={insertFeedback.blocked ? 'blocked' : (insertFeedback.fail ? (insertFeedback.success ? 'warning' : 'error') : 'success')}
          message={insertFeedback.blocked ? `${t('edit.blocked')}: ${t('edit.blocked.detail')}` : `${t('banner.inserted')}: ${insertFeedback.success}  ${t('banner.fail')}: ${insertFeedback.fail}`}
          details={(limitViolations.length ? limitViolations.slice(0,10).map(v=> `${v.numero} (${v.jugada}) usado ${v.usado||0}${v.intento?` +${v.intento}`:''}/${v.permitido}`) : [])
            .concat(insertFeedback.serverError ? [`Servidor: ${insertFeedback.serverError}`] : [])}
          onClose={()=> setInsertFeedback(null)}
          style={{ top: verifyFeedback ? 120 : 70 }}
        />
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
  {/* CapacityModal ahora gestionado por BatteryButton (🔋) */}
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
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 3000,
  paddingTop: 10,
  paddingBottom: 10,
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
    minHeight: 44,
  },
  rightButtonsGroup: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginLeft: 'auto',
  flexWrap: 'wrap',
  },
  modeSelectorWrapper: {
    marginLeft: 10,
    flexShrink: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  paddingTop: 112,
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
  editBanner:{
    position:'absolute',
    top:70,
    left:16,
    right:16,
    backgroundColor:'#FFF8E1',
    borderWidth:1,
    borderColor:'#F4C067',
    paddingVertical:8,
    paddingHorizontal:12,
    borderRadius:10,
    flexDirection:'row',
    alignItems:'center',
    zIndex:4100,
    gap:12,
  },
  editBannerError:{
    backgroundColor:'#FFE5E5',
    borderColor:'#FF9B9B',
  },
  editBannerTxt:{ flex:1, fontSize:13, fontWeight:'600', color:'#7A4E00' },
  editBannerTxtError:{ color:'#C0392B' },
  editBannerClose:{ paddingHorizontal:8, paddingVertical:4, backgroundColor:'#FFFFFF', borderRadius:6, borderWidth:1, borderColor:'#E0C89C' },
  editBannerCloseTxt:{ fontSize:12, fontWeight:'600', color:'#7A4E00' },
  
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

export default TextMode2Screen;
