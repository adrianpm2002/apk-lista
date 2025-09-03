// Utilidad para convertir una jugada editada de vuelta a comando de texto
// Convierte los datos de una jugada guardada a la sintaxis del modo texto

export function playToTextCommand(playData) {
  if (!playData || !playData.numbers || !playData.playType) {
    return '';
  }

  const { numbers, playType, amount } = playData;
  const numList = numbers.split(',').map(n => n.trim()).filter(Boolean);
  
  if (!numList.length) {
    return '';
  }

  // Formatear monto preservando decimales si es necesario
  const formatAmount = (amt) => {
    const num = parseFloat(amt || 0);
    return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
  };

  switch (playType) {
    case 'fijo':
      // Formato: "12 34 56 - 5"
      return `${numList.join(' ')} - ${formatAmount(amount)}`;
      
    case 'corrido':
      // Formato: "12 34 56 - 0 - 3"
      return `${numList.join(' ')} - 0 - ${formatAmount(amount)}`;
      
    case 'centena':
      // Formato: "123 456 789 - 10"
      return `${numList.join(' ')} - ${formatAmount(amount)}`;
      
    case 'parle':
      // Detectar si es parle directo (4 dígitos) o multiplicado
      const firstNum = numList[0];
      if (firstNum && firstNum.length === 4) {
        // Parle directo: "1234 5678 - 15"
        return `${numList.join(' ')} - ${formatAmount(amount)}`;
      } else {
        // Parle multiplicado: necesitamos convertir las combinaciones de vuelta
        // Para esto, necesitamos detectar los números base originales
        // Por simplicidad, usaremos formato directo si no podemos detectar
        return `${numList.join(' ')} - ${formatAmount(amount)}`;
      }
      
    case 'tripleta':
      // Formato: "123456 789012 - 25"
      return `${numList.join(' ')} - ${formatAmount(amount)}`;
      
    default:
      // Formato genérico como fallback
      return `${numList.join(' ')} - ${formatAmount(amount)}`;
  }
}

// Función específica para Texto 2.0 (sintaxis con "con")
export function playToText2Command(playData) {
  if (!playData || !playData.numbers || !playData.playType) {
    return '';
  }

  const { numbers, playType, amount } = playData;
  const numList = numbers.split(',').map(n => n.trim()).filter(Boolean);
  
  if (!numList.length) {
    return '';
  }

  // Formatear monto preservando decimales si es necesario
  const formatAmount = (amt) => {
    const num = parseFloat(amt || 0);
    return num % 1 === 0 ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');
  };

  switch (playType) {
    case 'fijo':
      // Formato: "12 34 56 con 5f"
      return `${numList.join(' ')} con ${formatAmount(amount)}f`;
      
    case 'corrido':
      // Formato: "12 34 56 con 3c"
      return `${numList.join(' ')} con ${formatAmount(amount)}c`;
      
    case 'centena':
      // Formato: "123 456 con 15"
      return `${numList.join(' ')} con ${formatAmount(amount)}`;
      
    case 'parle':
      // Detectar si es parle directo (4 dígitos) o multiplicado
      const firstNum = numList[0];
      if (firstNum && firstNum.length === 4) {
        // Parle directo: "1234 5678 con 25"
        return `${numList.join(' ')} con ${formatAmount(amount)}`;
      } else {
        // Parle de 2 dígitos: "12 34 56 con 10p"
        return `${numList.join(' ')} con ${formatAmount(amount)}p`;
      }
      
    case 'tripleta':
      // Formato: "123456 789012 con 30"
      return `${numList.join(' ')} con ${formatAmount(amount)}`;
      
    default:
      // Formato genérico como fallback
      return `${numList.join(' ')} con ${formatAmount(amount)}`;
  }
}

// Función auxiliar para detectar si un parle viene de multiplicación
// Esta función intenta reconstruir los números base si es posible
export function detectParleMultiplication(parleNumbers) {
  // Por ahora returnamos null - esto requeriría lógica compleja para detectar
  // los números base originales de las combinaciones
  // En futuras versiones se podría mejorar esta detección
  return null;
}
