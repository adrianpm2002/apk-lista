import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../supabaseClient';

// Pantalla placeholder para gestión de jugadas activas (lista grande)
const JugadasActivasScreen = ({ isDarkMode }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setLoading(true); setError(null);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if(!user){ setError('No autenticado'); setLoading(false); return; }
      const { data: profile } = await supabase.from('profiles').select('role,id_banco').eq('id', user.id).single();
      const bankId = profile?.role === 'admin' ? user.id : profile?.id_banco;
      const { data: jug } = await supabase.from('jugadas_activas').select('jugadas').eq('id_banco', bankId).maybeSingle();
      const jugadasObj = jug?.jugadas || {};
      const order = ['fijo','corrido','posicion','parle','centena','tripleta'];
      const formatted = order.map(k=> ({ key:k, activo: !!jugadasObj[k] }));
      setData(formatted);
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ fetchData(); },[]);

  const onRefresh = async ()=> { setRefreshing(true); await fetchData(); setRefreshing(false); };

  if(loading) return <View style={[styles.center, isDarkMode && styles.darkBg]}><ActivityIndicator color="#3498db" size="large" /><Text style={[styles.loadingText, isDarkMode && styles.loadingTextDark]}>Cargando...</Text></View>;
  if(error) return <View style={[styles.center, isDarkMode && styles.darkBg]}><Text style={styles.errorText}>Error: {error}</Text></View>;

  return (
    <View style={[styles.container, isDarkMode && styles.darkBg]}>
      <Text style={[styles.title, isDarkMode && styles.titleDark]}>Jugadas Activas</Text>
      <FlatList
        data={data}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyExtractor={item=>item.key}
        renderItem={({item}) => (
          <View style={[styles.row, !item.activo && styles.inactiveRow]}>
            <Text style={[styles.rowText, isDarkMode && styles.rowTextDark]}>{item.key.toUpperCase()}</Text>
            <Text style={[styles.badge, item.activo ? styles.badgeOn : styles.badgeOff]}>{item.activo ? 'Activo' : 'Inactivo'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin datos</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  darkBg:{ backgroundColor:'#1B262C' },
  center:{ flex:1, justifyContent:'center', alignItems:'center' },
  title:{ fontSize:20, fontWeight:'700', marginBottom:12, color:'#2C3E50' },
  titleDark:{ color:'#ECF0F1' },
  loadingText:{ marginTop:8, color:'#2C3E50' },
  loadingTextDark:{ color:'#ECF0F1' },
  errorText:{ color:'#E74C3C' },
  row:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:12, borderRadius:8, backgroundColor:'#F4F6F7', marginBottom:8 },
  inactiveRow:{ opacity:0.5 },
  rowText:{ fontSize:16, fontWeight:'600', color:'#2C3E50' },
  rowTextDark:{ color:'#ECF0F1' },
  badge:{ paddingHorizontal:10, paddingVertical:4, borderRadius:14, fontSize:12, fontWeight:'700', overflow:'hidden', color:'#fff' },
  badgeOn:{ backgroundColor:'#27AE60' },
  badgeOff:{ backgroundColor:'#7F8C8D' },
  empty:{ textAlign:'center', marginTop:32, color:'#7F8C8D' }
});

export default JugadasActivasScreen;
