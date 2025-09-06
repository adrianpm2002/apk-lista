const { parseTextMode2 } = require('./src/utils/textModeParser2');

// Test para verificar que las combinaciones de comandos funcionen correctamente
console.log('=== Test de Combinaciones de Comandos ===\n');

// Test 1: d0 t0 con 10f (todos los números de decena 0 + todos los números de terminal 0)
console.log('Test 1: d0 t0 con 10f');
const test1 = parseTextMode2('d0 t0 con 10f', { isLocked: false });
console.log('Errores:', test1.errors);
console.log('Instrucciones:', test1.instructions.length);
if (test1.instructions.length > 0) {
  console.log('Números generados:', test1.instructions[0].numbers);
  console.log('Cantidad de números:', test1.instructions[0].numbers.length);
  console.log('Incluye 00 duplicado como se esperaba?', 
    test1.instructions[0].numbers.filter(n => n === '00').length > 1 ? 'SÍ' : 'NO');
}
console.log('---\n');

// Test 2: t0 d8 p con 15f
console.log('Test 2: t0 d8 p con 15f');
const test2 = parseTextMode2('t0 d8 p con 15f', { isLocked: false });
console.log('Errores:', test2.errors);
console.log('Instrucciones:', test2.instructions.length);
if (test2.instructions.length > 0) {
  console.log('Números generados (primeros 10):', test2.instructions[0].numbers.slice(0, 10));
  console.log('Cantidad total de números:', test2.instructions[0].numbers.length);
}
console.log('---\n');

// Test 3: d5 t7 con 20f
console.log('Test 3: d5 t7 con 20f');
const test3 = parseTextMode2('d5 t7 con 20f', { isLocked: false });
console.log('Errores:', test3.errors);
console.log('Instrucciones:', test3.instructions.length);
if (test3.instructions.length > 0) {
  console.log('Números generados:', test3.instructions[0].numbers);
  console.log('Cantidad de números:', test3.instructions[0].numbers.length);
  console.log('Incluye 57 duplicado?', 
    test3.instructions[0].numbers.filter(n => n === '57').length > 1 ? 'SÍ' : 'NO');
}
console.log('---\n');

// Test 4: Comando individual (debería seguir funcionando)
console.log('Test 4: d0 con 10f (comando individual)');
const test4 = parseTextMode2('d0 con 10f', { isLocked: false });
console.log('Errores:', test4.errors);
console.log('Instrucciones:', test4.instructions.length);
if (test4.instructions.length > 0) {
  console.log('Números generados:', test4.instructions[0].numbers);
  console.log('Cantidad de números:', test4.instructions[0].numbers.length);
}
console.log('---\n');
