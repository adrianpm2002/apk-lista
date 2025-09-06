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
  try {
    let copyText = '';
    
    // Usar el nombre de la nota si está disponible, sino "SIN NOMBRE"
    let userName = noteName && noteName.trim() ? noteName.trim() : 'SIN NOMBRE';
    copyText += userName + '\n';
    
    // Obtener información de loterías y horarios
    const { supabase } = await import('../supabaseClient');
    
    // Obtener información de la lotería
    const { data: lottery } = await supabase
      .from('loteria')
      .select('nombre')
      .eq('id', selectedLottery)
      .single();
    
    if (!lottery) {
      return 'Error: Lotería no encontrada';
    }
    
    // Obtener horario para esta lotería
    let scheduleName = 'Sin horario';
    if (selectedSchedule) {
      const { data: schedule } = await supabase
        .from('horario')
        .select('nombre')
        .eq('id', selectedSchedule)
        .single();
      
      if (schedule) {
        scheduleName = schedule.nombre;
      }
    }
    
    // Agregar información de la lotería
    copyText += `\nLotería: ${lottery.nombre} \n`;
    copyText += `Horario: ${scheduleName}\n\n`;
    
    // Extraer números únicos de las jugadas (solo números de 2 dígitos)
    const numbers = plays.match(/\d{2}/g) || [];
    const uniqueNumbers = [...new Set(numbers)];
    
    if (uniqueNumbers.length === 0) {
      return copyText + 'Sin números válidos\n\nTotal: 0';
    }
    
    // Generar líneas según el tipo de jugada
    let totalAmount = 0;
    
    // Si hay fijo, generar línea con todos los números
    if (amounts.fijo && parseFloat(amounts.fijo) > 0) {
      const fijoAmount = parseFloat(amounts.fijo);
      copyText += `${uniqueNumbers.join(' ')} -${fijoAmount}\n`;
      totalAmount += fijoAmount * uniqueNumbers.length;
    }
    
    // Si hay corrido, generar línea separada
    if (amounts.corrido && parseFloat(amounts.corrido) > 0) {
      const corridoAmount = parseFloat(amounts.corrido);
      copyText += `${uniqueNumbers.join(' ')} -0-${corridoAmount}\n`;
      totalAmount += corridoAmount * uniqueNumbers.length;
    }
    
    // Si hay parle, generar líneas según el tipo
    if (amounts.parle && parseFloat(amounts.parle) > 0) {
      const parleAmount = parseFloat(amounts.parle);
      // Para parle, usar los números en combinaciones
      if (uniqueNumbers.length >= 2) {
        const combinations = [];
        for (let i = 0; i < uniqueNumbers.length; i++) {
          for (let j = i + 1; j < uniqueNumbers.length; j++) {
            combinations.push(uniqueNumbers[i] + uniqueNumbers[j]);
          }
        }
        copyText += `${combinations.join(' ')} -${parleAmount}\n`;
        totalAmount += parleAmount * combinations.length;
      }
    }
    
    // Si hay centena
    if (amounts.centena && parseFloat(amounts.centena) > 0) {
      const centenaAmount = parseFloat(amounts.centena);
      // Para centena, mostrar números de 3 dígitos
      const centenas = plays.match(/\d{3}/g) || [];
      if (centenas.length > 0) {
        copyText += `${centenas.join(' ')} -${centenaAmount}\n`;
        totalAmount += centenaAmount * centenas.length;
      }
    }
    
    copyText += `\nTotal: ${totalAmount}`;
    
    return copyText;
    
  } catch (error) {
    console.error('Error generando texto para copiar:', error);
    return 'Error generando texto';
  }
};

// Función específica para modo texto que recibe instrucciones parseadas
export const generateTextModeCopyFromInstructions = async (
  parsedInstructions,
  selectedLottery,
  selectedSchedule,
  currentUserProfile = null,
  noteName = null
) => {
  try {
    let copyText = '';
    
    // Usar el nombre de la nota si está disponible, sino "SIN NOMBRE"
    let userName = noteName && noteName.trim() ? noteName.trim() : 'SIN NOMBRE';
    copyText += userName + '\n';
    
    // Obtener información de loterías y horarios
    const { supabase } = await import('../supabaseClient');
    
    // Obtener información de la lotería
    const { data: lottery } = await supabase
      .from('loteria')
      .select('nombre')
      .eq('id', selectedLottery)
      .single();
    
    if (!lottery) {
      return 'Error: Lotería no encontrada';
    }
    
    // Obtener horario para esta lotería
    let scheduleName = 'Sin horario';
    if (selectedSchedule) {
      const { data: schedule } = await supabase
        .from('horario')
        .select('nombre')
        .eq('id', selectedSchedule)
        .single();
      
      if (schedule) {
        scheduleName = schedule.nombre;
      }
    }
    
    // Agregar información de la lotería
    copyText += `\nLotería: ${lottery.nombre} \n`;
    copyText += `Horario: ${scheduleName}\n\n`;
    
    if (!parsedInstructions || parsedInstructions.length === 0) {
      return copyText + 'Sin jugadas válidas\n\nTotal: 0';
    }
    
    let totalGeneral = 0;
    
    // Procesar cada instrucción
    parsedInstructions.forEach(instruction => {
      const { playType, numbers, amountEach } = instruction;
      
      if (!numbers || numbers.length === 0) return;
      
      if (playType === 'fijo' || playType === 'corrido') {
        // Para fijo y corrido: mostrar números individuales
        if (playType === 'fijo') {
          copyText += `${numbers.join(' ')} -${amountEach}\n`;
        } else {
          copyText += `${numbers.join(' ')} -0-${amountEach}\n`;
        }
      } else if (playType === 'parle') {
        // Para parle: mostrar combinaciones de 4 dígitos
        copyText += `${numbers.join(' ')} -${amountEach}\n`;
      } else if (playType === 'centena') {
        // Para centena: mostrar números de 3 dígitos
        copyText += `${numbers.join(' ')} -${amountEach}\n`;
      } else if (playType === 'tripleta') {
        // Para tripleta: mostrar números de 6 dígitos
        copyText += `${numbers.join(' ')} -${amountEach}\n`;
      }
      
      totalGeneral += instruction.totalPerLottery || 0;
    });
    
    copyText += `\nTotal: ${totalGeneral}`;
    
    return copyText;
    
  } catch (error) {
    console.error('Error generando texto para copiar:', error);
    return 'Error generando texto';
  }
};
