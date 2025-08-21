import React, { useState, useRef, useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Clipboard, Platform, Alert, ScrollView, TextInput } from 'react-native';

// HammerButton reescrito: se elimina AnimatedModalWrapper para evitar parpadeos.
// Se mantiene TODA la lógica original (generación, parle, combinación, edición, duplicados, parejas AA, pegado, limpieza, inserción).
// Cambios clave:
// 1. Modal nativo con animationType="fade" (configurable si se requiere).
// 2. Derivados (displayTokens, duplicados, conteos) memorizados con useMemo para menos renders.
// 3. Estructura de render simplificada sin wrapper animado externo.
// 4. Misma API externa (onOptionSelect, isDarkMode, numbersSeparator).
const HammerButton = ({ onOptionSelect, isDarkMode=false, numbersSeparator = ', ' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [rawDigits, setRawDigits] = useState(''); // cadena de dígitos crudos para tokens de 2
  const [tokens, setTokens] = useState([]); // tokens (2 o 4 dígitos tras amarrar)
  const [parleMode, setParleMode] = useState(false); // si true tokens pueden ser 4
  const [selectedDigits, setSelectedDigits] = useState([]); // selección teclado 0-9
  // Eliminado combinarParleEnabled (toggle obsoleto)
  const [parleType, setParleType] = useState('terminal'); // 'terminal' | 'centena'
  const [inputFocused, setInputFocused] = useState(false);
  const [markIncompleteRed, setMarkIncompleteRed] = useState(false); // resalta último dígito suelto al intentar amarrar
  const [editingIndex, setEditingIndex] = useState(null); // índice de token en edición (2 o 4)
  const [editingValue, setEditingValue] = useState('');
  const [parleEntry, setParleEntry] = useState(''); // entrada de parle manual (4 dígitos)
  const [parejasAdded, setParejasAdded] = useState(false); // impedir múltiples inserciones de parejas AA
  const hiddenInputRef = useRef(null);

  // Derivados memorizados para estabilidad y menos renders.
  const memo = useMemo(()=>{
    const deriveTokensFromRaw = () => {
      if (parleMode) return tokens;
      const t = [];
      for (let i=0;i<rawDigits.length;i+=2) {
        const slice = rawDigits.slice(i,i+2);
        if (slice.length===2) t.push(slice); else if (slice.length===1) t.push(slice);
      }
      return t;
    };
    const displayTokens = deriveTokensFromRaw();
    const duplicateCounts = displayTokens.reduce((acc,t)=>{ if(t.length===2 || t.length===4){ acc[t]=(acc[t]||0)+1;} return acc; },{});
    let unorderedParleDupSet = new Set();
    let logicalParleDuplicateGroups = 0;
    if (parleMode) {
      const pairCounts = {};
      displayTokens.forEach(tok => {
        if (tok.length === 4) {
          const p1 = tok.slice(0,2); const p2 = tok.slice(2);
          const key = [p1,p2].sort().join('|');
          pairCounts[key] = (pairCounts[key]||0)+1;
        }
      });
      Object.entries(pairCounts).forEach(([key,count])=>{
        if (count>1) {
          logicalParleDuplicateGroups += 1;
          const [a,b] = key.split('|');
          displayTokens.forEach(tok => {
            if (tok.length===4) {
              const p1 = tok.slice(0,2); const p2 = tok.slice(2);
              if ((p1===a && p2===b) || (p1===b && p2===a)) unorderedParleDupSet.add(tok);
            }
          });
        }
      });
    }
    const twoDigitTokens = displayTokens.filter(t=> t.length===2);
    const pairDuplicateGroupCount = (()=>{
      const freq = {}; twoDigitTokens.forEach(t=>{ freq[t]=(freq[t]||0)+1; });
      return Object.values(freq).filter(c=>c>1).length;
    })();
    const hasDuplicates = parleMode ? logicalParleDuplicateGroups>0 : pairDuplicateGroupCount>0;
    return {
      displayTokens,
      duplicateCounts,
      unorderedParleDupSet,
      logicalParleDuplicateGroups,
      twoDigitTokens,
      pairDuplicateGroupCount,
      hasDuplicates
    };
  }, [rawDigits, tokens, parleMode]);

  const { displayTokens, duplicateCounts, unorderedParleDupSet, logicalParleDuplicateGroups, twoDigitTokens, pairDuplicateGroupCount, hasDuplicates } = memo;
  const lastTwoDigitToken = useMemo(()=>[...displayTokens].reverse().find(t=> t.length===2) || null,[displayTokens]);

  const toggleDigit = (d) => {
    setSelectedDigits(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d]);
  };

  const mergeNumbersIntoInput = (nums, { sortAfter = true } = {}) => {
    if (!nums.length) return;
    if (parleMode) {
      // En modo parle seguimos evitando duplicados exactos de 4 dígitos
      const setAll = new Set(tokens);
      nums.forEach(n=> { if(!setAll.has(n)) setAll.add(n); });
      let arr = Array.from(setAll);
      if (sortAfter) arr.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
      setTokens(arr);
    } else {
      // Permitir duplicados en pares de 2 dígitos (requisito actualizado)
      // Tomar tokens actuales completos + nuevos y ordenar
      const currentPairs = displayTokens.filter(t=> t.length===2);
      const trailing = (rawDigits.length %2 ===1) ? rawDigits.slice(-1) : '';
      const all = [...currentPairs, ...nums.filter(n=>n.length===2)];
      if (sortAfter) all.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
      setRawDigits(all.join('') + trailing);
    }
  };

  const handlePaste = async () => {
    try {
      let text='';
      if (Platform.OS==='web' && navigator.clipboard?.readText) text = await navigator.clipboard.readText(); else text = await Clipboard.getString();
      if (!text) return;
      const cleaned = text.replace(/[^0-9]/g,'');
      // partir en segmentos de 2
      const segs = [];
      for (let i=0;i<cleaned.length;i+=2){
        const slice = cleaned.slice(i,i+2);
        if (slice.length===2) segs.push(slice);
      }
      mergeNumbersIntoInput(segs);
      if (cleaned.length %2 ===1) setRawDigits(prev => prev + cleaned.slice(-1));
    } catch(e) {
      Alert.alert('Error','No se pudo pegar');
    }
  };

  const handleClear = () => {
    setRawDigits('');
    setSelectedDigits([]);
    setTokens([]);
    setParleMode(false);
    setEditingIndex(null);
    setEditingValue('');
    setParejasAdded(false);
  };

  const handleAmarrar = () => {
    // Requiere selección de al menos un dígito del keypad y tokens base (2 dígitos)
    const baseTokens = parleMode ? tokens.filter(t=>t.length===2) : displayTokens.filter(t=>t.length===2);
    // verificar incompleto antes de generar
    if (!parleMode && rawDigits.length %2 ===1) {
      setMarkIncompleteRed(true);
      return; // no genera hasta completar
    }
    if (!baseTokens.length) return Alert.alert('Vacío','No hay números base (2 dígitos)');
    if (!selectedDigits.length) return Alert.alert('Falta selección','Selecciona uno o más dígitos del teclado');
    // Generar parle según tipo seleccionado
    let generated = [];
  if (parleType === 'terminal') {
      // Terminal seleccionado ocupa la 4ta posición; 3ra recorre 0-9
      baseTokens.forEach(base => {
        for (let d=0; d<=9; d++) {
          selectedDigits.forEach(sel => {
            generated.push(base + d + sel); // XY d sel
          });
        }
      });
  } else { // decena (antes centena): dígito seleccionado en 3ra, 4ta recorre 0-9
      baseTokens.forEach(base => {
        selectedDigits.forEach(sel => {
          for (let d=0; d<=9; d++) {
            generated.push(base + sel + d); // XY sel d
          }
        });
      });
    }
  // Mantener duplicados (no filtrar) para reflejar repetidos en base
  generated.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
  setTokens(generated);
    setParleMode(true);
    setMarkIncompleteRed(false);
  };

  const handleCombinarParleInterno = () => {
    if (parleMode) return Alert.alert('Modo parle','Limpia antes de combinar');
  if (rawDigits.length %2 === 1) { setMarkIncompleteRed(true); return; }
    const base = displayTokens.filter(t=> t.length===2);
    if (base.length < 2) return Alert.alert('Insuficiente','Se requieren al menos 2 números de 2 dígitos');
    // Generar todas las combinaciones i<j preservando multiplicidad (si hay duplicados en base se reflejan)
    const result = [];
    for (let i=0;i<base.length;i++) {
      for (let j=i+1;j<base.length;j++) {
        const combo = base[i] + base[j]; // i<j evita espejo, pero no deduplicamos combos iguales
        result.push(combo);
      }
    }
    result.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
    setTokens(result);
    setParleMode(true);
  };

  const insertarTodasParejas = () => {
    if (parleMode) return Alert.alert('Modo parle','Limpia antes de insertar parejas AA');
    if (parejasAdded) return; // no volver a insertar
    const nuevos = [];
    for (let d=0; d<=9; d++) nuevos.push(`${d}${d}`); // solo AA
    mergeNumbersIntoInput(nuevos, { sortAfter: true });
    setParejasAdded(true);
  };

  // Manejo de entrada manual de parle cuando estamos en parleMode
  const handleParleEntryChange = (txt) => {
    const digits = txt.replace(/[^0-9]/g,'');
    if (digits.length <=4) {
      setParleEntry(digits);
      if (digits.length === 4) {
        // agregar parle (permitiendo duplicados) y ordenar
        setTokens(prev => {
          const next = [...prev, digits];
          next.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
          return next;
        });
        setParleEntry('');
      }
    } else {
      // si pega muchos, segmentar en grupos de 4
      const segs = [];
      for (let i=0;i<digits.length;i+=4) {
        const slice = digits.slice(i,i+4);
        if (slice.length===4) segs.push(slice);
        else setParleEntry(slice); // parcial
      }
      if (segs.length) {
        setTokens(prev => {
          const next = [...prev, ...segs];
            next.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
            return next;
        });
      }
    }
  };

  const removeParleToken = (tok) => {
    setTokens(prev => prev.filter(t => t!==tok || (tok==='__already_removed_marker__'))); // elimina solo coincidencias exactas; si hay duplicados múltiples se elimina uno por tap
  };

  const handleInsertar = () => {
    const finalTokens = parleMode ? tokens : displayTokens.filter(t=> t.length===2);
    if (!finalTokens.length) return Alert.alert('Vacío','Agrega números');
  onOptionSelect && onOptionSelect({ action:'insert', numbers: finalTokens.join(numbersSeparator) });
    setIsVisible(false);
    handleClear();
  };

  const handleCancel = () => { setIsVisible(false); handleClear(); };

  // Generar decena (incluye 00)
  const generarDecena = () => {
    if (!selectedDigits.length) return Alert.alert('Selecciona','Elige dígitos');
    if (parleMode) return Alert.alert('Modo parle','No se puede generar decena sobre parle, limpia primero');
    const nuevos = [];
    selectedDigits.forEach(d => { for (let u=0; u<=9; u++){ nuevos.push(`${d}${u}`); } });
    mergeNumbersIntoInput(nuevos, { sortAfter: true });
  };
  const generarTerminal = () => {
    if (!selectedDigits.length) return Alert.alert('Selecciona','Elige dígitos');
    if (parleMode) return Alert.alert('Modo parle','No se puede generar terminal sobre parle, limpia primero');
    const nuevos = [];
    selectedDigits.forEach(d => { for (let t=0; t<=9; t++){ nuevos.push(`${t}${d}`); } });
    mergeNumbersIntoInput(nuevos, { sortAfter: true });
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          isDarkMode && styles.buttonDark
        ]}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.buttonIcon}>🔨</Text>
      </Pressable>

      <Modal visible={isVisible} transparent animationType="fade" onRequestClose={handleCancel}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isDarkMode && styles.modalDark]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerIcon}>🔨</Text>
                <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>Generador de Números</Text>
              </View>
              <Pressable style={[styles.closeBtn, isDarkMode && styles.closeBtnDark]} onPress={handleCancel}><Text style={styles.closeBtnText}>✕</Text></Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
              {/* Área de lista con chips coloreables */}
              <View style={styles.block}>
                <View style={styles.blockHeaderRow}>
                  <Text style={[styles.blockTitle, isDarkMode && styles.blockTitleDark]}>Lista</Text>
                  {(parleMode ? tokens.length : twoDigitTokens.length) > 0 && (
                    <Text style={[styles.inlineCountLabel, isDarkMode && styles.inlineCountLabelDark]}>
                      Cantidad de números: {parleMode ? tokens.length : twoDigitTokens.length}{hasDuplicates ? ` (${parleMode ? logicalParleDuplicateGroups : pairDuplicateGroupCount} duplicados)` : ''}
                    </Text>
                  )}
                </View>
                <Pressable onPress={()=> hiddenInputRef.current?.focus()} style={[styles.tokensEditContainer, isDarkMode && styles.tokensEditContainerDark, inputFocused && styles.tokensEditFocused, hasDuplicates && styles.tokensEditDup]}>
                  <ScrollView style={styles.tokensScroll} contentContainerStyle={styles.tokensWrap} keyboardShouldPersistTaps="handled">
                    {(parleMode ? tokens : displayTokens).map((tok, idx)=>{
                      const dup = parleMode ? unorderedParleDupSet.has(tok) : (duplicateCounts[tok]>1 && (tok.length===2 || tok.length===4));
                      const isSingleIncomplete = !parleMode && tok.length===1 && idx === displayTokens.length-1;
                      const isEditing = editingIndex === idx && ((parleMode && tok.length===4) || (!parleMode && tok.length===2));
                      return (
                        <Pressable
                          key={idx}
                          style={[styles.token, tok.length===4 && styles.tokenParle, isEditing && styles.tokenEditing]}
                          onLongPress={()=> {
                            if (parleMode && tok.length===4) { setEditingIndex(idx); setEditingValue(tok); }
                            if (!parleMode && tok.length===2) { setEditingIndex(idx); setEditingValue(tok); }
                          }}
                          delayLongPress={250}
                        >
                          {isEditing ? (
                            <TextInput
                              style={styles.parleEditInput}
                              value={editingValue}
                              onChangeText={(txt)=>{
                                const val = txt.replace(/[^0-9]/g,'');
                                const targetLen = parleMode ? 4 : 2;
                                if (val.length<=targetLen) setEditingValue(val);
                                if (val.length===0){
                                  if (parleMode){
                                    setTokens(prev=> prev.filter((_,i)=> i!==editingIndex));
                                  } else {
                                    // reconstruir pares sin el índice
                                    const tokensFull = [...displayTokens];
                                    const updated = tokensFull.filter((_,i)=> i!==editingIndex);
                                    const two = updated.filter(t=> t.length===2).sort((a,b)=> parseInt(a,10)-parseInt(b,10));
                                    const trailing = (updated.length && updated[updated.length-1].length===1) ? updated[updated.length-1] : (rawDigits.length %2 ===1 ? rawDigits.slice(-1): '');
                                    setRawDigits(two.join('') + trailing);
                                  }
                                  setEditingIndex(null); setEditingValue('');
                                }
                                if (val.length===targetLen){
                                  if (parleMode){
                                    setTokens(prev=> {
                                      const copy=[...prev];
                                      copy[editingIndex]=val;
                                      copy.sort((a,b)=> parseInt(a,10)-parseInt(b,10));
                                      return copy;
                                    });
                                  } else {
                                    const tokensFull = [...displayTokens];
                                    tokensFull[editingIndex]=val;
                                    const two = tokensFull.filter(t=> t.length===2).sort((a,b)=> parseInt(a,10)-parseInt(b,10));
                                    const trailing = (tokensFull.some(t=> t.length===1) ? tokensFull.find(t=> t.length===1) : (rawDigits.length %2 ===1 ? rawDigits.slice(-1): ''));
                                    setRawDigits(two.join('') + (trailing && trailing.length===1 ? trailing : ''));
                                  }
                                  setEditingIndex(null); setEditingValue('');
                                }
                              }}
                              onBlur={()=>{ setEditingIndex(null); setEditingValue(''); }}
                              autoFocus
                              keyboardType="number-pad"
                            />
                          ) : (
                            <Text style={[styles.tokenText, dup && styles.tokenTextDup, isSingleIncomplete && markIncompleteRed && styles.tokenTextIncompleteRed]}>{tok}</Text>
                          )}
                        </Pressable>
                      );
                    })}
                    {parleMode && (
                      <View style={[styles.token, styles.tokenParleInput]}>
                        <TextInput
                          style={styles.parleEntryInput}
                          value={parleEntry}
                          onChangeText={handleParleEntryChange}
                          keyboardType="number-pad"
                          placeholder="Añadir"
                          placeholderTextColor="#9AA5A0"
                          maxLength={8} // permite pegar múltiplos
                        />
                      </View>
                    )}
                    {!parleMode && inputFocused && rawDigits.length %2 ===0 && (
                      <View style={styles.caretIndicator}><Text style={styles.caretIndicatorText}>|</Text></View>
                    )}
                    {(!parleMode && displayTokens.length===0) && <Text style={styles.placeholder}>Numeros</Text>}
                  </ScrollView>
                  {!parleMode && (
                    <TextInput
                      ref={hiddenInputRef}
                      style={styles.hiddenInput}
                      value={rawDigits}
                      onFocus={()=> setInputFocused(true)}
                      onBlur={()=> setInputFocused(false)}
                      onChangeText={(txt)=>{
                        const cleaned = txt.replace(/[^0-9]/g,'');
                        setRawDigits(cleaned);
                        setMarkIncompleteRed(false);
                      }}
                      multiline
                      keyboardType="number-pad"
                      placeholder=""
                      selectionColor={isDarkMode ? '#6B7D8A' : '#B8C4B8'}
                    />
                  )}
                  <View style={styles.sideButtonsColumnNarrow}>
                    <Pressable style={[styles.sideActionBtnNarrow, isDarkMode && styles.sideActionBtnNarrowDark]} onPress={handlePaste}><Text style={styles.sideActionBtnNarrowText}>Pegar</Text></Pressable>
                    <Pressable style={[styles.sideActionBtnNarrow, styles.sideActionBtnNarrowClear, isDarkMode && styles.sideActionBtnNarrowDark]} onPress={()=>{handleClear(); setParleMode(false); setTokens([]);}}><Text style={styles.sideActionBtnNarrowText}>Limpiar</Text></Pressable>
                  </View>
                </Pressable>
                {/* Contador inferior eliminado; ahora se muestra en la cabecera */}
              </View>

              {/* Keypad + generación */}
              <View style={styles.keypadRowWrapper}>
                <View style={styles.keypadGridLeft}>
                  <View style={styles.keypadRow}>{[0,1,2,3,4].map(k => { const a = selectedDigits.includes(k); return (
                    <Pressable key={k} style={[styles.keyBtnSmall, a && styles.keyBtnSmallActive, isDarkMode && styles.keyBtnSmallDark, a && isDarkMode && styles.keyBtnSmallActiveDark]} onPress={()=>toggleDigit(k)}>
                      <Text style={[styles.keyBtnSmallText, a && styles.keyBtnSmallTextActive]}>{k}</Text>
                    </Pressable>); })}</View>
                  <View style={styles.keypadRow}>{[5,6,7,8,9].map(k => { const a = selectedDigits.includes(k); return (
                    <Pressable key={k} style={[styles.keyBtnSmall, a && styles.keyBtnSmallActive, isDarkMode && styles.keyBtnSmallDark, a && isDarkMode && styles.keyBtnSmallActiveDark]} onPress={()=>toggleDigit(k)}>
                      <Text style={[styles.keyBtnSmallText, a && styles.keyBtnSmallTextActive]}>{k}</Text>
                    </Pressable>); })}</View>
                </View>
                <View style={styles.genButtonsColumn}>
                  <Pressable style={[styles.genBtn, isDarkMode && styles.genBtnDark]} onPress={generarDecena}><Text style={styles.genBtnText}>➕ Decena</Text></Pressable>
                  <Pressable style={[styles.genBtn, isDarkMode && styles.genBtnDark]} onPress={generarTerminal}><Text style={styles.genBtnText}>➕ Terminal</Text></Pressable>
                </View>
              </View>

              {/* Toggle Centena/Terminal + Amarrar */}
              <View style={styles.parleRow}>
                <View style={styles.segmentButtonsMedium}>
                  {['decena','terminal'].map(m => (
                    <Pressable key={m} style={[styles.segmentBtnMedium, parleType===m && styles.segmentBtnMediumActive]} onPress={()=> setParleType(m)}>
                      <Text style={[styles.segmentBtnMediumText, parleType===m && styles.segmentBtnMediumTextActive]}>{m.charAt(0).toUpperCase()+m.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={[styles.amarrarMiniBtn, isDarkMode && styles.amarrarMiniBtnDark]} onPress={handleAmarrar}>
                  <Text style={styles.amarrarMiniBtnText}>Amarrar</Text>
                </Pressable>
                <Pressable style={[styles.amarrarMiniBtn, styles.combinarBtn, isDarkMode && styles.amarrarMiniBtnDark]} onPress={handleCombinarParleInterno}>
                  <Text style={styles.amarrarMiniBtnText}>Combinar Parle</Text>
                </Pressable>
                <Pressable disabled={parejasAdded} style={[styles.genBtnInline, parejasAdded && styles.genBtnDisabled, isDarkMode && styles.genBtnDark]} onPress={insertarTodasParejas}>
                  <Text style={styles.genBtnText}>{parejasAdded ? 'Parejas ✓' : '➕ Parejas'}</Text>
                </Pressable>
              </View>
            </ScrollView>

            <View style={styles.footerBar}>
              <Pressable style={[styles.footerBtnCancel, isDarkMode && styles.footerBtnCancelDark]} onPress={handleCancel}><Text style={styles.footerBtnCancelText}>Cancelar</Text></Pressable>
              <Pressable style={[styles.footerBtnInsert, isDarkMode && styles.footerBtnInsertDark]} onPress={handleInsertar}><Text style={styles.footerBtnInsertText}>Insertar ({parleMode ? tokens.length : displayTokens.filter(t=>t.length===2).length})</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
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
  buttonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    maxHeight: '92%',
    paddingTop: 14,
    paddingBottom: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E4EBE2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 12,
  },
  modalDark: {
    backgroundColor: '#2C3E50',
  },
  headerRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  headerLeft:{ flexDirection:'row', alignItems:'center' },
  headerIcon:{ fontSize:18, marginRight:6 },
  headerTitle:{ fontSize:15, fontWeight:'700', color:'#2D5016' },
  headerTitleDark:{ color:'#ECF0F1' },
  headerActions:{ flexDirection:'row', alignItems:'center' },
  // iconos de header eliminados excepto cerrar
  closeBtn:{ paddingVertical:6, paddingHorizontal:10, marginLeft:6, borderRadius:8, backgroundColor:'#FFE8E6', borderWidth:1, borderColor:'#F5B7B1' },
  closeBtnDark:{ backgroundColor:'#5D6D7E', borderColor:'#85929E' },
  closeBtnText:{ fontSize:14, fontWeight:'700', color:'#C0392B' },
  numbersListContainer: {
    marginBottom: 12,
  },
  block:{ marginBottom:14 },
  blockHeaderRow:{ flexDirection:'row', alignItems:'center', marginBottom:6 },
  blockTitle:{ fontSize:13, fontWeight:'700', color:'#2D5016', letterSpacing:0.5 },
  blockTitleDark:{ color:'#ECF0F1' },
  counter:{ marginLeft:8, fontSize:11, fontWeight:'600', color:'#1E8449', backgroundColor:'#E8F5E8', paddingHorizontal:6, paddingVertical:2, borderRadius:12 },
  counterDark:{ backgroundColor:'#34495E', color:'#58D68D' },
  // chips removidos
  sectionTitleDark: {
    color: '#ECF0F1',
  },
  keypadRowWrapper:{ flexDirection:'row', justifyContent:'flex-start', marginBottom:12 },
  keypadGridLeft:{},
  keypadRow:{ flexDirection:'row' },
  keyBtnSmall:{ width:42, height:42, margin:5, borderRadius:10, backgroundColor:'#FFFFFF', borderWidth:1, borderColor:'#D5E4D0', alignItems:'center', justifyContent:'center' },
  keyBtnSmallDark:{ backgroundColor:'#2E4053', borderColor:'#5D6D7E' },
  keyBtnSmallActive:{ backgroundColor:'#27AE60', borderColor:'#1E8449' },
  keyBtnSmallActiveDark:{ backgroundColor:'#229954', borderColor:'#1E8449' },
  keyBtnSmallText:{ fontSize:15, fontWeight:'600', color:'#2D5016' },
  keyBtnSmallTextActive:{ color:'#FFFFFF' },
  genButtonsColumn:{ marginLeft:12, justifyContent:'space-between' },
  genBtn:{ width:100, marginVertical:6, backgroundColor:'#F4F9F2', borderWidth:1, borderColor:'#D5E4D0', paddingVertical:10, borderRadius:10, alignItems:'center' },
  genBtnDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  genBtnDisabled:{ opacity:0.55 },
  genBtnInline:{ marginLeft:10, backgroundColor:'#F4F9F2', borderWidth:1, borderColor:'#D5E4D0', paddingVertical:10, paddingHorizontal:14, borderRadius:10, alignItems:'center' },
  genBtnText:{ fontSize:12, fontWeight:'700', color:'#2D5016' },
  multiInputContainer:{ borderWidth:1, borderColor:'#D5E4D0', borderRadius:10, backgroundColor:'#FFFFFF', padding:6, maxHeight:180 },
  multiInputContainerDark:{ backgroundColor:'#2E4053', borderColor:'#5D6D7E' },
  multiInputContainerError:{ borderColor:'#C0392B', backgroundColor:'#FFECEA' },
  multiInputContainerErrorDark:{ borderColor:'#E74C3C' },
  multiInput:{ minHeight:140, fontSize:12, color:'#2D5016' },
  multiInputDark:{ color:'#ECF0F1' },
  countLabel:{ marginTop:6, fontSize:11, color:'#566573' },
  countLabelDark:{ color:'#BDC3C7' },
  inlineCountLabel:{ marginLeft:10, fontSize:11, color:'#566573', fontWeight:'500' },
  inlineCountLabelDark:{ color:'#BDC3C7' },
  inputIconBtn:{ padding:6, borderRadius:8, backgroundColor:'#F1F5F0', marginHorizontal:4, borderWidth:1, borderColor:'#D5E4D0' },
  inputIconBtnDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  inputIconText:{ fontSize:16 },
  clearBtn:{ paddingVertical:6, paddingHorizontal:10, backgroundColor:'#FFEDEA', borderRadius:8, borderWidth:1, borderColor:'#F5C4BD', marginTop:6 },
  clearBtnDark:{ backgroundColor:'#5D6D7E', borderColor:'#85929E' },
  clearBtnText:{ fontSize:11, fontWeight:'600', color:'#C0392B' },
  inputSideButtons:{ position:'absolute', right:6, top:6, alignItems:'flex-end' },
  modesRow:{ flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 },
  modeGroup:{ flex:1, marginRight:8 },
  segmentButtons:{ flexDirection:'row', borderWidth:1, borderColor:'#D5E4D0', borderRadius:10, overflow:'hidden' },
  segmentBtn:{ flex:1, paddingVertical:8, backgroundColor:'#F4F9F2', alignItems:'center' },
  segmentBtnDark:{ backgroundColor:'#34495E' },
  segmentBtnActive:{ backgroundColor:'#27AE60' },
  segmentBtnActiveDark:{ backgroundColor:'#229954' },
  segmentBtnText:{ fontSize:11, fontWeight:'600', color:'#2D5016' },
  segmentBtnTextActive:{ color:'#FFFFFF' },
  amarrarInlineBtn:{ backgroundColor:'#F39C12', paddingVertical:12, paddingHorizontal:14, borderRadius:12, borderWidth:1, borderColor:'#E67E22', alignSelf:'flex-end', height:48, justifyContent:'center' },
  amarrarInlineBtnDark:{ backgroundColor:'#E67E22', borderColor:'#D35400' },
  amarrarInlineBtnText:{ fontSize:12, fontWeight:'700', color:'#FFFFFF' },
  combineBelowRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:22 },
  quickRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:26 },
  // togglePill & secondaryBtn estilos eliminados
  footerBar:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:8, borderTopWidth:1, borderTopColor:'#E4EBE2' },
  footerBtnCancel:{ flex:1, marginRight:8, backgroundColor:'#FFEDEA', paddingVertical:12, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#F5C4BD' },
  footerBtnCancelDark:{ backgroundColor:'#5D6D7E', borderColor:'#85929E' },
  footerBtnCancelText:{ fontSize:14, fontWeight:'600', color:'#C0392B' },
  footerBtnInsert:{ flex:1, marginLeft:8, backgroundColor:'#27AE60', paddingVertical:12, borderRadius:10, alignItems:'center', borderWidth:1, borderColor:'#229954' },
  footerBtnInsertDark:{ backgroundColor:'#229954', borderColor:'#1E8449' },
  footerBtnInsertText:{ fontSize:14, fontWeight:'700', color:'#FFFFFF' },
  scrollArea:{ flexGrow:1 },
  scrollContent:{ paddingBottom:28 },
  listInputContainer:{ flexDirection:'row', borderWidth:1, borderColor:'#D5E4D0', borderRadius:10, backgroundColor:'#FFFFFF', padding:8, minHeight:140, maxHeight:220 },
  listInputContainerDark:{ backgroundColor:'#2E4053', borderColor:'#5D6D7E' },
  listInputContainerDup:{ borderColor:'#F1C40F' },
  listInput:{ flex:1, fontSize:12, lineHeight:18, color:'#2D5016', paddingRight:8 },
  listInputDark:{ color:'#ECF0F1' },
  sideButtonsColumn:{ width:86, justifyContent:'flex-start' },
  sideActionBtn:{ width:'100%', paddingVertical:10, marginBottom:8, borderRadius:10, borderWidth:1, alignItems:'center', backgroundColor:'#F4F9F2', borderColor:'#D5E4D0' },
  sideActionBtnDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  sideActionBtnText:{ fontSize:11, fontWeight:'600', color:'#2D5016' },
  pasteBtn:{},
  clearBtnFull:{ backgroundColor:'#FFEDEA', borderColor:'#F5C4BD' },
  segmentButtonsLarge:{ flexDirection:'row', borderWidth:1, borderColor:'#D5E4D0', borderRadius:14, overflow:'hidden', height:54 },
  segmentBtnLarge:{ flex:1, backgroundColor:'#F4F9F2', alignItems:'center', justifyContent:'center' },
  segmentBtnLargeActive:{ backgroundColor:'#27AE60' },
  segmentBtnLargeText:{ fontSize:13, fontWeight:'700', color:'#2D5016' },
  segmentBtnLargeTextActive:{ color:'#FFFFFF' },
  amarrarCompactBtn:{ marginLeft:10, height:54, paddingHorizontal:18, backgroundColor:'#F39C12', borderRadius:14, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#E67E22' },
  amarrarCompactBtnDark:{ backgroundColor:'#E67E22', borderColor:'#D35400' },
  amarrarCompactBtnText:{ fontSize:12, fontWeight:'700', color:'#FFFFFF' },
  // Nueva edición lista
  tokensEditContainer:{ position:'relative', borderWidth:1, borderColor:'#D5E4D0', borderRadius:10, backgroundColor:'#FFFFFF', minHeight:180, maxHeight:210, padding:6, paddingRight:84 },
  tokensEditContainerDark:{ backgroundColor:'#2E4053', borderColor:'#5D6D7E' },
  tokensEditFocused:{ borderColor:'#A8C8A2' },
  tokensEditDup:{ borderColor:'#F1C40F' },
  transparentInput:{ position:'absolute', top:6, left:6, right:94, bottom:6, opacity:0, color:'transparent' },
  sideButtonsColumnNarrow:{ position:'absolute', top:6, right:6, width:70 },
  sideActionBtnNarrow:{ backgroundColor:'#F4F9F2', borderWidth:1, borderColor:'#D5E4D0', paddingVertical:9, borderRadius:10, marginBottom:8, alignItems:'center' },
  sideActionBtnNarrowDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  sideActionBtnNarrowClear:{ backgroundColor:'#FFEDEA', borderColor:'#F5C4BD' },
  sideActionBtnNarrowText:{ fontSize:10, fontWeight:'600', color:'#2D5016' },
  tokenTextDup:{ color:'#B7950B' },
  tokenTextIncompleteRed:{ color:'#C0392B' },
  segmentButtonsMedium:{ flexDirection:'row', borderWidth:1, borderColor:'#D5E4D0', borderRadius:10, overflow:'hidden', height:46 },
  segmentBtnMedium:{ flex:1, backgroundColor:'#F4F9F2', alignItems:'center', justifyContent:'center' },
  segmentBtnMediumActive:{ backgroundColor:'#27AE60' },
  segmentBtnMediumText:{ fontSize:12, fontWeight:'700', color:'#2D5016' },
  segmentBtnMediumTextActive:{ color:'#FFFFFF' },
  amarrarMiniBtn:{ marginLeft:8, height:46, paddingHorizontal:14, backgroundColor:'#F39C12', borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#E67E22', alignSelf:'flex-start' },
  amarrarMiniBtnDark:{ backgroundColor:'#E67E22', borderColor:'#D35400' },
  amarrarMiniBtnText:{ fontSize:11, fontWeight:'700', color:'#FFFFFF' },
  combinarBtn:{ marginLeft:10, backgroundColor:'#2980B9', borderColor:'#2471A3' },
  insertAllBtn:{ marginLeft:10, backgroundColor:'#16A085', borderColor:'#13856E' },
  tokensContainer:{ borderWidth:1, borderColor:'#D5E4D0', borderRadius:10, backgroundColor:'#FFFFFF', padding:8, minHeight:120, maxHeight:220, position:'relative' },
  tokensContainerDark:{ backgroundColor:'#2E4053', borderColor:'#5D6D7E' },
  tokensScroll:{ maxHeight:180 },
  tokensWrap:{ flexDirection:'row', flexWrap:'wrap', paddingRight:68 },
  token:{ backgroundColor:'#F4F9F2', borderWidth:1, borderColor:'#D5E4D0', paddingVertical:4, borderRadius:6, margin:3, width:44, alignItems:'center' }, // ajustado para 5 por fila
  tokenDup:{ backgroundColor:'#FFF9C4', borderColor:'#F7DC6F' },
  tokenParle:{ backgroundColor:'#D6EAF8', borderColor:'#85C1E9', width:44 },
  tokenText:{ fontSize:12, fontWeight:'600', color:'#2D5016' },
  // Evitar que la cápsula cambie de tamaño al editar (mantener mismo ancho/alto)
  tokenEditing:{
    backgroundColor:'#FFF4E0',
    borderColor:'#F5CBA7',
    width:44, // mismo que token
    minWidth:44,
    maxWidth:44,
    paddingVertical:0,
    justifyContent:'center'
  },
  parleEditInput:{
    fontSize:12,
    fontWeight:'600',
    color:'#2D5016',
    padding:0,
    margin:0,
    textAlign:'center',
    width:'100%',
    includeFontPadding:false, // Android: evita crecer vertical
    textAlignVertical:'center'
  },
  tokenParleInput:{ justifyContent:'center' },
  parleEntryInput:{ fontSize:12, fontWeight:'600', color:'#2D5016', textAlign:'center', padding:0, margin:0, width:'100%' },
  caretIndicator:{ width:8, alignItems:'center', justifyContent:'center', margin:4 },
  caretIndicatorText:{ fontSize:14, fontWeight:'700', color:'#2D5016' },
  placeholder:{ fontSize:12, color:'#9AA5A0', margin:4 },
  hiddenInput:{ position:'absolute', opacity:0, height:0, width:0 },
  parleRow:{ flexDirection:'row', alignItems:'center', justifyContent:'flex-start', marginBottom:10 },
  // combineBelowRowRight eliminado
  switchContainer: {
    marginBottom: 12,
  },
  switchGroup: {
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2D5016',
    marginBottom: 6,
  },
  switchLabelDark: {
    color: '#ECF0F1',
  },
  switchButtons: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  switchButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
  },
  switchButtonDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  switchButtonActive: {
    backgroundColor: '#E8F5E8',
  },
  switchButtonActiveDark: {
    backgroundColor: '#5D6D7E',
  },
  switchButtonText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '500',
  },
  switchButtonTextDark: {
    color: '#ECF0F1',
  },
  switchButtonTextActive: {
    fontWeight: '700',
    color: '#27AE60',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amarrarButton: {
    backgroundColor: '#F39C12',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E67E22',
  },
  amarrarButtonDark: {
    backgroundColor: '#E67E22',
    borderColor: '#D35400',
  },
  amarrarButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  amarrarButtonTextDark: {
    color: '#FFFFFF',
  },
  combineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  combineGroup: {
    flex: 1,
  },
  combineSwitch: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#B8D4A8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  combineSwitchDark: {
    backgroundColor: '#34495E',
    borderColor: '#5D6D7E',
  },
  combineSwitchActive: {
    backgroundColor: '#E8F5E8',
    borderColor: '#27AE60',
  },
  combineSwitchActiveDark: {
    backgroundColor: '#5D6D7E',
    borderColor: '#27AE60',
  },
  combineSwitchText: {
    fontSize: 12,
    color: '#2D5016',
    fontWeight: '500',
  },
  combineSwitchTextDark: {
    color: '#ECF0F1',
  },
  combineSwitchTextActive: {
    fontWeight: '700',
    color: '#27AE60',
  },
  // parejaButton estilos eliminados
  finalButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#C0392B',
  },
  cancelButtonDark: {
    backgroundColor: '#C0392B',
    borderColor: '#A93226',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cancelButtonTextDark: {
    color: '#FFFFFF',
  },
  insertButton: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flex: 1,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#229954',
  },
  insertButtonDark: {
    backgroundColor: '#229954',
    borderColor: '#1E8449',
  },
  insertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  insertButtonTextDark: {
    color: '#FFFFFF',
  },
});

export default HammerButton;
