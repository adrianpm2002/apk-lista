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
import FeedbackBanner from '../components/FeedbackBanner';
import NotificationsButton from '../components/NotificationsButton';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import { t, translatePlayTypeLabel } from '../utils/i18n';
import { applyPlayTypeSelection } from '../utils/playTypeCombinations';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';

const VisualModeScreen = ({ navigation, route, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  
  // Estados para los campos
  const [selectedLotteries, setSelectedLotteries] = useState([]); // values de loterías (máx 3)
  const [selectedSchedules, setSelectedSchedules] = useState({}); // { lotteryValue: scheduleValue }
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // { lotteryValue: [{label,value}] }
  const [selectedPlayTypes, setSelectedPlayTypes] = useState([]); // multi jugadas activas
  const [plays, setPlays] = useState('');
  const [amounts, setAmounts] = useState({ fijo:'', corrido:'', centena:'', posicion:'', parle:'', tripleta:'' });
  const [note, setNote] = useState('');
  const [total, setTotal] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [lotteryError, setLotteryError] = useState(false);
  const [lotteryErrorMessage, setLotteryErrorMessage] = useState('');
  const [scheduleError, setScheduleError] = useState(false); // true si falta algún horario
  const [playTypeError, setPlayTypeError] = useState(false);
  const [playsError, setPlaysError] = useState(false);
  const [amountError, setAmountError] = useState(false); // se usará si cualquier monto requerido falta
  const [showFieldErrors, setShowFieldErrors] = useState(false); // sólo mostrar bordes rojos tras intento
  const [limitViolations, setLimitViolations] = useState([]); // [{numero, jugada, permitido, usado}]

  // Feedback de inserción: éxito, fallos y duplicados
  const [insertFeedback, setInsertFeedback] = useState(null); // { success, fail, duplicates:[] }
  useEffect(() => {
    if (insertFeedback && insertFeedback.fail === 0) {
      const timer = setTimeout(() => setInsertFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [insertFeedback]);

  // Calcular total automáticamente basado en cantidad de números y monto
  useEffect(() => {
    const nums = plays.match(/\d+/g) || [];
    const numbersCount = nums.length;
    if (!numbersCount) { setTotal(0); return; }
    let perLottery = 0;
    selectedPlayTypes.forEach(pt => {
      const raw = amounts[pt] || '0';
      const amt = parseInt(raw.toString().replace(/[^0-9]/g,''),10) || 0;
      if (!amt) return; // si monto cero, ignorar jugada
      if (pt === 'parle' && isLocked) {
        perLottery += amt; // parle bloqueada: monto total directo
      } else {
        perLottery += amt * numbersCount;
      }
    });
    setTotal(perLottery * (selectedLotteries.length || 1));
  }, [plays, amounts, isLocked, selectedPlayTypes, selectedLotteries]);

  // Validación reactiva: cualquier jugada seleccionada con monto vacío o 0 marca error inmediato
  useEffect(() => {
    if (!selectedPlayTypes.length) { setAmountError(false); return; }
    const invalid = selectedPlayTypes.some(pt => {
      const raw = amounts[pt];
      const val = parseInt((raw||'').toString().replace(/[^0-9]/g,''),10) || 0;
      return !raw || val <= 0;
    });
    setAmountError(invalid);
  }, [amounts, selectedPlayTypes]);

  // Datos para los dropdowns
  const [lotteries, setLotteries] = useState([]); // desde BD
  const [bankId, setBankId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isInserting, setIsInserting] = useState(false);
  const [playTypes, setPlayTypes] = useState([]); // jugadas activas dinámicas
  // Edición
  const [editingId, setEditingId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingInitialNumbers, setEditingInitialNumbers] = useState('');
  const editBannerOpacity = useRef(new Animated.Value(0)).current;
  // Forzar remount del PlaysInputField para limpiar internamente
  const [inputInstanceKey, setInputInstanceKey] = useState(0);

  const PLAY_TYPE_LABELS = { fijo:translatePlayTypeLabel('fijo'), corrido:translatePlayTypeLabel('corrido'), posicion:translatePlayTypeLabel('posicion'), parle:translatePlayTypeLabel('parle'), centena:translatePlayTypeLabel('centena'), tripleta:translatePlayTypeLabel('tripleta') };

  // Función que faltaba y causaba que no aparecieran las jugadas (se usaba más abajo)
  const getPlayTypeLabel = (key) => PLAY_TYPE_LABELS[key] || key;

  const getLotteryLabel = (value) => lotteries.find(l=>l.value===value)?.label || value;
  const getScheduleLabel = (lotteryValue, scheduleValue) => (scheduleOptionsMap[lotteryValue]||[]).find(s=>s.value===scheduleValue)?.label || scheduleValue;

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

  // Cargar horarios de todas las loterías del banco, filtrar solo los que están abiertos actualmente y agrupar
  useEffect(()=>{
    if(!bankId || lotteries.length===0) return;
    let cancelled = false;
    const loadAllSchedules = async () => {
      try {
        const lotIds = lotteries.map(l=> l.value); // UUID strings
        const { data: rows } = await supabase
          .from('horario')
          .select('id,nombre,id_loteria,hora_inicio,hora_fin')
          .in('id_loteria', lotIds)
          .order('nombre');
        if(cancelled) return;
        const now = new Date();
        const nowMinutes = now.getHours()*60 + now.getMinutes();
        const isOpen = (hi, hf) => {
          if(!hi || !hf) return false;
          const [shi,smi] = hi.split(':');
          const [shf,smf] = hf.split(':');
            const start = parseInt(shi,10)*60 + parseInt(smi||'0',10);
            const end = parseInt(shf,10)*60 + parseInt(smf||'0',10);
            if(start === end) return true; // intervalo 24h
            if(end > start) return nowMinutes >= start && nowMinutes < end; // mismo día
            // cruza medianoche
            return (nowMinutes >= start) || (nowMinutes < end);
        };
        const grouped = {}; (rows||[])
          .filter(r => isOpen(r.hora_inicio, r.hora_fin))
          .forEach(r=> {
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
    setLimitViolations([]);
    };
    loadAllSchedules();
    return ()=> { cancelled = true; };
  },[bankId, lotteries]);

  // (playTypes ahora proviene dinámicamente de la BD: estado playTypes)

  // Efecto: escucha payload de edición enviado desde SavedPlaysScreen
  useEffect(()=>{
    const payload = route?.params?.editPayload;
    if(payload && payload.id !== editingId){
      setEditingId(payload.id);
      setIsEditing(true);
      setSelectedPlayTypes([payload.playType]);
      setEditingInitialNumbers(payload.numbers || '');
      setNote(payload.note || '');
      const lot = lotteries.find(l=> l.label === payload.lottery);
      if(lot){ setSelectedLotteries([lot.value]); }
      const scheduleSetter = () => {
        if(!lot) return;
        const schedules = scheduleOptionsMap[lot.value] || [];
        const sch = schedules.find(s=> s.label === payload.schedule);
        if(sch){ setSelectedSchedules(prev=> ({ ...prev, [lot.value]: sch.value })); }
      };
      scheduleSetter();
      setAmounts(a=> ({ ...a, [payload.playType]: String(payload.amount || payload.monto_unitario || '') }));
      navigation?.setParams?.({ editPayload: undefined });
    }
  },[route?.params?.editPayload, lotteries, scheduleOptionsMap]);

  // Una vez que tenemos tipos y aún no se cargaron los números, cargarlos
  useEffect(()=> {
    if(isEditing && editingInitialNumbers && !plays){
      setPlays(editingInitialNumbers);
    }
  }, [isEditing, editingInitialNumbers, selectedPlayTypes]);

  // Animación banner edición
  useEffect(()=> {
    if(isEditing){
      editBannerOpacity.setValue(0);
      Animated.timing(editBannerOpacity,{ toValue:1, duration:250, useNativeDriver:true }).start();
    }
  }, [isEditing]);

  const handleInsert = async () => {
    // Limpiar feedback previo
    setInsertFeedback(null);
    if(isEditing && editingId){
    const valid = validateCurrentForm();
    if(!valid) return; // resalta y aborta
      try {
        const primaryType = selectedPlayTypes[0];
        const raw = amounts[primaryType];
        const unit = parseInt((raw||'').toString().replace(/[^0-9]/g,''),10) || 0;
        const numsCount = (plays.match(/\d+/g)||[]).length;
        const totalCalc = primaryType==='parle' && isLocked ? unit : unit * numsCount;
        // Validación de límites para edición (similar a inserción)
        if(numsCount>0){
          const rawNumbers = (plays.match(/\d+/g)||[]).map(n=> n.padStart( primaryType==='centena'?3: primaryType==='tripleta'?6:2,'0'));
          // Contar repeticiones para multiplicar impacto real
          const counts = rawNumbers.reduce((acc,n)=> (acc[n]=(acc[n]||0)+1, acc), {});
          const uniqueNumbers = Object.keys(counts);
          const newLottery = selectedLotteries[0];
          const newHorario = selectedSchedules[newLottery];
          if(newHorario){
            const { data: { user } } = await supabase.auth.getUser();
            let specificLimits=null;
            if(user){
              const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', user.id).maybeSingle();
              specificLimits = profile?.limite_especifico || null;
            }
            const { data: limitRows } = await supabase.from('limite_numero').select('numero,limite,jugada,id_horario').eq('id_horario', newHorario);
            const limitMap=new Map(); (limitRows||[]).forEach(r=> limitMap.set(`${r.id_horario}|${r.jugada}|${r.numero}`, r.limite));
            const dayStart=new Date(); dayStart.setHours(0,0,0,0);
            const { data: usadas } = await supabase.from('jugada').select('id,id_horario,jugada,numeros,monto_unitario,created_at').gte('created_at', dayStart.toISOString()).eq('id_horario', newHorario);
            const usageMap=new Map();
            (usadas||[]).forEach(j=>{
              if(j.id===editingId) return; // excluir la jugada actual para recalcular con nuevos montos
              (j.numeros||'').split(',').filter(Boolean).forEach(n=>{
                const key=`${j.id_horario}|${j.jugada}|${n}`;
                usageMap.set(key,(usageMap.get(key)||0)+(j.monto_unitario||0));
              });
            });
            const violations=[];
            uniqueNumbers.forEach(n=>{
              const key=`${newHorario}|${primaryType}|${n}`;
              const perNumber=limitMap.get(key);
              const spec = specificLimits && specificLimits[primaryType];
              let effective = perNumber!=null && spec!=null ? Math.min(perNumber,spec) : (perNumber!=null ? perNumber : (spec!=null ? spec : null));
              if(!effective) return;
              const used = usageMap.get(key)||0;
              const totalAttempt = unit * counts[n];
              if(used + totalAttempt > effective){
                violations.push({ numero:n, jugada:primaryType, permitido:effective, usado:used, intento:totalAttempt });
              }
            });
            if(violations.length){
              setLimitViolations(violations);
              setInsertFeedback({ success:0, fail:1, duplicates:[], edit:true, blocked:true });
              return;
            }
          }
        }
        // Actualizar marca de tiempo (created_at) para reflejar edición
        const now = new Date();
        const pad = (n) => String(n).padStart(2,'0');
        const tsLocal = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        // Determinar nuevos id_horario y jugada si el usuario los cambió
        const newLottery = selectedLotteries[0];
        const newHorario = selectedSchedules[newLottery];
        const updatePayload = {
          numeros: plays.replace(/\s+/g,'').replace(/,+/g,','),
          nota: note?.trim() || 'Sin nombre',
          monto_unitario: unit,
          monto_total: totalCalc,
          created_at: tsLocal,
        };
        if(newHorario) updatePayload.id_horario = newHorario;
        if(primaryType) updatePayload.jugada = primaryType;
        const { error } = await supabase.from('jugada').update({
          ...updatePayload,
        }).eq('id', editingId);
        if(!error){
          // Mostrar feedback usando banner estándar (auto-cierre 3s)
          setInsertFeedback({ success:1, fail:0, duplicates:[], edit:true });
          // Limpiar estado completo
          handleClear(); // esto limpia plays y montos
          setPlays(''); // refuerzo explícito
          setInputInstanceKey(k=>k+1); // forzar remount
          setIsEditing(false);
          setEditingId(null);
          setEditingInitialNumbers('');
          // Feedback ya mostrado en banner insertFeedback
        }
      } catch(e){
  setInsertFeedback({ success:0, fail:1, duplicates:[], edit:true });
      }
      return;
    }
    if (isInserting) return; // prevenir doble toque
    // Resetear errores
    setLotteryError(false);
    setScheduleError(false);
    setPlayTypeError(false);
    setPlaysError(false);
  setAmountError(false);
  setShowFieldErrors(false);
    setLotteryErrorMessage('');

    // Validar campos requeridos
    let hasErrors = false;

    if (!selectedLotteries.length) {
      setLotteryError(true);
  setLotteryErrorMessage(t('errors.selectLottery'));
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

    // Validación de grupos incompletos basada en primer tipo seleccionado (o combo)
    if (!hasErrors) {
      const primary = selectedPlayTypes[0];
      let expectedLen = null;
      const comboCF = selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo');
      if (comboCF) expectedLen = 3; else {
        switch (primary) {
          case 'fijo':
          case 'corrido':
          case 'posicion': expectedLen = 2; break;
          case 'parle': expectedLen = 4; break;
          case 'centena': expectedLen = 3; break;
          case 'tripleta': expectedLen = 6; break;
          default: expectedLen = null;
        }
      }
      if (expectedLen) {
        const digits = plays.replace(/[^0-9]/g,'');
        const remainder = digits.length % expectedLen;
        const tokens = plays.split(/[\s,;]+/).filter(Boolean);
        const partialTokens = tokens.filter(t => {
          const d = t.replace(/[^0-9]/g,'');
          return d.length>0 && d.length< expectedLen;
        });
        if (remainder !== 0 || partialTokens.length) {
          setPlaysError(true);
          hasErrors = true;
        }
      }
    }

    // Validar montos por cada jugada seleccionada
    for (const pt of selectedPlayTypes) {
      const raw = amounts[pt];
      if (!raw || raw === '0') { setAmountError(true); hasErrors = true; break; }
    }

    // Validación específica: 'parle' ahora exige que cada bloque sea de 4 dígitos (cantidad libre)
    if (!hasErrors && selectedPlayTypes.includes('parle')) {
      const nums = plays.split(/[\s,;,]+/).map(n=>n.trim()).filter(Boolean);
      const invalid = nums.some(n => n.replace(/[^0-9]/g,'').length !== 4);
      if (invalid || nums.length===0) {
        setPlaysError(true);
        hasErrors = true;
      }
    }

    // Validación combo centena + fijo: tratar todo como centena (3 dígitos obligatorios)
    if (!hasErrors && selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo')) {
      const nums = plays.split(/[\s,;,]+/).map(n=>n.trim()).filter(Boolean);
      const invalid = nums.some(n => n.replace(/[^0-9]/g,'').length !== 3);
      if (invalid || nums.length===0) {
        setPlaysError(true);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      // Quitar errores después de 3 segundos
      setShowFieldErrors(true);
      setTimeout(() => {
        setLotteryError(false);
        setScheduleError(false);
        setPlayTypeError(false);
        setPlaysError(false);
        setAmountError(false);
        setLotteryErrorMessage('');
        setShowFieldErrors(false);
      }, 3000);
      return;
    }
    
    // Mantener orden EXACTO de entrada (el usuario ya no quiere orden ascendente)
    const numbersArrayRaw = plays
      .split(/[\s,;]+/)
      .map(n => n.trim())
      .filter(n => n.length > 0);
    const numbersFormatted = numbersArrayRaw.join(',');
    const hasCentenaFijoCombo = selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo');
    // Para el combo centena + fijo: en fijo se guardan los últimos 2 dígitos, en centena el número completo
    const numbersFormattedFijo = hasCentenaFijoCombo
      ? numbersArrayRaw.map(n => n.slice(-2)).join(',')
      : numbersFormatted;

  const numsCount = numbersFormatted ? numbersFormatted.split(',').filter(Boolean).length : 0;

    const payloads = [];
    selectedLotteries.forEach(lv => {
      const id_horario = selectedSchedules[lv];
      selectedPlayTypes.forEach(pt => {
        const raw = amounts[pt] || '0';
        let unit = parseInt(raw.toString().replace(/[^0-9]/g,'')) || 0;
        let rowTotal;
        if (pt === 'parle' && isLocked) {
          rowTotal = unit; // total igual al monto directo
          // Ajustar unitario dividiendo entre números
          if (numsCount>0) unit = Math.floor(rowTotal / numsCount) || 0;
        } else {
          rowTotal = unit * numsCount;
        }
        // Determinar números a insertar según regla especial centena+fijo
        const numerosForThisPlay = (pt === 'fijo' && hasCentenaFijoCombo) ? numbersFormattedFijo : numbersFormatted;
        payloads.push({
          id_listero: userId,
          id_horario,
          jugada: pt,
          numeros: numerosForThisPlay,
          nota: note?.trim() || 'Sin nombre',
          monto_unitario: unit,
          monto_total: rowTotal,
        });
      });
    });

    if (!payloads.length) return;

    try {
  // Verificación de capacidad usando util compartido
  const { data: { user } } = await supabase.auth.getUser();
  const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
  const ctx = await fetchLimitsContext(horarios, user?.id);
  // Adaptar payloads a formato de instrucciones temporales para reusar checkInstructionsLimits
  const tempInstructions = payloads.map(p=> ({ playType:p.jugada, numbers:p.numeros.split(',').filter(Boolean), amountEach:p.monto_unitario }));
  const violations = checkInstructionsLimits(tempInstructions, horarios, ctx);
      if(violations.length){
  setLimitViolations(violations);
  setInsertFeedback({ success:0, fail:payloads.length, duplicates:[], blocked:true });
        return; // aborta inserción
      }
      // 7. Insertar (sin violaciones)
      setIsInserting(true);
      const successes=[]; const failures=[];
      for(const p of payloads){
        const { data, error } = await supabase.from('jugada').insert(p).select('id').single();
        if(error){
          const msg = (error.message||'').toLowerCase();
          const isDuplicate = msg.includes('duplicad') || msg.includes('duplicate') || msg.includes('ya existe') || error.code==='23505';
          failures.push({ p, error, isDuplicate });
        } else successes.push(data.id);
      }
      if(failures.length===0){
        setPlays('');
        setAmounts({ fijo:'', corrido:'', centena:'', posicion:'', parle:'', tripleta:'' });
        setNote('');
        setTotal(0);
        setShowFieldErrors(false);
      }
      if(failures.length){
        const duplicateFails = failures.filter(f=>f.isDuplicate);
        setInsertFeedback({ success:successes.length, fail:failures.length, duplicates: duplicateFails.map(f=>({ jugada:f.p.jugada, numeros:f.p.numeros, nota:f.p.nota, horario:f.p.id_horario })) });
        // Feedback detallado ya en banner insertFeedback
      } else {
        setInsertFeedback({ success:successes.length, fail:0, duplicates:[] });
      }
    } catch(err){
      console.error('Error general insertando jugadas', err);
      setInsertFeedback({ success:0, fail:payloads.length||1, duplicates:[] });
    } finally { setIsInserting(false); }
  };

  const handleClear = () => {
  setSelectedLotteries([]);
  setSelectedSchedules({});
  setSelectedPlayTypes([]);
    setPlays('');
  setAmounts({ fijo:'', corrido:'', centena:'', posicion:'', parle:'', tripleta:'' });
    setNote('');
    setTotal(0);
  setShowFieldErrors(false);
  setEditingInitialNumbers('');
  setInputInstanceKey(k=>k+1); // remount del input para asegurar limpieza visual
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

  // Validación reutilizable para inserción y edición
  const validateCurrentForm = () => {
    let hasErrors = false;
    // Reset (sin limpiar showFieldErrors aún)
    setLotteryError(false); setScheduleError(false); setPlayTypeError(false);
    setPlaysError(false); setAmountError(false); setLotteryErrorMessage('');

    if(!selectedLotteries.length){ setLotteryError(true); setLotteryErrorMessage(t('errors.selectLottery')); hasErrors = true; }
    const missingSchedules = selectedLotteries.filter(lv => !selectedSchedules[lv]);
    if(missingSchedules.length){ setScheduleError(true); hasErrors = true; }
    if(!selectedPlayTypes.length){ setPlayTypeError(true); hasErrors = true; }
    if(!plays.trim()){ setPlaysError(true); hasErrors = true; }
    // Nota requerida también
    if(!note.trim()){ hasErrors = true; }
    if(selectedPlayTypes.some(pt => { const raw = amounts[pt]; const val = parseInt((raw||'').toString().replace(/[^0-9]/g,''),10)||0; return !raw || val<=0; })){ setAmountError(true); hasErrors = true; }
    if(!hasErrors){
      const primary = selectedPlayTypes[0];
      const comboCF = selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo');
      let expectedLen = null;
      if(comboCF) expectedLen = 3; else {
        switch(primary){
          case 'fijo': case 'corrido': case 'posicion': expectedLen=2; break;
          case 'parle': expectedLen=4; break;
          case 'centena': expectedLen=3; break;
          case 'tripleta': expectedLen=6; break;
        }
      }
      if(expectedLen){
        const digits = plays.replace(/[^0-9]/g,'');
        const remainder = digits.length % expectedLen;
        const tokens = plays.split(/[\s,;]+/).filter(Boolean);
        const partialTokens = tokens.filter(t => { const d=t.replace(/[^0-9]/g,''); return d.length>0 && d.length<expectedLen; });
        if(remainder!==0 || partialTokens.length){ setPlaysError(true); hasErrors = true; }
      }
      if(!hasErrors && selectedPlayTypes.includes('parle')){
        const nums = plays.split(/[\s,;,]+/).map(n=>n.trim()).filter(Boolean);
        if(nums.some(n=> n.replace(/[^0-9]/g,'').length!==4) || !nums.length){ setPlaysError(true); hasErrors = true; }
      }
      if(!hasErrors && selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo')){
        const nums = plays.split(/[\s,;,]+/).map(n=>n.trim()).filter(Boolean);
        if(nums.some(n=> n.replace(/[^0-9]/g,'').length!==3) || !nums.length){ setPlaysError(true); hasErrors = true; }
      }
    }
    if(hasErrors){ setShowFieldErrors(true); }
    return !hasErrors;
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

  // Re-formatear jugadas al cambiar selección de jugadas (adaptar longitud)
  useEffect(() => {
    const primary = selectedPlayTypes[0];
    if (!plays) return;
    let expectedLen = null;
    const comboCF = selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo');
    if (comboCF) expectedLen = 3; else {
      switch (primary) {
        case 'fijo':
        case 'corrido':
        case 'posicion': expectedLen = 2; break;
        case 'parle': expectedLen = 4; break;
        case 'centena': expectedLen = 3; break;
        case 'tripleta': expectedLen = 6; break;
        default: expectedLen = null;
      }
    }
    if (expectedLen) {
      const digits = plays.replace(/[^0-9]/g,'');
      if (!digits) { setPlays(''); return; }
      const groups = [];
      const full = Math.floor(digits.length/expectedLen)*expectedLen;
      for(let i=0;i<full;i+=expectedLen){ groups.push(digits.slice(i,i+expectedLen)); }
      const partial = digits.slice(full); // se mantiene si incompleto (mostrado en input)
      const out = partial ? (groups.length? groups.join(', ')+', '+partial: partial) : groups.join(',');
      if (out !== plays) setPlays(out);
    } else {
      // sin modo -> solo dígitos sin comas
      const raw = plays.replace(/[^0-9]/g,'');
      if (raw !== plays) setPlays(raw);
    }
  }, [selectedPlayTypes]);

  // Loterías que actualmente carecen de horario (para marcar error individual)
  const missingScheduleSet = new Set(scheduleError ? selectedLotteries.filter(lv => !selectedSchedules[lv]) : []);

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
        {limitViolations.length > 0 && (
          <FeedbackBanner
            type="blocked"
            message={t('edit.blocked')}
            details={limitViolations.slice(0,10).map(v=> `${v.numero} (${v.jugada}) ${(v.usado||0)}${v.intento?` +${v.intento}`:''}/${v.permitido}`)}
            onClose={()=> setLimitViolations([])}
            style={{ top:70 }}
          />
        )}
        {isEditing && (
          <FeedbackBanner
            type="edit"
            message={t('edit.modeHint')}
            details={editingInitialNumbers || undefined}
            onClose={()=> { handleClear(); setPlays(''); setIsEditing(false); setEditingId(null); setEditingInitialNumbers(''); }}
            style={{ top: limitViolations.length? 120:70 }}
          />
        )}
        {insertFeedback && (
          <FeedbackBanner
            type={insertFeedback.blocked ? 'blocked' : (insertFeedback.fail ? (insertFeedback.success ? 'warning':'error') : 'success')}
            message={insertFeedback.blocked ? t('edit.blocked') : insertFeedback.fail ? `${insertFeedback.success} guardada(s), ${insertFeedback.fail} fallida(s)` : `${insertFeedback.success} jugada(s) guardada(s)`}
            details={insertFeedback.blocked ? t('edit.blocked.detail') : insertFeedback.duplicates?.length ? insertFeedback.duplicates.slice(0,8).map(d=> `Dup: ${d.jugada} [${d.numeros}]`) : undefined}
            onClose={()=> setInsertFeedback(null)}
            style={{ top: (limitViolations.length? 120:70) + (isEditing? 50:0) }}
          />
        )}
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Row 1: Lotería & Jugada */}
        <View style={styles.rowTwoCols}> 
          <View style={styles.colHalf}>
            <MultiSelectDropdown
              label={t('common.lottery')}
              selectedValues={selectedLotteries}
              onSelect={handleSelectLotteries}
              options={lotteries}
              placeholder={t('placeholders.selectLotteries')}
              isDarkMode={isDarkMode}
              hasError={lotteryError}
              errorMessage={lotteryErrorMessage}
            />
          </View>
          <View style={styles.colHalf}>
            <MultiSelectDropdown
              label={t('common.playType')}
              selectedValues={selectedPlayTypes}
              onSelect={(vals)=> setSelectedPlayTypes(applyPlayTypeSelection(selectedPlayTypes, vals, playTypes))}
              options={playTypes}
              placeholder={t('placeholders.selectPlayTypes')}
              isDarkMode={isDarkMode}
              hasError={playTypeError}
              errorMessage={playTypeError ? t('errors.selectAtLeastOnePlayType') : ''}
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
                    label={`${t('common.schedule')} ${getLotteryLabel(lv)}`}
                    value={selectedSchedules[lv] && getScheduleLabel(lv, selectedSchedules[lv])}
                    onSelect={(item) => setSelectedSchedules(prev => ({ ...prev, [lv]: item.value || item }))}
                    options={scheduleOptionsMap[lv] || []}
                    placeholder={scheduleOptionsMap[lv]? t('placeholders.selectSchedule'):t('placeholders.noSchedules')}
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
          key={inputInstanceKey}
          label={t('common.numbers')}
          value={plays}
          onChangeText={setPlays}
          placeholder="Números"
          playType={selectedPlayTypes[0] || null}
          selectedPlayTypes={selectedPlayTypes}
          multiline={true}
          isDarkMode={isDarkMode}
          showPasteButton={true}
          pasteButtonOverlay={true}
          hasError={playsError}
        />

        {/* Row 4: Nota, Monto y Total */}
        <View style={styles.multiAmountSection}>
            <View style={styles.noteContainer}>
            <InputField
              label={t('common.note')}
              value={note}
              onChangeText={setNote}
              placeholder="Nombre"
              style={styles.fieldContainer}
              inputStyle={[styles.unifiedInput, (showFieldErrors && !note.trim()) && styles.errorBorder]}
            />
          </View>
            <View style={styles.amountsContainer}>
            {selectedPlayTypes.map(pt => {
              const raw = amounts[pt];
              const invalid = (showFieldErrors && (!raw || raw === '0'));
              return (
                <MoneyInputField
                  key={pt}
                  label={`Monto ${getPlayTypeLabel(pt)}`}
                  value={raw}
                  onChangeText={(val)=> setAmounts(a=>({...a,[pt]:val}))}
                  placeholder="$0"
                  style={styles.fieldContainer}
                  inputStyle={[styles.unifiedInput, invalid && styles.errorBorder]}
                  hasError={invalid}
                />
              );
            })}
          </View>
            <View style={styles.generalTotalContainer}>
            <MoneyInputField
              label={'Monto General'}
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
        </View>

        {/* Row 6: Botones de acción */}
        <View style={styles.actionRow}>
          <View style={styles.actionButton}>
            <ActionButton
              title={t('actions.clear')}
              onPress={handleClear}
              variant="danger"
              size="medium"
            />
          </View>
          <View style={styles.actionButton}>
            <ActionButton
              title={isInserting ? 'Insertando...' : t('actions.insert')}
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
  headerFloating: {
    position: 'absolute',
    top: 0,
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
  },
  modeSelectorWrapper: {
    marginLeft: 14,
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
  multiAmountSection: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  noteContainer: {
    width: 120, // ancho pequeño solicitado para Nota
  },
  amountsContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  generalTotalContainer: {
    width: 120, // ancho pequeño solicitado para Monto General
  },
  errorBorder:{
    borderColor:'#E74C3C',
    borderWidth:2,
    backgroundColor:'#FDEDEC'
  },
});

export default VisualModeScreen;
