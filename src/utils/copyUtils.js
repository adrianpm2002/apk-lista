// Utilidad para generar el formato de copia de jugadas
export const generateCopyText = async (formData, currentUserProfile = null, noteName = null) => {
  try {
    let copyText = '';
    
    // Usar el nombre de la nota si está disponible, sino "SIN NOMBRE"
    let userName = noteName && noteName.trim() ? noteName.trim() : 'SIN NOMBRE';
    
    copyText += userName + '\n';
    
    // Obtener información de loterías y horarios
    const { supabase } = await import('../supabaseClient');
    
    // Organizar por lotería
    const lotteryIds = formData.selectedLotteries || [];
    
    // Si hay múltiples loterías, agregar una línea en blanco después del nombre
    if (lotteryIds.length > 1) {
      copyText += '\n';
    }
    
    // Agregar información de cada lotería
    for (const lotteryId of lotteryIds) {
      // Obtener información de la lotería
      const { data: lottery } = await supabase
        .from('loteria')
        .select('nombre')
        .eq('id', lotteryId)
        .single();
      
      if (!lottery) continue;
      
      // Obtener horario para esta lotería
      const scheduleId = formData.selectedSchedules?.[lotteryId];
      let scheduleName = 'Sin horario';
      
      if (scheduleId) {
        const { data: schedule } = await supabase
          .from('horario')
          .select('nombre')
          .eq('id', scheduleId)
          .single();
        
        if (schedule) {
          scheduleName = schedule.nombre;
        }
      }
      
      // Agregar información de la lotería (sin agregar emojis, usar el nombre tal como viene)
      copyText += `\nLotería: ${lottery.nombre} \n`;
      copyText += `Horario: ${scheduleName}\n`;
    }
    
    // Agregar línea en blanco antes de las jugadas
    copyText += '\n';
    
    // Procesar números y jugadas según el formato del ejemplo
    const selectedPlayTypes = formData.selectedPlayTypes || [];
    const amounts = formData.amounts || {};
    const plays = formData.plays || '';
    
    // Extraer números de las jugadas
    const numbers = plays.match(/\d+/g) || [];
    
    if (numbers.length > 0) {
      // Formato específico según el ejemplo:
      // 08 18 28 38 48 58 68 78 88 98-10
      // 88-10
      // 11 -20
      
      // Primera línea: todos los números con el primer monto
      const firstAmount = amounts[selectedPlayTypes[0]] || '10';
      copyText += `${numbers.join(' ')}-${firstAmount}\n`;
      
      // Segunda línea: último número con el mismo monto
      if (numbers.length > 0) {
        copyText += `${numbers[numbers.length - 1]}-${firstAmount}\n`;
      }
      
      // Tercera línea: un número con un monto diferente (si hay segundo tipo de jugada)
      const secondAmount = amounts[selectedPlayTypes[1]] || '20';
      copyText += `${numbers[0] || '11'} -${secondAmount}\n`;
    }
    
    // Calcular total
    let totalAmount = 0;
    for (const playType of selectedPlayTypes) {
      const amount = amounts[playType];
      if (amount && parseFloat(amount.toString().replace(/[^0-9.]/g, '')) > 0) {
        const unitAmount = parseFloat(amount.toString().replace(/[^0-9.]/g, '')) || 0;
        totalAmount += unitAmount * numbers.length;
      }
    }
    
    copyText += `\nTotal: ${totalAmount}`;
    
    // Si hay múltiples loterías, agregar Total General
    if (lotteryIds.length > 1) {
      const totalGeneral = totalAmount * lotteryIds.length;
      copyText += `\n\nTotal General:${totalGeneral}`;
    }
    
    return copyText;
    
  } catch (error) {
    console.error('Error generando texto para copiar:', error);
    return 'Error generando texto';
  }
};

// Función para capitalizar tipos de jugada
const capitalizePlayType = (playType) => {
  const playTypeMap = {
    'fijo': 'Fijo',
    'corrido': 'Corrido',
    'posicion': 'Posición',
    'centena': 'Centena',
    'parle': 'Parlé',
    'tripleta': 'Tripleta'
  };
  
  return playTypeMap[playType] || playType.charAt(0).toUpperCase() + playType.slice(1);
};

// Función específica para modo visual
export const generateVisualModeCopyText = async (
  selectedLotteries,
  selectedSchedules,
  selectedPlayTypes,
  plays,
  amounts,
  isLocked,
  currentUserProfile = null,
  noteName = null
) => {
  const formData = {
    selectedLotteries,
    selectedSchedules,
    selectedPlayTypes,
    plays,
    amounts
  };
  
  return generateCopyText(formData, currentUserProfile, noteName);
};

// Función específica para modo texto
export const generateTextModeCopyText = async (
  selectedLottery,
  selectedSchedule,
  plays,
  amounts,
  currentUserProfile = null,
  noteName = null
) => {
  // Convertir formato de texto a formato compatible
  const formData = {
    selectedLotteries: selectedLottery ? [selectedLottery] : [],
    selectedSchedules: selectedSchedule ? { [selectedLottery]: selectedSchedule } : {},
    selectedPlayTypes: Object.keys(amounts || {}).filter(key => 
      amounts[key] && parseFloat(amounts[key].toString().replace(/[^0-9.]/g, '')) > 0
    ),
    plays: plays || '',
    amounts: amounts || {}
  };
  
  return generateCopyText(formData, currentUserProfile, noteName);
};
