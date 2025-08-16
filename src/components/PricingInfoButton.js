import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';
import { t } from '../utils/i18n';

// Botón que muestra la configuración de precios (id_precio) asignada al listero
// Obtiene el id_precio del perfil del usuario actual y luego la fila de precio
// Muestra cada jugada en MAYÚSCULAS con limited, regular, listeroPct, colectorPct
const PricingInfoButton = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [precioRow, setPrecioRow] = useState(null); // { nombre, precios }
  const [limits, setLimits] = useState(null); // limite_especifico

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error('Usuario no autenticado');
      const { data: profile, error: pErr } = await supabase.from('profiles').select('id_precio, limite_especifico').eq('id', user.id).maybeSingle();
      if (pErr) throw pErr;
      setLimits(profile?.limite_especifico || null);
      if (profile?.id_precio) {
        const { data: row, error: rErr } = await supabase.from('precio').select('nombre,precios').eq('id', profile.id_precio).maybeSingle();
        if (rErr) throw rErr;
        setPrecioRow(row || null);
      } else {
        setPrecioRow(null);
      }
    } catch(e){
      setError(e.message || 'Error cargando configuración');
    } finally {
      setLoading(false);
    }
  }, []);

  const open = () => { setVisible(true); loadData(); };
  const close = () => { setVisible(false); };

  const renderContent = () => {
    if (loading) return <ActivityIndicator size="large" color="#2D5016" style={{ marginVertical: 20 }} />;
    if (error) return <Text style={styles.errorText}>{error}</Text>;
  if (!precioRow) return <Text style={styles.infoText}>{t('pricing.noConfig')}</Text>;
    const precios = precioRow.precios || {};
    const entries = Object.entries(precios);
  if (!entries.length) return <Text style={styles.infoText}>{t('pricing.emptyConfig')}</Text>;
    // Orden canónico
    const ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];
    const orderedEntries = ORDER.filter(k=> precios[k]).map(k=> [k, precios[k]]);
    return (
      <View>
        <Text style={styles.configName}>Ganancias por Jugada</Text>
        <View style={styles.grid}>
          {orderedEntries.map(([tipo, obj]) => {
            const limited = obj?.limited ?? '-';
            const regular = obj?.regular ?? '-';
            const lPct = obj?.listeroPct ?? '-';
            return (
              <View key={tipo} style={styles.playCard}>
                <Text style={styles.playType}>{tipo.charAt(0).toUpperCase()+tipo.slice(1)}</Text>
                <Text style={styles.inlineDetail}><Text style={styles.inlineLabel}>Precio regular:</Text> {regular}</Text>
                <Text style={styles.inlineDetail}><Text style={styles.inlineLabel}>Precio limitado:</Text> {limited}</Text>
                <Text style={styles.inlineDetail}><Text style={styles.inlineLabel}>Porciento listero:</Text> {lPct}%</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.limitsBlock}>
          <Text style={styles.limitsTitle}>Límites Específicos</Text>
          {!limits || Object.keys(limits).length===0 ? (
            <Text style={styles.noLimits}>No tiene límites específicos.</Text>
          ) : (
            <View style={styles.limitsGrid}>
              {['fijo','corrido','posicion','parle','centena','tripleta'].filter(k=> limits[k] !== undefined).map(k => (
                <View key={k} style={styles.limitCard}>
                  <Text style={styles.limitPlay}>{k.toUpperCase()}</Text>
                  <Text style={styles.limitValue}>{limits[k]}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={open}
      >
        <Text style={styles.icon}>ℹ️</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>{renderContent()}</ScrollView>
            <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]} onPress={close}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#B8D4A8', alignItems: 'center', justifyContent: 'center', elevation: 3,
  },
  buttonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  icon: { fontSize: 18 },
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16 },
  modal: { backgroundColor:'#fff', borderRadius:16, width:'100%', maxWidth:420, maxHeight:'80%', padding:20 },
  configName: { fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:12, color:'#2C3E50' },
  grid: { flexDirection:'row', flexWrap:'wrap', marginHorizontal:-6 },
  playCard: { width:'50%', padding:8, paddingBottom:10, backgroundColor:'#FFFFFF', borderRadius:10, borderWidth:1, borderColor:'#E2E8E5', shadowColor:'#000', shadowOpacity:0.03, shadowOffset:{width:0,height:1}, shadowRadius:2, marginBottom:12, paddingHorizontal:10 },
  playType: { fontSize:14, fontWeight:'700', color:'#2D5016', marginBottom:4 },
  inlineDetail: { fontSize:11, color:'#34495E', marginBottom:2, lineHeight:14 },
  inlineLabel: { fontWeight:'600', color:'#4a5b4f' },
  limitsBlock: { marginTop:16, paddingTop:12, borderTopWidth:1, borderTopColor:'#E2E8E5' },
  limitsTitle: { fontSize:16, fontWeight:'700', color:'#2C3E50', marginBottom:10 },
  noLimits: { fontSize:13, color:'#566573', fontStyle:'italic' },
  limitsGrid: { flexDirection:'row', flexWrap:'wrap', marginHorizontal:-4 },
  limitCard: { width:'33.33%', padding:6, backgroundColor:'#F4F9F2', borderRadius:8, borderWidth:1, borderColor:'#E0E6E0', marginBottom:8, paddingHorizontal:8 },
  limitPlay: { fontSize:11, fontWeight:'700', color:'#2D5016', marginBottom:2 },
  limitValue: { fontSize:12, fontWeight:'600', color:'#1d6fd1' },
  closeButton: { marginTop:12, backgroundColor:'#2D5016', paddingVertical:10, borderRadius:8, alignItems:'center' },
  closeButtonPressed: { opacity:0.8 },
  closeText: { color:'#fff', fontSize:16, fontWeight:'600' },
  infoText: { fontSize:14, color:'#34495E', textAlign:'center', marginVertical:12 },
  errorText: { fontSize:14, color:'#C0392B', textAlign:'center', marginVertical:12 },
});

export default PricingInfoButton;
