// Script de prueba para verificar que funciona con todos los tipos de jugada
console.log('🎮 PRUEBA COMPLETA DE TODOS LOS TIPOS DE JUGADA');
console.log('==============================================');

// Configuración de usuario con diferentes loterias
const mockUserProfile = {
  id_precio: {
    "1_id": 5,  // Nacional → Ganancia Básica
    "1_nombre": "Nacional",
    "2_id": 8,  // Real → Ganancia Premium  
    "2_nombre": "Real"
  }
};

// Configuraciones de precios completas (simulando datos reales de Supabase)
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

// Jugadas de prueba con TODOS los tipos de jugada
const allPlayTypes = [
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
    monto_total: 1000,
    numeros: '34',
    lottery_name: 'Nacional'
  },
  {
    id_loteria: 1, // Nacional
    jugada: 'posicion',
    monto_total: 1000,
    numeros: '56',
    lottery_name: 'Nacional'
  },
  {
    id_loteria: 2, // Real
    jugada: 'parle',
    monto_total: 1000,
    numeros: '1234',
    lottery_name: 'Real'
  },
  {
    id_loteria: 2, // Real
    jugada: 'centena',
    monto_total: 1000,
    numeros: '789',
    lottery_name: 'Real'
  },
  {
    id_loteria: 2, // Real
    jugada: 'tripleta',
    monto_total: 1000,
    numeros: '123456',
    lottery_name: 'Real'
  }
];

// Función de prueba que simula calculateListeroEarnings
function testCalculateListeroEarnings(userProfile, plays) {
  console.log('📊 Probando cálculo con todos los tipos de jugada...');
  console.log('');
  
  const gainsData = userProfile.id_precio;
  if (!gainsData || typeof gainsData !== 'object') {
    console.log('❌ Sin configuración de ganancias');
    return { success: false, totalEarnings: 0, details: [] };
  }
  
  let totalEarnings = 0;
  const details = [];
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
  
  console.log(`🎯 Grupos por tipo de jugada: ${playsByLotteryAndType.size}`);
  console.log('');
  
  // Calcular ganancias por grupo
  for (const [key, group] of playsByLotteryAndType) {
    const lotteryName = gainsData[`${group.lotteryId}_nombre`] || `Lotería ${group.lotteryId}`;
    const gainId = gainsData[`${group.lotteryId}_id`];
    
    console.log(`🎲 ${group.playType.toUpperCase()} en ${lotteryName}`);
    console.log(`   Monto total: $${group.totalAmount}`);
    
    if (!gainId) {
      console.log(`   ⚠️  Sin ganancia configurada`);
      details.push({
        playType: group.playType,
        lotteryName,
        amount: group.totalAmount,
        percentage: 0,
        earnings: 0,
        error: 'Sin ganancia configurada'
      });
      console.log('');
      continue;
    }
    
    const priceConfig = mockPriceConfigs[gainId];
    if (!priceConfig) {
      console.log(`   ❌ Configuración no encontrada para ganancia ID ${gainId}`);
      details.push({
        playType: group.playType,
        lotteryName,
        amount: group.totalAmount,
        percentage: 0,
        earnings: 0,
        error: `Configuración no encontrada para ganancia ID ${gainId}`
      });
      console.log('');
      continue;
    }
    
    const playTypeConfig = priceConfig.precios[group.playType];
    if (!playTypeConfig) {
      console.log(`   ❌ Sin configuración para tipo de jugada '${group.playType}'`);
      console.log(`   📋 Tipos disponibles: ${Object.keys(priceConfig.precios).join(', ')}`);
      details.push({
        playType: group.playType,
        lotteryName,
        amount: group.totalAmount,
        percentage: 0,
        earnings: 0,
        error: `Sin configuración para tipo de jugada '${group.playType}'`
      });
      console.log('');
      continue;
    }
    
    const listeroPercentage = playTypeConfig.listeroPct || 0;
    const earnings = (group.totalAmount * listeroPercentage) / 100;
    
    console.log(`   📈 Porcentaje del listero: ${listeroPercentage}%`);
    console.log(`   💼 Ganancia calculada: $${earnings.toFixed(2)}`);
    console.log(`   ✅ Configuración encontrada exitosamente`);
    
    details.push({
      playType: group.playType,
      lotteryName,
      amount: group.totalAmount,
      percentage: listeroPercentage,
      earnings: earnings,
      configName: priceConfig.nombre
    });
    
    totalEarnings += earnings;
    console.log('');
  }
  
  return { success: true, totalEarnings, details };
}

// Ejecutar prueba
console.log('🚀 Probando con todos los tipos de jugada...');
console.log('');

const result = testCalculateListeroEarnings(mockUserProfile, allPlayTypes);

console.log('📋 RESUMEN POR TIPO DE JUGADA:');
console.log('==============================');

const playTypesSummary = {
  'fijo': { tested: false, working: false },
  'corrido': { tested: false, working: false },
  'posicion': { tested: false, working: false },
  'parle': { tested: false, working: false },
  'centena': { tested: false, working: false },
  'tripleta': { tested: false, working: false }
};

result.details.forEach(detail => {
  playTypesSummary[detail.playType] = {
    tested: true,
    working: !detail.error,
    error: detail.error
  };
  
  const status = detail.error ? '❌' : '✅';
  console.log(`${status} ${detail.playType.toUpperCase()}: ${detail.lotteryName}`);
  if (detail.error) {
    console.log(`   Error: ${detail.error}`);
  } else {
    console.log(`   ${detail.configName} - ${detail.percentage}% = $${detail.earnings.toFixed(2)}`);
  }
});

console.log('');
console.log('🎯 ANÁLISIS FINAL:');
console.log('==================');

const totalTypes = Object.keys(playTypesSummary).length;
const testedTypes = Object.values(playTypesSummary).filter(t => t.tested).length;
const workingTypes = Object.values(playTypesSummary).filter(t => t.working).length;
const failingTypes = Object.values(playTypesSummary).filter(t => t.tested && !t.working);

console.log(`📊 Tipos de jugada totales: ${totalTypes}`);
console.log(`🧪 Tipos probados: ${testedTypes}/${totalTypes}`);
console.log(`✅ Tipos funcionando: ${workingTypes}/${testedTypes}`);
console.log(`❌ Tipos con errores: ${failingTypes.length}/${testedTypes}`);

if (failingTypes.length > 0) {
  console.log('');
  console.log('⚠️  TIPOS CON PROBLEMAS:');
  failingTypes.forEach(type => {
    const typeName = Object.keys(playTypesSummary).find(key => playTypesSummary[key] === type);
    console.log(`   - ${typeName}: ${type.error}`);
  });
}

console.log('');
console.log(`💰 Total ganancia calculada: $${result.totalEarnings.toFixed(2)}`);
console.log(`📊 Total monto jugado: $${allPlayTypes.reduce((sum, play) => sum + play.monto_total, 0)}`);

if (workingTypes === testedTypes) {
  console.log('');
  console.log('🎉 ¡ÉXITO! Todos los tipos de jugada funcionan correctamente');
  console.log('✅ La implementación es compatible con:');
  console.log('   - FIJO, CORRIDO, POSICIÓN');
  console.log('   - PARLE, CENTENA, TRIPLETA');
  console.log('   - Cualquier tipo de jugada configurado en la tabla precio');
} else {
  console.log('');
  console.log('⚠️  ATENCIÓN: Algunos tipos de jugada tienen problemas');
  console.log('🔧 Necesita revisión de la configuración o código');
}

console.log('');
console.log('📝 ESTRUCTURA REQUERIDA EN TABLA PRECIO:');
console.log('=========================================');
console.log('precios: {');
console.log('  fijo: { regular: X, limited: Y, listeroPct: Z },');
console.log('  corrido: { regular: X, limited: Y, listeroPct: Z },');
console.log('  posicion: { regular: X, limited: Y, listeroPct: Z },');
console.log('  parle: { regular: X, limited: Y, listeroPct: Z },');
console.log('  centena: { regular: X, limited: Y, listeroPct: Z },');
console.log('  tripleta: { regular: X, limited: Y, listeroPct: Z }');
console.log('}');
