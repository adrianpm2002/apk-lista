// Utilidad para validar si un horario está abierto
export const isScheduleOpen = (startTime, endTime) => {
  if (!startTime || !endTime) return true; // Si no hay horarios definidos, está "abierto"
  
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin = '0'] = startTime.split(':');
  const [endHour, endMin = '0'] = endTime.split(':');
  
  const start = parseInt(startHour, 10) * 60 + parseInt(startMin, 10);
  const end = parseInt(endHour, 10) * 60 + parseInt(endMin, 10);
  
  if (start === end) return true; // 24/7
  
  if (end > start) {
    // Horario normal (no cruza medianoche)
    return nowMin >= start && nowMin < end;
  } else {
    // Horario que cruza medianoche
    return nowMin >= start || nowMin < end;
  }
};

// Función para validar si un horario específico (por ID) está abierto
export const validateScheduleById = async (scheduleId) => {
  try {
    const { supabase } = await import('../supabaseClient');
    
    const { data: schedule, error } = await supabase
      .from('horario')
      .select('hora_inicio, hora_fin')
      .eq('id', scheduleId)
      .single();
    
    if (error || !schedule) {
      console.error('Error obteniendo horario:', error);
      return false; // Por seguridad, si no se puede obtener el horario, considerarlo cerrado
    }
    
    return isScheduleOpen(schedule.hora_inicio, schedule.hora_fin);
  } catch (error) {
    console.error('Error validando horario:', error);
    return false;
  }
};

// Validación combinada para cliente: verifica horario base y ventana personalizada del cliente (si existe)
export const isClientScheduleOpen = (startTime, endTime, clientWindow) => {
  const baseOpen = isScheduleOpen(startTime, endTime);
  if (!baseOpen) return false;
  if (!clientWindow || !clientWindow.start || !clientWindow.end) return baseOpen;
  // Comparación HH:MM (24h)
  const now = new Date();
  const hm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  return hm >= clientWindow.start && hm < clientWindow.end;
};
