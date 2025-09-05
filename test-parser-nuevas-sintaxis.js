// Test para verificar las nuevas sintaxis del parser de texto modo 2.0
const { parseTextMode2 } = require('./src/utils/textModeParser2');

console.log('🧪 Testeando nuevas sintaxis del parser de texto modo 2.0\n');

// Test 1: Decenas con D4
console.log('1️⃣ Test Decenas - D4 con 5f:');
const testD4 = parseTextMode2(['D4 con 5f']);
console.log('Instrucciones:', testD4.instructions.length);
console.log('Números:', testD4.instructions[0]?.numbers);
console.log('Tipo:', testD4.instructions[0]?.playType);
console.log('Errores:', testD4.errors);
console.log('');

// Test 2: Decenas con d7
console.log('2️⃣ Test Decenas - d7 con 10c:');
const testd7 = parseTextMode2(['d7 con 10c']);
console.log('Instrucciones:', testd7.instructions.length);
console.log('Números:', testd7.instructions[0]?.numbers);
console.log('Tipo:', testd7.instructions[0]?.playType);
console.log('Errores:', testd7.errors);
console.log('');

// Test 3: Terminales con t5
console.log('3️⃣ Test Terminales - t5 con 3f:');
const testt5 = parseTextMode2(['t5 con 3f']);
console.log('Instrucciones:', testt5.instructions.length);
console.log('Números:', testt5.instructions[0]?.numbers);
console.log('Tipo:', testt5.instructions[0]?.playType);
console.log('Errores:', testt5.errors);
console.log('');

// Test 4: Parejas con P
console.log('4️⃣ Test Parejas - P con 15f:');
const testP = parseTextMode2(['P con 15f']);
console.log('Instrucciones:', testP.instructions.length);
console.log('Números:', testP.instructions[0]?.numbers);
console.log('Tipo:', testP.instructions[0]?.playType);
console.log('Errores:', testP.errors);
console.log('');

// Test 5: Verificar que las sintaxis existentes siguen funcionando
console.log('5️⃣ Test Centena (existente) - c4x12,34 con 50:');
const testCentena = parseTextMode2(['c4x12,34 con 50']);
console.log('Instrucciones:', testCentena.instructions.length);
console.log('Números:', testCentena.instructions[0]?.numbers);
console.log('Tipo:', testCentena.instructions[0]?.playType);
console.log('Errores:', testCentena.errors);
console.log('');

console.log('✅ Tests completados');
