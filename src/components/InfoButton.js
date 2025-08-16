import React, { useState, useCallback } from 'react';
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
    } catch(e){
      setError(e.message || 'Error cargando límites');
    } finally {
      setLoading(false);
    }
  }, []);

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
