// Utilidad para validar si un horario está abierto
export const isScheduleOpen = (startTime, endTime) => {
  if (!startTime || !endTime) return true; // Si no hay horarios definidos, está "abierto"
  
  const now = new Date();
  // Obtener hora en zona horaria de La Habana, Cuba (America/Havana)
  const havanaTime = now.toLocaleString('en-US', { 
    timeZone: 'America/Havana',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
  const [nowHour, nowMinute] = havanaTime.split(':').map(n => parseInt(n, 10));
  const nowMin = nowHour * 60 + nowMinute;
  
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
    // Intentar primero desde Supabase (online)
    try {
      const { supabase } = await import('../supabaseClient');
      
      const { data: schedule, error } = await supabase
        .from('horario')
        .select('hora_inicio, hora_fin')
        .eq('id', scheduleId)
        .single();
      
      if (!error && schedule) {
        return isScheduleOpen(schedule.hora_inicio, schedule.hora_fin);
      }
    } catch (onlineError) {
      // Si falla online, intentar desde caché offline
    }

    // Fallback: Buscar en caché offline
    const OfflineStorage = await import('../services/offlineStorageService');
    const cachedSchedules = await OfflineStorage.default.getSchedules(null);
    
    if (cachedSchedules && cachedSchedules.length > 0) {
      const schedule = cachedSchedules.find(s => s.id === scheduleId);
      
      if (schedule && schedule.hora_inicio && schedule.hora_fin) {
        return isScheduleOpen(schedule.hora_inicio, schedule.hora_fin);
      }
    }
    
    // Si no se encuentra ni online ni offline, considerarlo cerrado por seguridad
    return false;
  } catch (error) {
    console.error('Error validando horario:', error);
    return false;
  }
};
