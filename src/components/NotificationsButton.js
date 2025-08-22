import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions, FlatList } from 'react-native';
import { t } from '../utils/i18n';
import { useNotifications } from '../context/NotificationsContext';
import { USER_ROLES } from '../constants/roles';

// Botón de notificaciones con listado y contador de no leídas
const NotificationsButton = ({ role = USER_ROLES.LISTERO }) => {
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isSmall = width <= 360;
  const { notifications, markRead, markAllReadForRole } = useNotifications();
  const list = useMemo(() => notifications.filter(n => n.roles?.includes(role)), [notifications, role]);
  const unread = list.filter(n => n.unread).length;
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.button, isSmall && styles.buttonSmall, pressed && styles.buttonPressed]}
        onPress={() => setVisible(true)}
      >
        <Text style={[styles.icon, isSmall && styles.iconSmall]}>🔔</Text>
        {!!unread && <View style={styles.badge}><Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View>}
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={()=> setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>{t('notifications.title')}</Text>
            {list.length === 0 ? (
              <Text style={styles.body}>{t('notifications.empty')}</Text>
            ) : (
              <FlatList
                data={list}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => markRead(item.id)} style={[styles.item, !item.unread && styles.itemRead]}>
                    <View style={[styles.typeDot, typeToStyle(item.type)]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {!!item.body && <Text style={styles.itemBody}>{item.body}</Text>}
                      <Text style={styles.itemMeta}>{new Date(item.ts).toLocaleString()}</Text>
                    </View>
                  </Pressable>
                )}
              />
            )}
            <View style={{ flexDirection:'row', gap:8, marginTop:12 }}>
              <Pressable style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]} onPress={()=> setVisible(false)}>
                <Text style={styles.closeText}>{t('common.close')}</Text>
              </Pressable>
              {list.length>0 && (
                <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]} onPress={()=> { markAllReadForRole(role); }}>
                  <Text style={styles.secondaryText}>Marcar todo leído</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const typeToStyle = (type) => {
  switch(type){
    case 'success': return { backgroundColor:'#27AE60' };
    case 'warning': return { backgroundColor:'#F39C12' };
    case 'error': return { backgroundColor:'#E74C3C' };
    default: return { backgroundColor:'#2980B9' };
  }
};

const styles = StyleSheet.create({
  button: { width:40, height:40, borderRadius:20, backgroundColor:'#FFFFFF', borderWidth:1.5, borderColor:'#B8D4A8', alignItems:'center', justifyContent:'center', elevation:3 },
  buttonSmall: { width:34, height:34, borderRadius:17 },
  buttonPressed: { opacity:0.7, transform:[{ scale:0.95 }] },
  icon: { fontSize:18 },
  iconSmall: { fontSize:16 },
  badge: { position:'absolute', top:-3, right:-3, backgroundColor:'#E74C3C', minWidth:16, height:16, paddingHorizontal:3, borderRadius:8, alignItems:'center', justifyContent:'center' },
  badgeTxt: { color:'#fff', fontSize:10, fontWeight:'700' },
  overlay: { flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'center', alignItems:'center', padding:16 },
  modal: { backgroundColor:'#fff', borderRadius:16, width:'100%', maxWidth:420, padding:20 },
  title: { fontSize:18, fontWeight:'700', textAlign:'center', marginBottom:12, color:'#2C3E50' },
  body: { fontSize:14, textAlign:'center', color:'#34495E', marginBottom:16 },
  item: { flexDirection:'row', gap:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#ECF0F1' },
  itemRead: { opacity:0.7 },
  typeDot: { width:8, height:8, borderRadius:4, marginTop:6 },
  itemTitle: { fontSize:14, fontWeight:'700', color:'#2C3E50' },
  itemBody: { fontSize:12, color:'#566573', marginTop:2 },
  itemMeta: { fontSize:10, color:'#95A5A6', marginTop:4 },
  closeButton: { backgroundColor:'#2D5016', paddingVertical:10, borderRadius:8, alignItems:'center', flex:1 },
  closeButtonPressed: { opacity:0.85 },
  closeText: { color:'#fff', fontSize:16, fontWeight:'600' },
  secondaryButton: { backgroundColor:'#F0F3F4', paddingVertical:10, borderRadius:8, alignItems:'center', flex:1 },
  secondaryButtonPressed: { opacity:0.85 },
  secondaryText: { color:'#2C3E50', fontSize:14, fontWeight:'600' },
});

export default NotificationsButton;
