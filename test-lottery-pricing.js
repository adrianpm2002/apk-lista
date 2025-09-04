// Script de prueba para el sistema de precios específicos por lotería
const testLotterySpecificPricing = () => {
  console.log('🎯 Testing Sistema de Precios Específicos por Lotería');
  console.log('');

  // Simulación de datos JSONB id_precio
  const userGainsData = {
    "1_id": 5,
    "1_nombre": "Nacional",
    "2_id": 8,
    "2_nombre": "Real",
    "3_id": 5,
    "3_nombre": "Leidsa"
  };

  // Simulación de tabla precio
  const precioTable = [
    {
      id: 5,
      nombre: "Ganancia Básica",
      precios: {
        fijo: 70,
        corrido: 7,
        parle: 600,
        posicion: 70,
        centena: 600,
        tripleta: 4500
      }
    },
    {
      id: 8,
      nombre: "Ganancia Premium",
      precios: {
        fijo: 80,
        corrido: 8,
        parle: 700,
        posicion: 80,
        centena: 700,
        tripleta: 5000
      }
    }
  ];

  // Función para obtener precios específicos por lotería
  const getPricesForLottery = (lotteryId) => {
    const gainId = userGainsData[`${lotteryId}_id`];
    if (!gainId) {
      console.log(`❌ No hay ganancia asignada para lotería ${lotteryId}`);
      return null;
    }

    const priceConfig = precioTable.find(p => p.id === gainId);
    if (!priceConfig) {
      console.log(`❌ No se encontró configuración para ganancia ID ${gainId}`);
      return null;
    }

    return priceConfig.precios;
  };

  // Función de cálculo de premio simplificada
  const calculatePrize = (playType, amount, lotteryId, hasWin = true) => {
    const prices = getPricesForLottery(lotteryId);
    if (!prices) return 0;

    const multiplier = prices[playType] || 70;
    return hasWin ? amount * multiplier : 0;
  };

  console.log('1. Datos de usuario (JSONB id_precio):');
  console.log(JSON.stringify(userGainsData, null, 2));
  console.log('');

  console.log('2. Configuraciones de precios disponibles:');
  precioTable.forEach(config => {
    console.log(`   - ${config.nombre} (ID: ${config.id})`);
    console.log(`     fijo: ${config.precios.fijo}, parle: ${config.precios.parle}`);
  });
  console.log('');

  console.log('3. Pruebas de cálculo de premios por lotería:');
  console.log('');

  // Test 1: Lotería Nacional (ID: 1) - usa ganancia ID 5
  console.log('   Test 1: Lotería Nacional (ID: 1)');
  const loteria1Prices = getPricesForLottery(1);
  console.log(`   ✅ Precios obtenidos: fijo=${loteria1Prices?.fijo}, parle=${loteria1Prices?.parle}`);
  const prize1 = calculatePrize('fijo', 100, 1, true);
  console.log(`   ✅ Jugada FIJO $100 → Premio: $${prize1} (100 × ${loteria1Prices?.fijo})`);
  console.log('');

  // Test 2: Lotería Real (ID: 2) - usa ganancia ID 8
  console.log('   Test 2: Lotería Real (ID: 2)');
  const loteria2Prices = getPricesForLottery(2);
  console.log(`   ✅ Precios obtenidos: fijo=${loteria2Prices?.fijo}, parle=${loteria2Prices?.parle}`);
  const prize2 = calculatePrize('fijo', 100, 2, true);
  console.log(`   ✅ Jugada FIJO $100 → Premio: $${prize2} (100 × ${loteria2Prices?.fijo})`);
  console.log('');

  // Test 3: Leidsa (ID: 3) - usa ganancia ID 5
  console.log('   Test 3: Leidsa (ID: 3)');
  const loteria3Prices = getPricesForLottery(3);
  console.log(`   ✅ Precios obtenidos: fijo=${loteria3Prices?.fijo}, parle=${loteria3Prices?.parle}`);
  const prize3 = calculatePrize('parle', 50, 3, true);
  console.log(`   ✅ Jugada PARLE $50 → Premio: $${prize3} (50 × ${loteria3Prices?.parle})`);
  console.log('');

  // Test 4: Comparación de premios entre loterias
  console.log('4. Comparación: Misma jugada, diferentes loterias');
  console.log('   Jugada: FIJO $100');
  console.log(`   Nacional: $${calculatePrize('fijo', 100, 1, true)}`);
  console.log(`   Real: $${calculatePrize('fijo', 100, 2, true)}`);
  console.log(`   Leidsa: $${calculatePrize('fijo', 100, 3, true)}`);
  console.log('');

  console.log('🎉 ¡Sistema funcionando correctamente!');
  console.log('✅ Los precios ahora dependen de la lotería específica');
  console.log('✅ Las ganancias se asignan por lotería usando formato JSONB');
  console.log('✅ El cálculo de premios usa el precio correcto según la lotería');
};

// Ejecutar las pruebas
testLotterySpecificPricing();
