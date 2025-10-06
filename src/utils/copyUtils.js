// Utilidad para generar el formato de copia de jugadas
export const generateCopyText = async (formData, currentUserProfile = null, noteName = null) => {
  try {
    let copyText = '';
    
    // Usar el nombre de la nota si está disponible, sino "SIN NOMBRE"
    let userName = noteName && noteName.trim() ? noteName.trim() : 'SIN NOMBRE';
    
    // Agregar nombre y solo UN salto de línea
    copyText += userName + '\n';
    
    // Obtener información de loterías y horarios
    const { supabase } = await import('../supabaseClient');
    
    // Organizar por lotería
    const lotteryIds = formData.selectedLotteries || [];
    
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
    
    // Procesar números y jugadas según los tipos seleccionados
    const selectedPlayTypes = formData.selectedPlayTypes || [];
    const amounts = formData.amounts || {};
    const plays = formData.plays || '';
    
    // Extraer números únicos de las jugadas (solo números de 2 dígitos)
    const numberMatches = plays.match(/\d{2}/g) || [];
    const uniqueNumbers = [...new Set(numberMatches)];
    
    if (uniqueNumbers.length === 0) {
      copyText += 'Sin números válidos\n';
    } else {
      // Obtener montos de fijo y corrido
      const fijoAmount = parseFloat((amounts.fijo || '0').toString().replace(/[^0-9.]/g, '')) || 0;
      const corridoAmount = parseFloat((amounts.corrido || '0').toString().replace(/[^0-9.]/g, '')) || 0;
      
      // Generar línea con el formato correcto: números-fijo-corrido
      // Si solo hay fijo: "00 11 22-0.2"
      // Si tiene ambos: "00 11 22-0.2-0.2"
      // Si solo hay corrido: "00 11 22-0-0.2"
      
      let amountSuffix = '';
      if (fijoAmount > 0 && corridoAmount > 0) {
        // Ambos montos
        amountSuffix = `-${fijoAmount}-${corridoAmount}`;
      } else if (fijoAmount > 0) {
        // Solo fijo
        amountSuffix = `-${fijoAmount}`;
      } else if (corridoAmount > 0) {
        // Solo corrido (formato: -0-corrido)
        amountSuffix = `-0-${corridoAmount}`;
      }
      
      // Agregar la línea con todos los números
      copyText += `${uniqueNumbers.join(' ')}${amountSuffix}\n`;
    }
    
    // Calcular total por lotería
    let totalPerLottery = 0;
    const numberCount = uniqueNumbers.length;
    
    for (const playType of selectedPlayTypes) {
      const amount = amounts[playType];
      if (amount && parseFloat(amount.toString().replace(/[^0-9.]/g, '')) > 0) {
        const unitAmount = parseFloat(amount.toString().replace(/[^0-9.]/g, '')) || 0;
        totalPerLottery += unitAmount * numberCount;
      }
    }
    
    copyText += `\nTotal: ${totalPerLottery}`;
    
    // Si hay múltiples loterías, agregar Total General (pegado sin línea en blanco)
    if (lotteryIds.length > 1) {
      const totalGeneral = totalPerLottery * lotteryIds.length;
      copyText += `\nTotal General: ${totalGeneral}`;
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

// Función específica para modo texto que usa el comando original del input
export const generateTextModeCopyFromOriginalCommand = async (
  originalCommand,
  selectedLottery,
  selectedSchedule,
  currentUserProfile = null,
  noteName = null,
  parsedInstructions = null
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
    
    // Agregar el comando original exactamente como está en el input
    copyText += originalCommand + '\n\n';
    
    // Calcular el total usando las instrucciones parseadas si están disponibles
    let totalAmount = 0;
    if (parsedInstructions && parsedInstructions.length > 0) {
      totalAmount = parsedInstructions.reduce((acc, instruction) => {
        return acc + (instruction.totalPerLottery || 0);
      }, 0);
      copyText += `Total: ${totalAmount}`;
    } else {
      copyText += `Total: Ver total en la app`;
    }
    
    return copyText;
    
  } catch (error) {
    console.error('Error generando texto para copiar:', error);
    return 'Error generando texto';
  }
};

// Función para modos de texto que maneja múltiples loterías
export const generateTextModeCopyFromOriginalCommandMultiple = async (
  originalCommand,
  selectedLotteries,
  selectedSchedules,
  currentUserProfile = null,
  noteName = null,
  parsedInstructions = null
) => {
  try {
    let copyText = '';
    
    // Usar el nombre de la nota si está disponible, sino "SIN NOMBRE"
    let userName = noteName && noteName.trim() ? noteName.trim() : 'SIN NOMBRE';
    copyText += userName + '\n';
    
    // Si hay múltiples loterías, agregar una línea en blanco después del nombre
    if (selectedLotteries.length > 1) {
      copyText += '\n';
    }
    
    // Obtener información de loterías y horarios
    const { supabase } = await import('../supabaseClient');
    
    // Agregar información de cada lotería
    for (const lotteryId of selectedLotteries) {
      // Obtener información de la lotería
      const { data: lottery } = await supabase
        .from('loteria')
        .select('nombre')
        .eq('id', lotteryId)
        .single();
      
      if (!lottery) continue;
      
      // Obtener horario para esta lotería
      const scheduleId = selectedSchedules[lotteryId];
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
      copyText += `\nLotería: ${lottery.nombre} \n`;
      copyText += `Horario: ${scheduleName}\n`;
    }
    
    // Agregar línea en blanco antes del comando
    copyText += '\n';
    
    // Agregar el comando original exactamente como está en el input
    copyText += originalCommand + '\n\n';
    
    // Calcular el total usando las instrucciones parseadas si están disponibles
    let totalAmount = 0;
    if (parsedInstructions && parsedInstructions.length > 0) {
      totalAmount = parsedInstructions.reduce((acc, instruction) => {
        return acc + (instruction.totalPerLottery || 0);
      }, 0);
      copyText += `Total: ${totalAmount}`;
    } else {
      copyText += `Total: Ver total en la app`;
    }
    
    // Si hay múltiples loterías, agregar Total General
    if (selectedLotteries.length > 1) {
      const totalGeneral = totalAmount * selectedLotteries.length;
      copyText += `\n\nTotal General: ${totalGeneral}`;
    }
    
    return copyText;
    
  } catch (error) {
    console.error('Error generando texto para copiar:', error);
    return 'Error generando texto';
  }
};
