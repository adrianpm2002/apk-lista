import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { t } from '../utils/i18n';

// Botón de notificaciones (placeholder)
// Muestra modal simple indicando que no hay notificaciones
const NotificationsButton = () => {
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isSmall = width <= 360;
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, isSmall && styles.buttonSmall, pressed && styles.buttonPressed]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.icon, isSmall && styles.iconSmall]}>🔔</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={()=> setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            <Text style={styles.body}>{t('notifications.empty')}</Text>
            <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]} onPress={()=> setVisible(false)}>
              <Text style={styles.closeText}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: { width:40, height:40, borderRadius:20, backgroundColor:'#FFFFFF', borderWidth:1.5, borderColor:'#B8D4A8', alignItems:'center', justifyContent:'center', elevation:3 },
  buttonSmall: { width:34, height:34, borderRadius:17 },
  buttonPressed: { opacity:0.7, transform:[{ scale:0.95 }] },
  icon: { fontSize:18 },
  iconSmall: { fontSize:16 },
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16 },
  modal: { backgroundColor:'#fff', borderRadius:16, width:'100%', maxWidth:380, padding:20 },
  title: { fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:12, color:'#2C3E50' },
  body: { fontSize:14, textAlign:'center', color:'#34495E', marginBottom:16 },
  closeButton: { backgroundColor:'#2D5016', paddingVertical:10, borderRadius:8, alignItems:'center' },
  closeButtonPressed: { opacity:0.85 },
  closeText: { color:'#fff', fontSize:16, fontWeight:'600' },
});

export default NotificationsButton;
