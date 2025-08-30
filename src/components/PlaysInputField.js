// Implementación limpia y única del campo de jugadas con scroll nativo (sin overlays complicados)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Clipboard, ScrollView } from 'react-native';

const PlaysInputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  playType,
  selectedPlayTypes = [],
  isDarkMode = false,
  multiline = true,
  showPasteButton = false,
  pasteButtonOverlay = false,
  hasError = false,
}) => {
  // Estado interno basado en dígitos planos + edición token
  const [rawDigits, setRawDigits] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const hiddenInputRef = useRef(null);
  useEffect(()=> {
    // Parsear value externo (acepta con o sin comas)
    const digits = (value || '').replace(/[^0-9]/g,'');
    setRawDigits(digits);
  },[value]);
  const playTypeValue = typeof playType === 'object' ? playType?.value : playType;

  // Determina longitud esperada por tipo
  const getLen = useCallback(() => {
    if (!playTypeValue) return null;
    if (selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo')) return 3; // combo centena+fijo
    switch (playTypeValue) {
      case 'fijo':
      case 'corrido':
      case 'posicion':
        return 2;
      case 'parle':
        return 4;
      case 'centena':
        return 3;
      case 'tripleta':
        return 6;
      default:
        return 2;
    }
  }, [playTypeValue, selectedPlayTypes]);
  const reqLen = getLen();

  const pad = (n) => (reqLen && n.length < reqLen ? n.padStart(reqLen,'0') : n);

  // Derivar tokens desde rawDigits
  const tokens = (()=> {
    if(!reqLen) return rawDigits ? [rawDigits] : [];
    const out=[]; for(let i=0;i+reqLen<=rawDigits.length;i+=reqLen){ out.push(rawDigits.slice(i,i+reqLen)); }
    return out;
  })();
  const trailing = reqLen ? rawDigits.slice(Math.floor(rawDigits.length/reqLen)*reqLen) : '';

  const emitChange = (digitsStr) => {
    // Construir representación externa (usamos comas para compatibilidad)
    if(!reqLen){ onChangeText && onChangeText(digitsStr); return; }
    const groups=[]; for(let i=0;i+reqLen<=digitsStr.length;i+=reqLen){ groups.push(digitsStr.slice(i,i+reqLen)); }
    const rest = digitsStr.slice(Math.floor(digitsStr.length/reqLen)*reqLen);
    const final = rest ? groups.join(',') + ',' + rest : groups.join(',');
    onChangeText && onChangeText(final);
  };

  const handleHiddenChange = (val) => {
    const cleaned = val.replace(/[^0-9]/g,'');
    setRawDigits(cleaned);
    emitChange(cleaned);
  };

  const handlePaste = async () => {
    try {
      let clip='';
      if(Platform.OS==='web' && navigator.clipboard?.readText) clip = await navigator.clipboard.readText();
      else clip = await Clipboard.getString();
      if(!clip) return;
      const cleaned = clip.replace(/[^0-9]/g,'');
      const next = rawDigits + cleaned;
      setRawDigits(next);
      emitChange(next);
    } catch(e){}
  };
  const handleClear = () => { setRawDigits(''); emitChange(''); };

  // Edición inline de un token
  const startEdit = (idx) => { setEditingIndex(idx); setEditingValue(tokens[idx]); };
  const commitEdit = (val) => {
    let v = val.replace(/[^0-9]/g,'');
    if(!v){ // eliminar token
      const before = tokens.slice(0, editingIndex).join('');
      const after = tokens.slice(editingIndex+1).join('');
      const nextDigits = before + after + trailing; // conservar trailing
      setRawDigits(nextDigits);
      emitChange(nextDigits);
    } else if(v.length === reqLen){
      const before = tokens.slice(0, editingIndex).join('');
      const after = tokens.slice(editingIndex+1).join('');
      const nextDigits = before + v + after + trailing;
      setRawDigits(nextDigits);
      emitChange(nextDigits);
    } else {
      // mantener edición parcial, no comitear aún
      setEditingValue(v);
      return; // no cerrar
    }
    setEditingIndex(null); setEditingValue('');
  };

  // Re-formatear si cambia longitud requerida: reinterpretar todos los dígitos sin alterar
  useEffect(()=> { emitChange(rawDigits); }, [reqLen]);

  // Métricas / duplicados (con canónico para parle)
  const fullTokens = tokens;
  const isParle = playTypeValue === 'parle' && reqLen === 4;
  const canonicalOf = (tok) => {
    if(isParle && tok && tok.length===4){ const a=tok.slice(0,2), b=tok.slice(2); return [a,b].sort().join(''); }
    return tok;
  };
  const canonicalCounts = {};
  fullTokens.forEach(t => { const k = canonicalOf(t); canonicalCounts[k] = (canonicalCounts[k]||0)+1; });
  const duplicateCanonicalSet = new Set(Object.keys(canonicalCounts).filter(k => canonicalCounts[k] > 1));
  const tokenIsDuplicate = (tok) => duplicateCanonicalSet.has(canonicalOf(tok));
  const incomplete = !!(reqLen && trailing && trailing.length < reqLen);
  const totalMsg = reqLen ? `Total: ${fullTokens.length}` : '';
  const dupCount = duplicateCanonicalSet.size;

  return (
    <View style={styles.container}>
      {label && !pasteButtonOverlay && (
        <View style={styles.headerRow}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>{label}</Text>
          {showPasteButton && (
            <Pressable onPress={handlePaste} style={[styles.pasteBtn, isDarkMode && styles.pasteBtnDark]}>
              <Text style={[styles.pasteBtnText, isDarkMode && styles.pasteBtnTextDark]}>📋</Text>
            </Pressable>
          )}
        </View>
      )}
      {label && pasteButtonOverlay && <Text style={[styles.label, isDarkMode && styles.labelDark]}>{label}</Text>}
      <Pressable style={[styles.tokensBox, isDarkMode && styles.tokensBoxDark, hasError && styles.inputError]} onPress={()=> hiddenInputRef.current?.focus()}>
        <ScrollView
          style={styles.tokensScroll}
          contentContainerStyle={styles.tokensWrap}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          {fullTokens.map((tok,idx)=>{
            const dup = tokenIsDuplicate(tok);
            const isEditing = editingIndex===idx;
            return (
              <Pressable
                key={idx}
                style={[
                  styles.token,
                  dup && styles.tokenDup,
                  // Mantener tamaño estable durante la edición
                  isEditing && { minWidth: 44, alignItems: 'center', justifyContent: 'center' }
                ]}
                delayLongPress={250}
                onLongPress={()=> reqLen && tok.length===reqLen && startEdit(idx)}
              >
                {isEditing ? (
                  <TextInput
                    style={styles.tokenEditInput}
                    value={editingValue}
                    onChangeText={(t)=> {
                      const c=t.replace(/[^0-9]/g,'');
                      if(c.length<=reqLen) setEditingValue(c);
                      if(c.length===0) commitEdit('');
                      if(c.length===reqLen) commitEdit(c);
                    }}
                    autoFocus
                    keyboardType='number-pad'
                    onBlur={()=> commitEdit(editingValue)}
                  />
                ) : (
                  <Text style={styles.tokenText}>{tok}</Text>
                )}
              </Pressable>
            );
          })}
          {reqLen && trailing ? (
            <View style={[styles.token, styles.tokenTrailing]}><Text style={[styles.tokenText, styles.trailingText]}>{trailing}</Text></View>
          ) : null}
          {!rawDigits && <Text style={[styles.placeholder, isDarkMode && styles.placeholderDark]}>{placeholder || 'Numeros'}</Text>}
        </ScrollView>
        <TextInput
          ref={hiddenInputRef}
            style={styles.hiddenInput}
            value={rawDigits}
            onChangeText={handleHiddenChange}
            keyboardType='number-pad'
            multiline
            autoCorrect={false}
            placeholder=''
        />
        {showPasteButton && (
          <View style={styles.sideButtons}>
            <Pressable style={[styles.sideBtn, isDarkMode && styles.sideBtnDark]} onPress={handlePaste}><Text style={styles.sideBtnTxt}>📋</Text></Pressable>
            <Pressable style={[styles.sideBtn, isDarkMode && styles.sideBtnDark]} onPress={handleClear}><Text style={styles.sideBtnTxt}>🧹</Text></Pressable>
          </View>
        )}
      </Pressable>
      <View style={styles.metaRow}>
        {!!totalMsg && <Text style={styles.metaText}>{totalMsg}</Text>}
        {dupCount > 0 && (
          <Text style={[styles.metaText, styles.metaDuplicate]}>(Duplicados: {dupCount})</Text>
        )}
        {incomplete && (
          <Text style={[styles.metaText, styles.metaIncomplete]}>Incompleto</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#2C3E50' },
  labelDark: { color: '#ECF0F1' },
  pasteBtn: { backgroundColor: '#E8F5E8', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#B8D4A8' },
  pasteBtnDark: { backgroundColor: '#2C3E50', borderColor: '#5D6D7E' },
  pasteBtnText: { fontSize: 12, fontWeight: '600', color: '#2D5016' },
  pasteBtnTextDark: { color: '#ECF0F1' },
  tokensBox:{ minHeight:100, maxHeight:180, borderWidth:1.5, borderColor:'#D5DBDB', backgroundColor:'#FFFFFF', borderRadius:8, padding:10, position:'relative' },
  tokensBoxDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  tokensScroll:{ flexGrow:0 },
  tokensWrap:{ flexDirection:'row', flexWrap:'wrap', alignItems:'flex-start', paddingRight: 68 },
  token:{ backgroundColor:'#EAF2F8', paddingHorizontal:8, paddingVertical:6, borderRadius:6, marginRight:6, marginBottom:6 },
  tokenDup:{ backgroundColor:'#FFE878' },
  tokenText:{ fontSize:14, fontWeight:'700', color:'#2C3E50' },
  tokenEditInput:{ minWidth:40, paddingVertical:0, paddingHorizontal:0, fontSize:14, fontWeight:'700', color:'#2C3E50', textAlign:'center', includeFontPadding:false, textAlignVertical:'center' },
  tokenTrailing:{ backgroundColor:'#FDEDEC' },
  trailingText:{ color:'#C0392B' },
  hiddenInput:{ position:'absolute', opacity:0, left:0, top:0, height:0, width:0 },
  sideButtons:{ position:'absolute', right:8, top:8, alignItems:'flex-end' },
  sideBtn:{ backgroundColor:'#E8F5E8', paddingHorizontal:8, paddingVertical:6, borderRadius:6, marginBottom:6, borderWidth:1, borderColor:'#B8D4A8' },
  sideBtnDark:{ backgroundColor:'#2C3E50', borderColor:'#5D6D7E' },
  sideBtnTxt:{ fontSize:10, fontWeight:'600', color:'#2D5016' },
  placeholder:{ fontSize:14, color:'#95A5A6', paddingVertical:4 },
  placeholderDark:{ color:'#7F8C8D' },
  inputError:{ borderColor:'#E74C3C' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  metaText: { fontSize: 11, marginRight: 12, marginVertical: 2, color: '#566573' },
  metaIssue: { fontWeight: '700' },
  metaDuplicate: { fontWeight: '700', color: '#F1C40F' },
  metaIncomplete: { fontWeight: '700', color: '#E74C3C' },
});

export default PlaysInputField;
