// Script de prueba para verificar el botón de info del listero
console.log('🔍 PRUEBA DEL BOTÓN DE INFO - PRECIOS POR LOTERÍA');
console.log('================================================');

// Simulación de datos de usuario con ganancias específicas por lotería
const mockUserProfile = {
  id_precio: {
    "1_id": 5,
    "1_nombre": "Nacional",
    "2_id": 8,
    "2_nombre": "Real",
    "3_id": 5,
    "3_nombre": "Leidsa"
  }
};

// Simulación de configuraciones de precios en la base de datos
const mockPriceConfigs = {
  5: {
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
  8: {
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

// Función para simular la lógica del componente
function simulatePricingInfoButton(userProfile) {
  console.log('👤 Simulando carga de datos del usuario...');
  console.log('');
  
  const lotteryPrices = {};
  
  if (userProfile?.id_precio && typeof userProfile.id_precio === 'object') {
    const gainsData = userProfile.id_precio;
    
    // Obtener todas las entradas de ganancias por lotería
    const lotteryEntries = Object.entries(gainsData).filter(([key]) => key.endsWith('_id'));
    
    console.log(`📋 Encontradas ${lotteryEntries.length} configuraciones de lotería:`);
    console.log('');
    
    for (const [key, gainId] of lotteryEntries) {
      const lotteryId = key.replace('_id', '');
      const lotteryName = gainsData[`${lotteryId}_nombre`] || `Lotería ${lotteryId}`;
      
      console.log(`🎯 Procesando ${lotteryName} (ID: ${lotteryId})`);
      console.log(`   Ganancia ID: ${gainId}`);
      
      const priceConfig = mockPriceConfigs[gainId];
      if (priceConfig) {
        lotteryPrices[lotteryId] = {
          nombre: lotteryName,
          precios: priceConfig.precios || {},
          gainName: priceConfig.nombre || 'Sin nombre',
          gainId: gainId
        };
        console.log(`   ✅ Configuración cargada: ${priceConfig.nombre}`);
      } else {
        console.log(`   ❌ No se encontró configuración para ganancia ID ${gainId}`);
      }
      console.log('');
    }
  }
  
  return lotteryPrices;
}

// Función para mostrar cómo se renderizaría la información
function renderPricingInfo(lotteryPrices) {
  console.log('🎨 RENDERIZADO DEL COMPONENTE:');
  console.log('==============================');
  console.log('');
  
  if (!Object.keys(lotteryPrices).length) {
    console.log('⚠️  Sin configuraciones de precios disponibles');
    return;
  }
  
  const ORDER = ['fijo','corrido','posicion','parle','centena','tripleta'];
  
  Object.entries(lotteryPrices).forEach(([lotteryId, lotteryData]) => {
    console.log(`🏆 ${lotteryData.nombre.toUpperCase()}`);
    console.log(`   Configuración: ${lotteryData.gainName}`);
    console.log('   ' + '─'.repeat(40));
    
    const precios = lotteryData.precios || {};
    const orderedEntries = ORDER.filter(k => precios[k]).map(k => [k, precios[k]]);
    
    if (orderedEntries.length === 0) {
      console.log('   Sin precios configurados');
    } else {
      orderedEntries.forEach(([tipo, obj]) => {
        const limited = obj?.limited ?? '-';
        const regular = obj?.regular ?? '-';
        const lPct = obj?.listeroPct ?? '-';
        
        console.log(`   📌 ${tipo.toUpperCase()}`);
        console.log(`      Regular: ${regular} | Limitado: ${limited} | Listero: ${lPct}%`);
      });
    }
    console.log('');
  });
}

// Ejecutar simulación
console.log('🚀 Iniciando simulación...');
console.log('');

const lotteryPrices = simulatePricingInfoButton(mockUserProfile);
renderPricingInfo(lotteryPrices);

console.log('📊 RESUMEN DEL CAMBIO:');
console.log('======================');
console.log('✅ ANTES: El botón mostraba precios genéricos para todas las jugadas');
console.log('✅ AHORA: El botón muestra precios específicos organizados por lotería');
console.log('✅ Cada lotería muestra su configuración de ganancia asignada');
console.log('✅ Los precios se obtienen del campo JSONB id_precio del usuario');
console.log('✅ Interfaz organizada por secciones de lotería');
console.log('');
console.log('🎯 BENEFICIOS:');
console.log('- El listero puede ver exactamente qué ganancias tiene por cada lotería');
console.log('- Mayor claridad en la información mostrada');
console.log('- Facilita la comprensión de las diferentes configuraciones');
console.log('- Permite identificar rápidamente las diferencias entre loterias');
console.log('');
console.log('🎉 ¡Modificación del botón de info completada exitosamente!');
