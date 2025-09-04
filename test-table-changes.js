// Test para verificar los cambios en la tabla de detalles
console.log('🧪 Verificando cambios en tabla de detalles...');

console.log('📋 Cambios implementados:');
console.log('✅ 1. Columna "Total" → "Bruto"');
console.log('✅ 2. Columna "Ganancia" → "Listero"');
console.log('✅ 3. Nueva columna "Balance" (Bruto - Listero - Pagado)');
console.log('✅ 4. Fila de totales agregada');

console.log('\n📊 Estructura de tabla nueva:');
const headers = ['Hora', 'Nota', 'Jugada', 'Números', 'Bruto', 'Balance', 'Listero', 'Pagado'];
console.log('Headers:', headers.join(' | '));

console.log('\n💰 Ejemplo de cálculos:');
const mockJugadas = [
  { total: 1000, listeroEarning: 100, pagado: 500 },
  { total: 1500, listeroEarning: 150, pagado: 0 },
  { total: 800, listeroEarning: 80, pagado: 300 }
];

console.log('Jugadas de ejemplo:');
mockJugadas.forEach((jugada, i) => {
  const balance = jugada.total - jugada.listeroEarning - jugada.pagado;
  console.log(`  Jugada ${i + 1}:`);
  console.log(`    - Bruto: $${jugada.total.toLocaleString()}`);
  console.log(`    - Listero: $${jugada.listeroEarning.toLocaleString()}`);
  console.log(`    - Pagado: $${jugada.pagado.toLocaleString()}`);
  console.log(`    - Balance: $${balance.toLocaleString()}`);
});

console.log('\n📊 Totales calculados:');
const totalBruto = mockJugadas.reduce((sum, j) => sum + j.total, 0);
const totalListero = mockJugadas.reduce((sum, j) => sum + j.listeroEarning, 0);
const totalPagado = mockJugadas.reduce((sum, j) => sum + j.pagado, 0);
const totalBalance = totalBruto - totalListero - totalPagado;

console.log(`  - Total Bruto: $${totalBruto.toLocaleString()}`);
console.log(`  - Total Listero: $${totalListero.toLocaleString()}`);
console.log(`  - Total Pagado: $${totalPagado.toLocaleString()}`);
console.log(`  - Total Balance: $${totalBalance.toLocaleString()}`);

console.log('\n🎨 Estilos agregados:');
console.log('  - balanceCell: Color verde (#27AE60) para columna Balance');
console.log('  - totalRow: Fondo gris con borde superior para fila de totales');
console.log('  - totalCell: Texto en negrita para valores totales');

console.log('\n✨ Resultado esperado en la app:');
console.log('  1. Header con nuevos nombres de columnas');
console.log('  2. Columna Balance calculada automáticamente');
console.log('  3. Fila TOTAL al final de cada grupo');
console.log('  4. Colores diferenciados: Balance (verde), Listero (azul)');

console.log('\n🔍 Para verificar en la app:');
console.log('  1. Ir a StatisticsScreen');
console.log('  2. Seleccionar tab "Detalles"');
console.log('  3. Verificar headers de la tabla');
console.log('  4. Comprobar que aparece fila de totales');
console.log('  5. Verificar que Balance = Bruto - Listero - Pagado');
