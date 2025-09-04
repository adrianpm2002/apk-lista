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
      
      // Agregar información de la lotería
      copyText += `Lotería: 🗽${lottery.nombre}🗽\n`;
      copyText += `Horario: ${scheduleName}\n`;
      
      // Procesar cada tipo de jugada seleccionada
      const selectedPlayTypes = formData.selectedPlayTypes || [];
      const amounts = formData.amounts || {};
      const plays = formData.plays || '';
      
      // Extraer números de las jugadas
      const numbers = plays.match(/\d+/g) || [];
      
      for (const playType of selectedPlayTypes) {
        const amount = amounts[playType];
        if (!amount || parseFloat(amount.toString().replace(/[^0-9.]/g, '')) === 0) {
          continue; // Saltar jugadas sin monto
        }
        
        // Capitalizar el nombre del tipo de jugada
        const playTypeName = capitalizePlayType(playType);
        copyText += `${playTypeName}\n`;
        
        // Agregar números en línea
        if (numbers.length > 0) {
          copyText += numbers.join(' ') + '\n';
        }
        
        // Calcular totales
        const unitAmount = parseFloat(amount.toString().replace(/[^0-9.]/g, '')) || 0;
        const totalAmount = unitAmount * numbers.length;
        
        copyText += `Unitario: ${unitAmount}   Total: ${totalAmount}\n`;
      }
      
      copyText += '\n'; // Separador entre loterías
    }
    
    return copyText.trim();
    
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
