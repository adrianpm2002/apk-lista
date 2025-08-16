import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import CapacityModal from './CapacityModal';
import { supabase } from '../supabaseClient';

const BatteryButton = ({ onOptionSelect, selectedLotteries, selectedSchedules, selectedPlayTypes, lotteryOptions, scheduleOptionsMap, getScheduleLabel, playTypeLabels, bankId, onLotteryError }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [capacityData, setCapacityData] = useState([]); // [{numero, limite, usado, loteriaValue, horarioValue, jugada}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCapacities = async () => {
    if(!bankId) return;
    setLoading(true); setError(null);
    try {
      // Perfil para límites específicos del listero
      const { data: { user } } = await supabase.auth.getUser();
      let specificLimits = null;
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('limite_especifico').eq('id', user.id).maybeSingle();
        specificLimits = profile?.limite_especifico || null;
      }
      // Traer límites (limite_numero)
      const { data: limits, error: limErr } = await supabase
        .from('limite_numero')
        .select('id, numero, limite, jugada, id_horario, horario: id_horario ( id, nombre, hora_inicio, hora_fin, loteria: id_loteria ( id, nombre ) )')
        .eq('id_banco', bankId);
      if(limErr) throw limErr;
      // Traer montos usados por número (numero_limitado) - simplificado para evitar error 400
      const horarioIds = [...new Set((limits||[]).map(l=>l.id_horario).filter(Boolean))];
      let usedRows = [];
      if (horarioIds.length) {
        try {
          const { data: ur, error: ue } = await supabase
            .from('numero_limitado')
            .select('numero, limite, jugada, id_horario')
            .in('id_horario', horarioIds)
            .eq('id_banco', bankId);
          if (ue) throw ue;
          usedRows = ur || [];
        } catch(firstErr) {
          // Fallback sin filtro id_banco si la columna no existe o causa error
          try {
            const { data: ur2, error: ue2 } = await supabase
              .from('numero_limitado')
              .select('numero, limite, jugada, id_horario')
              .in('id_horario', horarioIds);
            if (ue2) throw ue2;
            usedRows = ur2 || [];
          } catch(secondErr) {
            console.warn('No se pudieron cargar montos usados:', secondErr.message);
          }
        }
      }
      // Construir mapa usado: key = horarioId|jugada|numero
      const usedMap = new Map();
      (usedRows||[]).forEach(r=>{
        const key = `${r.id_horario}|${r.jugada}|${r.numero}`;
        usedMap.set(key, (usedMap.get(key)||0) + (r.limite||0));
      });
      // Utilidades para evaluar si el horario está abierto según hora actual
      const now = new Date();
      const nowMinutes = now.getHours()*60 + now.getMinutes();
      const parseToMinutes = (timeStr) => {
        if(!timeStr) return null;
        const parts = timeStr.split(':');
        const h = parseInt(parts[0]);
        const m = parseInt(parts[1]||'0');
        return h*60 + m;
      };
      const rows = (limits||[]).map(l=>{
        const lotId = l.horario?.loteria?.id;
        const used = usedMap.get(`${l.id_horario}|${l.jugada}|${l.numero}`)||0;
        // Determinar si horario abierto
        const startMin = parseToMinutes(l.horario?.hora_inicio);
        const endMin = parseToMinutes(l.horario?.hora_fin);
        let abierto = true;
        if(startMin!=null && endMin!=null){
          if(startMin <= endMin){
            abierto = nowMinutes >= startMin && nowMinutes <= endMin;
          } else { // cruza medianoche
            abierto = (nowMinutes >= startMin) || (nowMinutes <= endMin);
          }
        }
        // Límite efectivo = menor entre límite_numero y límite específico (si existe para esa jugada)
        let effectiveLimit = l.limite;
        if (specificLimits && specificLimits[l.jugada] !== undefined) {
          const spec = specificLimits[l.jugada];
            if (typeof spec === 'number') {
              if (spec < effectiveLimit) {
                effectiveLimit = spec;
              }
            }
        }
        if (!effectiveLimit) return null; // ignorar si no hay límite resolvible
        return {
          loteriaId: String(lotId),
          horarioId: String(l.id_horario),
          horarioNombre: l.horario?.nombre,
          loteriaNombre: l.horario?.loteria?.nombre,
          abierto,
          jugada: l.jugada,
          numero: String(l.numero).padStart(2,'0'),
          limite: effectiveLimit,
          usado: used,
          porcentaje: effectiveLimit ? Math.min(100, (used / effectiveLimit)*100) : 0
        };
      }).filter(Boolean);
      // Filtrar solo horarios abiertos
      setCapacityData(rows.filter(r => r.abierto));
    } catch(e){ setError(e.message||'Error cargando capacidad'); }
    setLoading(false);
  };

  const handlePress = async () => {
    // Cargar datos primero para que filtros iniciales tengan contenido
    await fetchCapacities();
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  return (
    <View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
        onPress={handlePress}
      >
        <Text style={styles.icon}>🔋</Text>
      </Pressable>

      <CapacityModal
        isVisible={isModalVisible}
        onClose={handleCloseModal}
        selectedLottery={null}
        capacityData={capacityData}
        loading={loading}
        error={error}
        getScheduleLabel={getScheduleLabel}
        playTypeLabels={playTypeLabels}
      />
    </View>
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
  icon: {
    fontSize: 18,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
});

export default BatteryButton;
