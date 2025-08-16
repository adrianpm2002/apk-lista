import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';

import { supabase } from '../supabaseClient';

const JUGADA_ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];

const InfoButton = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [limits, setLimits] = useState(null); // objeto limite_especifico
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [numberLimits, setNumberLimits] = useState([]); // filas de limite_numero
  const [bankId, setBankId] = useState(null);

  // Cargar id_banco al montar (para poder traer limite_numero)
  useEffect(()=>{
    const loadBank = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) return;
        const { data: profile } = await supabase.from('profiles').select('id_banco, role').eq('id', user.id).maybeSingle();
        if(profile){
          const bId = profile.role === 'admin' ? user.id : profile.id_banco;
          setBankId(bId);
        }
      } catch(e){ /* ignore */ }
    };
    loadBank();
  },[]);

  const infoSections = [
    {
      title: 'Tipos de Jugadas',
      items: [
        'Fijo: Número exacto',
        'Corrido: Número en cualquier posición',
        'Posición: Número en posición específica',
        'Parle: Combinación de 2 números',
        'Centena: 3 dígitos',
        'Tripleta: 6 dígitos (combinación larga)'
      ]
    },
    {
      title: 'Instrucciones Rápidas',
      items: [
        'Seleccione lotería y horario abiertos',
        'Elija tipos de jugada permitidos',
        'Ingrese números separados por coma o espacio',
        'Verifique antes de insertar para evitar errores'
      ]
    }
  ];

  const loadLimits = useCallback( async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error('Sin usuario');
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('limite_especifico')
        .eq('id', user.id)
        .maybeSingle();
      if (pErr) throw pErr;
      setLimits(profile?.limite_especifico || null);
      // Cargar límites por número si tenemos bankId
      if(bankId){
        const { data: rows, error: lErr } = await supabase
          .from('limite_numero')
          .select('numero, limite, jugada, id_horario')
          .eq('id_banco', bankId)
          .order('jugada', { ascending: true })
          .order('numero', { ascending: true });
        if(lErr) throw lErr;
        setNumberLimits(rows||[]);
      } else {
        setNumberLimits([]);
      }
    } catch(e){
      setError(e.message || 'Error cargando límites');
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  // Re-cargar límites numéricos cuando cambie bankId y el modal esté visible
  useEffect(()=>{
    if(isVisible) loadLimits();
  },[bankId, isVisible, loadLimits]);

  const handleClose = () => {
    setIsVisible(false);
    onClose && onClose();
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
  onPress={() => { setIsVisible(true); loadLimits(); }}
      >
        <Text style={styles.buttonIcon}>i</Text>
      </Pressable>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>Información</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Límites Específicos</Text>
                {loading && <Text style={styles.infoText}>Cargando límites...</Text>}
                {error && <Text style={[styles.infoText, {color:'#c0392b'}]}>{error}</Text>}
                {!loading && !error && (!limits || Object.keys(limits).length===0) && (
                  <Text style={styles.infoText}>No tiene límites específicos.</Text>
                )}
                {!loading && !error && limits && Object.keys(limits).length>0 && (
                  JUGADA_ORDER.filter(k => limits[k] !== undefined).map(k => (
                    <View key={k} style={styles.limitRow}>
                      <Text style={styles.limitPlay}>{k.toUpperCase()}</Text>
                      <Text style={styles.limitValue}>{limits[k]}</Text>
                    </View>
                  ))
                )}

                {/* Sección adicional: números limitados y límites por número */}
                {!loading && !error && numberLimits.length>0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.subSectionTitle}>Números Limitados</Text>
                    {JUGADA_ORDER.map(j => {
                      const rows = numberLimits.filter(r => r.jugada === j);
                      if(!rows.length) return null;
                      // Agrupar por jugada: mostrar línea con lista de números y su límite base si homogéneo
                      return (
                        <View key={j} style={styles.numberLimitGroup}>
                          <Text style={styles.numberLimitHeader}>{j.toUpperCase()}</Text>
                          {rows.slice(0,50).map((r,idx)=>(
                            <Text key={idx} style={styles.infoText}>• {r.numero} → {r.limite}</Text>
                          ))}
                          {rows.length>50 && (
                            <Text style={[styles.infoText,{fontStyle:'italic'}]}>… +{rows.length-50} más</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                {!loading && !error && numberLimits.length===0 && (
                  <Text style={[styles.infoText,{marginTop:8}]}>No hay números limitados.</Text>
                )}
              </View>
              
              {infoSections.map((section, index) => (
                <View key={index} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {section.items.map((item, itemIndex) => (
                    <Text key={itemIndex} style={styles.infoText}>• {item}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed
              ]}
              onPress={handleClose}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </Pressable>
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
  buttonIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2D5016',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  scrollView: {
    maxHeight: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 16,
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F4F9F2',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E0E6E0'
  },
  limitPlay: { fontSize: 13, fontWeight: '700', color: '#2D5016' },
  limitValue: { fontSize: 13, fontWeight: '600', color: '#34495e' },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 4,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
    marginTop: 4,
  },
  numberLimitGroup: {
    marginBottom: 10,
    backgroundColor: '#FAFCF9',
    borderWidth: 1,
    borderColor: '#E6ECE6',
    borderRadius: 6,
    padding: 8,
  },
  numberLimitHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2D5016',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#3498db',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  closeButtonPressed: {
    opacity: 0.8,
    backgroundColor: '#2980b9',
  },
});

export default InfoButton;
