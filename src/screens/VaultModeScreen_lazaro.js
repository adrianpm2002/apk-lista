import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import AnimatedModalWrapper from '../components/AnimatedModalWrapper';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import MoneyInputField from '../components/MoneyInputField';
import ActionButton from '../components/ActionButton';
import ListButton from '../components/ListButton';
import PricingInfoButton from '../components/PricingInfoButton';
import NotificationsButton from '../components/NotificationsButton';
import BatteryButton from '../components/BatteryButton';
import ModeSelector from '../components/ModeSelector';
import { SideBar, SideBarToggle } from '../components/SideBar';
import FeedbackBanner from '../components/FeedbackBanner';
import { t } from '../utils/i18n';
import { supabase } from '../supabaseClient';
import { usePlaySubmission } from '../hooks/usePlaySubmission';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';

const padLen = (n, len) => String(n || '').replace(/[^0-9]/g, '').padStart(len, '0');

const VaultModeScreen = ({ navigation, route, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [lotteries, setLotteries] = useState([]); // {label,value}
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({}); // {lotteryId:[{label,value}]}
  const [selectedLotteries, setSelectedLotteries] = useState([]);
  const [selectedSchedules, setSelectedSchedules] = useState({});
  const [note, setNote] = useState('');

  // Columnas
  const [fcNumber, setFcNumber] = useState('');
  const [fijoAmount, setFijoAmount] = useState('');
  const [corridoAmount, setCorridoAmount] = useState('');
  // Lista unificada por número: cada item puede tener monto fijo y/o corrido
  const [fcEntries, setFcEntries] = useState([]); // [{ num, fijo?:number, corrido?:number }]

  const [parleNumber, setParleNumber] = useState('');
  const [parleAmount, setParleAmount] = useState('');
  const [parleEntries, setParleEntries] = useState([]); // [{num4, amount}]

  const [centenaNumber, setCentenaNumber] = useState('');
  const [centenaAmount, setCentenaAmount] = useState('');
  const [centenaEntries, setCentenaEntries] = useState([]); // [{num3, amount}]

  const [verifyFeedback, setVerifyFeedback] = useState(null);
  const [insertFeedback, setInsertFeedback] = useState(null);
  const [limitViolations, setLimitViolations] = useState([]);
  const [duplicateConflicts, setDuplicateConflicts] = useState([]);
  const [total, setTotal] = useState(0);

  // Edición inline de montos F/C
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { idx, field: 'fijo' | 'corrido' }
  const [editAmount, setEditAmount] = useState('');
  const [editNumModalVisible, setEditNumModalVisible] = useState(false);
  const [editNumIdx, setEditNumIdx] = useState(null);
  const [editNumber, setEditNumber] = useState('');

  // Parle edit
  const [editParleAmtVisible, setEditParleAmtVisible] = useState(false);
  const [editParleIdx, setEditParleIdx] = useState(null);
  const [editParleAmount, setEditParleAmount] = useState('');
  const [editParleNumVisible, setEditParleNumVisible] = useState(false);
  const [editParleNumber, setEditParleNumber] = useState('');
  // Centena edit
  const [editCentenaAmtVisible, setEditCentenaAmtVisible] = useState(false);
  const [editCentenaIdx, setEditCentenaIdx] = useState(null);
  const [editCentenaAmount, setEditCentenaAmount] = useState('');
  const [editCentenaNumVisible, setEditCentenaNumVisible] = useState(false);
  const [editCentenaNumber, setEditCentenaNumber] = useState('');

  const { submitPlayWithConfirmation } = usePlaySubmission();

  // context
  const [bankId, setBankId] = useState(null);
  useEffect(()=>{
    const loadContext = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;
        const { data: profile } = await supabase.from('profiles').select('role,id_banco').eq('id', user.id).maybeSingle();
        if(!profile) return;
        const bId = profile.role === 'admin' ? user.id : profile.id_banco;
        setBankId(bId);
      } catch(e){ /* ignore */ }
    };
    loadContext();
  },[]);

  useEffect(()=>{
    if(!bankId) return;
    let cancelled=false;
    const loadLots = async () => {
      try{
        const { data: lots } = await supabase.from('loteria').select('id,nombre').eq('id_banco', bankId).order('nombre');
        if(cancelled) return;
        setLotteries((lots||[]).map(l=> ({ label:l.nombre, value:l.id })));
      } catch(e){ /* ignore */ }
    };
    loadLots();
    return ()=>{ cancelled=true; };
  },[bankId]);

  useEffect(()=>{
    if(!bankId || lotteries.length===0) { setScheduleOptionsMap({}); return; }
    let cancelled=false;
    const loadAllSchedules = async () => {
      try {
        const lotIds = lotteries.map(l=> l.value);
        const { data: rows } = await supabase
          .from('horario').select('id,nombre,id_loteria,hora_inicio,hora_fin').in('id_loteria', lotIds).order('nombre');
        if(cancelled) return;
        const now = new Date();
        const nowMin = now.getHours()*60 + now.getMinutes();
        const isOpen = (hi,hf)=>{
          if(!hi||!hf) return false;
          const [shi,smi]=hi.split(':'), [shf,smf]=hf.split(':');
          const start = parseInt(shi,10)*60 + parseInt(smi||'0',10);
          const end = parseInt(shf,10)*60 + parseInt(smf||'0',10);
          if(start===end) return true; if(end>start) return nowMin>=start && nowMin<end; return nowMin>=start || nowMin<end;
        };
        const grouped={};
        (rows||[]).filter(r=> isOpen(r.hora_inicio,r.hora_fin)).forEach(r=>{
          if(!grouped[r.id_loteria]) grouped[r.id_loteria]=[];
          grouped[r.id_loteria].push({ label:r.nombre, value:r.id });
        });
        setScheduleOptionsMap(grouped);
        setSelectedSchedules(prev=>{ const next={...prev}; Object.keys(next).forEach(k=>{ if(!grouped[k] || !grouped[k].some(o=> o.value===next[k])) delete next[k]; }); return next; });
      } catch(e){ /* ignore */ }
    };
    loadAllSchedules();
    return ()=>{ cancelled=true; };
  },[bankId, lotteries]);

  // agregar entradas
  const addFc = () => {
    const d2 = padLen(fcNumber,2);
    const fAmt = parseInt(fijoAmount||'0',10) || 0;
    const cAmt = parseInt(corridoAmount||'0',10) || 0;
    if(!/\d{2}/.test(d2) || (fAmt<=0 && cAmt<=0)) return;
    setFcEntries(prev => {
      const idx = prev.findIndex(e => e.num === d2);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...(fAmt>0?{fijo:fAmt}:{fijo:copy[idx].fijo}), ...(cAmt>0?{corrido:cAmt}:{corrido:copy[idx].corrido}) };
        return copy;
      }
      return [...prev, { num:d2, ...(fAmt>0?{fijo:fAmt}:{}) , ...(cAmt>0?{corrido:cAmt}:{}) }];
    });
    setFcNumber('');
  };
  const removeFcAt = (idx) => setFcEntries(prev=> prev.filter((_,i)=> i!==idx));

  const addParle = () => {
    const d4 = padLen(parleNumber,4);
    const amt = parseInt(parleAmount||'0',10) || 0;
    if(!/\d{4}/.test(d4) || amt<=0) return;
    setParleEntries(prev=> [...prev, { num:d4, amount:amt }]);
    setParleNumber('');
  };

  const openEdit = (idx, field) => {
    const e = fcEntries[idx];
    const current = field === 'fijo' ? (e?.fijo || '') : (e?.corrido || '');
    setEditTarget({ idx, field });
    setEditAmount(String(current));
    setEditModalVisible(true);
  };
  const saveEdit = () => {
    if(!editTarget) return;
    const amt = parseInt(editAmount||'0',10) || 0;
    setFcEntries(prev => {
      const copy = [...prev];
      const e = copy[editTarget.idx];
      if(!e) return prev;
      if(amt > 0) {
        copy[editTarget.idx] = { ...e, [editTarget.field]: amt };
      } else {
        const { [editTarget.field]:_, ...rest } = e;
        const next = { ...rest };
        if(!(next.fijo>0) && !(next.corrido>0)) {
          copy.splice(editTarget.idx,1);
        } else {
          copy[editTarget.idx] = next;
        }
      }
      return copy;
    });
    setEditModalVisible(false);
    setEditTarget(null);
    setEditAmount('');
  };
  const clearField = (idx, field) => {
    setFcEntries(prev => {
      const copy=[...prev];
      const e = copy[idx];
      if(!e) return prev;
      const { [field]:_, ...rest } = e;
      const next = { ...rest };
      if(!(next.fijo>0) && !(next.corrido>0)) copy.splice(idx,1);
      else copy[idx] = next;
      return copy;
    })
  };

  const openEditNum = (idx) => {
    const e = fcEntries[idx];
    if(!e) return;
    setEditNumIdx(idx);
    setEditNumber(String(e.num||''));
    setEditNumModalVisible(true);
  };
  const saveEditNum = () => {
    const d2 = padLen(editNumber,2);
    if(!/\d{2}/.test(d2) || editNumIdx==null) { setEditNumModalVisible(false); return; }
    setFcEntries(prev => {
      const srcIdx = editNumIdx;
      if(!prev[srcIdx]) return prev;
      const src = prev[srcIdx];
      if(src.num === d2) return prev; // sin cambios
      const tgtIdx = prev.findIndex(e=> e.num === d2);
      const copy = [...prev];
      if(tgtIdx >= 0) {
        // fusionar montos
        const tgt = copy[tgtIdx];
        const merged = { num: d2, fijo: (tgt.fijo||0) + (src.fijo||0), corrido: (tgt.corrido||0) + (src.corrido||0) };
        copy[tgtIdx] = merged;
        // eliminar fuente (cuidado con índices)
        const removeIdx = srcIdx === tgtIdx ? -1 : srcIdx;
        if(removeIdx >= 0) copy.splice(removeIdx,1);
        return copy;
      }
      // mover número
      copy[srcIdx] = { ...src, num: d2 };
      return copy;
    });
    setEditNumModalVisible(false);
    setEditNumIdx(null);
    setEditNumber('');
  };
  const addCentena = () => {
    const d3 = padLen(centenaNumber,3);
    const amt = parseInt(centenaAmount||'0',10) || 0;
    if(!/\d{3}/.test(d3) || amt<=0) return;
    setCentenaEntries(prev=> [...prev, { num:d3, amount:amt }]);
    setCentenaNumber('');
  };

  // Parle handlers
  const openEditParleAmt = (idx) => {
    const e = parleEntries[idx]; if(!e) return;
    setEditParleIdx(idx); setEditParleAmount(String(e.amount||'')); setEditParleAmtVisible(true);
  };
  const saveEditParleAmt = () => {
    if(editParleIdx==null) { setEditParleAmtVisible(false); return; }
    const amt = parseInt(editParleAmount||'0',10) || 0;
    setParleEntries(prev=>{
      const copy=[...prev]; const e = copy[editParleIdx]; if(!e) return prev;
      if(amt>0) copy[editParleIdx] = { ...e, amount: amt };
      else copy.splice(editParleIdx,1);
      return copy;
    });
    setEditParleAmtVisible(false); setEditParleIdx(null); setEditParleAmount('');
  };
  const clearParle = (idx) => {
    setParleEntries(prev=> prev.filter((_,i)=> i!==idx));
  };
  const openEditParleNum = (idx) => {
    const e = parleEntries[idx]; if(!e) return;
    setEditParleIdx(idx); setEditParleNumber(String(e.num||'')); setEditParleNumVisible(true);
  };
  const saveEditParleNum = () => {
    const d4 = padLen(editParleNumber,4);
    if(!/\d{4}/.test(d4) || editParleIdx==null) { setEditParleNumVisible(false); return; }
    setParleEntries(prev=>{
      const srcIdx = editParleIdx; const src = prev[srcIdx]; if(!src) return prev; if(src.num===d4) return prev;
      const copy = [...prev]; const tgtIdx = copy.findIndex(e=> e.num===d4);
      if(tgtIdx>=0){ copy[tgtIdx] = { num:d4, amount: (copy[tgtIdx].amount||0) + (src.amount||0) }; if(tgtIdx!==srcIdx) copy.splice(srcIdx,1); return copy; }
      copy[srcIdx] = { ...src, num:d4 }; return copy;
    });
    setEditParleNumVisible(false); setEditParleIdx(null); setEditParleNumber('');
  };

  // Centena handlers
  const openEditCentenaAmt = (idx) => {
    const e = centenaEntries[idx]; if(!e) return;
    setEditCentenaIdx(idx); setEditCentenaAmount(String(e.amount||'')); setEditCentenaAmtVisible(true);
  };
  const saveEditCentenaAmt = () => {
    if(editCentenaIdx==null) { setEditCentenaAmtVisible(false); return; }
    const amt = parseInt(editCentenaAmount||'0',10) || 0;
    setCentenaEntries(prev=>{
      const copy=[...prev]; const e = copy[editCentenaIdx]; if(!e) return prev;
      if(amt>0) copy[editCentenaIdx] = { ...e, amount: amt };
      else copy.splice(editCentenaIdx,1);
      return copy;
    });
    setEditCentenaAmtVisible(false); setEditCentenaIdx(null); setEditCentenaAmount('');
  };
  const clearCentena = (idx) => {
    setCentenaEntries(prev=> prev.filter((_,i)=> i!==idx));
  };
  const openEditCentenaNum = (idx) => {
    const e = centenaEntries[idx]; if(!e) return;
    setEditCentenaIdx(idx); setEditCentenaNumber(String(e.num||'')); setEditCentenaNumVisible(true);
  };
  const saveEditCentenaNum = () => {
    const d3 = padLen(editCentenaNumber,3);
    if(!/\d{3}/.test(d3) || editCentenaIdx==null) { setEditCentenaNumVisible(false); return; }
    setCentenaEntries(prev=>{
      const srcIdx = editCentenaIdx; const src = prev[srcIdx]; if(!src) return prev; if(src.num===d3) return prev;
      const copy=[...prev]; const tgtIdx = copy.findIndex(e=> e.num===d3);
      if(tgtIdx>=0){ copy[tgtIdx] = { num:d3, amount:(copy[tgtIdx].amount||0)+(src.amount||0) }; if(tgtIdx!==srcIdx) copy.splice(srcIdx,1); return copy; }
      copy[srcIdx] = { ...src, num:d3 }; return copy;
    });
    setEditCentenaNumVisible(false); setEditCentenaIdx(null); setEditCentenaNumber('');
  };

  // construir instrucciones (agrupadas por monto)
  const buildInstructions = () => {
    const out=[];
    // Derivar entradas de fijo y corrido desde la lista unificada
    const fijoEntries = fcEntries.filter(e=> (e.fijo||0) > 0).map(e=> ({ num:e.num, amount:e.fijo }));
    const corridoEntries = fcEntries.filter(e=> (e.corrido||0) > 0).map(e=> ({ num:e.num, amount:e.corrido }));
    const byAmt = (entries) => entries.reduce((m,e)=>{ const k=String(e.amount); if(!m[k]) m[k]=[]; m[k].push(e.num); return m; },{});
    const fijoMap = byAmt(fijoEntries); Object.keys(fijoMap).forEach(k=> out.push({ playType:'fijo', numbers:fijoMap[k], amountEach:parseInt(k,10), totalPerLottery: parseInt(k,10)*fijoMap[k].length }));
    const corrMap = byAmt(corridoEntries); Object.keys(corrMap).forEach(k=> out.push({ playType:'corrido', numbers:corrMap[k], amountEach:parseInt(k,10), totalPerLottery: parseInt(k,10)*corrMap[k].length }));
    const parleMap = byAmt(parleEntries); Object.keys(parleMap).forEach(k=> out.push({ playType:'parle', numbers:parleMap[k], amountEach:parseInt(k,10), totalPerLottery: parseInt(k,10)*parleMap[k].length }));
    const centMap = byAmt(centenaEntries); Object.keys(centMap).forEach(k=> out.push({ playType:'centena', numbers:centMap[k], amountEach:parseInt(k,10), totalPerLottery: parseInt(k,10)*centMap[k].length }));
    return out;
  };

  // Duplicados: normalización y búsqueda
  const canonicalParle = (num4) => {
    const s = String(num4||'').replace(/[^0-9]/g,'').padStart(4,'0');
    const a = s.slice(0,2); const b = s.slice(2,4);
    return a <= b ? a + b : b + a;
  };
  const normalizeNumbers = (playType, arr) => {
    const clean = (arr||[]).map(n=> String(n));
    if(playType==='parle') return clean.map(canonicalParle).sort();
    return clean.sort();
  };
  const buildCandidateKeys = (instr, schedules) => {
    const keys = new Set();
    const dupWithin=[];
    const noteKey = String((note||'').trim().toLowerCase());
    for(const schedule of schedules){
      for(const i of instr){
        const nums = normalizeNumbers(i.playType, i.numbers).join(',');
        const key = `${schedule}|${i.playType}|${nums}|${noteKey}`;
        if(keys.has(key)) dupWithin.push({ schedule, jugada:i.playType, numeros: nums });
        keys.add(key);
      }
    }
    return { keys, dupWithin };
  };
  const findDuplicateConflicts = async (instr, schedules, userId) => {
    if(!schedules.length || !userId) return [];
    try {
      const { data: rows } = await supabase
        .from('jugada')
        .select('id,id_horario,jugada,numeros,id_listero,nota')
        .in('id_horario', schedules)
        .eq('id_listero', userId);
      const existing = new Set();
      (rows||[]).forEach(r=>{
        const nums = normalizeNumbers(r.jugada, String(r.numeros||'').split(',')).join(',');
        const noteKey = String((r.nota||'').trim().toLowerCase());
        existing.add(`${r.id_horario}|${r.jugada}|${nums}|${noteKey}`);
      });
      const { keys, dupWithin } = buildCandidateKeys(instr, schedules);
      const conflicts = [];
      keys.forEach(k=>{ if(existing.has(k)) { const [schedule,jugada,numeros] = k.split('|'); conflicts.push({ schedule, jugada, numeros }); } });
      return dupWithin.concat(conflicts);
    } catch(e){ return [{ error: e?.message||'dup-check' }]; }
  };

  // total
  useEffect(()=>{
    const perLot = buildInstructions().reduce((s,i)=> s + (i.totalPerLottery||0), 0);
    setTotal(perLot * (selectedLotteries.length||1));
  }, [fcEntries, parleEntries, centenaEntries, selectedLotteries]);

  const validateForm = () => {
    const anyEntry = fcEntries.length + parleEntries.length + centenaEntries.length > 0;
    return selectedLotteries.length>0 && selectedLotteries.every(l=> selectedSchedules[l]) && anyEntry && note.trim();
  };

  const handleVerify = async () => {
    setVerifyFeedback(null); setInsertFeedback(null); setLimitViolations([]); setDuplicateConflicts([]);
    if(!validateForm()) { setVerifyFeedback({ type:'error', message:t('errors.requiredOrFix') }); return; }
    try {
      const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
      const { data: { user } } = await supabase.auth.getUser();
      const ctx = await fetchLimitsContext(horarios, user?.id);
      const instr = buildInstructions();
      const violations = checkInstructionsLimits(instr, horarios, ctx);
      if(violations.length){
        setLimitViolations(violations);
        const first = violations.slice(0,3).map(v=> `${v.numero}(${v.jugada})`).join(', ');
        setVerifyFeedback({ type:'error', message:`${t('verify.limitViolations')}: ${violations.length}${violations.length? ' - '+first+(violations.length>3?'...':''):''}` });
        return;
      }
      const dups = await findDuplicateConflicts(instr, horarios, user?.id);
      if(dups && dups.length){
        setDuplicateConflicts(dups);
        const first = dups.slice(0,3).map(d=> `${d.numeros}(${d.jugada})`).join(', ');
        setVerifyFeedback({ type:'error', message:`Duplicadas: ${dups.length}${dups.length? ' - '+first+(dups.length>3?'...':''):''}` });
        return;
      }
      const summaryCounts = instr.reduce((acc,i)=>{ acc[i.playType]=(acc[i.playType]||0)+i.numbers.length; return acc; },{});
      const parts = Object.keys(summaryCounts).map(pt=> `${pt}:${summaryCounts[pt]}`).join(' | ');
      setVerifyFeedback({ type:'success', message:`${t('verify.summaryPrefix')}: ${parts}. Total: ${total}` });
    } catch(e){ setVerifyFeedback({ type:'error', message:t('errors.verify') }); }
  };

  const handleInsert = async () => {
    setInsertFeedback(null); setVerifyFeedback(null); setLimitViolations([]); setDuplicateConflicts([]);
    if(!validateForm()) { setInsertFeedback({ success:0, fail:1, blocked:false, serverError:t('errors.requiredOrFix') }); return; }
    const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ctx = await fetchLimitsContext(horarios, user?.id);
      const instr = buildInstructions();
      const violations = checkInstructionsLimits(instr, horarios, ctx);
      if(violations.length){ setLimitViolations(violations); setInsertFeedback({ success:0, fail:1, blocked:true }); return; }
      const dups = await findDuplicateConflicts(instr, horarios, user?.id);
      if(dups && dups.length){ setDuplicateConflicts(dups); setInsertFeedback({ success:0, fail:1, blocked:true, serverError:'Duplicadas' }); return; }
      // Build and submit
      const playsToSave = [];
      for(const lottery of selectedLotteries){
        const schedule = selectedSchedules[lottery];
        for(const i of instr){
          const nums = normalizeNumbers(i.playType, i.numbers).join(',');
          playsToSave.push({ lottery, schedule, playType:i.playType, numbers: nums, note: note.trim(), amount: i.amountEach, total: i.totalPerLottery });
        }
      }
      let success=0, fail=0; let errMsgs=[]; let blockedViolations=[];
      for(const p of playsToSave){
        const r = await submitPlayWithConfirmation(p);
        if(r.success) success++; else { fail++; if(r.limitViolations) blockedViolations = blockedViolations.concat(r.limitViolations); if(r.message) errMsgs.push(r.message); }
      }
      if(blockedViolations.length){ setLimitViolations(blockedViolations); }
      setInsertFeedback({ success, fail, blocked:false, serverError: errMsgs.join(' | ') });
      if(success){
        setFcEntries([]); setParleEntries([]); setCentenaEntries([]);
        setFcNumber(''); setFijoAmount(''); setCorridoAmount(''); setParleNumber(''); setParleAmount(''); setCentenaNumber(''); setCentenaAmount(''); setNote(''); setTotal(0);
      }
    } catch(e){ setInsertFeedback({ success:0, fail:1, blocked:false, serverError: e?.message || 'Error' }); }
  };

  const renderColumn = (title, children) => (
    <View style={[styles.col, isDarkMode && styles.colDark]}>
      <Text style={[styles.colTitle, isDarkMode && styles.colTitleDark]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
  <View style={styles.headerFloating} pointerEvents="box-none">
        <View style={styles.inlineHeaderRow} pointerEvents="box-none">
          <SideBarToggle inline onToggle={()=> setSidebarVisible(s=>!s)} />
          <View style={styles.modeSelectorWrapper}>
    <ModeSelector currentMode={currentMode||'Vault'} onModeChange={onModeChange} isDarkMode={isDarkMode} visibleModes={visibleModes} />
          </View>
          <View style={styles.rightButtonsGroup} pointerEvents="box-none">
            <PricingInfoButton />
            <NotificationsButton />
          </View>
        </View>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Loterías y horarios */}
        <MultiSelectDropdown
          label={t('common.lottery')}
          selectedValues={selectedLotteries}
          onSelect={(vals)=>{ let next = vals.length>3 ? vals.slice(0,3) : vals; setSelectedLotteries(next); }}
          options={lotteries}
          placeholder={t('placeholders.selectLotteries')}
          isDarkMode={isDarkMode}
        />
        {selectedLotteries.length>0 && (
          <View style={styles.dynamicSchedulesRow}>
            {selectedLotteries.map(lv => {
              const count = selectedLotteries.length;
              const widthPct = count===1 ? '100%' : count===2 ? '48%' : '31.5%';
              const currentVal = selectedSchedules[lv] ? (scheduleOptionsMap[lv]||[]).find(s=> s.value===selectedSchedules[lv])?.label : '';
              return (
                <View key={lv} style={[styles.schedulePickerDynamic,{ width: widthPct }]}> 
                  <DropdownPicker
                    label={`${t('common.schedule')}`}
                    value={currentVal}
                    onSelect={(item) => setSelectedSchedules(prev => ({ ...prev, [lv]: item.value || item }))}
                    options={scheduleOptionsMap[lv] || []}
                    placeholder={(scheduleOptionsMap[lv]||[]).length ? t('placeholders.selectSchedule') : t('placeholders.noSchedules')}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Tres columnas */}
        <View style={styles.columnsRow}>
          {/* Col 1: Fijos/Corridos */}
          {renderColumn('Fijos / Corridos', (
            <>
              <View style={styles.inputRow}> 
                <MoneyInputField
                  label="Fijo"
                  value={String(fijoAmount)}
                  onChangeText={setFijoAmount}
                  placeholder="$0"
                  style={{ flex:1, marginBottom:8 }}
                  inputStyle={{ minHeight:44, paddingVertical:10 }}
                />
                <MoneyInputField
                  label="Corrido"
                  value={String(corridoAmount)}
                  onChangeText={setCorridoAmount}
                  placeholder="$0"
                  style={{ flex:1, marginBottom:8 }}
                  inputStyle={{ minHeight:44, paddingVertical:10 }}
                />
              </View>
              <InputField
                label="Número"
                value={fcNumber}
                onChangeText={(txt)=> setFcNumber(txt.replace(/[^0-9]/g,'').slice(0,2))}
                placeholder="00"
                keyboardType="number-pad"
                maxLength={2}
              />
              <View style={styles.inlineActions}>
                <ActionButton title={'Adicionar'} onPress={addFc} variant="primary" size="small" />
              </View>
              {fcEntries.length>0 && (
                <View style={styles.listBox}>
                  {fcEntries.map((e,i)=>{
                    const fTxt = (e.fijo||0) > 0 ? `$${Number(e.fijo).toLocaleString('en-US')}` : '-';
                    const cTxt = (e.corrido||0) > 0 ? `$${Number(e.corrido).toLocaleString('en-US')}` : '-';
                    return (
                      <View key={`fc-${i}`} style={styles.listItem}>
                        <Pressable onPress={()=> openEditNum(i)} hitSlop={6}>
                          <Text style={styles.listNum}>{e.num}</Text>
                        </Pressable>
                        <View style={styles.fcTagRow}>
                          <Pressable onPress={()=> openEdit(i,'fijo')} onLongPress={()=> clearField(i,'fijo')} hitSlop={6}>
                            <Text style={[styles.fcTag, styles.fTag, (e.fijo>0)&&styles.fcTagActive]}>F: {fTxt}</Text>
                          </Pressable>
                          <Pressable onPress={()=> openEdit(i,'corrido')} onLongPress={()=> clearField(i,'corrido')} hitSlop={6}>
                            <Text style={[styles.fcTag, styles.cTag, (e.corrido>0)&&styles.fcTagActive]}>C: {cTxt}</Text>
                          </Pressable>
                        </View>
                        <Pressable onPress={()=> removeFcAt(i)}><Text style={styles.remove}>✕</Text></Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          ))}

          {/* Col 2: Parles */}
          {renderColumn('Parles', (
            <>
              <MoneyInputField label="Monto" value={String(parleAmount)} onChangeText={setParleAmount} placeholder="$0" />
              <InputField
                label="Número"
                value={parleNumber}
                onChangeText={(txt)=> setParleNumber(txt.replace(/[^0-9]/g,'').slice(0,4))}
                placeholder="0000"
                keyboardType="number-pad"
                maxLength={4}
              />
              <View style={styles.inlineActions}>
                <ActionButton title={'Adicionar'} onPress={addParle} variant="primary" size="small" />
              </View>
              {parleEntries.length>0 && (
                <View style={styles.listBox}>
                  {parleEntries.map((e,i)=> (
                    <View key={`p-${i}`} style={styles.listItem}>
                      <Pressable onPress={()=> openEditParleNum(i)} hitSlop={6}><Text style={styles.listNum}>{e.num}</Text></Pressable>
                      <Pressable onPress={()=> openEditParleAmt(i)} onLongPress={()=> clearParle(i)} hitSlop={6}>
                        <Text style={[styles.fcTag, styles.fcTagActive]}>${Number(e.amount||0).toLocaleString('en-US')}</Text>
                      </Pressable>
                      <Pressable onPress={()=> clearParle(i)}><Text style={styles.remove}>✕</Text></Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          ))}

          {/* Col 3: Centenas */}
          {renderColumn('Centenas', (
            <>
              <MoneyInputField label="Monto" value={String(centenaAmount)} onChangeText={setCentenaAmount} placeholder="$0" />
              <InputField
                label="Número"
                value={centenaNumber}
                onChangeText={(txt)=> setCentenaNumber(txt.replace(/[^0-9]/g,'').slice(0,3))}
                placeholder="000"
                keyboardType="number-pad"
                maxLength={3}
              />
              <View style={styles.inlineActions}>
                <ActionButton title={'Adicionar'} onPress={addCentena} variant="primary" size="small" />
              </View>
              {centenaEntries.length>0 && (
                <View style={styles.listBox}>
                  {centenaEntries.map((e,i)=> (
                    <View key={`m-${i}`} style={styles.listItem}>
                      <Pressable onPress={()=> openEditCentenaNum(i)} hitSlop={6}><Text style={styles.listNum}>{e.num}</Text></Pressable>
                      <Pressable onPress={()=> openEditCentenaAmt(i)} onLongPress={()=> clearCentena(i)} hitSlop={6}>
                        <Text style={[styles.fcTag, styles.fcTagActive]}>${Number(e.amount||0).toLocaleString('en-US')}</Text>
                      </Pressable>
                      <Pressable onPress={()=> clearCentena(i)}><Text style={styles.remove}>✕</Text></Pressable>
                    </View>
                  ))}
                </View>
              )}
            </>
          ))}
        </View>

        {/* Accesos: batería y registro (sin edición en este modo) */}
        <View style={[styles.toolsContainer,{ justifyContent:'center', flexWrap:'wrap', gap:12 }]}> 
          <BatteryButton
            selectedLotteries={selectedLotteries}
            selectedSchedules={selectedSchedules}
            selectedPlayTypes={[]}
            lotteryOptions={lotteries}
            scheduleOptionsMap={scheduleOptionsMap}
            getScheduleLabel={(lv,sv)=> (scheduleOptionsMap[lv]||[]).find(s=> s.value===sv)?.label || ''}
            playTypeLabels={{ fijo:'fijo', corrido:'corrido', centena:'centena', parle:'parle', tripleta:'tripleta' }}
            bankId={bankId}
            animationProps={{ scaleFrom:0.9, duration:180 }}
          />
          <ListButton currentMode={currentMode||'Vault'} />
        </View>

        {/* Nota y Total */}
        <View style={styles.row}> 
          <View style={styles.halfWidth}>
            <InputField label={t('common.note')} value={note} onChangeText={setNote} placeholder="Nombre" />
          </View>
          <View style={styles.halfWidth}>
            <MoneyInputField label={t('common.total')} value={String(total)} editable={false} />
          </View>
        </View>

        {/* Acciones */}
          <View style={[styles.actionRow,{ justifyContent:'center' }]}>
          <View style={styles.actionButton}><ActionButton title={t('actions.clear')} onPress={()=>{ setFcEntries([]); setParleEntries([]); setCentenaEntries([]); setFcNumber(''); setFijoAmount(''); setCorridoAmount(''); setParleNumber(''); setParleAmount(''); setCentenaNumber(''); setCentenaAmount(''); setNote(''); setTotal(0); }} variant="danger" size="small" /></View>
          <View style={styles.actionButton}><ActionButton title={t('actions.verify')} onPress={handleVerify} variant="warning" size="small" /></View>
          <View style={styles.actionButton}><ActionButton title={t('actions.insert')} onPress={handleInsert} variant="success" size="small" /></View>
        </View>
      </ScrollView>

      {editModalVisible && (
        <AnimatedModalWrapper visible={editModalVisible} style={styles.editOverlay}>
          <View style={[styles.editCard, isDarkMode && styles.editCardDark]}>
            <Text style={[styles.editTitle, isDarkMode && styles.colTitleDark]}>
              {`Editar ${editTarget?.field==='fijo'?'Fijo':'Corrido'} - ${fcEntries[editTarget?.idx]?.num || ''}`}
            </Text>
            <MoneyInputField
              label="Monto"
              value={String(editAmount)}
              onChangeText={setEditAmount}
              placeholder="$0"
              isDarkMode={isDarkMode}
              style={{ marginBottom:8 }}
              inputStyle={{ minHeight:44, paddingVertical:10 }}
            />
            <View style={{ flexDirection:'row', gap:8 }}>
              <View style={{ flex:1 }}><ActionButton title="Cancelar" onPress={()=>{ setEditModalVisible(false); setEditTarget(null); setEditAmount(''); }} variant="danger" size="small" /></View>
              <View style={{ flex:1 }}><ActionButton title="Guardar" onPress={saveEdit} variant="success" size="small" /></View>
            </View>
            <Text style={[styles.editHint, isDarkMode && styles.colTitleDark]}>Sostén el monto en la lista para borrar solo F o C</Text>
          </View>
        </AnimatedModalWrapper>
      )}

      {editNumModalVisible && (
        <AnimatedModalWrapper visible={editNumModalVisible} style={styles.editOverlay}>
          <View style={[styles.editCard, isDarkMode && styles.editCardDark]}>
            <Text style={[styles.editTitle, isDarkMode && styles.colTitleDark]}>Editar Número</Text>
            <InputField
              label="Número"
              value={String(editNumber)}
              onChangeText={(txt)=> setEditNumber(txt.replace(/[^0-9]/g,'').slice(0,2))}
              placeholder="00"
              keyboardType="number-pad"
              maxLength={2}
              inputStyle={{ minHeight:44, paddingVertical:10 }}
            />
            <View style={{ flexDirection:'row', gap:8 }}>
              <View style={{ flex:1 }}><ActionButton title="Cancelar" onPress={()=>{ setEditNumModalVisible(false); setEditNumIdx(null); setEditNumber(''); }} variant="danger" size="small" /></View>
              <View style={{ flex:1 }}><ActionButton title="Guardar" onPress={saveEditNum} variant="success" size="small" /></View>
            </View>
          </View>
        </AnimatedModalWrapper>
      )}

      {/* Parle amount modal */}
      {editParleAmtVisible && (
        <AnimatedModalWrapper visible={editParleAmtVisible} style={styles.editOverlay}>
          <View style={[styles.editCard, isDarkMode && styles.editCardDark]}>
            <Text style={[styles.editTitle, isDarkMode && styles.colTitleDark]}>Editar Parle - Monto</Text>
            <MoneyInputField label="Monto" value={String(editParleAmount)} onChangeText={setEditParleAmount} placeholder="$0" isDarkMode={isDarkMode} style={{ marginBottom:8 }} inputStyle={{ minHeight:44, paddingVertical:10 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <View style={{ flex:1 }}><ActionButton title="Cancelar" onPress={()=>{ setEditParleAmtVisible(false); setEditParleIdx(null); setEditParleAmount(''); }} variant="danger" size="small" /></View>
              <View style={{ flex:1 }}><ActionButton title="Guardar" onPress={saveEditParleAmt} variant="success" size="small" /></View>
            </View>
          </View>
        </AnimatedModalWrapper>
      )}

      {/* Parle number modal */}
      {editParleNumVisible && (
        <AnimatedModalWrapper visible={editParleNumVisible} style={styles.editOverlay}>
          <View style={[styles.editCard, isDarkMode && styles.editCardDark]}>
            <Text style={[styles.editTitle, isDarkMode && styles.colTitleDark]}>Editar Parle - Número</Text>
            <InputField label="Número" value={String(editParleNumber)} onChangeText={(txt)=> setEditParleNumber(txt.replace(/[^0-9]/g,'').slice(0,4))} placeholder="0000" keyboardType="number-pad" maxLength={4} inputStyle={{ minHeight:44, paddingVertical:10 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <View style={{ flex:1 }}><ActionButton title="Cancelar" onPress={()=>{ setEditParleNumVisible(false); setEditParleIdx(null); setEditParleNumber(''); }} variant="danger" size="small" /></View>
              <View style={{ flex:1 }}><ActionButton title="Guardar" onPress={saveEditParleNum} variant="success" size="small" /></View>
            </View>
          </View>
        </AnimatedModalWrapper>
      )}

      {/* Centena amount modal */}
      {editCentenaAmtVisible && (
        <AnimatedModalWrapper visible={editCentenaAmtVisible} style={styles.editOverlay}>
          <View style={[styles.editCard, isDarkMode && styles.editCardDark]}>
            <Text style={[styles.editTitle, isDarkMode && styles.colTitleDark]}>Editar Centena - Monto</Text>
            <MoneyInputField label="Monto" value={String(editCentenaAmount)} onChangeText={setEditCentenaAmount} placeholder="$0" isDarkMode={isDarkMode} style={{ marginBottom:8 }} inputStyle={{ minHeight:44, paddingVertical:10 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <View style={{ flex:1 }}><ActionButton title="Cancelar" onPress={()=>{ setEditCentenaAmtVisible(false); setEditCentenaIdx(null); setEditCentenaAmount(''); }} variant="danger" size="small" /></View>
              <View style={{ flex:1 }}><ActionButton title="Guardar" onPress={saveEditCentenaAmt} variant="success" size="small" /></View>
            </View>
          </View>
        </AnimatedModalWrapper>
      )}

      {/* Centena number modal */}
      {editCentenaNumVisible && (
        <AnimatedModalWrapper visible={editCentenaNumVisible} style={styles.editOverlay}>
          <View style={[styles.editCard, isDarkMode && styles.editCardDark]}>
            <Text style={[styles.editTitle, isDarkMode && styles.colTitleDark]}>Editar Centena - Número</Text>
            <InputField label="Número" value={String(editCentenaNumber)} onChangeText={(txt)=> setEditCentenaNumber(txt.replace(/[^0-9]/g,'').slice(0,3))} placeholder="000" keyboardType="number-pad" maxLength={3} inputStyle={{ minHeight:44, paddingVertical:10 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <View style={{ flex:1 }}><ActionButton title="Cancelar" onPress={()=>{ setEditCentenaNumVisible(false); setEditCentenaIdx(null); setEditCentenaNumber(''); }} variant="danger" size="small" /></View>
              <View style={{ flex:1 }}><ActionButton title="Guardar" onPress={saveEditCentenaNum} variant="success" size="small" /></View>
            </View>
          </View>
        </AnimatedModalWrapper>
      )}

      {verifyFeedback && (
        <FeedbackBanner 
          type={verifyFeedback.type==='success' ? 'success' : 'error'}
          message={verifyFeedback.message}
          onClose={()=> setVerifyFeedback(null)}
          style={{ top:70 }}
        />
      )}
      {insertFeedback && (
        <FeedbackBanner
          type={insertFeedback.blocked ? 'blocked' : (insertFeedback.fail ? (insertFeedback.success ? 'warning' : 'error') : 'success')}
          message={insertFeedback.blocked ? `${t('edit.blocked')}: ${t('edit.blocked.detail')}` : `${t('banner.inserted')}: ${insertFeedback.success}  ${t('banner.fail')}: ${insertFeedback.fail}`}
          details={(limitViolations.length ? limitViolations.slice(0,10).map(v=> `${v.numero} (${v.jugada}) usado ${v.usado||0}${v.intento?` +${v.intento}`:''}/${v.permitido}`) : [])
            .concat(duplicateConflicts.length ? duplicateConflicts.slice(0,10).map(d=> `Dup: ${d.numeros} (${d.jugada})`) : [])
            .concat(insertFeedback.serverError ? [`Servidor: ${insertFeedback.serverError}`] : [])}
          onClose={()=> setInsertFeedback(null)}
          style={{ top: verifyFeedback ? 120 : 70 }}
        />
      )}

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
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#f0f8ff' },
  containerDark:{ backgroundColor:'#2c3e50' },
  headerFloating:{ position:'absolute', top:0, left:0, right:0, flexDirection:'row', flexWrap:'wrap', justifyContent:'flex-start', alignItems:'flex-start', zIndex:3000, paddingTop:10, paddingBottom:10, paddingHorizontal:12, backgroundColor:'rgba(255,255,255,0.96)', borderBottomWidth:1, borderBottomColor:'#E2E6EA', shadowColor:'#000', shadowOffset:{ width:0, height:2 }, shadowOpacity:0.12, shadowRadius:4, elevation:4 },
  inlineHeaderRow:{ flexDirection:'row', alignItems:'center', gap:6, flex:1, paddingTop:0, minHeight:44 },
  rightButtonsGroup:{ flexDirection:'row', alignItems:'center', gap:6, marginLeft:'auto', flexWrap:'wrap' },
  modeSelectorWrapper:{ marginLeft:6, flexShrink:1 },
  content:{ flex:1, paddingHorizontal:16, paddingVertical:12, paddingTop:112 },
  dynamicSchedulesRow:{ flexDirection:'row', flexWrap:'wrap', alignItems:'flex-start', gap:8, marginBottom:8 },
  schedulePickerDynamic:{},
  columnsRow:{ flexDirection:'row', gap:8, marginTop:6 },
  col:{ flex:1, backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#E1E8E3', borderRadius:8, padding:8 },
  colDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  colTitle:{ fontSize:14, fontWeight:'700', color:'#2D5016', marginBottom:6 },
  colTitleDark:{ color:'#ECF0F1' },
  inputRow:{ flexDirection:'row', gap:8 },
  inlineActions:{ marginTop:6, alignItems:'flex-start' },
  listBox:{ marginTop:8, gap:4 },
  listItem:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', backgroundColor:'#F8F9FA', borderWidth:1, borderColor:'#E8F1E4', borderRadius:6, paddingHorizontal:8, paddingVertical:6, gap:8 },
  listNum:{ fontSize:13, fontWeight:'800', color:'#2D5016', minWidth:38 },
  fcTagRow:{ flex:1, flexDirection:'row', gap:6, alignItems:'center', flexWrap:'wrap' },
  fcTag:{ fontSize:11, fontWeight:'700', color:'#2D5016', paddingHorizontal:6, paddingVertical:2, borderRadius:4, borderWidth:1, borderColor:'#E1E8E3', backgroundColor:'#F8F9FA', flexShrink:1 },
  fcTagActive:{ backgroundColor:'#EEF7EA', borderColor:'#CDE3C8' },
  fTag:{},
  cTag:{},
  remove:{ fontSize:14, fontWeight:'800', color:'#C0392B' },
  toolsContainer:{ flexDirection:'row', justifyContent:'center', alignItems:'center', marginVertical:6, gap:10 },
  row:{ flexDirection:'row', justifyContent:'space-between', marginBottom:6, gap:8 },
  halfWidth:{ flex:1 },
  actionRow:{ flexDirection:'row', justifyContent:'space-between', marginTop:10, gap:6 },
  actionButton:{ flex:1 },
  // modal estilos
  editOverlay:{ position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.2)', zIndex:4000, padding:16 },
  editCard:{ width:'92%', maxWidth:380, backgroundColor:'#FFFFFF', borderRadius:10, padding:12, borderWidth:1, borderColor:'#E2E6EA', shadowColor:'#000', shadowOffset:{ width:0, height:2 }, shadowOpacity:0.12, shadowRadius:4, elevation:5 },
  editCardDark:{ backgroundColor:'#2E4053', borderColor:'#5D6D7E' },
  editTitle:{ fontSize:16, fontWeight:'800', color:'#2D5016', marginBottom:8 },
  editHint:{ fontSize:11, color:'#7F8C8D', marginTop:6, textAlign:'center' },
});

export default VaultModeScreen;
