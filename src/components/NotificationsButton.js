import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';

// Botón de notificaciones (placeholder)
// Muestra modal simple indicando que no hay notificaciones
const NotificationsButton = () => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.icon}>🔔</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={()=> setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>Notificaciones</Text>
            <Text style={styles.body}>No hay notificaciones por ahora.</Text>
            <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]} onPress={()=> setVisible(false)}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: { width:40, height:40, borderRadius:20, backgroundColor:'#FFFFFF', borderWidth:1.5, borderColor:'#B8D4A8', alignItems:'center', justifyContent:'center', elevation:3 },
  buttonPressed: { opacity:0.7, transform:[{ scale:0.95 }] },
  icon: { fontSize:18 },
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16 },
  modal: { backgroundColor:'#fff', borderRadius:16, width:'100%', maxWidth:380, padding:20 },
  title: { fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:12, color:'#2C3E50' },
  body: { fontSize:14, textAlign:'center', color:'#34495E', marginBottom:16 },
  closeButton: { backgroundColor:'#2D5016', paddingVertical:10, borderRadius:8, alignItems:'center' },
  closeButtonPressed: { opacity:0.85 },
  closeText: { color:'#fff', fontSize:16, fontWeight:'600' },
});

export default NotificationsButton;
