import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet, Clipboard, Platform, Alert, ScrollView } from 'react-native';
import AnimatedModalWrapper from './AnimatedModalWrapper';

/**
 * CleanerButton (Botón Limpiar / Formatear)
 * Muestra un modal con:
 *  - Input multiline para pegar/escribir números crudos
 *  - Botón "Pegar y limpiar" que toma el portapapeles, extrae dígitos y los agrupa
 *  - 4 opciones: separar por comas, separar por asterisco, unir pares cercanos (parles), insertar (cierra e inserta)
 * Lógica:
 *  - Se extraen dígitos y se forman tokens de 2 dígitos (pares). Si sobra 1 dígito se mantiene como token parcial.
 *  - Unir pares: convierte tokens de 2 dígitos consecutivos en uno de 4 dígitos (parle) (parejas (0,1),(2,3),...). Sobra impar se ignora.
 */
const CleanerButton = ({ onInsert, append = true, isDarkMode=false }) => {
  const [visible, setVisible] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [tokens, setTokens] = useState([]); // tokens de 2 dígitos (y posible 1 dígito final)
  const [parles, setParles] = useState([]); // resultado de unir pares
  const [separator, setSeparator] = useState(','); // ',' o '*'
  const [usedParles, setUsedParles] = useState(false);

  const extractTokens = (text) => {
    const digits = text.replace(/[^0-9]/g,'');
    const t=[];
    for (let i=0;i<digits.length;i+=2){ t.push(digits.slice(i,i+2)); }
    return t; // último puede tener 1 dígito
  };

  const syncFromRaw = (text) => {
    const cleaned = text.replace(/[^0-9,.*\s]/g,'');
    if(cleaned === rawInput) return; // evitar renders innecesarios
    setRawInput(cleaned);
    setTokens(extractTokens(cleaned));
    // No reiniciar parles aquí para evitar parpadeo
  };

  const handlePasteClean = async () => {
    try {
      let text='';
      if (Platform.OS==='web' && navigator.clipboard?.readText) text = await navigator.clipboard.readText(); else text = await Clipboard.getString();
      if(!text){ return; }
      const cleaned = text.replace(/[^0-9,.*\s]/g,'');
      syncFromRaw(cleaned);
    } catch(e){ Alert.alert('Error','No se pudo pegar'); }
  };

  const applyFormattedToInput = (items, sep) => {
    const joined = items.join(sep);
    setRawInput(joined);
  };
  const handleSeparateComas = () => {
    setSeparator(',');
    const base = usedParles && parles.length ? parles : tokens.filter(t=> t.length===2);
    applyFormattedToInput(base, ',');
  };
  const handleSeparateAsterisk = () => {
    setSeparator('*');
    const base = usedParles && parles.length ? parles : tokens.filter(t=> t.length===2);
    applyFormattedToInput(base, '*');
  };

  const handleUnirPares = () => {
    // Unir TODOS los pares de dos dígitos de izquierda a derecha en un solo paso.
    // Si quedan al final un par (2 dígitos) y un dígito suelto => formar token de 3 dígitos.
    const fullPairs = tokens.filter(t=> t.length===2);
    if (!fullPairs.length) { Alert.alert('Vacío','No hay pares disponibles'); return; }
    const singleTail = tokens.find(t=> t.length===1) || null;
    const resultado = [];
    for (let i=0; i+1<fullPairs.length; i+=2) {
      resultado.push(fullPairs[i] + fullPairs[i+1]);
    }
    // Manejo de sobrante
    if (fullPairs.length % 2 === 1) {
      const leftoverPair = fullPairs[fullPairs.length-1];
      if (singleTail) {
        resultado.push(leftoverPair + singleTail); // 3 dígitos final (ej: 91 + 2 => 912)
      } else {
        // Sin dígito suelto, mantener el par tal cual (2 dígitos)
        resultado.push(leftoverPair);
      }
    } else if (!fullPairs.length && singleTail) {
      // Caso raro: sólo un dígito suelto
      resultado.push(singleTail);
    }
  setParles(resultado);
  setUsedParles(true);
  // aplicar directamente al input usando separador actual
  const sep = separator;
  setRawInput(resultado.join(sep));
  };

  const buildFormatted = () => {
    if (usedParles && parles.length) return parles.join(separator);
    const fullPairs = tokens.filter(t=> t.length===2);
    return fullPairs.join(separator);
  };

  const handleInsert = () => {
    const formatted = buildFormatted();
    if(!formatted){ Alert.alert('Vacío','No hay números para insertar'); return; }
    onInsert && onInsert(formatted, { append });
    // limpiar y cerrar
    setVisible(false);
    setRawInput('');
  setTokens([]); setParles([]); setUsedParles(false); setSeparator(',');
  };

  return (
    <>
      <Pressable style={({pressed})=> [styles.button, pressed && styles.buttonPressed, isDarkMode && styles.buttonDark]} onPress={()=> setVisible(true)}>
        <Text style={styles.buttonIcon}>🧹</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="none" onRequestClose={()=> setVisible(false)}>
        <View style={styles.overlay}>
          <AnimatedModalWrapper visible={visible} scaleFrom={0.9} duration={180}>
            <View style={[styles.modal, isDarkMode && styles.modalDark]}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, isDarkMode && styles.headerTitleDark]}>Limpiar</Text>
                <Pressable style={styles.closeBtn} onPress={()=> setVisible(false)}><Text style={styles.closeBtnText}>✕</Text></Pressable>
              </View>
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={rawInput}
                    onChangeText={syncFromRaw}
                    multiline
                    placeholder="Pega o escribe números"
                    placeholderTextColor={isDarkMode ? '#7A858C' : '#9AA5A0'}
                    style={[styles.textArea, isDarkMode && styles.textAreaDark]}
                  />
                  <View style={styles.inlineButtonsBox}>
                    <Pressable style={styles.inlineSmallBtn} onPress={handlePasteClean}><Text style={styles.inlineSmallBtnTxt}>Pegar</Text></Pressable>
                    <Pressable style={styles.inlineSmallBtn} onPress={()=> { setRawInput(''); setTokens([]); setParles([]); setUsedParles(false); }}><Text style={[styles.inlineSmallBtnTxt,{color:'#1565C0'}]}>Limpiar</Text></Pressable>
                  </View>
                </View>
                <View style={styles.optionsRow}>
                  <Pressable style={[styles.optBtn, separator===',' && styles.optBtnActive]} onPress={handleSeparateComas}><Text style={styles.optBtnText}>Comas</Text></Pressable>
                  <Pressable style={[styles.optBtn, separator==='*' && styles.optBtnActive]} onPress={handleSeparateAsterisk}><Text style={styles.optBtnText}>Asterisco</Text></Pressable>
                  <Pressable style={[styles.optBtn, usedParles && styles.optBtnActive]} onPress={handleUnirPares}><Text style={styles.optBtnText}>Unir pares</Text></Pressable>
                  <Pressable style={[styles.optBtn, styles.insertBtn]} onPress={handleInsert}><Text style={[styles.optBtnText, styles.insertBtnText]}>Insertar</Text></Pressable>
                </View>
              </ScrollView>
            </View>
          </AnimatedModalWrapper>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button:{
    width:40,height:40,borderRadius:20,backgroundColor:'#FFFFFF',borderWidth:1.5,borderColor:'#B8D4A8',alignItems:'center',justifyContent:'center',shadowColor:'#2D5016',shadowOffset:{width:0,height:2},shadowOpacity:0.1,shadowRadius:3,elevation:3
  },
  buttonPressed:{ opacity:0.7, transform:[{scale:0.95}] },
  buttonDark:{ backgroundColor:'#34495E', borderColor:'#5D6D7E' },
  buttonIcon:{ fontSize:18 },
  overlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.35)', padding:20, justifyContent:'center', alignItems:'flex-end' },
  modal:{ backgroundColor:'#FFFFFF', borderRadius:18, padding:18, maxHeight:'88%' },
  modalDark:{ backgroundColor:'#22313F' },
  headerRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  headerTitle:{ fontSize:18, fontWeight:'700', color:'#2D5016' },
  headerTitleDark:{ color:'#ECF0F1' },
  closeBtn:{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:'#F2F5F2', borderWidth:1, borderColor:'#D5DBDB' },
  closeBtnDark:{ backgroundColor:'#2E3B47', borderColor:'#3F4B55' },
  closeBtnText:{ fontSize:14, fontWeight:'600', color:'#2C3E50' },
  scroll:{ marginTop:4 },
  scrollContent:{ paddingBottom:30 },
  textArea:{ minHeight:120, borderWidth:1.5, borderColor:'#D5DBDB', borderRadius:10, padding:10, paddingTop:34, fontSize:15, backgroundColor:'#FFFFFF', textAlignVertical:'top', color:'#2C3E50' },
  textAreaDark:{ backgroundColor:'#2E3B47', borderColor:'#3F4B55', color:'#ECF0F1' },
  inputWrapper:{ position:'relative', marginTop:4 },
  inlineButtonsBox:{ position:'absolute', top:4, right:6, flexDirection:'row', gap:6 },
  inlineSmallBtn:{ backgroundColor:'#F2F5F2', paddingHorizontal:10, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:'#D5DBDB' },
  inlineSmallBtnTxt:{ fontSize:12, fontWeight:'600', color:'#2C3E50' },
  optionsRow:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:14 },
  optBtn:{ paddingHorizontal:12, paddingVertical:10, borderRadius:10, backgroundColor:'#F2F5F2', borderWidth:1, borderColor:'#D5DBDB' },
  optBtnActive:{ backgroundColor:'#FFE4B5', borderColor:'#D4AF37' },
  optBtnText:{ fontSize:13, fontWeight:'600', color:'#2C3E50' },
  insertBtn:{ backgroundColor:'#2D5016', borderColor:'#2D5016' },
  insertBtnText:{ color:'#FFFFFF' },
  headerCleanBtn:{ paddingHorizontal:14, paddingVertical:6 },
  headerCleanBtnText:{ fontSize:14, fontWeight:'600', color:'#1565C0' }
});

export default CleanerButton;
