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
      // Traer límites (limite_numero)
      const { data: limits, error: limErr } = await supabase
        .from('limite_numero')
        .select('id, numero, limite, jugada, id_horario, horario: id_horario ( id, nombre, loteria: id_loteria ( id, nombre ) )')
        .eq('id_banco', bankId);
      if(limErr) throw limErr;
      // Traer montos usados por número (numero_limitado) - asumiendo campo limite = monto acumulado actual
      const { data: usedRows, error: usedErr } = await supabase
        .from('numero_limitado')
        .select('numero, limite, jugada, id_horario, horario: id_horario ( id, loteria: id_loteria ( id ) )')
        .eq('id_banco', bankId);
      if(usedErr) throw usedErr;
      // Construir mapa usado: key = loteriaId|horarioId|jugada|numero
      const usedMap = new Map();
      (usedRows||[]).forEach(r=>{
        const lotId = r.horario?.loteria?.id;
        const key = `${lotId}|${r.id_horario}|${r.jugada}|${r.numero}`;
        usedMap.set(key, (usedMap.get(key)||0) + (r.limite||0));
      });
      const rows = (limits||[]).map(l=>{
        const lotId = l.horario?.loteria?.id;
        const key = `${lotId}|${l.id_horario}|${l.jugada}|${l.numero}`;
        const used = usedMap.get(key)||0;
        return {
          loteriaId: String(lotId),
          horarioId: String(l.id_horario),
          horarioNombre: l.horario?.nombre,
          loteriaNombre: l.horario?.loteria?.nombre,
          jugada: l.jugada,
          numero: String(l.numero).padStart(2,'0'),
          limite: l.limite,
          usado: used,
          porcentaje: l.limite ? Math.min(100, (used / l.limite)*100) : 0
        };
      });
      setCapacityData(rows);
    } catch(e){ setError(e.message||'Error cargando capacidad'); }
    setLoading(false);
  };

  const handlePress = () => {
    if (!selectedLotteries || selectedLotteries.length === 0) {
      onLotteryError && onLotteryError(true, 'Selecciona al menos una lotería');
      return;
    }
    fetchCapacities();
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
        selectedLottery={selectedLotteries.length===1 ? (lotteryOptions.find(o=>o.value===selectedLotteries[0])?.label) : null}
        capacityData={capacityData}
        loading={loading}
        error={error}
        filters={{ lotteries: selectedLotteries, schedules: selectedSchedules, playTypes: selectedPlayTypes }}
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
