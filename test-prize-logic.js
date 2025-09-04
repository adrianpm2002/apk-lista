// Test rápido para verificar la lógica del fijo como corrido
const { parseResultado, winnersByType, evaluatePlay } = require('./src/utils/prizeCalculator');

// Simular resultado "234 5984"
const numeros = '234 5984';
const parsed = parseResultado(numeros);

console.log('Resultado parseado:', parsed);
console.log('Fijo:', parsed.fijo); // Debería ser '34'
console.log('Corridos originales:', parsed.corridos); // Debería ser ['59', '84']

// Verificar ganadores por tipo
const fijoWinners = winnersByType(parsed, 'fijo');
const corridoWinners = winnersByType(parsed, 'corrido');

console.log('\nGanadores fijo:', Array.from(fijoWinners));
console.log('Ganadores corrido:', Array.from(corridoWinners));
console.log('¿El fijo (34) está en corridos?', corridoWinners.has('34'));

// Test de evaluación
const prices = {
  corrido: { limited: 50, regular: 80 }
};

const play = { playType: 'corrido', numbers: '34,59,88', amount: 1 };
const result = evaluatePlay(play, parsed, new Set(), prices);

console.log('\nTest jugada corrido "34,59,88":');
console.log('¿Tiene premio?', result.hasPrize);
console.log('Pago total:', result.pay);
console.log('Esperado: 2 ganadores (34 y 59) × 80 =', 2 * 80);
