import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Animated,
  Alert,
  Clipboard,
} from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import InputField from '../components/InputField';
import TextInputWithErrorHighlight from '../components/TextInputWithErrorHighlight';
// PlaysInputField removido para modo texto avanzado (acepta letras/comandos)
import MoneyInputField from '../components/MoneyInputField';
import ActionButton from '../components/ActionButton';
import HammerButton from '../components/HammerButton';
import CleanerButton from '../components/CleanerButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
// InfoButton general sustituido por versión específica de modo texto
import TextModeInfoButton from '../components/TextModeInfoButton';
// Eliminamos CapacityModal directo; usaremos BatteryButton que lo incluye internamente
import BatteryButton from '../components/BatteryButton';
// import CapacityModal from '../components/CapacityModal';
import { playToTextCommand } from '../utils/playToTextCommand';
import { parseTextMode } from '../utils/textModeParser';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { generateTextModeCopyFromInstructions, generateTextModeCopyFromOriginalCommand } from '../utils/copyUtils';
import FeedbackBanner from '../components/FeedbackBanner';
import { t } from '../utils/i18n';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { supabase } from '../supabaseClient';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';
import { validateScheduleById } from '../utils/scheduleValidator';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false); // si falta algún horario
  const [playsError, setPlaysError] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const [limitViolations, setLimitViolations] = useState([]); // [{numero, jugada, permitido, usado}]
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [showInsertButton, setShowInsertButton] = useState(false); // Controla visibilidad del botón insertar
  // Capacidades ahora manejadas por BatteryButton (se eliminan estados locales duplicados)

  // Lógica de capacidad eliminada (delegada a BatteryButton)

  // Datos dinámicos
  const [lotteries, setLotteries] = useState([]); // {label,value}
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // {lotteryId:[{label,value}]}
  // Cargar payload de edición si llega (desde SavedPlays) y estamos en modo texto
  useEffect(()=>{
    const payload = route?.params?.editPayload;
    
    // ⚠️ CRÍTICO: Esperar a que las loterías estén cargadas Y los horarios para esa lotería específica
    if(payload && payload.id !== editingId && lotteries.length > 0){
      const hasSchedulesForLottery = scheduleOptionsMap[payload.lotteryId] && scheduleOptionsMap[payload.lotteryId].length > 0;
      
      if(hasSchedulesForLottery) {
        setEditingId(payload.id);
        setIsEditing(true);
        
        // Buscar lotería por ID en lugar de label
        const lot = lotteries.find(l=> l.value === payload.lotteryId);
        
        if(lot){ 
          setSelectedLotteries([lot.value]); 
          
          // Buscar horario por ID en lugar de label
          const schs = scheduleOptionsMap[lot.value] || [];
          const sch = schs.find(s=> s.value === payload.scheduleId);
          
          if(sch){ 
            setSelectedSchedules(prev=> ({ ...prev, [lot.value]: sch.value })); 
          }
        }
        
        // Convertir la jugada a comando de texto
        const textCommand = playToTextCommand(payload);
        setPlays(textCommand);
        setNote(payload.note || '');
        navigation?.setParams?.({ editPayload: undefined });
      }
    }
  },[route?.params?.editPayload, lotteries, scheduleOptionsMap]);
  const [bankId, setBankId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Para el nombre de usuario al copiar
  const loadingRef = useRef(false);
  // Feedback de inserción
  const [insertFeedback, setInsertFeedback] = useState(null); // {success, fail, duplicates:[]}
  const [verifyFeedback, setVerifyFeedback] = useState(null); // { type:'success'|'error', message:string }
  const [duplicateLines, setDuplicateLines] = useState([]); // Array de líneas con duplicados
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
        const { data: profile } = await supabase.from('profiles').select('role,id_banco,username').eq('id', user.id).maybeSingle();
        if(!profile) return;
        setUserProfile(profile); // Guardar el perfil completo para tener acceso al username
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
          // Formatear las horas para mostrarlas en el label
          const horaInicio = r.hora_inicio ? r.hora_inicio.substring(0, 5) : '';
          const horaFin = r.hora_fin ? r.hora_fin.substring(0, 5) : '';
          const labelConHoras = horaInicio && horaFin ? `${r.nombre} (${horaInicio} - ${horaFin})` : r.nombre;
          grouped[r.id_loteria].push({ label:labelConHoras, value:r.id });
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
    const { instructions, errors, perLotterySum } = parseTextMode(plays, { isLocked });
    setParsedInstructions(instructions);
    setTotal(perLotterySum * (selectedLotteries.length||1));
    setParseErrors(errors);
    setPlaysError(errors.length>0);
    
    // Calcular números duplicados específicos automáticamente
    const duplicateNumbersSet = new Set();
    instructions.forEach(inst=>{
      inst.duplicates.forEach(d=>{ 
        duplicateNumbersSet.add(d); // Agregar número duplicado específico
      });
    });
    setDuplicateLines(Array.from(duplicateNumbersSet)); // Reutilizar el state pero con números en lugar de líneas
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

  const handleCopy = async () => {
    try {
      // Validar que hay datos para copiar
      if (selectedLotteries.length === 0) {
        Alert.alert('Error', 'Selecciona al menos una lotería para copiar.');
        return;
      }
      
      if (!plays.trim()) {
        Alert.alert('Error', 'Ingresa al menos una jugada para copiar.');
        return;
      }
      
      // Para modo texto, copiamos el comando original del input
      const selectedLottery = selectedLotteries[0];
      const selectedSchedule = selectedSchedules[selectedLottery];
      
      // Generar texto para copiar usando el comando original
      const copyText = await generateTextModeCopyFromOriginalCommand(
        plays.trim(), // Usar el texto original del input
        selectedLottery,
        selectedSchedule,
        userProfile,
        note,
        parsedInstructions // Pasar las instrucciones para calcular el total
      );
      
      // Copiar al portapapeles
      await Clipboard.setString(copyText);
      
      // Mostrar confirmación
      Alert.alert('Éxito', 'Las jugadas se han copiado al portapapeles.');
      
    } catch (error) {
      console.error('Error al copiar:', error);
      Alert.alert('Error', 'No se pudieron copiar las jugadas.');
    }
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
    // Quitamos la validación de nota obligatoria
    if(hasErrors) setShowFieldErrors(true);
    return !hasErrors;
  };

  const handleVerify = async () => {
    setVerifyFeedback(null);
    setShowInsertButton(false); // Ocultar botón al iniciar verificación
    // Reusar validación base sin requerir nota
    const valid = validateForm(false);
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
      // Validaciones de límites sin insertar (similar a handleInsert pero lectura solamente)
      const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
      let violations=[];
      if(horarios.length){
        const { data: { user } } = await supabase.auth.getUser();
        let specificLimits=null;
        if(user){
          const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', user.id).maybeSingle();
          specificLimits = profile?.limite_especifico || null;
        }
        const { data: limitRows } = await supabase.from('limite_numero').select('numero, limite, jugada, id_horario').in('id_horario', horarios);
        const limitMap=new Map();
        (limitRows||[]).forEach(r=> limitMap.set(r.id_horario+"|"+r.jugada+"|"+r.numero, r.limite));
        const dayStart=new Date(); dayStart.setHours(0,0,0,0);
        const { data: jugadasDia } = await supabase.from('jugada').select('id_horario,jugada,numeros,monto_unitario,created_at').gte('created_at', dayStart.toISOString()).in('id_horario', horarios);
        const usageMap=new Map();
        (jugadasDia||[]).forEach(j=>{
          (j.numeros||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(n=>{
            const k=j.id_horario+"|"+j.jugada+"|"+n;
            usageMap.set(k,(usageMap.get(k)||0)+(j.monto_unitario||0));
          });
        });
        parsedInstructions.forEach(instr=>{
          instr.numbers.forEach(num=>{
            horarios.forEach(h=>{
              const key=h+"|"+instr.playType+"|"+num;
              const limit = limitMap.get(key);
              const spec = specificLimits && specificLimits[instr.playType];
              let effective = limit != null && spec != null ? Math.min(limit,spec) : (limit != null ? limit : (spec != null ? spec : null));
              if(!effective) return;
              const used = usageMap.get(key)||0;
              const amt = instr.amountEach||0;
              if(used + amt > effective){
                violations.push({ numero:num, jugada:instr.playType, permitido:effective, usado:used, intento:amt });
              }
            });
          });
        });
      }
      if(violations.length){
        setLimitViolations(violations);
        setShowInsertButton(false); // Ocultar botón si hay violaciones
        // Mostrar detalles igual que en insertFeedback
        const violationDetails = violations.slice(0,3).map(v=> {
          const usado = v.usado || 0;
          const intento = v.intento || 0;
          const total = usado + intento;
          const exceso = total - v.permitido;
          return `${v.numero} (${v.jugada}): excede ${exceso}`;
        }).join(', ');
        setVerifyFeedback({ type:'error', message:`${t('verify.limitViolations')}: ${violationDetails}${violations.length > 3 ? '...' : ''}` });
        return;
      }
      // Resumen agregado sin listar números
      const summaryCounts = parsedInstructions.reduce((acc,i)=>{ acc[i.playType]=(acc[i.playType]||0)+i.numbers.length; return acc; },{});
      const parts = Object.keys(summaryCounts).map(pt=> `${pt}:${summaryCounts[pt]}`).join(' | ');
      // Info duplicados con números específicos
      const dupDetails = (()=>{
        const linesMap = {};
        const duplicateNumbersSet = new Set();
        parsedInstructions.forEach(inst=>{
          inst.duplicates.forEach(d=>{ 
            if(!linesMap[d]) linesMap[d]=new Set(); 
            linesMap[d].add(inst.line);
            duplicateNumbersSet.add(d); // Agregar número duplicado específico
          });
        });
        
        // Actualizar estado de números duplicados
        setDuplicateLines(Array.from(duplicateNumbersSet));
        
        const dupCount = Object.keys(linesMap).length;
        if(!dupCount) return '';
        const first = Object.entries(linesMap).slice(0,3).map(([n,set])=> `${n}(L${Array.from(set).join('/')})`).join(', ');
        return ` | Duplicados: ${dupCount}${dupCount>3? ' ('+first+'...)':' ('+first+')'}`;
      })();
  setVerifyFeedback({ type:'success', message:`${t('verify.summaryPrefix')}: ${parts}. Total: ${total}${dupDetails}` });
      setShowInsertButton(true); // Mostrar botón de insertar cuando verificación sea exitosa
    } catch(err){
      setShowInsertButton(false); // Ocultar botón si hay error
      setDuplicateLines([]); // Limpiar duplicados cuando hay error
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
              prevNums.forEach(n => {
                const key = newHorario+"|"+currentPlay.jugada+"|"+n;
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
        const updatePayload={ numeros: instr.numbers.join(','), nota: note.trim() || null, monto_unitario: instr.amountEach, monto_total: instr.totalPerLottery, jugada: instr.playType, created_at: tsLocal, comando: plays.trim() };
        if(newHorario) updatePayload.id_horario = newHorario;
        const { error } = await supabase.from('jugada').update(updatePayload).eq('id', editingId);
        if(error) throw error;
        setInsertFeedback({ success:1, fail:0, duplicates:[], edit:true });
        setIsEditing(false); setEditingId(null);
        setPlays(''); setParsedInstructions([]); setTotal(0);
        // Mantener la nota después del envío exitoso
      } catch(e){
        setInsertFeedback({ success:0, fail:1, edit:true });
      }
      return;
    }

    // Validar campos requeridos sin incluir nota
  let hasErrors = !validateForm(false);

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
            if(instr.playType==='parle' && isLocked){
              // totalPerLottery es el total original; amountEach fue dividido anteriormente en parser (floor)
              // Mantener total original para que usePlaySubmission pueda registrarlo y validar límites con unit correcto
              total = instr.totalPerLottery; // ya el original
              unit = instr.amountEach; // ya dividido
            }
            playsToSave.push({
              lottery,
              schedule: selectedSchedules[lottery],
              playType: instr.playType,
              numbers: instr.numbers.join(','),
              note: note.trim() || null,
              amount: unit,
              total,
              comando: plays.trim() // Agregar el texto original del input con saltos de línea
            });
          }
        }
        let success=0; let fail=0; let blockedViolations=[];
        for(const playData of playsToSave){
          const result = await submitPlayWithConfirmation(playData);
          if(result.success) success++; else { fail++; if(result.limitViolations) blockedViolations = blockedViolations.concat(result.limitViolations); }
        }
        if(blockedViolations.length){
          setLimitViolations(blockedViolations.map(v=> ({ numero:v.number, jugada:v.limitType || v.jugada || '', permitido:v.limit, usado:v.current })));
        }
  setInsertFeedback({ success, fail, duplicates:[], edit:false });
        if(success){
          setPlays(''); setCalculatedAmount(0); setTotal(0); setParsedInstructions([]);
          // Mantener la nota después del envío exitoso
        }
      } catch (error) {
        console.error('Error al guardar las jugadas:', error);
        alert('Error al guardar las jugadas. Inténtalo de nuevo.');
      }
  };

  const handleTopBarOption = (option) => {
    // Manejar opciones del sidebar si es necesario
  };

  const toggleSidebar = () => {
    setSidebarVisible(!sidebarVisible);
  };

  const closeSidebar = () => {
    setSidebarVisible(false);
  };

  const toggleLock = () => { /* Candado no visible aquí */ };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={[styles.headerFloating, { pointerEvents: 'box-none' }]}>
        <View style={[styles.inlineHeaderRow, { pointerEvents: 'box-none' }]}>
          <SideBarToggle inline onToggle={toggleSidebar} />
          <View style={styles.modeSelectorWrapper}>
            <ModeSelector 
              currentMode={currentMode}
              onModeChange={onModeChange}
              isDarkMode={isDarkMode}
              visibleModes={visibleModes || { visual: true, text: true }}
            />
              <SideBar 
                isVisible={sidebarVisible}
                onClose={()=> setSidebarVisible(false)}
                onOptionSelect={()=>{}}
                isDarkMode={isDarkMode}
                onToggleDarkMode={onToggleDarkMode}
                navigation={navigation}
                onModeVisibilityChange={onModeVisibilityChange}
                visibleModes={visibleModes}
                role="listero"
              />
          </View>
          <View style={[styles.rightButtonsGroup, { pointerEvents: 'box-none' }]}>
            <PricingInfoButton />
            {/* OCULTO PARA BUILD - NotificationsButton */}
            {/* <NotificationsButton /> */}
          </View>
        </View>
  {/* Eliminado InfoButton general flotante en favor de botón en barra inferior */}
      </View>
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Row 1: Lotería */}
        <MultiSelectDropdown
          label={t('common.lottery')}
          selectedValues={selectedLotteries}
          onSelect={(vals)=>{
            // Limitar a 3 como en modo visual
            let next = vals.length>3 ? vals.slice(0,3) : vals;
            
            // Obtener loterías nuevas seleccionadas
            const newlyAdded = next.filter(lotteryId => !selectedLotteries.includes(lotteryId));
            
            // Para cada lotería nueva, seleccionar automáticamente el primer horario disponible
            newlyAdded.forEach(lotteryId => {
              const availableSchedules = scheduleOptionsMap[lotteryId] || [];
              if (availableSchedules.length > 0) {
                setSelectedSchedules(prev => ({
                  ...prev,
                  [lotteryId]: availableSchedules[0].value
                }));
              }
            });
            
            // Limpiar horarios de loterías deseleccionadas
            setSelectedSchedules(prev => {
              const updated = { ...prev };
              Object.keys(updated).forEach(k => { 
                if (!next.includes(k)) delete updated[k]; 
              });
              return updated;
            });
            
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
        <TextInputWithErrorHighlight
          label={t('common.numbers')}
          value={plays}
          onChangeText={(txt)=> { 
            setPlays(txt); 
            setShowInsertButton(false); // Ocultar botón cuando se cambia el texto
            setDuplicateLines([]); // Limpiar duplicados cuando se cambia el texto
            if(showFieldErrors){ /* no quitar bordes aún */ }
          }}
          placeholder="Números / comandos"
          errorLines={parseErrors.map(e => e.line)} // Extraer números de línea con errores
          duplicateNumbers={duplicateLines} // Números duplicados específicos en amarillo
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
            {/* Mostrar monto por lotería si hay 2 o más loterías seleccionadas */}
            {selectedLotteries.length >= 2 && (
              <MoneyInputField
                label={'Monto por Lotería'}
                value={Math.round(total / (selectedLotteries.length || 1)).toString()}
                editable={false}
                placeholder="$0"
                style={styles.fieldContainer}
                inputStyle={styles.unifiedInput}
              />
            )}
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
          <Pressable onPress={()=> setIsLocked(l=> !l)} style={[styles.lockButton, isLocked && styles.lockButtonActive]}>
            <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
          </Pressable>
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
          <HammerButton numbersSeparator={'. '} onOptionSelect={(opt) => {
            if(opt?.action==='insert' && opt.numbers){
              setPlays(prev => prev ? prev + (prev.endsWith('\n')?'':'\n') + opt.numbers : opt.numbers);
            }
          }} />
          <ListButton currentMode={currentMode} onOptionSelect={(option) => console.log('List option:', option)} />
          <TextModeInfoButton icon="ℹ︎" />
          <CleanerButton onInsert={(formatted)=>{
            setPlays(prev => {
              if(!prev.trim()) return formatted; // vacío => reemplaza
              return prev + (prev.endsWith('\n') ? '' : '\n') + formatted; // agrega con salto
            });
          }} />
          
          {/* Botón de Copiar */}
          <Pressable
            style={({ pressed }) => [
              styles.copyButton,
              pressed && styles.copyButtonPressed
            ]}
            onPress={handleCopy}
          >
            <Text style={styles.copyText}>Copiar</Text>
          </Pressable>
        </View>

        {/* Row 5: Botones de acción */}
        <View style={[styles.actionRow,{ justifyContent:'center' }]}>
          <View style={styles.actionButton}><ActionButton title={t('actions.clear')} onPress={handleClear} variant="danger" size="small" /></View>
          <View style={styles.actionButton}><ActionButton title={t('actions.verify')} onPress={handleVerify} variant="warning" size="small" /></View>
          {showInsertButton && (
            <View style={styles.actionButton}><ActionButton title={t('actions.insert')} onPress={handleInsert} variant="success" size="small" /></View>
          )}
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
          details={limitViolations.length ? limitViolations.slice(0,10).map(v=> {
            const usado = v.usado || 0;
            const intento = v.intento || 0;
            const total = usado + intento;
            const exceso = total - v.permitido;
            return `${v.numero} (${v.jugada}): excede ${exceso}`;
          }) : undefined}
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
  flexWrap: 'wrap',
  },
  modeSelectorWrapper: {
  marginLeft: 6,
  flexShrink: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 160,
    paddingBottom: 40, // Espacio adicional para scroll completo
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
  copyButton: {
    backgroundColor: '#E6F3FF',
    borderWidth: 1,
    borderColor: '#87CEEB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#87CEEB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  copyButtonPressed: {
    backgroundColor: '#D0E8FF',
    borderColor: '#5A9FDA',
    transform: [{ scale: 0.95 }],
  },
  copyIcon: {
    fontSize: 18,
  },
  copyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B5F8A',
  },
});

export default TextModeScreen;
