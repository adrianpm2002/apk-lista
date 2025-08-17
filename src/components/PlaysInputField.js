// Implementación limpia y única del campo de jugadas con scroll nativo (sin overlays complicados)
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Clipboard } from 'react-native';

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
  const [txt, setTxt] = useState(value || '');
  useEffect(() => { setTxt(value || ''); }, [value]);
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

  const pad = (n) => (reqLen && n.length === 1 && reqLen >= 2 ? '0' + n : n);

  // Formatea mientras escribe: agrupa full-length y deja parcial al final
  const formatInput = (raw) => {
    if (!reqLen) return raw.replace(/[^0-9]/g, '');
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return '';
    const full = Math.floor(digits.length / reqLen) * reqLen;
    const groups = [];
    for (let i = 0; i < full; i += reqLen) groups.push(pad(digits.slice(i, i + reqLen)));
    const partial = digits.slice(full);
    return partial ? (groups.length ? groups.join(', ') + ', ' + partial : partial) : groups.join(', ');
  };

  const handleChange = (val) => {
    const f = formatInput(val);
    setTxt(f);
    onChangeText && onChangeText(f);
  };

  // Al salir: rellena ceros donde aplique
  const handleBlur = () => {
    if (!reqLen) return;
    const parts = txt.split(/[,*\s-]+/).filter(p => p.trim() !== '');
    const final = parts.map(p => {
      const d = p.replace(/[^0-9]/g, '');
      return d.length === reqLen ? pad(d) : d; // deja parcial si quedó incompleto (lo verá como "Incompleto")
    }).join(', ');
    setTxt(final);
    onChangeText && onChangeText(final);
  };

  const handlePaste = async () => {
    try {
      let clip = '';
      if (Platform.OS === 'web' && navigator.clipboard?.readText) clip = await navigator.clipboard.readText();
      else clip = await Clipboard.getString();
      if (!clip) return;
      handleChange(txt ? txt + ', ' + clip : clip);
    } catch (e) { }
  };
  const handleClear = () => { setTxt(''); onChangeText && onChangeText(''); };

  // Re-formatear automáticamente cuando cambia la longitud requerida (cambio de modo)
  useEffect(() => {
    if (reqLen) {
      setTxt(prev => {
        const formatted = formatInput(prev);
        if (formatted !== prev) onChangeText && onChangeText(formatted);
        return formatted;
      });
    } else {
      // Sin modo: mostrar sólo dígitos sin comas
      setTxt(prev => {
        const raw = prev.replace(/[^0-9]/g, '');
        if (raw !== prev) onChangeText && onChangeText(raw);
        return raw;
      });
    }
  }, [reqLen]);

  // Análisis
  const parts = txt.split(/[,*\s-]+/).filter(p => p.trim() !== '');
  const clean = parts.map(p => p.replace(/[^0-9]/g, ''));
  const full = reqLen ? clean.filter(c => c.length === reqLen) : [];
  const last = clean[clean.length - 1] || '';
  const incomplete = reqLen && last && last.length > 0 && last.length < reqLen;
  const dup = (() => { if (!reqLen) return []; const c = {}; full.forEach(g => c[g] = (c[g] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); })();
  const comboCF = selectedPlayTypes.includes('centena') && selectedPlayTypes.includes('fijo');
  const dupFijos = (() => { if (!comboCF) return []; const c = {}; full.map(g => g.slice(-2)).forEach(v => c[v] = (c[v] || 0) + 1); return Object.keys(c).filter(k => c[k] > 1); })();
  // Mensajes / métricas
  const totalMsg = reqLen ? `Total: ${full.length}` : '';
  const dupCount = dup.length;
  const fijoDupCount = dupFijos.length; // se mantiene por si se quiere mostrar luego

  // Para resaltar duplicados usamos una capa superpuesta solo si hay duplicados
  const showOverlay = multiline && (dup.length > 0);

  const splitTokens = txt.split(/([,\s]+)/); // preserva separadores

  return (
    <View style={styles.container}>
      {label && !pasteButtonOverlay && (
        <View style={styles.headerRow}>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>{label}</Text>
          {showPasteButton && (
            <Pressable onPress={handlePaste} style={[styles.pasteBtn, isDarkMode && styles.pasteBtnDark]}>
              <Text style={[styles.pasteBtnText, isDarkMode && styles.pasteBtnTextDark]}>Pegar</Text>
            </Pressable>
          )}
        </View>
      )}
      {label && pasteButtonOverlay && <Text style={[styles.label, isDarkMode && styles.labelDark]}>{label}</Text>}
      <View style={styles.inputBox}>
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            pasteButtonOverlay && showPasteButton && styles.inputPadRight,
            isDarkMode && styles.inputDark,
            hasError && styles.inputError,
            showOverlay && styles.inputTransparentText,
          ]}
          multiline={multiline}
          scrollEnabled={multiline}
          value={txt}
          onChangeText={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={isDarkMode ? '#7F8C8D' : '#95A5A6'}
          keyboardType='number-pad'
          autoCorrect={false}
        />
        {showOverlay && (
          <View pointerEvents='none' style={styles.overlayTextLayer}>
            <Text style={[styles.overlayFlow, isDarkMode && styles.overlayFlowDark]}>
              {splitTokens.map((chunk, i) => {
                const clean = chunk.replace(/[^0-9]/g, '');
                const isDup = dup.includes(clean) && clean.length === reqLen;
                if (isDup) {
                  return <Text key={i} style={styles.duplicateYellow}>{chunk}</Text>;
                }
                return <Text key={i}>{chunk}</Text>;
              })}
            </Text>
          </View>
        )}
        {pasteButtonOverlay && showPasteButton && (
          <>
            <Pressable onPress={handlePaste} style={[styles.overlayBtn, styles.overlayBtnTop, isDarkMode && styles.overlayBtnDark]}><Text style={styles.overlayIcon}>📋</Text></Pressable>
            <Pressable onPress={handleClear} style={[styles.overlayBtn, styles.overlayBtnBottom, isDarkMode && styles.overlayBtnDark]}><Text style={styles.overlayIcon}>🧹</Text></Pressable>
          </>
        )}
      </View>
      <View style={styles.metaRow}>
        {!!totalMsg && <Text style={styles.metaText}>{totalMsg}</Text>}
        {dupCount > 0 && (
          <Text style={[styles.metaText, styles.metaDuplicate]}>({`Duplicados: ${dupCount}`})</Text>
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
  inputBox: { position: 'relative' },
  input: { borderWidth: 1.5, borderColor: '#D5DBDB', borderRadius: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: '#2C3E50', minHeight: 54 },
  inputDark: { backgroundColor: '#34495E', borderColor: '#5D6D7E', color: '#ECF0F1' },
  // Altura fija reducida (antes 140)
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  inputPadRight: { paddingRight: 70 },
  inputError: { borderColor: '#E74C3C' },
  overlayBtn: { position: 'absolute', right: 8, backgroundColor: '#E8F5E8', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#B8D4A8' },
  overlayBtnDark: { backgroundColor: '#2C3E50', borderColor: '#5D6D7E' },
  overlayBtnTop: { top: 8 },
  overlayBtnBottom: { top: 60 },
  overlayIcon: { fontSize: 16 },
  inputTransparentText:{ color:'transparent' },
  overlayTextLayer:{ position:'absolute', left:12, right:12, top:12, bottom:12 },
  overlayFlow:{ flexWrap:'wrap', flexDirection:'row', flexShrink:1, color:'#2C3E50' },
  overlayFlowDark:{ color:'#ECF0F1' },
  duplicateYellow:{ fontWeight:'700', color:'#F1C40F' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  metaText: { fontSize: 11, marginRight: 12, marginVertical: 2, color: '#566573' },
  metaIssue: { fontWeight: '700' },
  metaDuplicate: { fontWeight: '700', color: '#F1C40F' },
  metaIncomplete: { fontWeight: '700', color: '#E74C3C' },
});

export default PlaysInputField;
