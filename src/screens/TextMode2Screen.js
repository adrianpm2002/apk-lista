import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Text, Pressable } from 'react-native';
import DropdownPicker from '../components/DropdownPicker';
import InputField from '../components/InputField';
import ModeSelector from '../components/ModeSelector';
import ListButton from '../components/ListButton';
import BatteryButton from '../components/BatteryButton';
import NotificationsButton from '../components/NotificationsButton';
import CleanerButton from '../components/CleanerButton';
import FeedbackBanner from '../components/FeedbackBanner';
import { parseTextMode2 } from '../utils/textModeParser2';
import { t } from '../utils/i18n';
import { supabase } from '../supabaseClient';
import { fetchLimitsContext, checkInstructionsLimits } from '../utils/limitUtils';
import { usePlaySubmission } from '../hooks/usePlaySubmission';

const TextMode2Screen = ({ navigation, route, currentMode, onModeChange, isDarkMode, onToggleDarkMode, onModeVisibilityChange, visibleModes }) => {
  const [selectedLotteries, setSelectedLotteries] = useState([]);
  const [selectedSchedules, setSelectedSchedules] = useState({});
  const [plays, setPlays] = useState('');
  const [note, setNote] = useState('');
  const [parsedInstructions, setParsedInstructions] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [lotteries, setLotteries] = useState([]);
  const [scheduleOptionsMap, setScheduleOptionsMap] = useState({});
  const [insertFeedback, setInsertFeedback] = useState(null);
  const [verifyFeedback, setVerifyFeedback] = useState(null);
  const feedbackTimerRef = useRef(null);
  const verifyTimerRef = useRef(null);
  const [limitViolations, setLimitViolations] = useState([]);

  const { submitPlay } = usePlaySubmission();

  useEffect(()=>{ const { instructions, errors } = parseTextMode2(plays); setParsedInstructions(instructions); setParseErrors(errors); },[plays]);

  useEffect(()=>{ if(insertFeedback){ feedbackTimerRef.current && clearTimeout(feedbackTimerRef.current); feedbackTimerRef.current=setTimeout(()=> setInsertFeedback(null),5000);} return ()=> feedbackTimerRef.current&&clearTimeout(feedbackTimerRef.current); },[insertFeedback]);
  useEffect(()=>{ if(verifyFeedback){ verifyTimerRef.current && clearTimeout(verifyTimerRef.current); verifyTimerRef.current=setTimeout(()=> setVerifyFeedback(null),5000);} return ()=> verifyTimerRef.current&&clearTimeout(verifyTimerRef.current); },[verifyFeedback]);

  useEffect(()=>{ (async()=>{ const { data } = await supabase.from('loteria').select('id,nombre'); if(data){ setLotteries(data.map(l=> ({ label:l.nombre, value:l.id })) ); } })(); },[]);
  useEffect(()=>{ (async()=>{ if(!selectedLotteries.length) return; const map={}; for(const lot of selectedLotteries){ const { data } = await supabase.from('horario').select('id,nombre').eq('id_loteria', lot); map[lot]=(data||[]).map(h=> ({ label:h.nombre, value:h.id })); } setScheduleOptionsMap(map); })(); },[selectedLotteries]);

  const validateForm=()=>{ let err=false; if(!selectedLotteries.length) err=true; const missing=selectedLotteries.some(l=> !selectedSchedules[l]); if(missing) err=true; if(!plays.trim()) err=true; if(!note.trim()) err=true; if(err) setShowFieldErrors(true); return !err; };

  const handleVerify=async()=>{ setVerifyFeedback(null); if(!validateForm()) { setVerifyFeedback({type:'error', message:t('errors.requiredOrFix')}); return; } if(parseErrors.length){ setVerifyFeedback({type:'error', message:`${t('errors.parse')}: ${parseErrors.length}`}); return; } if(!parsedInstructions.length){ setVerifyFeedback({ type:'error', message:t('errors.noValidInstructions') }); return; }
    try { const horarios = selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean); if(horarios.length){ const { data:{ user }} = await supabase.auth.getUser(); const ctx = await fetchLimitsContext(horarios, user?.id); const violations = checkInstructionsLimits(parsedInstructions, horarios, ctx); if(violations.length){ setLimitViolations(violations); setVerifyFeedback({ type:'error', message:`${t('verify.limitViolations')}: ${violations.length}` }); return; } } const summary = parsedInstructions.reduce((acc,i)=>{ acc[i.playType]=(acc[i.playType]||0)+i.numbers.length; return acc; },{}); const parts=Object.keys(summary).map(k=> `${k}:${summary[k]}`).join(' | '); setVerifyFeedback({ type:'success', message:`${t('verify.summaryPrefix')}: ${parts}` }); } catch(e){ setVerifyFeedback({ type:'error', message:t('errors.verify') }); }
  };

  const handleInsert=async()=>{ setLimitViolations([]); if(!validateForm()) return; if(parseErrors.length || !parsedInstructions.length) return; try { const horarios= selectedLotteries.map(l=> selectedSchedules[l]).filter(Boolean); const { data:{ user }} = await supabase.auth.getUser(); const ctx = await fetchLimitsContext(horarios, user?.id); const violations = checkInstructionsLimits(parsedInstructions, horarios, ctx); if(violations.length){ setLimitViolations(violations); setInsertFeedback({ success:0, fail:1, blocked:true }); return; } let success=0, fail=0; for(const instr of parsedInstructions){ for(const lot of selectedLotteries){ const scheduleId=selectedSchedules[lot]; if(!scheduleId) continue; const result = await submitPlay({ lottery: lot, schedule: scheduleId, playType: instr.playType, numbers: instr.numbers.join(','), amount: instr.amountEach, total: instr.totalPerLottery, note }); if(result.success) success++; else fail++; } } setInsertFeedback({ success, fail }); if(success){ setPlays(''); setNote(''); } } catch(e){ setInsertFeedback({ success:0, fail:1 }); }
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      <View style={styles.headerFloating}>
        <View style={styles.inlineHeaderRow}>
          <ModeSelector currentMode={currentMode} onModeChange={onModeChange} isDarkMode={isDarkMode} visibleModes={visibleModes} />
          <BatteryButton />
          <NotificationsButton />
        </View>
        <View style={styles.rightButtonsGroup}>
          <ListButton currentMode={currentMode} />
          <CleanerButton onInsert={(formatted)=> setPlays(p=> p ? p + '\n' + formatted : formatted)} />
        </View>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <DropdownPicker label="Loterías" multiple value={selectedLotteries} onChange={setSelectedLotteries} options={lotteries} placeholder="Seleccionar" hasError={showFieldErrors && !selectedLotteries.length} />
        </View>
        {selectedLotteries.length>0 && (
          <View style={styles.schedulesRow}>
            {selectedLotteries.map(lv=> (
              <View key={lv} style={styles.scheduleCol}>
                <DropdownPicker label={lotteries.find(l=> l.value===lv)?.label||'Horario'} value={selectedSchedules[lv]||''} onChange={(v)=> setSelectedSchedules(prev=> ({...prev, [lv]:v}))} options={scheduleOptionsMap[lv]||[]} placeholder="Horario" hasError={showFieldErrors && !selectedSchedules[lv]} />
              </View>
            ))}
          </View>
        )}
        <InputField label="Números / comandos" value={plays} onChangeText={setPlays} multiline placeholder="Ej: 10.50.60 con 10f 20c" hasError={showFieldErrors && !plays.trim()} />
        <View style={{ marginVertical:6 }}>
          {parsedInstructions.length>0 && (
            <Text style={{ fontSize:12, color:'#2D5016' }}>Instr: {parsedInstructions.length}</Text>
          )}
          {parseErrors.slice(0,4).map((e,i)=>(<Text key={i} style={{ fontSize:11, color:'#C0392B' }}>L{e.line}: {e.message}</Text>))}
          {parseErrors.length>4 && <Text style={{ fontSize:11, color:'#C0392B' }}>+{parseErrors.length-4} más...</Text>}
        </View>
        <InputField label={t('common.note')} value={note} onChangeText={setNote} placeholder="Nombre" hasError={showFieldErrors && !note.trim()} />
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={handleVerify}><Text style={styles.actionButtonTxt}>{t('actions.verify')}</Text></Pressable>
          <Pressable style={[styles.actionButton, styles.actionPrimary]} onPress={handleInsert}><Text style={[styles.actionButtonTxt, styles.actionPrimaryTxt]}>{t('actions.insert')}</Text></Pressable>
        </View>
      </ScrollView>
      {verifyFeedback && (
        <FeedbackBanner type={verifyFeedback.type==='success'?'success':'error'} message={verifyFeedback.message} onClose={()=> setVerifyFeedback(null)} style={{ top:70 }} />
      )}
      {insertFeedback && (
        <FeedbackBanner type={insertFeedback.blocked? 'blocked': (insertFeedback.fail? (insertFeedback.success? 'warning':'success'):'success')} message={`${t('banner.inserted')}: ${insertFeedback.success||0} ${t('banner.fail')}: ${insertFeedback.fail||0}`} details={limitViolations.slice(0,8).map(v=> `${v.numero} (${v.jugada}) ${(v.usado||0)}+${v.intento||0}/${v.permitido}`)} onClose={()=> setInsertFeedback(null)} style={{ top: verifyFeedback? 120:70 }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#f0f8ff' },
  containerDark:{ backgroundColor:'#2c3e50' },
  headerFloating:{ position:'absolute', top:0, left:0, right:0, flexDirection:'row', justifyContent:'flex-start', alignItems:'flex-start', zIndex:3000, paddingTop:12, paddingBottom:10, paddingHorizontal:20, backgroundColor:'rgba(255,255,255,0.96)', borderBottomWidth:1, borderBottomColor:'#E2E6EA', shadowColor:'#000', shadowOffset:{ width:0, height:2 }, shadowOpacity:0.12, shadowRadius:4, elevation:4 },
  inlineHeaderRow:{ flexDirection:'row', alignItems:'center', gap:6, flex:1 },
  rightButtonsGroup:{ flexDirection:'row', alignItems:'center', gap:6, marginLeft:'auto' },
  content:{ flex:1, paddingHorizontal:16, paddingVertical:12, paddingTop:120 },
  row:{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  schedulesRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:6 },
  scheduleCol:{ flexBasis:'48%', flexGrow:1 },
  actionRow:{ flexDirection:'row', justifyContent:'space-between', marginTop:10, gap:8 },
  actionButton:{ flex:1, backgroundColor:'#E8F5E9', paddingVertical:12, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#B8D4A8' },
  actionPrimary:{ backgroundColor:'#2D5016', borderColor:'#244012' },
  actionButtonTxt:{ fontSize:14, fontWeight:'700', color:'#2D5016' },
  actionPrimaryTxt:{ color:'#FFFFFF' }
});

export default TextMode2Screen;
