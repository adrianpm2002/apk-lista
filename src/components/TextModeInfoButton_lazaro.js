import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, ScrollView } from 'react-native';

const TextModeInfoButton = ({ icon='ℹ️', mode='texto' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
  <Text style={styles.btnTxt}>{icon}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={()=> setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{mode==='texto2' ? 'Modo Texto 2.0 - Instrucciones' : 'Modo Texto - Instrucciones'}</Text>
              <Pressable onPress={()=> setOpen(false)}><Text style={styles.close}>✕</Text></Pressable>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {mode==='texto2' ? (
                <>
                  <Text style={styles.sectionTitle}>Sintaxis con "con"</Text>
                  <Text style={styles.line}>- Forma: [números] con [monto y comandos]</Text>
                  <Text style={styles.line}>- Separadores de números: espacios, comas, puntos</Text>
                  <Text style={styles.line}>- No mezclar longitudes en la misma línea</Text>
                  <Text style={styles.sectionTitle}>Tipos por longitud</Text>
                  <Text style={styles.line}>- 2 dígitos: fijo (f), corrido (c), parle por pares (p) o repartido (can)</Text>
                  <Text style={styles.line}>- 3 dígitos: centena (monto sin sufijo)</Text>
                  <Text style={styles.line}>- 4 dígitos: parle directo (monto sin sufijo) o con p/can</Text>
                  <Text style={styles.line}>- 6 dígitos: tripleta (monto sin sufijo)</Text>
                  <Text style={styles.sectionTitle}>Comandos</Text>
                  <Text style={styles.line}>- f: monto por número fijo (2d)</Text>
                  <Text style={styles.line}>- c: monto por número corrido (2d)</Text>
                  <Text style={styles.line}>- p: parle por combinación (2d o 4d)</Text>
                  <Text style={styles.line}>- can: parle repartido entre todas las combinaciones</Text>
                  <Text style={styles.sectionTitle}>Comando de centena</Text>
                  <Text style={styles.line}>- c4x25.23  → 425, 423</Text>
                  <Text style={styles.line}>- c4*d5     → 450,451,...,459</Text>
                  <Text style={styles.line}>- c4xt5     → 405,415,...,495</Text>
                  <Text style={styles.line}>- c4xp      → 400,411,422,...,499</Text>
                  <Text style={styles.sectionTitle}>Ejemplos</Text>
                  <Text style={styles.line}>12 25 30 con 5f 3c</Text>
                  <Text style={styles.line}>12 25 30 con 100p</Text>
                  <Text style={styles.line}>12 25 30 con 100can</Text>
                  <Text style={styles.line}>123 555 con 20</Text>
                  <Text style={styles.line}>1225 3099 con 15</Text>
                  <Text style={styles.line}>c4x25.23 con 10</Text>
                </>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>Sintaxis Básica</Text>
                  <Text style={styles.line}>1) 2 dígitos fijo/corrido:  12 25 30 -5-3</Text>
                  <Text style={styles.line}>   Primer monto = fijo, segundo = corrido (puede omitirse)</Text>
                  <Text style={styles.line}>   12 25 30 -5   (solo fijo)</Text>
                  <Text style={styles.line}>   12 25 30 -0-4 (solo corrido)</Text>
                  <Text style={styles.line}>2) Centenas (3 dígitos): 123 555 -10</Text>
                  <Text style={styles.line}>3) Parles directos (4 dígitos): 1225 3099 -15</Text>
                  <Text style={styles.line}>4) Tripletas (6 dígitos): 123456 112233 -20</Text>
                  <Text style={styles.line}>5) Parle combinatorio: 12*25*30*65 -100</Text>
                  <Text style={styles.line}>   Genera todas las combinaciones de 2 en 2.</Text>
                  <Text style={styles.line}>   Candado abierto: cada combinación usa el monto completo.</Text>
                  <Text style={styles.line}>   Candado cerrado: reparte el monto entre todas.</Text>
                  <Text style={styles.sectionTitle}>Reglas</Text>
                  <Text style={styles.line}>- Separador de montos: guiones '-'</Text>
                  <Text style={styles.line}>- Usa espacio, coma o punto para separar números.</Text>
                  <Text style={styles.line}>- No mezclar longitudes en la misma línea.</Text>
                  <Text style={styles.line}>- Montos {'>'} 0 (excepto fijo/corrido donde uno puede ser 0).</Text>
                  <Text style={styles.line}>- Ambos 0 en fijo/corrido = error.</Text>
                  <Text style={styles.line}>- Duplicados resaltados en amarillo.</Text>
                  <Text style={styles.sectionTitle}>Ejemplos</Text>
                  <Text style={styles.line}>05 10 25 -5-3</Text>
                  <Text style={styles.line}>14 22 90 -10</Text>
                  <Text style={styles.line}>14 22 90 -0-4</Text>
                  <Text style={styles.line}>123 555 -20</Text>
                  <Text style={styles.line}>1225 3099 -15</Text>
                  <Text style={styles.line}>12*25*30 -90</Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btn: {
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
  btnPressed: { opacity:0.7, transform:[{ scale:0.95 }] },
  btnTxt: { fontSize:20 },
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', padding:24, justifyContent:'center' },
  modal: { backgroundColor:'#FFFFFF', borderRadius:14, padding:18, borderWidth:1, borderColor:'#B8D4A8', shadowColor:'#000', shadowOffset:{ width:0,height:4 }, shadowOpacity:0.15, shadowRadius:8, elevation:6 },
  headerRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  title: { fontSize:18, fontWeight:'700', color:'#2D5016' },
  close: { fontSize:18, fontWeight:'700', color:'#C0392B', paddingHorizontal:6 },
  sectionTitle:{ marginTop:10, fontSize:14, fontWeight:'700', color:'#2D5016' },
  line:{ fontSize:13, color:'#2D5016', marginTop:4 },
});

export default TextModeInfoButton;
