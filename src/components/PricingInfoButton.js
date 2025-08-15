import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';

// Botón que muestra la configuración de precios (id_precio) asignada al listero
// Obtiene el id_precio del perfil del usuario actual y luego la fila de precio
// Muestra cada jugada en MAYÚSCULAS con limited, regular, listeroPct, colectorPct
const PricingInfoButton = () => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [precioRow, setPrecioRow] = useState(null); // { nombre, precios }

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error('Usuario no autenticado');
      const { data: profile, error: pErr } = await supabase.from('profiles').select('id_precio').eq('id', user.id).maybeSingle();
      if (pErr) throw pErr;
      if (!profile?.id_precio) { setPrecioRow(null); return; }
      const { data: row, error: rErr } = await supabase.from('precio').select('nombre,precios').eq('id', profile.id_precio).maybeSingle();
      if (rErr) throw rErr;
      setPrecioRow(row || null);
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
    if (!precioRow) return <Text style={styles.infoText}>Sin configuración asignada.</Text>;
    const precios = precioRow.precios || {};
    const entries = Object.entries(precios);
    if (!entries.length) return <Text style={styles.infoText}>Configuración vacía.</Text>;
    return (
      <View>
        <Text style={styles.configName}>{precioRow.nombre}</Text>
        {entries.map(([tipo, obj]) => {
          const limited = obj?.limited ?? '-';
          const regular = obj?.regular ?? '-';
          const lPct = obj?.listeroPct ?? '-';
          const cPct = obj?.collectorPct ?? '-';
          return (
            <View key={tipo} style={styles.playRow}>
              <Text style={styles.playType}>{tipo.toUpperCase()}</Text>
              <Text style={styles.detailText}>LIMITED: {limited}</Text>
              <Text style={styles.detailText}>REGULAR: {regular}</Text>
              <Text style={styles.detailText}>LISTER0%: {lPct}%</Text>
              <Text style={styles.detailText}>COLECTOR%: {cPct}%</Text>
            </View>
          );
        })}
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
              <Text style={styles.closeText}>Cerrar</Text>
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
  playRow: { marginBottom:12, padding:10, backgroundColor:'#F4F9F2', borderRadius:8, borderWidth:1, borderColor:'#E0E6E0' },
  playType: { fontSize:14, fontWeight:'700', color:'#2D5016', marginBottom:4 },
  detailText: { fontSize:12, color:'#34495E' },
  closeButton: { marginTop:12, backgroundColor:'#2D5016', paddingVertical:10, borderRadius:8, alignItems:'center' },
  closeButtonPressed: { opacity:0.8 },
  closeText: { color:'#fff', fontSize:16, fontWeight:'600' },
  infoText: { fontSize:14, color:'#34495E', textAlign:'center', marginVertical:12 },
  errorText: { fontSize:14, color:'#C0392B', textAlign:'center', marginVertical:12 },
});

export default PricingInfoButton;
