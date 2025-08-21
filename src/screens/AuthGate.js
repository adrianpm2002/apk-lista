import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseClient';

export default function AuthGate({ navigation }) {
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          // Obtener rol para decidir destino
          const userId = session.user.id;
          const { data: profile } = await supabase.from('profiles').select('role, activo').eq('id', userId).maybeSingle();
          if (profile?.activo === false) {
            await supabase.auth.signOut();
            navigation.replace('Login');
            return;
          }
          const role = profile?.role || 'listero';
          if (role === 'admin' || role === 'collector') navigation.replace('Statistics');
          else navigation.replace('MainApp');
        } else {
          navigation.replace('Login');
        }
      } catch {
        navigation.replace('Login');
      }
    })();
    return () => { mounted = false; };
  }, [navigation]);

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#F8F9FA' }}>
      <ActivityIndicator size="large" color="#2C3E50" />
    </View>
  );
}
