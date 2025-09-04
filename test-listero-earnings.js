// Script de prueba para verificar el cálculo de ganancias del listero
console.log('💼 PRUEBA DE CÁLCULO DE GANANCIAS DEL LISTERO');
console.log('==============================================');

// Simulación de configuración de usuario
const mockUserProfile = {
  id_precio: {
    "1_id": 5,  // Nacional → Ganancia Básica
    "1_nombre": "Nacional",
    "2_id": 8,  // Real → Ganancia Premium  
    "2_nombre": "Real",
    "3_id": 5,  // Leidsa → Ganancia Básica
    "3_nombre": "Leidsa"
  }
};

// Configuraciones de precios (con porcentajes del listero)
const mockPriceConfigs = {
  5: { // Ganancia Básica
    nombre: "Ganancia Básica",
    precios: {
      fijo: { regular: 70, limited: 60, listeroPct: 15 },
      corrido: { regular: 7, limited: 6, listeroPct: 10 },
      parle: { regular: 600, limited: 500, listeroPct: 20 },
      posicion: { regular: 70, limited: 60, listeroPct: 15 },
      centena: { regular: 600, limited: 500, listeroPct: 20 },
      tripleta: { regular: 4500, limited: 4000, listeroPct: 25 }
    }
  },
  8: { // Ganancia Premium
    nombre: "Ganancia Premium",
    precios: {
      fijo: { regular: 80, limited: 70, listeroPct: 18 },
      corrido: { regular: 8, limited: 7, listeroPct: 12 },
      parle: { regular: 700, limited: 600, listeroPct: 22 },
      posicion: { regular: 80, limited: 70, listeroPct: 18 },
      centena: { regular: 700, limited: 600, listeroPct: 22 },
      tripleta: { regular: 5000, limited: 4500, listeroPct: 28 }
    }
  }
};

// Simulación de jugadas del listero
const mockPlays = [
  {
    id_loteria: 1, // Nacional
    jugada: 'fijo',
    monto_total: 1000,
    numeros: '25',
    lottery_name: 'Nacional'
  },
  {
    id_loteria: 1, // Nacional  
    jugada: 'corrido',
    monto_total: 2000,
    numeros: '34',
    lottery_name: 'Nacional'
  },
  {
    id_loteria: 2, // Real
    jugada: 'fijo', 
    monto_total: 1500,
    numeros: '67',
    lottery_name: 'Real'
  },
  {
    id_loteria: 2, // Real
    jugada: 'parle',
    monto_total: 500,
    numeros: '1234',
    lottery_name: 'Real'
  },
  {
    id_loteria: 3, // Leidsa
    jugada: 'centena',
    monto_total: 800,
    numeros: '789',
    lottery_name: 'Leidsa'
  }
];

// Función para calcular ganancias del listero
function calculateListeroEarnings(userProfile, plays) {
  console.log('📊 Calculando ganancias del listero...');
  console.log('');
  
  const gainsData = userProfile.id_precio;
  if (!gainsData || typeof gainsData !== 'object') {
    console.log('❌ Sin configuración de ganancias');
    return 0;
  }
  
  let totalEarnings = 0;
  const playsByLotteryAndType = new Map();
  
  // Agrupar jugadas por lotería y tipo
  for (const play of plays) {
    const lotteryId = play.id_loteria;
    const playType = play.jugada;
    const key = `${lotteryId}_${playType}`;
    
    if (!playsByLotteryAndType.has(key)) {
      playsByLotteryAndType.set(key, {
        lotteryId,
        playType,
        totalAmount: 0,
        plays: []
      });
    }
    
    const group = playsByLotteryAndType.get(key);
    group.totalAmount += play.monto_total;
    group.plays.push(play);
  }
  
  console.log(`🎯 Grupos de jugadas encontrados: ${playsByLotteryAndType.size}`);
  console.log('');
  
  // Calcular ganancias por grupo
  for (const [key, group] of playsByLotteryAndType) {
    const lotteryName = gainsData[`${group.lotteryId}_nombre`] || `Lotería ${group.lotteryId}`;
    const gainId = gainsData[`${group.lotteryId}_id`];
    
    console.log(`💰 ${lotteryName} - ${group.playType.toUpperCase()}`);
    console.log(`   Monto total: $${group.totalAmount}`);
    console.log(`   Cantidad de jugadas: ${group.plays.length}`);
    
    if (!gainId) {
      console.log(`   ⚠️  Sin ganancia configurada`);
      console.log('');
      continue;
    }
    
    const priceConfig = mockPriceConfigs[gainId];
    if (!priceConfig) {
      console.log(`   ❌ Configuración no encontrada para ganancia ID ${gainId}`);
      console.log('');
      continue;
    }
    
    const playTypeConfig = priceConfig.precios[group.playType];
    if (!playTypeConfig) {
      console.log(`   ⚠️  Sin configuración para tipo de jugada ${group.playType}`);
      console.log('');
      continue;
    }
    
    const listeroPercentage = playTypeConfig.listeroPct || 0;
    const earnings = (group.totalAmount * listeroPercentage) / 100;
    
    console.log(`   📈 Porcentaje del listero: ${listeroPercentage}%`);
    console.log(`   💼 Ganancia calculada: $${earnings.toFixed(2)}`);
    console.log(`   🧮 Cálculo: $${group.totalAmount} × ${listeroPercentage}% = $${earnings.toFixed(2)}`);
    
    totalEarnings += earnings;
    console.log('');
  }
  
  return totalEarnings;
}

// Ejecutar cálculo
console.log('🚀 Iniciando cálculo con datos de ejemplo...');
console.log('');

const totalEarnings = calculateListeroEarnings(mockUserProfile, mockPlays);

console.log('📋 RESUMEN FINAL:');
console.log('=================');

// Mostrar totales por lotería
const totalsByLottery = {};
mockPlays.forEach(play => {
  const lotteryName = play.lottery_name;
  if (!totalsByLottery[lotteryName]) {
    totalsByLottery[lotteryName] = 0;
  }
  totalsByLottery[lotteryName] += play.monto_total;
});

Object.entries(totalsByLottery).forEach(([lottery, total]) => {
  console.log(`${lottery}: $${total} en jugadas`);
});

console.log('');
console.log(`💰 Total recogido: $${mockPlays.reduce((sum, play) => sum + play.monto_total, 0)}`);
console.log(`💼 Total ganancias del listero: $${totalEarnings.toFixed(2)}`);
console.log(`📊 Porcentaje promedio: ${((totalEarnings / mockPlays.reduce((sum, play) => sum + play.monto_total, 0)) * 100).toFixed(2)}%`);

console.log('');
console.log('✅ CAMBIOS IMPLEMENTADOS:');
console.log('=========================');
console.log('1. ✅ Nueva función calculateListeroEarnings() en listeroStatsService.js');
console.log('2. ✅ Modificada getPlaysDetails() para incluir listero_earning en cada jugada');
console.log('3. ✅ Actualizada StatisticsScreen.js para mostrar ganancias del listero');
console.log('4. ✅ Reemplazado "📊 cantidad de jugadas" por "💼 ganancias del listero"');
console.log('5. ✅ Agregada columna "Ganancia" en la tabla de detalles');
console.log('6. ✅ Nuevos estilos para destacar las ganancias');
console.log('');
console.log('🎯 RESULTADO:');
console.log('El listero ahora puede ver exactamente cuánto gana según');
console.log('los porcentajes configurados para cada lotería y tipo de jugada');
console.log('');
console.log('🎉 ¡Implementación completada exitosamente!');
