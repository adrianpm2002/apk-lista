import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet, Platform, Alert, Clipboard as RNClipboard } from 'react-native';

const CleanerButton = ({ onInsert, append=true, isDarkMode=false }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const clean = (txt) => txt.replace(/[^0-9,.*\s]/g,'');
  const onlyDigits = (txt) => txt.replace(/[^0-9]/g,'');
  const pairs = (digits) => { const arr=[]; for(let i=0;i<digits.length;i+=2) arr.push(digits.slice(i,i+2)); return arr; };

  const handlePaste = async () => {
    try {
      let text='';
  if(Platform.OS==='web' && navigator.clipboard?.readText) text=await navigator.clipboard.readText(); else text=await RNClipboard.getString();
      setValue(clean(text||''));
    } catch(e){ Alert.alert('Error','No se pudo pegar'); }
  };
  const handleChange = (txt) => setValue(clean(txt));
  const actionComas = () => { const p=pairs(onlyDigits(value)).filter(p=> p.length===2); setValue(p.join(',')); };
  const actionAster = () => { const p=pairs(onlyDigits(value)).filter(p=> p.length===2); setValue(p.join('*')); };
  const actionUnir = () => {
    const pFull = pairs(onlyDigits(value));
    const completos = pFull.filter(p=> p.length===2);
    if(!completos.length) { Alert.alert('Vacío','No hay pares'); return; }
    const sobranteDig = (onlyDigits(value).length %2 ===1) ? onlyDigits(value).slice(-1) : '';
    const res=[];
    for(let i=0;i+1<completos.length;i+=2) res.push(completos[i]+completos[i+1]);
    if(completos.length %2 ===1){
      const last = completos[completos.length-1];
      if(sobranteDig) res.push(last+sobranteDig); else res.push(last);
    }
    setValue(res.join(','));
  };
  const actionInsert = () => {
    const out=value.trim();
    if(!out){ Alert.alert('Vacío','No hay datos'); return; }
    onInsert && onInsert(out,{ append });
    setOpen(false); setValue('');
  };
  const actionClear = () => setValue('');

  return (
    <>
      <Pressable style={({pressed})=> [styles.btnText, pressed && styles.btnTextPressed]} onPress={()=> setOpen(true)}><Text style={styles.btnTextLabel}>Limpiar</Text></Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={()=> setOpen(false)}>
        <View style={styles.mOverlay}> 
          <View style={[styles.mPanel, isDarkMode && styles.mPanelDark]}> 
            <View style={styles.mHeader}> 
              <Text style={[styles.mTitle, isDarkMode && styles.mTitleDark]}>Limpiar</Text>
              <Pressable onPress={()=> setOpen(false)}><Text style={styles.mClose}>✕</Text></Pressable>
            </View>
            <View style={styles.mInputWrap}> 
              <TextInput
                value={value}
                onChangeText={handleChange}
                multiline
                placeholder="Pega o escribe"
                placeholderTextColor={isDarkMode ? '#7A858C' : '#9AA5A0'}
                style={[styles.mInput, isDarkMode && styles.mInputDark]}
              />
              <View style={styles.mInlineBtns}> 
                <Pressable style={styles.inlineBtn} onPress={handlePaste}><Text style={styles.inlineBtnTxt}>Pegar</Text></Pressable>
                <Pressable style={styles.inlineBtn} onPress={actionClear}><Text style={[styles.inlineBtnTxt,{color:'#1565C0'}]}>Limpiar</Text></Pressable>
              </View>
            </View>
            <View style={styles.mActionsRow}> 
              <Pressable style={styles.act} onPress={actionComas}><Text style={styles.actTxt}>Comas</Text></Pressable>
              <Pressable style={styles.act} onPress={actionAster}><Text style={styles.actTxt}>Asterisco</Text></Pressable>
              <Pressable style={styles.act} onPress={actionUnir}><Text style={styles.actTxt}>Unir pares</Text></Pressable>
              <Pressable style={[styles.act, styles.actPrimary]} onPress={actionInsert}><Text style={[styles.actTxt, styles.actPrimaryTxt]}>Insertar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btnText:{ paddingHorizontal:14, paddingVertical:10, borderRadius:10, backgroundColor:'#F2F5F2', borderWidth:1, borderColor:'#D5DBDB' },
  btnTextPressed:{ opacity:0.7 },
  btnTextLabel:{ fontSize:14, fontWeight:'600', color:'#2C3E50' },
  mOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'center', alignItems:'flex-end', padding:16 },
  mPanel:{ width:'86%', backgroundColor:'#FFFFFF', borderRadius:18, padding:16 },
  mPanelDark:{ backgroundColor:'#22313F' },
  mHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  mTitle:{ fontSize:18, fontWeight:'700', color:'#2D5016' },
  mTitleDark:{ color:'#ECF0F1' },
  mClose:{ fontSize:18, fontWeight:'600', color:'#C0392B' },
  mInputWrap:{ position:'relative' },
  mInput:{ minHeight:160, borderWidth:1.5, borderColor:'#D5DBDB', borderRadius:10, padding:12, paddingTop:46, fontSize:15, backgroundColor:'#FFFFFF', textAlignVertical:'top', color:'#2C3E50' },
  mInputDark:{ backgroundColor:'#2E3B47', borderColor:'#3F4B55', color:'#ECF0F1' },
  mInlineBtns:{ position:'absolute', top:6, right:8, flexDirection:'row', gap:8 },
  inlineBtn:{ backgroundColor:'#F2F5F2', borderWidth:1, borderColor:'#D5DBDB', paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  inlineBtnTxt:{ fontSize:12, fontWeight:'600', color:'#2C3E50' },
  mActionsRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:18 },
  act:{ paddingHorizontal:12, paddingVertical:10, borderRadius:10, backgroundColor:'#F2F5F2', borderWidth:1, borderColor:'#D5DBDB' },
  actTxt:{ fontSize:13, fontWeight:'600', color:'#2C3E50' },
  actPrimary:{ backgroundColor:'#2D5016', borderColor:'#2D5016' },
  actPrimaryTxt:{ color:'#FFFFFF' }
});

export default CleanerButton;
