/**
 * Pruebas para numberSearchUtils
 * Para ejecutar: node src/utils/__tests__/numberSearchUtils.test.js
 */

const { generateNumberVariants, matchesSearchTerm, formatNumberInput } = require('../numberSearchUtils');

console.log('🧪 Iniciando pruebas de numberSearchUtils...\n');

// Test 1: Parle (4 dígitos)
console.log('📋 Test 1: Parle (4 dígitos)');
const parleVariants = generateNumberVariants('1234');
console.log('Input: 1234');
console.log('Variantes:', parleVariants);
console.log('✅ Esperado: ["1234", "3412"]');
console.log('✅ Correcto:', JSON.stringify(parleVariants) === JSON.stringify(['1234', '3412']) ? 'SÍ' : 'NO');
console.log('');

// Test 2: Tripleta (6 dígitos)
console.log('📋 Test 2: Tripleta (6 dígitos)');
const tripletaVariants = generateNumberVariants('123456');
console.log('Input: 123456');
console.log('Variantes:', tripletaVariants);
console.log('✅ Esperado: 6 permutaciones de [12, 34, 56]');
console.log('✅ Cantidad correcta:', tripletaVariants.length === 6 ? 'SÍ' : 'NO');
console.log('');

// Test 3: Búsqueda con variante alternativa de parle
console.log('📋 Test 3: matchesSearchTerm - Parle alternativo');
const match1 = matchesSearchTerm('1234', '3412');
console.log('Número en vista: 1234, Búsqueda: 3412');
console.log('✅ Debe coincidir:', match1 ? 'SÍ ✓' : 'NO ✗');
console.log('');

// Test 4: Búsqueda con variante alternativa de tripleta
console.log('📋 Test 4: matchesSearchTerm - Tripleta alternativa');
const match2 = matchesSearchTerm('123456', '563412');
console.log('Número en vista: 123456, Búsqueda: 563412');
console.log('✅ Debe coincidir:', match2 ? 'SÍ ✓' : 'NO ✗');
console.log('');

// Test 5: Búsqueda exacta de 2 dígitos
console.log('📋 Test 5: matchesSearchTerm - Fijo (2 dígitos)');
const match3 = matchesSearchTerm('05', '05');
console.log('Número en vista: 05, Búsqueda: 05');
console.log('✅ Debe coincidir:', match3 ? 'SÍ ✓' : 'NO ✗');

const match4 = matchesSearchTerm('05', '50');
console.log('Número en vista: 05, Búsqueda: 50');
console.log('✅ NO debe coincidir:', !match4 ? 'SÍ ✓' : 'NO ✗');
console.log('');

// Test 6: formatNumberInput
console.log('📋 Test 6: formatNumberInput - Solo permitir números');
console.log('Input: "12a34-56"');
console.log('Output:', formatNumberInput('12a34-56'));
console.log('✅ Esperado: "123456"');
console.log('');

// Test 7: Todas las permutaciones de tripleta
console.log('📋 Test 7: Verificar todas las permutaciones de tripleta');
const originalTripleta = '123456';
const allTripletaVariants = [
  '123456', // p1+p2+p3
  '125634', // p1+p3+p2
  '341256', // p2+p1+p3
  '345612', // p2+p3+p1
  '561234', // p3+p1+p2
  '563412'  // p3+p2+p1
];

console.log('Variantes esperadas:', allTripletaVariants);
allTripletaVariants.forEach(variant => {
  const matches = matchesSearchTerm(originalTripleta, variant);
  console.log(`  ${variant} → ${matches ? '✓' : '✗'}`);
});
console.log('');

console.log('🎉 Pruebas completadas!\n');
console.log('📝 Resumen:');
console.log('- Parle (4 dígitos): 2 variantes');
console.log('- Tripleta (6 dígitos): 6 variantes');
console.log('- Búsqueda exacta para otros casos');
console.log('- Input sanitizado (solo números)');
