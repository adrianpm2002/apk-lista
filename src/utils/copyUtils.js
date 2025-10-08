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
    
    let totalPerLottery = 0;
    
    // Procesar cada tipo de jugada por separado
    for (const playType of selectedPlayTypes) {
      const amount = amounts[playType];
      if (!amount || parseFloat(amount.toString().replace(/[^0-9.]/g, '')) <= 0) {
        continue; // Saltar si no hay monto válido para este tipo
      }
      
      const unitAmount = parseFloat(amount.toString().replace(/[^0-9.]/g, '')) || 0;
      let numbersForType = [];
      
      // Extraer números según el tipo de jugada
      if (playType === 'fijo' || playType === 'corrido') {
        // Números de 2 dígitos
        const matches = plays.match(/\b\d{2}\b/g) || [];
        numbersForType = [...new Set(matches)];
      } else if (playType === 'centena') {
        // Números de 3 dígitos
        const matches = plays.match(/\b\d{3}\b/g) || [];
        numbersForType = [...new Set(matches)];
      } else if (playType === 'parle') {
        // Números de 4 dígitos (combinaciones de 2 números de 2 dígitos)
        const matches = plays.match(/\b\d{4}\b/g) || [];
        numbersForType = [...new Set(matches)];
      } else if (playType === 'tripleta') {
        // Números de 6 dígitos (combinaciones de 3 números de 2 dígitos)
        const matches = plays.match(/\b\d{6}\b/g) || [];
        numbersForType = [...new Set(matches)];
      } else if (playType === 'posicion') {
        // Posición también usa números de 2 dígitos
        const matches = plays.match(/\b\d{2}\b/g) || [];
        numbersForType = [...new Set(matches)];
      }
      
      if (numbersForType.length === 0) {
        continue; // No hay números válidos para este tipo
      }
      
      // Calcular total para este tipo de jugada
      totalPerLottery += unitAmount * numbersForType.length;
    }
    
    // Generar la línea de jugadas
    // Para fijo y corrido: combinar en una sola línea con formato números-fijo-corrido
    const fijoAmount = parseFloat((amounts.fijo || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    const corridoAmount = parseFloat((amounts.corrido || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    
    if (fijoAmount > 0 || corridoAmount > 0) {
      // Extraer números de 2 dígitos para fijo/corrido
      const twoDigitMatches = plays.match(/\b\d{2}\b/g) || [];
      const uniqueTwoDigit = [...new Set(twoDigitMatches)];
      
      if (uniqueTwoDigit.length > 0) {
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
        copyText += `${uniqueTwoDigit.join(' ')}${amountSuffix}\n`;
      }
    }
    
    // Para centena: línea separada con números de 3 dígitos
    const centenaAmount = parseFloat((amounts.centena || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    if (centenaAmount > 0) {
      const threeDigitMatches = plays.match(/\b\d{3}\b/g) || [];
      const uniqueThreeDigit = [...new Set(threeDigitMatches)];
      if (uniqueThreeDigit.length > 0) {
        copyText += `${uniqueThreeDigit.join(' ')}-${centenaAmount}\n`;
      }
    }
    
    // Para parle: línea separada con números de 4 dígitos
    const parleAmount = parseFloat((amounts.parle || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    if (parleAmount > 0) {
      const fourDigitMatches = plays.match(/\b\d{4}\b/g) || [];
      const uniqueFourDigit = [...new Set(fourDigitMatches)];
      if (uniqueFourDigit.length > 0) {
        copyText += `${uniqueFourDigit.join(' ')}-${parleAmount}\n`;
      }
    }
    
    // Para tripleta: línea separada con números de 6 dígitos
    const tripletaAmount = parseFloat((amounts.tripleta || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    if (tripletaAmount > 0) {
      const sixDigitMatches = plays.match(/\b\d{6}\b/g) || [];
      const uniqueSixDigit = [...new Set(sixDigitMatches)];
      if (uniqueSixDigit.length > 0) {
        copyText += `${uniqueSixDigit.join(' ')}-${tripletaAmount}\n`;
      }
    }
    
    // Para posición: línea separada con números de 2 dígitos
    const posicionAmount = parseFloat((amounts.posicion || '0').toString().replace(/[^0-9.]/g, '')) || 0;
    if (posicionAmount > 0 && !fijoAmount && !corridoAmount) {
      // Solo mostrar posición si no hay fijo/corrido (para evitar duplicados)
      const twoDigitMatches = plays.match(/\b\d{2}\b/g) || [];
      const uniqueTwoDigit = [...new Set(twoDigitMatches)];
      if (uniqueTwoDigit.length > 0) {
        copyText += `${uniqueTwoDigit.join(' ')}-${posicionAmount}\n`;
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
